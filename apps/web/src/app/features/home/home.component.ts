import { Component, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { ReactiveFormsModule, FormControl } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { TipoLugar, VerticalKey } from 'shared';
import { AnimateOnScrollDirective } from '../../shared/directives/animate-on-scroll.directive';
import { ImgFallbackDirective } from '../../shared/directives/img-fallback.directive';
import { RsNavbarComponent } from '../../shared/components/navbar/rs-navbar.component';
import { RsIconComponent } from '../../shared/components/icon/rs-icon.component';
import { RsBrandIconComponent, type MarcaPagoKey } from '../../shared/components/brand-icon/rs-brand-icon.component';
import { RsSocialIconComponent, type RedSocialKey } from '../../shared/components/social-icon/rs-social-icon.component';
import { RsSearchBarComponent } from '../../shared/components/search-bar/rs-search-bar.component';
import { RsCardComponent } from '../../shared/components/card/rs-card.component';
import { BRAND, HOTEL_IMAGES, TRUST_ICONOS } from '../../shared/media/images';
import { VERTICALES_UI, rutaDeVertical } from '../../shared/verticales/verticales.config';
import { environment } from '../../../environments/environment';

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
  imports: [
    RouterLink, ReactiveFormsModule, AnimateOnScrollDirective, ImgFallbackDirective,
    RsNavbarComponent, RsIconComponent, RsSocialIconComponent, RsSearchBarComponent, RsCardComponent,
    RsBrandIconComponent,
  ],
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
            Todo para tu mascota
            <i class="hero__dash" aria-hidden="true"></i>
          </span>
          <span class="hero__title-line hero__title-line--gold">en un solo lugar</span>
        </h1>
        <p class="hero__subtitle" i18n="@@home.heroSubtitulo">
          Veterinarios, peluquerías, residencias, hoteles pet friendly, transporte, adiestramiento y mucho más.
        </p>
        <p class="hero__slogan">Reserva en menos de un minuto con profesionales de confianza cerca de ti.</p>
      </div>

      <!-- Panel de búsqueda (estilo Booking: categorías + filtros en una fila) -->
      <div class="searchbox" role="search">
        <div class="searchbox__head">
          <p class="searchbox__question">Encuentra el servicio perfecto para tu mascota</p>
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

        @if (searchMode() === 'filtros') {
          <rs-search-bar />
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
  <section class="rs-section rs-section--sm cats-section" id="categorias">
    <div class="rs-wrap rs-wrap--2xl">
      <div class="sec-head" rsAnim>
        <div>
          <h2 class="rs-h3" i18n="@@home.exploraServicios">Explora todos nuestros servicios</h2>
          <p i18n="@@home.exploraClaim">Reserva en segundos con los mejores profesionales cerca de ti.</p>
        </div>
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

  <!-- ═══ ¿POR QUÉ DOOGKING? ══════════════════════════════════════
       Bloque de propuesta de valor: es el que explica por qué elegir
       Doogking frente a llamar al veterinario o buscar en Google. -->
  <section class="rs-section why-section" id="por-que">
    <div class="rs-wrap rs-wrap--2xl">
      <div class="sec-head sec-head--center" rsAnim>
        <div>
          <p class="why__eyebrow" i18n="@@home.porQueEyebrow">La plataforma de tu mascota</p>
          <h2 class="rs-h3" i18n="@@home.porQueTitulo">¿Por qué Doogking.com?</h2>
          <p i18n="@@home.porQueSub">Todo lo que tu perro necesita a lo largo de su vida, en un único sitio y con un solo perfil.</p>
        </div>
      </div>

      <ul class="why-grid" rsAnim>
        @for (m of motivos; track m.titulo) {
          <li class="why-card">
            <span class="why-card__art" aria-hidden="true">
              <rs-icon [name]="m.icon" [size]="26" [stroke]="1.9"></rs-icon>
            </span>
            <h3 class="why-card__title">{{ m.titulo }}</h3>
            <p class="why-card__text">{{ m.texto }}</p>
          </li>
        }
      </ul>
    </div>
  </section>

  <!-- ═══ CIUDADES ════════════════════════════════════════════════ -->
  <section class="rs-section rs-section--sm cities-section" id="ciudades">
    <div class="rs-wrap rs-wrap--2xl">
      <div class="sec-head" rsAnim>
        <div>
          <h2 class="rs-h3">Servicios cerca de ti</h2>
          <p>Las ciudades con más profesionales caninos verificados de Doogking.</p>
        </div>
      </div>

      <div class="cities-grid" rsAnim>
        @for (c of ciudades; track c.nombre) {
          <a class="city-card" [routerLink]="rutaAlojamiento" [queryParams]="{ ciudad: c.nombre }">
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
          <rs-card
            [rsAnim]="''" [rsAnimDelay]="$index * 70"
            [imageUrl]="a.imagen" [imageAlt]="a.nombre"
            [title]="a.nombre" [subtitle]="a.ciudad"
            [badges]="[{ icon: 'crown', label: 'Recomendado', variant: 'accent' }]"
            [rating]="{ score: a.score, label: a.scoreLabel, count: a.numResenas }"
            [price]="{ amount: '€' + a.precioPorNoche, period: '/noche' }"
            [amenities]="a.tags"
            ctaLabel="Ver alojamiento"
            (cardClick)="irAAlojamiento(a.ciudad)">
          </rs-card>
        }
      </div>
    </div>
  </section>

  <!-- ═══ EXPLORA CON TU MASCOTA ══════════════════════════════════
       Contenido de comunidad, no reservable: es lo que diferencia a
       Doogking de un directorio de servicios. -->
  <section class="rs-section rs-section--sm explora-section">
    <div class="rs-wrap rs-wrap--2xl">
      <div class="sec-head" rsAnim>
        <div>
          <h2 class="rs-h3">Explora con tu mascota</h2>
          <p>Descubre playas caninas, parques caninos, rutas, restaurantes y otros lugares pet friendly recomendados por la comunidad Doogking.</p>
        </div>
        <a routerLink="/explora/planificador" class="sec-head__link">
          Planificar un viaje con IA
          <rs-icon name="arrow-right" [size]="16" [stroke]="2"></rs-icon>
        </a>
      </div>

      <div class="explora-grid" rsAnim>
        @for (e of exploraDestacados; track e.titulo) {
          <a class="explora-card" [routerLink]="e.ruta" [queryParams]="e.tipo ? { tipo: e.tipo } : {}">
            <img [src]="e.imagen" [alt]="e.titulo" loading="lazy" rsImg />
            <span class="explora-card__veil"></span>
            <span class="explora-card__meta">
              <strong>{{ e.titulo }}</strong>
              <em>{{ e.detalle }}</em>
            </span>
          </a>
        }
      </div>

      <p class="explora-nota">Todos los lugares son compartidos por la comunidad y revisados por el equipo Doogking antes de su publicación.</p>
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
        <p class="home-footer__claim">La plataforma líder para reservar servicios para mascotas.</p>
        <p>El marketplace de servicios caninos en España. Alojamiento, transporte, veterinarios, peluquería y adiestramiento para tu perro.</p>
        <div class="home-footer__social" aria-label="Redes sociales de Doogking">
          @for (red of redesSociales; track red.nombre) {
            <a
              [href]="red.url"
              target="_blank"
              rel="noopener"
              class="home-footer__social-link"
              [attr.title]="red.nombre">
              <rs-social-icon [name]="red.icono" [size]="18" [etiqueta]="red.nombre" />
            </a>
          }
        </div>
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
          <li><a routerLink="/" fragment="categorias">Todas las categorías</a></li>
          <li><a routerLink="/" fragment="ciudades">Ciudades destacadas</a></li>
          <li><a routerLink="/alojamiento">Alojamientos recomendados</a></li>
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
    <div class="home-footer__stores">
      <span class="home-footer__store-badge"><rs-icon name="smartphone" [size]="14" [stroke]="2" /> Próximamente en App Store</span>
      <span class="home-footer__store-badge"><rs-icon name="play" [size]="14" [stroke]="2" /> Próximamente en Google Play</span>
      <span class="home-footer__pay">
        @for (marca of marcasPago; track marca) {
          <rs-brand-icon [name]="marca" [size]="20" />
        }
      </span>
    </div>

    <p class="home-footer__closing">Todo lo que tu mascota necesita. En un solo lugar.<br />Gracias por confiar en Doogking.</p>

    <div class="rs-footer__bottom">
      <p>© 2026 Doogking · Todos los derechos reservados · <a routerLink="/privacidad">Política de privacidad</a> · <a routerLink="/cookies">Cookies</a> · <a routerLink="/terminos">Aviso legal</a></p>
      <div class="rs-flex rs-gap-4" style="flex-wrap:wrap">
        <span class="rs-badge rs-badge--neutral home-footer__badge"><rs-icon name="badge-check" [size]="13" [stroke]="2" /> Empresas verificadas</span>
        <span class="rs-badge rs-badge--neutral home-footer__badge"><rs-icon name="lock" [size]="13" [stroke]="2" /> Pago seguro con Stripe</span>
        <span class="rs-badge rs-badge--neutral home-footer__badge"><rs-icon name="shield-check" [size]="13" [stroke]="2" /> Protección de reservas</span>
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
      margin-bottom: var(--sp-6);
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

    .hero__subtitle {
      margin-top: var(--sp-4);
      margin-inline: auto;
      max-width: 58ch;
      font-size: var(--f-md);
      line-height: 1.55;
      color: var(--t-300);

      /* En pantallas bajas resta altura al buscador, que es lo que convierte. */
      @media (max-width: 560px) { display: none; }
    }

    .hero__slogan {
      margin-top: var(--sp-2);
      margin-inline: auto;
      max-width: 52ch;
      font-size: var(--f-sm);
      font-weight: var(--w-6);
      color: var(--dk-blue);

      @media (max-width: 560px) { display: none; }
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

    /* ══ EXPLORA CON TU MASCOTA ═════════════════════════════════════ */
    .explora-section { background: var(--c-card); }

    .explora-grid {
      display: grid; grid-template-columns: repeat(4, 1fr); gap: var(--sp-4);
      @media (max-width: 1024px) { grid-template-columns: repeat(2, 1fr); }
      @media (max-width: 560px) { grid-template-columns: 1fr; }
    }

    .explora-card {
      position: relative; display: block;
      aspect-ratio: 3/4; overflow: hidden;
      border-radius: var(--r-xl); text-decoration: none;

      img { width: 100%; height: 100%; object-fit: cover; transition: transform var(--d-4); }
      &:hover img { transform: scale(1.06); }
      @media (prefers-reduced-motion: reduce) { &:hover img { transform: none; } }
    }

    .explora-card__veil {
      position: absolute; inset: 0;
      background: linear-gradient(180deg, rgba(0,19,93,0) 40%, rgba(0,19,93,.78) 100%);
    }

    .explora-card__meta {
      position: absolute; left: var(--sp-4); right: var(--sp-4); bottom: var(--sp-4);
      display: flex; flex-direction: column; gap: 2px; color: #fff;

      strong { font-family: var(--font-display); font-size: var(--f-md); font-weight: var(--w-7); }
      em { font-style: normal; font-size: var(--f-xs); opacity: .88; }
    }

    .explora-nota {
      margin-top: var(--sp-4);
      font-size: var(--f-xs);
      color: var(--t-400);
      text-align: center;
    }

    /* ══ ¿POR QUÉ DOOGKING? ═════════════════════════════════════════ */
    .why-section { background: var(--c-card); }

    .why__eyebrow {
      font-family: var(--font-accent);
      font-size: var(--f-xs);
      font-weight: var(--w-7);
      letter-spacing: .12em;
      text-transform: uppercase;
      color: var(--dk-gold);
      margin-bottom: var(--sp-2);
    }

    .why-grid {
      display: grid;
      grid-template-columns: repeat(4, minmax(0, 1fr));
      gap: var(--sp-5);
      list-style: none;

      @media (max-width: 1024px) { grid-template-columns: repeat(2, minmax(0, 1fr)); }

      /* Móvil: carrusel horizontal con scroll-snap en vez de apilar cuatro
         tarjetas altas, que empujarían el resto de la home fuera de vista. */
      @media (max-width: 640px) {
        grid-template-columns: none;
        grid-auto-flow: column;
        grid-auto-columns: 78%;
        overflow-x: auto;
        scroll-snap-type: x mandatory;
        margin-inline: calc(var(--sp-5) * -1);
        padding-inline: var(--sp-5);
        padding-bottom: var(--sp-3);
        scrollbar-width: thin;
      }
    }

    .why-card {
      display: flex;
      flex-direction: column;
      align-items: flex-start;
      gap: var(--sp-3);
      padding: var(--sp-6);
      border: 1px solid var(--b-1);
      border-radius: var(--r-xl);
      background: var(--c-base);
      transition: transform var(--d-2), box-shadow var(--d-2), border-color var(--d-2);

      &:hover {
        transform: translateY(-4px);
        border-color: rgba(8,37,139,.22);
        box-shadow: var(--sh-lg);
      }

      @media (max-width: 640px) { scroll-snap-align: start; }
      @media (prefers-reduced-motion: reduce) { &:hover { transform: none; } }
    }

    .why-card__art {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 56px;
      height: 56px;
      border-radius: var(--r-lg);
      background: var(--g-warm);
      color: var(--dk-blue-deep);
      flex-shrink: 0;
    }

    .why-card__title {
      font-family: var(--font-display);
      font-size: var(--f-lg);
      font-weight: var(--w-7);
      color: var(--dk-blue);
      line-height: 1.3;
    }

    .why-card__text {
      font-size: var(--f-sm);
      line-height: 1.6;
      color: var(--t-400);
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
      gap: var(--sp-6);

      @media (max-width: 1024px) { grid-template-columns: repeat(3, 1fr); }
      @media (max-width: 560px)  { grid-template-columns: repeat(2, 1fr); }
    }

    .city-card {
      position: relative;
      display: block;
      aspect-ratio: 3 / 4.6;
      border-radius: var(--r-lg);
      overflow: hidden;
      box-shadow: var(--sh-card);
      transition: box-shadow var(--d-3), transform var(--d-3);

      img { width: 100%; height: 100%; object-fit: cover; transition: transform var(--d-4); }

      &:hover {
        box-shadow: var(--sh-lg);
        transform: translateY(-3px);

        img { transform: scale(1.07); }
      }
      @media (prefers-reduced-motion: reduce) { &:hover { transform: none; } }
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

    /* La tarjeta en sí (imagen, badges, rating, precio, CTA) la aporta
       <rs-card> en modo "resultado" (HU-0.1/0.8/1.7.1) — ver rs-card.component.ts. */

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
      height: 62px;
      width: auto;
      display: block;
      margin-bottom: var(--sp-4);
      border-radius: var(--r-xs);
    }

    .home-footer__claim {
      font-family: var(--font-display);
      font-weight: var(--w-7);
      color: #fff !important;
      margin-bottom: var(--sp-2);
    }

    .home-footer .rs-footer__brand p { color: rgba(255,255,255,.72); }
    .home-footer .rs-footer__col h4 { color: var(--dk-gold); }

    .home-footer .rs-footer__col a {
      color: rgba(255,255,255,.80);
      &:hover { color: var(--dk-gold); text-decoration: underline; }
    }

    .home-footer__social {
      display: flex;
      flex-wrap: wrap;
      gap: var(--sp-3);
      margin-top: var(--sp-4);
    }

    /* El logo sustituye al nombre escrito (TCK-8008): el círculo de 40px
       mantiene el área táctil que antes daba el texto. */
    .home-footer__social-link {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 40px;
      height: 40px;
      color: rgba(255,255,255,.80) !important;
      border: 1px solid rgba(255,255,255,.2);
      border-radius: var(--r-full);
      transition: all var(--d-2);

      &:hover { color: var(--dk-blue-deep) !important; background: var(--dk-gold); border-color: var(--dk-gold); text-decoration: none !important; transform: translateY(-2px); }
    }

    .home-footer__stores {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: var(--sp-4);
      padding-block: var(--sp-6);
      margin-top: var(--sp-6);
      border-top: 1px solid rgba(255,255,255,.15);
    }

    .home-footer__store-badge {
      font-size: var(--f-xs);
      color: rgba(255,255,255,.65);
    }
    .home-footer__pay { display: inline-flex; align-items: center; gap: var(--sp-1); flex-wrap: wrap; }

    .home-footer__closing {
      text-align: center;
      color: rgba(255,255,255,.85);
      font-family: var(--font-display);
      font-weight: var(--w-6);
      font-size: var(--f-md);
      line-height: 1.6;
      padding-bottom: var(--sp-6);
    }

    .home-footer .rs-footer__bottom {
      border-top-color: rgba(255,255,255,.15);
      p { color: rgba(255,255,255,.55); }
      a { color: rgba(255,255,255,.65); &:hover { color: var(--dk-gold); } }
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
  private readonly http = inject(HttpClient);

  readonly logoMark = BRAND.logoMark;
  readonly logoFooter = BRAND.logoFooter;
  readonly rutaAlojamiento = rutaDeVertical(VerticalKey.ALOJAMIENTO);

  /** Perfiles sociales del footer; se muestran con su logo oficial (TCK-8008). */
  /** Marcas de pago del pie, con su logotipo en vez del nombre escrito (TCK-8008). */
  readonly marcasPago: readonly MarcaPagoKey[] = [
    'visa', 'mastercard', 'amex', 'stripe', 'apple-pay', 'google-pay',
  ];

  readonly redesSociales: readonly { nombre: string; icono: RedSocialKey; url: string }[] = [
    { nombre: 'Instagram', icono: 'instagram', url: 'https://instagram.com/doogking' },
    { nombre: 'Facebook', icono: 'facebook', url: 'https://facebook.com/doogking' },
    { nombre: 'TikTok', icono: 'tiktok', url: 'https://tiktok.com/@doogking' },
    { nombre: 'LinkedIn', icono: 'linkedin', url: 'https://linkedin.com/company/doogking' },
    { nombre: 'YouTube', icono: 'youtube', url: 'https://youtube.com/@doogking' },
  ];

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

  /** Categorías: misma configuración que el menú y el buscador. */
  readonly verticales = VERTICALES_UI;

  readonly garantias = [
    { icono: TRUST_ICONOS.verificados, titulo: 'Profesionales', detalle: 'verificados' },
    { icono: TRUST_ICONOS.reservaSegura, titulo: 'Reserva segura', detalle: 'y garantizada' },
    { icono: TRUST_ICONOS.prioridad, titulo: 'Tu mascota,', detalle: 'nuestra prioridad' },
  ];

  /** Pilares del bloque "¿Por qué Doogking?" (propuesta de valor de marca). */
  readonly motivos = [
    {
      icon: 'zap',
      titulo: 'Reserva en segundos',
      texto: 'Eliges servicio, ciudad y fecha, y confirmas al momento. Sin llamadas, sin esperar respuesta.',
    },
    {
      icon: 'shield-check',
      titulo: 'Profesionales verificados',
      texto: 'Cada comercio pasa por validación antes de publicar. Reseñas reales de dueños que ya reservaron.',
    },
    {
      icon: 'globe',
      titulo: 'Miles de servicios en un solo lugar',
      texto: 'Alojamiento, veterinario, peluquería, transporte y adiestramiento con un único perfil y un único pago.',
    },
    {
      icon: 'message-square',
      titulo: 'Atención cuando la necesites',
      texto: 'Soporte antes, durante y después de la reserva, y pago protegido hasta que el servicio se presta.',
    },
  ];

  /** Puertas de entrada a la comunidad; cada una filtra `/explora` por tipo. */
  readonly exploraDestacados = [
    { tipo: TipoLugar.PLAYA as TipoLugar | null, ruta: '/explora', titulo: 'Playas caninas', detalle: 'Disfrutad juntos del mar durante todo el año', imagen: HOTEL_IMAGES[2] },
    { tipo: TipoLugar.PARQUE as TipoLugar | null, ruta: '/explora', titulo: 'Parques caninos', detalle: 'Espacios seguros para correr, jugar y socializar', imagen: BRAND.heroHome },
    { tipo: TipoLugar.RUTA as TipoLugar | null, ruta: '/explora', titulo: 'Rutas y ríos', detalle: 'Naturaleza para descubrir juntos', imagen: HOTEL_IMAGES[4] },
    { tipo: TipoLugar.RESTAURANTE as TipoLugar | null, ruta: '/explora', titulo: 'Restaurantes', detalle: 'Sitios donde tu mascota también es bienvenida', imagen: HOTEL_IMAGES[1] },
    // No es un TipoLugar de la comunidad (decisión D-5): es el vertical reservable
    // Hoteles, así que enlaza directo a su listado en vez de a /explora.
    { tipo: null as TipoLugar | null, ruta: '/hoteles', titulo: 'Hoteles pet friendly', detalle: 'Descubre alojamientos donde vuestra mascota también es bienvenida', imagen: HOTEL_IMAGES[0] },
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

  /** Click en la tarjeta de "Alojamientos recomendados" (HU-1.7.1: toda la tarjeta es clicable). */
  irAAlojamiento(ciudad: string): void {
    void this.router.navigate([this.rutaAlojamiento], { queryParams: { ciudad } });
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

      // Si la IA no reconoce el vertical, `rutaDeVertical` cae en alojamiento.
      void this.router.navigate([rutaDeVertical(resultado.vertical)], {
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
