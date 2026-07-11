import { Component, signal, OnInit, inject } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { DecimalPipe, DatePipe } from '@angular/common';
import { RsNavbarComponent } from '../../../shared/components/navbar/rs-navbar.component';
import { RsIconComponent } from '../../../shared/components/icon/rs-icon.component';
import { AnimateOnScrollDirective } from '../../../shared/directives/animate-on-scroll.directive';
import { ImgFallbackDirective } from '../../../shared/directives/img-fallback.directive';
import { AlojamientoService, AlojamientoDetalle, Espacio, TamanoPerro, TipoEspacio } from '../services/alojamiento.service';

@Component({
  selector: 'app-alojamiento-detalle',
  standalone: true,
  imports: [RouterLink, DecimalPipe, DatePipe, RsNavbarComponent, RsIconComponent, AnimateOnScrollDirective, ImgFallbackDirective],
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
      <div style="font-size:3rem">🐾</div>
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
      <div class="gallery__main">
        <img [src]="imagenActiva()" [alt]="alojamiento()!.nombre" rsImg />
      </div>
      <div class="gallery__thumbs">
        @for (img of alojamiento()!.imagenes.slice(0,4); track img) {
          <div class="gallery__thumb" [class.active]="imagenActiva() === img"
               (click)="imagenActiva.set(img)">
            <img [src]="img" [alt]="alojamiento()!.nombre" rsImg />
          </div>
        }
        @if (alojamiento()!.imagenes.length > 4) {
          <div class="gallery__thumb gallery__thumb--more">
            +{{ alojamiento()!.imagenes.length - 4 }} fotos
          </div>
        }
      </div>
    </div>

    <!-- CUERPO: info + booking panel -->
    <div class="detalle-body rs-wrap">

      <!-- INFO COLUMN -->
      <div class="info-col">

        <!-- Header -->
        <div class="info-header">
          <div class="info-header__stars">{{ estrellas(alojamiento()!.score) }} <strong>{{ alojamiento()!.score }}</strong></div>
          <h1 class="info-header__name">{{ alojamiento()!.nombre }}</h1>
          <p class="info-header__loc">📍 {{ alojamiento()!.direccion }}, {{ alojamiento()!.barrio }}, {{ alojamiento()!.ciudad }}</p>

          <div class="info-header__tags">
            @if (alojamiento()!.cancelacionGratis) {
              <span class="rs-badge rs-badge--success">✓ Cancelación gratis</span>
            }
            @if (alojamiento()!.paseosIncluidos) {
              <span class="rs-badge rs-badge--teal">✓ Paseos diarios incluidos</span>
            }
            @if (alojamiento()!.camaras24h) {
              <span class="rs-badge rs-badge--accent">📹 Cámaras 24h</span>
            }
            @if (alojamiento()!.destacado) {
              <span class="premium-pill"><rs-icon name="crown" size="14" /> Premium</span>
            }
          </div>
        </div>

        <!-- Rating summary -->
        <div class="rating-summary rs-card" rsAnim>
          <div class="rating-summary__score">
            <div class="rating-big">{{ alojamiento()!.score }}</div>
            <div>
              <div class="rating-big-label">{{ alojamiento()!.scoreLabel }}</div>
              <div style="font-size:var(--f-xs);color:var(--t-400)">{{ alojamiento()!.numResenas | number }} reseñas verificadas</div>
            </div>
          </div>
          <div class="rating-breakdown">
            @for (item of ratingItems(); track item.label) {
              <div class="rating-bar">
                <span>{{ item.label }}</span>
                <div class="rating-bar__track"><div class="rating-bar__fill" [style.width.%]="item.pct"></div></div>
                <strong>{{ item.val }}</strong>
              </div>
            }
          </div>
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
                  @if (esp.imagenes[0]) {
                    <img [src]="esp.imagenes[0]" [alt]="tipoLabel(esp.tipo)" rsImg />
                  }
                </div>
                <div class="room-card__body">
                  <h3 class="room-card__type">{{ tipoLabel(esp.tipo) }}</h3>
                  <p class="room-card__desc">{{ esp.descripcion }}</p>
                  <div class="room-card__meta">
                    <span><rs-icon name="paw" size="14" /> Hasta tamaño {{ tamanoLabel(esp.tamanoMaxPerro) }}</span>
                    <span><rs-icon name="bone" size="14" /> {{ esp.cantidad }} {{ esp.cantidad === 1 ? 'espacio' : 'espacios' }}</span>
                  </div>
                  <div class="room-card__amenities">
                    @for (a of esp.amenities.slice(0,4); track a) {
                      <span class="rs-amenity">{{ a }}</span>
                    }
                  </div>
                  @if (esp.cancelacionGratis) {
                    <p class="room-card__free-cancel">✓ Cancelación gratis</p>
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
                      {{ espacioSelec()?.id === esp.id ? '✓ Seleccionado' : 'Seleccionar' }}
                    </button>
                  } @else {
                    <button class="rs-btn rs-btn--ghost rs-btn--block" disabled
                            style="margin-top:var(--sp-4)">No disponible</button>
                  }
                </div>
              </div>
            }
          </div>
        </div>

        <!-- Políticas -->
        <div class="section-block" rsAnim>
          <h2>Políticas del alojamiento</h2>
          <div class="policies-grid">
            <div class="policy-item">
              <div class="policy-item__label">Check-in</div>
              <div class="policy-item__val">{{ alojamiento()!.checkIn }}</div>
            </div>
            <div class="policy-item">
              <div class="policy-item__label">Check-out</div>
              <div class="policy-item__val">{{ alojamiento()!.checkOut }}</div>
            </div>
            <div class="policy-item">
              <div class="policy-item__label">Cancelación</div>
              <div class="policy-item__val">{{ alojamiento()!.politicaCancelacion }}</div>
            </div>
            <div class="policy-item">
              <div class="policy-item__label">Vacunas</div>
              <div class="policy-item__val">
                {{ alojamiento()!.requisitoVacunas ? 'Cartilla de vacunación obligatoria' : 'Sin requisito de vacunas' }}
              </div>
            </div>
          </div>
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
      <div class="booking-panel">
        <div class="booking-panel__card">
          @if (espacioSelec()) {
            <div class="booking-panel__selected">
              <span class="rs-badge rs-badge--success">✓ Espacio seleccionado</span>
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

          <div class="booking-panel__trust">
            <p>🔒 Datos seguros con Stripe</p>
            <p>✅ Confirmación instantánea</p>
            @if (alojamiento()!.paseosIncluidos) { <p>🦴 Paseos diarios incluidos</p> }
            @if (alojamiento()!.camaras24h) { <p>📹 Sigue a tu perro por cámara 24h</p> }
          </div>

          <hr class="rs-hr" style="margin-block:var(--sp-5)">

          <div class="booking-panel__score">
            <div class="rs-rating">
              <div class="rs-rating__score">{{ alojamiento()!.score }}</div>
              <div>
                <div class="rs-rating__label">{{ alojamiento()!.scoreLabel }}</div>
                <div class="rs-rating__count">{{ alojamiento()!.numResenas | number }} reseñas</div>
              </div>
            </div>
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
      border-radius: var(--r-xl);
      overflow: hidden;
      img { width: 100%; height: 100%; object-fit: cover; }
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
    .rating-bar { display: grid; grid-template-columns: 100px 1fr 30px; align-items: center; gap: var(--sp-3); font-size: var(--f-sm); color: var(--t-300); }
    .rating-bar__track { height: 6px; background: var(--c-surface); border-radius: var(--r-full); overflow: hidden; }
    .rating-bar__fill  { height: 100%; background: var(--g-accent); border-radius: var(--r-full); transition: width .8s ease; }

    .section-block { margin-block: var(--sp-10); h2 { font-size: var(--f-2xl); font-weight: var(--w-7); color: var(--dk-blue); margin-bottom: var(--sp-6); } p { color: var(--t-300); line-height: 1.8; } }

    .amenities-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: var(--sp-3); @media (max-width: 640px) { grid-template-columns: 1fr 1fr; } }
    .amenity-item { display: flex; align-items: center; gap: var(--sp-2); font-size: var(--f-sm); color: var(--t-200); padding: var(--sp-3); background: var(--c-raised); border-radius: var(--r-lg); border: 1px solid var(--b-1); rs-icon { color: var(--dk-gold); flex-shrink: 0; } }

    /* ESPACIO CARD */
    .rooms-list { display: flex; flex-direction: column; gap: var(--sp-4); }
    .room-card { display: grid; grid-template-columns: 240px 1fr auto; padding: 0; overflow: hidden; @media (max-width: 768px) { grid-template-columns: 1fr; } }
    .room-card__img { img { width: 100%; height: 100%; object-fit: cover; } }
    .room-card__body { padding: var(--sp-6); }
    .room-card__type { font-size: var(--f-md); font-weight: var(--w-7); color: var(--dk-blue); margin-bottom: var(--sp-2); }
    .room-card__desc { font-size: var(--f-sm); color: var(--t-400); margin-bottom: var(--sp-4); }
    .room-card__meta { display: flex; gap: var(--sp-4); font-size: var(--f-xs); color: var(--t-300); margin-bottom: var(--sp-4); flex-wrap: wrap; span { display: inline-flex; align-items: center; gap: var(--sp-1); } rs-icon { color: var(--dk-gold); } }
    .room-card__amenities { display: flex; flex-wrap: wrap; gap: var(--sp-2); }
    .room-card__free-cancel { font-size: var(--f-xs); color: var(--c-success); margin-top: var(--sp-3); }
    .room-card__price { padding: var(--sp-6); border-left: 1px solid var(--b-1); display: flex; flex-direction: column; align-items: flex-end; min-width: 180px; @media (max-width: 768px) { border-left: none; border-top: 1px solid var(--b-1); align-items: flex-start; } }
    .room-price-amount { font-size: var(--f-3xl); font-weight: var(--w-8); color: var(--dk-blue); letter-spacing: -.03em; }

    /* POLICIES */
    .policies-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: var(--sp-4); margin-bottom: var(--sp-6); @media (max-width: 640px) { grid-template-columns: 1fr; } }
    .policy-item { padding: var(--sp-4); background: var(--c-card); border: 1px solid var(--b-1); border-radius: var(--r-lg); }
    .policy-item__label { font-size: var(--f-xs); color: var(--t-400); margin-bottom: var(--sp-2); text-transform: uppercase; letter-spacing: .06em; font-weight: var(--w-6); }
    .policy-item__val   { font-size: var(--f-sm); color: var(--t-100); font-weight: var(--w-5); }
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
    .resena-respuesta { margin-top: var(--sp-4); padding: var(--sp-4); background: var(--c-raised); border-left: 2px solid var(--c-accent); border-radius: 0 var(--r-md) var(--r-md) 0; font-size: var(--f-sm); color: var(--t-300); strong { color: var(--t-200); display: block; margin-bottom: var(--sp-2); } }

    /* BOOKING PANEL — acento dorado superior */
    .booking-panel { position: sticky; top: 84px; }
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

  readonly cargando = signal(true);
  readonly alojamiento = signal<AlojamientoDetalle | null>(null);
  readonly imagenActiva = signal('');
  readonly espacioSelec = signal<Espacio | null>(null);

  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('id') ?? '';
    this.cargar(id);
  }

  async cargar(id: string): Promise<void> {
    try {
      const data = await this.alojamientoService.obtener(id);
      this.alojamiento.set(data);
      this.imagenActiva.set(data.imagenes[0]);
    } catch {
      // Sin mock: si no se puede cargar el servicio, se muestra "no encontrado"
      // en vez de un detalle falso que llevaría a una reserva imposible.
      this.alojamiento.set(null);
    } finally {
      this.cargando.set(false);
    }
  }

  /** Estrellas doradas a partir del score (escala 0–5). */
  estrellas(score: number): string {
    const llenas = Math.round(Math.min(score, 5));
    return '★'.repeat(llenas) + '☆'.repeat(5 - llenas);
  }

  tipoLabel(tipo: TipoEspacio): string {
    const map: Record<TipoEspacio, string> = {
      suite: 'Suite individual',
      estandar: 'Espacio estándar',
      compartido: 'Espacio compartido',
    };
    return map[tipo] ?? tipo;
  }

  tamanoLabel(tamano: TamanoPerro): string {
    const map: Record<TamanoPerro, string> = {
      pequeno: 'pequeño',
      mediano: 'mediano',
      grande: 'grande',
      gigante: 'gigante',
    };
    return map[tamano] ?? tamano;
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
      },
    });
  }

  ratingItems() {
    const d = this.alojamiento()?.scoreDesglose;
    if (!d) return [];
    return [
      { label: 'Limpieza', val: d.limpieza, pct: d.limpieza * 20 },
      { label: 'Ubicación', val: d.ubicacion, pct: d.ubicacion * 20 },
      { label: 'Cuidado', val: d.cuidado, pct: d.cuidado * 20 },
      { label: 'Valor/Precio', val: d.valorPrecio, pct: d.valorPrecio * 20 },
      { label: 'Instalaciones', val: d.instalaciones, pct: d.instalaciones * 20 },
      { label: 'Personal', val: d.personal, pct: d.personal * 20 },
    ];
  }

}
