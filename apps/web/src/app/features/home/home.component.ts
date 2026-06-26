import { Component, signal, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { DecimalPipe } from '@angular/common';
import { AnimateOnScrollDirective } from '../../shared/directives/animate-on-scroll.directive';
import { RsNavbarComponent } from '../../shared/components/navbar/rs-navbar.component';
import { RsIconComponent } from '../../shared/components/icon/rs-icon.component';

interface HotelDestacado {
  id: string;
  nombre: string;
  ciudad: string;
  barrio: string;
  estrellas: number;
  score: number;
  scoreLabel: string;
  numResenas: number;
  precioPorNoche: number;
  precioAnterior?: number;
  imagen: string;
  amenities: string[];
  cancelacionGratis: boolean;
  badges: string[];
}

interface Vertical {
  key: string;
  icon: string;
  label: string;
  desc: string;
  color: string;
  count: string;
}

interface Destino {
  ciudad: string;
  pais: string;
  imagen: string;
  hoteles: string;
  destacado?: boolean;
}

interface Testimonio {
  nombre: string;
  ciudad: string;
  initials: string;
  rating: number;
  texto: string;
  vertical: string;
}

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [RouterLink, ReactiveFormsModule, DecimalPipe, AnimateOnScrollDirective, RsNavbarComponent, RsIconComponent],
  template: `
<div class="home">
  <rs-navbar />

  <!-- ═══ HERO ════════════════════════════════════════════════════ -->
  <section class="hero">

    <!-- Foto de fondo (Budapest desde Pexels) -->
    <div class="hero__photo-bg">
      <img
        src="https://images.pexels.com/photos/7513451/pexels-photo-7513451.jpeg?auto=compress&cs=tinysrgb&w=1920"
        alt="Budapest, Europa"
        loading="eager"
        fetchpriority="high"
      />
      <div class="hero__photo-overlay"></div>
      <div class="hero__grid-lines"></div>
    </div>

    <!-- Orbs de acento (encima del overlay) -->
    <div class="hero__orb hero__orb--1"></div>
    <div class="hero__orb hero__orb--2"></div>

    <!-- Floats decorativos -->
    <div class="hero__float hero__float--1" aria-hidden="true">
      <rs-icon name="hotel" [size]="40" [stroke]="1.2"></rs-icon>
    </div>
    <div class="hero__float hero__float--2" aria-hidden="true">
      <rs-icon name="plane" [size]="40" [stroke]="1.2"></rs-icon>
    </div>
    <div class="hero__float hero__float--3" aria-hidden="true">
      <rs-icon name="star" [size]="40" [stroke]="1.2"></rs-icon>
    </div>
    <div class="hero__float hero__float--4" aria-hidden="true">
      <rs-icon name="globe" [size]="40" [stroke]="1.2"></rs-icon>
    </div>

    <div class="hero__inner rs-wrap">
      <div class="hero__badge">
        <span class="rs-live"></span>
        <span>+48,000 reservas este mes en Europa</span>
      </div>

      <h1 class="hero__title">
        Todo lo que necesitas,<br>
        <span class="rs-gradient-text">en un solo lugar</span>
      </h1>

      <p class="hero__sub">
        Hoteles, vuelos, taxis, transporte y guarderías en toda Europa.
        Compara precios, lee reseñas reales y reserva en segundos.
      </p>

      <!-- Selector de vertical -->
      <div class="rs-vtabs hero__vtabs">
        @for (v of verticales; track v.key) {
          <button
            class="rs-vtab"
            [class.active]="verticalActivo() === v.key"
            (click)="verticalActivo.set(v.key)">
            <rs-icon [name]="v.icon" [size]="15" [stroke]="2"></rs-icon>
            {{ v.label }}
          </button>
        }
      </div>

      <!-- Search widget -->
      <div class="rs-search hero__search">
        <form [formGroup]="searchForm" (ngSubmit)="onBuscar()">
          <div class="rs-search__row">
            <div class="rs-field">
              <label class="rs-lbl">
                <rs-icon name="map-pin" [size]="13" [stroke]="2"></rs-icon>
                Ciudad o zona
              </label>
              <input formControlName="ciudad" class="rs-inp rs-inp--lg"
                     placeholder="París, Barcelona, Roma…" />
            </div>
            <div class="rs-field">
              <label class="rs-lbl">
                <rs-icon name="calendar" [size]="13" [stroke]="2"></rs-icon>
                Desde
              </label>
              <input formControlName="fechaInicio" type="date" class="rs-inp rs-inp--lg" />
            </div>
            <div class="rs-field">
              <label class="rs-lbl">
                <rs-icon name="calendar" [size]="13" [stroke]="2"></rs-icon>
                Hasta
              </label>
              <input formControlName="fechaFin" type="date" class="rs-inp rs-inp--lg" />
            </div>
            <button type="submit" class="rs-btn rs-btn--primary rs-btn--lg hero__cta">
              <rs-icon name="search" [size]="18" [stroke]="2"></rs-icon>
              Buscar
            </button>
          </div>
        </form>
      </div>

      <!-- Trust chips -->
      <div class="hero__trust">
        <span class="hero__trust-chip">✓ Sin cargos ocultos</span>
        <span class="hero__trust-chip">✓ Cancelación gratis</span>
        <span class="hero__trust-chip">✓ Mejor precio garantizado</span>
        <span class="hero__trust-chip">✓ Atención 24/7</span>
      </div>
    </div>

    <!-- Chevron scroll hint -->
    <div class="hero__scroll-hint" aria-hidden="true">
      <rs-icon name="chevron-down" [size]="24" [stroke]="2"></rs-icon>
    </div>
  </section>

  <!-- ═══ STATS ════════════════════════════════════════════════════ -->
  <section class="stats">
    <div class="rs-wrap">
      <div class="stats__grid">
        @for (s of stats; track s.label) {
          <div class="stats__item" [rsAnim]="''" [rsAnimDelay]="s.delay">
            <div class="stats__value">{{ s.valor }}</div>
            <div class="stats__label">{{ s.label }}</div>
          </div>
        }
      </div>
    </div>
  </section>

  <!-- ═══ DESTINOS POPULARES ══════════════════════════════════════ -->
  <section class="rs-section destinations-section">
    <div class="rs-wrap">
      <div class="section-header" rsAnim>
        <span class="rs-label-caps">Explora</span>
        <h2 class="rs-h2">Destinos <span class="rs-gradient-text">europeos</span></h2>
        <p>Los destinos más reservados por viajeros este mes.</p>
      </div>

      <div class="destinations-grid">
        @for (d of destinos; track d.ciudad) {
          <a class="dest-card" [class.dest-card--featured]="d.destacado"
             [routerLink]="['/buscar']" [queryParams]="{vertical: 'hoteles', ciudad: d.ciudad}"
             [rsAnim]="''" [rsAnimDelay]="$index * 70">
            <img [src]="d.imagen" [alt]="d.ciudad + ', ' + d.pais" loading="lazy" />
            <div class="dest-card__overlay"></div>
            <div class="dest-card__info">
              <div class="dest-card__city">{{ d.ciudad }}</div>
              <div class="dest-card__meta">{{ d.pais }} · {{ d.hoteles }}</div>
            </div>
          </a>
        }
      </div>
    </div>
  </section>

  <!-- ═══ VERTICALES ══════════════════════════════════════════════ -->
  <section class="rs-section verticals-section">
    <div class="rs-wrap">
      <div class="section-header" rsAnim>
        <span class="rs-label-caps">Servicios</span>
        <h2 class="rs-h2">5 verticales, <span class="rs-gradient-text">una plataforma</span></h2>
        <p>Desde alojamiento hasta cuidado infantil — todo en Zenda.</p>
      </div>

      <div class="verticals__grid">
        @for (v of verticales; track v.key) {
          <a [routerLink]="['/buscar']" [queryParams]="{vertical: v.key}"
             class="vertical-card rs-card rs-card--hover"
             [rsAnim]="''" [rsAnimDelay]="$index * 80">
            <div class="vertical-card__icon" [style]="'background:' + v.color">
              <rs-icon [name]="v.icon" [size]="28" [stroke]="1.5"></rs-icon>
            </div>
            <div class="vertical-card__body">
              <h3 class="vertical-card__name">{{ v.label }}</h3>
              <p class="vertical-card__desc">{{ v.desc }}</p>
              <div class="vertical-card__count">{{ v.count }}</div>
            </div>
            <div class="vertical-card__arrow">
              <rs-icon name="arrow-right" [size]="18" [stroke]="2"></rs-icon>
            </div>
          </a>
        }
      </div>
    </div>
  </section>

  <!-- ═══ HOTELES DESTACADOS ══════════════════════════════════════ -->
  <section class="rs-section featured-section">
    <div class="rs-wrap">
      <div class="section-header" rsAnim>
        <span class="rs-label-caps">Tendencias</span>
        <h2 class="rs-h2">Hoteles más <span class="rs-gradient-text">populares</span></h2>
        <p>Los alojamientos mejor valorados por nuestros huéspedes este mes.</p>
      </div>

      <div class="hotels-grid">
        @for (h of hotelesDestacados; track h.id) {
          <a [routerLink]="['/hoteles', h.id]" class="rs-hotel-card"
             [rsAnim]="''" [rsAnimDelay]="$index * 60">

            <div class="rs-hotel-card__img">
              <img [src]="h.imagen" [alt]="h.nombre" loading="lazy" />
              <div class="rs-hotel-card__img-badges">
                @for (b of h.badges; track b) {
                  <span class="rs-badge rs-badge--accent">{{ b }}</span>
                }
              </div>
              <button class="rs-hotel-card__wishlist" (click)="$event.preventDefault()">
                <rs-icon name="heart" [size]="16" [stroke]="2"></rs-icon>
              </button>
            </div>

            <div class="rs-hotel-card__body">
              <div class="rs-hotel-card__stars">{{ estrellas(h.estrellas) }}</div>
              <div class="rs-hotel-card__name">{{ h.nombre }}</div>
              <div class="rs-hotel-card__loc">
                <rs-icon name="map-pin" [size]="13" [stroke]="2"></rs-icon>
                {{ h.barrio }}, {{ h.ciudad }}
              </div>

              <div class="rs-hotel-card__amenities">
                @for (a of h.amenities.slice(0,3); track a) {
                  <span class="rs-amenity">{{ a }}</span>
                }
              </div>

              <div class="rs-hotel-card__footer">
                <div class="rs-rating">
                  <div class="rs-rating__score">{{ h.score }}</div>
                  <div>
                    <div class="rs-rating__label">{{ h.scoreLabel }}</div>
                    <div class="rs-rating__count">{{ h.numResenas | number:'1.0-0' }} reseñas</div>
                  </div>
                </div>
                <div style="text-align:right">
                  @if (h.precioAnterior) {
                    <div class="rs-price__old">€ {{ h.precioAnterior }}</div>
                  }
                  <div class="rs-price__amount">€ {{ h.precioPorNoche }}</div>
                  <div class="rs-price__period">/noche</div>
                  @if (h.cancelacionGratis) {
                    <div class="rs-hotel-card__cancel">✓ Cancelación gratis</div>
                  }
                </div>
              </div>
            </div>
          </a>
        }
      </div>

      <div class="section-cta" rsAnim>
        <a routerLink="/buscar" [queryParams]="{vertical:'hoteles'}" class="rs-btn rs-btn--secondary rs-btn--lg">
          Ver todos los hoteles
          <rs-icon name="arrow-right" [size]="16" [stroke]="2"></rs-icon>
        </a>
      </div>
    </div>
  </section>

  <!-- ═══ CÓMO FUNCIONA ═══════════════════════════════════════════ -->
  <section class="rs-section how-section">
    <div class="rs-wrap">
      <div class="section-header" rsAnim>
        <span class="rs-label-caps">Proceso</span>
        <h2 class="rs-h2">Reservar nunca fue <span class="rs-gradient-text">tan fácil</span></h2>
      </div>

      <div class="how-grid">
        @for (step of pasos; track step.num) {
          <div class="how-step" [rsAnim]="''" [rsAnimDelay]="$index * 100">
            <div class="how-step__num">{{ step.num }}</div>
            <div class="how-step__icon">
              <rs-icon [name]="step.icon" [size]="36" [stroke]="1.5"></rs-icon>
            </div>
            <h3 class="how-step__title">{{ step.title }}</h3>
            <p class="how-step__desc">{{ step.desc }}</p>
          </div>
        }
      </div>
    </div>
  </section>

  <!-- ═══ BENEFICIOS ══════════════════════════════════════════════ -->
  <section class="rs-section benefits-section">
    <div class="rs-wrap">
      <div class="benefits-grid">
        <div class="benefits-text" rsAnim="from-left">
          <span class="rs-label-caps">¿Por qué Zenda?</span>
          <h2 class="rs-h2" style="margin-top:var(--sp-4)">La plataforma que trabaja <span class="rs-gradient-text">para ti</span></h2>
          <p style="margin-top:var(--sp-4);color:var(--t-300);line-height:1.8">
            Compara precios reales de cientos de proveedores verificados en Europa.
            Sin comisiones ocultas, sin sorpresas al momento de pagar.
            Tu dinero y tu tiempo valen.
          </p>
          <div class="benefits-features">
            @for (f of beneficios; track f.title) {
              <div class="benefit-item">
                <div class="benefit-item__icon">
                  <rs-icon [name]="f.icon" [size]="20" [stroke]="2"></rs-icon>
                </div>
                <div>
                  <div class="benefit-item__title">{{ f.title }}</div>
                  <div class="benefit-item__desc">{{ f.desc }}</div>
                </div>
              </div>
            }
          </div>
        </div>

        <div class="benefits-visual" rsAnim="from-right">
          <div class="bv-card bv-card--main">
            <rs-icon name="star" [size]="32" [stroke]="1.5" style="color:var(--c-amber)"></rs-icon>
            <div style="font-size:var(--f-3xl);font-weight:var(--w-9);color:var(--t-100);letter-spacing:-.04em;margin-top:var(--sp-3)">4.8</div>
            <div style="font-size:var(--f-sm);color:var(--t-300)">Calificación promedio</div>
            <div style="font-size:var(--f-xs);color:var(--t-400);margin-top:var(--sp-2)">Basado en +32,000 reseñas</div>
          </div>
          <div class="bv-card bv-card--sec">
            <rs-icon name="plane" [size]="20" [stroke]="1.75"></rs-icon>
            <div style="font-size:var(--f-sm);font-weight:var(--w-6);color:var(--t-100);margin-top:var(--sp-2)">Madrid → París</div>
            <div style="font-size:var(--f-xs);color:var(--t-400)">Vuelo directo · € 89</div>
          </div>
          <div class="bv-card bv-card--tert">
            <rs-icon name="car" [size]="20" [stroke]="1.75"></rs-icon>
            <div style="font-size:var(--f-sm);font-weight:var(--w-6);color:var(--t-100);margin-top:var(--sp-2)">Taxi en camino</div>
            <div style="font-size:var(--f-xs);color:var(--t-400)">Estimado 4 min · € 12</div>
            <div style="margin-top:var(--sp-3)"><span class="rs-badge rs-badge--success">En ruta</span></div>
          </div>
        </div>
      </div>
    </div>
  </section>

  <!-- ═══ TESTIMONIOS ══════════════════════════════════════════════ -->
  <section class="rs-section testimonials-section">
    <div class="rs-wrap">
      <div class="section-header" rsAnim>
        <span class="rs-label-caps">Clientes reales</span>
        <h2 class="rs-h2">Lo que dicen nuestros <span class="rs-gradient-text">viajeros</span></h2>
      </div>

      <div class="testimonials-grid">
        @for (t of testimonios; track t.nombre) {
          <div class="testimonial-card rs-card" [rsAnim]="''" [rsAnimDelay]="$index * 80">
            <div class="testimonial-card__header">
              <div class="testimonial-card__avatar">{{ t.initials }}</div>
              <div>
                <div class="testimonial-card__name">{{ t.nombre }}</div>
                <div class="testimonial-card__city">{{ t.ciudad }}</div>
              </div>
              <div class="testimonial-card__badge">
                <span class="rs-badge rs-badge--neutral">{{ t.vertical }}</span>
              </div>
            </div>
            <div class="testimonial-card__stars">{{ estrellas(t.rating) }}</div>
            <p class="testimonial-card__text">"{{ t.texto }}"</p>
          </div>
        }
      </div>
    </div>
  </section>

  <!-- ═══ CTA FINAL ════════════════════════════════════════════════ -->
  <section class="cta-section" rsAnim>
    <div class="rs-wrap">
      <div class="cta-box">
        <div class="cta-box__photo-bg">
          <img
            src="https://images.pexels.com/photos/29731407/pexels-photo-29731407.jpeg?auto=compress&cs=tinysrgb&w=1200"
            alt="París de noche"
            loading="lazy"
          />
          <div class="cta-box__photo-overlay"></div>
        </div>
        <div class="cta-box__content">
          <h2 class="rs-h2">¿Listo para tu próxima <span class="rs-gradient-text">aventura europea</span>?</h2>
          <p>Únete a +120,000 viajeros que ya reservan con Zenda en toda Europa.</p>
          <div class="cta-box__actions">
            <a routerLink="/auth/registro" class="rs-btn rs-btn--primary rs-btn--xl">
              Crear cuenta gratis
            </a>
            <a routerLink="/buscar" class="rs-btn rs-btn--secondary rs-btn--xl">
              Explorar servicios
            </a>
          </div>
        </div>
      </div>
    </div>
  </section>

  <!-- ═══ FOOTER ═══════════════════════════════════════════════════ -->
  <footer class="rs-footer">
    <div class="rs-footer__grid">
      <div class="rs-footer__brand">
        <img src="/githubspec-kit.png" alt="Zenda" style="height:44px;width:auto;display:block;margin-bottom:var(--sp-4);filter:brightness(0) invert(1)" />
        <p>El marketplace de reservas líder en Europa. Hoteles, vuelos, taxis, transporte y guarderías.</p>
        <div style="margin-top:var(--sp-4);display:flex;gap:var(--sp-3)">
          <span class="rs-badge rs-badge--neutral">
            <rs-icon name="globe" [size]="12" [stroke]="2"></rs-icon>
            Europa
          </span>
          <span class="rs-badge rs-badge--success">
            <rs-icon name="euro" [size]="12" [stroke]="2"></rs-icon>
            EUR
          </span>
        </div>
      </div>
      <div class="rs-footer__col">
        <h4>Servicios</h4>
        <ul>
          <li><a routerLink="/buscar" [queryParams]="{vertical:'hoteles'}">Hoteles</a></li>
          <li><a routerLink="/buscar" [queryParams]="{vertical:'vuelos'}">Vuelos</a></li>
          <li><a routerLink="/buscar" [queryParams]="{vertical:'taxis'}">Taxis</a></li>
          <li><a routerLink="/buscar" [queryParams]="{vertical:'transporte'}">Transporte</a></li>
          <li><a routerLink="/buscar" [queryParams]="{vertical:'guarderia'}">Guarderías</a></li>
        </ul>
      </div>
      <div class="rs-footer__col">
        <h4>Empresa</h4>
        <ul>
          <li><a routerLink="/nosotros">Nosotros</a></li>
          <li><a routerLink="/proveedores">Para proveedores</a></li>
          <li><a routerLink="/blog">Blog</a></li>
          <li><a routerLink="/prensa">Prensa</a></li>
          <li><a routerLink="/empleo">Empleos</a></li>
        </ul>
      </div>
      <div class="rs-footer__col">
        <h4>Soporte</h4>
        <ul>
          <li><a routerLink="/ayuda">Centro de ayuda</a></li>
          <li><a routerLink="/contacto">Contacto</a></li>
          <li><a routerLink="/cancelaciones">Cancelaciones</a></li>
          <li><a routerLink="/seguridad">Seguridad</a></li>
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
      <p>© 2026 Zenda · Todos los derechos reservados</p>
      <div class="rs-flex rs-gap-4" style="flex-wrap:wrap">
        <span class="rs-badge rs-badge--neutral">IVA 21% incluido</span>
        <span class="rs-badge rs-badge--accent">Pagos seguros Stripe</span>
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
      min-height: 92vh;
      display: flex;
      align-items: center;
      overflow: hidden;
      padding-block: var(--sp-24) var(--sp-20);
    }

    /* Foto de fondo */
    .hero__photo-bg {
      position: absolute;
      inset: 0;
      z-index: 0;
      /* Respaldo si la foto no carga: degradado azul oscuro para el texto blanco. */
      background: linear-gradient(135deg, #0B1B33 0%, #143C7A 55%, #1668E3 100%);

      img {
        width: 100%;
        height: 100%;
        object-fit: cover;
        object-position: center 40%;
      }
    }

    .hero__photo-overlay {
      position: absolute;
      inset: 0;
      background:
        linear-gradient(to bottom,
          rgba(6,13,27,.55) 0%,
          rgba(6,13,27,.70) 50%,
          rgba(6,13,27,.92) 100%);
    }

    /* Grid sutil encima del overlay */
    .hero__grid-lines {
      position: absolute;
      inset: 0;
      background-image:
        linear-gradient(rgba(84,114,248,.05) 1px, transparent 1px),
        linear-gradient(90deg, rgba(84,114,248,.05) 1px, transparent 1px);
      background-size: 60px 60px;
      mask-image: radial-gradient(ellipse 80% 80% at 50% 0%, black 0%, transparent 100%);
    }

    /* Orbs de acento */
    .hero__orb {
      position: absolute;
      border-radius: 50%;
      filter: blur(90px);
      z-index: 1;
      pointer-events: none;
    }
    .hero__orb--1 {
      width: 500px; height: 500px;
      top: -150px; left: -80px;
      background: rgba(84,114,248,.18);
      animation: floatSlow 14s ease-in-out infinite;
    }
    .hero__orb--2 {
      width: 400px; height: 400px;
      top: -80px; right: -120px;
      background: rgba(155,92,246,.12);
      animation: floatSlow 18s ease-in-out infinite reverse;
    }

    /* Floats decorativos */
    .hero__float {
      position: absolute;
      opacity: .14;
      pointer-events: none;
      filter: blur(1px);
      z-index: 2;
      color: #fff;
    }
    .hero__float--1 { top: 15%; left: 6%;  animation: float 8s ease-in-out infinite; }
    .hero__float--2 { top: 20%; right: 8%; animation: float 10s ease-in-out infinite 2s; }
    .hero__float--3 { bottom: 30%; left: 10%; animation: float 9s ease-in-out infinite 4s; }
    .hero__float--4 { bottom: 25%; right: 6%; animation: float 11s ease-in-out infinite 1s; }

    .hero__inner {
      position: relative;
      z-index: 3;
      text-align: center;
      animation: fadeUp .7s ease both;
    }

    .hero__badge {
      display: inline-flex;
      align-items: center;
      gap: var(--sp-2);
      padding: var(--sp-2) var(--sp-4);
      background: rgba(84,114,248,.15);
      border: 1px solid rgba(84,114,248,.30);
      border-radius: var(--r-full);
      font-size: var(--f-xs);
      font-weight: var(--w-6);
      color: #7AA3FF;
      letter-spacing: .04em;
      text-transform: uppercase;
      margin-bottom: var(--sp-6);
      backdrop-filter: blur(8px);
    }

    .hero__title {
      font-size: var(--f-hero);
      font-weight: var(--w-9);
      letter-spacing: -.04em;
      line-height: 1.05;
      color: #fff;
      margin-bottom: var(--sp-5);
      animation: fadeUp .7s .1s ease both;
      text-shadow: 0 2px 24px rgba(0,0,0,.4);
    }

    .hero__sub {
      font-size: var(--f-lg);
      color: rgba(216,225,247,.85);
      max-width: 56ch;
      margin-inline: auto;
      line-height: 1.7;
      margin-bottom: var(--sp-8);
      animation: fadeUp .7s .2s ease both;
    }

    .hero__vtabs {
      justify-content: center;
      margin-bottom: var(--sp-5);
      animation: fadeUp .7s .3s ease both;
    }

    .hero__search {
      max-width: 860px;
      margin-inline: auto;
      animation: fadeUp .7s .4s ease both;
      background: rgba(255,255,255,.97);
      backdrop-filter: blur(20px);
      -webkit-backdrop-filter: blur(20px);
      border-color: rgba(11,27,51,.10);
      box-shadow: var(--sh-xl);
    }

    .hero__cta {
      align-self: flex-end;
      display: inline-flex;
      align-items: center;
      gap: var(--sp-2);
    }

    .hero__trust {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: var(--sp-5);
      flex-wrap: wrap;
      margin-top: var(--sp-6);
      animation: fadeUp .7s .5s ease both;
    }

    .hero__trust-chip {
      font-size: var(--f-xs);
      color: rgba(216,225,247,.7);
      letter-spacing: .02em;
    }

    /* Scroll hint */
    .hero__scroll-hint {
      position: absolute;
      bottom: var(--sp-6);
      left: 50%;
      transform: translateX(-50%);
      z-index: 3;
      color: rgba(255,255,255,.35);
      animation: float 3s ease-in-out infinite;
    }

    /* ── STATS ──────────────────────────────────────────────────────── */
    .stats {
      border-top: 1px solid var(--b-1);
      border-bottom: 1px solid var(--b-1);
      background: var(--c-raised);
      padding-block: var(--sp-10);
    }

    .stats__grid {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: var(--sp-8);

      @media (max-width: 640px) { grid-template-columns: repeat(2, 1fr); }
    }

    .stats__item {
      text-align: center;
      padding: var(--sp-4);
      border-left: 1px solid var(--b-1);

      &:first-child { border-left: none; }

      @media (max-width: 640px) {
        &:nth-child(odd) { border-left: none; }
      }
    }

    .stats__value {
      font-size: var(--f-4xl);
      font-weight: var(--w-9);
      letter-spacing: -.04em;
      background: var(--g-accent);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      background-clip: text;
      line-height: 1;
      margin-bottom: var(--sp-2);
    }

    .stats__label {
      font-size: var(--f-sm);
      color: var(--t-400);
    }

    /* ── DESTINOS ───────────────────────────────────────────────────── */
    .destinations-section {
      background: var(--c-raised);
    }

    .destinations-grid {
      display: grid;
      grid-template-columns: repeat(6, 1fr);
      grid-template-rows: 240px 180px;
      gap: var(--sp-3);

      @media (max-width: 1024px) {
        grid-template-columns: repeat(3, 1fr);
        grid-template-rows: auto;
      }
      @media (max-width: 640px) {
        grid-template-columns: repeat(2, 1fr);
      }
    }

    .dest-card {
      position: relative;
      overflow: hidden;
      border-radius: var(--r-xl);
      cursor: pointer;
      display: block;
      transition: transform var(--d-3);
      background: linear-gradient(135deg, #143C7A 0%, #1668E3 100%);

      &--featured {
        grid-column: span 2;
        grid-row: span 2;

        @media (max-width: 1024px) {
          grid-column: span 2;
          grid-row: span 1;
        }
      }

      &:not(&--featured) {
        grid-column: span 2;

        @media (max-width: 1024px) {
          grid-column: span 1;
        }
        @media (max-width: 640px) {
          grid-column: span 1;
        }
      }

      img {
        width: 100%;
        height: 100%;
        object-fit: cover;
        transition: transform var(--d-4);
      }

      &:hover img { transform: scale(1.06); }
      &:hover { transform: none; }
    }

    .dest-card__overlay {
      position: absolute;
      inset: 0;
      background: linear-gradient(to top, rgba(6,13,27,.85) 0%, rgba(6,13,27,.1) 60%);
    }

    .dest-card__info {
      position: absolute;
      bottom: var(--sp-4);
      left: var(--sp-4);
      right: var(--sp-4);
    }

    .dest-card__city {
      font-size: var(--f-xl);
      font-weight: var(--w-8);
      color: #fff;
      letter-spacing: -.02em;
      line-height: 1.2;

      .dest-card--featured & { font-size: var(--f-3xl); }
    }

    .dest-card__meta {
      font-size: var(--f-xs);
      color: rgba(216,225,247,.7);
      margin-top: var(--sp-1);
    }

    /* ── SECTION COMMON ─────────────────────────────────────────────── */
    .section-header {
      text-align: center;
      margin-bottom: var(--sp-12);

      span { margin-bottom: var(--sp-3); display: block; }
      h2 { margin-bottom: var(--sp-4); }
      p { color: var(--t-300); max-width: 52ch; margin-inline: auto; }
    }

    .section-cta {
      text-align: center;
      margin-top: var(--sp-10);

      a {
        display: inline-flex;
        align-items: center;
        gap: var(--sp-2);
      }
    }

    /* ── VERTICALS ──────────────────────────────────────────────────── */
    .verticals-section {
      background: linear-gradient(180deg, var(--c-base) 0%, var(--c-raised) 100%);
    }

    .verticals__grid {
      display: grid;
      grid-template-columns: repeat(5, 1fr);
      gap: var(--sp-4);

      @media (max-width: 1024px) { grid-template-columns: repeat(3, 1fr); }
      @media (max-width: 640px)  { grid-template-columns: repeat(2, 1fr); }
    }

    .vertical-card {
      display: flex;
      flex-direction: column;
      padding: var(--sp-6);
      gap: var(--sp-4);
      cursor: pointer;
      transition: all var(--d-3);
      text-decoration: none;

      &:hover {
        transform: translateY(-6px);
        border-color: var(--b-a);
        box-shadow: var(--sh-lg), var(--sh-glow);
      }
    }

    .vertical-card__icon {
      width: 56px;
      height: 56px;
      border-radius: var(--r-xl);
      display: flex;
      align-items: center;
      justify-content: center;
      color: var(--t-100);
    }

    .vertical-card__name {
      font-size: var(--f-md);
      font-weight: var(--w-7);
      color: var(--t-100);
      line-height: 1.3;
    }

    .vertical-card__desc {
      font-size: var(--f-xs);
      color: var(--t-400);
      line-height: 1.6;
      flex: 1;
      margin-top: var(--sp-2);
    }

    .vertical-card__count {
      font-size: var(--f-xs);
      font-weight: var(--w-6);
      color: #7AA3FF;
      margin-top: var(--sp-2);
    }

    .vertical-card__arrow {
      color: var(--t-500);
      display: flex;
      align-items: center;
      transition: transform var(--d-2), color var(--d-2);
      align-self: flex-end;
    }

    .vertical-card:hover .vertical-card__arrow { transform: translateX(4px); color: var(--t-200); }

    /* ── HOTELS ─────────────────────────────────────────────────────── */
    .featured-section {
      background: var(--c-base);
    }

    .hotels-grid {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: var(--sp-5);

      @media (max-width: 1024px) { grid-template-columns: repeat(2, 1fr); }
      @media (max-width: 640px)  { grid-template-columns: 1fr; }
    }

    .rs-hotel-card__loc {
      display: flex;
      align-items: center;
      gap: 4px;
    }

    .rs-price__amount {
      font-size: var(--f-xl);
      font-weight: var(--w-8);
      color: var(--t-100);
    }

    .rs-price__old {
      font-size: var(--f-sm);
      color: var(--t-400);
      text-decoration: line-through;
    }

    .rs-price__period {
      font-size: var(--f-xs);
      color: var(--t-400);
    }

    /* ── HOW IT WORKS ───────────────────────────────────────────────── */
    .how-section { background: var(--c-raised); }

    .how-grid {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: var(--sp-6);

      @media (max-width: 768px) { grid-template-columns: repeat(2, 1fr); }
    }

    .how-step {
      text-align: center;
      padding: var(--sp-6);
      border: 1px solid var(--b-1);
      border-radius: var(--r-xl);
      background: var(--c-card);
      transition: all var(--d-3);

      &:hover { border-color: var(--b-a); box-shadow: var(--sh-glow); transform: translateY(-4px); }
    }

    .how-step__num {
      font-size: var(--f-xs);
      font-weight: var(--w-8);
      letter-spacing: .1em;
      color: var(--c-accent);
      margin-bottom: var(--sp-4);
    }

    .how-step__icon {
      display: flex;
      align-items: center;
      justify-content: center;
      margin-bottom: var(--sp-4);
      color: var(--c-accent);
    }

    .how-step__title {
      font-size: var(--f-md);
      font-weight: var(--w-7);
      color: var(--t-100);
      margin-bottom: var(--sp-3);
    }

    .how-step__desc { font-size: var(--f-sm); color: var(--t-400); line-height: 1.6; }

    /* ── BENEFITS ───────────────────────────────────────────────────── */
    .benefits-section { background: linear-gradient(180deg, var(--c-base) 0%, var(--c-raised) 100%); }

    .benefits-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: var(--sp-16);
      align-items: center;

      @media (max-width: 768px) { grid-template-columns: 1fr; }
    }

    .benefits-features {
      display: flex;
      flex-direction: column;
      gap: var(--sp-5);
      margin-top: var(--sp-8);
    }

    .benefit-item {
      display: flex;
      gap: var(--sp-4);
      align-items: flex-start;
    }

    .benefit-item__icon {
      width: 40px;
      height: 40px;
      background: var(--c-accent-lo);
      border: 1px solid rgba(84,114,248,.2);
      border-radius: var(--r-lg);
      display: flex;
      align-items: center;
      justify-content: center;
      color: var(--c-accent);
      flex-shrink: 0;
    }

    .benefit-item__title { font-size: var(--f-sm); font-weight: var(--w-6); color: var(--t-100); margin-bottom: 4px; }
    .benefit-item__desc  { font-size: var(--f-xs); color: var(--t-400); }

    .benefits-visual {
      position: relative;
      height: 420px;

      @media (max-width: 768px) { height: 300px; }
    }

    .bv-card {
      position: absolute;
      background: var(--c-card);
      border: 1px solid var(--b-2);
      border-radius: var(--r-xl);
      padding: var(--sp-6);
      box-shadow: var(--sh-lg);
      color: var(--t-300);
    }
    .bv-card--main {
      width: 220px;
      top: 0; left: 50%;
      transform: translateX(-50%);
      text-align: center;
      animation: floatSlow 7s ease-in-out infinite;
      z-index: 2;
    }
    .bv-card--sec {
      width: 180px;
      top: 40%; left: 0;
      animation: floatSlow 9s ease-in-out infinite 2s;
      z-index: 1;
    }
    .bv-card--tert {
      width: 180px;
      top: 45%; right: 0;
      animation: floatSlow 8s ease-in-out infinite 1s;
      z-index: 1;
    }

    /* ── TESTIMONIALS ───────────────────────────────────────────────── */
    .testimonials-section { background: var(--c-raised); }

    .testimonials-grid {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: var(--sp-5);

      @media (max-width: 768px) { grid-template-columns: 1fr; }
    }

    .testimonial-card {
      padding: var(--sp-6);
      transition: all var(--d-3);

      &:hover { border-color: var(--b-a); transform: translateY(-4px); box-shadow: var(--sh-glow); }
    }

    .testimonial-card__header {
      display: flex;
      align-items: center;
      gap: var(--sp-3);
      margin-bottom: var(--sp-4);
    }

    .testimonial-card__avatar {
      width: 44px; height: 44px;
      background: var(--g-accent);
      border-radius: var(--r-full);
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: var(--f-sm);
      font-weight: var(--w-7);
      color: white;
      flex-shrink: 0;
      letter-spacing: .02em;
    }

    .testimonial-card__name { font-size: var(--f-sm); font-weight: var(--w-6); color: var(--t-100); }
    .testimonial-card__city { font-size: var(--f-xs); color: var(--t-400); }
    .testimonial-card__badge { margin-left: auto; }
    .testimonial-card__stars { font-size: var(--f-sm); color: var(--c-amber); margin-bottom: var(--sp-3); }
    .testimonial-card__text { font-size: var(--f-sm); color: var(--t-300); line-height: 1.7; }

    /* ── CTA ────────────────────────────────────────────────────────── */
    .cta-section { padding-block: var(--sp-24); }

    .cta-box {
      position: relative;
      border: 1px solid rgba(84,114,248,.2);
      border-radius: var(--r-2xl);
      overflow: hidden;
      padding: var(--sp-16) var(--sp-8);
      text-align: center;
      min-height: 360px;
      display: flex;
      align-items: center;
      justify-content: center;
    }

    .cta-box__photo-bg {
      position: absolute;
      inset: 0;
      z-index: 0;

      img {
        width: 100%;
        height: 100%;
        object-fit: cover;
        object-position: center;
      }
    }

    .cta-box__photo-overlay {
      position: absolute;
      inset: 0;
      background: linear-gradient(135deg, rgba(6,13,27,.85) 0%, rgba(84,114,248,.25) 100%);
    }

    .cta-box__content {
      position: relative;
      z-index: 1;

      h2 { margin-bottom: var(--sp-4); }
      p  { color: var(--t-300); }
    }

    .cta-box__actions {
      display: flex;
      justify-content: center;
      gap: var(--sp-4);
      flex-wrap: wrap;
      margin-top: var(--sp-8);
    }
  `],
})
export class HomeComponent {
  private readonly router = inject(Router);
  private readonly fb = inject(FormBuilder);

  readonly verticalActivo = signal('hoteles');

  readonly searchForm = this.fb.group({ ciudad: [''], fechaInicio: [''], fechaFin: [''] });

  readonly verticales: Vertical[] = [
    { key: 'hoteles',    icon: 'hotel',  label: 'Hoteles',    desc: 'Habitaciones y alojamiento por noches', color: 'rgba(84,114,248,.15)',  count: '+1,200 propiedades' },
    { key: 'vuelos',     icon: 'plane',  label: 'Vuelos',     desc: 'Vuelos nacionales e internacionales',   color: 'rgba(0,201,177,.15)',   count: '+380 rutas activas' },
    { key: 'taxis',      icon: 'car',    label: 'Taxis',      desc: 'Traslados on-demand y programados',     color: 'rgba(245,158,11,.15)',  count: '+4,500 conductores' },
    { key: 'transporte', icon: 'truck',  label: 'Transporte', desc: 'Carga, mudanzas y logística',           color: 'rgba(155,92,246,.15)',  count: '+320 empresas' },
    { key: 'guarderia',  icon: 'users',  label: 'Guarderías', desc: 'Cuidado infantil con cupos por edad',   color: 'rgba(236,72,153,.15)',  count: '+180 centros' },
  ];

  readonly stats = [
    { valor: '+48K',  label: 'Reservas este mes',     delay: 0 },
    { valor: '+2.4K', label: 'Proveedores activos',    delay: 80 },
    { valor: '4.8★',  label: 'Calificación promedio',  delay: 160 },
    { valor: '+120K', label: 'Usuarios registrados',   delay: 240 },
  ];

  readonly destinos: Destino[] = [
    {
      ciudad: 'París',
      pais: 'Francia',
      imagen: 'https://images.pexels.com/photos/29395092/pexels-photo-29395092.jpeg?auto=compress&cs=tinysrgb&w=800',
      hoteles: '+650 alojamientos',
      destacado: true,
    },
    {
      ciudad: 'Barcelona',
      pais: 'España',
      imagen: 'https://images.pexels.com/photos/5005639/pexels-photo-5005639.jpeg?auto=compress&cs=tinysrgb&w=600',
      hoteles: '+480 alojamientos',
    },
    {
      ciudad: 'Roma',
      pais: 'Italia',
      imagen: 'https://images.pexels.com/photos/15562413/pexels-photo-15562413.jpeg?auto=compress&cs=tinysrgb&w=600',
      hoteles: '+390 alojamientos',
    },
    {
      ciudad: 'Ámsterdam',
      pais: 'Países Bajos',
      imagen: 'https://images.pexels.com/photos/12705128/pexels-photo-12705128.jpeg?auto=compress&cs=tinysrgb&w=600',
      hoteles: '+280 alojamientos',
    },
    {
      ciudad: 'Londres',
      pais: 'Reino Unido',
      imagen: 'https://images.pexels.com/photos/11567961/pexels-photo-11567961.jpeg?auto=compress&cs=tinysrgb&w=600',
      hoteles: '+720 alojamientos',
    },
  ];

  readonly hotelesDestacados: HotelDestacado[] = [
    {
      id: 'hotel-1',
      nombre: 'The Hoxton, Le Marais',
      ciudad: 'París', barrio: 'Le Marais',
      estrellas: 5, score: 9.3, scoreLabel: 'Excepcional', numResenas: 3120,
      precioPorNoche: 189, precioAnterior: 250,
      imagen: 'https://images.pexels.com/photos/30898458/pexels-photo-30898458.jpeg?auto=compress&cs=tinysrgb&w=800',
      amenities: ['Centro histórico', 'Desayuno incluido', 'Wi-Fi Premium'],
      cancelacionGratis: true,
      badges: ['Mejor precio', '-24%'],
    },
    {
      id: 'hotel-2',
      nombre: 'Palazzo Venezia Boutique',
      ciudad: 'Venecia', barrio: 'San Marco',
      estrellas: 5, score: 9.6, scoreLabel: 'Excepcional', numResenas: 1520,
      precioPorNoche: 320,
      imagen: 'https://images.pexels.com/photos/19689227/pexels-photo-19689227.jpeg?auto=compress&cs=tinysrgb&w=800',
      amenities: ['Vista al Canal', 'Restaurante', 'Spa'],
      cancelacionGratis: true,
      badges: ['Top rated', 'Luxury'],
    },
    {
      id: 'hotel-3',
      nombre: 'Grand Hotel Bucharest',
      ciudad: 'Bucarest', barrio: 'Centro histórico',
      estrellas: 4, score: 8.8, scoreLabel: 'Muy bueno', numResenas: 980,
      precioPorNoche: 95, precioAnterior: 130,
      imagen: 'https://images.pexels.com/photos/16563487/pexels-photo-16563487.jpeg?auto=compress&cs=tinysrgb&w=800',
      amenities: ['Centro ciudad', 'Piscina', 'Parking gratuito'],
      cancelacionGratis: false,
      badges: ['Gran valor'],
    },
    {
      id: 'hotel-4',
      nombre: 'Prague Palace Hotel',
      ciudad: 'Praga', barrio: 'Malá Strana',
      estrellas: 5, score: 9.0, scoreLabel: 'Excepcional', numResenas: 2180,
      precioPorNoche: 210,
      imagen: 'https://images.pexels.com/photos/20604661/pexels-photo-20604661.jpeg?auto=compress&cs=tinysrgb&w=800',
      amenities: ['Vistas al castillo', 'Piscina', 'Bar & Lounge'],
      cancelacionGratis: true,
      badges: ['Elegido del mes'],
    },
  ];

  readonly pasos = [
    { num: '01', icon: 'search',    title: 'Busca y compara',       desc: 'Explora cientos de opciones filtradas por precio, rating y ubicación.' },
    { num: '02', icon: 'heart',     title: 'Elige lo mejor',        desc: 'Lee reseñas reales, ve fotos y compara precios con total transparencia.' },
    { num: '03', icon: 'calendar',  title: 'Reserva en segundos',   desc: 'Confirma tu reserva en menos de 2 minutos con datos seguros.' },
    { num: '04', icon: 'sparkles',  title: 'Disfruta tu viaje',     desc: 'Recibe confirmación instantánea y soporte 24/7 durante tu estancia.' },
  ];

  readonly beneficios = [
    { icon: 'shield-check',  title: 'Pagos 100% seguros',        desc: 'Cifrado SSL + Stripe certificado PCI DSS nivel 1.' },
    { icon: 'badge-check',   title: 'Proveedores verificados',   desc: 'Todos los comercios pasan por revisión antes de publicar.' },
    { icon: 'tag',           title: 'Mejor precio garantizado',  desc: 'Encontramos un precio menor y te devolvemos la diferencia.' },
    { icon: 'rotate-ccw',   title: 'Cancelación flexible',      desc: 'La mayoría de reservas con cancelación gratis hasta 24h antes.' },
  ];

  readonly testimonios: Testimonio[] = [
    {
      nombre: 'Ana Martínez', ciudad: 'Madrid', initials: 'AM',
      rating: 5, vertical: 'Hoteles',
      texto: 'Encontré el hotel perfecto en París con 30% de descuento. El proceso fue facilísimo y el soporte respondió mis dudas en minutos.',
    },
    {
      nombre: 'Luca Bianchi', ciudad: 'Roma', initials: 'LB',
      rating: 5, vertical: 'Taxis',
      texto: 'Uso Zenda para mis traslados desde el aeropuerto en cada viaje. Siempre puntual, precio justo y el conductor conoce mi ruta.',
    },
    {
      nombre: 'Sophie Martin', ciudad: 'París', initials: 'SM',
      rating: 5, vertical: 'Guarderías',
      texto: 'Encontré la guardería perfecta para mi hija en 10 minutos. Ver los cupos disponibles en tiempo real es increíble.',
    },
  ];

  estrellas(n: number): string { return '★'.repeat(n) + '☆'.repeat(5 - n); }

  onBuscar(): void {
    const { ciudad, fechaInicio, fechaFin } = this.searchForm.value;
    void this.router.navigate(['/buscar'], {
      queryParams: { vertical: this.verticalActivo(), ciudad, desde: fechaInicio, hasta: fechaFin }
    });
  }
}
