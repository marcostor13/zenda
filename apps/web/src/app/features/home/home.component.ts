import { Component, inject } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { VerticalKey, VERTICAL_LABELS } from 'shared';
import { AnimateOnScrollDirective } from '../../shared/directives/animate-on-scroll.directive';
import { ImgFallbackDirective } from '../../shared/directives/img-fallback.directive';
import { RsNavbarComponent } from '../../shared/components/navbar/rs-navbar.component';
import { RsIconComponent } from '../../shared/components/icon/rs-icon.component';
import { BRAND, CATEGORIA_BADGES, HOTEL_IMAGES } from '../../shared/media/images';

/** Ruta de navegación de cada categoría canina. */
const VERTICAL_ROUTES: Record<string, string> = {
  alojamiento: '/alojamiento',
  transporte: '/transporte',
  veterinaria: '/veterinaria',
  peluqueria: '/peluqueria',
  adiestramiento: '/adiestramiento',
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

        <!-- Card de búsqueda -->
        <form class="hero__search" [formGroup]="searchForm" (ngSubmit)="onBuscar()">
          <div class="hero__search-grid">
            <div class="hero__field">
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

            <div class="hero__field">
              <label class="hero__lbl" for="home-ciudad">Ciudad</label>
              <div class="hero__inp-wrap">
                <rs-icon name="map-pin" [size]="16" [stroke]="2"></rs-icon>
                <input id="home-ciudad" formControlName="ciudad" class="hero__inp"
                       placeholder="Madrid, Barcelona, Valencia…" />
              </div>
            </div>

            <div class="hero__field">
              <label class="hero__lbl" for="home-desde">Fechas</label>
              <div class="hero__dates">
                <div class="hero__inp-wrap">
                  <rs-icon name="calendar" [size]="16" [stroke]="2"></rs-icon>
                  <input id="home-desde" formControlName="fechaInicio" type="date" class="hero__inp" aria-label="Fecha de entrada" />
                </div>
                <div class="hero__inp-wrap">
                  <rs-icon name="calendar" [size]="16" [stroke]="2"></rs-icon>
                  <input formControlName="fechaFin" type="date" class="hero__inp" aria-label="Fecha de salida" />
                </div>
              </div>
            </div>

            <div class="hero__field">
              <label class="hero__lbl" for="home-perros">Nº de perros</label>
              <div class="hero__inp-wrap">
                <rs-icon name="paw" [size]="16" [stroke]="2"></rs-icon>
                <select id="home-perros" formControlName="perros" class="hero__inp hero__inp--select">
                  @for (n of [1,2,3,4]; track n) {
                    <option [value]="n">{{ n }} {{ n === 1 ? 'perro' : 'perros' }}</option>
                  }
                </select>
              </div>
            </div>
          </div>

          <button type="submit" class="rs-btn rs-btn--gold rs-btn--lg hero__cta">
            <rs-icon name="search" [size]="17" [stroke]="2.25"></rs-icon>
            Buscar
          </button>
        </form>
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

    /* Overlay claro y suave: legible a la izquierda, foto visible a la derecha */
    .hero__overlay {
      position: absolute;
      inset: 0;
      background: linear-gradient(90deg,
        rgba(248,249,250,.94) 0%,
        rgba(248,249,250,.78) 34%,
        rgba(248,249,250,.28) 62%,
        rgba(248,249,250,.05) 100%);

      @media (max-width: 768px) {
        background: rgba(248,249,250,.86);
      }
    }

    .hero__inner {
      position: relative;
      z-index: 1;
      width: 100%;
    }

    .hero__content {
      max-width: 560px;
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
    }

    .hero__title-blue { color: var(--dk-blue); }
    .hero__title-gold { color: var(--dk-gold); }

    .hero__sub {
      font-size: var(--f-lg);
      color: var(--t-300);
      line-height: 1.7;
      max-width: 46ch;
      margin-bottom: var(--sp-8);
    }

    /* Card de búsqueda blanca */
    .hero__search {
      background: var(--c-card);
      border: 1px solid var(--b-1);
      border-radius: var(--r-lg);
      box-shadow: var(--sh-xl);
      padding: var(--sp-5);
      max-width: 480px;
      animation: fadeUp .7s .15s ease both;
    }

    .hero__search-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: var(--sp-4);
      margin-bottom: var(--sp-5);

      @media (max-width: 480px) { grid-template-columns: 1fr; }
    }

    .hero__field { display: flex; flex-direction: column; gap: var(--sp-1); min-width: 0; }

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

    .hero__dates {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: var(--sp-2);
    }

    .hero__field:has(.hero__dates) { grid-column: 1 / -1; }

    .hero__cta {
      width: 100%;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: var(--sp-2);
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

    .services-gold { color: var(--dk-gold); }

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

  readonly heroImg = BRAND.heroHome;
  readonly logoFooter = BRAND.logoFooter;

  readonly verticales: Vertical[] = [
    { key: VerticalKey.ALOJAMIENTO,    icon: 'hotel',          label: VERTICAL_LABELS[VerticalKey.ALOJAMIENTO],    route: VERTICAL_ROUTES['alojamiento'],    badge: CATEGORIA_BADGES['alojamiento'] },
    { key: VerticalKey.TRANSPORTE,     icon: 'truck',          label: VERTICAL_LABELS[VerticalKey.TRANSPORTE],     route: VERTICAL_ROUTES['transporte'],     badge: CATEGORIA_BADGES['transporte'] },
    { key: VerticalKey.VETERINARIA,    icon: 'stethoscope',    label: VERTICAL_LABELS[VerticalKey.VETERINARIA],    route: VERTICAL_ROUTES['veterinaria'],    badge: CATEGORIA_BADGES['veterinaria'] },
    { key: VerticalKey.PELUQUERIA,     icon: 'scissors',       label: VERTICAL_LABELS[VerticalKey.PELUQUERIA],     route: VERTICAL_ROUTES['peluqueria'],     badge: CATEGORIA_BADGES['peluqueria'] },
    { key: VerticalKey.ADIESTRAMIENTO, icon: 'graduation-cap', label: VERTICAL_LABELS[VerticalKey.ADIESTRAMIENTO], route: VERTICAL_ROUTES['adiestramiento'], badge: CATEGORIA_BADGES['adiestramiento'] },
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
}
