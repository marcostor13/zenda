import {
  ChangeDetectionStrategy, Component, ElementRef, HostListener, computed, inject, input, model, signal,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import { AuthService } from '../../../core/auth/auth.service';
import { PerroApi, PerrosService } from '../../../features/perros/perros.service';
import { RsIconComponent } from '../icon/rs-icon.component';

/**
 * Selector de mascotas de la reserva. Sustituye al antiguo desplegable
 * "Cualquier perro", que el propio cliente no entendía: aquí se ve con qué
 * perro se reserva, con su foto y su nombre.
 *
 * Dos valores, uno derivado del otro:
 * - `perroIds`  → mascotas registradas elegidas (dan precio ajustado y compatibilidad).
 * - `numPerros` → total de perros de la reserva; nunca es menor que `perroIds.length`
 *   y **no tiene tope**: quien lleva siete perros los añade con el botón "+".
 */
@Component({
  selector: 'rs-pet-picker',
  standalone: true,
  imports: [RouterLink, RsIconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
<div class="pp">
  <button type="button" class="pp__trigger" (click)="alternar()"
          [attr.aria-expanded]="abierto()" aria-haspopup="dialog"
          [attr.aria-label]="'Mascotas de la reserva: ' + resumen()">
    <rs-icon name="paw" [size]="18" [stroke]="2"></rs-icon>
    <span class="pp__summary">{{ resumen() }}</span>
    <rs-icon name="chevron-down" [size]="14" [stroke]="2.5" class="pp__caret"></rs-icon>
  </button>

  @if (abierto()) {
    <div class="pp__pop" role="dialog" aria-label="Elegir mascotas">
      @if (autenticado()) {
        @if (cargando()) {
          <p class="pp__hint">Cargando tus mascotas…</p>
        } @else if (perros().length) {
          <p class="pp__title">Tus mascotas</p>
          <ul class="pp__list">
            @for (p of perros(); track p._id) {
              <li>
                <label class="pp__pet" [class.is-on]="estaElegido(p._id)">
                  <input type="checkbox" [checked]="estaElegido(p._id)"
                         (change)="alternarPerro(p._id)" />
                  <span class="pp__avatar">
                    @if (p.fotos.length) {
                      <img [src]="p.fotos[0]" alt="" aria-hidden="true" />
                    } @else {
                      <rs-icon name="paw" [size]="16" [stroke]="2"></rs-icon>
                    }
                  </span>
                  <span class="pp__pet-text">
                    <strong>{{ p.nombre }}</strong>
                    <em>{{ p.raza || (p.esMestizo ? 'Mestizo' : 'Sin raza indicada') }}</em>
                  </span>
                  <rs-icon name="check" [size]="16" [stroke]="3" class="pp__tick"></rs-icon>
                </label>
              </li>
            }
          </ul>
          <a routerLink="/perros/nuevo" class="pp__link" (click)="cerrar()">
            <rs-icon name="plus" [size]="14" [stroke]="2.5"></rs-icon> Añadir otra mascota
          </a>
        } @else {
          <p class="pp__hint">
            Aún no tienes mascotas registradas.
            <a routerLink="/perros/nuevo" (click)="cerrar()">Registra la tuya</a>
            y ajustaremos precios y resultados a su perfil.
          </p>
        }
      } @else {
        <p class="pp__hint">
          <a routerLink="/auth/login" (click)="cerrar()">Inicia sesión</a>
          para reservar con la ficha de tu perro y ver precios ajustados.
        </p>
      }

      <div class="pp__row">
        <span class="pp__row-text">
          <strong>{{ etiquetaSinFicha() }}</strong>
          <em>Perros que aún no tienen ficha</em>
        </span>
        <span class="pp__stepper">
          <button type="button" (click)="quitarSinFicha()" [disabled]="!puedeQuitar()"
                  aria-label="Quitar un perro">−</button>
          <output>{{ sinFicha() }}</output>
          <button type="button" (click)="anadirSinFicha()" aria-label="Añadir un perro">+</button>
        </span>
      </div>

      <div class="pp__foot">
        <span class="pp__total">{{ numPerros() }} {{ numPerros() === 1 ? 'perro' : 'perros' }} en total</span>
        <button type="button" class="rs-btn rs-btn--primary rs-btn--sm" (click)="cerrar()">Listo</button>
      </div>
    </div>
  }
</div>
  `,
  styles: [`
    :host { display: block; }
    .pp { position: relative; }

    .pp__trigger {
      display: flex; align-items: center; gap: var(--sp-2);
      width: 100%; padding: 0; border: none; background: transparent;
      color: var(--t-400); cursor: pointer; text-align: left;
    }
    .pp__summary {
      flex: 1; min-width: 0;
      font-family: var(--font); font-size: var(--f-base); color: var(--t-100);
      white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
    }
    .pp__caret { flex-shrink: 0; }

    .pp__pop {
      position: absolute; z-index: var(--z-3); top: calc(100% + var(--sp-3)); left: 0;
      width: min(340px, 84vw);
      padding: var(--sp-4);
      background: var(--c-card);
      border: 1px solid var(--b-1);
      border-radius: var(--r-lg);
      box-shadow: var(--sh-xl);
      animation: pp-in .14s ease both;

      /* Cerca del borde derecho de la pantalla se ancla al otro lado. */
      @media (max-width: 480px) { left: auto; right: 0; }
    }
    @keyframes pp-in { from { opacity: 0; transform: translateY(-4px); } to { opacity: 1; transform: none; } }
    @media (prefers-reduced-motion: reduce) { .pp__pop { animation: none; } }

    .pp__title {
      font-family: var(--font-accent); font-size: var(--f-xs); font-weight: var(--w-7);
      letter-spacing: .06em; text-transform: uppercase; color: var(--dk-blue);
      margin-bottom: var(--sp-2);
    }

    .pp__list { list-style: none; display: flex; flex-direction: column; gap: var(--sp-1); }

    .pp__pet {
      display: flex; align-items: center; gap: var(--sp-3);
      padding: var(--sp-2); border-radius: var(--r-md);
      border: 1px solid transparent; cursor: pointer;
      transition: background var(--d-2), border-color var(--d-2);

      &:hover { background: var(--c-accent-lo); }
      &.is-on { border-color: rgba(8,37,139,.22); background: var(--c-accent-lo); }

      input { position: absolute; opacity: 0; pointer-events: none; }
      .pp__tick { opacity: 0; color: var(--dk-blue); flex-shrink: 0; }
      &.is-on .pp__tick { opacity: 1; }
    }

    .pp__avatar {
      display: inline-flex; align-items: center; justify-content: center;
      width: 34px; height: 34px; border-radius: 50%; flex-shrink: 0;
      background: var(--c-accent-lo); color: var(--dk-blue); overflow: hidden;
      img { width: 100%; height: 100%; object-fit: cover; }
    }

    .pp__pet-text {
      display: flex; flex-direction: column; min-width: 0; flex: 1;
      strong { font-size: var(--f-sm); font-weight: var(--w-6); color: var(--t-100); }
      em { font-size: var(--f-xs); font-style: normal; color: var(--t-400);
           white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    }

    .pp__hint {
      font-size: var(--f-sm); line-height: 1.5; color: var(--t-400);
      a { color: var(--dk-blue); font-weight: var(--w-6); text-decoration: underline; }
    }

    .pp__link {
      display: inline-flex; align-items: center; gap: var(--sp-1);
      margin-top: var(--sp-2); font-size: var(--f-sm); font-weight: var(--w-6);
      color: var(--dk-blue);
      &:hover { text-decoration: underline; }
    }

    .pp__row {
      display: flex; align-items: center; justify-content: space-between; gap: var(--sp-3);
      margin-top: var(--sp-4); padding-top: var(--sp-4);
      border-top: 1px solid var(--b-1);
    }
    .pp__row-text {
      display: flex; flex-direction: column;
      strong { font-size: var(--f-sm); font-weight: var(--w-6); color: var(--t-100); }
      em { font-size: var(--f-xs); font-style: normal; color: var(--t-400); }
    }

    .pp__stepper {
      display: inline-flex; align-items: center; gap: var(--sp-1); flex-shrink: 0;

      button {
        width: 32px; height: 32px; flex-shrink: 0;
        display: inline-flex; align-items: center; justify-content: center;
        font-size: var(--f-lg); line-height: 1; font-weight: var(--w-6);
        border: 1px solid var(--b-2); border-radius: 50%;
        background: var(--c-card); color: var(--dk-blue); cursor: pointer;
        transition: background var(--d-2), border-color var(--d-2), color var(--d-2);

        &:hover:not(:disabled) { background: var(--c-accent-lo); border-color: var(--c-accent); }
        &:disabled { opacity: .4; cursor: not-allowed; }
      }

      output { min-width: 24px; text-align: center; font-size: var(--f-base); font-weight: var(--w-6); color: var(--t-100); }
    }

    .pp__foot {
      display: flex; align-items: center; justify-content: space-between; gap: var(--sp-3);
      margin-top: var(--sp-4);
    }
    .pp__total { font-size: var(--f-xs); color: var(--t-400); }
  `],
})
export class RsPetPickerComponent {
  private readonly authService = inject(AuthService);
  private readonly perrosService = inject(PerrosService);
  private readonly host = inject(ElementRef<HTMLElement>);

  /** Mascotas registradas elegidas para la reserva. */
  readonly perroIds = model<string[]>([]);
  /** Total de perros; siempre ≥ `perroIds.length` y ≥ 1. Sin tope superior. */
  readonly numPerros = model<number>(1);
  /** Texto del disparador cuando no hay nada elegido. */
  readonly placeholder = input('Cualquier perro');

  readonly abierto = signal(false);
  readonly cargando = signal(false);
  readonly perros = signal<PerroApi[]>([]);

  readonly autenticado = this.authService.estaAutenticado;

  /** Perros de la reserva que no corresponden a una ficha registrada. */
  readonly sinFicha = computed(() => Math.max(0, this.numPerros() - this.perroIds().length));

  readonly puedeQuitar = computed(() => this.sinFicha() > 0 && this.numPerros() > 1);

  readonly etiquetaSinFicha = computed(() =>
    this.perros().length ? 'Otros perros' : 'Número de perros',
  );

  readonly resumen = computed(() => {
    const elegidos = this.perroIds();
    const extra = this.sinFicha();

    if (!elegidos.length) {
      return extra === 0 ? this.placeholder() : `${extra} ${extra === 1 ? 'perro' : 'perros'}`;
    }

    const nombres = elegidos
      .map((id) => this.perros().find((p) => p._id === id)?.nombre)
      .filter((n): n is string => Boolean(n));

    // Sin los nombres cargados aún, no se inventa texto: se cuenta.
    const base = nombres.length === 0
      ? `${elegidos.length} ${elegidos.length === 1 ? 'mascota' : 'mascotas'}`
      : nombres.length === 1 ? nombres[0]
      : nombres.length === 2 ? `${nombres[0]} y ${nombres[1]}`
      : `${nombres[0]} y ${nombres.length - 1} más`;

    return extra > 0 ? `${base} + ${extra} ${extra === 1 ? 'perro' : 'perros'}` : base;
  });

  alternar(): void {
    const abriendo = !this.abierto();
    this.abierto.set(abriendo);
    if (abriendo) void this.cargarPerros();
  }

  cerrar(): void {
    this.abierto.set(false);
  }

  estaElegido(id: string): boolean {
    return this.perroIds().includes(id);
  }

  alternarPerro(id: string): void {
    const actuales = this.perroIds();
    const siguientes = actuales.includes(id)
      ? actuales.filter((x) => x !== id)
      : [...actuales, id];

    this.perroIds.set(siguientes);
    // El total nunca puede quedar por debajo de las mascotas elegidas: al marcar
    // la segunda mascota, la reserva pasa a ser de dos perros por sí sola.
    this.numPerros.set(Math.max(1, siguientes.length, this.numPerros()));
  }

  anadirSinFicha(): void {
    this.numPerros.set(this.numPerros() + 1);
  }

  quitarSinFicha(): void {
    if (!this.puedeQuitar()) return;
    this.numPerros.set(Math.max(1, this.numPerros() - 1));
  }

  @HostListener('document:click', ['$event'])
  cerrarAlPulsarFuera(evento: MouseEvent): void {
    if (!this.abierto()) return;
    if (!this.host.nativeElement.contains(evento.target as Node)) this.cerrar();
  }

  @HostListener('document:keydown.escape')
  cerrarConEscape(): void {
    this.cerrar();
  }

  private async cargarPerros(): Promise<void> {
    if (!this.autenticado() || this.perros().length || this.cargando()) return;
    this.cargando.set(true);
    try {
      this.perros.set(await this.perrosService.misPerros());
    } catch {
      // El buscador debe seguir siendo usable sin la lista de mascotas.
      this.perros.set([]);
    } finally {
      this.cargando.set(false);
    }
  }
}
