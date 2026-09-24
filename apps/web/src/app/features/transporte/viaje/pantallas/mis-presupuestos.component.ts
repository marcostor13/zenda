import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { ESTADO_PRESUPUESTO_LABELS, EstadoPresupuesto, PresupuestoDto } from 'shared';
import { MarcoViajeComponent } from '../componentes/marco-viaje.component';
import { RsIconComponent } from '../../../../shared/components/icon/rs-icon.component';
import { EurosPipe } from '../../../../shared/pipes/euros.pipe';
import { FechaPipe } from '../../../../shared/pipes/fecha.pipe';
import { TraducirPipe } from '../../../../core/i18n/traducir.pipe';
import { mensajeDeError } from '../../../../shared/mensaje-error';
import { TransporteViajeApi } from '../transporte-viaje.api';

/**
 * «Mis presupuestos» (diapositiva 11): las peticiones a medida del cliente y lo
 * que ha respondido cada empresa. «Aceptar y pagar» lleva a completar los
 * datos de entrega y a pagar con el importe de la oferta; al aceptar, el API
 * convierte la petición en reserva sin volver a pedir el viaje.
 */
@Component({
  selector: 'app-mis-presupuestos',
  standalone: true,
  imports: [RouterLink, MarcoViajeComponent, RsIconComponent, EurosPipe, FechaPipe, TraducirPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
<app-marco-viaje titulo="Mis presupuestos" subtitulo="Precios a medida que te han preparado los transportistas." [ancho]="true">
  @if (error()) { <div class="rs-alert rs-alert--error">{{ error() }}</div> }

  @if (cargando()) {
    <div class="rs-skeleton mp__cargando"></div>
  } @else if (!presupuestos().length) {
    <div class="mp__vacio">
      <rs-icon name="file-text" [size]="36" [stroke]="1.6"></rs-icon>
      <p>{{ 'Todavía no has pedido ningún presupuesto.' | t }}</p>
      <a class="rs-btn rs-btn--gold" routerLink="/transporte">{{ 'Buscar transporte' | t }}</a>
    </div>
  } @else {
    <div class="mp">
      @for (p of presupuestos(); track p.id) {
        <article class="mp__presupuesto" [attr.data-estado]="p.estado">
          <header class="mp__cabecera">
            <div>
              <p class="mp__codigo">{{ p.codigo }} · {{ p.createdAt | date: 'd MMM' }}</p>
              <h2>{{ p.tituloServicio || ruta(p) }}</h2>
              <p class="mp__fecha">{{ ruta(p) }} · {{ p.fechaServicio | date: 'EEEE d MMMM, HH:mm' }}</p>
            </div>
            <span class="mp__estado" [attr.data-estado]="p.estado">{{ etiquetaEstado(p) | t }}</span>
          </header>

          @if (resumen(p).length) {
            <details class="mp__detalle">
              <summary>{{ 'Lo que pediste' | t }}</summary>
              <dl>
                @for (fila of resumen(p); track fila[0]) { <div><dt>{{ fila[0] | t }}</dt><dd>{{ fila[1] }}</dd></div> }
              </dl>
            </details>
          }

          @if (p.importe) {
            <div class="mp__oferta">
              <div>
                <strong class="mp__importe">{{ p.importe | euros }}</strong>
                <span>{{ 'IVA incluido' | t }}@if (p.validoHasta) { · {{ 'válido hasta el {fecha}' | t: { fecha: (p.validoHasta | date: 'd MMM, HH:mm') ?? '' } }} }</span>
                @if (p.condiciones) { <p class="mp__condiciones">{{ p.condiciones }}</p> }
              </div>
              <div class="mp__acciones">
                @if (puedeAceptar(p)) {
                  <button type="button" class="rs-btn rs-btn--ghost rs-btn--sm" [disabled]="ocupado() === p.id" (click)="rechazar(p)">{{ 'Rechazar' | t }}</button>
                  <button type="button" class="rs-btn rs-btn--gold" (click)="aceptar(p)">{{ 'Aceptar y pagar' | t }}</button>
                }
                @if (p.estado === 'aceptado' && p.reservaId) {
                  <button type="button" class="rs-btn rs-btn--primary" (click)="aceptar(p)">{{ 'Completar el pago' | t }}</button>
                }
              </div>
            </div>
          } @else if (p.estado === 'solicitado') {
            <p class="mp__espera">{{ 'Preparando presupuesto…' | t }}</p>
          }
        </article>
      }
    </div>
  }
</app-marco-viaje>
  `,
  styles: [`
    :host { display: block; }
    .mp { display: flex; flex-direction: column; gap: var(--sp-4); }
    .mp__cargando { height: 320px; border-radius: var(--r-2xl); }
    .mp__vacio { display: flex; flex-direction: column; align-items: center; gap: var(--sp-3); padding: var(--sp-10);
      text-align: center; color: var(--t-300); background: var(--c-card); border: 1px dashed var(--b-a); border-radius: var(--r-2xl); }
    .mp__presupuesto { display: flex; flex-direction: column; gap: var(--sp-3); padding: var(--sp-5);
      background: var(--c-card); border: 1px solid var(--b-2); border-radius: var(--r-2xl); box-shadow: var(--sh-sm);
      &[data-estado='ofertado'] { border-color: var(--dk-gold); }
    }
    .mp__cabecera { display: flex; justify-content: space-between; gap: var(--sp-3); align-items: flex-start;
      h2 { margin: 0; font-family: var(--font-display); font-size: var(--f-lg); font-weight: var(--w-8); color: var(--dk-blue-text); }
    }
    .mp__codigo, .mp__fecha { margin: 0; font-size: var(--f-xs); color: var(--t-400); }
    .mp__estado { padding: 2px var(--sp-3); border-radius: var(--r-full); font-size: var(--f-xs); font-weight: var(--w-7);
      background: var(--c-accent-lo); color: var(--dk-blue); white-space: nowrap;
      &[data-estado='ofertado'] { background: var(--dk-gold-lo); color: var(--dk-gold-text); }
      &[data-estado='aceptado'] { background: var(--c-success-lo); color: var(--c-success); }
      &[data-estado='rechazado'], &[data-estado='caducado'] { background: var(--c-surface); color: var(--t-400); }
    }
    .mp__detalle { font-size: var(--f-sm); color: var(--t-300);
      summary { cursor: pointer; font-weight: var(--w-6); color: var(--c-accent); }
      dl { display: flex; flex-direction: column; gap: var(--sp-1); margin: var(--sp-2) 0 0; }
      div { display: grid; grid-template-columns: minmax(100px, 35%) 1fr; gap: var(--sp-2); }
      dt { color: var(--t-400); } dd { margin: 0; color: var(--t-200); }
    }
    .mp__oferta { display: flex; justify-content: space-between; align-items: flex-end; gap: var(--sp-3); flex-wrap: wrap;
      padding-top: var(--sp-3); border-top: 1px solid var(--b-1);
      span { display: block; font-size: var(--f-xs); color: var(--t-400); }
    }
    .mp__importe { font-family: var(--font-display); font-size: var(--f-2xl); font-weight: var(--w-8); color: var(--dk-blue-text); }
    .mp__condiciones { margin: var(--sp-1) 0 0; font-size: var(--f-sm); color: var(--t-300); white-space: pre-line; }
    .mp__acciones { display: flex; gap: var(--sp-2); }
    .mp__espera { margin: 0; font-size: var(--f-sm); color: var(--t-400); }
  `],
})
export class MisPresupuestosComponent implements OnInit {
  private readonly api = inject(TransporteViajeApi);
  private readonly router = inject(Router);

  readonly presupuestos = signal<PresupuestoDto[]>([]);
  readonly cargando = signal(true);
  readonly ocupado = signal<string | null>(null);
  readonly error = signal<string | null>(null);

  async ngOnInit(): Promise<void> {
    try {
      this.presupuestos.set(await this.api.misPresupuestos());
    } catch (error) {
      this.error.set(mensajeDeError(error, 'No hemos podido cargar tus presupuestos.'));
    } finally {
      this.cargando.set(false);
    }
  }

  etiquetaEstado(p: PresupuestoDto): string {
    return ESTADO_PRESUPUESTO_LABELS[p.estado] ?? p.estado;
  }

  resumen(p: PresupuestoDto): Array<[string, string]> {
    const filas = p.solicitud['resumen'];
    return Array.isArray(filas) ? (filas as Array<[string, string]>) : [];
  }

  ruta(p: PresupuestoDto): string {
    const filas = this.resumen(p);
    const origen = filas.find(([e]) => e === 'Recogida')?.[1]?.split(',')[0] ?? '';
    const destino = filas.find(([e]) => e === 'Entrega')?.[1]?.split(',')[0] ?? '';
    return origen && destino ? `${origen} → ${destino}` : p.codigo;
  }

  puedeAceptar(p: PresupuestoDto): boolean {
    const vigente = !p.validoHasta || new Date(p.validoHasta).getTime() > Date.now();
    return p.estado === EstadoPresupuesto.OFERTADO && vigente;
  }

  /** Lleva a completar quién entrega y quién recibe y a pagar; ahí se acepta la oferta. */
  aceptar(p: PresupuestoDto): void {
    void this.router.navigate(['/transporte/viaje/reserva'], { queryParams: { presupuesto: p.id } });
  }

  async rechazar(p: PresupuestoDto): Promise<void> {
    this.ocupado.set(p.id);
    try {
      const actualizado = await this.api.rechazarPresupuesto(p.id);
      this.presupuestos.update((lista) => lista.map((x) => (x.id === p.id ? { ...x, ...actualizado } : x)));
    } catch (error) {
      this.error.set(mensajeDeError(error, 'No se pudo rechazar el presupuesto.'));
    } finally {
      this.ocupado.set(null);
    }
  }
}
