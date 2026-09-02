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
import { precioDesdeFunerario } from '../../shared/verticales/funerarios.util';
import { EventosService } from '../../core/eventos/eventos.service';
import { RsUbicacionComponent } from '../../shared/components/ubicacion/rs-ubicacion.component';
import { RsHorarioPublicoComponent } from '../../shared/components/horario/rs-horario-publico.component';
import { PuntoUbicacion } from '../../shared/mapas/google-maps';
import { CatalogBrowseService, ServicioDetalle } from './catalog-browse.service';

import { EurosPipe, euros } from '../../shared/pipes/euros.pipe';

/**
 * Huecos de la fila de miniaturas y fotos del costado del mosaico. Mismos
 * números que en la ficha de alojamiento: las fichas se ven iguales.
 */
const MINIATURAS_VISIBLES = 6;
const SECUNDARIAS_VISIBLES = 2;

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
  /*
   * Veterinaria, peluquería, funerarios y seguros no tenían ficha: sin entrada
   * aquí no había ruta `:id` ni enlace desde el listado, así que sus tarjetas
   * llevaban de vuelta al propio listado y no había forma de ver el detalle de
   * un comercio. Los campos son los que declara cada vertical en el formulario
   * del panel (ver `comercio-listado-form`).
   */
  veterinaria: {
    vertical: 'veterinaria',
    cta: 'Pedir cita',
    priceLabel: 'la consulta',
    tituloBloque: '¿Qué ofrece esta clínica?',
    chips: (s) => (s.extra['especialidades'] as string[] | undefined) ?? [],
    puntos: (s) => {
      const items: string[] = [];
      const servicios = s.extra['serviciosClinicos'] as Array<{ nombre?: string }> | undefined;
      if (servicios?.length) {
        items.push(`Servicios: ${servicios.map((v) => v.nombre).filter(Boolean).slice(0, 5).join(', ')}`);
      }
      if (s.extra['atiendeUrgencias']) items.push('Atiende urgencias');
      const duracion = s.extra['duracionCitaMin'] as number | undefined;
      if (duracion != null) items.push(`Citas de ${duracion} minutos`);
      if (s.extra['teleconsulta']) items.push('Ofrece teleconsulta');
      if (s.extra['aDomicilio']) items.push('Disponible a domicilio');
      return items;
    },
    price: (s) => (s.extra['precioConsulta'] as number) ?? s.precioPorNoche,
  },
  peluqueria: {
    vertical: 'peluqueria',
    cta: 'Reservar cita',
    priceLabel: 'desde',
    tituloBloque: '¿Qué servicios ofrece?',
    chips: (s) => {
      const servicios = s.extra['serviciosGrooming'] as Array<{ nombre?: string }> | undefined;
      return (servicios ?? []).map((v) => v.nombre).filter((n): n is string => Boolean(n));
    },
    puntos: (s) => {
      const items: string[] = [];
      const duracion = s.extra['duracionSlotMin'] as number | undefined;
      if (duracion != null) items.push(`Cada cita dura unos ${duracion} minutos`);
      if (s.extra['aDomicilio']) items.push('Disponible a domicilio');
      const capacidad = s.extra['capacidadSimultanea'] as number | undefined;
      if (capacidad != null) items.push(`Atiende hasta ${capacidad} ${capacidad === 1 ? 'perro' : 'perros'} a la vez`);
      if (s.extra['requiereVacunasAlDia']) items.push('Requiere cartilla de vacunación al día');
      return items;
    },
    price: (s) => s.precioPorNoche,
  },
  funerarios: {
    vertical: 'funerarios',
    cta: 'Contratar el servicio',
    priceLabel: 'desde',
    tituloBloque: '¿Qué ofrece esta empresa?',
    chips: (s) => {
      const servicios = (s.extra['serviciosFunerarios'] as Array<{ nombre?: string; activo?: boolean }> | undefined) ?? [];
      return servicios.filter((v) => v.activo !== false).map((v) => v.nombre ?? '').filter(Boolean);
    },
    puntos: (s) => {
      const items: string[] = [];
      const servicios = (s.extra['serviciosFunerarios'] as Array<{ devuelveCenizas?: boolean; urnaIncluida?: boolean; certificadoIncluido?: boolean; activo?: boolean }> | undefined) ?? [];
      const activos = servicios.filter((v) => v.activo !== false);

      if (s.extra['ofreceRecogida']) {
        items.push(`Recogida a domicilio, veterinario o residencia hasta ${(s.extra['radioRecogidaKm'] as number) ?? 0} km`);
      }
      if (s.extra['atiende24h']) items.push('Disponible 24 h, también de madrugada');
      else if (s.extra['servicioUrgente']) items.push('Atiende servicios urgentes');

      if (activos.some((v) => v.devuelveCenizas)) items.push('Devolución individual de las cenizas');
      if (activos.some((v) => v.urnaIncluida)) items.push('Urna incluida');
      if (activos.some((v) => v.certificadoIncluido)) items.push('Certificado incluido');

      const extras = (s.extra['extras'] as Array<{ nombre?: string; activo?: boolean }> | undefined) ?? [];
      const nombresExtra = extras.filter((e) => e.activo !== false).map((e) => e.nombre).filter(Boolean);
      if (nombresExtra.length) items.push(`Extras: ${nombresExtra.slice(0, 5).join(', ')}`);

      // Quién realiza la cremación es información que el cliente merece antes
      // de contratar, no un dato interno del alta (§10 del brief).
      if (s.extra['cremacionPropia'] === false && s.extra['terceroCrematorio']) {
        items.push(`La cremación la realiza ${s.extra['terceroCrematorio']}`);
      }
      return items;
    },
    price: (s) => precioDesdeFunerario(s) ?? s.precioPorNoche,
  },
  seguros: {
    vertical: 'seguros',
    cta: 'Ver la póliza',
    priceLabel: 'al año',
    tituloBloque: '¿Qué cubre esta póliza?',
    chips: (s) => (s.extra['coberturas'] as string[] | undefined) ?? [],
    puntos: (s) => {
      const items: string[] = [];
      const rc = s.extra['responsabilidadCivilEur'] as number | undefined;
      if (rc != null) items.push(`Responsabilidad civil hasta ${euros(rc)}`);
      const gastos = s.extra['gastosVeterinariosEur'] as number | undefined;
      if (gastos != null) items.push(`Gastos veterinarios hasta ${euros(gastos)}`);
      const carencia = s.extra['carenciaDias'] as number | undefined;
      if (carencia != null) items.push(`Periodo de carencia de ${carencia} días`);
      if (s.extra['cubrePPP']) items.push('Cubre perros potencialmente peligrosos (PPP)');
      return items;
    },
    price: (s) => (s.extra['primaAnual'] as number) ?? s.precioPorNoche,
  },
};

@Component({
  selector: 'app-vertical-detalle',
  standalone: true,
  imports: [
    RouterLink, DatePipe, RsNavbarComponent, RsIconComponent, RsRatingComponent,
    RsTrustBlockComponent, RsChipComponent, RsFavoritoBtnComponent, ImgFallbackDirective,
    RsUbicacionComponent, RsHorarioPublicoComponent, EurosPipe,],
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
      <div class="gallery__hero" [class.gallery__hero--solo]="!secundarias().length">
        <div class="gallery__foto gallery__main" (click)="abrirLightbox(imagenActiva())">
          <!--
            El bucle sobre una sola foto es lo que hace el fundido: al cambiar
            la imagen activa cambia la clave de seguimiento, Angular recrea el
            <img> y la animación de entrada vuelve a arrancar.
          -->
          @for (img of [imagenActiva()]; track img) {
            <img [src]="img" [alt]="s.nombre" rsImg />
          }
          @if (s.imagenes.length) {
            <span class="gallery__contador"><rs-icon name="camera" [size]="14" [stroke]="2" /> {{ s.imagenes.length }} fotografías</span>
          }
        </div>
        @if (secundarias().length) {
          <div class="gallery__side">
            @for (img of secundarias(); track img) {
              <div class="gallery__foto gallery__side-foto" (click)="imagenActiva.set(img)">
                <img [src]="img" [alt]="s.nombre" rsImg />
              </div>
            }
          </div>
        }
      </div>
      <div class="gallery__thumbs">
        @for (img of s.imagenes.slice(0, MINIATURAS_VISIBLES); track img) {
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

        <!-- Dónde está: mapa del punto exacto + atajos a Google Maps -->
        <div class="section-block">
          <rs-ubicacion [lugar]="ubicacion()" />
        </div>

        <!-- Cuándo atienden: el horario es de este servicio, no del negocio. -->
        <div class="section-block">
          <rs-horario-publico [horario]="s.horario" [excepciones]="s.excepcionesHorario" />
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
            <div class="bp-amount">{{ cfg().price(s) | euros }}</div>
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

    <!--
      BARRA FIJA DE MÓVIL — sólo por debajo de 1024px, donde .vd-body pasa a
      una columna y el panel lateral queda al final de la página: sin esto, la
      acción de reservar sólo aparecía tras bajar por la galería, la
      descripción y las reseñas enteras.
    -->
    <div class="mobile-cta">
      <div class="mobile-cta__precio">
        <span class="mobile-cta__desde">Desde</span>
        <strong>{{ cfg().price(s) | euros }}</strong>
        <span class="mobile-cta__unidad">{{ cfg().priceLabel }}</span>
      </div>
      <button class="rs-btn rs-btn--gold rs-btn--lg" (click)="solicitar(s)">{{ cfg().cta }}</button>
    </div>
  </div>
  }
</div>
  `,
  styles: [`
    :host { display: block; }
    .vd-page { min-height: 100vh; background: var(--c-base); }
    .vd-wrap { padding-block: var(--sp-6) var(--sp-16); }

    /*
     * Barra fija de reserva en móvil. Aparece justo donde .vd-body pasa a una
     * columna (1024px): a partir de ahí el panel lateral —aunque sea sticky—
     * queda al final de la página, detrás de la galería, la descripción y las
     * reseñas enteras, así que "sticky" no ayuda hasta que ya se ha bajado
     * todo eso a pulso. En escritorio no hace falta: el panel lateral ya está
     * siempre a la vista.
     */
    .mobile-cta { display: none; }

    @media (max-width: 1024px) {
      /* Sitio para que la barra fija no tape lo último de la página. */
      .vd-wrap { padding-bottom: calc(96px + env(safe-area-inset-bottom, 0px)); }

      .mobile-cta {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: var(--sp-4);
        position: fixed;
        inset: auto 0 0 0;
        z-index: var(--z-2);
        padding: var(--sp-3) var(--sp-5);
        padding-bottom: calc(var(--sp-3) + env(safe-area-inset-bottom, 0px));
        background: var(--c-card);
        border-top: 1px solid var(--b-1);
        box-shadow: 0 -8px 24px rgba(8, 37, 139, .10);
      }
      .mobile-cta__precio { display: flex; flex-direction: column; line-height: 1.25; min-width: 0; }
      .mobile-cta__desde  { font-size: var(--f-xs); color: var(--t-400); text-transform: uppercase; letter-spacing: .06em; }
      .mobile-cta__precio strong { font-size: var(--f-lg); font-weight: var(--w-8); color: var(--dk-blue); }
      .mobile-cta__unidad { font-size: var(--f-xs); color: var(--t-400); }
      .mobile-cta .rs-btn { flex-shrink: 0; padding-inline: var(--sp-6); }
    }

    .breadcrumb { font-size: var(--f-xs); color: var(--t-400); margin-bottom: var(--sp-5); a { color: var(--t-400); } }

    /*
      Mosaico al estilo Booking: una foto grande y dos apiladas al costado. Con
      una sola panorámica arriba, la ficha enseñaba una imagen de siete y el
      resto quedaba en miniaturas del tamaño de un sello.
    */
    /*
      La altura la manda el contenedor, nunca la foto: las imágenes van fuera
      del flujo y las casillas llevan "min-height: 0", porque un elemento de
      rejilla arranca en "min-height: auto" y el alto natural de la foto se
      comía el "aspect-ratio" —el bloque salía altísimo y daba un salto al
      cambiar de imagen, que cada foto trae su propio alto.
    */
    .gallery { margin-bottom: var(--sp-12); }
    .gallery__hero {
      display: grid; grid-template-columns: 2fr 1fr; gap: var(--sp-2); aspect-ratio: 21/9;
      max-height: 400px;
      &.gallery__hero--solo { grid-template-columns: 1fr; }
      > * { min-width: 0; min-height: 0; }
      /* En móvil las secundarias se ceden a la fila de miniaturas. */
      @media (max-width: 768px) {
        grid-template-columns: 1fr; aspect-ratio: 3/2; max-height: 300px;
        .gallery__side { display: none; }
      }
    }
    /* Filas automáticas: con una sola foto de costado llenaría media columna. */
    .gallery__side {
      display: grid; grid-auto-rows: minmax(0, 1fr); gap: var(--sp-2);
      > * { min-height: 0; }
    }
    .gallery__foto {
      position: relative; overflow: hidden; cursor: pointer;
      img {
        position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover;
        /* Cada foto entra con un fundido; el nodo se recrea al cambiar. */
        animation: fadeFoto var(--d-3) both;
      }
    }
    .gallery__side-foto {
      border-radius: var(--r-lg);
      img { transition: transform var(--d-2); }
      &:hover img { transform: scale(1.04); }
    }
    .gallery__main { border-radius: var(--r-xl); }
    @keyframes fadeFoto { from { opacity: 0; } to { opacity: 1; } }
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
    /* Seis miniaturas y más pequeñas: con tres fotos grandes arriba, la
       miniatura ya no tiene que hacer de foto y caben más en la misma fila. */
    .gallery__thumbs {
      display: grid; grid-template-columns: repeat(6, 1fr); gap: var(--sp-2); margin-top: var(--sp-2);
      @media (max-width: 768px) { grid-template-columns: repeat(4, 1fr); }
    }
    .gallery__thumb {
      position: relative;
      aspect-ratio: 16/10; max-height: 84px;
      border-radius: var(--r-md); overflow: hidden; cursor: pointer; opacity: .65; transition: opacity var(--d-2);
      /* Fuera del flujo: si no, el alto natural de la foto estira la fila. */
      img { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; }
      &.active, &:hover { opacity: 1; }
    }

    .vd-body { display: grid; grid-template-columns: 1fr 380px; gap: var(--sp-10); align-items: start; @media (max-width: 1024px) { grid-template-columns: 1fr; } }

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
  private readonly eventosService = inject(EventosService);

  readonly cargando = signal(true);
  readonly servicio = signal<ServicioDetalle | null>(null);

  /** Lo que necesita el bloque "Dónde está": punto exacto y dirección legible. */
  readonly ubicacion = computed<PuntoUbicacion>(() => {
    const s = this.servicio();
    return {
      lat: s?.lat, lng: s?.lng,
      direccion: s?.direccion, ciudad: s?.ciudad, nombre: s?.nombre,
    };
  });
  readonly imagenActiva = signal('');

  /** Huecos de la fila de miniaturas; el template los necesita para el slice. */
  readonly MINIATURAS_VISIBLES = MINIATURAS_VISIBLES;

  /**
   * Las dos fotos que acompañan a la grande en el mosaico: las que siguen a la
   * activa, dando la vuelta al final para que las últimas fotos del listado
   * también tengan compañía. Con una sola foto no hay columna que enseñar.
   */
  readonly secundarias = computed(() => {
    const imagenes = this.servicio()?.imagenes ?? [];
    if (imagenes.length < 2) return [];

    const desde = Math.max(0, imagenes.indexOf(this.imagenActiva()));
    return Array.from(
      { length: Math.min(SECUNDARIAS_VISIBLES, imagenes.length - 1) },
      (_, i) => imagenes[(desde + i + 1) % imagenes.length],
    );
  });

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
      // Visita a ficha: el paso del embudo entre buscar y reservar (TCK-8031).
      this.eventosService.registrarVistaServicio(id, this.cfg().vertical);
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
