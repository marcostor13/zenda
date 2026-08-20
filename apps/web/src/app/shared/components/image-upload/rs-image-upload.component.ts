import {
  Component,
  Input,
  OnInit,
  OnDestroy,
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
import { firstValueFrom } from 'rxjs';
import { RsIconComponent } from '../icon/rs-icon.component';
import { environment } from '../../../../environments/environment';
import {
  MAX_SUBIDA_BYTES, ProblemaSubida, pareceImagen, prepararImagen, problemaDeSubida,
} from '../../media/preparar-imagen';

interface ImageSlot {
  id: string;
  previewUrl: string;
  uploadedUrl: string | null;
  uploading: boolean;
  error: string;
  isBlob: boolean;
}

@Component({
  selector: 'rs-image-upload',
  standalone: true,
  imports: [RsIconComponent],
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
            <button type="button" class="upload-link" (click)="fileInput.click()">haz clic para seleccionar</button>
          </p>
          <p class="upload-meta">JPEG, PNG o WebP · Máx 5 MB{{ multiple ? ' · Hasta ' + maxFiles + ' imágenes' : '' }}</p>
          <p class="upload-meta">Las fotos de iPhone se convierten solas.</p>
        </div>
      } @else {
        <div class="image-grid" (click)="$event.stopPropagation()">
          @for (slot of slots(); track slot.id) {
            <div class="image-tile" [class.image-tile--error]="slot.error">
              <img [src]="slot.previewUrl" alt="Imagen subida" class="image-tile__img" />

              @if (slot.uploading) {
                <div class="image-tile__overlay">
                  <div class="spinner"></div>
                </div>
              }

              @if (slot.error && !slot.uploading) {
                <div class="image-tile__overlay image-tile__overlay--error">
                  <rs-icon name="alert-circle" [size]="18" [stroke]="2"></rs-icon>
                </div>
              }

              @if (!slot.uploading) {
                <button
                  type="button"
                  class="image-tile__remove"
                  title="Eliminar imagen"
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
              title="Añadir imagen"
              (click)="fileInput.click()">
              <rs-icon name="plus" [size]="22" [stroke]="1.5" style="color:var(--t-400)"></rs-icon>
            </button>
          }
        </div>
      }
    </div>

    @if (mensajeError(); as error) {
      <p class="upload-error" role="alert">
        <rs-icon name="alert-circle" [size]="15" [stroke]="2" />
        <span>{{ error }}</span>
        <button type="button" class="upload-error__retry" (click)="reintentar()">Reintentar</button>
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
    .image-tile__overlay--error { background: rgba(239,68,68,.5); }

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

  @Input() multiple = false;
  @Input() maxFiles = 6;

  readonly isDragging = signal(false);
  readonly slots = signal<ImageSlot[]>([]);
  /** Motivo del último fallo de subida; se muestra bajo la zona de subida. */
  readonly mensajeError = signal('');
  disabled = false;

  private blobUrls: string[] = [];
  /** Ficheros que fallaron, para poder reintentar sin volver a elegirlos. */
  private pendientes = new Map<string, File>();
  private onChange: (v: string | string[] | null) => void = () => {};
  private onTouched: () => void = () => {};
  private onValidatorChange: () => void = () => {};

  ngOnInit(): void {}

  ngOnDestroy(): void {
    this.blobUrls.forEach(u => URL.revokeObjectURL(u));
  }

  canAddMore(): boolean {
    return this.multiple && this.slots().length < this.maxFiles;
  }

  writeValue(value: string | string[] | null): void {
    this.mensajeError.set('');
    this.pendientes.clear();
    if (!value) { this.slots.set([]); return; }
    const urls = Array.isArray(value) ? value : [value];
    this.slots.set(
      urls.filter(Boolean).map(url => ({
        id: this.uid(),
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
    const fallidos = this.slots().filter(s => s.error);
    fallidos.forEach(s => this.removeSlot(s.id));
    const ficheros = fallidos.map(s => this.pendientes.get(s.id)).filter((f): f is File => !!f);
    fallidos.forEach(s => this.pendientes.delete(s.id));
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
    void this.processFiles(files);
    input.value = '';
  }

  removeSlot(id: string): void {
    const slot = this.slots().find(s => s.id === id);
    if (slot) this.olvidarPreview(slot);
    this.slots.update(s => s.filter(sl => sl.id !== id));
    if (!this.slots().some(sl => sl.error)) this.mensajeError.set('');
    this.emitValue();
    this.onTouched();
  }

  private async processFiles(files: File[]): Promise<void> {
    const imagenes = files.filter(f => pareceImagen(f));

    // Callar un descarte deja al usuario mirando una pantalla que no reacciona.
    if (files.length && !imagenes.length) {
      this.mensajeError.set('Ese archivo no es una imagen. Usa JPEG, PNG, WebP o GIF.');
      return;
    }

    const restantes = this.multiple ? this.maxFiles - this.slots().length : 1;
    const aSubir = imagenes.slice(0, Math.max(0, restantes));

    const enVuelo: Promise<void>[] = [];
    for (const original of aSubir) {
      /*
       * La preparación va de una en una. Decodificar varias fotos de 12 MP a la
       * vez agota la memoria de un iPhone y Safari recarga la pestaña sin más;
       * el envío, que no consume memoria, sí se solapa.
       */
      const listo = await this.prepararSlot(original);
      if (listo) enVuelo.push(this.enviar(listo.id, listo.file));
    }

    await Promise.all(enVuelo);
  }

  /**
   * Crea la casilla, prepara la imagen y comprueba que se puede subir.
   *
   * La casilla se crea **antes** de preparar: convertir una foto de 48 MP en un
   * iPhone tarda varios segundos y hasta ahora no se veía nada durante ese rato,
   * así que parecía que elegir la foto no hacía nada.
   */
  private async prepararSlot(original: File): Promise<{ id: string; file: File } | null> {
    if (!original) return null;

    const id = this.uid();
    const slot: ImageSlot = {
      id,
      previewUrl: this.registrarPreview(original),
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

    /*
     * Conversión y reescalado (ver `shared/media/preparar-imagen.ts`): un HEIC
     * en crudo sólo lo pinta Safari, y una foto de móvil sin reducir se pasa del
     * límite del endpoint. Un JPEG que ya cabe no se toca.
     */
    let file = original;
    try {
      file = await prepararImagen(original, MAX_SUBIDA_BYTES);
    } catch {
      file = original;
    }

    const problema = problemaDeSubida(file, MAX_SUBIDA_BYTES);
    if (problema) {
      this.marcarFallo(id, original, this.textoDelProblema(problema));
      return null;
    }

    // La vista previa del original no se pinta fuera de Safari si era un HEIC:
    // se cambia por la de la imagen ya convertida.
    if (file !== original) {
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
        this.http.post<{ url: string }>(`${environment.apiUrl}/upload/image`, formData),
      );
      this.slots.update(s =>
        s.map(sl => sl.id === id ? { ...sl, uploadedUrl: res.url, uploading: false } : sl),
      );
      this.mensajeError.set('');
      this.emitValue();
      this.onTouched();
    } catch (error) {
      this.marcarFallo(id, file, this.textoDelError(error));
    }
  }

  /** Deja la casilla en error y guarda el fichero por si se reintenta. */
  private marcarFallo(id: string, fichero: File, mensaje: string): void {
    this.pendientes.set(id, fichero);
    this.slots.update(s =>
      s.map(sl => sl.id === id ? { ...sl, uploading: false, error: 'Error al subir' } : sl),
    );
    this.mensajeError.set(mensaje);
    this.emitValue();
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
    if (!(error instanceof HttpErrorResponse)) {
      return 'No se pudo subir la imagen. Vuelve a intentarlo.';
    }
    if (error.status === 0) {
      return 'No se pudo subir la imagen: sin conexión con el servidor.';
    }
    if (error.status === 413 || error.status === 422) {
      return 'La imagen no es válida: usa JPEG, PNG, WebP, GIF o HEIC de menos de 5 MB.';
    }
    const detalle = (error.error as { message?: string } | null)?.message;
    return detalle ?? 'No se pudo subir la imagen. Vuelve a intentarlo.';
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
