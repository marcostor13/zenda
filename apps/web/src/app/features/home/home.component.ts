import { Component, ElementRef, OnInit, inject, signal, viewChild } from '@angular/core';
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
import {
  BANDA_POR_QUE, BRAND, HOTEL_IMAGES, MOTIVOS_IMAGES, TRUST_ICONOS,
} from '../../shared/media/images';
import { VERTICALES_PUBLICOS, rutaDeVertical } from '../../shared/verticales/verticales.config';
import { AlojamientoService } from '../alojamiento/services/alojamiento.service';
import { environment } from '../../../environments/environment';

interface AlojamientoRecomendado {
  /** Presente solo cuando la tarjeta viene del catálogo real: habilita favorito y enlace a la ficha. */
  id?: string;
  ciudad: string;
  nombre: string;
  estrellas?: number;
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
  <!-- El logotipo grande ya está en el hero: la barra deja solo la "D" (PDF §1). -->
  <rs-navbar [soloMarcaD]="true" />

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

      <!-- Bloque de 3 valores sobre la franja navy (copys aprobados, PDF 27/07 §4) -->
      <div class="trust">
        @for (t of garantias; track t.titulo) {
          <div class="trust__item">
            <img [src]="t.icono" alt="" class="trust__icon" aria-hidden="true" />
            <div class="trust__body">
              <p class="trust__title">{{ t.titulo }}</p>
              <p class="trust__desc">{{ t.descripcion }}</p>
            </div>
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
          <h2 class="rs-h3" i18n="@@home.exploraServicios">Todo lo que tu mascota necesita, en un solo lugar.</h2>
          <p i18n="@@home.exploraClaim">Reserva con profesionales verificados cerca de ti, de forma rápida, segura y sin complicaciones.</p>
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

      <!-- Banda fotográfica emocional entre el título y las tarjetas (PDF §6).
           TODO(D-3): sustituir por la fotografía de "familia disfrutando con su
           mascota" que aporte el cliente — basta con cambiar este fichero. -->
      <figure class="why-banner" rsAnim>
        <picture>
          <source media="(min-width: 641px)" [srcset]="bandaPorQueEscritorio" />
          <img [src]="bandaPorQue" alt="Momento de disfrute con una mascota" loading="lazy" rsImg />
        </picture>
      </figure>

      <ul class="why-grid" rsAnim>
        @for (m of motivos; track m.titulo) {
          <li class="why-card">
            <figure class="why-card__art">
              <img [src]="m.imagen" [alt]="m.alt" loading="lazy" rsImg />
            </figure>
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

      <!-- Carrusel con flechas laterales, rueda y gesto táctil (PDF 27/07 §7). -->
      <div class="cities-carousel">
        <button type="button" class="cities-nav cities-nav--prev"
                (click)="desplazarCiudades(-1)" aria-label="Ver ciudades anteriores">
          <rs-icon name="arrow-left" [size]="18" [stroke]="2"></rs-icon>
        </button>

        <div class="cities-track" #ciudadesTrack rsAnim>
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

        <button type="button" class="cities-nav cities-nav--next"
                (click)="desplazarCiudades(1)" aria-label="Ver más ciudades">
          <rs-icon name="arrow-right" [size]="18" [stroke]="2"></rs-icon>
        </button>
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
        @for (a of alojamientosRecomendados(); track a.nombre) {
          <rs-card
            [rsAnim]="''" [rsAnimDelay]="$index * 70"
            [imageUrl]="a.imagen" [imageAlt]="a.nombre"
            [title]="a.nombre" [subtitle]="a.ciudad"
            [badges]="[{ icon: 'crown', label: 'Recomendado', variant: 'accent' }]"
            [rating]="{ score: a.score, label: a.scoreLabel, count: a.numResenas }"
            [price]="{ amount: '€' + a.precioPorNoche, period: '/noche' }"
            [amenities]="a.tags"
            ctaLabel="Ver alojamiento"
            [favoritoServicioId]="a.id ?? null"
            [routerLink]="a.id ? ['/alojamiento', a.id] : null"
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

      <!-- CTAs integrados en la sección, no aislados arriba (PDF 27/07 §9). -->
      <div class="explora-ctas" rsAnim>
        <a routerLink="/explora" class="rs-btn rs-btn--outline">
          <rs-icon name="map-pin" [size]="16" [stroke]="2"></rs-icon>
          Ver lugares cercanos
        </a>
        <a routerLink="/explora/planificador" class="rs-btn rs-btn--gold">
          <rs-icon name="sparkles" [size]="16" [stroke]="2"></rs-icon>
          Planificar mi viaje con IA
        </a>
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

  <!-- ═══ CTA COMERCIOS ═══════════════════════════════════════════
       El cliente validó esta combinación de colores (WA0004): no rediseñar,
       solo añadir beneficios, cierre aspiracional y hueco de fotografía. -->
  <section class="pro-cta">
    <div class="rs-wrap rs-wrap--lg pro-cta__inner" rsAnim>
      <div class="pro-cta__body">
        <p class="pro-cta__eyebrow">Para profesionales</p>
        <h2 class="pro-cta__title">¿Tienes un negocio canino?</h2>
        <p class="pro-cta__text">
          Publica tus servicios en Doogking, gestiona tu disponibilidad y recibe
          reservas pagadas online. Sin cuota de alta: solo comisión por reserva.
        </p>

        <!-- Tres beneficios con icono (PDF §10). -->
        <ul class="pro-cta__beneficios">
          <li><rs-icon name="check" [size]="15" [stroke]="2.5"></rs-icon> Sin cuota de alta</li>
          <li><rs-icon name="check" [size]="15" [stroke]="2.5"></rs-icon> Reservas 24/7</li>
          <li><rs-icon name="check" [size]="15" [stroke]="2.5"></rs-icon> Cobros seguros</li>
        </ul>

        <p class="pro-cta__cierre">
          Únete a la plataforma que está transformando la forma de reservar servicios para mascotas.
        </p>

        <a routerLink="/auth/registro-comercio" class="rs-btn rs-btn--gold rs-btn--lg">
          Registrar mi negocio
          <rs-icon name="arrow-right" [size]="17" [stroke]="2.25"></rs-icon>
        </a>
      </div>

      <!-- TODO(D-3): sustituir por la foto real de un profesional trabajando
           (veterinario, peluquero, residencia…) cuando la aporte el cliente. -->
      <figure class="pro-cta__foto">
        <img [src]="fotoProfesional" alt="Profesional atendiendo a una mascota" loading="lazy" rsImg />
      </figure>
    </div>
  </section>

  <!-- ═══ FOOTER ═══════════════════════════════════════════════════ -->
  <footer class="rs-footer home-footer">
    <div class="rs-footer__grid">
      <div class="rs-footer__brand">
        <img [src]="logoFooter" alt="Doogking · Todo para su rey, en un solo lugar"
             class="home-footer__logo" />
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

    /*
     * ══ HERO ═══════════════════════════════════════════════════════
     * Réplica de la línea gráfica de marca: bloque blanco con el logo y el
     * eslogan, buscador flotante y franja navy curva con garantías.
     *
     * Sin overflow:hidden aquí a propósito (bug 2026-08-12): los desplegables
     * del buscador (.pa__list de "Dónde", .pp__pop de "¿Para qué mascota?")
     * son position:absolute dentro de este contenedor, y con overflow:hidden
     * cualquier lista que no cupiera en el resto del hero se cortaba a mitad
     * — literalmente desaparecían las últimas ciudades/mascotas de la lista.
     * No hace falta para la franja navy: .hero__navy sangra un 160% de
     * ancho, pero el body ya tiene overflow-x: hidden (styles.scss) y recorta
     * ese desbordamiento horizontal a nivel de página.
     */
    .hero {
      position: relative;
      background: var(--c-card);
      padding-block: var(--sp-8) 0;
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

    /* Logo y titular son la firma de marca, no el protagonista: se mantienen
       pero a tamaño reducido para que el buscador —lo que convierte— gane el
       peso visual del hero (feedback 2026-08-12: "toda la parte del
       formulario debe tener más relevancia"). */
    .hero__brand {
      text-align: center;
      animation: fadeUp .6s ease both;
      margin-bottom: var(--sp-4);
    }

    .hero__logo {
      width: min(180px, 42vw);
      height: auto;
      margin-inline: auto;
      margin-bottom: var(--sp-2);
    }

    .hero__title {
      font-family: var(--font-accent);
      font-weight: var(--w-6);
      text-transform: uppercase;
      letter-spacing: .01em;
      line-height: 1.25;
      font-size: clamp(1.05rem, 2.2vw, 1.5rem);
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 2px;
    }

    .hero__title-line {
      display: inline-flex;
      align-items: center;
      gap: var(--sp-3);
    }
    .hero__title-line--blue { color: var(--dk-blue); }
    .hero__title-line--gold { color: var(--dk-gold); }

    .hero__dash {
      display: inline-block;
      width: clamp(14px, 3vw, 28px);
      height: 3px;
      border-radius: var(--r-full);
      background: var(--dk-gold);
    }

    .hero__subtitle {
      margin-top: var(--sp-2);
      margin-inline: auto;
      max-width: 54ch;
      font-size: var(--f-sm);
      line-height: 1.5;
      color: var(--t-300);

      /* En pantallas bajas resta altura al buscador, que es lo que convierte. */
      @media (max-width: 560px) { display: none; }
    }

    .hero__slogan {
      margin-top: var(--sp-1);
      margin-inline: auto;
      max-width: 48ch;
      font-size: var(--f-xs);
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
      align-items: flex-start;
      gap: var(--sp-3);

      & + & { border-left: 1px solid rgba(255,255,255,.22); padding-left: var(--sp-10); }

      @media (max-width: 900px) {
        & + & { border-left: none; padding-left: 0; }
      }
    }

    .trust__icon { width: 38px; height: 38px; flex-shrink: 0; }

    /* Título + descripción aprobados (§4): cada valor ocupa una columna con texto completo. */
    .trust__body { max-width: 300px; }

    .trust__title {
      font-family: var(--font-accent);
      font-size: var(--f-sm);
      font-weight: var(--w-7);
      line-height: 1.35;
      color: #fff;
      margin: 0 0 var(--sp-1);
    }

    .trust__desc {
      font-size: var(--f-xs);
      line-height: 1.5;
      color: rgba(255, 255, 255, .82);
      margin: 0;
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
      /* En móvil la fila crece para poder pulsarla con el pulgar. */
      @media (max-width: 768px) { min-height: 36px; }
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

    /* CTAs de la sección Explora (PDF §9): dentro de la sección, no aislados. */
    .explora-ctas {
      display: flex;
      justify-content: center;
      flex-wrap: wrap;
      gap: var(--sp-4);
      margin-top: var(--sp-8);

      .rs-btn { display: inline-flex; align-items: center; gap: var(--sp-2); }
    }

    .explora-nota {
      margin-top: var(--sp-4);
      font-size: var(--f-xs);
      color: var(--t-400);
      text-align: center;
    }

    /* ══ ¿POR QUÉ DOOGKING? ═════════════════════════════════════════ */
    .why-section { background: var(--c-card); }

    /* Banda fotográfica emocional (PDF §6) — placeholder hasta D-3. */
    .why-banner {
      margin: 0 0 var(--sp-10);
      border-radius: var(--r-xl);
      overflow: hidden;
      box-shadow: var(--sh-card);

      picture { display: block; }

      /* La banda ocupa el ancho completo (~1.4k) y la foto es apaisada 1.75:1,
         así que el alto decide cuánto se recorta. A 240px solo sobrevivía un
         30% del original y el perro quedaba partido; 320px deja ver la figura
         entera, y el encuadre se sube un poco para no cortarle la cabeza. */
      img {
        display: block;
        width: 100%;
        height: 320px;
        object-fit: cover;
        object-position: center 42%;
      }

      @media (max-width: 1024px) { img { height: 260px; } }
      /* En móvil la banda ya es casi tan apaisada como la foto: no hace falta
         corregir el encuadre y se usa el hero de siempre. */
      @media (max-width: 640px) { img { height: 160px; object-position: center; } }
    }

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
      grid-template-columns: repeat(3, minmax(0, 1fr));
      gap: var(--sp-5);
      list-style: none;

      @media (max-width: 1024px) { grid-template-columns: repeat(2, minmax(0, 1fr)); }

      /* Móvil: carrusel horizontal con scroll-snap en vez de apilar tres
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
      /* La foto sangra hasta el borde de la tarjeta: el padding pasa al texto. */
      padding: 0 0 var(--sp-6);
      overflow: hidden;
      border: 1px solid var(--b-1);
      border-radius: var(--r-xl);
      background: var(--c-base);
      transition: transform var(--d-2), box-shadow var(--d-2), border-color var(--d-2);

      &:hover {
        transform: translateY(-4px);
        border-color: rgba(8,37,139,.22);
        box-shadow: var(--sh-lg);
      }

      &:hover .why-card__art img { transform: scale(1.04); }

      @media (max-width: 640px) { scroll-snap-align: start; }
      @media (prefers-reduced-motion: reduce) {
        &:hover { transform: none; }
        &:hover .why-card__art img { transform: none; }
      }
    }

    /* Fotografía de cabecera de cada valor, en lugar del icono anterior. */
    .why-card__art {
      width: 100%;
      /* Alto fijo por proporción: con tres textos de longitudes muy distintas,
         un alto automático descuadraría las fotos entre tarjetas. */
      aspect-ratio: 16 / 10;
      margin-bottom: var(--sp-2);
      overflow: hidden;
      background: var(--c-raised);

      img {
        width: 100%;
        height: 100%;
        object-fit: cover;
        display: block;
        transition: transform var(--d-3);
      }
    }

    /* El padding vive en el texto porque la foto sangra a los bordes. */
    .why-card__title {
      padding-inline: var(--sp-6);
      font-family: var(--font-display);
      font-size: var(--f-lg);
      font-weight: var(--w-7);
      color: var(--dk-blue);
      line-height: 1.3;
    }

    .why-card__text {
      padding-inline: var(--sp-6);
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
        .cat-card__go {
          transform: translateX(4px);
          color: var(--dk-blue-text, var(--dk-blue));
          background: var(--dk-gold);
          border-color: var(--dk-gold);
        }
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

    /* Botón circular "○→" que se vuelve dorado al hover (PDF 27/07 §5). */
    .cat-card__go {
      margin-left: auto;
      flex-shrink: 0;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 34px;
      height: 34px;
      border: 1.5px solid var(--b-2);
      border-radius: var(--r-full);
      color: var(--t-500);
      transition: transform var(--d-2), color var(--d-2), background var(--d-2), border-color var(--d-2);
    }

    /* ══ CIUDADES ═══════════════════════════════════════════════════ */
    .cities-section { background: var(--c-raised); }

    /* Carrusel de ciudades (PDF 27/07 §7): scroll-snap + flechas laterales.
       La rueda del ratón y el gesto táctil funcionan por el overflow nativo. */
    .cities-carousel { position: relative; }

    .cities-track {
      display: flex;
      gap: var(--sp-6);
      overflow-x: auto;
      scroll-snap-type: x mandatory;
      padding-bottom: var(--sp-2);
      scrollbar-width: none;
      &::-webkit-scrollbar { display: none; }
    }

    .cities-nav {
      position: absolute;
      top: 50%;
      transform: translateY(-50%);
      z-index: 2;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 42px;
      height: 42px;
      border: 1px solid var(--b-1);
      border-radius: var(--r-full);
      background: var(--c-card);
      color: var(--dk-blue);
      box-shadow: var(--sh-md);
      cursor: pointer;
      transition: background var(--d-2), color var(--d-2), transform var(--d-2);

      &:hover { background: var(--dk-gold); color: var(--dk-blue-text, var(--dk-blue)); transform: translateY(-50%) scale(1.06); }
    }

    .cities-nav--prev { left: calc(var(--sp-4) * -1); }
    .cities-nav--next { right: calc(var(--sp-4) * -1); }

    /* En táctil el gesto de deslizar sustituye a las flechas. */
    @media (hover: none) { .cities-nav { display: none; } }

    .city-card {
      position: relative;
      display: block;
      /* Tarjeta +15% con foto horizontal y snap (PDF §7). */
      flex: 0 0 min(300px, 78vw);
      scroll-snap-align: start;
      aspect-ratio: 4 / 3;
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

      /* El nombre de la ciudad manda sobre el nº de servicios (PDF §7). */
      strong { font-family: var(--font-display); font-size: var(--f-lg); font-weight: var(--w-8); }
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
      /* El hueco es donde vive el conector entre pasos: con --sp-5 quedaba
         demasiado corto para leerse como una línea que une los círculos. */
      gap: var(--sp-6);

      @media (max-width: 800px) { grid-template-columns: 1fr; }
    }

    .how-step {
      position: relative;
      background: var(--c-base);
      border: 1px solid var(--b-1);
      border-radius: var(--r-xl);
      padding: var(--sp-8) var(--sp-6) var(--sp-6);
      text-align: center;
      transition: transform var(--d-2), box-shadow var(--d-2);

      /* Línea fina que conecta los pasos a la altura del número (PDF §10).
         Ocupa solo el hueco entre tarjetas: antes cruzaba media tarjeta hasta
         casi el círculo siguiente, pero la tarjeta de al lado tiene fondo
         opaco y se pinta después, así que le comía el tramo final y la línea
         se quedaba colgando a mitad de camino. */
      &:not(:last-child)::after {
        content: '';
        position: absolute;
        /* A la altura del centro del círculo numerado (42px que arranca en -16px). */
        top: 4px;
        left: 100%;
        width: var(--sp-6);
        height: 2px;
        background: var(--dk-divider);
        @media (max-width: 800px) { display: none; }
      }

      &:hover {
        transform: translateY(-4px);
        box-shadow: var(--sh-lg);
        .how-step__num { transform: translateX(-50%) scale(1.15); }
      }
    }

    .how-step__num {
      position: absolute;
      top: calc(-1 * var(--sp-4));
      left: 50%;
      transform: translateX(-50%);
      /* Números protagonistas, con círculo dorado llamativo (PDF §10). */
      width: 42px;
      height: 42px;
      display: grid;
      place-items: center;
      border-radius: var(--r-full);
      background: var(--dk-gold);
      color: var(--dk-blue-deep);
      font-family: var(--font-accent);
      font-weight: var(--w-8);
      font-size: var(--f-md);
      box-shadow: var(--sh-md);
      transition: transform var(--d-2);
      z-index: 1;
    }

    .how-step__icon { color: var(--dk-blue); margin-inline: auto; margin-bottom: var(--sp-3); }

    .how-step__title {
      font-size: var(--f-md);
      font-weight: var(--w-7);
      color: var(--t-100);
      margin-bottom: var(--sp-2);
    }

    .how-step__text { font-size: var(--f-sm); color: var(--t-400); line-height: 1.6; }

    /* ══ CTA COMERCIOS ══════════════════════════════════════════════
       Degradado azul elegante (PDF §10) manteniendo la combinación que el
       cliente validó en WA0004. */
    .pro-cta {
      background: linear-gradient(135deg, var(--dk-blue) 0%, var(--dk-blue-deep, #00135D) 100%);
      padding-block: var(--sp-12);
    }

    .pro-cta__inner {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: var(--sp-8);
      flex-wrap: wrap;
    }

    .pro-cta__body { flex: 1 1 420px; max-width: 620px; }

    .pro-cta__beneficios {
      list-style: none;
      display: flex;
      flex-wrap: wrap;
      gap: var(--sp-3) var(--sp-6);
      padding: 0;
      margin: var(--sp-5) 0 0;

      li {
        display: inline-flex;
        align-items: center;
        gap: var(--sp-2);
        font-size: var(--f-sm);
        font-weight: var(--w-6);
        color: rgba(255, 255, 255, .92);
        rs-icon { color: var(--dk-gold); }
      }
    }

    .pro-cta__cierre {
      margin: var(--sp-5) 0 var(--sp-6);
      font-size: var(--f-sm);
      color: rgba(255, 255, 255, .78);
      max-width: 52ch;
    }

    /* Hueco de fotografía del profesional (PDF §10) — placeholder hasta D-3. */
    .pro-cta__foto {
      flex: 0 1 340px;
      margin: 0;
      border-radius: var(--r-xl);
      overflow: hidden;
      box-shadow: var(--sh-lg);

      img { display: block; width: 100%; height: 260px; object-fit: cover; }
      @media (max-width: 900px) { display: none; }
    }

    .pro-cta__eyebrow {
      font-family: var(--font-accent);
      /* "un pelín más grande", pedido explícito del cliente (WA0004) — un escalón: xs → sm. */
      font-size: var(--f-sm);
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

    /* El logo ya viene recortado sobre transparencia, así que no necesita
       redondeo: no hay recuadro que disimular. El ancho se limita al 100% para
       que en la columna estrecha del footer no desborde. */
    .home-footer__logo {
      height: 116px;
      width: auto;
      max-width: 100%;
      object-fit: contain;
      object-position: left center;
      display: block;
      margin-bottom: var(--sp-4);

      @media (max-width: 768px) { height: 92px; }
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
export class HomeComponent implements OnInit {
  private readonly router = inject(Router);
  private readonly http = inject(HttpClient);
  private readonly alojamientoService = inject(AlojamientoService);

  private readonly ciudadesTrack = viewChild<ElementRef<HTMLElement>>('ciudadesTrack');

  async ngOnInit(): Promise<void> {
    // "Recomendados" reales: los alojamientos mejor valorados del catálogo
    // (PDF 27/07 §8). Si el API no responde, se queda el escaparate estático.
    try {
      const { items } = await this.alojamientoService.buscar({ orden: 'valoracion' });
      if (items.length > 0) {
        this.alojamientosRecomendados.set(items.slice(0, 4).map((a) => ({
          id: a.id,
          nombre: a.nombre,
          ciudad: a.ciudad,
          score: a.score,
          scoreLabel: a.scoreLabel,
          numResenas: a.numResenas,
          precioPorNoche: a.precioPorNoche,
          imagen: a.imagenes[0] ?? HOTEL_IMAGES[0],
          tags: a.amenities.slice(0, 3),
        })));
      }
    } catch {
      // Catálogo no disponible: el escaparate por defecto sigue siendo válido.
    }
  }

  /**
   * Desplaza el carrusel de ciudades aproximadamente una "página" visible; el
   * `scroll-snap` remata el encaje en la tarjeta más cercana (PDF 27/07 §7).
   */
  desplazarCiudades(direccion: 1 | -1): void {
    const track = this.ciudadesTrack()?.nativeElement;
    if (!track) return;
    track.scrollBy({ left: direccion * track.clientWidth * 0.8, behavior: 'smooth' });
  }

  readonly logoMark = BRAND.logoMark;
  readonly logoFooter = BRAND.logoFooter;

  /* Placeholders a la espera del material del cliente (D-3): sustituir la
     imagen equivale a cambiar la ruta aquí. */
  /**
   * Banda del bloque "¿Por qué Doogking.com?". En escritorio se cambia la foto
   * porque la banda es ahí mucho más apaisada: con el hero, el recorte dejaba
   * al perro descolocado en lugar de centrado.
   */
  readonly bandaPorQue = BANDA_POR_QUE.movil;
  readonly bandaPorQueEscritorio = BANDA_POR_QUE.escritorio;
  readonly fotoProfesional = HOTEL_IMAGES[0];
  readonly rutaAlojamiento = rutaDeVertical(VerticalKey.ALOJAMIENTO);

  /** Marcas de pago del pie, con su logotipo en vez del nombre escrito (TCK-8008). */
  readonly marcasPago: readonly MarcaPagoKey[] = [
    'visa', 'mastercard', 'amex', 'stripe', 'apple-pay', 'google-pay',
  ];

  /** Perfiles sociales del footer; se muestran con su logo oficial (TCK-8008). */
  readonly redesSociales: readonly { nombre: string; icono: RedSocialKey; url: string }[] = [
    { nombre: 'Instagram', icono: 'instagram', url: 'https://www.instagram.com/doogkingcom' },
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
  readonly verticales = VERTICALES_PUBLICOS;

  /** Bloque de 3 valores bajo el buscador — textos aprobados por el cliente (PDF 27/07 §4). */
  readonly garantias = [
    {
      icono: TRUST_ICONOS.rapidez,
      titulo: 'Reserva en menos de un minuto',
      descripcion: 'Encuentra y reserva el servicio perfecto sin llamadas, sin esperas y con confirmación inmediata.',
    },
    {
      icono: TRUST_ICONOS.verificados,
      titulo: 'Profesionales verificados',
      descripcion: 'Cada empresa es validada antes de unirse a Doogking para que reserves con total confianza. Reseñas reales de clientes completan cada perfil.',
    },
    {
      icono: TRUST_ICONOS.atencion,
      titulo: 'Atención 24/7',
      descripcion: 'Siempre disponibles para ayudarte antes, durante y después de cada reserva.',
    },
  ];

  /**
   * Los tres valores del bloque "¿Por qué Doogking.com?", con el copy exacto
   * aprobado por el cliente. Van con fotografía en lugar de icono: son la
   * propuesta de valor de marca y la imagen sostiene mejor el mensaje.
   */
  readonly motivos = [
    {
      imagen: MOTIVOS_IMAGES.rapidez,
      alt: 'Perro esperando feliz una reserva confirmada al momento',
      titulo: 'Reserva en menos de un minuto',
      texto: 'Encuentra y reserva el servicio perfecto sin llamadas, sin esperas y con confirmación inmediata.',
    },
    {
      imagen: MOTIVOS_IMAGES.verificados,
      alt: 'Instalación de un profesional canino validado por Doogking',
      titulo: 'Profesionales verificados',
      texto: 'Cada empresa es validada antes de unirse a Doogking para que reserves con total confianza. Reseñas reales de clientes completan cada perfil.',
    },
    {
      imagen: MOTIVOS_IMAGES.atencion,
      alt: 'Perro descansando tranquilo a cualquier hora',
      titulo: 'Atención 24/7',
      texto: 'Siempre disponibles para ayudarte antes, durante y después de cada reserva.',
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

  /**
   * Escaparate por defecto mientras carga el catálogo (o si el API falla).
   * Sin `id`: estas tarjetas no llevan corazón de favorito ni enlace a ficha,
   * porque no apuntan a un servicio real.
   */
  private readonly recomendadosPorDefecto: AlojamientoRecomendado[] = [
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

  /**
   * "Alojamientos recomendados" con datos reales del catálogo (PDF 27/07 §8):
   * los mejor valorados, con botón de favorito y enlace a su ficha. Si el API no
   * responde se mantiene el escaparate estático, sin corazón (no hay id real).
   */
  readonly alojamientosRecomendados = signal<AlojamientoRecomendado[]>(this.recomendadosPorDefecto);

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
