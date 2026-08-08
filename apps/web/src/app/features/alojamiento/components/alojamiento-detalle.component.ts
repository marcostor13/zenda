import { Component, signal, computed, OnInit, inject } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { DecimalPipe, DatePipe } from '@angular/common';
import { RsNavbarComponent } from '../../../shared/components/navbar/rs-navbar.component';
import { RsIconComponent } from '../../../shared/components/icon/rs-icon.component';
import { AnimateOnScrollDirective } from '../../../shared/directives/animate-on-scroll.directive';
import { ImgFallbackDirective } from '../../../shared/directives/img-fallback.directive';
import { IMG_FALLBACK } from '../../../shared/media/images';
import { RsRatingComponent } from '../../../shared/components/rating/rs-rating.component';
import { RsStarsComponent } from '../../../shared/components/stars/rs-stars.component';
import { RsTrustBlockComponent, type TrustItem } from '../../../shared/components/trust-block/rs-trust-block.component';
import { AlojamientoService, AlojamientoDetalle, Espacio, TamanoPerro, TipoEspacio } from '../services/alojamiento.service';
import { PerrosService, PerroApi, IndiceBienestarApi } from '../../perros/perros.service';
import { aspectosDeVertical } from '../../../shared/verticales/resena-aspectos.config';
import { VerticalKey } from 'shared';

const PLACEHOLDER_IMG = IMG_FALLBACK;

@Component({
  selector: 'app-alojamiento-detalle',
  standalone: true,
  imports: [
    RouterLink, DecimalPipe, DatePipe, RsNavbarComponent, RsIconComponent, AnimateOnScrollDirective, ImgFallbackDirective,
    RsRatingComponent, RsTrustBlockComponent, RsStarsComponent,
  ],
  template: `
<div class="detalle-page">
  <rs-navbar />

  @if (cargando()) {
    <div style="display:flex;align-items:center;justify-content:center;min-height:60vh">
      <div class="rs-spin" style="width:40px;height:40px;border-width:3px"></div>
    </div>
  }

  @if (!cargando() && !alojamiento()) {
    <div style="display:flex;flex-direction:column;align-items:center;justify-content:center;min-height:60vh;gap:var(--sp-4);text-align:center">
      <rs-icon name="paw" [size]="48" [stroke]="1.5" style="color:var(--t-400)" />
      <h3>No se pudo cargar este alojamiento</h3>
      <p style="color:var(--t-300)">Puede que ya no esté disponible.</p>
      <a routerLink="/alojamiento" class="rs-btn rs-btn--secondary">Volver al listado</a>
    </div>
  }

  @if (!cargando() && alojamiento()) {
  <div class="detalle-wrap">

    <!-- BREADCRUMB -->
    <nav class="breadcrumb rs-wrap">
      <a routerLink="/">Inicio</a> /
      <a routerLink="/alojamiento">Alojamiento canino</a> /
      <a routerLink="/alojamiento" [queryParams]="{ciudad: alojamiento()!.ciudad}">{{ alojamiento()!.ciudad }}</a> /
      <span>{{ alojamiento()!.nombre }}</span>
    </nav>

    <!-- GALERÍA -->
    <div class="gallery rs-wrap">
      <div class="gallery__main" (click)="abrirLightbox(imagenActiva())">
        <img [src]="imagenActiva()" [alt]="alojamiento()!.nombre" rsImg />
        <span class="gallery__contador"><rs-icon name="camera" [size]="14" [stroke]="2" /> {{ alojamiento()!.imagenes.length }} fotografías</span>
      </div>
      <div class="gallery__thumbs">
        @for (img of alojamiento()!.imagenes.slice(0,4); track img) {
          <div class="gallery__thumb" [class.active]="imagenActiva() === img"
               (click)="imagenActiva.set(img)">
            <img [src]="img" [alt]="alojamiento()!.nombre" rsImg />
          </div>
        }
        @if (alojamiento()!.imagenes.length > 4) {
          <div class="gallery__thumb gallery__thumb--more" (click)="abrirLightbox(alojamiento()!.imagenes[4])">
            +{{ alojamiento()!.imagenes.length - 4 }} fotos
          </div>
        }
      </div>
    </div>

    @if (lightboxAbierto()) {
      <div class="lightbox" role="dialog" aria-label="Galería a pantalla completa" (click)="cerrarLightbox()">
        <button type="button" class="lightbox__cerrar" (click)="cerrarLightbox()" aria-label="Cerrar galería">
          <rs-icon name="x" [size]="22" [stroke]="2"></rs-icon>
        </button>
        <button type="button" class="lightbox__nav lightbox__nav--prev" (click)="fotoAnterior(); $event.stopPropagation()" aria-label="Foto anterior">
          <rs-icon name="arrow-left" [size]="22" [stroke]="2"></rs-icon>
        </button>
        <img [src]="lightboxImagen()" [alt]="alojamiento()!.nombre" (click)="$event.stopPropagation()" />
        <button type="button" class="lightbox__nav lightbox__nav--next" (click)="siguienteFoto(); $event.stopPropagation()" aria-label="Foto siguiente">
          <rs-icon name="arrow-right" [size]="22" [stroke]="2"></rs-icon>
        </button>
        <span class="lightbox__contador"><rs-icon name="camera" [size]="14" [stroke]="2" /> {{ lightboxIndice() + 1 }} / {{ alojamiento()!.imagenes.length }}</span>
      </div>
    }

    <!-- CUERPO: info + booking panel -->
    <div class="detalle-body rs-wrap">

      <!-- INFO COLUMN -->
      <div class="info-col">

        <!-- Header -->
        <div class="info-header">
          <div class="info-header__stars">
            <rs-stars [score]="alojamiento()!.score" [size]="16" />
            <strong>{{ alojamiento()!.score }}</strong>
          </div>
          <h1 class="info-header__name">{{ alojamiento()!.nombre }}</h1>
          <p class="info-header__loc"><rs-icon name="map-pin" [size]="15" [stroke]="2" /> {{ alojamiento()!.direccion }}, {{ alojamiento()!.barrio }}, {{ alojamiento()!.ciudad }}</p>

          <div class="info-header__tags">
            @if (alojamiento()!.cancelacionGratis) {
              <span class="rs-badge rs-badge--success"><rs-icon name="check" [size]="13" [stroke]="3" /> Cancelación gratis</span>
            }
            @if (alojamiento()!.paseosIncluidos) {
              <span class="rs-badge rs-badge--teal"><rs-icon name="bone" [size]="13" [stroke]="2" /> Paseos diarios incluidos</span>
            }
            @if (alojamiento()!.camaras24h) {
              <span class="rs-badge rs-badge--accent"><rs-icon name="video" [size]="13" [stroke]="2" /> Cámaras 24h</span>
            }
            @if (alojamiento()!.destacado) {
              <span class="premium-pill"><rs-icon name="crown" size="14" /> Premium</span>
            }
          </div>
        </div>

        <!-- Garantía Doogking (HU-4.1.9 · TCK-8009) -->
        <div class="compromiso-block" rsAnim>
          <h3 class="compromiso-block__title"><rs-icon name="shield-check" size="18" /> Garantía Doogking</h3>
          <rs-trust-block></rs-trust-block>
        </div>

        <!-- Compatibilidad con tu perro (HU-4.1.7) -->
        @if (perroCompat() && compatibilidad().length) {
          <div class="compat-block" rsAnim>
            <h3 class="compat-block__title"><rs-icon name="dog" [size]="18" [stroke]="2" /> Compatibilidad con {{ perroCompat()!.nombre }}</h3>
            @if (bienestarPerro(); as ib) {
              <p class="compat-block__bienestar"><rs-icon name="badge-check" [size]="15" [stroke]="2" /> Índice de Bienestar de {{ perroCompat()!.nombre }}: {{ ib.puntuacion }}/100</p>
            }
            <ul class="compat-block__list">
              @for (p of compatibilidad(); track p) {
                <li><rs-icon name="check" [size]="14" [stroke]="3" /> {{ p }}</li>
              }
            </ul>
          </div>
        }

        <!-- Rating summary -->
        <div class="rating-summary rs-card" rsAnim>
          <div class="rating-summary__score">
            <div class="rating-big">{{ alojamiento()!.score }}</div>
            <div>
              <div class="rating-big-label">{{ alojamiento()!.scoreLabel }}</div>
              <div style="font-size:var(--f-xs);color:var(--t-400)">{{ alojamiento()!.numResenas | number }} reseñas verificadas</div>
            </div>
          </div>
          <!-- "Índice Doogking" con barras (PDF 27/07 §13): son las medias
               reales por aspecto de las reseñas, no una puntuación aparte. -->
          @if (ratingItems().length > 0) {
            <div class="rating-breakdown">
              <p class="rating-breakdown__titulo">
                <rs-icon name="crown" [size]="15" [stroke]="2" /> Índice Doogking
              </p>
              @for (item of ratingItems(); track item.label) {
                <div class="rating-bar">
                  <span>{{ item.label }}</span>
                  <div class="rating-bar__track"><div class="rating-bar__fill" [style.width.%]="item.pct"></div></div>
                  <strong>{{ item.val }}</strong>
                </div>
              }
            </div>
          }
        </div>

        <!-- Descripción -->
        <div class="section-block" rsAnim>
          <h2>Sobre este alojamiento canino</h2>
          <p>{{ alojamiento()!.descripcion }}</p>
        </div>

        <!-- Amenidades caninas -->
        <div class="section-block" rsAnim>
          <h2>Servicios para tu perro</h2>
          <div class="amenities-grid">
            @for (a of alojamiento()!.amenities; track a) {
              <div class="amenity-item"><rs-icon name="paw" size="16" /> {{ a }}</div>
            } @empty {
              <p style="color:var(--t-400);font-size:var(--f-sm)">Servicios no especificados.</p>
            }
          </div>
        </div>

        <!-- Espacios -->
        <div class="section-block" rsAnim>
          <h2>Tipos de espacio</h2>
          <div class="rooms-list">
            @for (esp of alojamiento()!.espacios; track esp.id) {
              <div class="room-card rs-card" [class.rs-card--glow]="espacioSelec()?.id === esp.id">
                <div class="room-card__img">
                  <img [src]="imagenEspacio(esp)" [alt]="tipoLabel(esp.tipo)" rsImg />
                </div>
                <div class="room-card__body">
                  <h3 class="room-card__type">{{ tipoLabel(esp.tipo) }}</h3>
                  <p class="room-card__desc">{{ esp.descripcion }}</p>
                  <div class="room-card__meta">
                    @if (esp.tamanoMaxPerro) {
                      <span><rs-icon name="paw" size="14" /> Hasta tamaño {{ tamanoLabel(esp.tamanoMaxPerro) }}</span>
                    } @else {
                      <span><rs-icon name="paw" size="14" /> Cualquier tamaño</span>
                    }
                    <span><rs-icon name="bone" size="14" /> {{ esp.cantidad }} {{ esp.cantidad === 1 ? 'espacio' : 'espacios' }}</span>
                  </div>
                  <div class="room-card__amenities">
                    @for (a of esp.amenities.slice(0,4); track a) {
                      <span class="rs-amenity">{{ a }}</span>
                    }
                  </div>
                  @if (esp.cancelacionGratis) {
                    <p class="room-card__free-cancel"><rs-icon name="check" [size]="13" [stroke]="3" /> Cancelación gratis</p>
                  }
                </div>
                <div class="room-card__price">
                  @if (esp.precioAnterior) {
                    <div class="rs-price__old">€{{ esp.precioAnterior }}</div>
                  }
                  <div class="room-price-amount">€{{ esp.precioNoche }}</div>
                  <div style="font-size:var(--f-xs);color:var(--t-400)">por noche</div>
                  @if (esp.disponible) {
                    <button class="rs-btn rs-btn--primary rs-btn--block"
                            style="margin-top:var(--sp-4)"
                            [class.rs-btn--outline]="espacioSelec()?.id === esp.id"
                            (click)="seleccionarEspacio(esp)">
                      @if (espacioSelec()?.id === esp.id) {
                        <rs-icon name="check" [size]="14" [stroke]="3" /> Seleccionado
                      } @else { Seleccionar }
                    </button>
                  } @else {
                    <button class="rs-btn rs-btn--ghost rs-btn--block" disabled
                            style="margin-top:var(--sp-4)">No disponible</button>
                  }
                </div>
              </div>
            } @empty {
              <p style="color:var(--t-400);font-size:var(--f-sm)">
                Este alojamiento aún no ha publicado sus tipos de espacio. Contacta con el comercio para más detalles.
              </p>
            }
          </div>
        </div>

        <!-- Políticas en acordeón (PDF 27/07 §13) con details/summary nativos:
             accesibles y operables con teclado sin JavaScript. -->
        <div class="section-block" rsAnim>
          <h2>Políticas del alojamiento</h2>
          <div class="policies-acc">
            <details class="policy-acc" open>
              <summary class="policy-acc__head">
                <rs-icon name="log-out" [size]="16" [stroke]="2" /> Entrada
              </summary>
              <div class="policy-acc__body">
                <p><strong>Check-in:</strong> {{ alojamiento()!.checkIn }}</p>
                @if (alojamiento()!.compatibilidadSocialAdmitida.length) {
                  <p><strong>Compatibilidad social admitida:</strong>
                    {{ alojamiento()!.compatibilidadSocialAdmitida.join(', ') }}</p>
                }
              </div>
            </details>

            <details class="policy-acc">
              <summary class="policy-acc__head">
                <rs-icon name="clock" [size]="16" [stroke]="2" /> Salida
              </summary>
              <div class="policy-acc__body">
                <p><strong>Check-out:</strong> {{ alojamiento()!.checkOut }}</p>
              </div>
            </details>

            <details class="policy-acc">
              <summary class="policy-acc__head">
                <rs-icon name="shield-check" [size]="16" [stroke]="2" /> Cancelación
              </summary>
              <div class="policy-acc__body">
                <p>{{ alojamiento()!.politicaCancelacion }}</p>
              </div>
            </details>

            <details class="policy-acc">
              <summary class="policy-acc__head">
                <rs-icon name="syringe" [size]="16" [stroke]="2" /> Vacunas y requisitos sanitarios
              </summary>
              <div class="policy-acc__body">
                <p>{{ alojamiento()!.requisitoVacunas ? 'Cartilla de vacunación obligatoria' : 'Sin requisito de vacunas' }}</p>
                @if (alojamiento()!.requisitoMicrochip) { <p><strong>Microchip:</strong> obligatorio</p> }
                @if (alojamiento()!.requiereDesparasitacionInterna || alojamiento()!.requiereDesparasitacionExterna) {
                  <p><strong>Desparasitación:</strong> {{ desparasitacionLabel() }}</p>
                }
                @if (alojamiento()!.requiereVacunaTosPerreras) {
                  <p><strong>Vacuna tos de las perreras:</strong> requerida</p>
                }
              </div>
            </details>
          </div>
          @if (alojamiento()!.serviciosAdicionales.length) {
            <div class="section-block">
              <h3>Servicios adicionales</h3>
              <div class="room-card__amenities">
                @for (s of alojamiento()!.serviciosAdicionales; track s.nombre) {
                  <span class="rs-amenity">{{ s.nombre }} (€{{ s.precio }})</span>
                }
              </div>
            </div>
          }
          <div class="rules-list">
            @for (r of (alojamiento()!.reglas ?? []); track r) {
              <div class="rule-item">• {{ r }}</div>
            }
          </div>
        </div>

        <!-- Reseñas -->
        <div class="section-block" rsAnim>
          <h2>Reseñas de dueños <span style="color:var(--t-400);font-weight:400">({{ alojamiento()!.resenas.length }})</span></h2>
          <div class="resenas-list">
            @for (r of alojamiento()!.resenas; track r.id) {
              <div class="resena-card rs-card" rsAnim>
                <div class="resena-card__header">
                  <div class="resena-card__avatar">{{ r.autorNombre.charAt(0) }}</div>
                  <div>
                    <div class="resena-card__autor">{{ r.autorNombre }}</div>
                    <div class="resena-card__meta">{{ r.fecha | date:'d MMM yyyy' }}</div>
                  </div>
                  <div class="resena-card__score rs-badge rs-badge--accent">{{ r.puntuacion }}/5</div>
                </div>
                <p class="resena-card__texto">{{ r.comentario }}</p>
                @if (r.fotos?.length) {
                  <div class="resena-card__fotos">
                    @for (foto of r.fotos; track foto) {
                      <img [src]="foto" [alt]="'Foto de la reseña de ' + r.autorNombre" rsImg />
                    }
                  </div>
                }
                @if (r.respuesta) {
                  <div class="resena-respuesta">
                    <strong>Respuesta del alojamiento:</strong>
                    <p>{{ r.respuesta }}</p>
                  </div>
                }
              </div>
            }
            @if (alojamiento()!.resenas.length === 0) {
              <p style="color:var(--t-400)">Todavía no hay reseñas para este alojamiento.</p>
            }
          </div>
        </div>

      </div>

      <!-- BOOKING PANEL (sticky, acento dorado superior) -->
      <div class="booking-panel rs-sticky-panel">
        <div class="booking-panel__card">
          @if (espacioSelec()) {
            <div class="booking-panel__selected">
              <span class="rs-badge rs-badge--success"><rs-icon name="check" [size]="13" [stroke]="3" /> Espacio seleccionado</span>
              <h4>{{ tipoLabel(espacioSelec()!.tipo) }}</h4>
            </div>
          } @else {
            <div style="text-align:center;color:var(--t-400);font-size:var(--f-sm);margin-bottom:var(--sp-4)">
              Selecciona un espacio para reservar
            </div>
          }

          <div class="booking-panel__price">
            <div class="bp-desde">Desde</div>
            <div class="bp-amount">€{{ espacioSelec()?.precioNoche ?? alojamiento()!.precioPorNoche }}</div>
            <div class="bp-per">por noche</div>
          </div>

          <div style="font-size:var(--f-xs);color:var(--t-400);text-align:center;margin-bottom:var(--sp-5)">
            Impuestos e IVA incluidos
          </div>

          <button class="rs-btn rs-btn--gold rs-btn--block rs-btn--lg"
                  [disabled]="!espacioSelec()"
                  (click)="irAReserva()">
            {{ espacioSelec() ? 'Reservar' : 'Selecciona un espacio' }}
          </button>

          <rs-trust-block class="booking-panel__trust" [items]="extrasTrust()"></rs-trust-block>

          <hr class="rs-hr" style="margin-block:var(--sp-5)">

          <div class="booking-panel__score">
            <rs-rating [score]="alojamiento()!.score" [label]="alojamiento()!.scoreLabel" [count]="alojamiento()!.numResenas"></rs-rating>
          </div>
        </div>
      </div>

    </div>
  </div>
  }
</div>
  `,
  styles: [`
    :host { display: block; }
    .detalle-page { min-height: 100vh; background: var(--c-base); }
    .detalle-wrap { padding-bottom: var(--sp-20); }

    /* BREADCRUMB */
    .breadcrumb {
      padding-block: var(--sp-5);
      font-size: var(--f-xs);
      color: var(--t-400);
      display: flex;
      gap: var(--sp-2);
      flex-wrap: wrap;
      a { color: var(--t-400); &:hover { color: var(--t-200); } }
      span { color: var(--t-200); }
    }

    /* GALLERY */
    .gallery {
      display: grid;
      grid-template-columns: 1fr 200px;
      gap: var(--sp-3);
      height: 480px;
      margin-bottom: var(--sp-8);

      @media (max-width: 768px) { grid-template-columns: 1fr; height: auto; }
    }

    .gallery__main {
      position: relative;
      border-radius: var(--r-xl);
      overflow: hidden;
      cursor: pointer;
      img { width: 100%; height: 100%; object-fit: cover; }
    }
    .gallery__contador {
      position: absolute;
      right: var(--sp-3);
      bottom: var(--sp-3);
      background: rgba(0,0,0,.6);
      color: #fff;
      font-size: var(--f-xs);
      font-weight: var(--w-6);
      padding: var(--sp-1) var(--sp-3);
      border-radius: var(--r-full);
    }

    /* LIGHTBOX (HU-4.1.1) */
    .lightbox {
      position: fixed; inset: 0; z-index: var(--z-4, 100);
      background: rgba(0,0,0,.92);
      display: flex; align-items: center; justify-content: center;
      animation: fadeIn 160ms ease both;

      img {
        max-width: min(92vw, 1100px); max-height: 86vh;
        object-fit: contain; border-radius: var(--r-lg);
        cursor: default;
      }
    }
    .lightbox__cerrar {
      position: absolute; top: var(--sp-5); right: var(--sp-5);
      width: 44px; height: 44px; border-radius: 50%;
      background: rgba(255,255,255,.12); border: none; color: #fff;
      display: flex; align-items: center; justify-content: center; cursor: pointer;
      transition: background var(--d-2);
      &:hover { background: rgba(255,255,255,.22); }
    }
    .lightbox__nav {
      position: absolute; top: 50%; transform: translateY(-50%);
      width: 48px; height: 48px; border-radius: 50%;
      background: rgba(255,255,255,.12); border: none; color: #fff;
      display: flex; align-items: center; justify-content: center; cursor: pointer;
      transition: background var(--d-2);
      &:hover { background: rgba(255,255,255,.22); }
    }
    .lightbox__nav--prev { left: var(--sp-5); }
    .lightbox__nav--next { right: var(--sp-5); }
    .lightbox__contador {
      position: absolute; bottom: var(--sp-5); left: 50%; transform: translateX(-50%);
      color: #fff; font-size: var(--f-sm); font-weight: var(--w-6);
      background: rgba(255,255,255,.12); padding: var(--sp-1) var(--sp-4); border-radius: var(--r-full);
    }
    @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
    @media (max-width: 640px) {
      .lightbox__nav { width: 40px; height: 40px; }
      .lightbox__nav--prev { left: var(--sp-2); }
      .lightbox__nav--next { right: var(--sp-2); }
    }

    .gallery__thumbs { display: flex; flex-direction: column; gap: var(--sp-3); }

    .gallery__thumb {
      flex: 1;
      border-radius: var(--r-lg);
      overflow: hidden;
      cursor: pointer;
      border: 2px solid transparent;
      transition: border-color var(--d-2);

      img { width: 100%; height: 100%; object-fit: cover; }
      &.active { border-color: var(--c-accent); }
      &:hover:not(.active) { border-color: var(--b-2); }
    }
    .gallery__thumb--more {
      display: flex;
      align-items: center;
      justify-content: center;
      background: var(--c-surface);
      font-size: var(--f-sm);
      color: var(--t-300);
      font-weight: var(--w-6);
    }

    /* BODY LAYOUT */
    .detalle-body {
      display: grid;
      grid-template-columns: 1fr 360px;
      gap: var(--sp-8);
      align-items: start;

      @media (max-width: 1024px) { grid-template-columns: 1fr; }
    }

    /* INFO COLUMN */
    .info-header__stars { font-size: var(--f-md); color: var(--dk-gold); margin-bottom: var(--sp-2); strong { color: var(--t-100); } }
    .info-header__name  { font-size: var(--f-4xl); font-weight: var(--w-8); color: var(--dk-blue); letter-spacing: -.03em; margin-bottom: var(--sp-3); }
    .info-header__loc   { font-size: var(--f-sm); color: var(--t-400); margin-bottom: var(--sp-4); }
    .info-header__tags  { display: flex; flex-wrap: wrap; gap: var(--sp-2); align-items: center; }

    .premium-pill {
      display: inline-flex;
      align-items: center;
      gap: var(--sp-1);
      background: var(--dk-gold);
      color: var(--dk-blue-deep);
      font-size: var(--f-xs);
      font-weight: var(--w-7);
      padding: var(--sp-1) var(--sp-3);
      border-radius: var(--r-full);
    }

    .compromiso-block {
      margin-top: var(--sp-5);
      padding: var(--sp-5);
      background: var(--c-accent-lo);
      border: 1px solid var(--b-a);
      border-radius: var(--r-lg);
    }
    .compromiso-block__title {
      display: flex; align-items: center; gap: var(--sp-2);
      font-size: var(--f-md); font-weight: var(--w-7); color: var(--dk-blue);
      margin-bottom: var(--sp-3);
    }
    .compat-block {
      margin-top: var(--sp-5);
      padding: var(--sp-5);
      background: rgba(251,174,23,.08);
      border: 1px solid rgba(251,174,23,.3);
      border-radius: var(--r-lg);
    }
    .compat-block__title { font-size: var(--f-md); font-weight: var(--w-7); color: var(--dk-blue-deep); margin-bottom: var(--sp-3); }
    .compat-block__bienestar { font-size: var(--f-sm); color: var(--t-200); margin-bottom: var(--sp-3); }
    .compat-block__list { display: flex; flex-direction: column; gap: var(--sp-2); font-size: var(--f-sm); color: var(--t-200); }
    .compat-block__list li { list-style: none; }

    .rating-summary {
      display: grid;
      grid-template-columns: auto 1fr;
      gap: var(--sp-8);
      padding: var(--sp-6);
      margin-block: var(--sp-6);
    }

    .rating-summary__score { display: flex; align-items: center; gap: var(--sp-4); }
    .rating-big { font-size: var(--f-6xl); font-weight: var(--w-9); color: var(--dk-blue); line-height: 1; }
    .rating-big-label { font-size: var(--f-lg); font-weight: var(--w-7); color: var(--t-100); }
    .rating-breakdown { display: flex; flex-direction: column; gap: var(--sp-3); }
    .rating-breakdown__titulo {
      display: flex; align-items: center; gap: var(--sp-2);
      margin: 0 0 var(--sp-1);
      font-family: var(--font-accent);
      font-size: var(--f-xs); font-weight: var(--w-7);
      letter-spacing: .06em; text-transform: uppercase;
      color: var(--dk-blue);
      rs-icon { color: var(--dk-gold); }
    }
    .rating-bar { display: grid; grid-template-columns: 100px 1fr 30px; align-items: center; gap: var(--sp-3); font-size: var(--f-sm); color: var(--t-300); }
    .rating-bar__track { height: 6px; background: var(--c-surface); border-radius: var(--r-full); overflow: hidden; }
    .rating-bar__fill  { height: 100%; background: var(--g-accent); border-radius: var(--r-full); transition: width .8s ease; }

    .section-block { margin-block: var(--sp-10); h2 { font-size: var(--f-2xl); font-weight: var(--w-7); color: var(--dk-blue); margin-bottom: var(--sp-6); } p { color: var(--t-300); line-height: 1.8; } }

    .amenities-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: var(--sp-3); @media (max-width: 640px) { grid-template-columns: 1fr 1fr; } }
    .amenity-item { display: flex; align-items: center; gap: var(--sp-2); font-size: var(--f-sm); color: var(--t-200); padding: var(--sp-3); background: var(--c-raised); border-radius: var(--r-lg); border: 1px solid var(--b-1); rs-icon { color: var(--dk-gold); flex-shrink: 0; } }

    /* ESPACIO CARD */
    .rooms-list { display: flex; flex-direction: column; gap: var(--sp-4); }
    .room-card { display: grid; grid-template-columns: 240px 1fr auto; padding: 0; overflow: hidden; @media (max-width: 768px) { grid-template-columns: 1fr; } }
    .room-card__img { min-height: 180px; background: var(--c-surface); img { width: 100%; height: 100%; min-height: 180px; object-fit: cover; display: block; } }
    .room-card__body { padding: var(--sp-6); }
    .room-card__type { font-size: var(--f-md); font-weight: var(--w-7); color: var(--dk-blue); margin-bottom: var(--sp-2); }
    .room-card__desc { font-size: var(--f-sm); color: var(--t-400); margin-bottom: var(--sp-4); }
    .room-card__meta { display: flex; gap: var(--sp-4); font-size: var(--f-xs); color: var(--t-300); margin-bottom: var(--sp-4); flex-wrap: wrap; span { display: inline-flex; align-items: center; gap: var(--sp-1); } rs-icon { color: var(--dk-gold); } }
    .room-card__amenities { display: flex; flex-wrap: wrap; gap: var(--sp-2); }
    .room-card__free-cancel { font-size: var(--f-xs); color: var(--c-success); margin-top: var(--sp-3); }
    .room-card__price { padding: var(--sp-6); border-left: 1px solid var(--b-1); display: flex; flex-direction: column; align-items: flex-end; min-width: 180px; @media (max-width: 768px) { border-left: none; border-top: 1px solid var(--b-1); align-items: flex-start; } }
    .room-price-amount { font-size: var(--f-3xl); font-weight: var(--w-8); color: var(--dk-blue); letter-spacing: -.03em; }

    /* POLICIES */
    /* Políticas en acordeón (PDF 27/07 §13) */
    .policies-acc { display: flex; flex-direction: column; gap: var(--sp-2); margin-bottom: var(--sp-6); }

    .policy-acc {
      background: var(--c-card);
      border: 1px solid var(--b-1);
      border-radius: var(--r-lg);
      overflow: hidden;
    }

    .policy-acc__head {
      display: flex;
      align-items: center;
      gap: var(--sp-3);
      padding: var(--sp-4);
      font-size: var(--f-sm);
      font-weight: var(--w-6);
      color: var(--t-100);
      cursor: pointer;
      list-style: none;
      transition: background var(--d-2);

      &::-webkit-details-marker { display: none; }
      &:hover { background: var(--c-raised); }
      rs-icon { color: var(--c-accent); flex-shrink: 0; }

      /* Chevron propio que gira al abrir. */
      &::after {
        content: '';
        margin-left: auto;
        width: 8px; height: 8px;
        border-right: 2px solid var(--t-400);
        border-bottom: 2px solid var(--t-400);
        transform: rotate(45deg) translate(-2px, -2px);
        transition: transform var(--d-2);
      }
    }

    .policy-acc[open] .policy-acc__head::after { transform: rotate(-135deg) translate(-2px, -2px); }

    .policy-acc__body {
      padding: 0 var(--sp-4) var(--sp-4) calc(var(--sp-4) + 16px + var(--sp-3));
      font-size: var(--f-sm);
      color: var(--t-300);

      p { margin: 0 0 var(--sp-2); &:last-child { margin-bottom: 0; } }
      strong { color: var(--t-200); }
    }
    .rules-list { display: flex; flex-direction: column; gap: var(--sp-2); }
    .rule-item { font-size: var(--f-sm); color: var(--t-300); }

    /* REVIEWS */
    .resenas-list { display: flex; flex-direction: column; gap: var(--sp-4); }
    .resena-card { padding: var(--sp-6); }
    .resena-card__header { display: flex; align-items: center; gap: var(--sp-3); margin-bottom: var(--sp-4); }
    .resena-card__avatar { width: 44px; height: 44px; background: var(--g-warm); border-radius: var(--r-full); display: flex; align-items: center; justify-content: center; font-size: 1.25rem; flex-shrink: 0; }
    .resena-card__autor { font-size: var(--f-sm); font-weight: var(--w-6); color: var(--t-100); }
    .resena-card__meta  { font-size: var(--f-xs); color: var(--t-400); margin-top: 2px; }
    .resena-card__score { margin-left: auto; }
    .resena-card__titulo { font-size: var(--f-md); font-weight: var(--w-6); color: var(--t-100); margin-bottom: var(--sp-3); }
    .resena-card__texto  { font-size: var(--f-sm); color: var(--t-300); line-height: 1.7; }
    .resena-card__fotos {
      display: flex; flex-wrap: wrap; gap: var(--sp-2); margin-top: var(--sp-3);
      img { width: 84px; height: 84px; object-fit: cover; border-radius: var(--r-md); }
    }
    .resena-respuesta { margin-top: var(--sp-4); padding: var(--sp-4); background: var(--c-raised); border-left: 2px solid var(--c-accent); border-radius: 0 var(--r-md) var(--r-md) 0; font-size: var(--f-sm); color: var(--t-300); strong { color: var(--t-200); display: block; margin-bottom: var(--sp-2); } }

    /* BOOKING PANEL — acento dorado superior. Sticky vía .rs-sticky-panel (styles.scss). */
    .booking-panel__card {
      background: var(--c-card);
      border: 1px solid var(--b-2);
      border-top: 4px solid var(--dk-gold);
      border-radius: var(--r-2xl);
      padding: var(--sp-6);
      box-shadow: var(--sh-xl);
    }
    .booking-panel__selected { margin-bottom: var(--sp-5); h4 { font-size: var(--f-md); font-weight: var(--w-6); color: var(--t-100); margin-top: var(--sp-2); } }
    .booking-panel__price { text-align: center; margin-bottom: var(--sp-2); }
    .bp-desde  { font-size: var(--f-xs); color: var(--t-400); text-transform: uppercase; letter-spacing: .06em; }
    .bp-amount { font-size: var(--f-5xl); font-weight: var(--w-9); letter-spacing: -.04em; color: var(--dk-blue); }
    .bp-per    { font-size: var(--f-sm); color: var(--t-400); }
    .booking-panel__trust { margin-top: var(--sp-4); display: flex; flex-direction: column; gap: var(--sp-2); p { font-size: var(--f-xs); color: var(--t-400); } }
    .booking-panel__score { display: flex; justify-content: center; }
  `],
})
export class AlojamientoDetalleComponent implements OnInit {
  private readonly route  = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly alojamientoService = inject(AlojamientoService);
  private readonly perrosService = inject(PerrosService);

  readonly cargando = signal(true);
  readonly alojamiento = signal<AlojamientoDetalle | null>(null);
  readonly imagenActiva = signal('');
  readonly espacioSelec = signal<Espacio | null>(null);

  /** Galería a pantalla completa (HU-4.1.1). */
  readonly lightboxAbierto = signal(false);
  readonly lightboxImagen = signal('');
  readonly lightboxIndice = computed(() => {
    const imagenes = this.alojamiento()?.imagenes ?? [];
    const indice = imagenes.indexOf(this.lightboxImagen());
    return indice >= 0 ? indice : 0;
  });

  abrirLightbox(imagen: string): void {
    this.lightboxImagen.set(imagen);
    this.lightboxAbierto.set(true);
  }

  cerrarLightbox(): void {
    this.lightboxAbierto.set(false);
  }

  siguienteFoto(): void {
    const imagenes = this.alojamiento()?.imagenes ?? [];
    if (!imagenes.length) return;
    const siguiente = (this.lightboxIndice() + 1) % imagenes.length;
    this.lightboxImagen.set(imagenes[siguiente]);
  }

  fotoAnterior(): void {
    const imagenes = this.alojamiento()?.imagenes ?? [];
    if (!imagenes.length) return;
    const anterior = (this.lightboxIndice() - 1 + imagenes.length) % imagenes.length;
    this.lightboxImagen.set(imagenes[anterior]);
  }
  /** Mascota elegida en el buscador, para el bloque "Compatibilidad con tu perro" (HU-4.1.7). */
  readonly perroCompat = signal<PerroApi | null>(null);
  /** Índice de Bienestar de esa mascota (HU-8.1.7); null si aún no está calculado. */
  readonly bienestarPerro = signal<IndiceBienestarApi | null>(null);

  // Fechas/perros ya buscados en el listado, para no volver a pedirlos en el wizard.
  private checkInQP: string | null = null;
  private checkOutQP: string | null = null;
  private perrosQP: string | null = null;
  private perroIdQP: string | null = null;

  /** Extras propios de este alojamiento que se añaden al bloque de confianza estándar. */
  extrasTrust(): TrustItem[] {
    const a = this.alojamiento();
    const items: TrustItem[] = [];
    if (a?.paseosIncluidos) items.push({ icon: 'bone', label: 'Paseos diarios incluidos' });
    if (a?.camaras24h) items.push({ icon: 'video', label: 'Sigue a tu perro por cámara 24h' });
    return items;
  }

  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('id') ?? '';
    const qp = this.route.snapshot.queryParamMap;
    this.checkInQP = qp.get('desde');
    this.checkOutQP = qp.get('hasta');
    this.perrosQP = qp.get('perros');
    this.perroIdQP = qp.get('perroId');
    this.cargar(id);
    if (this.perroIdQP) {
      this.perrosService.obtener(this.perroIdQP).then(
        (perro) => this.perroCompat.set(perro),
        () => this.perroCompat.set(null), // Mascota no disponible: se omite el bloque, no se inventa.
      );
      this.perrosService.bienestar(this.perroIdQP).then(
        (indice) => this.bienestarPerro.set(indice),
        () => this.bienestarPerro.set(null),
      );
    }
  }

  /**
   * Puntos de compatibilidad reales entre la mascota elegida y este alojamiento
   * (HU-4.1.7) — solo a partir de datos que ambos declaran, nunca inventados.
   */
  compatibilidad(): string[] {
    const perro = this.perroCompat();
    const a = this.alojamiento();
    if (!perro || !a) return [];
    const puntos: string[] = [];

    if (!a.compatibilidadSocialAdmitida.length || (perro.sociabilidadPerros && a.compatibilidadSocialAdmitida.some(
      (p) => p.toLowerCase().includes(perro.sociabilidadPerros!.toLowerCase())))) {
      puntos.push(`Perfil social admitido para perros ${perro.sociabilidadPerros ?? 'de cualquier tipo'}`);
    }
    if (perro.ansiedadSeparacion && a.camaras24h) {
      puntos.push('Cámaras 24h: podrás ver cómo lleva la separación');
    }
    if (perro.tamano) {
      const admiteTamano = a.espacios.some((e) => !e.tamanoMaxPerro || e.tamanoMaxPerro === perro.tamano);
      if (!a.espacios.length || admiteTamano) puntos.push(`Espacio adecuado para su tamaño (${this.tamanoLabel(perro.tamano as TamanoPerro)})`);
    }
    if (perro.temperamento) {
      puntos.push(`Temperamento declarado: ${perro.temperamento}`);
    }
    return puntos;
  }

  async cargar(id: string): Promise<void> {
    try {
      const data = await this.alojamientoService.obtener(id);
      this.alojamiento.set(data);
      this.imagenActiva.set(data.imagenes[0] ?? PLACEHOLDER_IMG);
    } catch {
      // Sin mock: si no se puede cargar el servicio, se muestra "no encontrado"
      // en vez de un detalle falso que llevaría a una reserva imposible.
      this.alojamiento.set(null);
    } finally {
      this.cargando.set(false);
    }
  }

  /** Foto del espacio con respaldo: la del espacio, si no la del alojamiento, si no un placeholder. */
  imagenEspacio(esp: Espacio): string {
    return esp.imagenes[0] || this.alojamiento()?.imagenes[0] || PLACEHOLDER_IMG;
  }

  tipoLabel(tipo: TipoEspacio): string {
    const map: Record<TipoEspacio, string> = {
      suite: 'Suite individual',
      estandar: 'Espacio estándar',
      compartido: 'Espacio compartido',
      premium: 'Zona premium',
      climatizada: 'Habitación climatizada',
    };
    return map[tipo] ?? tipo;
  }

  tamanoLabel(tamano: TamanoPerro): string {
    const map: Record<TamanoPerro, string> = {
      mini: 'mini',
      pequeno: 'pequeño',
      mediano: 'mediano',
      grande: 'grande',
      gigante: 'gigante',
    };
    return map[tamano] ?? tamano;
  }

  desparasitacionLabel(): string {
    const a = this.alojamiento();
    if (!a) return '';
    const partes = [a.requiereDesparasitacionInterna ? 'Interna' : null, a.requiereDesparasitacionExterna ? 'Externa' : null];
    return partes.filter((p): p is string => p !== null).join(' y ');
  }

  seleccionarEspacio(esp: Espacio): void {
    this.espacioSelec.set(this.espacioSelec()?.id === esp.id ? null : esp);
  }

  irAReserva(): void {
    if (!this.espacioSelec()) return;
    const alojamiento = this.alojamiento()!;
    void this.router.navigate(['/reservas', 'alojamiento', alojamiento.id], {
      queryParams: {
        espacioId:  this.espacioSelec()!.id,
        comercioId: alojamiento.comercioId,
        nombre:     alojamiento.nombre,
        precioBase: this.espacioSelec()!.precioNoche,
        imagen:     alojamiento.imagenes?.[0] ?? '',
        checkIn:    this.checkInQP ?? undefined,
        checkOut:   this.checkOutQP ?? undefined,
        perros:     this.perrosQP ?? undefined,
        perroId:    this.perroIdQP ?? undefined,
      },
    });
  }

  /**
   * Desglose de la valoración por aspectos (HU-4.1.6), promediado sobre las
   * reseñas reales que puntuaron cada criterio.
   *
   * Antes leía `scoreDesglose`, un campo que el backend nunca ha enviado: el
   * bloque quedaba siempre vacío. Ahora sale de `resena.aspectos`, que sí
   * existe desde que el formulario de reseña permite puntuar por criterio; un
   * aspecto que nadie ha valorado no se pinta, en vez de mostrarse como 0.
   */
  readonly ratingItems = computed(() => {
    const resenas = this.alojamiento()?.resenas ?? [];
    if (resenas.length === 0) return [];

    return aspectosDeVertical(VerticalKey.ALOJAMIENTO)
      .map(({ key, label }) => {
        const notas = resenas
          .map((r) => r.aspectos?.[key])
          .filter((n): n is number => typeof n === 'number' && n > 0);
        if (notas.length === 0) return null;

        const media = Math.round((notas.reduce((s, n) => s + n, 0) / notas.length) * 10) / 10;
        return { label, val: media, pct: media * 20 };
      })
      .filter((item): item is { label: string; val: number; pct: number } => item !== null);
  });

}
