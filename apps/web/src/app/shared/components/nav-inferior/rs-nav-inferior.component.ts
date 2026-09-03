import { ChangeDetectionStrategy, Component, computed, effect, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router, RouterLink, RouterLinkActive } from '@angular/router';
import { filter, map, startWith } from 'rxjs/operators';
import { RsIconComponent } from '../icon/rs-icon.component';
import { TraducirPipe } from '../../../core/i18n/traducir.pipe';
import { AuthService } from '../../../core/auth/auth.service';
import { MovilService } from '../../../core/movil/movil.service';

/** Una pestaña de la barra. `icono` es un nombre válido de `rs-icon`. */
interface Pestana {
  readonly ruta: string;
  readonly icono: string;
  readonly etiqueta: string;
  /** true = la pestaña sólo está activa en su ruta exacta, no en las hijas. */
  readonly exacta?: boolean;
}

/**
 * Barra de navegación inferior de la app instalada.
 *
 * **Sólo se pinta en Android/iOS.** En la web la navegación es la navbar
 * superior y esta barra no aparece: en pantalla grande una barra de pestañas
 * abajo no es un patrón de web, y duplicaría la navegación existente.
 *
 * El motivo de existir es de alcance del pulgar: en un móvil la navbar superior
 * queda en el tercio de la pantalla al que no se llega sin recolocar la mano.
 * Las cuatro entradas son las que se usan en bucle —buscar, explorar, ver mis
 * reservas y mi cuenta—; el resto sigue estando en la navbar.
 */
@Component({
  selector: 'rs-nav-inferior',
  standalone: true,
  imports: [RouterLink, RouterLinkActive, RsIconComponent, TraducirPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
@if (visible()) {
  <nav class="nav-inf" role="navigation" [attr.aria-label]="'Navegación principal' | t">
    @for (pestana of pestanas(); track pestana.ruta) {
      <a
        class="nav-inf__item"
        [routerLink]="pestana.ruta"
        routerLinkActive="activo"
        [routerLinkActiveOptions]="{ exact: !!pestana.exacta }"
        #enlace="routerLinkActive"
        [attr.aria-current]="enlace.isActive ? 'page' : null">
        <rs-icon [name]="pestana.icono" [size]="22" [filled]="enlace.isActive" />
        <span class="nav-inf__texto">{{ pestana.etiqueta | t }}</span>
      </a>
    }
  </nav>
}
  `,
  styles: [`
    .nav-inf {
      position: fixed;
      inset: auto 0 0 0;
      z-index: 900;
      display: grid;
      grid-auto-flow: column;
      grid-auto-columns: 1fr;
      /* El relleno inferior es el indicador de inicio del iPhone: sin él la
         última fila de iconos queda justo debajo de la barra del sistema. */
      padding: var(--sp-2) var(--sp-2) calc(var(--sp-2) + env(safe-area-inset-bottom, 0px));
      background: var(--c-card);
      border-top: 1px solid var(--c-surface);
      /* La sombra va hacia arriba: la barra flota sobre el contenido que rueda
         por debajo. */
      box-shadow: 0 -2px 12px rgba(8, 37, 139, .06);
    }

    .nav-inf__item {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: 3px;
      /* 48px de alto mínimo: por debajo, el objetivo táctil es más pequeño de
         lo que recomiendan Android e iOS y se falla al pulsar. */
      min-height: 48px;
      padding: var(--sp-1) var(--sp-2);
      border-radius: var(--r-lg);
      color: var(--t-500);
      transition: color var(--t-fast, .15s) ease;
    }

    .nav-inf__item.activo { color: var(--dk-blue); }

    /* Sin :hover: en táctil se queda "pegado" tras pulsar. La respuesta al
       toque es el hundido de :active. */
    .nav-inf__item:active { transform: scale(.94); }

    .nav-inf__texto {
      font-size: 11px;
      font-weight: var(--w-6, 600);
      line-height: 1;
      letter-spacing: .01em;
    }

    /* Con el teclado abierto la barra subiría hasta quedar encima de él y
       taparía el campo que se está rellenando. En pantallas muy bajas se
       esconde. */
    @media (max-height: 420px) { .nav-inf { display: none; } }
  `],
})
export class RsNavInferiorComponent {
  protected readonly movil = inject(MovilService);
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  private readonly url = toSignal(
    this.router.events.pipe(
      filter((evento): evento is NavigationEnd => evento instanceof NavigationEnd),
      map((evento) => evento.urlAfterRedirects),
      startWith(this.router.url),
    ),
    { initialValue: this.router.url },
  );

  protected readonly visible = computed(
    () => this.movil.esNativo && !esPantallaDeFlujo(this.url()),
  );

  constructor() {
    // El hueco que deja el contenido por debajo tiene que aparecer y
    // desaparecer con la barra. Si el relleno fuera fijo, las fichas y el
    // proceso de reserva —donde la barra no está— arrastrarían 58px de vacío
    // al final de la página.
    effect(() => {
      document.documentElement.classList.toggle('dk-con-nav-inferior', this.visible());
    });
  }

  /**
   * La cuarta pestaña depende de quién ha iniciado sesión: mandar a un comercio
   * a "mis reservas" de cliente, o a un invitado a una pantalla con guard, sería
   * mandarle a una pantalla vacía o a un login sin explicación.
   */
  protected readonly pestanas = (): readonly Pestana[] => {
    const inicio: Pestana = { ruta: '/', icono: 'home', etiqueta: 'Inicio', exacta: true };
    const explora: Pestana = { ruta: '/explora', icono: 'search', etiqueta: 'Explora' };
    const perfil: Pestana = { ruta: '/perfil', icono: 'user', etiqueta: 'Perfil' };

    if (this.auth.esAdmin()) {
      return [inicio, explora, { ruta: '/admin', icono: 'bar-chart', etiqueta: 'Panel' }, perfil];
    }
    if (this.auth.esComercio()) {
      return [inicio, explora, { ruta: '/comercio', icono: 'store', etiqueta: 'Mi negocio' }, perfil];
    }
    if (this.auth.estaAutenticado()) {
      return [inicio, explora, { ruta: '/reservas', icono: 'calendar', etiqueta: 'Reservas' }, perfil];
    }
    // Sin sesión: "Reservas" y "Perfil" tienen guard y acabarían en el login.
    return [inicio, explora, { ruta: '/favoritos', icono: 'heart', etiqueta: 'Favoritos' },
            { ruta: '/auth/login', icono: 'user', etiqueta: 'Entrar' }];
  };
}

/**
 * Pantallas donde la barra se esconde.
 *
 * Fichas y flujos de reserva ya tienen su propia barra fija abajo con la acción
 * principal ("Reservar", "Pagar", "Siguiente"). Con las dos a la vez, o una
 * tapaba a la otra, o se comían entre ambas casi un quinto de la pantalla. Es
 * además lo que hace cualquier app nativa: las pestañas desaparecen al entrar
 * en un proceso de compra y vuelven al salir.
 */
const RUTAS_DE_FLUJO: readonly RegExp[] = [
  // Ficha de un servicio: /alojamiento/abc123, /veterinaria/abc123, /explora/abc123…
  /^\/(alojamiento|transporte|veterinaria|peluqueria|adiestramiento|hoteles|seguros|funerarios|explora)\/[^/?#]+/,
  // Reserva y pago. `/reservas` y `/reservas/mis-reservas` quedan fuera a
  // propósito: son el destino de la pestaña y ahí la barra debe verse.
  /^\/reservas\/(pagar|viaje-pago|viaje\/)/,
  /^\/reservas\/[^/?#]+\/[^/?#]+/,
  // Formularios del panel de comercio y del de administración.
  /^\/(comercio|admin)\/.+/,
];

const esPantallaDeFlujo = (url: string): boolean => {
  const ruta = url.split('?')[0].split('#')[0];
  return RUTAS_DE_FLUJO.some((patron) => patron.test(ruta));
};
