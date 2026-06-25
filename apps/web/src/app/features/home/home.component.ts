import { Component, signal, OnInit, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { DecimalPipe } from '@angular/common';
import { AnimateOnScrollDirective } from '../../shared/directives/animate-on-scroll.directive';
import { RsNavbarComponent } from '../../shared/components/navbar/rs-navbar.component';
import { ImgFallbackDirective } from '../../shared/directives/img-fallback.directive';
import { hotelImage } from '../../shared/media/images';

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
  emoji: string;
  label: string;
  desc: string;
  color: string;
  count: string;
}

interface Testimonio {
  nombre: string;
  ciudad: string;
  avatar: string;
  rating: number;
  texto: string;
  vertical: string;
}

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [RouterLink, ReactiveFormsModule, DecimalPipe, AnimateOnScrollDirective, RsNavbarComponent, ImgFallbackDirective],
  template: `
<div class="home">
  <rs-navbar />

  <!-- ═══ HERO ════════════════════════════════════════════════════ -->
  <section class="hero">
    <div class="rs-hero-bg">
      <div class="hero__photo" aria-hidden="true"></div>
      <div class="rs-hero-bg__grid"></div>
      <div class="rs-hero-bg__orb rs-hero-bg__orb--1"></div>
      <div class="rs-hero-bg__orb rs-hero-bg__orb--2"></div>
      <div class="rs-hero-bg__orb rs-hero-bg__orb--3"></div>
    </div>

    <!-- Floating elements -->
    <div class="hero__float hero__float--1" aria-hidden="true">🏨</div>
    <div class="hero__float hero__float--2" aria-hidden="true">✈️</div>
    <div class="hero__float hero__float--3" aria-hidden="true">⭐</div>
    <div class="hero__float hero__float--4" aria-hidden="true">🗺️</div>

    <div class="hero__inner rs-wrap">
      <div class="hero__badge">
        <span class="rs-live"></span>
        <span>+48,000 reservas este mes</span>
      </div>

      <h1 class="hero__title">
        Todo lo que necesitas,<br>
        <span class="rs-gradient-text">en un solo lugar</span>
      </h1>

      <p class="hero__sub">
        Hoteles, vuelos, taxis, transporte y guarderías para el Perú.
        Compara precios, lee reseñas reales y reserva en segundos.
      </p>

      <!-- Vertical selector -->
      <div class="rs-vtabs hero__vtabs">
        @for (v of verticales; track v.key) {
          <button
            class="rs-vtab"
            [class.active]="verticalActivo() === v.key"
            (click)="verticalActivo.set(v.key)">
            {{ v.emoji }} {{ v.label }}
          </button>
        }
      </div>

      <!-- Search widget -->
      <div class="rs-search hero__search">
        <form [formGroup]="searchForm" (ngSubmit)="onBuscar()">
          <div class="rs-search__row">
            <div class="rs-field">
              <label class="rs-lbl">🏙️ Ciudad o zona</label>
              <input formControlName="ciudad" class="rs-inp rs-inp--lg"
                     placeholder="Lima, Cusco, Arequipa…" />
            </div>
            <div class="rs-field">
              <label class="rs-lbl">📅 Desde</label>
              <input formControlName="fechaInicio" type="date" class="rs-inp rs-inp--lg" />
            </div>
            <div class="rs-field">
              <label class="rs-lbl">📅 Hasta</label>
              <input formControlName="fechaFin" type="date" class="rs-inp rs-inp--lg" />
            </div>
            <button type="submit" class="rs-btn rs-btn--primary rs-btn--lg hero__cta">
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
              {{ v.emoji }}
            </div>
            <div class="vertical-card__body">
              <h3 class="vertical-card__name">{{ v.label }}</h3>
              <p class="vertical-card__desc">{{ v.desc }}</p>
              <div class="vertical-card__count">{{ v.count }}</div>
            </div>
            <div class="vertical-card__arrow">→</div>
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
              <img [src]="h.imagen" [alt]="h.nombre" loading="lazy" rsImg />
              <div class="rs-hotel-card__img-badges">
                @for (b of h.badges; track b) {
                  <span class="rs-badge rs-badge--accent">{{ b }}</span>
                }
              </div>
              <button class="rs-hotel-card__wishlist" (click)="$event.preventDefault()">♡</button>
            </div>

            <div class="rs-hotel-card__body">
              <div class="rs-hotel-card__stars">{{ estrellas(h.estrellas) }}</div>
              <div class="rs-hotel-card__name">{{ h.nombre }}</div>
              <div class="rs-hotel-card__loc">📍 {{ h.barrio }}, {{ h.ciudad }}</div>

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
                    <div class="rs-price__old">S/ {{ h.precioAnterior }}</div>
                  }
                  <div class="rs-price__amount" style="font-size:var(--f-xl);font-weight:var(--w-8);color:var(--t-100)">
                    S/ {{ h.precioPorNoche }}
                  </div>
                  <div class="rs-price__period" style="font-size:var(--f-xs);color:var(--t-400)">/noche</div>
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
          Ver todos los hoteles →
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
            <div class="how-step__icon">{{ step.icon }}</div>
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
            Compara precios reales de cientos de proveedores verificados.
            Sin comisiones ocultas, sin sorpresas al momento de pagar.
            Tu dinero y tu tiempo valen.
          </p>
          <div class="benefits-features">
            @for (f of beneficios; track f.title) {
              <div class="benefit-item">
                <div class="benefit-item__icon">{{ f.icon }}</div>
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
            <div style="font-size:2rem;margin-bottom:var(--sp-3)">🏆</div>
            <div style="font-size:var(--f-3xl);font-weight:var(--w-9);color:var(--t-100);letter-spacing:-.04em">4.8</div>
            <div style="font-size:var(--f-sm);color:var(--t-300)">Calificación promedio</div>
            <div style="font-size:var(--f-xs);color:var(--t-400);margin-top:var(--sp-2)">Basado en +32,000 reseñas</div>
          </div>
          <div class="bv-card bv-card--sec">
            <div style="font-size:1.25rem">✈️</div>
            <div style="font-size:var(--f-sm);font-weight:var(--w-6);color:var(--t-100);margin-top:var(--sp-2)">Lima → Cusco</div>
            <div style="font-size:var(--f-xs);color:var(--t-400)">Vuelo directo · S/ 189</div>
          </div>
          <div class="bv-card bv-card--tert">
            <div style="font-size:1.25rem">🚕</div>
            <div style="font-size:var(--f-sm);font-weight:var(--w-6);color:var(--t-100);margin-top:var(--sp-2)">Taxi en camino</div>
            <div style="font-size:var(--f-xs);color:var(--t-400)">Estimado 4 min · S/ 12</div>
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
              <div class="testimonial-card__avatar">{{ t.avatar }}</div>
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
        <div class="cta-box__bg"></div>
        <div class="cta-box__content">
          <h2 class="rs-h2">¿Listo para tu próxima <span class="rs-gradient-text">aventura</span>?</h2>
          <p>Únete a +120,000 peruanos que ya reservan con Zenda.</p>
          <div class="rs-flex rs-gap-4" style="margin-top:var(--sp-8);justify-content:center;flex-wrap:wrap">
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
        <div style="font-size:var(--f-xl);font-weight:var(--w-8);letter-spacing:-.03em;color:var(--t-100)">
          Zen<span class="rs-gradient-text">da</span>
        </div>
        <p>El marketplace de reservas #1 del Perú. Hoteles, vuelos, taxis, transporte y guarderías.</p>
        <div style="margin-top:var(--sp-4);display:flex;gap:var(--sp-3)">
          <span class="rs-badge rs-badge--neutral">🇵🇪 Hecho en Perú</span>
          <span class="rs-badge rs-badge--success">PEN · S/</span>
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
        <span class="rs-badge rs-badge--neutral">IGV 18% incluido</span>
        <span class="rs-badge rs-badge--accent">Pagos seguros Stripe</span>
      </div>
    </div>
  </footer>
</div>
  `,
  styles: [`
    :host { display: block; }

    /* HERO */
    .hero {
      position: relative;
      min-height: 92vh;
      display: flex;
      align-items: center;
      overflow: hidden;
      padding-block: var(--sp-16);
    }

    .hero__photo {
      position: absolute;
      inset: 0;
      background-image: url('https://images.pexels.com/photos/338504/pexels-photo-338504.jpeg?auto=compress&cs=tinysrgb&w=1600');
      background-size: cover;
      background-position: center;
      opacity: .14;
      mask-image: radial-gradient(ellipse 90% 80% at 50% 30%, #000 0%, transparent 75%);
      -webkit-mask-image: radial-gradient(ellipse 90% 80% at 50% 30%, #000 0%, transparent 75%);
    }

    .hero__inner {
      position: relative;
      z-index: 1;
      text-align: center;
      animation: fadeUp .7s ease both;
    }

    .hero__badge {
      display: inline-flex;
      align-items: center;
      gap: var(--sp-2);
      padding: var(--sp-2) var(--sp-4);
      background: rgba(84,114,248,.12);
      border: 1px solid rgba(84,114,248,.25);
      border-radius: var(--r-full);
      font-size: var(--f-xs);
      font-weight: var(--w-6);
      color: #7AA3FF;
      letter-spacing: .04em;
      text-transform: uppercase;
      margin-bottom: var(--sp-6);
    }

    .hero__title {
      font-size: var(--f-hero);
      font-weight: var(--w-9);
      letter-spacing: -.04em;
      line-height: 1.05;
      color: var(--t-100);
      margin-bottom: var(--sp-5);
      animation: fadeUp .7s .1s ease both;
    }

    .hero__sub {
      font-size: var(--f-lg);
      color: var(--t-300);
      max-width: 56ch;
      margin-inline: auto;
      line-height: 1.7;
      margin-bottom: var(--sp-8);
      animation: fadeUp .7s .2s ease both;
    }

    .hero__vtabs {
      justify-content: center;
      margin-bottom: var(--sp-6);
      animation: fadeUp .7s .3s ease both;
    }

    .hero__search {
      max-width: 860px;
      margin-inline: auto;
      animation: fadeUp .7s .4s ease both;
    }

    .hero__cta { align-self: flex-end; }

    .hero__trust {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: var(--sp-4);
      flex-wrap: wrap;
      margin-top: var(--sp-6);
      animation: fadeUp .7s .5s ease both;
    }

    .hero__trust-chip {
      font-size: var(--f-xs);
      color: var(--t-400);
    }

    .hero__float {
      position: absolute;
      font-size: 2.5rem;
      opacity: .18;
      pointer-events: none;
      filter: blur(1px);
    }
    .hero__float--1 { top: 15%; left: 6%;  animation: float 8s ease-in-out infinite; }
    .hero__float--2 { top: 20%; right: 8%; animation: float 10s ease-in-out infinite 2s; }
    .hero__float--3 { bottom: 25%; left: 10%; animation: float 9s ease-in-out infinite 4s; }
    .hero__float--4 { bottom: 20%; right: 6%; animation: float 11s ease-in-out infinite 1s; }

    /* STATS */
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

    /* SECTION COMMON */
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
    }

    /* VERTICALS */
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
      font-size: 1.75rem;
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
      font-size: var(--f-lg);
      transition: transform var(--d-2), color var(--d-2);
      align-self: flex-end;
    }

    .vertical-card:hover .vertical-card__arrow { transform: translateX(4px); color: var(--t-200); }

    /* HOTELS GRID */
    .hotels-grid {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: var(--sp-5);

      @media (max-width: 1024px) { grid-template-columns: repeat(2, 1fr); }
      @media (max-width: 640px)  { grid-template-columns: 1fr; }
    }

    /* HOW IT WORKS */
    .how-section { background: var(--c-raised); }

    .how-grid {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: var(--sp-6);
      position: relative;

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

    .how-step__icon { font-size: 2.5rem; margin-bottom: var(--sp-4); }

    .how-step__title {
      font-size: var(--f-md);
      font-weight: var(--w-7);
      color: var(--t-100);
      margin-bottom: var(--sp-3);
    }

    .how-step__desc { font-size: var(--f-sm); color: var(--t-400); line-height: 1.6; }

    /* BENEFITS */
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
      font-size: 1.1rem;
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

    /* TESTIMONIALS */
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
      font-size: 1.25rem;
      flex-shrink: 0;
    }

    .testimonial-card__name { font-size: var(--f-sm); font-weight: var(--w-6); color: var(--t-100); }
    .testimonial-card__city { font-size: var(--f-xs); color: var(--t-400); }
    .testimonial-card__badge { margin-left: auto; }
    .testimonial-card__stars { font-size: var(--f-sm); color: var(--c-amber); margin-bottom: var(--sp-3); }
    .testimonial-card__text { font-size: var(--f-sm); color: var(--t-300); line-height: 1.7; }

    /* CTA BOX */
    .cta-section { padding-block: var(--sp-24); }

    .cta-box {
      position: relative;
      border: 1px solid rgba(84,114,248,.25);
      border-radius: var(--r-2xl);
      overflow: hidden;
      padding: var(--sp-16) var(--sp-8);
      text-align: center;
    }

    .cta-box__bg {
      position: absolute;
      inset: 0;
      background:
        radial-gradient(ellipse 70% 80% at 50% 50%, rgba(84,114,248,.12) 0%, transparent 70%),
        var(--c-card);
    }

    .cta-box__content {
      position: relative;
      z-index: 1;

      h2 { margin-bottom: var(--sp-4); }
      p  { color: var(--t-300); }
    }
  `],
})
export class HomeComponent {
  private readonly router = inject(Router);
  private readonly fb = inject(FormBuilder);

  readonly verticalActivo = signal('hoteles');

  readonly searchForm = this.fb.group({ ciudad: [''], fechaInicio: [''], fechaFin: [''] });

  readonly verticales: Vertical[] = [
    { key: 'hoteles',    emoji: '🏨', label: 'Hoteles',    desc: 'Habitaciones y alojamiento por noches', color: 'rgba(84,114,248,.15)',  count: '+1,200 propiedades' },
    { key: 'vuelos',     emoji: '✈️', label: 'Vuelos',     desc: 'Vuelos nacionales e internacionales',   color: 'rgba(0,201,177,.15)',   count: '+380 rutas activas' },
    { key: 'taxis',      emoji: '🚕', label: 'Taxis',      desc: 'Traslados on-demand y programados',     color: 'rgba(245,158,11,.15)',  count: '+4,500 conductores' },
    { key: 'transporte', emoji: '🚛', label: 'Transporte', desc: 'Carga, mudanzas y logística',           color: 'rgba(155,92,246,.15)',  count: '+320 empresas' },
    { key: 'guarderia',  emoji: '👶', label: 'Guarderías', desc: 'Cuidado infantil con cupos por edad',   color: 'rgba(236,72,153,.15)',  count: '+180 centros' },
  ];

  readonly stats = [
    { valor: '+48K',  label: 'Reservas este mes',     delay: 0 },
    { valor: '+2.4K', label: 'Proveedores activos',    delay: 80 },
    { valor: '4.8★',  label: 'Calificación promedio',  delay: 160 },
    { valor: '+120K', label: 'Usuarios registrados',   delay: 240 },
  ];

  readonly hotelesDestacados: HotelDestacado[] = [
    {
      id: 'hotel-1',
      nombre: 'Casa Andina Premium Miraflores',
      ciudad: 'Lima', barrio: 'Miraflores',
      estrellas: 5, score: 9.2, scoreLabel: 'Excepcional', numResenas: 2840,
      precioPorNoche: 320, precioAnterior: 420,
      imagen: hotelImage(0, 600),
      amenities: ['🌊 Vista al mar', '🍳 Desayuno', '🅿️ Parking'],
      cancelacionGratis: true,
      badges: ['Mejor precio', '-24%'],
    },
    {
      id: 'hotel-2',
      nombre: 'Inkaterra Machu Picchu',
      ciudad: 'Cusco', barrio: 'Aguas Calientes',
      estrellas: 5, score: 9.6, scoreLabel: 'Excepcional', numResenas: 1520,
      precioPorNoche: 890,
      imagen: hotelImage(4, 600),
      amenities: ['🦋 Ecológico', '♨️ Jacuzzi', '🍽️ Restaurante'],
      cancelacionGratis: true,
      badges: ['Top rated', 'Eco'],
    },
    {
      id: 'hotel-3',
      nombre: 'Hotel Libertador Lago Titicaca',
      ciudad: 'Puno', barrio: 'Centro',
      estrellas: 4, score: 8.8, scoreLabel: 'Muy bueno', numResenas: 980,
      precioPorNoche: 240, precioAnterior: 290,
      imagen: hotelImage(2, 600),
      amenities: ['🌊 Lago', '🌅 Vista puesta de sol', '🚣 Kayak'],
      cancelacionGratis: false,
      badges: ['Vista lago'],
    },
    {
      id: 'hotel-4',
      nombre: 'JW Marriott Lima',
      ciudad: 'Lima', barrio: 'Miraflores',
      estrellas: 5, score: 9.0, scoreLabel: 'Excepcional', numResenas: 3210,
      precioPorNoche: 480,
      imagen: hotelImage(6, 600),
      amenities: ['🏊 Piscina', '💆 Spa', '🍸 Bar'],
      cancelacionGratis: true,
      badges: ['Elegido del mes'],
    },
  ];

  readonly pasos = [
    { num: '01', icon: '🔍', title: 'Busca y compara', desc: 'Explora cientos de opciones filtradas por precio, rating y ubicación.' },
    { num: '02', icon: '❤️', title: 'Elige lo mejor', desc: 'Lee reseñas reales, ve fotos y compara precios con total transparencia.' },
    { num: '03', icon: '📝', title: 'Reserva en segundos', desc: 'Confirma tu reserva en menos de 2 minutos con datos seguros.' },
    { num: '04', icon: '🎉', title: 'Disfruta tu experiencia', desc: 'Recibe confirmación instantánea y soporte 24/7 durante tu viaje.' },
  ];

  readonly beneficios = [
    { icon: '🔒', title: 'Pagos 100% seguros',        desc: 'Cifrado SSL + Stripe certificado PCI DSS nivel 1.' },
    { icon: '✅', title: 'Proveedores verificados',    desc: 'Todos los comercios pasan por revisión antes de publicar.' },
    { icon: '💰', title: 'Mejor precio garantizado',  desc: 'Encontramos un precio menor y te devolvemos la diferencia.' },
    { icon: '🔄', title: 'Cancelación flexible',      desc: 'La mayoría de reservas con cancelación gratis hasta 24h antes.' },
  ];

  readonly testimonios: Testimonio[] = [
    {
      nombre: 'María García', ciudad: 'Lima', avatar: '👩‍💼',
      rating: 5, vertical: 'Hoteles',
      texto: 'Encontré el hotel de mis sueños en Cusco con 30% de descuento. El proceso fue facilísimo y el soporte respondió mis dudas en minutos.',
    },
    {
      nombre: 'Carlos Mendoza', ciudad: 'Arequipa', avatar: '👨‍💻',
      rating: 5, vertical: 'Taxis',
      texto: 'Uso Zenda para mis traslados desde el aeropuerto. Siempre puntual, precio justo y el conductor ya conoce mi ruta favorita.',
    },
    {
      nombre: 'Sofía Torres', ciudad: 'Trujillo', avatar: '👩‍🏫',
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
