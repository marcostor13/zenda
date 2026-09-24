import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { firstValueFrom } from 'rxjs';
import { EstadoRespuestaPresupuesto, SolicitudPresupuestoComercioVista, VALIDEZ_PRESUPUESTO_DIAS } from 'shared';
import { RsIconComponent } from '../../shared/components/icon/rs-icon.component';
import { EurosPipe } from '../../shared/pipes/euros.pipe';
import { FechaPipe } from '../../shared/pipes/fecha.pipe';
import { TraducirPipe } from '../../core/i18n/traducir.pipe';
import { mensajeDeError } from '../../shared/mensaje-error';
import { ComercioApiService } from './comercio-api.service';

type Pestana = 'pendientes' | 'respondidas' | 'cerradas';

const ETIQUETA_RESPUESTA: Record<EstadoRespuestaPresupuesto, string> = {
  [EstadoRespuestaPresupuesto.PENDIENTE]: 'Sin responder',
  [EstadoRespuestaPresupuesto.RESPONDIDA]: 'Enviado al cliente',
  [EstadoRespuestaPresupuesto.RECHAZADA_POR_COMERCIO]: 'Rechazada',
  [EstadoRespuestaPresupuesto.ACEPTADA]: 'Aceptada por el cliente',
  [EstadoRespuestaPresupuesto.DESCARTADA]: 'El cliente eligió otra opción',
};

/**
 * Bandeja de presupuestos del comercio (diapositiva 11): viajes que no tienen
 * precio automático —internacionales, muchas mascotas, necesidades especiales—
 * y que el cliente ha pedido a medida. El comercio ve lo que describió el
 * cliente y responde con un precio final y sus condiciones; si el cliente lo
 * acepta y paga, aparece como una reserva más.
 */
@Component({
  selector: 'app-comercio-presupuestos',
  standalone: true,
  imports: [ReactiveFormsModule, RsIconComponent, EurosPipe, FechaPipe, TraducirPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
<div class="page-header">
  <div>
    <h1 class="page-title">{{ 'Presupuestos' | t }}</h1>
    <p class="page-sub">{{ 'Viajes que los clientes te piden a medida. Responde con un precio final: si lo aceptan, se convierte en reserva.' | t }}</p>
  </div>
</div>

<div class="cp__pestanas" role="tablist">
  @for (p of pestanas; track p.valor) {
    <button type="button" role="tab" class="cp__pestana" [class.is-activa]="pestana() === p.valor"
            [attr.aria-selected]="pestana() === p.valor" (click)="pestana.set(p.valor)">
      {{ p.etiqueta | t }} <span>{{ contar(p.valor) }}</span>
    </button>
  }
</div>

@if (error()) { <div class="rs-alert rs-alert--error">{{ error() }}</div> }

@if (cargando()) {
  <div class="rs-skeleton cp__cargando"></div>
} @else if (!visibles().length) {
  <div class="cp__vacio">
    <rs-icon name="file-text" [size]="32" [stroke]="1.6"></rs-icon>
    <p>{{ 'No hay solicitudes aquí.' | t }}</p>
  </div>
} @else {
  <div class="cp__lista">
    @for (s of visibles(); track s.id + s.servicioId) {
      <article class="cp__solicitud">
        <header class="cp__cabecera">
          <div>
            <p class="cp__meta">{{ s.codigo }} · {{ s.createdAt | date: 'd MMM, HH:mm' }} · {{ s.tituloServicio }}</p>
            <h2>{{ s.clienteNombre }} · {{ s.fechaServicio | date: 'EEEE d MMMM' }}</h2>
          </div>
          <span class="rs-badge" [class.rs-badge--warning]="s.respuesta.estado === 'pendiente'"
                [class.rs-badge--success]="s.respuesta.estado === 'aceptada'">{{ etiquetaRespuesta(s) | t }}</span>
        </header>

        <dl class="cp__resumen">
          @for (fila of resumen(s); track fila[0]) { <div><dt>{{ fila[0] | t }}</dt><dd>{{ fila[1] }}</dd></div> }
        </dl>
        @if (s.comentario) { <p class="cp__comentario">“{{ s.comentario }}”</p> }

        @if (s.respuesta.importe) {
          <p class="cp__enviado">
            {{ 'Tu precio: {importe}' | t: { importe: (s.respuesta.importe | euros) } }}
            @if (s.respuesta.validoHasta) { · {{ 'válido hasta el {fecha}' | t: { fecha: (s.respuesta.validoHasta | date: 'd MMM') ?? '' } }} }
          </p>
        }

        @if (puedeResponder(s)) {
          @if (abierta() === clave(s)) {
            <form class="cp__form" [formGroup]="form" (ngSubmit)="responder(s)">
              <div class="cp__fila">
                <label class="rs-field">
                  <span class="rs-lbl">{{ 'Precio final (IVA incluido)' | t }}</span>
                  <input class="rs-inp" type="number" min="1" step="0.01" formControlName="importe" />
                </label>
                <label class="rs-field">
                  <span class="rs-lbl">{{ 'Válido durante (días)' | t }}</span>
                  <input class="rs-inp" type="number" min="1" max="30" formControlName="validezDias" />
                </label>
              </div>
              <label class="rs-field">
                <span class="rs-lbl">{{ 'Condiciones (opcional)' | t }}</span>
                <textarea class="rs-inp" rows="3" maxlength="2000" formControlName="condiciones"
                          [placeholder]="'Qué incluye, paradas, documentación necesaria…' | t"></textarea>
              </label>
              <div class="cp__acciones">
                <button type="button" class="rs-btn rs-btn--ghost rs-btn--sm" (click)="abierta.set(null)">{{ 'Cancelar' | t }}</button>
                <button type="button" class="rs-btn rs-btn--danger rs-btn--sm" [disabled]="enviando()" (click)="rechazar(s)">{{ 'No puedo hacerlo' | t }}</button>
                <button type="submit" class="rs-btn rs-btn--primary rs-btn--sm" [disabled]="form.invalid || enviando()">
                  {{ (enviando() ? 'Enviando…' : 'Enviar presupuesto') | t }}
                </button>
              </div>
            </form>
          } @else {
            <button type="button" class="rs-btn rs-btn--gold rs-btn--sm cp__responder" (click)="abrir(s)">
              {{ (s.respuesta.importe ? 'Cambiar precio' : 'Responder con precio') | t }}
            </button>
          }
        }
      </article>
    }
  </div>
}
  `,
  styles: [`
    :host { display: block; }
    .page-header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: var(--sp-5); }
    .page-title { font-size: var(--f-2xl); font-weight: var(--w-8); color: var(--t-100); margin-bottom: var(--sp-1); }
    .page-sub { color: var(--t-400); font-size: var(--f-sm); }
    .cp__pestanas { display: flex; gap: var(--sp-2); margin-bottom: var(--sp-4); flex-wrap: wrap; }
    .cp__pestana { padding: var(--sp-2) var(--sp-4); border-radius: var(--r-full); border: 1px solid var(--b-2);
      background: var(--c-card); font-size: var(--f-sm); font-weight: var(--w-6); color: var(--t-300);
      span { margin-left: var(--sp-1); color: var(--t-400); }
      &.is-activa { background: var(--dk-blue); border-color: var(--dk-blue); color: var(--c-card); span { color: var(--dk-gold); } }
    }
    .cp__cargando { height: 240px; border-radius: var(--r-xl); }
    .cp__vacio { display: flex; flex-direction: column; align-items: center; gap: var(--sp-2); padding: var(--sp-10);
      color: var(--t-400); background: var(--c-card); border: 1px dashed var(--b-a); border-radius: var(--r-xl); }
    .cp__lista { display: flex; flex-direction: column; gap: var(--sp-4); }
    .cp__solicitud { display: flex; flex-direction: column; gap: var(--sp-3); padding: var(--sp-5);
      background: var(--c-card); border: 1px solid var(--b-2); border-radius: var(--r-xl); box-shadow: var(--sh-sm); }
    .cp__cabecera { display: flex; justify-content: space-between; gap: var(--sp-3); align-items: flex-start;
      h2 { margin: 0; font-size: var(--f-md); font-weight: var(--w-7); color: var(--t-100); }
    }
    .cp__meta { margin: 0; font-size: var(--f-xs); color: var(--t-400); }
    .cp__resumen { display: flex; flex-direction: column; gap: var(--sp-1); margin: 0; font-size: var(--f-sm);
      div { display: grid; grid-template-columns: minmax(110px, 28%) 1fr; gap: var(--sp-2); }
      dt { color: var(--t-400); } dd { margin: 0; color: var(--t-200); overflow-wrap: anywhere; }
    }
    .cp__comentario { margin: 0; font-style: italic; color: var(--t-300); font-size: var(--f-sm); }
    .cp__enviado { margin: 0; font-weight: var(--w-6); color: var(--dk-blue-text); }
    .cp__form { display: flex; flex-direction: column; gap: var(--sp-3); padding: var(--sp-4); border-radius: var(--r-lg); background: var(--c-surface); }
    .cp__fila { display: grid; grid-template-columns: 1fr 1fr; gap: var(--sp-3); }
    .cp__acciones { display: flex; justify-content: flex-end; gap: var(--sp-2); flex-wrap: wrap; }
    .cp__responder { align-self: flex-start; }
    @media (max-width: 480px) { .cp__fila { grid-template-columns: 1fr; } }
  `],
})
export class ComercioPresupuestosComponent implements OnInit {
  private readonly api = inject(ComercioApiService);

  readonly pestanas: ReadonlyArray<{ valor: Pestana; etiqueta: string }> = [
    { valor: 'pendientes', etiqueta: 'Por responder' },
    { valor: 'respondidas', etiqueta: 'Respondidas' },
    { valor: 'cerradas', etiqueta: 'Cerradas' },
  ];

  readonly solicitudes = signal<SolicitudPresupuestoComercioVista[]>([]);
  readonly cargando = signal(true);
  readonly enviando = signal(false);
  readonly error = signal<string | null>(null);
  readonly pestana = signal<Pestana>('pendientes');
  readonly abierta = signal<string | null>(null);

  readonly form = new FormGroup({
    importe: new FormControl<number | null>(null, { validators: [Validators.required, Validators.min(1)] }),
    validezDias: new FormControl<number>(VALIDEZ_PRESUPUESTO_DIAS, { nonNullable: true, validators: [Validators.min(1), Validators.max(30)] }),
    condiciones: new FormControl<string>('', { nonNullable: true }),
  });

  readonly visibles = computed(() => this.solicitudes().filter((s) => this.pestanaDe(s) === this.pestana()));

  async ngOnInit(): Promise<void> {
    try {
      this.solicitudes.set(await firstValueFrom(this.api.misPresupuestos()));
    } catch (error) {
      this.error.set(mensajeDeError(error, 'No se pudieron cargar las solicitudes de presupuesto.'));
    } finally {
      this.cargando.set(false);
    }
  }

  contar(pestana: Pestana): number {
    return this.solicitudes().filter((s) => this.pestanaDe(s) === pestana).length;
  }

  clave(s: SolicitudPresupuestoComercioVista): string {
    return `${s.id}:${s.servicioId}`;
  }

  resumen(s: SolicitudPresupuestoComercioVista): Array<[string, string]> {
    const filas = s.detalle['resumen'];
    return Array.isArray(filas) ? (filas as Array<[string, string]>) : [];
  }

  etiquetaRespuesta(s: SolicitudPresupuestoComercioVista): string {
    return ETIQUETA_RESPUESTA[s.respuesta.estado] ?? s.respuesta.estado;
  }

  puedeResponder(s: SolicitudPresupuestoComercioVista): boolean {
    return s.estadoSolicitud === 'abierta'
      && [EstadoRespuestaPresupuesto.PENDIENTE, EstadoRespuestaPresupuesto.RESPONDIDA].includes(s.respuesta.estado);
  }

  abrir(s: SolicitudPresupuestoComercioVista): void {
    this.form.reset({ importe: s.respuesta.importe ?? null, validezDias: VALIDEZ_PRESUPUESTO_DIAS, condiciones: s.respuesta.condiciones ?? '' });
    this.abierta.set(this.clave(s));
  }

  async responder(s: SolicitudPresupuestoComercioVista): Promise<void> {
    const { importe, validezDias, condiciones } = this.form.getRawValue();
    if (!importe) return;
    await this.enviar(() => firstValueFrom(this.api.responderPresupuesto(s.id, s.servicioId, {
      importe, validezDias, condiciones: condiciones || undefined,
    })));
  }

  async rechazar(s: SolicitudPresupuestoComercioVista): Promise<void> {
    await this.enviar(() => firstValueFrom(this.api.rechazarPresupuesto(s.id, s.servicioId)));
  }

  private pestanaDe(s: SolicitudPresupuestoComercioVista): Pestana {
    if (s.estadoSolicitud !== 'abierta') return 'cerradas';
    if (s.respuesta.estado === EstadoRespuestaPresupuesto.PENDIENTE) return 'pendientes';
    if (s.respuesta.estado === EstadoRespuestaPresupuesto.RESPONDIDA) return 'respondidas';
    return 'cerradas';
  }

  private async enviar(accion: () => Promise<SolicitudPresupuestoComercioVista[]>): Promise<void> {
    this.enviando.set(true);
    this.error.set(null);
    try {
      this.solicitudes.set(await accion());
      this.abierta.set(null);
    } catch (error) {
      this.error.set(mensajeDeError(error, 'No se pudo enviar la respuesta.'));
    } finally {
      this.enviando.set(false);
    }
  }
}
