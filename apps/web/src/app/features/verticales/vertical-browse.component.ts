import { Component, DestroyRef, OnInit, computed, inject, signal, viewChild } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router } from '@angular/router';
import { VerticalKey } from 'shared';
import { RsNavbarComponent } from '../../shared/components/navbar/rs-navbar.component';
import { RsSearchBarComponent } from '../../shared/components/search-bar/rs-search-bar.component';
import { AnimateOnScrollDirective } from '../../shared/directives/animate-on-scroll.directive';
import { RsCardComponent, type CardAmenity, type CardBadge } from '../../shared/components/card/rs-card.component';
import { conIconos } from '../../shared/catalogos/amenity-iconos';
import { RsChipComponent } from '../../shared/components/chip/rs-chip.component';
import { ExperienciasCercaComponent } from '../explora/experiencias-cerca.component';
import { VerticalUi, enlaceAServicio, verticalUi } from '../../shared/verticales/verticales.config';
import {
  CatalogBrowseService, FacetasCatalogo, OpcionesBusqueda, OrdenServicios, PuntoServicio,
  ServicioCard, ZonaBusqueda,
} from './catalog-browse.service';
import type { FiltrosSeleccionados } from '../../shared/components/filtros-listado/rs-filtros-listado.component';
import { RsListadoComponent } from '../../shared/components/listado/rs-listado.component';
import { RsMapaBuscadorComponent } from '../../shared/components/mapa-buscador/rs-mapa-buscador.component';
import type { PuntoMapa, ZonaMapa } from '../../shared/components/mapa/rs-mapa.component';
import type { BarraHistograma } from '../../shared/components/range-slider/rs-range-slider.component';
import { calcularBadgesAutomaticos } from '../../shared/badges/badges-automaticos';

import { euros } from '../../shared/pipes/euros.pipe';
/** Filtros de búsqueda vigentes, tal y como llegan en la URL. */
interface Busqueda {
  ciudad?: string;
  desde?: string;
  /** Hora pedida en el buscador; ordena los resultados por cercanía al slot. */
  hora?: string;
  perros?: string;
  /** Mascota elegida en el buscador: filtra por compatibilidad. */
  perroId?: string;
}

/**
 * Presentación de las tarjetas de cada vertical de cita. El título, la
 * descripción y el buscador ya no viven aquí: vienen de `verticales.config.ts`
 * y de `<rs-search-bar>`, comunes a toda la aplicación.
 */
interface VerticalConfig {
  vertical: string;
  cta: string;
  priceLabel: string;
  badge: (c: ServicioCard) => string | null;
  titulo3: (c: ServicioCard) => string;
  loc: (c: ServicioCard) => string;
  meta: (c: ServicioCard) => string[];
  price: (c: ServicioCard) => number;
  confirmMsg: string;
  /**
   * Lo que incluye la reserva, con marca de verificacion bajo las etiquetas.
   * Va aparte de `meta` porque no describe el servicio sino las condiciones de
   * la reserva, que es lo que decide la compra. Alojamiento y transporte ya lo
   * pintaban y las categorias de cita no: era una de las diferencias que hacia
   * que cada listado pareciese otra pantalla.
   */
  incluye?: (c: ServicioCard) => string[];
}

/** Distintivos comunes a cualquier categoria, leidos del dato real. */
const incluyeComun = (c: ServicioCard): string[] => {
  const items: string[] = [];
  const extra = c.extra as Record<string, unknown>;
  if (extra['cancelacionGratis'] ?? (c as unknown as { cancelacionGratis?: boolean }).cancelacionGratis) {
    items.push('Cancelación gratis');
  }
  if (extra['aDomicilio']) items.push('Va a tu domicilio');
  return items;
};

interface ItemConNombre {
  nombre: string;
  precio: number;
}

/** Nombres del primer/menor servicio y precio mínimo entre los servicios propios del vertical (o el precio base si no hay ninguno). */
const resumenServicios = (items: ItemConNombre[] | undefined, c: ServicioCard): { primero: string | null; nombres: string; precioMin: number } => {
  if (!items?.length) return { primero: null, nombres: '', precioMin: c.precioPorNoche };
  return {
    primero: items[0].nombre,
    nombres: items.map((i) => i.nombre).join(' · '),
    precioMin: Math.min(...items.map((i) => i.precio)),
  };
};

/**
 * Problemas que el cliente reconoce ("tira de la correa", "no obedece"…)
 * traducidos a los `tiposAdiestramiento` que el profesional declara en su ficha
 * (PDF 27/07 §13). La correspondencia vive aquí y no en el backend porque es
 * vocabulario de interfaz: el dato que se compara sigue siendo el declarado.
 */
const PROBLEMAS_ADIESTRAMIENTO: ReadonlyArray<{ label: string; tipos: readonly string[] }> = [
  { label: 'Tira de la correa',   tipos: ['Paseo con correa'] },
  { label: 'No obedece',          tipos: ['Obediencia básica', 'Obediencia avanzada', 'Llamada'] },
  { label: 'Es un cachorro',      tipos: ['Educación de cachorros'] },
  { label: 'Tiene miedo',         tipos: ['Modificación de conducta', 'Socialización'] },
  { label: 'Rompe cosas en casa', tipos: ['Ansiedad por separación', 'Modificación de conducta'] },
  { label: 'Agresividad',         tipos: ['Reactividad', 'Modificación de conducta'] },
  { label: 'Se pone nervioso',    tipos: ['Ansiedad por separación', 'Reactividad'] },
];

const CONFIGS: Record<string, VerticalConfig> = {
  veterinaria: {
    vertical: 'veterinaria',
    cta: 'Pedir cita', priceLabel: 'consulta desde',
    confirmMsg: 'Cita solicitada. Continúa al pago para confirmarla.',
    badge: (c) => `${(c.extra['especialidades'] as string[] | undefined)?.[0] ?? 'Medicina general'}`,
    titulo3: (c) => c.nombre,
    loc: (c) => `${c.ciudad}`,
    meta: (c) => [
      `${resumenServicios(c.extra['serviciosClinicos'] as ItemConNombre[] | undefined, c).nombres || 'Consulta general'}`,
      // El horario dejó de ser un texto libre del vertical y pasó a ser la
      // semana estructurada del servicio, que no cabe en una línea de tarjeta.
      c.extra['atiendeUrgencias'] ? 'Urgencias 24h' : 'Consulta horario',
    ],
    price: (c) => (c.extra['precioConsulta'] as number) ?? c.precioPorNoche,
  },
  peluqueria: {
    vertical: 'peluqueria',
    cta: 'Reservar cita', priceLabel: 'servicio desde',
    confirmMsg: 'Cita de peluquería solicitada. Continúa al pago para confirmarla.',
    badge: (c) => `${resumenServicios(c.extra['serviciosGrooming'] as ItemConNombre[] | undefined, c).primero ?? 'Corte y baño'}`,
    titulo3: (c) => c.nombre,
    loc: (c) => `${c.ciudad}`,
    meta: (c) => [
      `${resumenServicios(c.extra['serviciosGrooming'] as ItemConNombre[] | undefined, c).nombres || 'Baño completo'}`,
      c.extra['aDomicilio'] ? 'A domicilio' : 'En salón',
    ],
    price: (c) => resumenServicios(c.extra['serviciosGrooming'] as ItemConNombre[] | undefined, c).precioMin,
  },
  adiestramiento: {
    vertical: 'adiestramiento',
    cta: 'Reservar sesión', priceLabel: 'sesión desde',
    confirmMsg: 'Sesión solicitada. Continúa al pago para confirmarla.',
    badge: (c) => `${(c.extra['tiposAdiestramiento'] as string[] | undefined)?.[0] ?? 'Obediencia básica'}`,
    titulo3: (c) => c.nombre,
    loc: (c) => `${c.ciudad}`,
    meta: (c) => [
      `${c.extra['modalidad'] === 'programa' ? 'Programa completo' : 'Por sesión'}`,
      `Desde ${(c.extra['edadMinimaMeses'] as number) ?? 3} meses`,
    ],
    price: (c) => (c.extra['precioSesion'] as number) ?? c.precioPorNoche,
  },
  hoteles: {
    vertical: 'hoteles',
    cta: 'Reservar hotel', priceLabel: 'habitación desde',
    confirmMsg: 'Hotel solicitado. Continúa al pago para confirmarlo.',
    badge: (c) => (c.extra['admiteMascotas'] ?? true) ? 'Pet-friendly' : 'Hotel',
    titulo3: (c) => c.nombre,
    loc: (c) => `${c.ciudad}`,
    meta: (c) => [
      `Hasta ${(c.extra['maxMascotasPorReserva'] as number | undefined) ?? 'sin límite de'} mascota(s)`,
      `${((c.extra['serviciosPetfriendly'] as string[] | undefined) ?? [])[0] ?? 'Servicios pet-friendly'}`,
    ],
    price: (c) => c.precioPorNoche,
  },
  cuidadores: {
    vertical: 'cuidadores',
    cta: 'Reservar cuidado', priceLabel: 'servicio desde',
    confirmMsg: 'Servicio solicitado. Continúa al pago para confirmarlo.',
    badge: (c) => `${((c.extra['modalidades'] as string[] | undefined) ?? [])[0] ?? 'Paseos'}`,
    titulo3: (c) => c.nombre,
    loc: (c) => `${c.ciudad}`,
    meta: (c) => [
      `${((c.extra['modalidades'] as string[] | undefined) ?? []).join(' · ') || 'Paseos y visitas'}`,
      c.extra['administraMedicacion'] ? 'Administra medicación' : 'Cuidado a domicilio',
    ],
    price: (c) => (c.extra['precioPaseo'] as number) ?? c.precioPorNoche,
  },
  seguros: {
    vertical: 'seguros',
    // No se "reserva": se contrata, y el precio es orientativo hasta que la
    // aseguradora valida los datos declarados (HU-040).
    cta: 'Ver cobertura', priceLabel: 'prima anual desde',
    confirmMsg: 'Solicitud enviada. La aseguradora validará los datos antes de emitir la póliza.',
    badge: (c) => `${((c.extra['tiposSeguro'] as string[] | undefined) ?? []).length} coberturas`,
    titulo3: (c) => c.nombre,
    loc: (c) => `${c.ciudad}`,
    meta: (c) => [
      `${(c.extra['duracionMeses'] as number | undefined) ?? 12} meses de vigencia`,
      (c.extra['renovacionAutomatica'] ?? true) ? 'Renovación automática' : 'Sin renovación automática',
    ],
    price: (c) => (c.extra['primaAnualBase'] as number) ?? c.precioPorNoche,
  },
};

@Component({
  selector: 'app-vertical-browse',
  standalone: true,
  imports: [
    RsNavbarComponent, RsSearchBarComponent, RsListadoComponent,
    AnimateOnScrollDirective, ExperienciasCercaComponent, RsCardComponent, RsChipComponent,
    RsMapaBuscadorComponent,
  ],
  template: `
<div class="vb-page">
  <rs-navbar [categoriasMovil]="true" />

  <rs-listado
    [titulo]="titular()" [subtitulo]="subtitular()"
    [reclamoTitulo]="ui().reclamo.titulo" [reclamoTexto]="ui().reclamo.texto"
    [reclamoIcono]="ui().icono"
    [vertical]="cfg().vertical"
    [total]="total()" [mostrados]="items().length"
    [cargando]="cargando()" [cargandoMas]="cargandoMas()"
    [error]="error()" [hayMas]="hayMas()"
    [histograma]="histogramaPrecios()"
    [conteos]="facetas()?.amenities ?? []"
    [conteosValoracion]="facetas()?.valoracion ?? []"
    [orden]="orden()"
    [contexto]="contextoBusqueda()"
    [sufijoCiudad]="sufijoCiudad()" [ciudad]="busqueda().ciudad ?? ''"
    [mapaAbierto]="mapaAbierto()"
    (filtrosCambio)="aplicarFiltros($event)"
    (ordenCambio)="cambiarOrden($event)"
    (verMas)="verMas()"
    (reintentar)="recargar()"
    (mapaAlternado)="alternarMapa()">

    <!-- Sin la fila de categorías: la navbar ya las lleva justo encima. -->
    <rs-search-bar listadoBuscador variant="strip" [vertical]="ui().key"
                   [categorias]="false" [buscarAlCambiar]="true" />

    <!-- Selector de problema en adiestramiento (PDF 27/07 §13): ordena
         primero a quien declara esa especialidad. -->
    @if (esAdiestramiento()) {
      <div listadoAntes class="vb-problema">
        <p class="vb-problema__titulo">¿Qué problema quieres resolver?</p>
        <div class="vb-problema__chips">
          <rs-chip [active]="problema() === null" [isAll]="true" (chipClick)="elegirProblema(null)">
            Todos
          </rs-chip>
          @for (p of problemas; track p.label) {
            <rs-chip [active]="problema() === p.label" (chipClick)="elegirProblema(p.label)">
              {{ p.label }}
            </rs-chip>
          }
        </div>
        @if (problema()) {
          <p class="vb-problema__nota">
            Primero los adiestradores que declaran esta especialidad en su ficha.
          </p>
        }
      </div>
    }

    <div listadoResultados class="rs-result-grid">
      @for (c of itemsOrdenados(); track c.id) {
        <!-- Los verticales sin ficha usan el mismo botón integrado que el
             resto, vía ctaClick: antes lo proyectaban por cardFooter y ese
             DOM aparte lo dejaba a otra altura. -->
        <rs-card rsAnim
          [horizontal]="true"
          [imageUrl]="c.imagenes[0]" [imageAlt]="c.nombre"
          [title]="cfg().titulo3(c)" [subtitle]="c.ciudad"
          [badges]="badgesDe(c)"
          [rating]="{ score: c.score, label: c.scoreLabel, count: c.numResenas }"
          [price]="{ amount: euros(cfg().price(c)), period: cfg().priceLabel }"
          notaPrecio="IVA incluido"
          [amenities]="serviciosDe(c)"
          [destacados]="incluyeDe(c)"
          [favoritoServicioId]="c.id"
          [routerLink]="enlaceAServicio(cfg().vertical, c.id)"
          ctaLabel="Ver ficha"
          [accionSoloEscritorio]="!!enlaceAServicio(cfg().vertical, c.id)"
          [mensaje]="solicitadoId() === c.id ? cfg().confirmMsg : ''"
          (ctaClick)="solicitar(c)">
        </rs-card>
      }
    </div>

    @if (!mapaAbierto()) {
      <app-experiencias-cerca listadoDespues [ciudad]="busqueda().ciudad" />
    }

    @if (mapaAbierto()) {
      <rs-mapa-buscador listadoMapa #mapaBuscador
        [puntos]="puntosMapa()"
        [cargando]="cargandoMapa()"
        [total]="total()"
        [ariaLabel]="'Mapa de resultados de ' + ui().label"
        (cerrar)="alternarMapa()"
        (zonaBuscada)="buscarEnZona($event)" />
    }
  </rs-listado>
</div>
  `,
  styles: [`
    :host { display: block; }

    /* Selector "¿Qué problema quieres resolver?" (PDF §13) */
    .vb-problema { margin-bottom: var(--sp-6); }
    .vb-problema__titulo {
      font-size: var(--f-sm); font-weight: var(--w-7); color: var(--t-100);
      margin-bottom: var(--sp-3);
    }
    .vb-problema__chips { display: flex; flex-wrap: wrap; gap: var(--sp-2); }
    .vb-problema__nota { margin-top: var(--sp-2); font-size: var(--f-xs); color: var(--t-400); }

    /* La carcasa (cabecera, barra fija, filtros, estados y mapa) vive en
       <rs-listado>; la tarjeta y la rejilla, en styles.scss. Aquí solo queda
       lo que es exclusivo de esta categoría. */
  `],
})
export class VerticalBrowseComponent implements OnInit {
  /** Formato de los importes; la plantilla lo necesita como miembro. */
  protected readonly euros = euros;

  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);
  private readonly browseService = inject(CatalogBrowseService);

  readonly cfg = signal<VerticalConfig>(CONFIGS['veterinaria']);
  readonly ui = signal<VerticalUi>(verticalUi(VerticalKey.VETERINARIA));

  /** Copy de marca del vertical; cae a la etiqueta/descripción si no lo tiene. */
  readonly titular = computed(() => this.ui().titular ?? this.ui().label);
  readonly subtitular = computed(() => this.ui().subtitular ?? this.ui().descripcion);
  readonly cargando = signal(true);
  readonly items = signal<ServicioCard[]>([]);

  // ── Selector de problema en adiestramiento (PDF 27/07 §13) ────────
  readonly problemas = PROBLEMAS_ADIESTRAMIENTO;
  readonly problema = signal<string | null>(null);
  readonly esAdiestramiento = computed(() => this.cfg().vertical === 'adiestramiento');

  elegirProblema(label: string | null): void {
    this.problema.set(this.problema() === label ? null : label);
  }

  /**
   * Resultados con los especialistas del problema elegido delante. Es una
   * reordenación, no un filtro: quien no declara esa especialidad sigue
   * apareciendo debajo, porque no declararla no significa no saber tratarla.
   * El orden relativo original se conserva dentro de cada grupo.
   */
  readonly itemsOrdenados = computed(() => {
    const elegido = this.problema();
    const lista = this.items();
    if (!elegido || !this.esAdiestramiento()) return lista;

    const tipos = PROBLEMAS_ADIESTRAMIENTO.find((p) => p.label === elegido)?.tipos ?? [];
    const especialista = (c: ServicioCard): boolean => {
      const declarados = (c.extra['tiposAdiestramiento'] as string[] | undefined) ?? [];
      return declarados.some((d) => tipos.includes(d));
    };

    return [...lista.filter(especialista), ...lista.filter((c) => !especialista(c))];
  });
  readonly error = signal(false);
  readonly solicitadoId = signal<string | null>(null);

  // ── Filtros, facetas y mapa (mismo esqueleto que alojamiento) ──────
  readonly total = signal(0);
  readonly pagina = signal(1);
  readonly cargandoMas = signal(false);
  /** Quedan resultados que el API tiene y la lista todavía no ha traído. */
  readonly hayMas = computed(() => this.items().length < this.total());
  readonly facetas = signal<FacetasCatalogo | null>(null);
  readonly histogramaPrecios = computed<BarraHistograma[]>(() => this.facetas()?.precios ?? []);
  private readonly filtros = signal<FiltrosSeleccionados>({ vertical: {} });

  readonly mapaAbierto = signal(false);
  /**
   * Enlace a la ficha del servicio.
   *
   * Sale de `verticales.config`, que es donde se sabe qué categorías tienen
   * ficha. Este componente llevaba su propia lista (`tieneFicha`), y al añadir
   * las fichas de veterinaria y peluquería se actualizó la del config pero no
   * ésta: las tarjetas se quedaron sin enlace y no había forma de entrar al
   * detalle de esos comercios.
   */
  readonly enlaceAServicio = enlaceAServicio;

  readonly cargandoMapa = signal(false);
  private readonly puntos = signal<PuntoServicio[]>([]);
  private readonly zona = signal<ZonaBusqueda | null>(null);
  private readonly mapaBuscador = viewChild<RsMapaBuscadorComponent>('mapaBuscador');

  readonly puntosMapa = computed<PuntoMapa[]>(() =>
    this.puntos().map((p) => ({
      id: p.id, lat: p.lat, lng: p.lng,
      etiqueta: euros(p.precio), vertical: this.cfg().vertical,
      titulo: p.titulo, imagen: p.imagen, rating: p.rating,
    })),
  );

  // ── Orden. El API ya lo aceptaba; faltaba pedirlo desde la interfaz. ──
  readonly orden = signal<OrdenServicios>('relevancia');

  cambiarOrden(valor: string): void {
    this.orden.set(valor as OrdenServicios);
    void this.cargar();
  }

  /** Reintento explícito desde el estado de error. */
  recargar(): void {
    void this.cargar();
  }

  aplicarFiltros(seleccion: FiltrosSeleccionados): void {
    this.filtros.set(seleccion);
    void this.cargar();
  }

  alternarMapa(): void {
    const abierto = !this.mapaAbierto();
    this.mapaAbierto.set(abierto);

    if (!abierto) {
      // Cerrar el mapa devuelve la búsqueda a la ciudad escrita: dejar activa
      // una zona invisible haría que los filtros no cuadrasen con nada.
      if (this.zona()) {
        this.zona.set(null);
        void this.cargar();
      }
      return;
    }
    // Leaflet mide el contenedor al crearse y el panel acaba de aparecer.
    setTimeout(() => this.mapaBuscador()?.refrescar(), 0);
  }

  buscarEnZona(zona: ZonaMapa): Promise<void> {
    this.zona.set({
      swLat: zona.swLat, swLng: zona.swLng, neLat: zona.neLat, neLng: zona.neLng,
    });
    return this.cargar();
  }

  /** Búsqueda activa, leída de la URL (fuente de verdad compartida). */
  /** Pública: la lee también el carrusel de experiencias de la comunidad. */
  readonly busqueda = signal<Busqueda>({});

  /**
   * Resume lo que el usuario pidió (fecha, hora, mascota) junto al recuento:
   * sin esto, al quitarse el botón "Buscar" no queda ninguna confirmación
   * visible de que la búsqueda se aplicó.
   */
  readonly contextoBusqueda = computed(() => {
    const { desde, hora, perros, perroId } = this.busqueda();
    const chips: string[] = [];
    if (desde) chips.push(desde);
    if (hora) chips.push(hora);
    // `perros` llegaba en la URL y no se reflejaba en ningun sitio: quien
    // buscaba para dos perros no tenia forma de saber si se habia aplicado.
    const n = Number(perros);
    if (Number.isFinite(n) && n > 0) chips.push(`${n} ${n === 1 ? 'perro' : 'perros'}`);
    if (perroId) chips.push('Compatible con tu mascota');
    return chips;
  });

  readonly sufijoCiudad = computed(() => {
    const ciudad = this.busqueda().ciudad;
    return ciudad ? ` en ${ciudad}` : '';
  });

  ngOnInit(): void {
    const vertical = (this.route.snapshot.data['vertical'] as string) ?? VerticalKey.VETERINARIA;
    this.cfg.set(CONFIGS[vertical] ?? CONFIGS['veterinaria']);
    this.ui.set(verticalUi(vertical));

    // La URL manda: cada búsqueda del buscador recarga el listado.
    this.route.queryParams.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((params) => {
      this.busqueda.set({
        ciudad: params['ciudad'] || undefined,
        desde: params['desde'] || undefined,
        hora: params['hora'] || undefined,
        perros: params['perros'] || undefined,
        perroId: (params['perroIds'] ?? '').split(',').filter(Boolean)[0] || undefined,
      });
      void this.cargar();
    });
  }

  /** Parámetros de la búsqueda actual, comunes a la lista y al mapa. */
  private opcionesActuales(): OpcionesBusqueda {
    const filtros = this.filtros();
    const zona = this.zona();
    return {
      // Con el mapa acotando la zona la ciudad sobra: el usuario ya ha dicho
      // por dónde quiere buscar arrastrando el mapa hasta ahí.
      ciudad: zona ? undefined : this.busqueda().ciudad,
      zona: zona ?? undefined,
      perroId: this.busqueda().perroId,
      orden: this.orden(),
      precioMin: filtros.precioMin,
      precioMax: filtros.precioMax,
      ratingMin: filtros.ratingMin,
      amenities: filtros.amenities,
      filtrosVertical: filtros.vertical,
    };
  }

  private async cargar(): Promise<void> {
    this.cargando.set(true);
    this.error.set(false);
    this.solicitadoId.set(null);
    this.pagina.set(1);

    const opciones = this.opcionesActuales();

    try {
      // Datos reales del catálogo: nunca mocks, para no ofrecer servicios
      // inexistentes que romperían la reserva.
      const res = await this.browseService.buscarPaginado(this.cfg().vertical, opciones);
      this.items.set(res.items);
      this.total.set(res.total);
      void this.cargarFacetas();
      void this.cargarPuntosMapa(opciones);
    } catch {
      this.items.set([]);
      this.total.set(0);
      this.error.set(true);
    } finally {
      this.cargando.set(false);
    }
  }

  /**
   * Página siguiente, añadida al final de la lista. Antes el listado pedía 20
   * resultados y ahí se quedaba: el recuento decía 43 y no había forma de
   * llegar a los 23 restantes.
   */
  async verMas(): Promise<void> {
    if (this.cargandoMas() || !this.hayMas()) return;

    this.cargandoMas.set(true);
    const siguiente = this.pagina() + 1;
    try {
      const res = await this.browseService.buscarPaginado(this.cfg().vertical, {
        ...this.opcionesActuales(),
        page: siguiente,
      });
      // Los ids repetidos se descartan: si algo cambió de posición entre dos
      // peticiones, es preferible perder un resultado a pintarlo dos veces.
      const vistos = new Set(this.items().map((i) => i.id));
      this.items.update((lista) => [...lista, ...res.items.filter((i) => !vistos.has(i.id))]);
      this.total.set(res.total);
      this.pagina.set(siguiente);
    } catch {
      // Un fallo al ampliar no invalida lo que ya se está viendo.
    } finally {
      this.cargandoMas.set(false);
    }
  }

  /**
   * Contadores e histograma del panel de filtros. Van aparte de la búsqueda: si
   * fallan, los filtros siguen funcionando y solo se quedan sin número al lado,
   * que es preferible a romper el listado.
   */
  private async cargarFacetas(): Promise<void> {
    try {
      this.facetas.set(await this.browseService.facetas(this.cfg().vertical, this.busqueda().ciudad));
    } catch {
      this.facetas.set(null);
    }
  }

  /** Pines del mapa; si fallan, la lista sigue siendo perfectamente usable. */
  private async cargarPuntosMapa(opciones: OpcionesBusqueda): Promise<void> {
    this.cargandoMapa.set(true);
    try {
      this.puntos.set(await this.browseService.puntosMapa(this.cfg().vertical, opciones));
    } catch {
      this.puntos.set([]);
    } finally {
      this.cargandoMapa.set(false);
    }
  }

  /**
   * Etiquetas de la tarjeta. El texto lo sigue decidiendo cada vertical en su
   * `meta()`, pero el icono se resuelve con el mapeo común para que la misma
   * etiqueta se vea igual aquí que en alojamiento o transporte. El recorte a
   * tres lo aplica `<rs-card>`.
   */
  serviciosDe(c: ServicioCard): CardAmenity[] {
    return conIconos(this.cfg().meta(c));
  }

  /** Lo que incluye la reserva; comun a las categorias que no declaran el suyo. */
  incluyeDe(c: ServicioCard): string[] {
    return (this.cfg().incluye ?? incluyeComun)(c);
  }

  /** Badges de la tarjeta unificada (HU-3.1/HU-3.2): categoría + automáticos por datos reales. */
  badgesDe(c: ServicioCard): CardBadge[] {
    const badges: CardBadge[] = [];
    const categoria = this.cfg().badge(c);
    if (categoria) badges.push({ label: categoria });
    if (c.destacado) badges.push({ icon: 'crown', label: 'Premium', variant: 'warning' });
    badges.push(...calcularBadgesAutomaticos({
      score: c.score, numResenas: c.numResenas, alphaAdherido: c.alphaAdherido,
    }));
    return badges;
  }

  solicitar(c: ServicioCard): void {
    const { desde, perros } = this.busqueda();
    void this.router.navigate(
      ['/reservas', this.cfg().vertical, c.id],
      {
        queryParams: {
          comercioId: c.comercioId ?? '',
          nombre:     c.nombre,
          precioBase: this.cfg().price(c),
          imagen:     c.imagenes?.[0] ?? '',
          // Continuidad: la fecha y las mascotas buscadas prellenan la reserva.
          desde:      desde ?? null,
          perros:     perros ?? null,
        },
      },
    );
  }
}
