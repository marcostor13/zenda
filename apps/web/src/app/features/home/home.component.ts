import { Component, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { FormBuilder, ReactiveFormsModule, FormControl } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { VerticalKey, VERTICAL_LABELS } from 'shared';
import { AnimateOnScrollDirective } from '../../shared/directives/animate-on-scroll.directive';
import { ImgFallbackDirective } from '../../shared/directives/img-fallback.directive';
import { RsNavbarComponent } from '../../shared/components/navbar/rs-navbar.component';
import { RsIconComponent } from '../../shared/components/icon/rs-icon.component';
import { BRAND, CATEGORIA_BADGES, HOTEL_IMAGES } from '../../shared/media/images';
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

interface Vertical {
  key: VerticalKey;
  icon: string;
  label: string;
  route: string;
  badge: string;
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

  <!-- ═══ HERO ════════════════════════════════════════════════════ -->
  <section class="hero">
    <div class="hero__bg" aria-hidden="true">
      <img [src]="heroImg" alt="" loading="eager" fetchpriority="high" />
      <div class="hero__overlay"></div>
    </div>

    <div class="hero__inner rs-wrap">
      <div class="hero__content">
        <h1 class="hero__title">
          <span class="hero__title-blue">Todo para su rey,</span><br>
          <span class="hero__title-gold">en un solo lugar</span>
        </h1>

        <p class="hero__sub">
          Reserva alojamientos premium, veterinarios de confianza y peluquería
          real para tu perro. La forma más fácil de darle el trato que merece.
        </p>

        <!-- Panel de búsqueda centrado -->
        <div class="hero__panel">
          <!-- Toggle: filtros vs IA (un clic) -->
          <div class="hero__modes" role="tablist" aria-label="Modo de búsqueda">
            <button type="button" class="hero__mode" role="tab"
                    [class.is-active]="searchMode() === 'filtros'"
                    [attr.aria-selected]="searchMode() === 'filtros'"
                    (click)="searchMode.set('filtros')">
              <rs-icon name="search" [size]="15" [stroke]="2.25"></rs-icon>
              Buscar por filtros
            </button>
            <button type="button" class="hero__mode hero__mode--ia" role="tab"
                    [class.is-active]="searchMode() === 'ia'"
                    [attr.aria-selected]="searchMode() === 'ia'"
                    (click)="searchMode.set('ia')">
              <rs-icon name="sparkles" [size]="15" [stroke]="2"></rs-icon>
              Buscar con IA
            </button>
          </div>

          @if (searchMode() === 'filtros') {
            <form class="hero__search" [formGroup]="searchForm" (ngSubmit)="onBuscar()">
              <div class="hero__field hero__field--service">
                <label class="hero__lbl" for="home-servicio">Servicio</label>
                <div class="hero__inp-wrap">
                  <rs-icon [name]="verticalIcon()" [size]="16" [stroke]="2"></rs-icon>
                  <select id="home-servicio" formControlName="vertical" class="hero__inp hero__inp--select">
                    @for (v of verticales; track v.key) {
                      <option [value]="v.key">{{ v.label }}</option>
                    }
                  </select>
                </div>
              </div>

              <div class="hero__field hero__field--city">
                <label class="hero__lbl" for="home-ciudad">Ciudad</label>
                <div class="hero__inp-wrap">
                  <rs-icon name="map-pin" [size]="16" [stroke]="2"></rs-icon>
                  <input id="home-ciudad" formControlName="ciudad" class="hero__inp"
                         placeholder="Madrid, Barcelona…" />
                </div>
              </div>

              <div class="hero__field hero__field--date">
                <label class="hero__lbl" for="home-desde">Entrada</label>
                <div class="hero__inp-wrap">
                  <rs-icon name="calendar" [size]="16" [stroke]="2"></rs-icon>
                  <input id="home-desde" formControlName="fechaInicio" type="date" class="hero__inp" aria-label="Fecha de entrada" />
                </div>
              </div>

              <div class="hero__field hero__field--date">
                <label class="hero__lbl" for="home-hasta">Salida</label>
                <div class="hero__inp-wrap">
                  <rs-icon name="calendar" [size]="16" [stroke]="2"></rs-icon>
                  <input id="home-hasta" formControlName="fechaFin" type="date" class="hero__inp" aria-label="Fecha de salida" />
                </div>
              </div>

              <div class="hero__field hero__field--dogs">
                <label class="hero__lbl" for="home-perros">Perros</label>
                <div class="hero__inp-wrap">
                  <rs-icon name="paw" [size]="16" [stroke]="2"></rs-icon>
                  <select id="home-perros" formControlName="perros" class="hero__inp hero__inp--select">
                    @for (n of [1,2,3,4]; track n) {
                      <option [value]="n">{{ n }}</option>
                    }
                  </select>
                </div>
              </div>

              <button type="submit" class="rs-btn rs-btn--gold rs-btn--lg hero__cta">
                <rs-icon name="search" [size]="18" [stroke]="2.25"></rs-icon>
                <span>Buscar</span>
              </button>
            </form>
          } @else {
            <form class="hero__ai" (ngSubmit)="buscarConIA()">
              <div class="hero__ai-bar" [class.is-loading]="aiLoading()">
                <rs-icon name="sparkles" [size]="18" [stroke]="1.75" class="hero__ai-spark"></rs-icon>
                <input class="hero__ai-input" [formControl]="aiQuery"
                       placeholder="Describe lo que necesitas… «Alojamiento en Madrid para mi golden este finde»"
                       aria-label="Búsqueda con inteligencia artificial" />
                <button type="submit" class="rs-btn rs-btn--gold hero__ai-btn"
                        aria-label="Buscar con IA"
                        [disabled]="aiLoading() || !aiQuery.value.trim()">
                  @if (aiLoading()) {
                    <span class="hero__ai-spinner"></span>
                  } @else {
                    <rs-icon name="arrow-right" [size]="18" [stroke]="2.5"></rs-icon>
                  }
                </button>
              </div>

              <div class="hero__ai-hints">
                <span class="hero__ai-hint-label">Prueba:</span>
                @for (s of sugerenciasIA; track s) {
                  <button type="button" class="hero__ai-chip" (click)="usarSugerencia(s)">{{ s }}</button>
                }
              </div>

              @if (aiError()) {
                <p class="hero__ai-error">{{ aiError() }}</p>
              }
            </form>
          }
        </div>
      </div>
    </div>
  </section>

  <!-- ═══ NUESTROS SERVICIOS REALES ═══════════════════════════════ -->
  <section class="rs-section services-section">
    <div class="rs-wrap">
      <div class="section-header" rsAnim>
        <h2 class="rs-h2">Nuestros servicios <span class="services-gold">reales</span></h2>
        <p>Todo lo que necesitas para darle a tu perro un cuidado de reyes, en cinco categorías.</p>
      </div>

      <div class="services__row" rsAnim>
        @for (v of verticales; track v.key) {
          <a class="service-badge" [routerLink]="v.route">
            <span class="service-badge__circle">
              <img [src]="v.badge" [alt]="v.label" loading="lazy" rsImg />
            </span>
            <span class="service-badge__label">{{ v.label }}</span>
          </a>
        }
      </div>
    </div>
  </section>

  <!-- ═══ ALOJAMIENTOS RECOMENDADOS ═══════════════════════════════ -->
  <section class="rs-section recommended-section">
    <div class="rs-wrap">
      <div class="section-header section-header--left" rsAnim>
        <h2 class="rs-h2">Alojamientos recomendados</h2>
        <p>Residencias caninas mejor valoradas por otros dueños este mes.</p>
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

      <div class="section-cta" rsAnim>
        <a routerLink="/alojamiento" class="rs-btn rs-btn--secondary rs-btn--lg">
          Ver todos los alojamientos
          <rs-icon name="arrow-right" [size]="16" [stroke]="2"></rs-icon>
        </a>
      </div>
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
        <h4>Más</h4>
        <ul>
          <li><a routerLink="/buscador">Buscador</a></li>
          <li><a routerLink="/auth/registro">Crear cuenta</a></li>
          <li><a routerLink="/auth/registro-comercio">Hazte partner</a></li>
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
        <span class="rs-badge rs-badge--neutral home-footer__badge">IVA 21% incluido</span>
        <span class="rs-badge rs-badge--neutral home-footer__badge">Pagos seguros Stripe</span>
      </div>
    </div>
  </footer>
</div>
  `,
  styles: [`
    :host { display: block; }

    /* ── HERO ──────────────────────────────────────────────────────── */
    .hero {
      position: relative;
      min-height: 88vh;
      display: flex;
      align-items: center;
      overflow: hidden;
      padding-block: var(--sp-20) var(--sp-16);
    }

    .hero__bg {
      position: absolute;
      inset: 0;
      z-index: 0;
      background: var(--c-raised);

      img {
        width: 100%;
        height: 100%;
        object-fit: cover;
        object-position: center 35%;
      }
    }

    /* Scrim oscuro (azul real de marca): oscurece de forma uniforme con un
       refuerzo en los bordes para que el contenido —ahora centrado— sea legible
       sobre cualquier foto, sin tapar del todo la imagen. */
    .hero__overlay {
      position: absolute;
      inset: 0;
      background:
        linear-gradient(180deg,
          rgba(0,19,93,.70) 0%,
          rgba(0,19,93,.40) 40%,
          rgba(0,19,93,.66) 100%),
        radial-gradient(130% 100% at 50% 32%,
          rgba(0,19,93,0) 42%,
          rgba(0,19,93,.34) 100%);

      @media (max-width: 768px) {
        background: linear-gradient(180deg,
          rgba(0,19,93,.72) 0%,
          rgba(0,19,93,.84) 55%,
          rgba(0,19,93,.90) 100%);
      }
    }

    .hero__inner {
      position: relative;
      z-index: 1;
      width: 100%;
    }

    .hero__content {
      max-width: 980px;
      margin-inline: auto;
      text-align: center;
      animation: fadeUp .7s ease both;
    }

    .hero__title {
      font-family: var(--font-accent);
      font-weight: var(--w-7);
      text-transform: uppercase;
      letter-spacing: -.02em;
      line-height: 1.12;
      font-size: clamp(2rem, 4.6vw, 3.125rem);
      margin-bottom: var(--sp-5);
      text-shadow: 0 2px 16px rgba(0,8,40,.45);
    }

    /* Texto claro sobre el scrim oscuro: máximo contraste + acento dorado de marca */
    .hero__title-blue { color: #FFFFFF; }
    .hero__title-gold { color: var(--dk-gold-light); }

    .hero__sub {
      font-size: var(--f-lg);
      color: rgba(255,255,255,.92);
      line-height: 1.7;
      max-width: 54ch;
      margin-inline: auto;
      margin-bottom: var(--sp-8);
      text-shadow: 0 1px 10px rgba(0,8,40,.35);
    }

    /* Panel de búsqueda centrado (ancho, tipo Booking) */
    .hero__panel {
      max-width: 960px;
      margin-inline: auto;
      animation: fadeUp .7s .15s ease both;
    }

    /* Toggle filtros ↔ IA (un clic) */
    .hero__modes {
      display: inline-flex;
      gap: var(--sp-1);
      padding: var(--sp-1);
      margin-bottom: var(--sp-4);
      background: rgba(255,255,255,.14);
      border: 1px solid rgba(255,255,255,.22);
      border-radius: var(--r-full);
      backdrop-filter: blur(8px);
    }

    .hero__mode {
      display: inline-flex;
      align-items: center;
      gap: var(--sp-2);
      padding: var(--sp-2) var(--sp-5);
      border: none;
      background: transparent;
      border-radius: var(--r-full);
      cursor: pointer;
      font-family: var(--font);
      font-size: var(--f-sm);
      font-weight: var(--w-6);
      color: rgba(255,255,255,.85);
      transition: background var(--d-2), color var(--d-2);

      &:hover { color: #fff; }
    }

    .hero__mode.is-active {
      background: var(--c-card);
      color: var(--dk-blue);
      box-shadow: var(--sh-md);
    }

    .hero__mode--ia.is-active { color: var(--dk-gold-text); }

    /* Barra de filtros horizontal */
    .hero__search {
      display: flex;
      align-items: flex-end;
      flex-wrap: wrap;
      gap: var(--sp-3);
      background: var(--c-card);
      border: 1px solid var(--b-1);
      border-radius: var(--r-lg);
      box-shadow: var(--sh-xl);
      padding: var(--sp-4);
      text-align: left;
    }

    .hero__field { display: flex; flex-direction: column; gap: var(--sp-1); min-width: 0; }
    .hero__field--service { flex: 1.4 1 155px; }
    .hero__field--city    { flex: 1.7 1 180px; }
    .hero__field--date    { flex: 1 1 140px; }
    .hero__field--dogs    { flex: .7 1 96px; }

    .hero__lbl {
      font-family: var(--font-accent);
      font-size: var(--f-xs);
      font-weight: var(--w-7);
      color: var(--t-400);
      letter-spacing: .08em;
      text-transform: uppercase;
    }

    .hero__inp-wrap {
      display: flex;
      align-items: center;
      gap: var(--sp-2);
      border: 1px solid var(--b-2);
      border-radius: var(--r-sm);
      padding-inline: var(--sp-3);
      background: var(--c-base);
      color: var(--t-400);
      transition: border-color var(--d-2), box-shadow var(--d-2);

      &:focus-within {
        border-color: var(--c-accent);
        box-shadow: 0 0 0 3px var(--c-accent-lo);
      }
    }

    .hero__inp {
      flex: 1;
      min-width: 0;
      border: none;
      outline: none;
      background: transparent;
      padding-block: var(--sp-3);
      font-size: var(--f-sm);
      color: var(--t-100);
      font-family: var(--font);

      &::placeholder { color: var(--t-500); }
    }

    .hero__inp--select { cursor: pointer; appearance: auto; }

    .hero__cta {
      flex: 0 0 auto;
      align-self: flex-end;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: var(--sp-2);
    }

    @media (max-width: 720px) {
      .hero__field { flex: 1 1 100%; }
      .hero__cta { width: 100%; }
    }

    /* Barra de búsqueda con IA */
    .hero__ai { text-align: left; }

    .hero__ai-bar {
      display: flex;
      align-items: center;
      gap: var(--sp-3);
      background: var(--c-card);
      border: 1px solid var(--b-1);
      border-radius: var(--r-full);
      box-shadow: var(--sh-xl);
      padding: var(--sp-2) var(--sp-2) var(--sp-2) var(--sp-5);
      transition: box-shadow var(--d-2);

      &:focus-within { box-shadow: var(--sh-xl), 0 0 0 3px var(--c-accent-lo); }

      @media (max-width: 480px) { border-radius: var(--r-lg); }
    }

    .hero__ai-bar.is-loading { opacity: .75; }

    .hero__ai-spark { color: var(--dk-gold); flex-shrink: 0; display: flex; }

    .hero__ai-input {
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

    .hero__ai-btn {
      flex: 0 0 auto;
      width: 52px;
      height: 52px;
      padding: 0;
      border-radius: var(--r-full);
      display: inline-flex;
      align-items: center;
      justify-content: center;
    }

    .hero__ai-spinner {
      width: 18px;
      height: 18px;
      border-radius: 50%;
      border: 2px solid rgba(0,19,93,.25);
      border-top-color: var(--dk-blue-deep);
      animation: heroSpin .7s linear infinite;
    }
    @keyframes heroSpin { to { transform: rotate(360deg); } }

    .hero__ai-hints {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: var(--sp-2);
      margin-top: var(--sp-3);
    }

    .hero__ai-hint-label { font-size: var(--f-xs); color: rgba(255,255,255,.72); }

    .hero__ai-chip {
      background: rgba(255,255,255,.12);
      border: 1px solid rgba(255,255,255,.22);
      color: rgba(255,255,255,.90);
      border-radius: var(--r-full);
      padding: var(--sp-1) var(--sp-3);
      font-size: var(--f-xs);
      cursor: pointer;
      transition: background var(--d-2), border-color var(--d-2);
      backdrop-filter: blur(4px);

      &:hover { background: rgba(255,255,255,.22); border-color: rgba(255,255,255,.40); }
    }

    .hero__ai-error {
      margin-top: var(--sp-3);
      font-size: var(--f-sm);
      color: rgba(255,224,224,.95);
      text-shadow: 0 1px 8px rgba(0,8,40,.40);
    }

    /* ── SECTION HEADERS ───────────────────────────────────────────── */
    .section-header {
      text-align: center;
      margin-bottom: var(--sp-12);

      h2 { margin-bottom: var(--sp-3); color: var(--dk-blue); }
      p  { color: var(--t-400); max-width: 52ch; margin-inline: auto; }
    }

    .section-header--left {
      text-align: left;
      p { margin-inline: 0; }
    }

    .services-gold { color: var(--dk-gold-text); }

    .section-cta {
      text-align: center;
      margin-top: var(--sp-10);

      a { display: inline-flex; align-items: center; gap: var(--sp-2); }
    }

    /* ── SERVICIOS (badges circulares) ─────────────────────────────── */
    .services-section { background: var(--c-base); }

    .services__row {
      display: flex;
      justify-content: center;
      align-items: flex-start;
      flex-wrap: wrap;
      row-gap: var(--sp-8);
    }

    .service-badge {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: var(--sp-3);
      padding-inline: var(--sp-8);
      text-decoration: none;
      transition: transform var(--d-2);

      &:hover { transform: translateY(-4px); }

      @media (min-width: 769px) {
        & + & { border-left: 1px solid var(--dk-divider); }
      }

      @media (max-width: 768px) { padding-inline: var(--sp-5); }
    }

    .service-badge__circle {
      width: 96px;
      height: 96px;
      border-radius: var(--r-full);
      overflow: hidden;
      box-shadow: var(--sh-md);
      border: 2px solid var(--c-card);

      img { width: 100%; height: 100%; object-fit: cover; }

      @media (max-width: 768px) { width: 80px; height: 80px; }
    }

    .service-badge__label {
      font-size: var(--f-sm);
      font-weight: var(--w-6);
      color: var(--t-200);
      text-align: center;
      max-width: 14ch;
      line-height: 1.35;
    }

    .service-badge:hover .service-badge__label { color: var(--dk-blue); }

    /* ── ALOJAMIENTOS RECOMENDADOS ─────────────────────────────────── */
    .recommended-section { background: var(--c-raised); }

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

      img {
        width: 100%;
        height: 100%;
        object-fit: cover;
        transition: transform var(--d-4);
      }
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

    .stay-card__body {
      padding: var(--sp-5);
      display: flex;
      flex-direction: column;
      flex: 1;
    }

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

    .stay-card__tags {
      display: flex;
      flex-wrap: wrap;
      gap: var(--sp-2);
      margin-bottom: var(--sp-4);
    }

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

    /* ── FOOTER navy ───────────────────────────────────────────────── */
    .home-footer {
      background: var(--dk-blue-deep);
      border-top: none;
    }

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

  readonly heroImg = BRAND.heroHome;
  readonly logoFooter = BRAND.logoFooter;

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

  readonly verticales: Vertical[] = [
    { key: VerticalKey.ALOJAMIENTO,    icon: 'hotel',          label: VERTICAL_LABELS[VerticalKey.ALOJAMIENTO],    route: VERTICAL_ROUTES['alojamiento'],    badge: CATEGORIA_BADGES['alojamiento'] },
    { key: VerticalKey.TRANSPORTE,     icon: 'truck',          label: VERTICAL_LABELS[VerticalKey.TRANSPORTE],     route: VERTICAL_ROUTES['transporte'],     badge: CATEGORIA_BADGES['transporte'] },
    { key: VerticalKey.VETERINARIA,    icon: 'stethoscope',    label: VERTICAL_LABELS[VerticalKey.VETERINARIA],    route: VERTICAL_ROUTES['veterinaria'],    badge: CATEGORIA_BADGES['veterinaria'] },
    { key: VerticalKey.PELUQUERIA,     icon: 'scissors',       label: VERTICAL_LABELS[VerticalKey.PELUQUERIA],     route: VERTICAL_ROUTES['peluqueria'],     badge: CATEGORIA_BADGES['peluqueria'] },
    { key: VerticalKey.ADIESTRAMIENTO, icon: 'graduation-cap', label: VERTICAL_LABELS[VerticalKey.ADIESTRAMIENTO], route: VERTICAL_ROUTES['adiestramiento'], badge: CATEGORIA_BADGES['adiestramiento'] },
    { key: VerticalKey.HOTELES,        icon: 'building',       label: VERTICAL_LABELS[VerticalKey.HOTELES],        route: VERTICAL_ROUTES['hoteles'],        badge: CATEGORIA_BADGES['hoteles'] },
  ];

  readonly searchForm = this.fb.group({
    vertical: [VerticalKey.ALOJAMIENTO as string],
    ciudad: [''],
    fechaInicio: [''],
    fechaFin: [''],
    perros: [1],
  });

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
