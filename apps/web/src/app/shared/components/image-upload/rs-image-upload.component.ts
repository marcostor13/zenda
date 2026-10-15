import {
  Component,
  Input,
  OnInit,
  OnDestroy,
  computed,
  forwardRef,
  inject,
  signal,
} from '@angular/core';
import {
  AbstractControl,
  ControlValueAccessor,
  NG_VALIDATORS,
  NG_VALUE_ACCESSOR,
  ValidationErrors,
  Validator,
} from '@angular/forms';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { TimeoutError, firstValueFrom, timeout } from 'rxjs';
import { RsIconComponent } from '../icon/rs-icon.component';
import { environment } from '../../../../environments/environment';
import { DiagnosticoSubidaService } from '../../../core/diagnostico/diagnostico-subida.service';
import { TraducirPipe } from '../../../core/i18n/traducir.pipe';
import { almacenSesion } from '../../../core/plataforma/almacen';
import {
  MAX_SUBIDA_BYTES, ProblemaSubida, pareceImagen, prepararImagen, problemaDeSubida, requierePreparacion,
} from '../../media/preparar-imagen';

/**
 * Tope de una subida. Con mala cobertura la petición puede quedarse colgada sin
 * error, y mientras tanto el control está en `subidaEnCurso`: el formulario no
 * dejaba continuar y la casilla giraba para siempre. 5 MB a 3G lento caben de
 * sobra en dos minutos.
 */
const ESPERA_SUBIDA_MS = 120_000;

/** Fotos a medio preparar, apuntadas por si Safari recarga la pestaña. */
const CLAVE_PREPARACION = 'dk_fotos_preparandose';

/** Una marca más vieja no es de esta visita: alguien volvió horas después. */
const VIGENCIA_MARCA_MS = 10 * 60_000;

interface MarcaPreparacion {
  readonly origen: string;
  readonly en: number;
  readonly nombres: string[];
}

interface ImageSlot {
  id: string;
  /** Nombre con que la entregó el móvil, para decir cuál falló. */
  nombre: string;
  previewUrl: string;
  uploadedUrl: string | null;
  uploading: boolean;
  error: string;
  isBlob: boolean;
}

@Component({
  selector: 'rs-image-upload',
  standalone: true,
  imports: [
    TraducirPipe, RsIconComponent
  ],
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => RsImageUploadComponent),
      multi: true,
    },
    {
      provide: NG_VALIDATORS,
      useExisting: forwardRef(() => RsImageUploadComponent),
      multi: true,
    },
  ],
  template: `
    <div
      class="upload-zone"
      [class.upload-zone--drag]="isDragging()"
      [class.upload-zone--has-images]="slots().length > 0"
      [class.upload-zone--disabled]="disabled"
      (dragover)="onDragOver($event)"
      (dragleave)="onDragLeave()"
      (drop)="onDrop($event)"
      (click)="slots().length === 0 && fileInput.click()">

      @if (slots().length === 0) {
        <div class="upload-placeholder">
          <div class="upload-placeholder__icon">
            <rs-icon name="upload" [size]="28" [stroke]="1.5"></rs-icon>
          </div>
          <p class="upload-hint">
            Arrastra {{ multiple ? 'imágenes' : 'una imagen' }} aquí o
            <!-- Sin stopPropagation el toque subía a la zona, que volvía a
                 abrir el selector: dos click() por un toque, y en iOS la
                 selección se podía perder sin evento de cambio. -->
            <button type="button" class="upload-link"
                    (click)="$event.stopPropagation(); fileInput.click()">{{ 'haz clic para seleccionar' | t }}</button>
          </p>
          <p class="upload-meta">JPEG, PNG o WebP · Máx 5 MB{{ multiple ? ' · Hasta ' + maxFiles + ' imágenes' : '' }}</p>
          <p class="upload-meta">{{ 'Las fotos de iPhone se convierten solas.' | t }}</p>
        </div>
      } @else {
        <div class="image-grid" (click)="$event.stopPropagation()">
          @for (slot of slots(); track slot.id; let i = $index) {
            <div class="image-tile" [class.image-tile--error]="slot.error">
              @if (slot.previewUrl) {
                <img [src]="slot.previewUrl" [alt]="'Imagen subida' | t" class="image-tile__img" />
              } @else {
                <!-- Foto grande aún sin convertir: su vista previa en crudo es
                     lo que agota la memoria del iPhone. -->
                <div class="image-tile__vacia">
                  <rs-icon name="image" [size]="22" [stroke]="1.5"></rs-icon>
                </div>
              }

              @if (slot.uploading) {
                <div class="image-tile__overlay">
                  <div class="spinner"></div>
                </div>
              }

              @if (slot.error && !slot.uploading) {
                <!-- El número casa la casilla con su aviso de debajo. -->
                <div class="image-tile__overlay image-tile__overlay--error">
                  <rs-icon name="alert-circle" [size]="16" [stroke]="2"></rs-icon>
                  <span class="image-tile__numero">{{ i + 1 }}</span>
                </div>
              }

              @if (!slot.uploading) {
                <button
                  type="button"
                  class="image-tile__remove"
                  [title]="'Eliminar imagen' | t"
                  (click)="removeSlot(slot.id)">
                  <rs-icon name="x" [size]="10" [stroke]="3"></rs-icon>
                </button>
              }
            </div>
          }

          @if (canAddMore()) {
            <button
              type="button"
              class="image-tile image-tile--add"
              [title]="'Añadir imagen' | t"
              (click)="fileInput.click()">
              <rs-icon name="plus" [size]="22" [stroke]="1.5" style="color:var(--t-400)"></rs-icon>
            </button>
          }
        </div>
      }
    </div>

    @if (aviso(); as texto) {
      <p class="upload-error" role="alert">
        <rs-icon name="alert-circle" [size]="15" [stroke]="2" />
        <span>{{ texto }}</span>
      </p>
    }
    <!-- Un aviso por foto: con varias a la vez, «no se pudo subir» no decía
         cuál ni por qué. -->
    @for (fallo of fallos(); track fallo.id) {
      <p class="upload-error" role="alert">
        <rs-icon name="alert-circle" [size]="15" [stroke]="2" />
        <span><strong>{{ fallo.etiqueta }}:</strong> {{ fallo.mensaje }}</span>
        <button type="button" class="upload-error__retry" (click)="reintentarSlot(fallo.id)">{{ 'Reintentar' | t }}</button>
      </p>
    }

    <!--
      Sólo el comodín de imagen, y esto es deliberado.

      iOS convierte la foto del carrete a JPEG al entregarla SALVO que la página
      declare que acepta HEIC. Al listar aquí las extensiones .heic y .heif le
      estábamos diciendo justo eso, así que Safari entregaba el HEIC original y
      toda la conversión quedaba en manos del navegador. Sin esas extensiones la
      hace iOS, que es quien mejor sabe hacerlo.

      El comodín no vacía el selector de iOS —eso pasa con listas cerradas de
      tipos MIME, del estilo image/jpeg,image/png—, y quien tenga un HEIC en el
      escritorio lo puede seguir arrastrando: el drop no mira accept.
    -->
    <input
      #fileInput
      type="file"
      accept="image/*"
      style="display:none"
      [multiple]="multiple"
      (change)="onFileChange($event)" />
  `,
  styles: [`
    :host { display: block; }

    .upload-zone {
      border: 2px dashed var(--b-2);
      border-radius: var(--r-xl);
      padding: var(--sp-8);
      cursor: pointer;
      transition: border-color var(--d-2), background var(--d-2);
      background: var(--c-raised);
      min-height: 120px;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .upload-zone:hover { border-color: var(--c-accent); }
    .upload-zone--drag { border-color: var(--c-accent); background: var(--c-accent-lo); }
    .upload-zone--has-images { cursor: default; padding: var(--sp-5); }
    .upload-zone--disabled { opacity: .5; pointer-events: none; }

    .upload-placeholder {
      text-align: center;
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: var(--sp-3);
      pointer-events: none;
    }
    .upload-placeholder__icon {
      width: 56px; height: 56px; border-radius: 50%;
      background: var(--c-surface);
      display: flex; align-items: center; justify-content: center;
      color: var(--t-400);
    }
    .upload-hint { font-size: var(--f-sm); color: var(--t-300); pointer-events: all; }
    .upload-link {
      color: var(--c-accent); background: none; border: none;
      cursor: pointer; padding: 0; font-size: inherit; text-decoration: underline;
    }
    .upload-meta { font-size: var(--f-xs); color: var(--t-500); }

    .image-grid { display: flex; flex-wrap: wrap; gap: var(--sp-3); width: 100%; }

    .image-tile {
      position: relative; width: 96px; height: 96px;
      border-radius: var(--r-lg); overflow: hidden; flex-shrink: 0;
    }
    .image-tile__img { width: 100%; height: 100%; object-fit: cover; display: block; }

    .image-tile__overlay {
      position: absolute; inset: 0;
      background: rgba(0,0,0,.55);
      display: flex; align-items: center; justify-content: center;
      color: #fff;
    }
    .image-tile__overlay--error { background: rgba(239,68,68,.5); gap: var(--sp-1); }
    .image-tile__numero { font-size: var(--f-sm); font-weight: 700; }
    .image-tile__vacia {
      width: 100%; height: 100%;
      display: flex; align-items: center; justify-content: center;
      background: var(--c-surface); color: var(--t-400);
    }

    .image-tile__remove {
      position: absolute; top: 4px; right: 4px;
      width: 20px; height: 20px; border-radius: 50%;
      background: rgba(0,0,0,.7); border: none; cursor: pointer;
      display: flex; align-items: center; justify-content: center;
      color: #fff; transition: background var(--d-1);
    }
    .image-tile__remove:hover { background: #DC2626; }

    .image-tile--add {
      border: 2px dashed var(--b-2);
      background: var(--c-raised);
      display: flex; align-items: center; justify-content: center;
      cursor: pointer; transition: all var(--d-2);
    }
    .image-tile--add:hover { border-color: var(--c-accent); background: var(--c-accent-lo); }

    /* El aviso vive fuera de la zona de subida: el usuario tiene que leerlo
       antes de guardar la ficha, no descubrir un icono rojo sobre la miniatura. */
    .upload-error {
      display: flex; align-items: center; gap: var(--sp-2);
      margin-top: var(--sp-2);
      font-size: var(--f-xs); color: var(--c-danger, #DC2626);
    }
    .upload-error__retry {
      background: none; border: none; padding: 0;
      color: var(--c-accent); cursor: pointer;
      font-size: inherit; text-decoration: underline;
    }

    .spinner {
      width: 22px; height: 22px; border-radius: 50%;
      border: 2px solid rgba(255,255,255,.3);
      border-top-color: #fff;
      animation: spin .7s linear infinite;
    }
    @keyframes spin { to { transform: rotate(360deg); } }
  `],
})
export class RsImageUploadComponent
  implements ControlValueAccessor, Validator, OnInit, OnDestroy
{
  private readonly http = inject(HttpClient);
  private readonly diagnostico = inject(DiagnosticoSubidaService);

  /**
   * Pantalla desde la que se sube, para el parte de diagnóstico. Sin esto, en
   * los registros del servidor no se distingue el logotipo del comercio de la
   * foto de un perro.
   */
  @Input() origen = '';

  @Input() multiple = false;
  @Input() maxFiles = 6;

  readonly isDragging = signal(false);
  readonly slots = signal<ImageSlot[]>([]);
  /**
   * Aviso que no es de una foto concreta: la selección llegó vacía, no era una
   * imagen, sobraban fotos o la pestaña se recargó a medias.
   */
  readonly aviso = signal('');
  /** Un aviso por cada foto que no se subió, numerado como su casilla. */
  readonly fallos = computed(() =>
    this.slots()
      .map((slot, i) => ({ slot, posicion: i + 1 }))
      .filter(({ slot }) => slot.error)
      .map(({ slot, posicion }) => ({
        id: slot.id,
        etiqueta: slot.nombre ? `Foto ${posicion} (${slot.nombre})` : `Foto ${posicion}`,
        mensaje: slot.error,
      })),
  );
  /** Todo lo que se le está avisando al usuario, en una línea. */
  readonly mensajeError = computed(() =>
    [this.aviso(), ...this.fallos().map((f) => f.mensaje)].filter(Boolean).join(' '),
  );
  disabled = false;

  private blobUrls: string[] = [];
  /** Ficheros que fallaron, para poder reintentar sin volver a elegirlos. */
  private pendientes = new Map<string, File>();
  /** Tandas de fotos preparándose ahora mismo; ver `marcarPreparacion`. */
  private tandasEnCurso = 0;
  private onChange: (v: string | string[] | null) => void = () => {};
  private onTouched: () => void = () => {};
  private onValidatorChange: () => void = () => {};

  ngOnInit(): void {
    this.avisarSiSeRecargo();
  }

  ngOnDestroy(): void {
    this.blobUrls.forEach(u => URL.revokeObjectURL(u));
    // Salir de la pantalla a mitad de tanda no es una recarga: sin esto, volver
    // al alta enseñaría el aviso de «la página se recargó». Una recarga de
    // verdad no pasa por aquí.
    if (this.tandasEnCurso > 0) {
      try { almacenSesion().removeItem(CLAVE_PREPARACION); } catch { /* nada */ }
    }
  }

  canAddMore(): boolean {
    return this.multiple && this.slots().length < this.maxFiles;
  }

  writeValue(value: string | string[] | null): void {
    this.pendientes.clear();
    if (!value) { this.slots.set([]); return; }
    const urls = Array.isArray(value) ? value : [value];
    this.slots.set(
      urls.filter(Boolean).map(url => ({
        id: this.uid(),
        nombre: '',
        previewUrl: url,
        uploadedUrl: url,
        uploading: false,
        error: '',
        isBlob: false,
      })),
    );
  }

  registerOnChange(fn: (v: string | string[] | null) => void): void { this.onChange = fn; }
  registerOnTouched(fn: () => void): void { this.onTouched = fn; }
  setDisabledState(disabled: boolean): void { this.disabled = disabled; }

  registerOnValidatorChange(fn: () => void): void { this.onValidatorChange = fn; }

  /**
   * Invalida el control mientras haya una subida fallida o en curso: sin esto el
   * formulario se guardaba sin foto y el usuario creía que se había subido
   * (TCK-8012).
   */
  validate(_control: AbstractControl): ValidationErrors | null {
    const slots = this.slots();
    if (slots.some(s => s.error)) return { subidaFallida: true };
    if (slots.some(s => s.uploading)) return { subidaEnCurso: true };
    return null;
  }

  /** Vuelve a intentar las subidas que fallaron, sin reelegir los ficheros. */
  reintentar(): void {
    this.reintentarSlots(this.slots().filter(s => s.error).map(s => s.id));
  }

  /** Reintenta sólo la foto de ese aviso. */
  reintentarSlot(id: string): void {
    this.reintentarSlots([id]);
  }

  private reintentarSlots(ids: string[]): void {
    const ficheros = ids.map(id => this.pendientes.get(id)).filter((f): f is File => !!f);
    ids.forEach(id => { this.removeSlot(id); this.pendientes.delete(id); });
    void this.processFiles(ficheros);
  }

  onDragOver(e: DragEvent): void {
    e.preventDefault();
    this.isDragging.set(true);
  }

  onDragLeave(): void { this.isDragging.set(false); }

  onDrop(e: DragEvent): void {
    e.preventDefault();
    this.isDragging.set(false);
    const files = Array.from(e.dataTransfer?.files ?? []);
    void this.processFiles(files);
  }

  onFileChange(e: Event): void {
    const input = e.target as HTMLInputElement;
    const files = Array.from(input.files ?? []);
    input.value = '';

    /*
     * El selector se cerró con fotos marcadas y el navegador no entregó
     * ninguna. En iPhone pasa con fotos que viven en iCloud y no se llegan a
     * descargar: antes no se pintaba nada y parecía que la web ignoraba la
     * selección.
     */
    if (!files.length) {
      this.aviso.set('No ha llegado ninguna foto desde el móvil. Si están guardadas en iCloud, ábrelas primero en la app Fotos para que se descarguen y vuelve a elegirlas.');
      this.diagnostico.registrar({ paso: 'sin_ficheros', ...this.contexto() });
      return;
    }
    void this.processFiles(files);
  }

  removeSlot(id: string): void {
    const slot = this.slots().find(s => s.id === id);
    if (slot) this.olvidarPreview(slot);
    this.slots.update(s => s.filter(sl => sl.id !== id));
    this.emitValue();
    this.onTouched();
  }

  private async processFiles(files: File[]): Promise<void> {
    this.aviso.set('');
    const imagenes = files.filter(f => pareceImagen(f));
    const descartados = files.filter(f => !pareceImagen(f));

    // Callar un descarte deja al usuario mirando una pantalla que no reacciona.
    for (const descartado of descartados) {
      this.diagnostico.registrar({ paso: 'descartado', ...this.contexto(), fichero: descartado });
    }
    if (files.length && !imagenes.length) {
      this.aviso.set('Ese archivo no es una imagen. Usa JPEG, PNG, WebP o GIF.');
      return;
    }

    const restantes = this.multiple ? this.maxFiles - this.slots().length : 1;
    const aSubir = imagenes.slice(0, Math.max(0, restantes));
    this.avisarDescartes(descartados, imagenes.length - aSubir.length);

    // Todas las casillas a la vista desde el primer momento: con la preparación
    // de una en una, la quinta foto tardaba medio minuto en aparecer.
    const casillas = aSubir.map(original => ({ id: this.crearSlot(original), original }));
    this.marcarPreparacion(aSubir, true);

    const enVuelo: Promise<void>[] = [];
    try {
      for (const { id, original } of casillas) {
        /*
         * La preparación va de una en una. Decodificar varias fotos de 12 MP a
         * la vez agota la memoria de un iPhone y Safari recarga la pestaña sin
         * más; el envío, que no consume memoria, sí se solapa.
         */
        const listo = await this.prepararSlot(id, original);
        if (listo) enVuelo.push(this.enviar(listo.id, listo.file));
      }
    } finally {
      this.marcarPreparacion(aSubir, false);
    }

    await Promise.all(enVuelo);
  }

  /** Lo que no entra en la tanda se dice, no se tira en silencio. */
  private avisarDescartes(descartados: File[], sobrantes: number): void {
    const partes: string[] = [];
    if (descartados.length) {
      const nombres = descartados.map(f => f.name || 'sin nombre').join(', ');
      partes.push(`No son imágenes y no se han añadido: ${nombres}.`);
    }
    if (sobrantes > 0) {
      partes.push(`Aquí caben ${this.maxFiles} fotos como máximo: ${sobrantes === 1 ? 'una no se ha añadido' : sobrantes + ' no se han añadido'}.`);
    }
    if (partes.length) this.aviso.set(partes.join(' '));
  }

  /**
   * Crea la casilla en cuanto llega la foto, antes de prepararla.
   *
   * Si hay que convertirla o reducirla, la casilla sale sin vista previa: pintar
   * el original de una foto de 48 MP, aunque sea en 96 px, lo decodifica entero
   * (~190 MB), y con varias a la vez Safari en iOS recargaba la pestaña. Las
   * fotos simplemente desaparecían.
   */
  private crearSlot(original: File): string {
    const id = this.uid();
    const slot: ImageSlot = {
      id,
      nombre: original.name,
      previewUrl: requierePreparacion(original) ? '' : this.registrarPreview(original),
      uploadedUrl: null,
      uploading: true,
      error: '',
      isBlob: true,
    };

    if (!this.multiple) {
      this.slots().forEach(sl => this.olvidarPreview(sl));
      this.slots.set([slot]);
    } else {
      this.slots.update(s => [...s, slot]);
    }
    this.onValidatorChange();
    return id;
  }

  /**
   * Prepara la imagen de la casilla y comprueba que se puede subir. Nunca
   * lanza: un fallo inesperado acaba en el aviso de esa foto, no en una casilla
   * girando para siempre.
   */
  private async prepararSlot(id: string, original: File): Promise<{ id: string; file: File } | null> {
    try {
      return await this.convertirSlot(id, original);
    } catch (error) {
      this.diagnostico.registrar({ paso: 'sin_convertir', ...this.contexto(), fichero: original, detalle: String(error) });
      this.marcarFallo(id, original, 'No se ha podido preparar esta foto en el móvil. Prueba con otra o hazle una captura de pantalla.');
      return null;
    }
  }

  private async convertirSlot(id: string, original: File): Promise<{ id: string; file: File } | null> {
    /*
     * Conversión y reescalado (ver `shared/media/preparar-imagen.ts`): un HEIC
     * en crudo sólo lo pinta Safari, y una foto de móvil sin reducir se pasa del
     * límite del endpoint. Un JPEG que ya cabe no se toca.
     */
    let file = original;
    let falloConversion = '';
    try {
      file = await prepararImagen(original, MAX_SUBIDA_BYTES);
    } catch (error) {
      file = original;
      falloConversion = String(error);
    }

    const problema = problemaDeSubida(file, MAX_SUBIDA_BYTES);
    if (problema) {
      /*
       * Aquí se decide el caso: `sin_convertir` con un fallo apuntado es que el
       * navegador no supo abrir el HEIC; sin él, que la conversión terminó pero
       * devolvió el original. Son dos causas distintas y hasta ahora las dos
       * enseñaban el mismo mensaje.
       */
      this.diagnostico.registrar({
        paso: problema === 'sin_convertir' && falloConversion ? 'sin_decodificar' : problema,
        ...this.contexto(),
        fichero: original,
        resultado: file,
        detalle: falloConversion || undefined,
      });
      this.marcarFallo(id, original, this.textoDelProblema(problema));
      return null;
    }

    // La casilla salió sin vista previa, o con la del original, que no se pinta
    // fuera de Safari si era un HEIC: se pone la de la imagen ya preparada.
    const sinVista = this.slots().some(sl => sl.id === id && !sl.previewUrl);
    if (file !== original || sinVista) {
      this.slots.update(s => s.map(sl => {
        if (sl.id !== id) return sl;
        this.olvidarPreview(sl);
        return { ...sl, previewUrl: this.registrarPreview(file) };
      }));
    }

    return { id, file };
  }

  private async enviar(id: string, file: File): Promise<void> {
    try {
      const formData = new FormData();
      formData.append('file', file);
      const res = await firstValueFrom(
        this.http.post<{ url: string }>(`${environment.apiUrl}/upload/image`, formData)
          .pipe(timeout(ESPERA_SUBIDA_MS)),
      );
      this.slots.update(s =>
        s.map(sl => sl.id === id ? { ...sl, uploadedUrl: res.url, uploading: false } : sl),
      );
      this.diagnostico.registrar({ paso: 'subida', ...this.contexto(), fichero: file });
      this.emitValue();
      this.onTouched();
    } catch (error) {
      this.diagnostico.registrarFalloHttp({ ...this.contexto(), fichero: file }, error);
      this.marcarFallo(id, file, this.textoDelError(error));
    }
  }

  /** Lo que sitúa el parte: a qué endpoint iba y desde qué pantalla. */
  private contexto(): { destino: string; origen: string } {
    return { destino: 'image', origen: this.origen };
  }

  /** Deja la casilla en error y guarda el fichero por si se reintenta. */
  private marcarFallo(id: string, fichero: File, mensaje: string): void {
    this.pendientes.set(id, fichero);
    this.slots.update(s =>
      s.map(sl => sl.id === id ? { ...sl, uploading: false, error: mensaje } : sl),
    );
    this.emitValue();
  }

  /**
   * Apunta en la sesión qué fotos se están preparando, para poder explicarlo
   * si la pestaña no sobrevive.
   *
   * Cuando Safari en iOS se queda sin memoria convirtiendo fotos, no hay error
   * que capturar: recarga la página y ya. El alta se restaura desde el
   * borrador, pero sin esas fotos, y el comercio veía que «no aparecían».
   */
  private marcarPreparacion(ficheros: File[], empieza: boolean): void {
    this.tandasEnCurso += empieza ? 1 : -1;
    try {
      if (empieza) {
        const marca: MarcaPreparacion = { origen: this.origen, en: Date.now(), nombres: ficheros.map(f => f.name) };
        almacenSesion().setItem(CLAVE_PREPARACION, JSON.stringify(marca));
      } else if (this.tandasEnCurso <= 0) {
        almacenSesion().removeItem(CLAVE_PREPARACION);
      }
    } catch { /* sin almacén de sesión sólo se pierde el aviso */ }
  }

  /** Si la pestaña se recargó con fotos a medio preparar, lo dice. */
  private avisarSiSeRecargo(): void {
    let marca: MarcaPreparacion | null = null;
    try {
      marca = JSON.parse(almacenSesion().getItem(CLAVE_PREPARACION) ?? 'null') as MarcaPreparacion | null;
    } catch { return; }
    if (!marca || marca.origen !== this.origen || Date.now() - marca.en > VIGENCIA_MARCA_MS) return;

    try { almacenSesion().removeItem(CLAVE_PREPARACION); } catch { /* nada */ }
    const nombres = marca.nombres.filter(Boolean).join(', ');
    this.aviso.set(
      `La página se recargó mientras se preparaban tus fotos${nombres ? ` (${nombres})` : ''} y no se han subido. `
      + 'Suele pasar en iPhone al elegir muchas fotos grandes a la vez: vuelve a elegirlas de dos en dos.',
    );
    this.diagnostico.registrar({ paso: 'recargada', ...this.contexto(), detalle: `fotos=${marca.nombres.length} ${nombres}` });
  }

  /** Qué contarle al usuario cuando la foto no llega siquiera a enviarse. */
  private textoDelProblema(problema: ProblemaSubida): string {
    if (problema === 'vacio') {
      return 'Esa foto llegó vacía. Si está guardada en iCloud, ábrela primero en la app Fotos para que se descargue al móvil y vuelve a intentarlo.';
    }
    if (problema === 'sin_convertir') {
      return 'No hemos podido convertir esta foto de iPhone (HEIC). Elígela desde la app Fotos, o cambia en Ajustes › Cámara › Formatos a «Más compatible».';
    }
    return 'La foto pesa demasiado incluso después de reducirla. Prueba con otra o hazle una captura.';
  }

  /** Crea la vista previa y la anota para revocarla al destruir el componente. */
  private registrarPreview(fichero: File): string {
    const url = URL.createObjectURL(fichero);
    this.blobUrls.push(url);
    return url;
  }

  /** Libera la vista previa de una casilla que se sustituye o desaparece. */
  private olvidarPreview(slot: ImageSlot): void {
    if (!slot.isBlob) return;
    URL.revokeObjectURL(slot.previewUrl);
    this.blobUrls = this.blobUrls.filter(u => u !== slot.previewUrl);
  }

  /** Traduce el fallo HTTP a algo que el usuario pueda entender y accionar. */
  private textoDelError(error: unknown): string {
    if (error instanceof TimeoutError) {
      return 'La foto tardaba demasiado en subir (la conexión va lenta). Pulsa «Reintentar» cuando tengas mejor cobertura o wifi.';
    }
    if (!(error instanceof HttpErrorResponse)) {
      return 'No se pudo subir la foto. Pulsa «Reintentar».';
    }
    const detalle = (error.error as { message?: unknown } | null)?.message;
    switch (true) {
      case error.status === 0:
        return 'No se pudo subir la foto: no hay conexión con el servidor. Comprueba tu cobertura o wifi y pulsa «Reintentar».';
      case error.status === 401:
        return 'Tu sesión ha caducado y la foto no se ha subido. Vuelve a iniciar sesión y súbela de nuevo.';
      case error.status === 413:
        return 'La foto pesa demasiado (máx. 5 MB). Prueba con otra o hazle una captura de pantalla.';
      // El 422 por tamaño lo genera Nest en inglés («expected size…»); el de
      // formato, el servicio, en español. Al usuario se le explica cada uno.
      case error.status === 422 && /size/i.test(String(detalle)):
        return 'La foto pesa demasiado (máx. 5 MB). Prueba con otra o hazle una captura de pantalla.';
      case error.status === 422:
        return 'Ese archivo no es una foto válida. Usa una imagen JPEG, PNG, WebP o una foto del carrete del móvil.';
      case error.status === 429:
        return 'Has subido muchas fotos seguidas. Espera un minuto y pulsa «Reintentar».';
      // Un fallo nuestro con causa conocida («almacén no configurado») trae su
      // texto; el 500 genérico de Nest llega en inglés y no dice nada útil.
      case error.status >= 500 && (typeof detalle !== 'string' || /internal server error/i.test(detalle)):
        return 'El servidor no ha podido guardar la foto ahora mismo. Espera unos segundos y pulsa «Reintentar».';
      default:
        return typeof detalle === 'string' && detalle.trim()
          ? detalle
          : 'No se pudo subir la foto. Pulsa «Reintentar».';
    }
  }

  private emitValue(): void {
    const urls = this.slots()
      .filter(s => s.uploadedUrl && !s.error)
      .map(s => s.uploadedUrl!);
    this.onChange(this.multiple ? urls : (urls[0] ?? null));
    this.onValidatorChange();
  }

  private uid(): string {
    return Math.random().toString(36).slice(2) + Date.now().toString(36);
  }
}
