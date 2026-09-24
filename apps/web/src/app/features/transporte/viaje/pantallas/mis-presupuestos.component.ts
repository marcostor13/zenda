import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import {
  EstadoRespuestaPresupuesto, EstadoSolicitudPresupuesto, RespuestaPresupuestoVista, SolicitudPresupuestoVista,
} from 'shared';
import { MarcoViajeComponent } from '../componentes/marco-viaje.component';
import { RsIconComponent } from '../../../../shared/components/icon/rs-icon.component';
import { RsStarsComponent } from '../../../../shared/components/stars/rs-stars.component';
import { EurosPipe } from '../../../../shared/pipes/euros.pipe';
import { FechaPipe } from '../../../../shared/pipes/fecha.pipe';
import { TraducirPipe } from '../../../../core/i18n/traducir.pipe';
import { mensajeDeError } from '../../../../shared/mensaje-error';
import { TransporteViajeApi } from '../transporte-viaje.api';

const ESTADO_SOLICITUD: Record<EstadoSolicitudPresupuesto, string> = {
  [EstadoSolicitudPresupuesto.ABIERTA]: 'Esperando respuestas',
  [EstadoSolicitudPresupuesto.ACEPTADA]: 'Pendiente de pago',
  [EstadoSolicitudPresupuesto.CONVERTIDA]: 'Reservado',
  [EstadoSolicitudPresupuesto.CANCELADA]: 'Cancelada',
  [EstadoSolicitudPresupuesto.CADUCADA]: 'Caducada',
};

/**
 * «Mis presupuestos» (diapositiva 11): las solicitudes a medida del cliente y
 * lo que ha respondido cada empresa. «Aceptar y pagar» lleva al pago con el
 * viaje ya descrito y el importe del presupuesto; al cobrarse, la solicitud se
 * convierte en reserva sola.
 */
@Component({
  selector: 'app-mis-presupuestos',
  standalone: true,
  imports: [RouterLink, MarcoViajeComponent, RsIconComponent, RsStarsComponent, EurosPipe, FechaPipe, TraducirPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
<app-marco-viaje titulo="Mis presupuestos" subtitulo="Precios a medida que te han preparado los transportistas." [ancho]="true">
  @if (cargando()) {
    <div class="rs-skeleton mp__cargando"></div>
  } @else if (error()) {
    <div class="rs-alert rs-alert--error">{{ error() }}</div>
  } @else if (!solicitudes().length) {
    <div class="mp__vacio">
      <rs-icon name="file-text" [size]="36" [stroke]="1.6"></rs-icon>
      <p>{{ 'Todavía no has pedido ningún presupuesto.' | t }}</p>
      <a class="rs-btn rs-btn--gold" routerLink="/transporte">{{ 'Buscar transporte' | t }}</a>
    </div>
  } @else {
    <div class="mp">
      @for (s of solicitudes(); track s.id) {
        <article class="mp__solicitud">
          <header class="mp__cabecera">
            <div>
              <p class="mp__codigo">{{ s.codigo }} · {{ s.createdAt | date: 'd MMM' }}</p>
              <h2>{{ ruta(s) }}</h2>
              <p class="mp__fecha">{{ s.fechaServicio | date: 'EEEE d MMMM' }}</p>
            </div>
            <span class="mp__estado" [attr.data-estado]="s.estado">{{ etiquetaEstado(s) | t }}</span>
          </header>

          <details class="mp__detalle">
            <summary>{{ 'Lo que pediste' | t }}</summary>
            <dl>
              @for (fila of resumen(s); track fila[0]) { <div><dt>{{ fila[0] | t }}</dt><dd>{{ fila[1] }}</dd></div> }
            </dl>
          </details>

          <ul class="mp__respuestas">
            @for (r of s.respuestas; track r.servicioId) {
              <li class="mp__respuesta" [attr.data-estado]="r.estado">
                <div class="mp__empresa">
                  @if (r.imagen) { <img [src]="r.imagen" [alt]="r.titulo" loading="lazy" /> }
                  <div>
                    <strong>{{ r.titulo }}</strong>
                    @if (r.rating) { <span><rs-stars [score]="r.rating" [size]="12" /> {{ r.rating.toFixed(1) }}</span> }
                  </div>
                </div>
                @switch (r.estado) {
                  @case ('pendiente') { <p class="mp__espera">{{ 'Preparando presupuesto…' | t }}</p> }
                  @case ('rechazada_por_comercio') {
                    <p class="mp__espera">{{ 'No puede hacer este viaje.' | t }} {{ r.motivoRechazo }}</p>
                  }
                  @case ('descartada') { <p class="mp__espera">{{ 'Descartado' | t }}</p> }
                  @default {
                    <div class="mp__oferta">
                      <div>
                        <strong class="mp__importe">{{ r.importe | euros }}</strong>
                        <span>{{ 'IVA incluido' | t }}@if (r.validoHasta) { · {{ 'válido hasta el {fecha}' | t: { fecha: (r.validoHasta | date: 'd MMM') ?? '' } }} }</span>
                        @if (r.condiciones) { <p class="mp__condiciones">{{ r.condiciones }}</p> }
                      </div>
                      @if (puedeAceptar(s, r)) {
                        <button type="button" class="rs-btn rs-btn--gold" (click)="aceptar(s, r)">{{ 'Aceptar y pagar' | t }}</button>
                      }
                    </div>
                  }
                }
              </li>
            }
          </ul>

          @if (s.reservaId) {
            <a class="rs-btn rs-btn--outline rs-btn--sm" routerLink="/reservas/mis-reservas">{{ 'Ver la reserva' | t }}</a>
          } @else if (s.estado === 'abierta') {
            <button type="button" class="rs-btn rs-btn--ghost rs-btn--sm mp__retirar" (click)="retirar(s)">{{ 'Retirar solicitud' | t }}</button>
          }
        </article>
      }
    </div>
  }
</app-marco-viaje>
  `,
  styles: [`
    :host { display: block; }
    .mp { display: flex; flex-direction: column; gap: var(--sp-5); }
    .mp__cargando { height: 320px; border-radius: var(--r-2xl); }
    .mp__vacio { display: flex; flex-direction: column; align-items: center; gap: var(--sp-3); padding: var(--sp-10);
      text-align: center; color: var(--t-300); background: var(--c-card); border: 1px dashed var(--b-a); border-radius: var(--r-2xl); }
    .mp__solicitud { display: flex; flex-direction: column; gap: var(--sp-4); padding: var(--sp-5);
      background: var(--c-card); border: 1px solid var(--b-2); border-radius: var(--r-2xl); box-shadow: var(--sh-sm); }
    .mp__cabecera { display: flex; justify-content: space-between; gap: var(--sp-3); align-items: flex-start;
      h2 { margin: 0; font-family: var(--font-display); font-size: var(--f-lg); font-weight: var(--w-8); color: var(--dk-blue-text); }
    }
    .mp__codigo, .mp__fecha { margin: 0; font-size: var(--f-xs); color: var(--t-400); }
    .mp__estado { padding: 2px var(--sp-3); border-radius: var(--r-full); font-size: var(--f-xs); font-weight: var(--w-7);
      background: var(--c-accent-lo); color: var(--dk-blue); white-space: nowrap;
      &[data-estado='convertida'] { background: var(--c-success-lo); color: var(--c-success); }
      &[data-estado='cancelada'], &[data-estado='caducada'] { background: var(--c-surface); color: var(--t-400); }
    }
    .mp__detalle { font-size: var(--f-sm); color: var(--t-300);
      summary { cursor: pointer; font-weight: var(--w-6); color: var(--c-accent); }
      dl { display: flex; flex-direction: column; gap: var(--sp-1); margin: var(--sp-2) 0 0; }
      div { display: grid; grid-template-columns: minmax(100px, 35%) 1fr; gap: var(--sp-2); }
      dt { color: var(--t-400); } dd { margin: 0; color: var(--t-200); }
    }
    .mp__respuestas { display: flex; flex-direction: column; gap: var(--sp-3); margin: 0; padding: 0; list-style: none; }
    .mp__respuesta { display: flex; flex-direction: column; gap: var(--sp-2); padding: var(--sp-3) var(--sp-4);
      border: 1px solid var(--b-2); border-radius: var(--r-xl);
      &[data-estado='respondida'], &[data-estado='aceptada'] { border-color: var(--dk-gold); background: linear-gradient(0deg, var(--c-card), var(--c-card)), var(--dk-gold-lo); }
    }
    .mp__empresa { display: flex; align-items: center; gap: var(--sp-3);
      img { width: 48px; height: 36px; object-fit: cover; border-radius: var(--r-md); }
      div { display: flex; flex-direction: column; }
      span { display: flex; align-items: center; gap: var(--sp-1); font-size: var(--f-xs); color: var(--t-400); }
    }
    .mp__espera { margin: 0; font-size: var(--f-sm); color: var(--t-400); }
    .mp__oferta { display: flex; justify-content: space-between; align-items: flex-end; gap: var(--sp-3); flex-wrap: wrap;
      span { display: block; font-size: var(--f-xs); color: var(--t-400); }
    }
    .mp__importe { font-family: var(--font-display); font-size: var(--f-2xl); font-weight: var(--w-8); color: var(--dk-blue-text); }
    .mp__condiciones { margin: var(--sp-1) 0 0; font-size: var(--f-sm); color: var(--t-300); white-space: pre-line; }
    .mp__retirar { align-self: flex-start; }
  `],
})
export class MisPresupuestosComponent implements OnInit {
  private readonly api = inject(TransporteViajeApi);
  private readonly router = inject(Router);

  readonly solicitudes = signal<SolicitudPresupuestoVista[]>([]);
  readonly cargando = signal(true);
  readonly error = signal<string | null>(null);

  async ngOnInit(): Promise<void> {
    await this.cargar();
  }

  etiquetaEstado(s: SolicitudPresupuestoVista): string {
    return ESTADO_SOLICITUD[s.estado] ?? s.estado;
  }

  ruta(s: SolicitudPresupuestoVista): string {
    const filas = this.resumen(s);
    const origen = filas.find(([e]) => e === 'Recogida')?.[1]?.split(',')[0] ?? '';
    const destino = filas.find(([e]) => e === 'Entrega')?.[1]?.split(',')[0] ?? '';
    return origen && destino ? `${origen} → ${destino}` : s.codigo;
  }

  resumen(s: SolicitudPresupuestoVista): Array<[string, string]> {
    const filas = s.detalle['resumen'];
    return Array.isArray(filas) ? (filas as Array<[string, string]>) : [];
  }

  puedeAceptar(s: SolicitudPresupuestoVista, r: RespuestaPresupuestoVista): boolean {
    const vigente = !r.validoHasta || new Date(r.validoHasta).getTime() > Date.now();
    return !s.reservaId
      && [EstadoSolicitudPresupuesto.ABIERTA, EstadoSolicitudPresupuesto.ACEPTADA].includes(s.estado)
      && [EstadoRespuestaPresupuesto.RESPONDIDA, EstadoRespuestaPresupuesto.ACEPTADA].includes(r.estado)
      && vigente;
  }

  aceptar(s: SolicitudPresupuestoVista, r: RespuestaPresupuestoVista): void {
    void this.router.navigate(['/transporte/viaje/reserva'], { queryParams: { presupuesto: s.id, servicio: r.servicioId } });
  }

  async retirar(s: SolicitudPresupuestoVista): Promise<void> {
    try {
      const actualizada = await this.api.cancelarPresupuesto(s.id);
      this.solicitudes.update((lista) => lista.map((x) => (x.id === s.id ? actualizada : x)));
    } catch (error) {
      this.error.set(mensajeDeError(error, 'No se pudo retirar la solicitud.'));
    }
  }

  private async cargar(): Promise<void> {
    try {
      this.solicitudes.set(await this.api.misPresupuestos());
    } catch (error) {
      this.error.set(mensajeDeError(error, 'No hemos podido cargar tus presupuestos.'));
    } finally {
      this.cargando.set(false);
    }
  }
}
