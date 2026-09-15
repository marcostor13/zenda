import { HttpClient } from '@angular/common/http';
import {
  ChangeDetectionStrategy, Component, OnInit, computed, inject, input, output, signal,
} from '@angular/core';
import { FormControl, FormRecord, NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { firstValueFrom } from 'rxjs';
import { CampoRegistro, MAX_ADJUNTOS_REGISTRO, VERTICAL_LABELS, VerticalKey, camposDeRegistro } from 'shared';
import { environment } from '../../../../environments/environment';
import { RsIconComponent } from '../../../shared/components/icon/rs-icon.component';
import { TraducirPipe } from '../../../core/i18n/traducir.pipe';
import {
  AdjuntoRegistroApi, RegistroServicioApi, RegistroServicioPayload, ServicioExpedienteApi,
} from '../expediente.service';
import { FechaPipe } from '../../../shared/pipes/fecha.pipe';
import { AdjuntosRegistroComponent } from './adjuntos-registro.component';

/**
 * Lo que ofrece el selector de ficheros. Es una ayuda para el diálogo del
 * sistema, no una validación: quien decide si el fichero vale es el API, que lo
 * comprueba por su contenido.
 */
const ACEPTADOS = '.pdf,.doc,.docx,image/*,application/pdf,'
  + 'application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document';

/** Títulos habituales por categoría: un toque en vez de escribirlo cada vez. */
const TITULOS_SUGERIDOS: Record<string, readonly string[]> = {
  veterinaria: ['Consulta general', 'Vacunación', 'Revisión', 'Urgencia', 'Cirugía', 'Desparasitación'],
  peluqueria: ['Baño', 'Baño y corte', 'Deslanado', 'Corte de uñas', 'Tratamiento spa'],
  adiestramiento: ['Evaluación inicial', 'Sesión de obediencia', 'Modificación de conducta', 'Sesión de cachorros'],
};

/**
 * Formulario del registro de servicio: campos comunes (título, fecha,
 * profesional, observaciones, próxima cita) más los propios de la categoría,
 * que salen de la definición compartida con el API y el PDF.
 */
@Component({
  selector: 'app-registro-servicio-form',
  standalone: true,
  imports: [ReactiveFormsModule, FechaPipe, RsIconComponent, TraducirPipe, AdjuntosRegistroComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
<form class="rform" [formGroup]="form" (ngSubmit)="enviar()" novalidate>
  <div class="rform__cabecera">
    <h3>{{ (registro() ? 'Editar registro' : 'Nuevo registro de servicio') | t }}</h3>
    <button type="button" class="rs-btn rs-btn--ghost rs-btn--sm" (click)="cancelar.emit()" [attr.aria-label]="'Cerrar' | t">
      <rs-icon name="x" [size]="16" [stroke]="2"></rs-icon>
    </button>
  </div>

  @if (verticales().length > 1 && !registro()) {
    <div class="rform__categorias" role="radiogroup" [attr.aria-label]="'Categoría' | t">
      @for (v of verticales(); track v) {
        <button type="button" class="rform__chip" role="radio"
                [class.activa]="vertical() === v" [attr.aria-checked]="vertical() === v"
                (click)="elegirVertical(v)">
          {{ etiquetaVertical(v) | t }}
        </button>
      }
    </div>
  }

  <div class="rform__grid">
    <div class="rs-form-group rform__ancho">
      <label class="rs-label" for="rf-titulo">{{ 'Título' | t }} *</label>
      <input id="rf-titulo" class="rs-input" formControlName="titulo" maxlength="140"
             [class.rs-input--error]="form.controls.titulo.touched && form.controls.titulo.invalid"
             [placeholder]="'Ej. Revisión anual' | t" />
      @if (form.controls.titulo.touched && form.controls.titulo.invalid) {
        <span class="rs-field-error">{{ 'Indica qué servicio se realizó' | t }}</span>
      }
      <div class="rform__sugerencias">
        @for (s of sugerencias(); track s) {
          <button type="button" class="rform__sugerencia" (click)="usarTitulo(s)">{{ s | t }}</button>
        }
      </div>
    </div>

    <div class="rs-form-group">
      <label class="rs-label" for="rf-fecha">{{ 'Fecha del servicio' | t }}</label>
      <input id="rf-fecha" type="date" class="rs-input" formControlName="fechaServicio" />
    </div>
    <div class="rs-form-group">
      <label class="rs-label" for="rf-profesional">{{ 'Profesional' | t }}</label>
      <input id="rf-profesional" class="rs-input" formControlName="profesional" maxlength="120"
             [placeholder]="'Quién atendió' | t" />
    </div>

    @if (reservasDeCategoria().length && !registro()) {
      <div class="rs-form-group rform__ancho">
        <label class="rs-label" for="rf-reserva">{{ 'Reserva relacionada' | t }}</label>
        <select id="rf-reserva" class="rs-input" formControlName="reservaId">
          <option value="">{{ 'Sin vincular' | t }}</option>
          @for (s of reservasDeCategoria(); track s.reservaId) {
            <option [value]="s.reservaId">{{ s.fechaInicio | date:'d MMM yyyy' }} · {{ s.servicioTitulo || s.codigo }}</option>
          }
        </select>
      </div>
    }

    @for (campo of campos(); track campo.clave) {
      <div class="rs-form-group" [class.rform__ancho]="campo.tipo === 'textoLargo'" [formGroup]="datos">
        <label class="rs-label" [for]="'rf-' + campo.clave">
          {{ campo.etiqueta | t }} @if (campo.unidad) { ({{ campo.unidad }}) }
        </label>
        @if (campo.tipo === 'textoLargo') {
          <textarea [id]="'rf-' + campo.clave" class="rs-input" rows="2" [formControlName]="campo.clave"
                    [placeholder]="(campo.placeholder || '') | t"></textarea>
        } @else {
          <input [id]="'rf-' + campo.clave" class="rs-input" [formControlName]="campo.clave"
                 [attr.inputmode]="campo.tipo === 'numero' ? 'decimal' : null"
                 [placeholder]="(campo.placeholder || '') | t" />
        }
      </div>
    }

    <div class="rs-form-group rform__ancho">
      <label class="rs-label" for="rf-nota">{{ 'Observaciones' | t }}</label>
      <textarea id="rf-nota" class="rs-input" rows="3" formControlName="nota" maxlength="5000"
                [placeholder]="'Lo que el dueño y otros profesionales deberían saber' | t"></textarea>
    </div>
    <div class="rs-form-group">
      <label class="rs-label" for="rf-proxima">{{ 'Próxima cita recomendada' | t }}</label>
      <input id="rf-proxima" type="date" class="rs-input" formControlName="proximaCita" />
    </div>
  </div>

  <div class="rform__adjuntos">
    <span class="rs-label">{{ 'Documentos' | t }}</span>
    <p class="rform__ayuda">
      {{ 'Analíticas, informes o fotos. PDF, Word o imagen, hasta 10 MB cada uno.' | t }}
    </p>

    @if (adjuntos().length) {
      <app-adjuntos-registro [adjuntos]="adjuntos()" [quitable]="true" (quitar)="quitarAdjunto($event)" />
    }

    @if (adjuntos().length < maximoAdjuntos) {
      <label class="rform__soltar" [class.cargando]="subiendo()">
        <input type="file" [accept]="FORMATOS" multiple hidden
               [disabled]="subiendo()" (change)="adjuntar($event)"
               data-testid="adjuntar-registro" [attr.aria-label]="'Adjuntar documentos' | t" />
        <rs-icon [name]="subiendo() ? 'upload' : 'paperclip'" [size]="16" [stroke]="2"></rs-icon>
        {{ (subiendo() ? 'Subiendo…' : 'Adjuntar documento') | t }}
      </label>
    }

    @if (errorAdjunto()) {
      <span class="rs-field-error" role="alert">{{ errorAdjunto() | t }}</span>
    }
  </div>

  <p class="rform__aviso">
    <rs-icon name="eye" [size]="14" [stroke]="2"></rs-icon>
    {{ 'El propietario verá este registro y sus documentos en la ficha de su perro.' | t }}
  </p>

  <div class="rform__acciones">
    <button type="button" class="rs-btn rs-btn--ghost" (click)="cancelar.emit()">{{ 'Cancelar' | t }}</button>
    <button type="submit" class="rs-btn rs-btn--primary" [disabled]="guardando()">
      <rs-icon name="save" [size]="16" [stroke]="2"></rs-icon>
      {{ (guardando() ? 'Guardando…' : 'Guardar registro') | t }}
    </button>
  </div>
</form>
  `,
  styles: [`
    :host { display: block; }
    .rform { display: flex; flex-direction: column; gap: var(--sp-4); }
    .rform__cabecera { display: flex; justify-content: space-between; align-items: center; }
    .rform__cabecera h3 { font-family: var(--font-display); font-size: var(--f-lg); font-weight: var(--w-7); color: var(--t-100); margin: 0; }
    .rform__categorias { display: flex; flex-wrap: wrap; gap: var(--sp-2); }
    .rform__chip {
      padding: var(--sp-2) var(--sp-4); border-radius: var(--r-full); border: 1px solid var(--b-2);
      background: var(--c-card); color: var(--t-300); font: inherit; font-size: var(--f-sm); cursor: pointer;
      transition: all var(--d-2);
      &.activa { background: var(--c-accent); border-color: var(--c-accent); color: var(--c-card); }
    }
    .rform__grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: var(--sp-3) var(--sp-4); }
    .rform__grid .rs-form-group { margin: 0; }
    .rform__ancho { grid-column: 1 / -1; }
    .rform__sugerencias { display: flex; flex-wrap: wrap; gap: var(--sp-1); margin-top: var(--sp-2); }
    .rform__sugerencia {
      padding: 2px var(--sp-3); border-radius: var(--r-full); border: 1px dashed var(--b-2);
      background: transparent; color: var(--t-400); font: inherit; font-size: var(--f-xs); cursor: pointer;
      &:hover { color: var(--c-accent); border-color: var(--c-accent); }
    }
    .rform__adjuntos { display: grid; gap: var(--sp-2); }
    .rform__ayuda { margin: 0; font-size: var(--f-xs); color: var(--t-400); }
    .rform__soltar {
      display: inline-flex; align-items: center; gap: var(--sp-2); justify-self: start;
      padding: var(--sp-2) var(--sp-4); border-radius: var(--r-full);
      border: 1px dashed var(--b-2); background: var(--c-card); color: var(--c-accent);
      font-size: var(--f-sm); font-weight: var(--w-6); cursor: pointer;
      transition: border-color var(--d-2), background var(--d-2);
      &:hover { border-style: solid; border-color: var(--c-accent); background: var(--c-accent-lo); }
      &:focus-within { outline: 2px solid var(--dk-gold); outline-offset: 2px; }
      &.cargando { cursor: progress; color: var(--t-400); }
    }
    .rform__aviso { display: flex; align-items: center; gap: var(--sp-2); font-size: var(--f-xs); color: var(--t-400); margin: 0; }
    .rform__acciones { display: flex; justify-content: flex-end; gap: var(--sp-3); flex-wrap: wrap; }
    @media (max-width: 640px) { .rform__grid { grid-template-columns: 1fr; } }
  `],
})
export class RegistroServicioFormComponent implements OnInit {
  private readonly fb = inject(NonNullableFormBuilder);
  private readonly http = inject(HttpClient);

  protected readonly maximoAdjuntos = MAX_ADJUNTOS_REGISTRO;
  protected readonly FORMATOS = ACEPTADOS;

  protected readonly adjuntos = signal<readonly AdjuntoRegistroApi[]>([]);
  protected readonly subiendo = signal(false);
  protected readonly errorAdjunto = signal('');

  readonly verticales = input.required<readonly string[]>();
  readonly servicios = input<readonly ServicioExpedienteApi[]>([]);
  readonly registro = input<RegistroServicioApi | null>(null);
  readonly guardando = input(false);
  /** Vertical con el que abrir el formulario (p. ej. el de la reserva de la que se viene). */
  readonly verticalInicial = input<string | null>(null);
  readonly reservaInicial = input<string | null>(null);
  /** Quien tiene la sesión abierta suele ser quien atendió: se propone su nombre. */
  readonly profesionalInicial = input('');

  readonly guardar = output<RegistroServicioPayload>();
  readonly cancelar = output<void>();

  readonly vertical = signal<string>('');

  readonly form = this.fb.group({
    titulo: ['', [Validators.required, Validators.maxLength(140)]],
    fechaServicio: [hoy()],
    profesional: [''],
    reservaId: [''],
    nota: [''],
    proximaCita: [''],
  });
  datos = new FormRecord<FormControl<string>>({});

  readonly campos = computed<readonly CampoRegistro[]>(() => camposDeRegistro(this.vertical()));
  readonly sugerencias = computed(() => TITULOS_SUGERIDOS[this.vertical()] ?? []);
  readonly reservasDeCategoria = computed(() => this.servicios().filter((s) => s.vertical === this.vertical()));

  ngOnInit(): void {
    const registro = this.registro();
    const inicial = registro?.vertical ?? this.verticalInicial() ?? this.verticales()[0] ?? '';
    this.elegirVertical(inicial);
    if (registro) {
      this.cargar(registro);
      return;
    }
    this.form.controls.profesional.setValue(this.profesionalInicial());
    const reserva = this.reservaInicial();
    if (reserva && this.reservasDeCategoria().some((s) => s.reservaId === reserva)) {
      this.form.controls.reservaId.setValue(reserva);
    }
  }

  elegirVertical(vertical: string): void {
    const anteriores = this.datos.getRawValue();
    this.vertical.set(vertical);
    this.datos = new FormRecord<FormControl<string>>({});
    for (const campo of camposDeRegistro(vertical)) {
      this.datos.addControl(campo.clave, this.fb.control(anteriores[campo.clave] ?? ''));
    }
    this.form.controls.reservaId.setValue('');
  }

  etiquetaVertical(vertical: string): string {
    return VERTICAL_LABELS[vertical as VerticalKey] ?? vertical;
  }

  usarTitulo(titulo: string): void {
    this.form.controls.titulo.setValue(titulo);
  }

  /**
   * Sube los ficheros elegidos uno a uno y los añade a la lista. Se suben al
   * elegirlos, no al guardar: así el profesional ve si el fichero entró antes
   * de terminar de escribir, y no pierde la nota si el formato no valía.
   */
  async adjuntar(evento: Event): Promise<void> {
    const campo = evento.target as HTMLInputElement;
    const elegidos = Array.from(campo.files ?? []).slice(0, this.huecosLibres());
    campo.value = ''; // Sin esto, volver a elegir el mismo fichero no dispara el evento.
    if (!elegidos.length) return;

    this.errorAdjunto.set('');
    this.subiendo.set(true);
    try {
      for (const fichero of elegidos) await this.subir(fichero);
    } catch {
      this.errorAdjunto.set(
        'No pudimos subir el documento. Revisa el formato (PDF, Word o imagen) y que no pase de 10 MB.');
    } finally {
      this.subiendo.set(false);
    }
  }

  quitarAdjunto(adjunto: AdjuntoRegistroApi): void {
    this.adjuntos.update((lista) => lista.filter((a) => a.url !== adjunto.url));
  }

  private huecosLibres(): number {
    return MAX_ADJUNTOS_REGISTRO - this.adjuntos().length;
  }

  private async subir(fichero: File): Promise<void> {
    const cuerpo = new FormData();
    cuerpo.append('file', fichero);
    const { url } = await firstValueFrom(
      this.http.post<{ url: string }>(`${environment.apiUrl}/upload/documento`, cuerpo),
    );
    this.adjuntos.update((lista) => [
      ...lista,
      { nombre: fichero.name.slice(0, 200), url, tipo: fichero.type || undefined, tamano: fichero.size },
    ]);
  }

  enviar(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    this.guardar.emit(this.construirPayload());
  }

  private cargar(registro: RegistroServicioApi): void {
    this.form.patchValue({
      titulo: registro.titulo ?? registro.nota,
      fechaServicio: aFechaInput(registro.fechaServicio ?? registro.createdAt),
      profesional: registro.profesional ?? '',
      nota: registro.nota !== registro.titulo ? registro.nota : '',
      proximaCita: aFechaInput(registro.proximaCita),
    });
    this.adjuntos.set(registro.adjuntos ?? []);
    for (const [clave, valor] of Object.entries(registro.datosEstructurados ?? {})) {
      this.datos.get(clave)?.setValue(valor == null ? '' : String(valor));
    }
  }

  private construirPayload(): RegistroServicioPayload {
    const v = this.form.getRawValue();
    const datos = Object.fromEntries(
      Object.entries(this.datos.getRawValue()).filter(([, valor]) => valor.trim() !== ''),
    );
    return {
      ...(this.registro() ? {} : { vertical: this.vertical(), reservaId: v.reservaId || undefined }),
      titulo: v.titulo.trim(),
      nota: v.nota.trim(),
      profesional: v.profesional.trim(),
      fechaServicio: v.fechaServicio || undefined,
      proximaCita: v.proximaCita || undefined,
      datosEstructurados: datos,
      adjuntos: [...this.adjuntos()],
    };
  }
}

function hoy(): string {
  return aFechaInput(new Date().toISOString());
}

function aFechaInput(valor?: string): string {
  if (!valor) return '';
  const fecha = new Date(valor);
  if (Number.isNaN(fecha.getTime())) return '';
  const local = new Date(fecha.getTime() - fecha.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 10);
}
