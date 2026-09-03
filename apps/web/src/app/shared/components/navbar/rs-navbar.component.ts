import { Component, OnInit, inject, input, signal, computed, HostListener } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { nombreAlphaPresentacion } from 'shared';
import { AuthService } from '../../../core/auth/auth.service';
import { RsIconComponent } from '../icon/rs-icon.component';
import { RsRegionSelectorComponent } from '../region/rs-region-selector.component';
import { TraducirPipe } from '../../../core/i18n/traducir.pipe';
import { VERTICALES_PUBLICOS } from '../../verticales/verticales.config';
import { BRAND } from '../../media/images';
import { FavoritosService } from '../../../features/favoritos/favoritos.service';
import { PerrosService } from '../../../features/perros/perros.service';
import { ReservasService } from '../../../features/reservas/services/reservas.service';
import { ReviewsService } from '../../../features/reservas/services/reviews.service';
import { AlphaService, AlphaEstadoApi } from '../../../features/alpha/alpha.service';

@Component({
  selector: 'rs-navbar',
  standalone: true,
  imports: [
    RouterLink, RouterLinkActive, RsIconComponent, RsRegionSelectorComponent,
    TraducirPipe,
  ],
  template: `
    <nav class="rs-navbar">
      <!-- Marca: la inicial "D" siempre visible (patrón Booking) y el logotipo
           completo solo cuando hay espacio, para que la barra nunca se rompa.
           En la home el logotipo ya aparece en grande en el hero, así que ahí
           se oculta el pequeño para no duplicarlo (PDF 27/07 §1). -->
      <a routerLink="/" class="rs-navbar__brand" [attr.aria-label]="'Doogking — inicio' | t">
        <img [src]="logoD" alt="" aria-hidden="true" class="rs-navbar__mark" />
        <!-- Solo en movil: ahi la barra se queda con la "D" suelta y el nombre
             no se lee. En escritorio manda el logotipo. -->
        <span class="rs-navbar__brandword">Doogking.com</span>
        @if (!soloMarcaD()) {
          <img src="/images/logo-doogking.jpg" alt="Doogking" class="rs-navbar__wordmark" />
        }
      </a>

      <!-- Las categorías no van dentro de esta fila: viven en su propia tira,
           justo debajo (.rs-navbar__cats). Aquí sólo caben con el ancho que
           sobra tras la marca y las acciones —193 px en una tablet de 769,
           412 en un portátil de 1280— y las ocho pastillas necesitan 943, así
           que se veían dos y el resto quedaba recortado sin barra de scroll. -->

      <!-- Desktop actions -->
      <div class="rs-navbar__actions">
        <rs-region-selector />

        <a routerLink="/ayuda" class="rs-navbar__ayuda"
           [attr.aria-label]="'Ayuda y atención al cliente' | t" [attr.title]="'Ayuda y atención al cliente' | t">
          <rs-icon name="message-square" [size]="16" [stroke]="2"></rs-icon>
        </a>

        @if (muestraAltaComercio()) {
          <a routerLink="/auth/registro-comercio" class="rs-navbar__link rs-navbar__link--pro">
            <rs-icon name="building" [size]="14" [stroke]="2"></rs-icon>
            <span>{{ 'Registra tu empresa' | t }}</span>
          </a>
        }
        @if (estaAutenticado()) {
          @if (esAdmin()) {
            <a routerLink="/admin" class="rs-btn rs-btn--primary rs-btn--sm">
              <rs-icon name="building" [size]="14" [stroke]="2"></rs-icon>
              {{ 'Panel Admin' | t }}
            </a>
          }
          @if (esComercio()) {
            <!-- "Panel de mi comercio": el nombre deja claro que al pulsarlo se
                 abandona la parte de cliente y se entra en la gestión profesional
                 (TCK-8029). -->
            <a routerLink="/comercio" class="rs-btn rs-btn--primary rs-btn--sm">
              <rs-icon name="building" [size]="14" [stroke]="2"></rs-icon>
              {{ 'Panel de mi comercio' | t }}
            </a>
          }
          <div class="rs-navbar__account" (click)="$event.stopPropagation()">
            <button type="button" class="rs-btn rs-btn--primary rs-btn--sm rs-navbar__account-btn"
                    (click)="cuentaAbierto.set(!cuentaAbierto())" [attr.aria-expanded]="cuentaAbierto()">
              <span class="rs-navbar__avatar">
                @if (iniciales()) {
                  {{ iniciales() }}
                } @else {
                  <rs-icon name="paw" [size]="16" [stroke]="2"></rs-icon>
                }
                @if (tieneAvisoPendiente()) { <span class="rs-navbar__dot" aria-hidden="true"></span> }
              </span>
              {{ 'Mi cuenta' | t }}
              <rs-icon name="chevron-down" [size]="14" [stroke]="2"></rs-icon>
            </button>
            @if (cuentaAbierto()) {
              <div class="rs-navbar__dropdown">
                <!-- Cabecera de la identidad de CLIENTE: nombre de la persona,
                     nunca el del negocio (TCK-8029). -->
                <div class="rs-navbar__dropdown-header">
                  <span class="rs-navbar__dropdown-name">{{ nombreCuenta() }}</span>
                  @if (clienteVerificado()) {
                    <span class="rs-badge rs-badge--success rs-navbar__verificado">
                      <rs-icon name="badge-check" [size]="13" [stroke]="2"></rs-icon> {{ 'Cliente verificado' | t }}
                    </span>
                  }
                  @if (alpha(); as a) {
                    <span class="rs-navbar__dropdown-alpha">
                      <rs-icon name="crown" [size]="13" [stroke]="2"></rs-icon>
                      {{ 'Nivel {nivel}' | t: { nivel: nombreAlpha(a) } }} ·
                      {{ (a.reservasCompletadas === 1 ? '{n} reserva' : '{n} reservas')
                          | t: { n: a.reservasCompletadas } }}
                    </span>
                  }
                </div>

                <div class="rs-navbar__dropdown-divider"></div>

                <a routerLink="/perfil" class="rs-navbar__dropdown-item" (click)="cuentaAbierto.set(false)">
                  <rs-icon name="user" [size]="15" [stroke]="2"></rs-icon> {{ 'Mi perfil' | t }}
                </a>
                <a routerLink="/perros" class="rs-navbar__dropdown-item" (click)="cuentaAbierto.set(false)">
                  <rs-icon name="paw" [size]="15" [stroke]="2"></rs-icon> {{ 'Mis mascotas' | t }}
                  @if (numMascotas() > 0) { <span class="rs-navbar__count">{{ numMascotas() }}</span> }
                </a>
                <a routerLink="/reservas" class="rs-navbar__dropdown-item rs-navbar__dropdown-item--highlight" (click)="cuentaAbierto.set(false)">
                  <rs-icon name="calendar" [size]="15" [stroke]="2"></rs-icon> {{ 'Mis reservas' | t }}
                  @if (tieneReservaProxima()) {
                    <span class="rs-navbar__pill">
                      <rs-icon name="clock" [size]="12" [stroke]="2.5"></rs-icon> {{ 'Próxima reserva' | t }}
                    </span>
                  }
                </a>
                <a routerLink="/favoritos" class="rs-navbar__dropdown-item" (click)="cuentaAbierto.set(false)">
                  <rs-icon name="heart" [size]="15" [stroke]="2"></rs-icon> {{ 'Favoritos' | t }}
                  @if (favoritosService.count() > 0) { <span class="rs-navbar__count">{{ favoritosService.count() }}</span> }
                </a>
                <a routerLink="/perfil/resenas" class="rs-navbar__dropdown-item" (click)="cuentaAbierto.set(false)">
                  <rs-icon name="star" [size]="15" [stroke]="2"></rs-icon> {{ 'Mis reseñas' | t }}
                  @if (numResenas() > 0) { <span class="rs-navbar__count">{{ numResenas() }}</span> }
                  @if (tienePendientesResena()) { <span class="rs-navbar__pill">{{ 'Pendiente' | t }}</span> }
                </a>

                @if (esCliente()) {
                  <div class="rs-navbar__dropdown-divider"></div>

                  <a routerLink="/perfil/alpha" class="rs-navbar__dropdown-item" (click)="cuentaAbierto.set(false)">
                    <rs-icon name="crown" [size]="15" [stroke]="2"></rs-icon> {{ 'Nivel Alpha y recompensas' | t }}
                  </a>
                }

                <div class="rs-navbar__dropdown-divider"></div>

                <a routerLink="/perfil" class="rs-navbar__dropdown-item" (click)="cuentaAbierto.set(false)">
                  <rs-icon name="settings" [size]="15" [stroke]="2"></rs-icon> {{ 'Configuración' | t }}
                </a>
                <a routerLink="/ayuda" class="rs-navbar__dropdown-item" (click)="cuentaAbierto.set(false)">
                  <rs-icon name="message-square" [size]="15" [stroke]="2"></rs-icon> {{ 'Ayuda' | t }}
                </a>

                <!-- Buscar servicios vive en la navegación principal, no en la
                     configuración de la cuenta (TCK-8029). -->
                <div class="rs-navbar__dropdown-divider"></div>

                <button type="button" class="rs-navbar__dropdown-item rs-navbar__dropdown-item--danger" (click)="cerrarSesion()">
                  <rs-icon name="log-out" [size]="15" [stroke]="2"></rs-icon> {{ 'Cerrar sesión' | t }}
                </button>
              </div>
            }
          </div>
        } @else {
          <a routerLink="/auth/login"    class="rs-btn rs-btn--ghost rs-btn--sm">{{ 'Ingresar' | t }}</a>
          <a routerLink="/auth/registro" class="rs-btn rs-btn--primary rs-btn--sm">{{ 'Hazte una cuenta' | t }}</a>
        }
      </div>

      <!--
        Acceso a la cuenta en móvil. En escritorio vive en __actions con su
        desplegable; aquí, plegadas las acciones tras el menú, entrar en la
        cuenta exigía abrir el hamburguesa y buscar la entrada en la lista.
        Va antes del hamburguesa porque es lo que más se pulsa de los dos.
      -->
      <a class="rs-navbar__cuenta"
         [routerLink]="estaAutenticado() ? '/perfil' : '/auth/login'"
         [attr.aria-label]="estaAutenticado() ? nombreCuenta() : ('Entrar en mi cuenta' | t)">
        @if (estaAutenticado() && iniciales()) {
          <span class="rs-navbar__cuenta-ini">{{ iniciales() }}</span>
        } @else {
          <rs-icon name="user" [size]="20" [stroke]="2"></rs-icon>
        }
        @if (tieneAvisoPendiente()) {
          <span class="rs-navbar__cuenta-dot" aria-hidden="true"></span>
        }
      </a>

      <!-- Hamburger button (mobile only) -->
      <button class="rs-navbar__hamburger" (click)="menuAbierto.set(!menuAbierto())" [attr.aria-expanded]="menuAbierto()">
        @if (menuAbierto()) {
          <rs-icon name="x" [size]="22" [stroke]="2"></rs-icon>
        } @else {
          <rs-icon name="menu" [size]="22" [stroke]="2"></rs-icon>
        }
      </button>
    </nav>

    <!--
      Categorías en el propio encabezado, en todas las pantallas: es donde las
      pone Booking y es donde el usuario las busca. Al ocupar una fila entera
      —y no el hueco que sobra en la barra— las ocho caben desde 1100 px y por
      debajo se recorren de lado, que es como funcionan en el móvil.

      No depende de la pantalla que la embeba: antes era opcional y sólo cuatro
      vistas la pedían, así que en el móvil la ficha de un servicio, favoritos o
      "explora" se quedaban sin ninguna forma de cambiar de categoría mientras
      que en escritorio la barra sí la ofrecía.
    -->
    @if (muestraCategorias()) {
      <nav class="rs-navbar__cats" [attr.aria-label]="'Categorías de servicio' | t">
        @for (v of verticales; track v.key) {
          <a [routerLink]="v.route" routerLinkActive="is-active" class="rs-navbar__cat">
            <img [src]="v.icono" alt="" aria-hidden="true" class="rs-navbar__cat-icon" />
            <span class="rs-navbar__cat-label">{{ v.labelCorto | t }}</span>
          </a>
        }
      </nav>
    }

    <!-- Mobile menu drawer -->
    @if (menuAbierto()) {
      <div class="rs-mobile-menu">
        @if (muestraCategorias()) {
          <nav class="rs-mobile-menu__nav">
            @for (v of verticales; track v.key) {
              <a [routerLink]="v.route" routerLinkActive="rs-mobile-menu__link--active"
                 class="rs-mobile-menu__link" (click)="menuAbierto.set(false)">
                <rs-icon [name]="v.icon" [size]="17" [stroke]="2"></rs-icon> {{ v.label | t }}
              </a>
            }
          </nav>

          <div class="rs-mobile-menu__divider"></div>
        }

        <div class="rs-mobile-menu__actions">
          <rs-region-selector [block]="true" />

          <a routerLink="/ayuda" class="rs-btn rs-btn--ghost rs-btn--block" (click)="menuAbierto.set(false)">
            <rs-icon name="message-square" [size]="15" [stroke]="2"></rs-icon>
            {{ 'Ayuda y atención al cliente' | t }}
          </a>

          @if (estaAutenticado()) {
            @if (esAdmin()) {
              <a routerLink="/admin" class="rs-btn rs-btn--primary rs-btn--block" (click)="menuAbierto.set(false)">
                <rs-icon name="building" [size]="15" [stroke]="2"></rs-icon>
                {{ 'Panel Admin' | t }}
              </a>
            }
            @if (esComercio()) {
              <a routerLink="/comercio" class="rs-btn rs-btn--primary rs-btn--block" (click)="menuAbierto.set(false)">
                <rs-icon name="building" [size]="15" [stroke]="2"></rs-icon>
                {{ 'Panel de mi comercio' | t }}
              </a>
            }
            <a routerLink="/perfil"   class="rs-btn rs-btn--primary rs-btn--block" (click)="menuAbierto.set(false)">{{ 'Mi perfil' | t }}</a>
            <a routerLink="/perros"   class="rs-btn rs-btn--primary rs-btn--block" (click)="menuAbierto.set(false)">{{ 'Mis mascotas' | t }}</a>
            <a routerLink="/reservas" class="rs-btn rs-btn--primary rs-btn--block" (click)="menuAbierto.set(false)">{{ 'Mis reservas' | t }}</a>
            <a routerLink="/favoritos" class="rs-btn rs-btn--primary rs-btn--block" (click)="menuAbierto.set(false)">{{ 'Favoritos' | t }}</a>
            <button type="button" class="rs-btn rs-btn--ghost rs-btn--block" (click)="cerrarSesion()">
              <rs-icon name="log-out" [size]="15" [stroke]="2"></rs-icon>
              {{ 'Cerrar sesión' | t }}
            </button>
          } @else {
            <a routerLink="/auth/login"    class="rs-btn rs-btn--ghost rs-btn--block"   (click)="menuAbierto.set(false)">{{ 'Ingresar' | t }}</a>
            <a routerLink="/auth/registro" class="rs-btn rs-btn--primary rs-btn--block" (click)="menuAbierto.set(false)">{{ 'Hazte una cuenta gratis' | t }}</a>
          }

          <!-- El alta de comercio cierra el menú: es una acción secundaria para
               quien navega como cliente, no compite con sus propios accesos. -->
          @if (muestraAltaComercio()) {
            <a routerLink="/auth/registro-comercio" class="rs-btn rs-btn--outline rs-btn--block" (click)="menuAbierto.set(false)">
              <rs-icon name="building" [size]="15" [stroke]="2"></rs-icon>
              {{ 'Registra tu empresa' | t }}
            </a>
          }
        </div>
      </div>
    }
  `,
  styles: [`
    /*
     * Tira de categorías del encabezado. Es la única: la barra de arriba no
     * puede alojarlas porque sólo les cede el ancho sobrante y las ocho piden
     * 943 px. Aquí disponen de la fila entera, así que a partir de 1100 px se
     * ven todas y por debajo se recorren de lado con el dedo.
     */
    .rs-navbar__cats {
      display: flex;
      align-items: center;
      gap: var(--sp-2);
      /* Mismo margen lateral que la barra de arriba: las dos filas del
         encabezado tienen que arrancar en la misma vertical. */
      padding: var(--sp-2) var(--sp-8);
      background: var(--c-card);
      border-bottom: 1px solid var(--b-1);
      overflow-x: auto;
      scroll-snap-type: x proximity;
      -webkit-overflow-scrolling: touch;
      scrollbar-width: none;
      &::-webkit-scrollbar { display: none; }
    }

    @media (max-width: 768px) {
      .rs-navbar__cats { padding-inline: var(--sp-4); }
    }

    .rs-navbar__cat {
      flex: 0 0 auto;
      display: inline-flex;
      align-items: center;
      gap: var(--sp-2);
      padding: var(--sp-2) var(--sp-3);
      border: 1px solid var(--dk-gold);
      border-radius: var(--r-full);
      background: var(--c-card);
      color: var(--t-300);
      text-decoration: none;
      white-space: nowrap;
      scroll-snap-align: center;
      transition: background var(--d-2), border-color var(--d-2), color var(--d-2);

      &.is-active {
        color: var(--dk-blue);
        background: var(--c-accent-lo);
        border-color: var(--dk-gold);
        box-shadow: inset 0 -2px 0 var(--dk-gold);
      }
    }
    .rs-navbar__cat-icon { width: 22px; height: 22px; flex-shrink: 0; }
    .rs-navbar__cat-label { font-size: var(--f-xs); font-weight: var(--w-6); }

    /* Marca: inicial "D" + logotipo */
    .rs-navbar__mark { height: 34px; width: 34px; display: block; flex-shrink: 0; }
    .rs-navbar__wordmark { height: 44px; width: auto; display: block; }
    /* Se ocultaba desde 1180 px porque las categorías le disputaban el sitio en
       la barra. Ahora que viven en su propia tira, el logotipo cabe hasta donde
       empieza el móvil, que es donde toma el relevo .rs-navbar__brandword. */
    @media (max-width: 768px) { .rs-navbar__wordmark { display: none; } }

    /* La palabra "Doogking" junto al isotipo: solo en movil, donde la barra se
       queda con la "D" suelta. En escritorio el nombre lo pone el logotipo y la
       fila de categorias necesita todo el ancho. */
    .rs-navbar__brand .rs-navbar__brandword {
      display: none;
      font-family: var(--font-display);
      font-size: var(--f-lg);
      font-weight: var(--w-8);
      letter-spacing: -.02em;
      line-height: 1;
      color: var(--dk-blue);
      background: none;
      -webkit-text-fill-color: currentColor;
      white-space: nowrap;
    }
    @media (max-width: 768px) {
      .rs-navbar__brand .rs-navbar__brandword { display: inline; }
    }
    @media (max-width: 420px) {
      .rs-navbar__brand .rs-navbar__brandword { font-size: var(--f-base); }
    }

    /* Acceso a soporte: siempre visible, con o sin sesión */
    .rs-navbar__ayuda {
      display: inline-flex; align-items: center; justify-content: center;
      width: 34px; height: 34px; flex-shrink: 0;
      border: 1px solid var(--b-2); border-radius: 50%;
      color: var(--dk-blue); text-decoration: none;
      transition: background var(--d-2), border-color var(--d-2);
      &:hover { background: var(--c-accent-lo); border-color: var(--c-accent); }
    }

    /* "REGISTRA TU EMPRESA" con peso de botón (PDF 27/07 §1: más peso visual
       que idioma/moneda, referencia Booking WA0005). */
    .rs-navbar__link--pro {
      display: inline-flex; align-items: center; gap: var(--sp-2);
      font-family: var(--font-accent);
      font-size: var(--f-xs); font-weight: var(--w-7); letter-spacing: .06em;
      text-transform: uppercase; color: var(--c-accent);
      text-decoration: none; padding: var(--sp-2) var(--sp-3); white-space: nowrap;
      border: 1.5px solid var(--c-accent);
      border-radius: var(--r-md);
      transition: color var(--d-2), background var(--d-2);
      &:hover { color: var(--dk-blue-deep, var(--c-accent-h)); background: var(--c-accent-lo); }
    }
    @media (max-width: 900px) { .rs-navbar__link--pro { display: none; } }

    /* Idioma y moneda con menos peso (PDF 27/07 §1): secundarios frente a
       "Registra tu empresa" y "Mi cuenta". */
    .rs-navbar__actions rs-region-selector {
      opacity: .72;
      transition: opacity var(--d-2);
      &:hover, &:focus-within { opacity: 1; }
    }

    /* Account dropdown (desktop) */
    .rs-navbar__account { position: relative; }
    .rs-navbar__account-btn { display: inline-flex; align-items: center; gap: var(--sp-2); }
    .rs-navbar__avatar {
      position: relative;
      width: 22px; height: 22px; border-radius: 50%;
      background: rgba(255,255,255,.25); display: inline-flex; align-items: center; justify-content: center;
      font-size: 11px; font-weight: var(--w-7);
    }
    .rs-navbar__dot {
      position: absolute; top: -2px; right: -2px;
      width: 9px; height: 9px; border-radius: 50%;
      background: #EF4444; border: 1.5px solid var(--c-accent);
    }
    .rs-navbar__count {
      margin-left: auto; padding: 1px var(--sp-2);
      border-radius: var(--r-full); background: var(--c-raised); color: var(--t-300);
      font-size: var(--f-xs); font-weight: var(--w-6);
    }
    .rs-navbar__pill {
      margin-left: auto; padding: 2px var(--sp-2);
      border-radius: var(--r-full); background: rgba(251,174,23,.15); color: #B45309;
      font-size: 11px; font-weight: var(--w-6); white-space: nowrap;
    }
    .rs-navbar__dropdown-item--highlight { font-weight: var(--w-6); }
    .rs-navbar__dropdown-header {
      display: flex; flex-direction: column; gap: var(--sp-1);
      padding: var(--sp-2) var(--sp-3) var(--sp-1);
    }
    .rs-navbar__dropdown-name { font-size: var(--f-sm); font-weight: var(--w-7); color: var(--t-100); }
    .rs-navbar__verificado { align-self: flex-start; }
    .rs-navbar__dropdown-alpha { font-size: var(--f-xs); color: var(--t-400); font-weight: var(--w-5); }
    .rs-navbar__dropdown {
      position: absolute; top: calc(100% + 8px); right: 0; z-index: var(--z-3);
      min-width: 220px; padding: var(--sp-2);
      background: var(--c-card); border: 1px solid var(--b-1); border-radius: var(--r-xl);
      box-shadow: var(--shadow-lg, 0 12px 32px rgba(8,37,139,.12));
      display: flex; flex-direction: column; gap: 2px;
      animation: slideDown 160ms cubic-bezier(.4,0,.2,1) both;
    }
    .rs-navbar__dropdown-item {
      display: flex; align-items: center; gap: var(--sp-3);
      /* Menú compacto y premium: menos aire vertical que el resto de listas
         del producto, con separadores que agrupan (TCK-8029). */
      padding: var(--sp-2) var(--sp-3); width: 100%;
      font-size: var(--f-sm); font-weight: var(--w-5); color: var(--t-200);
      background: transparent; border: none; border-radius: var(--r-lg);
      text-decoration: none; cursor: pointer; text-align: left;
      transition: all var(--d-1);
      &:hover { background: var(--c-raised); color: var(--t-100); }
    }
    .rs-navbar__dropdown-item--danger { color: var(--c-red, #B91C1C); &:hover { color: var(--c-red, #B91C1C); } }
    .rs-navbar__dropdown-item--action { color: var(--c-accent); font-weight: var(--w-6); }
    .rs-navbar__dropdown-divider { height: 1px; background: var(--b-1); margin: var(--sp-1) 0; }

    /* Cuenta y hamburguesa: sólo en móvil */
    .rs-navbar__cuenta {
      display: none;
      position: relative;
      align-items: center;
      justify-content: center;
      width: 40px;
      height: 40px;
      margin-left: auto;
      background: transparent;
      border: 1px solid var(--b-1);
      border-radius: var(--r-full);
      color: var(--t-200);
      text-decoration: none;
      flex-shrink: 0;
      transition: background var(--d-2), color var(--d-2), border-color var(--d-2);
      &:hover { background: var(--c-accent-lo); border-color: var(--c-accent); color: var(--dk-blue); }
    }
    /* Con sesión, las iniciales sustituyen al icono, como en el botón de escritorio. */
    .rs-navbar__cuenta-ini {
      font-size: var(--f-xs); font-weight: var(--w-7); color: var(--dk-blue);
    }
    /* Sobre fondo claro el punto se recorta con el color de la barra, no con el del botón azul. */
    .rs-navbar__cuenta-dot {
      position: absolute; top: 1px; right: 1px;
      width: 9px; height: 9px; border-radius: 50%;
      background: #EF4444; border: 1.5px solid var(--c-card);
    }

    /* Hamburger: hidden on desktop */
    .rs-navbar__hamburger {
      display: none;
      align-items: center;
      justify-content: center;
      width: 40px;
      height: 40px;
      background: transparent;
      border: 1px solid var(--b-1);
      border-radius: var(--r-lg);
      color: var(--t-200);
      cursor: pointer;
      transition: all var(--d-2);
      flex-shrink: 0;
      &:hover { background: var(--c-raised); color: var(--t-100); }
    }

    @media (max-width: 768px) {
      /* El margen automático lo lleva la cuenta, que es el primero de los
         dos: así el par queda junto contra el borde derecho. */
      .rs-navbar__cuenta { display: inline-flex; }
      .rs-navbar__hamburger { display: flex; }
    }

    /* Mobile drawer */
    .rs-mobile-menu {
      position: fixed;
      /* El alto real de la barra, no 64 px pelados: dentro de la app la barra
         crece lo que ocupe la barra de estado del sistema, y con el valor fijo
         el panel arrancaba por encima de ella y le tapaba el borde. */
      top: var(--dk-navbar-h);
      left: 0;
      right: 0;
      z-index: calc(var(--z-3) - 1);
      background: rgba(255,255,255,.97);
      backdrop-filter: blur(20px) saturate(180%);
      -webkit-backdrop-filter: blur(20px) saturate(180%);
      border-bottom: 1px solid var(--b-1);
      padding: var(--sp-4) var(--sp-5) var(--sp-6);
      animation: slideDown 200ms cubic-bezier(.4,0,.2,1) both;
      /*
       * El menú está posicionado fixed, así que no acompaña al scroll de la
       * página: sin altura máxima propia, en un móvil corto (568px) las últimas
       * entradas quedaban fuera de pantalla y no había forma de llegar a ellas.
       * La unidad dvh además descuenta la barra del navegador móvil.
       */
      max-height: calc(100dvh - var(--dk-navbar-h));
      overflow-y: auto;
      overscroll-behavior: contain;
      -webkit-overflow-scrolling: touch;
    }

    @keyframes slideDown {
      from { opacity: 0; transform: translateY(-8px); }
      to   { opacity: 1; transform: translateY(0); }
    }

    .rs-mobile-menu__nav {
      display: flex;
      flex-direction: column;
      gap: var(--sp-1);
    }

    .rs-mobile-menu__link {
      display: flex;
      align-items: center;
      gap: var(--sp-3);
      padding: var(--sp-3) var(--sp-3);
      font-size: var(--f-base);
      font-weight: var(--w-5);
      color: var(--t-200);
      border-radius: var(--r-lg);
      text-decoration: none;
      transition: all var(--d-1);
      &:hover { background: var(--c-raised); color: var(--t-100); }
    }
    .rs-mobile-menu__link--active { background: var(--c-raised); color: var(--t-100); }

    .rs-mobile-menu__divider {
      height: 1px;
      background: var(--b-1);
      margin: var(--sp-4) 0;
    }

    .rs-mobile-menu__actions {
      display: flex;
      flex-direction: column;
      gap: var(--sp-3);
    }
  `],
})
export class RsNavbarComponent implements OnInit {
  readonly authService = inject(AuthService);
  private readonly perrosService = inject(PerrosService);
  private readonly reservasService = inject(ReservasService);
  private readonly reviewsService = inject(ReviewsService);
  private readonly alphaService = inject(AlphaService);
  readonly favoritosService = inject(FavoritosService);

  /** Menú de categorías: misma fuente que el buscador y las vistas. */
  readonly verticales = VERTICALES_PUBLICOS;

  readonly estaAutenticado = this.authService.estaAutenticado;
  readonly esAdmin = this.authService.esAdmin;
  readonly esComercio = this.authService.esComercio;
  readonly esCliente = this.authService.esCliente;
  readonly clienteVerificado = this.authService.clienteVerificado;

  /**
   * El desplegable es la identidad personal: si la cuenta no tiene nombre se
   * rotula "Mi cuenta" antes que arriesgarse a mostrar el del negocio (TCK-8029).
   */
  readonly nombreCuenta = computed(() => this.authService.usuario()?.nombre?.trim() || 'Mi cuenta');
  readonly menuAbierto = signal(false);
  readonly cuentaAbierto = signal(false);

  /** Contadores del desplegable "Mi cuenta" (HU-12.3). */
  readonly numMascotas = signal(0);
  readonly numResenas = signal(0);
  readonly tieneReservaProxima = signal(false);
  readonly tienePendientesResena = signal(false);
  readonly tieneAvisoPendiente = computed(() => this.tieneReservaProxima() || this.tienePendientesResena());

  /** Nivel Alpha del cliente para la cabecera del desplegable (HU-12.1/12.2). */
  readonly alpha = signal<AlphaEstadoApi | null>(null);

  /** Nivel en numeración romana aunque la BD guarde el formato antiguo (TCK-8011). */
  nombreAlpha(estado: AlphaEstadoApi): string {
    return nombreAlphaPresentacion(estado.nombreNivel, estado.nivelActual);
  }

  readonly logoD = BRAND.logoD;

  /**
   * Oculta el logotipo completo y deja solo la "D". La home lo activa porque el
   * logotipo grande ya está en el hero y el pequeño quedaba duplicado (PDF §1).
   */
  readonly soloMarcaD = input(false);

  /**
   * El alta de comercio es la vía principal de captación de oferta: se muestra
   * a quien no ha entrado y también al cliente logueado, no solo a los visitantes.
   */
  readonly muestraAltaComercio = computed(() => !this.esComercio() && !this.esAdmin());

  /**
   * Las categorias de servicio son navegacion de cliente: quien entra como
   * comercio o como administrador gestiona su panel, no reserva servicios, y
   * esas entradas solo le ensucian la barra (escritorio y movil).
   */
  readonly muestraCategorias = computed(() => !this.esComercio() && !this.esAdmin());

  readonly iniciales = computed(() => {
    const nombre = this.authService.usuario()?.nombre ?? '';
    // Sin nombre no hay iniciales: la plantilla cae al icono de huella (TCK-8010).
    return nombre.split(' ').map(p => p[0]).slice(0, 2).join('').toUpperCase();
  });

  ngOnInit(): void {
    if (!this.estaAutenticado()) return;
    // El navbar se embebe en casi todas las páginas: un fallo aquí (API caída,
    // mock de test incompleto) no puede tirar abajo el resto de la pantalla.
    try {
      void this.favoritosService.cargarIds();
    } catch { /* noop */ }
    try {
      this.perrosService.misPerros().then(
        (perros) => this.numMascotas.set(perros.length),
        () => this.numMascotas.set(0),
      );
    } catch { this.numMascotas.set(0); }
    try {
      this.reservasService.proximaReserva().then(
        (proxima) => this.tieneReservaProxima.set(!!proxima),
        () => this.tieneReservaProxima.set(false),
      );
    } catch { this.tieneReservaProxima.set(false); }
    try {
      const usuarioId = this.authService.usuario()?.id;
      if (usuarioId) {
        this.reviewsService.misResenas(usuarioId).then(
          (resenas) => this.numResenas.set(resenas.length),
          () => this.numResenas.set(0),
        );
      }
    } catch { this.numResenas.set(0); }
    try {
      this.reviewsService.pendientesDeValorar().then(
        (pendientes) => this.tienePendientesResena.set(pendientes.length > 0),
        () => this.tienePendientesResena.set(false),
      );
    } catch { this.tienePendientesResena.set(false); }
    // Alpha es fidelización de quien reserva: no se consulta siquiera para
    // cuentas de comercio o de administración (TCK-8029).
    if (!this.esCliente()) return;
    try {
      this.alphaService.miEstado().then(
        (estado) => this.alpha.set(estado),
        () => this.alpha.set(null),
      );
    } catch { this.alpha.set(null); }
  }

  /** Cierra el desplegable de cuenta al hacer clic fuera de él. */
  @HostListener('document:click')
  cerrarDropdownCuenta(): void {
    this.cuentaAbierto.set(false);
  }

  cerrarSesion(): void {
    this.menuAbierto.set(false);
    this.cuentaAbierto.set(false);
    this.authService.logout();
  }
}
