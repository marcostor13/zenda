import { Component, signal, OnInit, inject } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { DecimalPipe } from '@angular/common';
import { RsNavbarComponent } from '../../../shared/components/navbar/rs-navbar.component';
import { AnimateOnScrollDirective } from '../../../shared/directives/animate-on-scroll.directive';
import { ImgFallbackDirective } from '../../../shared/directives/img-fallback.directive';
import { hotelImage } from '../../../shared/media/images';
import { HotelesService, HotelDetalle, Habitacion } from '../services/hoteles.service';

@Component({
  selector: 'app-hotel-detalle',
  standalone: true,
  imports: [RouterLink, DecimalPipe, RsNavbarComponent, AnimateOnScrollDirective, ImgFallbackDirective],
  template: `
<div class="detalle-page">
  <rs-navbar />

  @if (cargando()) {
    <div style="display:flex;align-items:center;justify-content:center;min-height:60vh">
      <div class="rs-spin" style="width:40px;height:40px;border-width:3px"></div>
    </div>
  }

  @if (!cargando() && hotel()) {
  <div class="detalle-wrap">

    <!-- BREADCRUMB -->
    <nav class="breadcrumb rs-wrap">
      <a routerLink="/">Inicio</a> /
      <a routerLink="/buscar" [queryParams]="{vertical:'hoteles'}">Hoteles</a> /
      <a [routerLink]="['/buscar']" [queryParams]="{ciudad: hotel()!.ciudad}">{{ hotel()!.ciudad }}</a> /
      <span>{{ hotel()!.nombre }}</span>
    </nav>

    <!-- GALERÍA -->
    <div class="gallery rs-wrap">
      <div class="gallery__main">
        <img [src]="imagenActiva()" [alt]="hotel()!.nombre" rsImg />
      </div>
      <div class="gallery__thumbs">
        @for (img of hotel()!.imagenes.slice(0,4); track img) {
          <div class="gallery__thumb" [class.active]="imagenActiva() === img"
               (click)="imagenActiva.set(img)">
            <img [src]="img" [alt]="hotel()!.nombre" rsImg />
          </div>
        }
        @if (hotel()!.imagenes.length > 4) {
          <div class="gallery__thumb gallery__thumb--more">
            +{{ hotel()!.imagenes.length - 4 }} fotos
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
          <div class="info-header__stars">{{ estrellas(hotel()!.estrellas) }}</div>
          <h1 class="info-header__name">{{ hotel()!.nombre }}</h1>
          <p class="info-header__loc">📍 {{ hotel()!.direccion }}, {{ hotel()!.barrio }}, {{ hotel()!.ciudad }}</p>

          <div class="info-header__tags">
            @if (hotel()!.cancelacionGratis) {
              <span class="rs-badge rs-badge--success">✓ Cancelación gratis</span>
            }
            @if (hotel()!.desayunoIncluido) {
              <span class="rs-badge rs-badge--teal">✓ Desayuno incluido</span>
            }
            @if (hotel()!.destacado) {
              <span class="rs-badge rs-badge--warning">⭐ Elección de viajeros</span>
            }
          </div>
        </div>

        <!-- Rating summary -->
        <div class="rating-summary rs-card" rsAnim>
          <div class="rating-summary__score">
            <div class="rating-big">{{ hotel()!.score }}</div>
            <div>
              <div class="rating-big-label">{{ hotel()!.scoreLabel }}</div>
              <div style="font-size:var(--f-xs);color:var(--t-400)">{{ hotel()!.numResenas | number }} reseñas verificadas</div>
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
          <h2>Sobre el alojamiento</h2>
          <p>{{ hotel()!.descripcion }}</p>
        </div>

        <!-- Amenidades -->
        <div class="section-block" rsAnim>
          <h2>Servicios más populares</h2>
          <div class="amenities-grid">
            @for (a of hotel()!.amenities; track a) {
              <div class="amenity-item">{{ a }}</div>
            }
          </div>
        </div>

        <!-- Habitaciones -->
        <div class="section-block" rsAnim>
          <h2>Tipos de habitación</h2>
          <div class="rooms-list">
            @for (hab of hotel()!.habitaciones; track hab.id) {
              <div class="room-card rs-card" [class.rs-card--glow]="habitacionSelec()?.id === hab.id">
                <div class="room-card__img">
                  @if (hab.imagenes[0]) {
                    <img [src]="hab.imagenes[0]" [alt]="hab.tipo" rsImg />
                  }
                </div>
                <div class="room-card__body">
                  <h3 class="room-card__type">{{ hab.tipo }}</h3>
                  <p class="room-card__desc">{{ hab.descripcion }}</p>
                  <div class="room-card__meta">
                    <span>👥 {{ hab.capacidad }} personas</span>
                    <span>🛏 {{ hab.camas }}</span>
                    <span>📐 {{ hab.tamano }} m²</span>
                  </div>
                  <div class="room-card__amenities">
                    @for (a of hab.amenities.slice(0,4); track a) {
                      <span class="rs-amenity">{{ a }}</span>
                    }
                  </div>
                  @if (hab.cancelacionGratis) {
                    <p style="font-size:var(--f-xs);color:#34D399;margin-top:var(--sp-3)">✓ Cancelación gratis</p>
                  }
                </div>
                <div class="room-card__price">
                  @if (hab.precioAnterior) {
                    <div class="rs-price__old">€{{ hab.precioAnterior }}</div>
                  }
                  <div class="room-price-amount">€{{ hab.precio }}</div>
                  <div style="font-size:var(--f-xs);color:var(--t-400)">por noche</div>
                  @if (hab.disponible) {
                    <button class="rs-btn rs-btn--primary rs-btn--block"
                            style="margin-top:var(--sp-4)"
                            [class.rs-btn--outline]="habitacionSelec()?.id === hab.id"
                            (click)="seleccionarHabitacion(hab)">
                      {{ habitacionSelec()?.id === hab.id ? '✓ Seleccionada' : 'Seleccionar' }}
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
              <div class="policy-item__val">{{ hotel()!.checkIn }}</div>
            </div>
            <div class="policy-item">
              <div class="policy-item__label">Check-out</div>
              <div class="policy-item__val">{{ hotel()!.checkOut }}</div>
            </div>
            <div class="policy-item">
              <div class="policy-item__label">Cancelación</div>
              <div class="policy-item__val">{{ hotel()!.politicaCancelacion }}</div>
            </div>
          </div>
          <div class="rules-list">
            @for (r of hotel()!.reglas; track r) {
              <div class="rule-item">• {{ r }}</div>
            }
          </div>
        </div>

        <!-- Reseñas -->
        <div class="section-block" rsAnim>
          <h2>Reseñas de huéspedes <span style="color:var(--t-400);font-weight:400">({{ hotel()!.resenas.length }})</span></h2>
          <div class="resenas-list">
            @for (r of hotel()!.resenas; track r.id) {
              <div class="resena-card rs-card" rsAnim>
                <div class="resena-card__header">
                  <div class="resena-card__avatar">{{ r.autorAvatar }}</div>
                  <div>
                    <div class="resena-card__autor">{{ r.autorNombre }}</div>
                    <div class="resena-card__meta">{{ r.pais }} · {{ r.tipoViaje }} · {{ r.fecha }}</div>
                  </div>
                  <div class="resena-card__score rs-badge rs-badge--accent">{{ r.score }}</div>
                </div>
                <h4 class="resena-card__titulo">{{ r.titulo }}</h4>
                <p class="resena-card__texto">{{ r.texto }}</p>
                @if (r.respuestaComercio) {
                  <div class="resena-respuesta">
                    <strong>Respuesta del alojamiento:</strong>
                    <p>{{ r.respuestaComercio }}</p>
                  </div>
                }
              </div>
            }
          </div>
        </div>

      </div>

      <!-- BOOKING PANEL (sticky) -->
      <div class="booking-panel">
        <div class="booking-panel__card">
          @if (habitacionSelec()) {
            <div class="booking-panel__selected">
              <span class="rs-badge rs-badge--success">✓ Hab. seleccionada</span>
              <h4>{{ habitacionSelec()!.tipo }}</h4>
            </div>
          } @else {
            <div style="text-align:center;color:var(--t-400);font-size:var(--f-sm);margin-bottom:var(--sp-4)">
              Selecciona una habitación para reservar
            </div>
          }

          <div class="booking-panel__price">
            <div class="bp-desde">Desde</div>
            <div class="bp-amount">€{{ habitacionSelec()?.precio ?? hotel()!.precioPorNoche }}</div>
            <div class="bp-per">por noche</div>
          </div>

          <div style="font-size:var(--f-xs);color:var(--t-400);text-align:center;margin-bottom:var(--sp-5)">
            Impuestos e IVA incluidos
          </div>

          <button class="rs-btn rs-btn--primary rs-btn--block rs-btn--lg"
                  [disabled]="!habitacionSelec()"
                  (click)="irAReserva()">
            {{ habitacionSelec() ? 'Reservar ahora' : 'Selecciona una habitación' }}
          </button>

          <div class="booking-panel__trust">
            <p>🔒 Datos seguros con Stripe</p>
            <p>✅ Confirmación instantánea</p>
            <p>🔄 Cancelación flexible disponible</p>
          </div>

          <hr class="rs-hr" style="margin-block:var(--sp-5)">

          <div class="booking-panel__score">
            <div class="rs-rating">
              <div class="rs-rating__score">{{ hotel()!.score }}</div>
              <div>
                <div class="rs-rating__label">{{ hotel()!.scoreLabel }}</div>
                <div class="rs-rating__count">{{ hotel()!.numResenas | number }} reseñas</div>
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
    .info-header__stars { font-size: var(--f-md); color: var(--c-amber); margin-bottom: var(--sp-2); }
    .info-header__name  { font-size: var(--f-4xl); font-weight: var(--w-8); color: var(--t-100); letter-spacing: -.03em; margin-bottom: var(--sp-3); }
    .info-header__loc   { font-size: var(--f-sm); color: var(--t-400); margin-bottom: var(--sp-4); }
    .info-header__tags  { display: flex; flex-wrap: wrap; gap: var(--sp-2); }

    .rating-summary {
      display: grid;
      grid-template-columns: auto 1fr;
      gap: var(--sp-8);
      padding: var(--sp-6);
      margin-block: var(--sp-6);
    }

    .rating-summary__score { display: flex; align-items: center; gap: var(--sp-4); }
    .rating-big { font-size: var(--f-6xl); font-weight: var(--w-9); background: var(--g-accent); -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text; line-height: 1; }
    .rating-big-label { font-size: var(--f-lg); font-weight: var(--w-7); color: var(--t-100); }
    .rating-breakdown { display: flex; flex-direction: column; gap: var(--sp-3); }
    .rating-bar { display: grid; grid-template-columns: 100px 1fr 30px; align-items: center; gap: var(--sp-3); font-size: var(--f-sm); color: var(--t-300); }
    .rating-bar__track { height: 6px; background: var(--c-surface); border-radius: var(--r-full); overflow: hidden; }
    .rating-bar__fill  { height: 100%; background: var(--g-accent); border-radius: var(--r-full); transition: width .8s ease; }

    .section-block { margin-block: var(--sp-10); h2 { font-size: var(--f-2xl); font-weight: var(--w-7); color: var(--t-100); margin-bottom: var(--sp-6); } p { color: var(--t-300); line-height: 1.8; } }

    .amenities-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: var(--sp-3); @media (max-width: 640px) { grid-template-columns: 1fr 1fr; } }
    .amenity-item { display: flex; align-items: center; gap: var(--sp-2); font-size: var(--f-sm); color: var(--t-200); padding: var(--sp-3); background: var(--c-raised); border-radius: var(--r-lg); border: 1px solid var(--b-1); }

    /* ROOM CARD */
    .rooms-list { display: flex; flex-direction: column; gap: var(--sp-4); }
    .room-card { display: grid; grid-template-columns: 240px 1fr auto; padding: 0; overflow: hidden; @media (max-width: 768px) { grid-template-columns: 1fr; } }
    .room-card__img { img { width: 100%; height: 100%; object-fit: cover; } }
    .room-card__body { padding: var(--sp-6); }
    .room-card__type { font-size: var(--f-md); font-weight: var(--w-7); color: var(--t-100); margin-bottom: var(--sp-2); }
    .room-card__desc { font-size: var(--f-sm); color: var(--t-400); margin-bottom: var(--sp-4); }
    .room-card__meta { display: flex; gap: var(--sp-4); font-size: var(--f-xs); color: var(--t-300); margin-bottom: var(--sp-4); flex-wrap: wrap; }
    .room-card__amenities { display: flex; flex-wrap: wrap; gap: var(--sp-2); }
    .room-card__price { padding: var(--sp-6); border-left: 1px solid var(--b-1); display: flex; flex-direction: column; align-items: flex-end; min-width: 180px; @media (max-width: 768px) { border-left: none; border-top: 1px solid var(--b-1); align-items: flex-start; } }
    .room-price-amount { font-size: var(--f-3xl); font-weight: var(--w-8); color: var(--t-100); letter-spacing: -.03em; }

    /* POLICIES */
    .policies-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: var(--sp-4); margin-bottom: var(--sp-6); @media (max-width: 640px) { grid-template-columns: 1fr; } }
    .policy-item { padding: var(--sp-4); background: var(--c-card); border: 1px solid var(--b-1); border-radius: var(--r-lg); }
    .policy-item__label { font-size: var(--f-xs); color: var(--t-400); margin-bottom: var(--sp-2); text-transform: uppercase; letter-spacing: .06em; font-weight: var(--w-6); }
    .policy-item__val   { font-size: var(--f-sm); color: var(--t-100); font-weight: var(--w-5); }
    .rules-list { display: flex; flex-direction: column; gap: var(--sp-2); }
    .rule-item { font-size: var(--f-sm); color: var(--t-300); }

    /* REVIEWS */
    .resenas-list { display: flex; flex-direction: column; gap: var(--sp-4); }
    .resena-card { padding: var(--sp-6); }
    .resena-card__header { display: flex; align-items: center; gap: var(--sp-3); margin-bottom: var(--sp-4); }
    .resena-card__avatar { width: 44px; height: 44px; background: var(--g-accent); border-radius: var(--r-full); display: flex; align-items: center; justify-content: center; font-size: 1.25rem; flex-shrink: 0; }
    .resena-card__autor { font-size: var(--f-sm); font-weight: var(--w-6); color: var(--t-100); }
    .resena-card__meta  { font-size: var(--f-xs); color: var(--t-400); margin-top: 2px; }
    .resena-card__score { margin-left: auto; }
    .resena-card__titulo { font-size: var(--f-md); font-weight: var(--w-6); color: var(--t-100); margin-bottom: var(--sp-3); }
    .resena-card__texto  { font-size: var(--f-sm); color: var(--t-300); line-height: 1.7; }
    .resena-respuesta { margin-top: var(--sp-4); padding: var(--sp-4); background: var(--c-raised); border-left: 2px solid var(--c-accent); border-radius: 0 var(--r-md) var(--r-md) 0; font-size: var(--f-sm); color: var(--t-300); strong { color: var(--t-200); display: block; margin-bottom: var(--sp-2); } }

    /* BOOKING PANEL */
    .booking-panel { position: sticky; top: 84px; }
    .booking-panel__card { background: var(--c-card); border: 1px solid var(--b-2); border-radius: var(--r-2xl); padding: var(--sp-6); box-shadow: var(--sh-xl); }
    .booking-panel__selected { margin-bottom: var(--sp-5); h4 { font-size: var(--f-md); font-weight: var(--w-6); color: var(--t-100); margin-top: var(--sp-2); } }
    .booking-panel__price { text-align: center; margin-bottom: var(--sp-2); }
    .bp-desde  { font-size: var(--f-xs); color: var(--t-400); text-transform: uppercase; letter-spacing: .06em; }
    .bp-amount { font-size: var(--f-5xl); font-weight: var(--w-9); letter-spacing: -.04em; background: var(--g-accent); -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text; }
    .bp-per    { font-size: var(--f-sm); color: var(--t-400); }
    .booking-panel__trust { margin-top: var(--sp-4); display: flex; flex-direction: column; gap: var(--sp-2); p { font-size: var(--f-xs); color: var(--t-400); } }
    .booking-panel__score { display: flex; justify-content: center; }
  `],
})
export class HotelDetalleComponent implements OnInit {
  private readonly route  = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly hotelesService = inject(HotelesService);

  readonly cargando = signal(true);
  readonly hotel    = signal<HotelDetalle | null>(null);
  readonly imagenActiva    = signal('');
  readonly habitacionSelec = signal<Habitacion | null>(null);

  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('id') ?? '';
    this.cargar(id);
  }

  async cargar(id: string): Promise<void> {
    try {
      const data = await this.hotelesService.obtener(id);
      this.hotel.set(data);
      this.imagenActiva.set(data.imagenes[0]);
    } catch {
      this.hotel.set(this.mockDetalle(id));
      this.imagenActiva.set(this.mockDetalle(id).imagenes[0]);
    } finally {
      this.cargando.set(false);
    }
  }

  estrellas(n: number): string { return '★'.repeat(n) + '☆'.repeat(5 - n); }

  seleccionarHabitacion(hab: Habitacion): void {
    this.habitacionSelec.set(this.habitacionSelec()?.id === hab.id ? null : hab);
  }

  irAReserva(): void {
    if (!this.habitacionSelec()) return;
    const hotel = this.hotel()!;
    void this.router.navigate(['/reservar', hotel.id], {
      queryParams: {
        habitacionId: this.habitacionSelec()!.id,
        servicioId: hotel.id,
        comercioId: hotel.comercioId,
        vertical: 'hoteles',
      },
    });
  }

  ratingItems() {
    const d = this.hotel()?.scoreDesglose;
    if (!d) return [];
    return [
      { label: 'Limpieza', val: d.limpieza, pct: d.limpieza * 10 },
      { label: 'Ubicación', val: d.ubicacion, pct: d.ubicacion * 10 },
      { label: 'Servicios', val: d.servicios, pct: d.servicios * 10 },
      { label: 'Valor/Precio', val: d.valorPrecio, pct: d.valorPrecio * 10 },
      { label: 'Confort', val: d.confort, pct: d.confort * 10 },
      { label: 'Personal', val: d.personal, pct: d.personal * 10 },
    ];
  }

  private mockDetalle(id: string): HotelDetalle {
    return {
      id, nombre: 'Gran Hotel Madrid Salamanca', ciudad: 'Madrid', barrio: 'Salamanca',
      direccion: 'Calle de Serrano 463', estrellas: 5, score: 9.2, scoreLabel: 'Excepcional',
      numResenas: 2840, precioPorNoche: 320, precioAnterior: 420, descuentoPct: 24,
      imagenes: [
        hotelImage(0, 900),
        hotelImage(1, 600),
        hotelImage(6, 600),
        hotelImage(4, 600),
        hotelImage(5, 600),
      ],
      amenities: ['🌊 Piscina', '🅿️ Parking', '🍳 Desayuno', '💆 Spa', '🏋️ Gimnasio', '🍸 Bar', '🛎️ Concierge 24h', '♿ Accesible', '🐾 Mascotas', '🏊 Jacuzzi', '🌿 Jardín', '📶 WiFi gratis'],
      cancelacionGratis: true, desayunoIncluido: true, habitacionesDisponibles: 4, destacado: true,
      descripcion: 'Ubicado en el corazón de Salamanca, a pasos del paseo y los mejores restaurantes de Madrid, Gran Hotel Madrid ofrece una experiencia de lujo con el carácter único de la hotelería europea. Disfruta de vistas panorámicas al Mediterráneo, gastronomía de nivel mundial y un spa de clase internacional.',
      politicaCancelacion: 'Cancelación gratuita hasta 24 horas antes del check-in.',
      checkIn: 'A partir de las 3:00 PM', checkOut: 'Hasta las 12:00 PM (mediodía)',
      habitaciones: [
        { id: 'h1-r1', tipo: 'Habitación Superior', descripcion: 'Cómoda habitación con vista a la piscina y amenities de lujo.', capacidad: 2, camas: '1 cama matrimonial', tamano: 32, precio: 320, precioAnterior: 420, amenities: ['📶 WiFi', '❄️ A/C', '📺 Smart TV', '☕ Máquina de café'], imagenes: [hotelImage(1, 600)], disponible: true, cancelacionGratis: true },
        { id: 'h1-r2', tipo: 'Suite Junior Vista al Mar', descripcion: 'Suite con sala de estar y vistas panorámicas al mar Mediterráneo.', capacidad: 2, camas: '1 king bed', tamano: 52, precio: 580, amenities: ['📶 WiFi', '❄️ A/C', '📺 Smart TV', '♨️ Jacuzzi', '🛁 Bañera'], imagenes: [hotelImage(3, 600)], disponible: true, cancelacionGratis: true },
        { id: 'h1-r3', tipo: 'Suite Presidential', descripcion: 'Nuestra suite más exclusiva con comedor privado y terraza panorámica.', capacidad: 4, camas: '2 king beds', tamano: 120, precio: 1200, precioAnterior: 1500, amenities: ['📶 WiFi', '❄️ A/C', '📺 4K TV', '♨️ Jacuzzi privado', '🍷 Botella bienvenida', '🛁 Bañera doble'], imagenes: [hotelImage(8, 600)], disponible: false, cancelacionGratis: false },
      ],
      resenas: [
        { id: 'r1', autorNombre: 'María García', autorAvatar: '👩‍💼', fecha: 'Junio 2026', score: 9.8, titulo: 'Una experiencia increíble', texto: 'Todo fue perfecto desde el momento en que llegamos. El personal es exceptcionalmente amable, la habitación tenía unas vistas al mar impresionantes. El desayuno buffet es uno de los mejores que he probado en Madrid.', pais: 'España', tipoViaje: 'Pareja', desglose: { limpieza: 10, ubicacion: 10, servicios: 9.5, valorPrecio: 9, confort: 10, personal: 10 }, respuestaComercio: '¡Muchas gracias, María! Fue un placer tenerte con nosotros. Esperamos verte pronto.' },
        { id: 'r2', autorNombre: 'James Wilson', autorAvatar: '👨‍💻', fecha: 'Mayo 2026', score: 9.0, titulo: 'Excellent location and service', texto: 'Perfect for business travel. The location in Salamanca is ideal, walking distance to great restaurants. Fast WiFi and comfortable workspace in the room.', pais: 'Reino Unido', tipoViaje: 'Negocios', desglose: { limpieza: 9, ubicacion: 10, servicios: 9, valorPrecio: 8.5, confort: 9, personal: 9 } },
      ],
      scoreDesglose: { limpieza: 9.5, ubicacion: 9.8, servicios: 9.2, valorPrecio: 8.9, confort: 9.4, personal: 9.6 },
      reglas: ['No fumar en habitaciones', 'Check-in mínimo 18 años', 'Mascotas permitidas (cargo adicional)', 'Sin fiestas ni eventos'],
      idiomas: ['Español', 'English', 'Português'],
      comercioId: 'comercio-1',
    };
  }
}
