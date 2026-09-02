import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { CurrencyPipe, DatePipe } from '@angular/common';
import { Router } from '@angular/router';
import { VERTICAL_LABELS, VerticalKey } from 'shared';
import { RsIconComponent } from '../../shared/components/icon/rs-icon.component';
import { CarritoService, ItemCarritoApi } from './carrito.service';
import { TraducirPipe } from '../../core/i18n/traducir.pipe';

interface GrupoComercio {
  comercioId: string;
  items: ItemCarritoApi[];
  subtotal: number;
}

/**
 * Panel lateral del viaje. Agrupa por comercio a propósito: aunque el cliente
 * paga una sola vez, **cada servicio es una reserva independiente** con su
 * propio negocio y su propia política de cancelación, y esconderlo generaría
 * la expectativa equivocada de que cancelar uno cancela todo.
 */
@Component({
  selector: 'app-carrito-panel',
  standalone: true,
  imports: [
    TraducirPipe, CurrencyPipe, DatePipe, RsIconComponent
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
@if (abierto()) {
  <div class="cp__veil" (click)="cerrar()" aria-hidden="true"></div>

  <aside class="cp" role="dialog" [attr.aria-label]="'Tu viaje con tu mascota' | t">
    <header class="cp__head">
      <div>
        <h2>{{ 'Tu viaje' | t }}</h2>
        <p>{{ carritoService.numItems() }} {{ carritoService.numItems() === 1 ? 'servicio' : 'servicios' }}</p>
      </div>
      <button type="button" class="cp__cerrar" (click)="cerrar()" [attr.aria-label]="'Cerrar el panel' | t">
        <rs-icon name="x" [size]="18" [stroke]="2"></rs-icon>
      </button>
    </header>

    @if (!carritoService.numItems()) {
      <p class="cp__vacio">
        {{ 'Aún no has añadido nada. Reserva un alojamiento y te propondremos peluquería o transporte para esas mismas fechas.' | t }}
      </p>
    } @else {
      <ul class="cp__grupos">
        @for (g of grupos(); track g.comercioId) {
          <li class="cp__grupo">
            @for (i of g.items; track i.itemId) {
              <div class="cp__item">
                <div class="cp__item-texto">
                  <span class="cp__vertical">{{ etiquetaVertical(i.vertical) }}</span>
                  <strong>{{ i.titulo }}</strong>
                  <em>{{ i.fechaInicio | date: 'd MMM' }}@if (i.fechaFin) { – {{ i.fechaFin | date: 'd MMM' }} }</em>
                  @if (i.esReservaMadre) { <span class="cp__madre">{{ 'Eje del viaje' | t }}</span> }
                </div>
                <div class="cp__item-precio">
                  <span>{{ i.precioEstimado | currency: 'EUR' }}</span>
                  <button type="button" (click)="quitar(i)"
                          [attr.aria-label]="'Quitar ' + i.titulo + ' del viaje'">
                    <rs-icon name="x" [size]="14" [stroke]="2.5"></rs-icon>
                  </button>
                </div>
              </div>
            }
          </li>
        }
      </ul>

      <div class="cp__pie">
        <p class="cp__nota">
          <rs-icon name="alert-circle" [size]="13" [stroke]="2"></rs-icon>
          {{ 'Cada servicio es una reserva independiente: puedes cancelar uno sin perder el resto.' | t }}
        </p>

        <div class="cp__total">
          <span>{{ 'Total estimado' | t }}</span>
          <strong>{{ carritoService.totalEstimado() | currency: 'EUR' }}</strong>
        </div>

        @if (error()) { <p class="cp__error">{{ error() }}</p> }

        <button type="button" class="rs-btn rs-btn--gold rs-btn--block"
                [disabled]="procesando()" (click)="reservar()">
          {{ procesando() ? 'Comprobando disponibilidad…' : 'Reservar el viaje' }}
        </button>
      </div>
    }
  </aside>
}
  `,
  styles: [`
    :host { display: contents; }

    .cp__veil {
      position: fixed; inset: 0; z-index: var(--z-3);
      background: rgba(0,19,93,.35); backdrop-filter: blur(2px);
    }

    .cp {
      position: fixed; top: 0; right: 0; bottom: 0; z-index: var(--z-4, 60);
      width: min(420px, 100vw);
      display: flex; flex-direction: column;
      background: var(--c-card);
      box-shadow: var(--sh-xl);
      animation: cp-in .18s ease both;
    }
    @keyframes cp-in { from { transform: translateX(100%); } to { transform: none; } }
    @media (prefers-reduced-motion: reduce) { .cp { animation: none; } }

    .cp__head {
      display: flex; align-items: flex-start; justify-content: space-between; gap: var(--sp-4);
      padding: var(--sp-6); border-bottom: 1px solid var(--b-1);

      h2 { font-size: var(--f-lg); color: var(--dk-blue); }
      p { font-size: var(--f-xs); color: var(--t-400); margin-top: 2px; }
    }

    .cp__cerrar {
      display: inline-flex; align-items: center; justify-content: center;
      width: 32px; height: 32px; flex-shrink: 0;
      border: 1px solid var(--b-2); border-radius: 50%;
      background: transparent; color: var(--t-300); cursor: pointer;
      &:hover { background: var(--c-accent-lo); color: var(--dk-blue); }
    }

    .cp__vacio { padding: var(--sp-6); color: var(--t-400); font-size: var(--f-sm); line-height: 1.6; }

    .cp__grupos { flex: 1; overflow-y: auto; list-style: none; padding: var(--sp-4); }
    .cp__grupo + .cp__grupo { margin-top: var(--sp-3); padding-top: var(--sp-3); border-top: 1px solid var(--b-1); }

    .cp__item {
      display: flex; align-items: flex-start; justify-content: space-between; gap: var(--sp-3);
      padding: var(--sp-3);
      & + & { margin-top: var(--sp-2); }
    }

    .cp__item-texto {
      display: flex; flex-direction: column; gap: 2px; min-width: 0;
      strong { font-size: var(--f-sm); color: var(--t-100); }
      em { font-size: var(--f-xs); font-style: normal; color: var(--t-400); }
    }

    .cp__vertical {
      font-family: var(--font-accent); font-size: var(--f-xs); font-weight: var(--w-7);
      letter-spacing: .06em; text-transform: uppercase; color: var(--dk-gold);
    }

    .cp__madre {
      align-self: flex-start; margin-top: 2px;
      padding: 1px var(--sp-2); border-radius: var(--r-full);
      background: var(--c-accent-lo); color: var(--dk-blue);
      font-size: var(--f-xs); font-weight: var(--w-6);
    }

    .cp__item-precio {
      display: flex; align-items: center; gap: var(--sp-2); flex-shrink: 0;
      span { font-size: var(--f-sm); font-weight: var(--w-6); color: var(--t-100); }
      button {
        display: inline-flex; align-items: center; justify-content: center;
        width: 24px; height: 24px; border: none; border-radius: 50%;
        background: transparent; color: var(--t-400); cursor: pointer;
        &:hover { background: var(--c-accent-lo); color: var(--dk-blue); }
      }
    }

    .cp__pie { padding: var(--sp-5) var(--sp-6) var(--sp-6); border-top: 1px solid var(--b-1); }

    .cp__nota {
      display: flex; align-items: flex-start; gap: var(--sp-2);
      font-size: var(--f-xs); line-height: 1.5; color: var(--t-400);
      margin-bottom: var(--sp-4);
      rs-icon { flex-shrink: 0; margin-top: 2px; }
    }

    .cp__total {
      display: flex; align-items: baseline; justify-content: space-between;
      margin-bottom: var(--sp-4);
      span { font-size: var(--f-sm); color: var(--t-400); }
      strong { font-size: var(--f-xl); color: var(--dk-blue); }
    }

    .cp__error { font-size: var(--f-sm); color: #B91C1C; margin-bottom: var(--sp-3); line-height: 1.5; }
  `],
})
export class CarritoPanelComponent {
  readonly carritoService = inject(CarritoService);
  private readonly router = inject(Router);

  readonly abierto = signal(false);
  readonly procesando = signal(false);
  readonly error = signal('');

  readonly grupos = computed<GrupoComercio[]>(() => {
    const porComercio = new Map<string, ItemCarritoApi[]>();
    for (const item of this.carritoService.items()) {
      porComercio.set(item.comercioId, [...(porComercio.get(item.comercioId) ?? []), item]);
    }
    return [...porComercio.entries()].map(([comercioId, items]) => ({
      comercioId,
      items,
      subtotal: Math.round(items.reduce((s, i) => s + i.precioEstimado, 0) * 100) / 100,
    }));
  });

  async abrir(): Promise<void> {
    this.abierto.set(true);
    this.error.set('');
    await this.carritoService.cargar();
  }

  cerrar(): void {
    this.abierto.set(false);
  }

  etiquetaVertical(vertical: string): string {
    return VERTICAL_LABELS[vertical as VerticalKey] ?? vertical;
  }

  async quitar(item: ItemCarritoApi): Promise<void> {
    this.error.set('');
    try {
      await this.carritoService.quitar(item.itemId);
    } catch {
      this.error.set(`No se pudo quitar ${item.titulo}. Vuelve a intentarlo.`);
    }
  }

  async reservar(): Promise<void> {
    this.procesando.set(true);
    this.error.set('');
    try {
      const pago = await this.carritoService.checkout();
      this.cerrar();
      await this.router.navigate(['/reservas/viaje-pago'], {
        state: { clientSecret: pago.clientSecret, montoTotal: pago.montoTotal },
      });
    } catch (e) {
      // El backend nombra el servicio que se ha quedado sin plaza: se muestra
      // tal cual para que el usuario sepa exactamente qué corregir.
      const mensaje = (e as { error?: { message?: string } })?.error?.message;
      this.error.set(mensaje ?? 'No se pudo reservar el viaje. Vuelve a intentarlo.');
    } finally {
      this.procesando.set(false);
    }
  }
}
