import { Component, OnInit, inject, signal, computed } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
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
import { ReservasService } from '../reservas/services/reservas.service';
import { ASPECTOS_POR_VERTICAL } from '../../shared/verticales/resena-aspectos.config';

import { EurosPipe, euros } from '../../shared/pipes/euros.pipe';
import { TraducirPipe } from '../../core/i18n/traducir.pipe';
import { SeoService } from '../../core/seo/seo.service';
import { seoFichaServicio, seoPrivada } from '../../core/seo/plantillas-seo';
import { migasDePan, negocioLocal } from '../../core/seo/json-ld';
import { FechaPipe } from '../../shared/pipes/fecha.pipe';

/**
 * Huecos de la fila de miniaturas y fotos del costado del mosaico. Mismos
 * números que en la ficha de alojamiento: las fichas se ven iguales.
 */
const MINIATURAS_VISIBLES = 6;

/**
 * Servicios que se enseñan de entrada. Una clínica con veinte tarifas dejaba
 * la lista entera entre el titular y todo lo demás; con cinco se ve de qué va
 * el catálogo y el resto está a un toque.
 */
const TARIFAS_VISIBLES = 5;

const DIAS_CORTOS = ['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb'];
const MESES_CORTOS = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
const SECUNDARIAS_VISIBLES = 2;

/**
 * Un servicio contratable con su precio: lo que en Booking es la fila de una
 * habitación. Es el dato que decide la reserva —qué me llevo y cuánto cuesta—,
 * y hasta ahora se pintaba como una etiqueta suelta sin importe.
 */
export interface TarifaServicio {
  readonly nombre: string;
  readonly precio?: number;
  /** Ya legible: "45 min", "2 h". */
  readonly duracion?: string;
  /** Lo que entra en el precio, en frases sueltas. */
  readonly incluye?: readonly string[];
}

/** Minutos a algo que se lee de un vistazo. */
function duracionLegible(minutos: number | undefined): string | undefined {
  if (minutos == null || !Number.isFinite(minutos) || minutos <= 0) return undefined;
  if (minutos < 60) return `${minutos} min`;
  const horas = Math.floor(minutos / 60);
  const resto = minutos % 60;
  return resto ? `${horas} h ${resto} min` : `${horas} h`;
}

interface DetalleConfig {
  vertical: string;
  cta: string;
  priceLabel: string;
  /**
   * Servicios contratables con su tarifa. Vacío = el vertical no vende por
   * servicios sueltos (transporte va por trayecto, seguros por póliza) y el
   * bloque no se pinta.
   */
  servicios: (s: ServicioDetalle) => TarifaServicio[];
  tituloBloque: string;
  /**
   * Encabezado de la fila de chips.
   *
   * Antes estaba escrito «Especialidades» en la plantilla, fijo para todas las
   * categorías, y sólo era cierto en veterinaria: en hoteles esos chips son
   * ventajas, en seguros coberturas y en funerarios servicios contratables.
   */
  tituloChips: string;
  /** Chips destacados; vacío = no se muestra la sección. */
  chips: (s: ServicioDetalle) => string[];
  /** Puntos reales del servicio (nunca inventados) para el bloque "¿Qué ofrece?". */
  puntos: (s: ServicioDetalle) => string[];
  price: (s: ServicioDetalle) => number;
}

const CONFIGS: Record<string, DetalleConfig> = {
  transporte: {
    vertical: 'transporte',
    cta: 'Reservar transporte',
    // El precio es tarifa base + km: no hay servicios sueltos que listar.
    servicios: () => [],
    priceLabel: '+ tarifa por km',
    tituloBloque: '¿Qué ofrece este transportista?',
    tituloChips: 'Servicios',
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
    servicios: (s) => ((s.extra['serviciosAdiestramiento'] as Array<{
      nombre?: string; precio?: number; duracionMin?: number;
    }> | undefined) ?? [])
      .filter((v) => Boolean(v.nombre))
      .map((v) => ({ nombre: v.nombre!, precio: v.precio, duracion: duracionLegible(v.duracionMin) })),
    priceLabel: 'por sesión',
    tituloBloque: '¿Qué incluye esta sesión?',
    tituloChips: 'Tipos de adiestramiento',
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
    servicios: (s) => ((s.extra['espacios'] as Array<{
      tipo?: string; precioNoche?: number; amenities?: string[];
    }> | undefined) ?? [])
      .filter((e) => Boolean(e.tipo))
      .map((e) => ({ nombre: e.tipo!, precio: e.precioNoche, incluye: e.amenities })),
    priceLabel: '/ noche',
    tituloBloque: 'Ventajas de este hotel',
    tituloChips: 'Servicios pet-friendly',
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
    servicios: (s) => ((s.extra['serviciosClinicos'] as Array<{
      nombre?: string; precio?: number; duracionMin?: number;
    }> | undefined) ?? [])
      .filter((v) => Boolean(v.nombre))
      .map((v) => ({ nombre: v.nombre!, precio: v.precio, duracion: duracionLegible(v.duracionMin) })),
    priceLabel: 'la consulta',
    tituloBloque: '¿Qué ofrece esta clínica?',
    tituloChips: 'Servicios con precio cerrado',
    /*
     * Sólo servicios contratables, con su importe. Antes se pintaban las
     * `especialidades` («Medicina general», «Cirugía», «Cardiología»), que
     * describen a quién ves pero no lo que cuesta: el cliente no podía saber el
     * precio antes de ir, que es justo lo que la regla de `veterinarios.md`
     * prohíbe publicar. Una especialidad sí puede llegar aquí si la clínica la
     * ha tarifado —«Primera consulta de cardiología — 70 €»—, porque entonces
     * viene como servicio y trae precio.
     */
    chips: (s) => {
      const servicios = (s.extra['serviciosClinicos'] as Array<{ nombre?: string; precio?: number }> | undefined) ?? [];
      return servicios
        .filter((v) => Boolean(v.nombre))
        .map((v) => (v.precio ? `${v.nombre} · ${euros(v.precio)}` : v.nombre!));
    },
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
    servicios: (s) => ((s.extra['serviciosGrooming'] as Array<{
      nombre?: string; precio?: number; duracionMin?: number;
    }> | undefined) ?? [])
      .filter((v) => Boolean(v.nombre))
      .map((v) => ({ nombre: v.nombre!, precio: v.precio, duracion: duracionLegible(v.duracionMin) })),
    priceLabel: 'desde',
    // "¿Qué servicios ofrece?" prometía lo que ahora está arriba, con precio.
    tituloBloque: '¿Qué ofrece este salón?',
    tituloChips: 'Servicios de peluquería',
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
    servicios: (s) => ((s.extra['serviciosFunerarios'] as Array<{
      nombre?: string; precioBase?: number; incluye?: string[]; activo?: boolean;
    }> | undefined) ?? [])
      .filter((v) => Boolean(v.nombre) && v.activo !== false)
      .map((v) => ({ nombre: v.nombre!, precio: v.precioBase, incluye: v.incluye })),
    priceLabel: 'desde',
    tituloBloque: '¿Qué ofrece esta empresa?',
    tituloChips: 'Servicios disponibles',
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
    // Una póliza es un único producto con su prima: no hay lista que elegir.
    servicios: () => [],
    priceLabel: 'al año',
    tituloBloque: '¿Qué cubre esta póliza?',
    tituloChips: 'Coberturas',
    chips: (s) => (s.extra['coberturas'] as string[] | undefined) ?? [],
    puntos: (s) => {
      const items: string[] = [];
      /*
       * Estos dos no se traducen a la divisa de la cabecera, y es a propósito:
       * no son un precio sino los límites que la póliza cubre, y la póliza los
       * fija en euros. Verlos en libras haría creer que se cobra esa cantidad.
       */
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
    TraducirPipe, RouterLink, FechaPipe, RsNavbarComponent, RsIconComponent, RsRatingComponent,
    RsTrustBlockComponent, RsChipComponent, RsFavoritoBtnComponent, ImgFallbackDirective,
    RsUbicacionComponent, RsHorarioPublicoComponent, EurosPipe,
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
      <h3>{{ 'No se pudo cargar esta ficha' | t }}</h3>
      <p style="color:var(--t-300)">{{ 'Puede que ya no esté disponible.' | t }}</p>
      <a [routerLink]="ui.route" class="rs-btn rs-btn--secondary">{{ 'Volver al listado' | t }}</a>
    </div>
  }

  @if (!cargando() && servicio(); as s) {
  <div class="vd-wrap rs-wrap">

    <nav class="breadcrumb">
      <a routerLink="/">{{ 'Inicio' | t }}</a> /
      <a [routerLink]="ui.route">{{ ui.label | t }}</a> /
      <span>{{ s.nombre }}</span>
    </nav>


    @if (lightboxAbierto()) {
      <div class="lightbox" role="dialog" [attr.aria-label]="'Galería a pantalla completa' | t" (click)="cerrarLightbox()">
        <button type="button" class="lightbox__cerrar" (click)="cerrarLightbox()" [attr.aria-label]="'Cerrar galería' | t">
          <rs-icon name="x" [size]="22" [stroke]="2"></rs-icon>
        </button>
        <button type="button" class="lightbox__nav lightbox__nav--prev" (click)="fotoAnterior(); $event.stopPropagation()" [attr.aria-label]="'Foto anterior' | t">
          <rs-icon name="arrow-left" [size]="22" [stroke]="2"></rs-icon>
        </button>
        <img [src]="lightboxImagen()" [alt]="s.nombre" (click)="$event.stopPropagation()" />
        <button type="button" class="lightbox__nav lightbox__nav--next" (click)="siguienteFoto(); $event.stopPropagation()" [attr.aria-label]="'Foto siguiente' | t">
          <rs-icon name="arrow-right" [size]="22" [stroke]="2"></rs-icon>
        </button>
        <span class="lightbox__contador"><rs-icon name="camera" [size]="14" [stroke]="2" /> {{ lightboxIndice() + 1 }} / {{ s.imagenes.length }}</span>
      </div>
    }

    <div class="vd-body">
      <div class="info-col">
      <!--
        El nombre, antes que las fotos. Es el orden de Booking y el que ordena
        la pantalla: se sabe qué se está mirando antes de mirarlo, y el panel de
        la derecha arranca a la altura del titular en vez de a media galería.
      -->
        <div class="info-header">
          <h1 class="info-header__name">{{ s.nombre }}</h1>
          <div class="info-header__meta">
            <rs-rating [score]="s.score" [label]="s.scoreLabel" [count]="s.numResenas" size="sm"></rs-rating>
            <span><rs-icon name="map-pin" [size]="15" [stroke]="2" /> {{ s.direccion ? s.direccion + ', ' : '' }}{{ s.ciudad }}</span>
            <span class="rs-badge rs-badge--success"><rs-icon name="badge-check" [size]="13" [stroke]="2" /> {{ 'Profesional verificado' | t }}</span>
          </div>
        </div>


    <!--
      La galería va DENTRO de la columna de contenido, no a todo lo ancho
      encima del cuerpo.

      Suelta arriba, su borde derecho quedaba sobre el panel de reserva sin
      relación con él y el panel empezaba por debajo de las fotos: la única
      acción de la ficha aparecía a 400 px de scroll. Metida en la columna, las
      fotos quedan alineadas con todo lo que viene debajo y el hueco de la
      derecha lo ocupa el panel desde la primera pantalla, que es como reparte
      el espacio Booking.
    -->
      <!-- Sin fotos no hay galería: el mosaico vacío dejaba 400 px en
           blanco entre el titular y el contenido. -->
      @if (s.imagenes.length) {
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
      }

        <!--
          ELIGE TU SERVICIO — la "tabla de habitaciones" de Booking.

          Va lo primero de la columna porque es lo que decide la reserva: qué me
          llevo y cuánto cuesta. Antes este sitio lo ocupaba el bloque de
          confianza, ocho líneas idénticas en toda la web que no dicen nada de
          este comercio, y los servicios se pintaban como etiquetas sueltas —sin
          precio, sin duración y sin forma de reservar uno concreto.
        -->
        @if (tarifas().length) {
          <div class="tarifas" data-testid="tarifas">
            <h2>{{ cfg().tituloChips | t }}</h2>
            <ul class="tarifas__lista">
              @for (t of tarifasVisibles(); track t.nombre) {
                <li class="tarifa">
                  <div class="tarifa__que">
                    <strong>{{ t.nombre }}</strong>
                    @if (t.duracion) {
                      <span class="tarifa__dato"><rs-icon name="clock" [size]="13" [stroke]="2" /> {{ t.duracion }}</span>
                    }
                    @if (t.incluye?.length) {
                      <span class="tarifa__incluye">{{ t.incluye!.slice(0, 3).join(' · ') }}</span>
                    }
                  </div>
                  <div class="tarifa__accion">
                    @if (t.precio != null) { <span class="tarifa__precio">{{ t.precio | euros }}</span> }
                    <button type="button" class="rs-btn rs-btn--outline" (click)="solicitar(s, t)">
                      {{ 'Reservar' | t }}
                    </button>
                  </div>
                </li>
              }
            </ul>

            @if (tarifasOcultas()) {
              <button type="button" class="tarifas__mas" data-testid="ver-mas-tarifas"
                      [attr.aria-expanded]="tarifasDesplegadas()"
                      (click)="tarifasDesplegadas.set(!tarifasDesplegadas())">
                @if (tarifasDesplegadas()) {
                  {{ 'Ver menos' | t }}
                  <rs-icon name="chevron-up" [size]="15" [stroke]="2.5" />
                } @else {
                  {{ 'Ver los {n} servicios restantes' | t: { n: tarifasOcultas() } }}
                  <rs-icon name="chevron-down" [size]="15" [stroke]="2.5" />
                }
              </button>
            }
          </div>
        } @else if (cfg().chips(s).length) {
          <div class="section-block">
            <h2>{{ cfg().tituloChips | t }}</h2>
            <div class="chips-row">
              @for (c of cfg().chips(s); track c) { <rs-chip [active]="true">{{ c }}</rs-chip> }
            </div>
          </div>
        }

        @if (s.descripcion) {
          <div class="section-block">
            <h2>{{ 'Sobre este servicio' | t }}</h2>
            <p>{{ s.descripcion }}</p>
          </div>
        }

        <div class="section-block">
          <h2>{{ cfg().tituloBloque }}</h2>
          <ul class="puntos-list">
            @for (p of cfg().puntos(s); track p) {
              <li><rs-icon name="check" [size]="15" [stroke]="2.5" /> {{ p }}</li>
            }
            @empty { <p style="color:var(--t-400);font-size:var(--f-sm)">{{ 'Sin datos adicionales de este profesional.' | t }}</p> }
          </ul>
        </div>

        <!-- Cuándo atienden: el horario es de este servicio, no del negocio. -->
        <div class="section-block">
          <rs-horario-publico [horario]="s.horario" [excepciones]="s.excepcionesHorario" />
        </div>

        <div class="section-block">
          <h2>{{ 'Lo que opinan otros dueños' | t }}</h2>

          <!--
            La nota, delante de los comentarios. Antes el bloque abría con
            "Reseñas (3)" y para saber si el sitio era bueno había que leerlas
            una a una; el desglose por criterios ya lo puntuaba cada cliente al
            valorar y no se enseñaba en ninguna parte.
          -->
          @if (s.numResenas) {
            <div class="resumen-nota" data-testid="resumen-nota">
              <div class="resumen-nota__cifra">
                <strong>{{ s.score }}</strong>
                <span>
                  <em>{{ s.scoreLabel }}</em>
                  {{ s.numResenas }} {{ s.numResenas === 1 ? ('reseña' | t) : ('reseñas' | t) }}
                </span>
              </div>
              @if (aspectosMedios().length) {
                <ul class="resumen-nota__aspectos">
                  @for (a of aspectosMedios(); track a.label) {
                    <li>
                      <span class="resumen-nota__label">{{ a.label | t }}</span>
                      <span class="resumen-nota__barra"><i [style.width.%]="a.media * 20"></i></span>
                      <span class="resumen-nota__valor">{{ a.media }}</span>
                    </li>
                  }
                </ul>
              }
            </div>
          }

          @for (r of s.resenas; track r.id) {
            <div class="resena-card">
              <div class="resena-card__head">
                <strong>{{ r.autorNombre }}</strong>
                <span class="resena-card__score">{{ r.puntuacion }}/5</span>
                <span class="resena-card__fecha">{{ r.fecha | date:'d MMM yyyy' }}</span>
              </div>
              <p>{{ r.comentario }}</p>
              @if (r.respuesta) {
                <p class="resena-card__respuesta">↳ {{ r.respuesta | t }}</p>
              }
            </div>
          } @empty {
            <p style="color:var(--t-400);font-size:var(--f-sm)">{{ 'Aún no hay reseñas de este profesional.' | t }}</p>
          }
        </div>

        <!-- La garantía, entera y una sola vez: es lo mismo en toda la web, así
             que cierra la ficha en vez de abrirla por duplicado. -->
        <div class="section-block">
          <h2><rs-icon name="shield-check" [size]="18" [stroke]="2" /> {{ 'Garantía Doogking' | t }}</h2>
          <rs-trust-block></rs-trust-block>
        </div>
      </div>

      <!--
        PANEL DE RESERVA. Lo único que hay a la derecha, y lo primero que se
        mira: precio, cuándo hay hueco y el botón. Las ocho líneas de la
        garantía vivían aquí y también arriba de la columna izquierda; ahora
        aquí van las tres que pesan en la decisión y la lista entera se da una
        sola vez, al final de la ficha.
      -->
      <div class="side-col rs-sticky-panel">
        <div class="side-panel rs-card">
          <p class="rs-bp-desde">{{ 'Desde' | t }}</p>
          <p class="rs-bp-amount">
            {{ cfg().price(s) | euros }}
            <!-- "Desde 25 € desde": el rótulo de peluquería y funerarios es
                 justamente "desde", así que sólo se pinta si añade algo. -->
            @if (unidadPrecio(); as unidad) { <span class="rs-bp-per">{{ unidad }}</span> }
          </p>

          @if (proximaCita(); as cita) {
            <p class="rs-bp-gancho" data-testid="proxima-cita">
              <rs-icon name="zap" [size]="15" [stroke]="2" />
              <span>{{ 'Primera cita libre' | t }}: <strong>{{ diaLegible(cita.fecha) }} · {{ cita.hora }}</strong></span>
            </p>
          }

          <button class="rs-btn rs-btn--gold rs-btn--block rs-btn--lg" (click)="solicitar(s)">
            {{ cfg().cta }}
          </button>
          <p class="rs-bp-nota">{{ 'No se cobra nada hasta confirmar' | t }}</p>

          <ul class="rs-bp-claves">
            @if (s.cancelacionGratis) {
              <li><rs-icon name="calendar" [size]="15" [stroke]="2" /> {{ 'Cancelación gratuita' | t }}</li>
            }
            <li><rs-icon name="zap" [size]="15" [stroke]="2" /> {{ 'Confirmación inmediata' | t }}</li>
            <li><rs-icon name="lock" [size]="15" [stroke]="2" /> {{ 'Pago seguro con Stripe' | t }}</li>
          </ul>

          <div class="side-panel__fav">
            <rs-favorito-btn [servicioId]="s.id" [tamano]="18"></rs-favorito-btn>
            <span>{{ 'Guardar en favoritos' | t }}</span>
          </div>
        </div>

        <!--
          Dónde está, bajo el panel de reserva. En escritorio la columna de la
          derecha tenía el panel y debajo aire, mientras el mapa partía en dos
          la lectura del contenido. Aquí acompaña a la decisión —"me pilla
          cerca"— sin cortar nada, que es donde lo pone Booking.

          Va una sola vez: dos "rs-ubicacion" serían dos mapas montados.
          En móvil la columna cae al final, así que el mapa cierra la ficha.
        -->
        <div class="side-mapa rs-card">
          <rs-ubicacion [lugar]="ubicacion()" [compacto]="true" />
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
        <span class="mobile-cta__desde">{{ 'Desde' | t }}</span>
        <strong>{{ cfg().price(s) | euros }}</strong>
        @if (unidadPrecio(); as unidad) { <span class="mobile-cta__unidad">{{ unidad }}</span> }
      </div>
      <button class="rs-btn rs-btn--gold rs-btn--lg" (click)="solicitar(s)">{{ cfg().cta }}</button>
    </div>
  </div>
  }
</div>
  `,
  styles: [`
    :host { display: block; }
    .vd-page { min-height: 100vh; min-height: 100dvh; background: var(--c-base); }
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

      /*
        El panel cae al final de la página en una sola columna, así que su
        precio y su botón repetían lo que la barra fija ya tiene delante de los
        ojos. Se quedan sólo la primera cita libre, las claves y favoritos.
      */
      .side-panel .rs-bp-desde,
      .side-panel .rs-bp-amount,
      .side-panel .rs-btn--gold,
      .side-panel .rs-bp-nota { display: none; }
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
      img { max-width: min(92vw, 1100px); max-height: 86vh; max-height: 86dvh; object-fit: contain; border-radius: var(--r-lg); cursor: default; }
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
      /*
        Reparto por flex y no por rejilla de seis columnas fijas: con cinco
        fotos la sexta casilla quedaba vacía y la fila terminaba en un hueco.
        Así las que haya se reparten el ancho entero, sean tres o seis.
      */
      display: flex; gap: var(--sp-2); margin-top: var(--sp-2);
      > * { flex: 1 1 0; min-width: 0; }
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

    /* Aire entre el titular y las fotos: pegados parecían el mismo bloque y
       el nombre se leía como el pie de la galería. */
    .info-header { margin-bottom: var(--sp-6); }
    .info-header__name { font-size: var(--f-3xl); color: var(--dk-blue); margin-bottom: var(--sp-3); }
    .info-header__meta { display: flex; flex-wrap: wrap; align-items: center; gap: var(--sp-4); font-size: var(--f-sm); color: var(--t-300); margin-bottom: 0; }

    .chips-row { display: flex; flex-wrap: wrap; gap: var(--sp-2); }

    .section-block {
      padding-block: var(--sp-6); border-top: 1px solid var(--b-1);
      h2 {
        display: flex; align-items: center; gap: var(--sp-2);
        font-size: var(--f-lg); color: var(--dk-blue); margin-bottom: var(--sp-4);
      }
    }

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

    /* ── Panel de reserva ─────────────────────────────────────────── */
    .side-panel { padding: var(--sp-5); }
    /*
      Importe y unidad en la misma línea, alineados por la base. Antes iban en
      tres líneas centradas que ocupaban medio panel para decir "25 €".
    */

    /* El gancho: cuándo se puede, antes de entrar al asistente. */




    /*
      La columna de la derecha, acotada a lo que cabe en pantalla.

      Medido: con el panel y la tarjeta del mapa son 730 px, y en un portátil
      de 768 sólo hay 684 por debajo de la navbar. Una columna pegajosa más
      alta que su hueco se queda cortada por abajo —y lo cortado eran los dos
      enlaces del mapa—. Con el tope rueda por dentro y no se pierde nada.
    */
    .side-col {
      max-height: calc(100dvh - var(--sticky-top, 84px) - var(--sp-4));
      overflow-y: auto;
      overscroll-behavior: contain;
      /* Sin tope no hay nada que recortar: en móvil la columna va en el flujo. */
      @media (max-width: 1024px) { max-height: none; overflow: visible; }
    }

    /* La tarjeta del mapa, separada del panel de reserva pero en su columna. */
    .side-mapa { margin-top: var(--sp-4); padding: var(--sp-4); }

    /* ── Servicios con su tarifa ──────────────────────────────────── */
    .tarifas {
      padding-block: var(--sp-6);
      border-top: 1px solid var(--b-1);
      h2 { font-size: var(--f-lg); color: var(--dk-blue); margin-bottom: var(--sp-4); }
    }
    .tarifas__lista {
      list-style: none;
      border: 1px solid var(--b-1); border-radius: var(--r-xl); overflow: hidden;
    }
    .tarifa {
      display: flex; align-items: center; justify-content: space-between;
      gap: var(--sp-4); padding: var(--sp-4);
      border-top: 1px solid var(--b-1);
      &:first-child { border-top: none; }
      &:hover { background: var(--c-raised); }
    }
    .tarifa__que {
      display: flex; flex-direction: column; gap: 2px; min-width: 0;
      strong { font-size: var(--f-md); color: var(--t-100); }
    }
    .tarifa__dato {
      display: inline-flex; align-items: center; gap: var(--sp-1);
      font-size: var(--f-xs); color: var(--t-400);
      rs-icon { color: var(--t-400); }
    }
    .tarifa__incluye { font-size: var(--f-xs); color: var(--t-400); }
    .tarifa__accion { display: flex; align-items: center; gap: var(--sp-3); flex: none; }
    .tarifa__precio { font-size: var(--f-lg); font-weight: var(--w-8); color: var(--dk-blue); white-space: nowrap; }

    /* Discreto y a todo lo ancho de la lista: continúa la tabla, no compite
       con el botón de reservar de cada fila. */
    .tarifas__mas {
      display: flex; align-items: center; justify-content: center; gap: var(--sp-2);
      width: 100%; margin-top: var(--sp-3); padding: var(--sp-3);
      border: 1px dashed var(--b-2); border-radius: var(--r-lg);
      background: transparent; color: var(--dk-blue);
      font: var(--w-6) var(--f-sm) var(--font); cursor: pointer;
      transition: background var(--d-2), border-color var(--d-2);

      &:hover { background: var(--c-raised); border-color: var(--dk-blue); }
      &:focus-visible { outline: 2px solid var(--dk-gold); outline-offset: 2px; }
    }

    /* En móvil el precio y el botón bajan a su propia fila: en 390 px, el
       nombre del servicio y los dos juntos no caben sin partirse. */
    @media (max-width: 560px) {
      .tarifa { flex-direction: column; align-items: stretch; gap: var(--sp-3); }
      .tarifa__accion { justify-content: space-between; }
    }

    /* ── Nota agregada de las reseñas ─────────────────────────────── */
    .resumen-nota {
      display: grid; grid-template-columns: auto 1fr; gap: var(--sp-6);
      align-items: center; margin-bottom: var(--sp-5);
      padding: var(--sp-4); border-radius: var(--r-lg); background: var(--c-raised);
      @media (max-width: 640px) { grid-template-columns: 1fr; gap: var(--sp-4); }
    }
    .resumen-nota__cifra {
      display: flex; align-items: center; gap: var(--sp-3);
      strong {
        display: grid; place-items: center; min-width: 52px; height: 52px; padding-inline: var(--sp-2);
        border-radius: var(--r-lg); background: var(--dk-blue); color: #fff;
        font-size: var(--f-xl); font-weight: var(--w-8);
      }
      span { display: flex; flex-direction: column; font-size: var(--f-xs); color: var(--t-400); }
      em { font-style: normal; font-size: var(--f-sm); font-weight: var(--w-7); color: var(--t-100); }
    }
    .resumen-nota__aspectos {
      list-style: none; display: grid; gap: var(--sp-2);
      grid-template-columns: repeat(2, minmax(0, 1fr));
      @media (max-width: 640px) { grid-template-columns: 1fr; }
      li { display: grid; grid-template-columns: 1fr 72px auto; align-items: center; gap: var(--sp-2); }
    }
    .resumen-nota__label { font-size: var(--f-xs); color: var(--t-300); min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .resumen-nota__barra {
      height: 5px; border-radius: var(--r-full); background: var(--b-1); overflow: hidden;
      i { display: block; height: 100%; background: var(--dk-blue); }
    }
    .resumen-nota__valor { font-size: var(--f-xs); font-weight: var(--w-7); color: var(--t-200); }

    .side-panel__fav { display: flex; align-items: center; justify-content: center; gap: var(--sp-2); margin-top: var(--sp-4); font-size: var(--f-sm); color: var(--t-300); }
  `],
})
export class VerticalDetalleComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly browseService = inject(CatalogBrowseService);
  private readonly eventosService = inject(EventosService);
  private readonly seo = inject(SeoService);
  private readonly reservas = inject(ReservasService);

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

  /**
   * La unidad que acompaña al importe, o nada si sólo repetiría el "Desde" de
   * arriba: en peluquería y funerarios el rótulo es literalmente "desde" y el
   * panel decía "Desde / 25 € / desde".
   */
  readonly unidadPrecio = computed(() => {
    const etiqueta = this.cfg().priceLabel.trim();
    return etiqueta.toLowerCase() === 'desde' ? '' : etiqueta;
  });

  /** "mié 16 sep": como se nombra un día al hablar de una cita. */
  diaLegible(fecha: string): string {
    const dia = new Date(`${fecha}T12:00:00Z`);
    return `${DIAS_CORTOS[dia.getUTCDay()]} ${dia.getUTCDate()} ${MESES_CORTOS[dia.getUTCMonth()]}`;
  }

  /** Servicios contratables con su precio, el bloque que decide la reserva. */
  readonly tarifas = computed<TarifaServicio[]>(() => {
    const s = this.servicio();
    return s ? this.cfg().servicios(s) : [];
  });

  readonly tarifasDesplegadas = signal(false);

  /** Las cinco primeras, o todas si el cliente ha pedido verlas. */
  readonly tarifasVisibles = computed(() =>
    this.tarifasDesplegadas() ? this.tarifas() : this.tarifas().slice(0, TARIFAS_VISIBLES));

  /** Cuántas quedan por enseñar; 0 = no hace falta el botón. */
  readonly tarifasOcultas = computed(() => Math.max(0, this.tarifas().length - TARIFAS_VISIBLES));

  /**
   * Primera cita libre del servicio, del API de agenda.
   *
   * Es la respuesta a "¿cuándo puedo?", que es lo que decide entrar o no al
   * asistente. Antes había que empezar la reserva para averiguarlo. Sólo la
   * contestan los verticales que se reservan por cita; en el resto se queda
   * en null y el panel no pinta nada.
   */
  readonly proximaCita = signal<{ fecha: string; hora: string } | null>(null);

  /** Desglose de la nota por criterios, promediando lo que puntuó cada reseña. */
  readonly aspectosMedios = computed<Array<{ label: string; media: number }>>(() => {
    const resenas = this.servicio()?.resenas ?? [];
    const criterios = ASPECTOS_POR_VERTICAL[this.ui.key as keyof typeof ASPECTOS_POR_VERTICAL] ?? [];

    return criterios
      .map(({ key, label }) => {
        const notas = resenas
          .map((r) => r.aspectos?.[key])
          .filter((n): n is number => typeof n === 'number' && n > 0);
        return { label, media: notas.reduce((a, b) => a + b, 0) / (notas.length || 1), votos: notas.length };
      })
      .filter((a) => a.votos > 0)
      .map(({ label, media }) => ({ label, media: Math.round(media * 10) / 10 }));
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
      this.aplicarSeo(data);
      // Visita a ficha: el paso del embudo entre buscar y reservar (TCK-8031).
      this.eventosService.registrarVistaServicio(id, this.cfg().vertical);
      // En paralelo: la ficha ya está pintada y la cita llega cuando llegue.
      void this.cargarProximaCita(id);
    } catch {
      // Sin mock: si no se puede cargar el servicio, se muestra "no encontrado".
      this.servicio.set(null);
      this.seo.aplicar(seoPrivada('Servicio no disponible',
        'Este servicio ya no está publicado en Doogking.'));
      this.seo.noEncontrado();
    } finally {
      this.cargando.set(false);
    }
  }

  /**
   * La ficha es la página que más se comparte por mensajería, así que es donde
   * más se nota tener título, descripción e imagen propios. Además declara
   * `LocalBusiness`, que es lo que permite a Google enseñar la valoración con
   * estrellas y la dirección en el propio resultado.
   */
  private aplicarSeo(servicio: ServicioDetalle): void {
    const origen = this.seo.origenPublico();
    const ruta = `${this.ui.route}/${servicio.id}`;

    this.seo.aplicar(seoFichaServicio({
      titulo: servicio.nombre,
      descripcion: servicio.descripcion || this.ui.descripcion,
      ciudad: servicio.ciudad,
      categoria: this.ui.label,
      ruta,
      imagen: servicio.imagenes[0],
      precioDesde: servicio.precioPorNoche || undefined,
      // El catálogo público sólo devuelve fichas publicadas: si ha llegado
      // hasta aquí, se puede indexar.
      publicado: true,
    }));

    this.seo.datosEstructurados([
      negocioLocal({
        nombre: servicio.nombre,
        descripcion: servicio.descripcion || this.ui.descripcion,
        url: `${origen}${ruta}`,
        imagenes: servicio.imagenes.map((imagen) => this.absoluta(origen, imagen)),
        ciudad: servicio.ciudad,
        direccion: servicio.direccion,
        coordenadas: servicio.lat !== undefined && servicio.lng !== undefined
          ? { lat: servicio.lat, lng: servicio.lng }
          : undefined,
        precioDesde: servicio.precioPorNoche || undefined,
        valoracion: { media: servicio.score, total: servicio.numResenas },
      }),
      migasDePan([
        { nombre: 'Inicio', url: `${origen}/` },
        { nombre: this.ui.label, url: `${origen}${this.ui.route}` },
        { nombre: servicio.nombre, url: `${origen}${ruta}` },
      ]),
    ]);
  }

  /** Las imágenes de los datos estructurados tienen que ser URL absolutas. */
  private absoluta(origen: string, imagen: string): string {
    return /^https?:\/\//i.test(imagen) ? imagen : `${origen}${imagen.startsWith('/') ? '' : '/'}${imagen}`;
  }

  /**
   * Al asistente, con lo que el cliente ya ha decidido aquí.
   *
   * `tarifa` llega cuando ha pulsado "Reservar" en un servicio concreto de la
   * lista: ese servicio viaja elegido y su precio manda sobre el "desde" de la
   * ficha, de modo que no tiene que volver a escogerlo en el paso 1.
   */
  solicitar(s: ServicioDetalle, tarifa?: TarifaServicio): void {
    void this.router.navigate(['/reservas', this.cfg().vertical, s.id], {
      queryParams: {
        comercioId: s.comercioId ?? '',
        nombre: s.nombre,
        precioBase: tarifa?.precio ?? this.cfg().price(s),
        imagen: s.imagenes?.[0] ?? '',
        desde: this.busqueda.desde ?? this.proximaCita()?.fecha ?? null,
        perros: this.busqueda.perros ?? null,
        servicio: tarifa?.nombre ?? null,
      },
    });
  }

  /**
   * Pide la agenda de los próximos dos meses —lo que el API contesta de una
   * vez— y se queda con la primera cita libre. Es contenido de apoyo: si falla
   * o el vertical no va por citas, la ficha sigue igual de completa.
   */
  private async cargarProximaCita(servicioId: string): Promise<void> {
    const hoy = new Date();
    const dentroDeDosMeses = new Date(hoy.getTime() + 60 * 24 * 60 * 60 * 1000);
    try {
      const agenda = await this.reservas.agenda({
        servicioId,
        desde: hoy.toISOString().slice(0, 10),
        hasta: dentroDeDosMeses.toISOString().slice(0, 10),
      });
      this.proximaCita.set(agenda.primeraLibre ?? null);
    } catch {
      this.proximaCita.set(null);
    }
  }
}
