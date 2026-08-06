import { Component, OnInit, inject, signal, computed } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { DatePipe } from '@angular/common';
import { VerticalKey } from 'shared';
import { RsNavbarComponent } from '../../shared/components/navbar/rs-navbar.component';
import { RsIconComponent } from '../../shared/components/icon/rs-icon.component';
import { RsRatingComponent } from '../../shared/components/rating/rs-rating.component';
import { RsTrustBlockComponent } from '../../shared/components/trust-block/rs-trust-block.component';
import { RsChipComponent } from '../../shared/components/chip/rs-chip.component';
import { RsFavoritoBtnComponent } from '../../shared/components/favorito-btn/rs-favorito-btn.component';
import { ImgFallbackDirective } from '../../shared/directives/img-fallback.directive';
import { verticalUi, VerticalUi } from '../../shared/verticales/verticales.config';
import { CatalogBrowseService, ServicioDetalle } from './catalog-browse.service';

interface DetalleConfig {
  vertical: string;
  cta: string;
  priceLabel: string;
  tituloBloque: string;
  /** Chips destacados (p. ej. especialidades del adiestrador); vacío = no se muestra la sección. */
  chips: (s: ServicioDetalle) => string[];
  /** Puntos reales del servicio (nunca inventados) para el bloque "¿Qué ofrece?". */
  puntos: (s: ServicioDetalle) => string[];
  price: (s: ServicioDetalle) => number;
}

const CONFIGS: Record<string, DetalleConfig> = {
  transporte: {
    vertical: 'transporte',
    cta: 'Reservar transporte',
    priceLabel: '+ tarifa por km',
    tituloBloque: '¿Qué ofrece este transportista?',
    chips: () => [],
    puntos: (s) => {
      const items: string[] = [];
      const tipo = s.extra['tipoVehiculo'] as string | undefined;
      if (tipo) items.push(`${({ van_acondicionada: 'Van acondicionada', coche: 'Coche', furgon_climatizado: 'Furgón climatizado' } as Record<string, string>)[tipo] ?? tipo}`);
      if (s.extra['jaulasIncluidas']) items.push('Jaulas homologadas incluidas');
      if (s.extra['acompananteHumano']) items.push('Puedes acompañar a tu perro en el trayecto');
      if (s.extra['soloPerros']) items.push('Trayecto exclusivo para perros, sin compartir con otros animales');
      if (s.extra['aceptaPPP']) items.push('Acepta perros potencialmente peligrosos (PPP)');
      if (s.extra['requisitoVacunas']) items.push('Requiere cartilla de vacunación al día');
      const zona = s.extra['zonaCobertura'] as string[] | undefined;
      if (zona?.length) items.push(`Cubre ${zona.slice(0, 4).join(', ')}`);
      return items;
    },
    price: (s) => (s.extra['tarifaBase'] as number) ?? s.precioPorNoche,
  },
  adiestramiento: {
    vertical: 'adiestramiento',
    cta: 'Reservar sesión',
    priceLabel: 'por sesión',
    tituloBloque: '¿Qué incluye esta sesión?',
    chips: (s) => (s.extra['tiposAdiestramiento'] as string[] | undefined) ?? [],
    puntos: (s) => {
      const items: string[] = [];
      const modalidad = s.extra['modalidad'] as string | undefined;
      items.push(modalidad === 'programa' ? 'Programa completo de varias sesiones' : 'Sesión individual');
      const edadMin = s.extra['edadMinimaMeses'] as number | undefined;
      if (edadMin != null) items.push(`Admite cachorros desde ${edadMin} meses`);
      if (s.extra['aDomicilio']) items.push('Disponible a domicilio');
      const capacidad = s.extra['capacidadPorSesion'] as number | undefined;
      if (capacidad != null) items.push(`Hasta ${capacidad} ${capacidad === 1 ? 'perro' : 'perros'} por sesión`);
      return items;
    },
    price: (s) => (s.extra['precioSesion'] as number) ?? s.precioPorNoche,
  },
  hoteles: {
    vertical: 'hoteles',
    cta: 'Ver disponibilidad',
    priceLabel: '/ noche',
    tituloBloque: 'Ventajas de este hotel',
    chips: (s) => (s.extra['serviciosPetfriendly'] as string[] | undefined) ?? [],
    puntos: (s) => {
      const items: string[] = [];
      if (s.extra['admiteMascotas'] ?? true) items.push('Admite mascotas en la habitación');
      const pesoMax = s.extra['pesoMaximoMascotaKg'] as number | undefined;
      if (pesoMax != null) items.push(`Hasta ${pesoMax} kg por mascota`);
      const maxMascotas = s.extra['maxMascotasPorReserva'] as number | undefined;
      if (maxMascotas != null) items.push(`Hasta ${maxMascotas} mascota(s) por reserva`);
      if (s.cancelacionGratis) items.push('Cancelación gratuita');
      return items;
    },
    price: (s) => s.precioPorNoche,
  },
};

@Component({
  selector: 'app-vertical-detalle',
  standalone: true,
  imports: [
    RouterLink, DatePipe, RsNavbarComponent, RsIconComponent, RsRatingComponent,
    RsTrustBlockComponent, RsChipComponent, RsFavoritoBtnComponent, ImgFallbackDirective,
  ],
  template: `
<div class="vd-page">
  <rs-navbar />

  @if (cargando()) {
    <div style="display:flex;align-items:center;justify-content:center;min-height:60vh">
      <div class="rs-spin" style="width:40px;height:40px;border-width:3px"></div>
    </div>
  }

  @if (!cargando() && !servicio()) {
    <div style="display:flex;flex-direction:column;align-items:center;justify-content:center;min-height:60vh;gap:var(--sp-4);text-align:center">
      <rs-icon name="paw" [size]="48" [stroke]="1.5" style="color:var(--t-400)" />
      <h3>No se pudo cargar esta ficha</h3>
      <p style="color:var(--t-300)">Puede que ya no esté disponible.</p>
      <a [routerLink]="ui.route" class="rs-btn rs-btn--secondary">Volver al listado</a>
    </div>
  }

  @if (!cargando() && servicio(); as s) {
  <div class="vd-wrap rs-wrap">

    <nav class="breadcrumb">
      <a routerLink="/">Inicio</a> /
      <a [routerLink]="ui.route">{{ ui.label }}</a> /
      <span>{{ s.nombre }}</span>
    </nav>

    <!-- GALERÍA -->
    <div class="gallery">
      <div class="gallery__main" (click)="abrirLightbox(imagenActiva())">
        <img [src]="imagenActiva()" [alt]="s.nombre" rsImg />
        @if (s.imagenes.length) {
          <span class="gallery__contador"><rs-icon name="camera" [size]="14" [stroke]="2" /> {{ s.imagenes.length }} fotografías</span>
        }
      </div>
      <div class="gallery__thumbs">
        @for (img of s.imagenes.slice(0,4); track img) {
          <div class="gallery__thumb" [class.active]="imagenActiva() === img" (click)="imagenActiva.set(img)">
            <img [src]="img" [alt]="s.nombre" rsImg />
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
        <img [src]="lightboxImagen()" [alt]="s.nombre" (click)="$event.stopPropagation()" />
        <button type="button" class="lightbox__nav lightbox__nav--next" (click)="siguienteFoto(); $event.stopPropagation()" aria-label="Foto siguiente">
          <rs-icon name="arrow-right" [size]="22" [stroke]="2"></rs-icon>
        </button>
        <span class="lightbox__contador"><rs-icon name="camera" [size]="14" [stroke]="2" /> {{ lightboxIndice() + 1 }} / {{ s.imagenes.length }}</span>
      </div>
    }

    <div class="vd-body">
      <div class="info-col">
        <div class="info-header">
          <h1 class="info-header__name">{{ s.nombre }}</h1>
          <div class="info-header__meta">
            <rs-rating [score]="s.score" [label]="s.scoreLabel" [count]="s.numResenas" size="sm"></rs-rating>
            <span><rs-icon name="map-pin" [size]="15" [stroke]="2" /> {{ s.direccion ? s.direccion + ', ' : '' }}{{ s.ciudad }}</span>
            <span class="rs-badge rs-badge--success"><rs-icon name="badge-check" [size]="13" [stroke]="2" /> Profesional verificado</span>
          </div>
        </div>

        <div class="compromiso-block">
          <h3 class="compromiso-block__title"><rs-icon name="shield-check" size="18" /> Garantía Doogking</h3>
          <rs-trust-block></rs-trust-block>
        </div>

        @if (cfg().chips(s).length) {
          <div class="section-block">
            <h2>Especialidades</h2>
            <div class="chips-row">
              @for (c of cfg().chips(s); track c) { <rs-chip [active]="true">{{ c }}</rs-chip> }
            </div>
          </div>
        }

        @if (s.descripcion) {
          <div class="section-block">
            <h2>Sobre este servicio</h2>
            <p>{{ s.descripcion }}</p>
          </div>
        }

        <div class="section-block">
          <h2>{{ cfg().tituloBloque }}</h2>
          <ul class="puntos-list">
            @for (p of cfg().puntos(s); track p) {
              <li><rs-icon name="check" [size]="15" [stroke]="2.5" /> {{ p }}</li>
            }
            @empty { <p style="color:var(--t-400);font-size:var(--f-sm)">Sin datos adicionales de este profesional.</p> }
          </ul>
        </div>

        <div class="section-block">
          <h2>Reseñas ({{ s.resenas.length }})</h2>
          @for (r of s.resenas; track r.id) {
            <div class="resena-card">
              <div class="resena-card__head">
                <strong>{{ r.autorNombre }}</strong>
                <span class="resena-card__score">{{ r.puntuacion }}/5</span>
                <span class="resena-card__fecha">{{ r.fecha | date:'d MMM yyyy' }}</span>
              </div>
              <p>{{ r.comentario }}</p>
              @if (r.respuesta) {
                <p class="resena-card__respuesta">↳ {{ r.respuesta }}</p>
              }
            </div>
          } @empty {
            <p style="color:var(--t-400);font-size:var(--f-sm)">Aún no hay reseñas de este profesional.</p>
          }
        </div>
      </div>

      <!-- PANEL LATERAL -->
      <div class="side-col rs-sticky-panel">
        <div class="side-panel rs-card">
          <div class="side-panel__price">
            <div class="bp-desde">Desde</div>
            <div class="bp-amount">€{{ cfg().price(s) }}</div>
            <div class="bp-per">{{ cfg().priceLabel }}</div>
          </div>

          <button class="rs-btn rs-btn--gold rs-btn--block rs-btn--lg" (click)="solicitar(s)">
            {{ cfg().cta }}
          </button>

          <div class="side-panel__fav">
            <rs-favorito-btn [servicioId]="s.id" [tamano]="18"></rs-favorito-btn>
            <span>Guardar en favoritos</span>
          </div>

          <hr class="rs-hr" style="margin-block:var(--sp-5)">

          <rs-trust-block></rs-trust-block>
        </div>
      </div>
    </div>
  </div>
  }
</div>
  `,
  styles: [`
    :host { display: block; }
    .vd-page { min-height: 100vh; background: var(--c-base); }
    .vd-wrap { padding-block: var(--sp-6) var(--sp-16); }

    .breadcrumb { font-size: var(--f-xs); color: var(--t-400); margin-bottom: var(--sp-5); a { color: var(--t-400); } }

    .gallery { border-radius: var(--r-xl); overflow: hidden; margin-bottom: var(--sp-8); }
    .gallery__main {
      position: relative; aspect-ratio: 21/9; cursor: pointer;
      img { width: 100%; height: 100%; object-fit: cover; }
    }
    .gallery__contador {
      position: absolute; right: var(--sp-3); bottom: var(--sp-3);
      background: rgba(0,0,0,.6); color: #fff; font-size: var(--f-xs); font-weight: var(--w-6);
      padding: var(--sp-1) var(--sp-3); border-radius: var(--r-full);
    }

    /* LIGHTBOX (HU-4.1.1) */
    .lightbox {
      position: fixed; inset: 0; z-index: var(--z-4, 100);
      background: rgba(0,0,0,.92);
      display: flex; align-items: center; justify-content: center;
      animation: fadeIn 160ms ease both;
      img { max-width: min(92vw, 1100px); max-height: 86vh; object-fit: contain; border-radius: var(--r-lg); cursor: default; }
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
    .gallery__thumbs { display: grid; grid-template-columns: repeat(4, 1fr); gap: var(--sp-2); margin-top: var(--sp-2); }
    .gallery__thumb {
      aspect-ratio: 16/10; border-radius: var(--r-md); overflow: hidden; cursor: pointer; opacity: .65; transition: opacity var(--d-2);
      img { width: 100%; height: 100%; object-fit: cover; }
      &.active, &:hover { opacity: 1; }
    }

    .vd-body { display: grid; grid-template-columns: 1fr 380px; gap: var(--sp-10); align-items: start; @media (max-width: 960px) { grid-template-columns: 1fr; } }

    .info-header__name { font-size: var(--f-3xl); color: var(--dk-blue); margin-bottom: var(--sp-3); }
    .info-header__meta { display: flex; flex-wrap: wrap; align-items: center; gap: var(--sp-4); font-size: var(--f-sm); color: var(--t-300); margin-bottom: var(--sp-5); }

    .compromiso-block { padding: var(--sp-5); background: var(--c-accent-lo); border: 1px solid var(--b-a); border-radius: var(--r-lg); margin-bottom: var(--sp-6); }
    .compromiso-block__title { display: flex; align-items: center; gap: var(--sp-2); font-size: var(--f-md); font-weight: var(--w-7); color: var(--dk-blue); margin-bottom: var(--sp-3); }

    .chips-row { display: flex; flex-wrap: wrap; gap: var(--sp-2); }

    .section-block { padding-block: var(--sp-6); border-top: 1px solid var(--b-1); h2 { font-size: var(--f-lg); color: var(--dk-blue); margin-bottom: var(--sp-4); } }

    .puntos-list {
      display: flex; flex-direction: column; gap: var(--sp-3);
      li {
        list-style: none; font-size: var(--f-sm); color: var(--t-200);
        display: flex; align-items: flex-start; gap: var(--sp-2);
        rs-icon { flex: 0 0 auto; margin-top: 2px; color: var(--c-accent); }
      }
    }

    .resena-card { padding-block: var(--sp-4); border-top: 1px solid var(--b-1); }
    .resena-card__head { display: flex; align-items: center; gap: var(--sp-3); margin-bottom: var(--sp-2); }
    .resena-card__score { background: var(--dk-blue); color: #fff; font-size: var(--f-xs); font-weight: var(--w-7); padding: 2px var(--sp-2); border-radius: var(--r-xs); }
    .resena-card__fecha { font-size: var(--f-xs); color: var(--t-400); margin-left: auto; }
    .resena-card__respuesta { margin-top: var(--sp-2); font-size: var(--f-sm); color: var(--t-400); font-style: italic; }

    .side-panel { padding: var(--sp-6); }
    .side-panel__price { text-align: center; margin-bottom: var(--sp-5); }
    .bp-desde { font-size: var(--f-xs); color: var(--t-400); text-transform: uppercase; letter-spacing: .06em; }
    .bp-amount { font-size: var(--f-5xl); font-weight: var(--w-9); letter-spacing: -.04em; color: var(--dk-blue); }
    .bp-per { font-size: var(--f-sm); color: var(--t-400); }

    .side-panel__fav { display: flex; align-items: center; justify-content: center; gap: var(--sp-2); margin-top: var(--sp-4); font-size: var(--f-sm); color: var(--t-300); }
  `],
})
export class VerticalDetalleComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly browseService = inject(CatalogBrowseService);

  readonly cargando = signal(true);
  readonly servicio = signal<ServicioDetalle | null>(null);
  readonly imagenActiva = signal('');

  /** Galería a pantalla completa (HU-4.1.1). */
  readonly lightboxAbierto = signal(false);
  readonly lightboxImagen = signal('');
  readonly lightboxIndice = computed(() => {
    const imagenes = this.servicio()?.imagenes ?? [];
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
    const imagenes = this.servicio()?.imagenes ?? [];
    if (!imagenes.length) return;
    const siguiente = (this.lightboxIndice() + 1) % imagenes.length;
    this.lightboxImagen.set(imagenes[siguiente]);
  }

  fotoAnterior(): void {
    const imagenes = this.servicio()?.imagenes ?? [];
    if (!imagenes.length) return;
    const anterior = (this.lightboxIndice() - 1 + imagenes.length) % imagenes.length;
    this.lightboxImagen.set(imagenes[anterior]);
  }

  cfg = signal<DetalleConfig>(CONFIGS['transporte']);
  ui: VerticalUi = verticalUi(VerticalKey.TRANSPORTE);

  private busqueda: { desde?: string; perros?: string } = {};

  ngOnInit(): void {
    const vertical = (this.route.snapshot.data['vertical'] as string) ?? 'transporte';
    const id = this.route.snapshot.paramMap.get('id') ?? '';
    const qp = this.route.snapshot.queryParamMap;
    this.cfg.set(CONFIGS[vertical] ?? CONFIGS['transporte']);
    this.ui = verticalUi(vertical);
    this.busqueda = { desde: qp.get('desde') ?? undefined, perros: qp.get('perros') ?? undefined };
    this.cargar(id);
  }

  private async cargar(id: string): Promise<void> {
    try {
      const data = await this.browseService.obtener(id);
      this.servicio.set(data);
      this.imagenActiva.set(data.imagenes[0] ?? '');
    } catch {
      // Sin mock: si no se puede cargar el servicio, se muestra "no encontrado".
      this.servicio.set(null);
    } finally {
      this.cargando.set(false);
    }
  }

  solicitar(s: ServicioDetalle): void {
    void this.router.navigate(['/reservas', this.cfg().vertical, s.id], {
      queryParams: {
        comercioId: s.comercioId ?? '',
        nombre: s.nombre,
        precioBase: this.cfg().price(s),
        imagen: s.imagenes?.[0] ?? '',
        desde: this.busqueda.desde ?? null,
        perros: this.busqueda.perros ?? null,
      },
    });
  }
}
