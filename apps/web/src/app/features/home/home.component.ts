import { Component, computed, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { FormBuilder, ReactiveFormsModule, FormControl } from '@angular/forms';
import { toSignal } from '@angular/core/rxjs-interop';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { VerticalKey, VERTICAL_LABELS } from 'shared';
import { AnimateOnScrollDirective } from '../../shared/directives/animate-on-scroll.directive';
import { ImgFallbackDirective } from '../../shared/directives/img-fallback.directive';
import { RsNavbarComponent } from '../../shared/components/navbar/rs-navbar.component';
import { RsIconComponent } from '../../shared/components/icon/rs-icon.component';
import { BRAND, CATEGORIA_ICONOS, HOTEL_IMAGES, TRUST_ICONOS } from '../../shared/media/images';
import { environment } from '../../../environments/environment';

/** Ruta de navegación de cada categoría canina. */
const VERTICAL_ROUTES: Record<string, string> = {
  alojamiento: '/alojamiento',
  transporte: '/transporte',
  veterinaria: '/veterinaria',
  peluqueria: '/peluqueria',
  adiestramiento: '/adiestramiento',
  hoteles: '/hoteles',
};

/** Categorías que se reservan por noches (entrada/salida) y no por cita. */
const VERTICALES_POR_NOCHES: readonly string[] = [VerticalKey.ALOJAMIENTO, VerticalKey.HOTELES];

interface Vertical {
  key: VerticalKey;
  icon: string;
  label: string;
  /** Etiqueta corta para la fila de categorías del buscador. */
  labelCorto: string;
  route: string;
  /** Icono SVG de la categoría (public/icons). */
  icono: string;
  /** Gancho comercial mostrado en la tarjeta de categoría. */
  claim: string;
}

interface AlojamientoRecomendado {
  ciudad: string;
  nombre: string;
  estrellas: number;
  score: number;
  scoreLabel: string;
  numResenas: number;
  precioPorNoche: number;
  imagen: string;
  tags: string[];
}

interface Ciudad {
  nombre: string;
  servicios: number;
  imagen: string;
}

/** Respuesta del asistente de búsqueda con IA (`POST /ai-search`). */
interface AiSearchResult {
  vertical: string | null;
  ciudad: string | null;
  desde: string | null;
  hasta: string | null;
  extras?: Record<string, string>;
}

type SearchMode = 'filtros' | 'ia';

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [RouterLink, ReactiveFormsModule, AnimateOnScrollDirective, ImgFallbackDirective, RsNavbarComponent, RsIconComponent],
  template: `
<div class="home">
  <rs-navbar />

  <!-- ═══ HERO + BUSCADOR ═════════════════════════════════════════ -->
  <section class="hero">
    <div class="hero__navy" aria-hidden="true"></div>

    <div class="hero__inner rs-wrap rs-wrap--2xl">
      <div class="hero__brand">
        <img [src]="logoMark" alt="Doogking" class="hero__logo" fetchpriority="high" />
        <h1 class="hero__title">
          <span class="hero__title-line hero__title-line--blue">
            <i class="hero__dash" aria-hidden="true"></i>
            Todo para su rey
            <i class="hero__dash" aria-hidden="true"></i>
          </span>
          <span class="hero__title-line hero__title-line--gold">en un solo lugar</span>
        </h1>
      </div>

      <!-- Panel de búsqueda (estilo Booking: categorías + filtros en una fila) -->
      <div class="searchbox" role="search">
        <div class="searchbox__head">
          <p class="searchbox__question">¿Qué servicio necesitas?</p>
          <div class="searchbox__modes" role="tablist" aria-label="Modo de búsqueda">
            <button type="button" class="searchbox__mode" role="tab"
                    [class.is-active]="searchMode() === 'filtros'"
                    [attr.aria-selected]="searchMode() === 'filtros'"
                    (click)="searchMode.set('filtros')">
              <rs-icon name="search" [size]="14" [stroke]="2.25"></rs-icon>
              Filtros
            </button>
            <button type="button" class="searchbox__mode" role="tab"
                    [class.is-active]="searchMode() === 'ia'"
                    [attr.aria-selected]="searchMode() === 'ia'"
                    (click)="searchMode.set('ia')">
              <rs-icon name="sparkles" [size]="14" [stroke]="2"></rs-icon>
              Buscar con IA
            </button>
          </div>
        </div>

        <!-- Fila de categorías con iconos -->
        <div class="cat-row" role="tablist" aria-label="Categorías de servicio">
          @for (v of verticales; track v.key) {
            <button type="button" class="cat-row__item" role="tab"
                    [class.is-active]="verticalActivo() === v.key"
                    [attr.aria-selected]="verticalActivo() === v.key"
                    (click)="seleccionarVertical(v.key)">
              <img [src]="v.icono" [alt]="''" class="cat-row__icon" aria-hidden="true" />
              <span class="cat-row__label">{{ v.labelCorto }}</span>
            </button>
          }
          <a routerLink="/buscador" class="cat-row__item cat-row__item--more">
            <img [src]="iconoMas" alt="" class="cat-row__icon" aria-hidden="true" />
            <span class="cat-row__label">Más servicios</span>
          </a>
        </div>

        @if (searchMode() === 'filtros') {
          <form class="sf" [formGroup]="searchForm" (ngSubmit)="onBuscar()">
            <div class="sf__field sf__field--where">
              <label class="sf__lbl" for="home-ciudad">{{ labelUbicacion() }}</label>
              <div class="sf__ctrl">
                <rs-icon name="map-pin" [size]="18" [stroke]="2"></rs-icon>
                <input id="home-ciudad" formControlName="ciudad" class="sf__inp"
                       placeholder="Ciudad, zona o dirección" autocomplete="off" />
              </div>
            </div>

            <div class="sf__field">
              <label class="sf__lbl" for="home-desde">{{ labelFechaInicio() }}</label>
              <div class="sf__ctrl">
                <rs-icon name="calendar" [size]="18" [stroke]="2"></rs-icon>
                <input id="home-desde" formControlName="fechaInicio" type="date" class="sf__inp" />
              </div>
            </div>

            @if (reservaPorNoches()) {
              <div class="sf__field">
                <label class="sf__lbl" for="home-hasta">Salida</label>
                <div class="sf__ctrl">
                  <rs-icon name="calendar" [size]="18" [stroke]="2"></rs-icon>
                  <input id="home-hasta" formControlName="fechaFin" type="date" class="sf__inp" />
                </div>
              </div>
            } @else {
              <div class="sf__field">
                <label class="sf__lbl" for="home-hora">Hora</label>
                <div class="sf__ctrl">
                  <rs-icon name="calendar" [size]="18" [stroke]="2"></rs-icon>
                  <select id="home-hora" formControlName="hora" class="sf__inp sf__inp--select">
                    <option value="">Cualquiera</option>
                    @for (h of horas; track h) { <option [value]="h">{{ h }}</option> }
                  </select>
                </div>
              </div>
            }

            <div class="sf__field sf__field--pets">
              <label class="sf__lbl" for="home-perros">Mascotas</label>
              <div class="sf__ctrl">
                <rs-icon name="paw" [size]="18" [stroke]="2"></rs-icon>
                <select id="home-perros" formControlName="perros" class="sf__inp sf__inp--select">
                  @for (n of [1,2,3,4]; track n) {
                    <option [value]="n">{{ n }} {{ n === 1 ? 'perro' : 'perros' }}</option>
                  }
                </select>
              </div>
            </div>

            <button type="submit" class="rs-btn rs-btn--gold rs-btn--lg sf__cta">
              <rs-icon name="search" [size]="18" [stroke]="2.5"></rs-icon>
              <span>Buscar</span>
            </button>
          </form>
        } @else {
          <form class="ai" (ngSubmit)="buscarConIA()">
            <div class="ai__bar" [class.is-loading]="aiLoading()">
              <rs-icon name="sparkles" [size]="20" [stroke]="1.75" class="ai__spark"></rs-icon>
              <input class="ai__input" [formControl]="aiQuery"
                     placeholder="Describe lo que necesitas… «Alojamiento en Madrid para mi golden este finde»"
                     aria-label="Búsqueda con inteligencia artificial" />
              <button type="submit" class="rs-btn rs-btn--gold ai__btn"
                      aria-label="Buscar con IA"
                      [disabled]="aiLoading() || !aiQuery.value.trim()">
                @if (aiLoading()) {
                  <span class="ai__spinner"></span>
                } @else {
                  <rs-icon name="arrow-right" [size]="18" [stroke]="2.5"></rs-icon>
                }
              </button>
            </div>

            <div class="ai__hints">
              <span class="ai__hint-label">Prueba:</span>
              @for (s of sugerenciasIA; track s) {
                <button type="button" class="ai__chip" (click)="usarSugerencia(s)">{{ s }}</button>
              }
            </div>

            @if (aiError()) {
              <p class="ai__error">{{ aiError() }}</p>
            }
          </form>
        }
      </div>

      <!-- Garantías sobre la franja navy -->
      <div class="trust">
        @for (t of garantias; track t.titulo) {
          <div class="trust__item">
            <img [src]="t.icono" alt="" class="trust__icon" aria-hidden="true" />
            <p class="trust__text">{{ t.titulo }}<br />{{ t.detalle }}</p>
          </div>
        }
      </div>
    </div>
  </section>

  <!-- ═══ CATEGORÍAS ══════════════════════════════════════════════ -->
  <section class="rs-section rs-section--sm cats-section">
    <div class="rs-wrap rs-wrap--2xl">
      <div class="sec-head" rsAnim>
        <div>
          <h2 class="rs-h3">Explora por categoría</h2>
          <p>Todo lo que necesita tu perro, reservable online y con pago seguro.</p>
        </div>
        <a routerLink="/buscador" class="sec-head__link">
          Ver todo <rs-icon name="arrow-right" [size]="15" [stroke]="2"></rs-icon>
        </a>
      </div>

      <div class="cats-grid" rsAnim>
        @for (v of verticales; track v.key) {
          <a class="cat-card" [routerLink]="v.route">
            <span class="cat-card__art">
              <img [src]="v.icono" alt="" class="cat-card__icon" aria-hidden="true" />
            </span>
            <span class="cat-card__body">
              <span class="cat-card__title">{{ v.label }}</span>
              <span class="cat-card__claim">{{ v.claim }}</span>
            </span>
            <rs-icon name="arrow-right" [size]="18" [stroke]="2" class="cat-card__go"></rs-icon>
          </a>
        }
      </div>
    </div>
  </section>

  <!-- ═══ CIUDADES ════════════════════════════════════════════════ -->
  <section class="rs-section rs-section--sm cities-section">
    <div class="rs-wrap rs-wrap--2xl">
      <div class="sec-head" rsAnim>
        <div>
          <h2 class="rs-h3">Servicios cerca de ti</h2>
          <p>Las ciudades con más profesionales caninos verificados de Doogking.</p>
        </div>
      </div>

      <div class="cities-grid" rsAnim>
        @for (c of ciudades; track c.nombre) {
          <a class="city-card" routerLink="/buscador" [queryParams]="{ ciudad: c.nombre }">
            <img [src]="c.imagen" [alt]="c.nombre" loading="lazy" rsImg />
            <span class="city-card__veil"></span>
            <span class="city-card__meta">
              <strong>{{ c.nombre }}</strong>
              <em>{{ c.servicios }} servicios</em>
            </span>
          </a>
        }
      </div>
    </div>
  </section>

  <!-- ═══ ALOJAMIENTOS RECOMENDADOS ═══════════════════════════════ -->
  <section class="rs-section rs-section--sm recommended-section">
    <div class="rs-wrap rs-wrap--2xl">
      <div class="sec-head" rsAnim>
        <div>
          <h2 class="rs-h3">Alojamientos recomendados</h2>
          <p>Residencias caninas mejor valoradas por otros dueños este mes.</p>
        </div>
        <a routerLink="/alojamiento" class="sec-head__link">
          Ver todos <rs-icon name="arrow-right" [size]="15" [stroke]="2"></rs-icon>
        </a>
      </div>

      <div class="stays-grid">
        @for (a of alojamientosRecomendados; track a.nombre) {
          <article class="stay-card" [rsAnim]="''" [rsAnimDelay]="$index * 70">
            <div class="stay-card__img">
              <img [src]="a.imagen" [alt]="a.nombre" loading="lazy" rsImg />
              <span class="rs-badge rs-badge--accent stay-card__badge">
                <rs-icon name="crown" [size]="12" [stroke]="2"></rs-icon>
                Recomendado
              </span>
            </div>
            <div class="stay-card__body">
              <div class="stay-card__stars" aria-hidden="true">{{ estrellas(a.estrellas) }}</div>
              <h3 class="stay-card__name">{{ a.nombre }}</h3>
              <p class="stay-card__loc">
                <rs-icon name="map-pin" [size]="13" [stroke]="2"></rs-icon>
                {{ a.ciudad }}
              </p>
              <div class="stay-card__tags">
                @for (t of a.tags; track t) { <span class="stay-card__tag">{{ t }}</span> }
              </div>
              <div class="stay-card__footer">
                <div class="stay-card__rating">
                  <span class="stay-card__score">{{ a.score }}</span>
                  <span class="stay-card__score-meta">{{ a.scoreLabel }} · {{ a.numResenas }} reseñas</span>
                </div>
                <div class="stay-card__price">
                  <span class="stay-card__amount">€{{ a.precioPorNoche }}</span>
                  <span class="stay-card__period">/noche</span>
                </div>
              </div>
              <a routerLink="/alojamiento" [queryParams]="{ ciudad: a.ciudad }"
                 class="rs-btn rs-btn--primary rs-btn--block stay-card__cta">
                Ver alojamiento
              </a>
            </div>
          </article>
        }
      </div>
    </div>
  </section>

  <!-- ═══ CÓMO FUNCIONA ═══════════════════════════════════════════ -->
  <section class="rs-section rs-section--sm how-section">
    <div class="rs-wrap rs-wrap--lg">
      <div class="sec-head sec-head--center" rsAnim>
        <div>
          <h2 class="rs-h3">Reservar es así de fácil</h2>
          <p>Tres pasos y tu perro tiene plaza. Sin llamadas ni esperas.</p>
        </div>
      </div>

      <ol class="how-grid" rsAnim>
        @for (p of pasos; track p.titulo) {
          <li class="how-step">
            <span class="how-step__num">{{ $index + 1 }}</span>
            <rs-icon [name]="p.icon" [size]="26" [stroke]="1.9" class="how-step__icon"></rs-icon>
            <h3 class="how-step__title">{{ p.titulo }}</h3>
            <p class="how-step__text">{{ p.texto }}</p>
          </li>
        }
      </ol>
    </div>
  </section>

  <!-- ═══ CTA COMERCIOS ═══════════════════════════════════════════ -->
  <section class="pro-cta">
    <div class="rs-wrap rs-wrap--lg pro-cta__inner" rsAnim>
      <div>
        <p class="pro-cta__eyebrow">Para profesionales</p>
        <h2 class="pro-cta__title">¿Tienes un negocio canino?</h2>
        <p class="pro-cta__text">
          Publica tus servicios en Doogking, gestiona tu disponibilidad y recibe
          reservas pagadas online. Sin cuota de alta: solo comisión por reserva.
        </p>
      </div>
      <a routerLink="/auth/registro-comercio" class="rs-btn rs-btn--gold rs-btn--lg">
        Registrar mi negocio
        <rs-icon name="arrow-right" [size]="17" [stroke]="2.25"></rs-icon>
      </a>
    </div>
  </section>

  <!-- ═══ FOOTER ═══════════════════════════════════════════════════ -->
  <footer class="rs-footer home-footer">
    <div class="rs-footer__grid">
      <div class="rs-footer__brand">
        <img [src]="logoFooter" alt="Doogking" class="home-footer__logo" />
        <p>El marketplace de servicios caninos en España. Alojamiento, transporte, veterinarios, peluquería y adiestramiento para tu perro.</p>
      </div>
      <div class="rs-footer__col">
        <h4>Servicios</h4>
        <ul>
          @for (v of verticales; track v.key) {
            <li><a [routerLink]="v.route">{{ v.label }}</a></li>
          }
        </ul>
      </div>
      <div class="rs-footer__col">
        <h4>Descubre</h4>
        <ul>
          <li><a routerLink="/buscador">Buscador</a></li>
          <li><a routerLink="/buscador" [queryParams]="{ tipo: 'playas' }">Playas caninas</a></li>
          <li><a routerLink="/buscador" [queryParams]="{ tipo: 'parques' }">Parques caninos</a></li>
          <li><a routerLink="/hoteles">Hoteles pet friendly</a></li>
        </ul>
      </div>
      <div class="rs-footer__col">
        <h4>Empresas</h4>
        <ul>
          <li><a routerLink="/auth/registro-comercio">Registrar negocio</a></li>
          <li><a routerLink="/auth/registro-comercio">Tarifas profesionales</a></li>
          <li><a routerLink="/auth/registro-comercio">Ventajas de Doogking</a></li>
          <li><a routerLink="/ayuda">Centro de ayuda</a></li>
          <li><a routerLink="/contacto">Contacto</a></li>
        </ul>
      </div>
      <div class="rs-footer__col">
        <h4>Legal</h4>
        <ul>
          <li><a routerLink="/privacidad">Privacidad</a></li>
          <li><a routerLink="/terminos">Términos</a></li>
          <li><a routerLink="/cookies">Cookies</a></li>
        </ul>
      </div>
    </div>
    <div class="rs-footer__bottom">
      <p>© 2026 Doogking · Todos los derechos reservados</p>
      <div class="rs-flex rs-gap-4" style="flex-wrap:wrap">
        <span class="rs-badge rs-badge--neutral home-footer__badge">🔒 Pago seguro Stripe</span>
        <span class="rs-badge rs-badge--neutral home-footer__badge">✅ Empresas verificadas</span>
      </div>
    </div>
  </footer>
</div>
  `,
  styles: [`
    :host { display: block; }

    /* ══ HERO ═══════════════════════════════════════════════════════
       Réplica de la línea gráfica de marca: bloque blanco con el logo y
       el eslogan, buscador flotante y franja navy curva con garantías. */
    .hero {
      position: relative;
      background: var(--c-card);
      padding-block: var(--sp-12) 0;
      overflow: hidden;
    }

    /* Franja navy curva que asoma por detrás del buscador */
    .hero__navy {
      position: absolute;
      left: 50%;
      transform: translateX(-50%);
      bottom: 0;
      width: 160%;
      height: 300px;
      background: var(--dk-blue-deep);
      border-radius: 50% 50% 0 0 / 90px 90px 0 0;

      @media (max-width: 900px) { height: 420px; border-radius: 50% 50% 0 0 / 50px 50px 0 0; }
    }

    .hero__inner { position: relative; z-index: 1; }

    .hero__brand {
      text-align: center;
      animation: fadeUp .6s ease both;
      margin-bottom: var(--sp-10);
    }

    .hero__logo {
      width: min(420px, 72vw);
      height: auto;
      margin-inline: auto;
      margin-bottom: var(--sp-4);
    }

    .hero__title {
      font-family: var(--font-accent);
      font-weight: var(--w-7);
      text-transform: uppercase;
      letter-spacing: .01em;
      line-height: 1.22;
      font-size: clamp(1.25rem, 3.4vw, 2.1rem);
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: var(--sp-1);
    }

    .hero__title-line {
      display: inline-flex;
      align-items: center;
      gap: var(--sp-4);
    }
    .hero__title-line--blue { color: var(--dk-blue); }
    .hero__title-line--gold { color: var(--dk-gold); }

    .hero__dash {
      display: inline-block;
      width: clamp(20px, 4vw, 42px);
      height: 4px;
      border-radius: var(--r-full);
      background: var(--dk-gold);
    }

    /* ══ BUSCADOR (tarjeta flotante estilo Booking) ═════════════════ */
    .searchbox {
      background: var(--c-card);
      border: 1px solid var(--b-1);
      border-radius: var(--r-2xl);
      box-shadow: var(--sh-xl);
      padding: var(--sp-6) var(--sp-6) var(--sp-5);
      animation: fadeUp .6s .1s ease both;
    }

    .searchbox__head {
      display: flex;
      align-items: center;
      justify-content: space-between;
      flex-wrap: wrap;
      gap: var(--sp-3);
      margin-bottom: var(--sp-4);
    }

    .searchbox__question {
      font-family: var(--font-display);
      font-size: var(--f-lg);
      font-weight: var(--w-7);
      color: var(--dk-blue);
    }

    .searchbox__modes {
      display: inline-flex;
      gap: var(--sp-1);
      padding: 3px;
      background: var(--c-surface);
      border-radius: var(--r-full);
    }

    .searchbox__mode {
      display: inline-flex;
      align-items: center;
      gap: var(--sp-2);
      padding: var(--sp-2) var(--sp-4);
      border-radius: var(--r-full);
      font-size: var(--f-sm);
      font-weight: var(--w-6);
      color: var(--t-400);
      transition: background var(--d-2), color var(--d-2);

      &:hover { color: var(--dk-blue); }
      &.is-active { background: var(--c-card); color: var(--dk-blue); box-shadow: var(--sh-sm); }
    }

    /* Fila de categorías con iconos SVG de marca */
    .cat-row {
      display: flex;
      align-items: stretch;
      gap: var(--sp-2);
      overflow-x: auto;
      padding-bottom: var(--sp-4);
      margin-bottom: var(--sp-4);
      border-bottom: 1px solid var(--b-1);
      scrollbar-width: thin;
    }

    .cat-row__item {
      flex: 1 0 auto;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: flex-start;
      gap: var(--sp-2);
      min-width: 96px;
      padding: var(--sp-3) var(--sp-3) var(--sp-2);
      border-radius: var(--r-md);
      border: 1px solid transparent;
      background: transparent;
      color: var(--t-300);
      text-align: center;
      transition: background var(--d-2), border-color var(--d-2), color var(--d-2), transform var(--d-2);

      &:hover { background: var(--c-accent-lo); color: var(--dk-blue); transform: translateY(-2px); }

      &.is-active {
        border-color: rgba(8,37,139,.22);
        background: var(--c-accent-lo);
        color: var(--dk-blue);
        box-shadow: inset 0 -3px 0 var(--dk-gold);
      }
    }

    .cat-row__icon { width: 34px; height: 34px; }

    .cat-row__label {
      font-size: var(--f-xs);
      font-weight: var(--w-6);
      line-height: 1.25;
      letter-spacing: .01em;
    }

    /* Fila de filtros — celdas contiguas, CTA dorado (patrón Booking) */
    .sf {
      display: flex;
      align-items: stretch;
      gap: var(--sp-3);
      flex-wrap: wrap;
    }

    .sf__field {
      flex: 1 1 150px;
      min-width: 0;
      display: flex;
      flex-direction: column;
      justify-content: center;
      gap: 2px;
      border: 1px solid var(--b-2);
      border-radius: var(--r-md);
      padding: var(--sp-2) var(--sp-4);
      background: var(--c-card);
      transition: border-color var(--d-2), box-shadow var(--d-2);

      &:focus-within {
        border-color: var(--c-accent);
        box-shadow: 0 0 0 3px var(--c-accent-lo);
      }
    }

    .sf__field--where { flex: 2 1 240px; }
    .sf__field--pets  { flex: .9 1 140px; }

    .sf__lbl {
      font-family: var(--font-accent);
      font-size: var(--f-xs);
      font-weight: var(--w-7);
      letter-spacing: .06em;
      text-transform: uppercase;
      color: var(--dk-blue);
    }

    .sf__ctrl {
      display: flex;
      align-items: center;
      gap: var(--sp-2);
      color: var(--t-400);
    }

    .sf__inp {
      flex: 1;
      min-width: 0;
      border: none;
      outline: none;
      background: transparent;
      padding-block: 2px;
      font-family: var(--font);
      font-size: var(--f-base);
      color: var(--t-100);

      &::placeholder { color: var(--t-500); }
    }

    .sf__inp--select { cursor: pointer; }

    .sf__cta {
      flex: 0 0 auto;
      min-width: 148px;
      font-size: var(--f-md);
      font-weight: var(--w-7);
    }

    @media (max-width: 860px) {
      .sf__field { flex: 1 1 100%; }
      .sf__cta { width: 100%; }
    }

    /* Modo IA */
    .ai__bar {
      display: flex;
      align-items: center;
      gap: var(--sp-3);
      border: 1px solid var(--b-2);
      border-radius: var(--r-full);
      padding: var(--sp-2) var(--sp-2) var(--sp-2) var(--sp-5);
      transition: box-shadow var(--d-2), border-color var(--d-2);

      &:focus-within { border-color: var(--c-accent); box-shadow: 0 0 0 3px var(--c-accent-lo); }
      &.is-loading { opacity: .75; }

      @media (max-width: 480px) { border-radius: var(--r-lg); }
    }

    .ai__spark { color: var(--dk-gold); flex-shrink: 0; }

    .ai__input {
      flex: 1;
      min-width: 0;
      border: none;
      outline: none;
      background: transparent;
      padding-block: var(--sp-3);
      font-family: var(--font);
      font-size: var(--f-base);
      color: var(--t-100);

      &::placeholder { color: var(--t-500); }
    }

    .ai__btn {
      flex: 0 0 auto;
      width: 48px;
      height: 48px;
      padding: 0;
      border-radius: var(--r-full);
    }

    .ai__spinner {
      width: 18px;
      height: 18px;
      border-radius: 50%;
      border: 2px solid rgba(0,19,93,.25);
      border-top-color: var(--dk-blue-deep);
      animation: spin .7s linear infinite;
    }

    .ai__hints {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: var(--sp-2);
      margin-top: var(--sp-3);
    }

    .ai__hint-label { font-size: var(--f-xs); color: var(--t-400); }

    .ai__chip {
      background: var(--c-surface);
      border: 1px solid var(--b-1);
      color: var(--t-300);
      border-radius: var(--r-full);
      padding: var(--sp-1) var(--sp-3);
      font-size: var(--f-xs);
      transition: background var(--d-2), color var(--d-2);

      &:hover { background: var(--c-accent-lo); color: var(--dk-blue); }
    }

    .ai__error { margin-top: var(--sp-3); font-size: var(--f-sm); color: #B91C1C; }

    /* Garantías sobre la franja navy */
    .trust {
      display: flex;
      justify-content: center;
      align-items: center;
      flex-wrap: wrap;
      gap: var(--sp-6) var(--sp-10);
      padding-block: var(--sp-8) var(--sp-10);
    }

    .trust__item {
      display: flex;
      align-items: center;
      gap: var(--sp-3);

      & + & { border-left: 1px solid rgba(255,255,255,.22); padding-left: var(--sp-10); }

      @media (max-width: 900px) {
        & + & { border-left: none; padding-left: 0; }
      }
    }

    .trust__icon { width: 38px; height: 38px; flex-shrink: 0; }

    .trust__text {
      font-family: var(--font-accent);
      font-size: var(--f-sm);
      font-weight: var(--w-7);
      line-height: 1.35;
      color: #fff;
    }

    /* ══ CABECERAS DE SECCIÓN ═══════════════════════════════════════ */
    .sec-head {
      display: flex;
      align-items: flex-end;
      justify-content: space-between;
      gap: var(--sp-4);
      flex-wrap: wrap;
      margin-bottom: var(--sp-8);

      h2 { color: var(--dk-blue); margin-bottom: var(--sp-2); }
      p  { color: var(--t-400); font-size: var(--f-md); }
    }

    .sec-head--center {
      justify-content: center;
      text-align: center;

      p { max-width: 46ch; margin-inline: auto; }
    }

    .sec-head__link {
      display: inline-flex;
      align-items: center;
      gap: var(--sp-2);
      font-size: var(--f-sm);
      font-weight: var(--w-6);
      color: var(--dk-blue);

      &:hover { color: var(--dk-blue-deep); text-decoration: underline; }
    }

    /* ══ CATEGORÍAS ═════════════════════════════════════════════════ */
    .cats-section { background: var(--c-base); }

    .cats-grid {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: var(--sp-5);

      @media (max-width: 1024px) { grid-template-columns: repeat(2, 1fr); }
      @media (max-width: 620px)  { grid-template-columns: 1fr; }
    }

    .cat-card {
      display: flex;
      align-items: center;
      gap: var(--sp-4);
      background: var(--c-card);
      border: 1px solid var(--b-1);
      border-radius: var(--r-xl);
      padding: var(--sp-5);
      box-shadow: var(--sh-card);
      transition: transform var(--d-2), box-shadow var(--d-2), border-color var(--d-2);

      &:hover {
        transform: translateY(-4px);
        box-shadow: var(--sh-lg);
        border-color: rgba(8,37,139,.25);

        .cat-card__art { background: var(--c-accent-lo); }
        .cat-card__go { transform: translateX(4px); color: var(--dk-blue); }
      }
    }

    .cat-card__art {
      flex-shrink: 0;
      width: 72px;
      height: 72px;
      display: grid;
      place-items: center;
      border-radius: var(--r-lg);
      background: var(--c-base);
      border: 1px solid var(--b-1);
      transition: background var(--d-2);
    }

    .cat-card__icon { width: 42px; height: 42px; }

    .cat-card__body { display: flex; flex-direction: column; gap: 2px; min-width: 0; }

    .cat-card__title {
      font-family: var(--font-display);
      font-size: var(--f-md);
      font-weight: var(--w-7);
      color: var(--t-100);
      line-height: 1.25;
    }

    .cat-card__claim { font-size: var(--f-sm); color: var(--t-400); line-height: 1.45; }

    .cat-card__go { margin-left: auto; color: var(--t-500); transition: transform var(--d-2), color var(--d-2); }

    /* ══ CIUDADES ═══════════════════════════════════════════════════ */
    .cities-section { background: var(--c-raised); }

    .cities-grid {
      display: grid;
      grid-template-columns: repeat(6, 1fr);
      gap: var(--sp-4);

      @media (max-width: 1024px) { grid-template-columns: repeat(3, 1fr); }
      @media (max-width: 560px)  { grid-template-columns: repeat(2, 1fr); }
    }

    .city-card {
      position: relative;
      display: block;
      aspect-ratio: 3 / 4;
      border-radius: var(--r-lg);
      overflow: hidden;
      box-shadow: var(--sh-card);

      img { width: 100%; height: 100%; object-fit: cover; transition: transform var(--d-4); }
      &:hover img { transform: scale(1.07); }
    }

    .city-card__veil {
      position: absolute;
      inset: 0;
      background: linear-gradient(180deg, rgba(0,19,93,0) 35%, rgba(0,19,93,.85) 100%);
    }

    .city-card__meta {
      position: absolute;
      inset-inline: var(--sp-3);
      bottom: var(--sp-3);
      display: flex;
      flex-direction: column;
      color: #fff;

      strong { font-family: var(--font-display); font-size: var(--f-md); font-weight: var(--w-7); }
      em { font-style: normal; font-size: var(--f-xs); color: rgba(255,255,255,.8); }
    }

    /* ══ ALOJAMIENTOS RECOMENDADOS ══════════════════════════════════ */
    .recommended-section { background: var(--c-base); }

    .stays-grid {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: var(--sp-5);

      @media (max-width: 1024px) { grid-template-columns: repeat(2, 1fr); }
      @media (max-width: 640px)  { grid-template-columns: 1fr; }
    }

    .stay-card {
      background: var(--c-card);
      border: 1px solid var(--b-1);
      border-radius: var(--r-lg);
      overflow: hidden;
      box-shadow: var(--sh-card);
      display: flex;
      flex-direction: column;
      transition: all var(--d-3);

      &:hover {
        transform: translateY(-4px);
        box-shadow: var(--sh-lg);

        .stay-card__img img { transform: scale(1.05); }
      }
    }

    .stay-card__img {
      position: relative;
      aspect-ratio: 16 / 10;
      overflow: hidden;
      background: var(--c-surface);

      img { width: 100%; height: 100%; object-fit: cover; transition: transform var(--d-4); }
    }

    .stay-card__badge {
      position: absolute;
      top: var(--sp-3);
      left: var(--sp-3);
      display: inline-flex;
      align-items: center;
      gap: var(--sp-1);
      background: var(--dk-gold);
      color: var(--dk-blue-deep);
      border-color: transparent;
    }

    .stay-card__body { padding: var(--sp-5); display: flex; flex-direction: column; flex: 1; }

    .stay-card__stars {
      color: var(--dk-gold);
      font-size: var(--f-sm);
      letter-spacing: .12em;
      margin-bottom: var(--sp-1);
    }

    .stay-card__name {
      font-size: var(--f-md);
      font-weight: var(--w-7);
      color: var(--t-100);
      line-height: 1.3;
      margin-bottom: var(--sp-1);
    }

    .stay-card__loc {
      display: flex;
      align-items: center;
      gap: var(--sp-1);
      font-size: var(--f-xs);
      color: var(--t-400);
      margin-bottom: var(--sp-3);
    }

    .stay-card__tags { display: flex; flex-wrap: wrap; gap: var(--sp-2); margin-bottom: var(--sp-4); }

    .stay-card__tag {
      font-size: var(--f-xs);
      color: var(--t-300);
      background: var(--c-accent-lo);
      border-radius: var(--r-full);
      padding: var(--sp-1) var(--sp-3);
    }

    .stay-card__footer {
      display: flex;
      align-items: flex-end;
      justify-content: space-between;
      gap: var(--sp-3);
      margin-top: auto;
      margin-bottom: var(--sp-4);
    }

    .stay-card__rating { display: flex; flex-direction: column; gap: 2px; }

    .stay-card__score {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: fit-content;
      background: var(--dk-blue);
      color: #fff;
      font-size: var(--f-xs);
      font-weight: var(--w-7);
      border-radius: var(--r-xs);
      padding: 2px var(--sp-2);
    }

    .stay-card__score-meta { font-size: var(--f-xs); color: var(--t-400); }

    .stay-card__price { text-align: right; }

    .stay-card__amount {
      font-size: var(--f-xl);
      font-weight: var(--w-8);
      color: var(--dk-blue);
      letter-spacing: -.02em;
    }

    .stay-card__period { font-size: var(--f-xs); color: var(--t-400); }

    .stay-card__cta { text-align: center; }

    /* ══ CÓMO FUNCIONA ══════════════════════════════════════════════ */
    .how-section { background: var(--c-card); }

    .how-grid {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: var(--sp-5);

      @media (max-width: 800px) { grid-template-columns: 1fr; }
    }

    .how-step {
      position: relative;
      background: var(--c-base);
      border: 1px solid var(--b-1);
      border-radius: var(--r-xl);
      padding: var(--sp-8) var(--sp-6) var(--sp-6);
      text-align: center;
    }

    .how-step__num {
      position: absolute;
      top: calc(-1 * var(--sp-4));
      left: 50%;
      transform: translateX(-50%);
      width: 34px;
      height: 34px;
      display: grid;
      place-items: center;
      border-radius: var(--r-full);
      background: var(--dk-gold);
      color: var(--dk-blue-deep);
      font-family: var(--font-accent);
      font-weight: var(--w-7);
      font-size: var(--f-sm);
      box-shadow: var(--sh-md);
    }

    .how-step__icon { color: var(--dk-blue); margin-inline: auto; margin-bottom: var(--sp-3); }

    .how-step__title {
      font-size: var(--f-md);
      font-weight: var(--w-7);
      color: var(--t-100);
      margin-bottom: var(--sp-2);
    }

    .how-step__text { font-size: var(--f-sm); color: var(--t-400); line-height: 1.6; }

    /* ══ CTA COMERCIOS ══════════════════════════════════════════════ */
    .pro-cta { background: var(--dk-blue); padding-block: var(--sp-12); }

    .pro-cta__inner {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: var(--sp-6);
      flex-wrap: wrap;
    }

    .pro-cta__eyebrow {
      font-family: var(--font-accent);
      font-size: var(--f-xs);
      font-weight: var(--w-7);
      letter-spacing: .12em;
      text-transform: uppercase;
      color: var(--dk-gold);
      margin-bottom: var(--sp-2);
    }

    .pro-cta__title {
      font-size: var(--f-3xl);
      color: #fff;
      margin-bottom: var(--sp-2);
    }

    .pro-cta__text { color: rgba(255,255,255,.82); max-width: 56ch; font-size: var(--f-md); }

    /* ══ FOOTER navy ════════════════════════════════════════════════ */
    .home-footer { background: var(--dk-blue-deep); border-top: none; }

    .home-footer__logo {
      height: 44px;
      width: auto;
      display: block;
      margin-bottom: var(--sp-4);
      border-radius: var(--r-xs);
    }

    .home-footer .rs-footer__brand p { color: rgba(255,255,255,.72); }
    .home-footer .rs-footer__col h4 { color: var(--dk-gold); }

    .home-footer .rs-footer__col a {
      color: rgba(255,255,255,.80);
      &:hover { color: #fff; }
    }

    .home-footer .rs-footer__bottom {
      border-top-color: rgba(255,255,255,.15);
      p { color: rgba(255,255,255,.55); }
    }

    .home-footer__badge {
      background: rgba(255,255,255,.08);
      border-color: rgba(255,255,255,.2);
      color: rgba(255,255,255,.85);
    }
  `],
})
export class HomeComponent {
  private readonly router = inject(Router);
  private readonly fb = inject(FormBuilder);
  private readonly http = inject(HttpClient);

  readonly logoMark = BRAND.logoMark;
  readonly logoFooter = BRAND.logoFooter;
  readonly iconoMas = CATEGORIA_ICONOS['mas'];

  /** Modo del buscador del hero: formulario clásico o asistente con IA. */
  readonly searchMode = signal<SearchMode>('filtros');

  readonly aiQuery = new FormControl('', { nonNullable: true });
  readonly aiLoading = signal(false);
  readonly aiError = signal('');

  readonly sugerenciasIA = [
    'Alojamiento en Madrid para mi golden este finde',
    'Veterinario en Barcelona para vacunación',
    'Peluquería canina en Valencia',
  ];

  readonly horas = ['09:00', '10:00', '11:00', '12:00', '16:00', '17:00', '18:00', '19:00'];

  // Orden por frecuencia de uso: el veterinario es el servicio más habitual.
  readonly verticales: Vertical[] = [
    {
      key: VerticalKey.VETERINARIA, icon: 'stethoscope', labelCorto: 'Veterinarios',
      label: VERTICAL_LABELS[VerticalKey.VETERINARIA], route: VERTICAL_ROUTES['veterinaria'],
      icono: CATEGORIA_ICONOS['veterinaria'],
      claim: 'Consultas, vacunas y urgencias con cita online.',
    },
    {
      key: VerticalKey.PELUQUERIA, icon: 'scissors', labelCorto: 'Peluquería',
      label: VERTICAL_LABELS[VerticalKey.PELUQUERIA], route: VERTICAL_ROUTES['peluqueria'],
      icono: CATEGORIA_ICONOS['peluqueria'],
      claim: 'Baño, corte, deslanado y spa canino.',
    },
    {
      key: VerticalKey.ALOJAMIENTO, icon: 'hotel', labelCorto: 'Alojamiento',
      label: VERTICAL_LABELS[VerticalKey.ALOJAMIENTO], route: VERTICAL_ROUTES['alojamiento'],
      icono: CATEGORIA_ICONOS['alojamiento'],
      claim: 'Residencias y suites con cámaras 24/7.',
    },
    {
      key: VerticalKey.TRANSPORTE, icon: 'truck', labelCorto: 'Transporte',
      label: VERTICAL_LABELS[VerticalKey.TRANSPORTE], route: VERTICAL_ROUTES['transporte'],
      icono: CATEGORIA_ICONOS['transporte'],
      claim: 'Traslados en vehículos climatizados.',
    },
    {
      key: VerticalKey.ADIESTRAMIENTO, icon: 'graduation-cap', labelCorto: 'Adiestramiento',
      label: VERTICAL_LABELS[VerticalKey.ADIESTRAMIENTO], route: VERTICAL_ROUTES['adiestramiento'],
      icono: CATEGORIA_ICONOS['adiestramiento'],
      claim: 'Obediencia, conducta y cachorros.',
    },
    {
      key: VerticalKey.HOTELES, icon: 'building', labelCorto: 'Hoteles',
      label: VERTICAL_LABELS[VerticalKey.HOTELES], route: VERTICAL_ROUTES['hoteles'],
      icono: CATEGORIA_ICONOS['hoteles'],
      claim: 'Hoteles pet-friendly para viajar juntos.',
    },
  ];

  readonly garantias = [
    { icono: TRUST_ICONOS.verificados, titulo: 'Profesionales', detalle: 'verificados' },
    { icono: TRUST_ICONOS.reservaSegura, titulo: 'Reserva segura', detalle: 'y garantizada' },
    { icono: TRUST_ICONOS.prioridad, titulo: 'Tu mascota,', detalle: 'nuestra prioridad' },
  ];

  readonly pasos = [
    { icon: 'search', titulo: 'Busca y compara', texto: 'Elige categoría, ciudad y fechas. Filtra por precio, valoración y servicios.' },
    { icon: 'credit-card', titulo: 'Reserva y paga seguro', texto: 'Pago online con Stripe. Confirmación inmediata y cancelación según la política del comercio.' },
    { icon: 'paw', titulo: 'Disfruta el trato real', texto: 'Tu perro recibe el servicio y tú dejas tu reseña para ayudar a otros dueños.' },
  ];

  // Solo imágenes locales: el pool remoto (Pexels) no está garantizado offline.
  readonly ciudades: Ciudad[] = [
    { nombre: 'Madrid', servicios: 248, imagen: BRAND.heroHome },
    { nombre: 'Barcelona', servicios: 194, imagen: HOTEL_IMAGES[3] },
    { nombre: 'Valencia', servicios: 132, imagen: HOTEL_IMAGES[2] },
    { nombre: 'Sevilla', servicios: 108, imagen: BRAND.heroDetalle },
    { nombre: 'Bilbao', servicios: 76, imagen: HOTEL_IMAGES[4] },
    { nombre: 'Málaga', servicios: 91, imagen: HOTEL_IMAGES[1] },
  ];

  readonly searchForm = this.fb.group({
    vertical: [VerticalKey.ALOJAMIENTO as string],
    ciudad: [''],
    fechaInicio: [''],
    fechaFin: [''],
    hora: [''],
    perros: [1],
  });

  /** Categoría activa del buscador — deriva del formulario (sin subscripciones). */
  private readonly verticalValor = toSignal(this.searchForm.controls.vertical.valueChanges, {
    initialValue: this.searchForm.controls.vertical.value,
  });

  readonly verticalActivo = computed(() => this.verticalValor() ?? VerticalKey.ALOJAMIENTO);

  /** Alojamiento y hoteles se reservan por noches; el resto son citas. */
  readonly reservaPorNoches = computed(() => VERTICALES_POR_NOCHES.includes(this.verticalActivo()));

  readonly labelFechaInicio = computed(() => (this.reservaPorNoches() ? 'Entrada' : 'Fecha'));

  readonly labelUbicacion = computed(() =>
    this.verticalActivo() === VerticalKey.TRANSPORTE ? 'Recogida' : '¿Dónde?',
  );

  readonly alojamientosRecomendados: AlojamientoRecomendado[] = [
    {
      nombre: 'Royal Dog Resort', ciudad: 'Madrid',
      estrellas: 5, score: 9.4, scoreLabel: 'Excepcional', numResenas: 812,
      precioPorNoche: 42, imagen: HOTEL_IMAGES[0],
      tags: ['Suites individuales', 'Cámaras 24/7', 'Paseos diarios'],
    },
    {
      nombre: 'Can Feliç Residència Canina', ciudad: 'Barcelona',
      estrellas: 4, score: 9.1, scoreLabel: 'Fantástico', numResenas: 645,
      precioPorNoche: 35, imagen: HOTEL_IMAGES[1],
      tags: ['Patio exterior', 'Veterinario de guardia'],
    },
    {
      nombre: 'Guau Boutique Hotel', ciudad: 'Valencia',
      estrellas: 5, score: 9.6, scoreLabel: 'Excepcional', numResenas: 431,
      precioPorNoche: 48, imagen: HOTEL_IMAGES[2],
      tags: ['Spa canino', 'Piscina', 'Cancelación gratis'],
    },
    {
      nombre: 'La Manada Pet Lodge', ciudad: 'Sevilla',
      estrellas: 4, score: 8.9, scoreLabel: 'Muy bueno', numResenas: 388,
      precioPorNoche: 29, imagen: HOTEL_IMAGES[3],
      tags: ['Grupos pequeños', 'Paseos incluidos'],
    },
  ];

  verticalIcon(): string {
    const key = this.searchForm.controls.vertical.value;
    return this.verticales.find((v) => v.key === key)?.icon ?? 'paw';
  }

  estrellas(n: number): string {
    return '★'.repeat(n) + '☆'.repeat(5 - n);
  }

  /** Cambia la categoría desde la fila de iconos del buscador. */
  seleccionarVertical(key: VerticalKey): void {
    this.searchForm.controls.vertical.setValue(key);
  }

  onBuscar(): void {
    const { vertical, ciudad, fechaInicio, fechaFin, perros } = this.searchForm.value;
    void this.router.navigate(['/buscador'], {
      queryParams: {
        vertical: vertical || VerticalKey.ALOJAMIENTO,
        ciudad: ciudad || null,
        desde: fechaInicio || null,
        hasta: fechaFin || null,
        perros: perros || null,
      },
    });
  }

  usarSugerencia(sugerencia: string): void {
    this.aiQuery.setValue(sugerencia);
    void this.buscarConIA();
  }

  /**
   * Búsqueda con IA: el asistente interpreta la frase libre y devuelve el
   * vertical y filtros; navegamos directamente a los resultados. Si falla,
   * mostramos un aviso y el usuario puede volver a los filtros.
   */
  async buscarConIA(): Promise<void> {
    const query = this.aiQuery.value.trim();
    if (!query || this.aiLoading()) return;

    this.aiLoading.set(true);
    this.aiError.set('');

    try {
      const resultado = await firstValueFrom(
        this.http.post<AiSearchResult>(`${environment.apiUrl}/ai-search`, { query }),
      );

      const vertical =
        resultado.vertical && VERTICAL_ROUTES[resultado.vertical] ? resultado.vertical : 'alojamiento';

      void this.router.navigate([VERTICAL_ROUTES[vertical]], {
        queryParams: {
          ciudad: resultado.ciudad ?? resultado.extras?.['origen'] ?? null,
          destino: resultado.extras?.['destino'] ?? null,
          desde: resultado.desde ?? null,
          hasta: resultado.hasta ?? null,
        },
      });
    } catch {
      this.aiError.set('No pudimos procesar tu búsqueda ahora mismo. Prueba con los filtros.');
    } finally {
      this.aiLoading.set(false);
    }
  }
}
