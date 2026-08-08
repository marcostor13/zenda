import { Component, DestroyRef, OnInit, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router } from '@angular/router';
import { VerticalKey } from 'shared';
import { RsNavbarComponent } from '../../shared/components/navbar/rs-navbar.component';
import { RsSearchBarComponent } from '../../shared/components/search-bar/rs-search-bar.component';
import { RsIconComponent } from '../../shared/components/icon/rs-icon.component';
import { AnimateOnScrollDirective } from '../../shared/directives/animate-on-scroll.directive';
import { RsCardComponent, type CardBadge } from '../../shared/components/card/rs-card.component';
import { RsChipComponent } from '../../shared/components/chip/rs-chip.component';
import { ExperienciasCercaComponent } from '../explora/experiencias-cerca.component';
import { VerticalUi, verticalUi } from '../../shared/verticales/verticales.config';
import { CatalogBrowseService, ServicioCard } from './catalog-browse.service';
import { calcularBadgesAutomaticos } from '../../shared/badges/badges-automaticos';

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
  /** true = la tarjeta enlaza a su ficha de detalle (Fase 4); false = sigue yendo directo a "solicitar". */
  tieneFicha?: boolean;
}

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
      c.extra['atiendeUrgencias'] ? 'Urgencias 24h' : `${(c.extra['horario'] as string) ?? 'Consulta horario'}`,
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
    tieneFicha: true,
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
    tieneFicha: true,
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
  cuidadores: {
    vertical: 'cuidadores',
    cta: 'Reservar visita', priceLabel: 'visita desde',
    confirmMsg: 'Visita solicitada. Continúa al pago para confirmarla.',
    badge: (c) => (c.extra['administraMedicacion'] ? 'Administra medicación' : 'A domicilio'),
    titulo3: (c) => c.nombre,
    loc: (c) => `${c.ciudad}`,
    meta: (c) => [
      `${(c.extra['duracionVisitaMin'] as number | undefined) ?? 45} min por visita`,
      `Hasta ${(c.extra['radioDesplazamientoKm'] as number | undefined) ?? 10} km`,
    ],
    price: (c) => (c.extra['precioVisita'] as number) ?? c.precioPorNoche,
  },
};

@Component({
  selector: 'app-vertical-browse',
  standalone: true,
  imports: [
    RsNavbarComponent, RsSearchBarComponent, RsIconComponent,
    AnimateOnScrollDirective, ExperienciasCercaComponent, RsCardComponent, RsChipComponent,
  ],
  template: `
<div class="vb-page">
  <rs-navbar />

  <!-- Buscador estándar: mismos campos y orden que en el home -->
  <div class="vb-searchbar">
    <div class="rs-wrap">
      <rs-search-bar variant="strip" [vertical]="ui().key" [buscarAlCambiar]="true" />
    </div>
  </div>

  <section class="rs-section rs-section--sm">
    <div class="rs-wrap">
      <header class="vb-head">
        <h1>{{ titular() }}</h1>
        <p>{{ subtitular() }}</p>
      </header>

      <!-- Selector de problema en adiestramiento (PDF 27/07 §13): ordena
           primero a quien declara esa especialidad. -->
      @if (esAdiestramiento()) {
        <div class="vb-problema">
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

      @if (cargando()) {
        <div class="vb-grid">
          @for (_ of [1,2,3]; track $index) {
            <div class="rs-skeleton rs-skeleton--img" style="height:280px;border-radius:var(--r-xl)"></div>
          }
        </div>
      } @else {
        <p class="vb-count">
          {{ itemsOrdenados().length }} {{ itemsOrdenados().length === 1 ? 'resultado' : 'resultados' }}<span class="vb-count__ciudad">{{ sufijoCiudad() }}</span>
          @for (c of contextoBusqueda(); track c) {
            <span class="vb-chip">{{ c }}</span>
          }
        </p>
        <div class="vb-grid">
          @for (c of itemsOrdenados(); track c.id) {
            <rs-card rsAnim
              [imageUrl]="c.imagenes[0]" [imageAlt]="c.nombre"
              [title]="cfg().titulo3(c)" [subtitle]="c.ciudad"
              [badges]="badgesDe(c)"
              [rating]="{ score: c.score, label: c.scoreLabel, count: c.numResenas }"
              [price]="{ amount: '€' + cfg().price(c), period: cfg().priceLabel }"
              [amenities]="cfg().meta(c)"
              [favoritoServicioId]="c.id"
              [routerLink]="cfg().tieneFicha ? [ui().route, c.id] : null"
              [ctaLabel]="cfg().tieneFicha ? 'Ver ficha' : ''"
              [clickable]="false">
              @if (!cfg().tieneFicha) {
              <div cardFooter>
                @if (solicitadoId() === c.id) {
                  <div class="rs-alert rs-alert--success" style="margin-top:var(--sp-4)">{{ cfg().confirmMsg }}</div>
                } @else {
                  <button class="rs-btn rs-btn--primary rs-btn--block" style="margin-top:var(--sp-4)"
                          (click)="solicitar(c)">{{ cfg().cta }}</button>
                }
              </div>
              }
            </rs-card>
          }
          @if (itemsOrdenados().length === 0 && !error()) {
            <div class="vb-empty"><rs-icon name="search" [size]="48" [stroke]="1.5" style="color:var(--t-400)" /><h3>Sin resultados</h3><p>Prueba con otra ciudad.</p></div>
          }
          @if (error()) {
            <div class="vb-empty"><rs-icon name="alert-triangle" [size]="48" [stroke]="1.5" style="color:var(--t-400)" /><h3>No se pudo cargar el catálogo</h3><p>Inténtalo de nuevo en unos momentos.</p></div>
          }
        </div>
      }

      <app-experiencias-cerca [ciudad]="busqueda().ciudad" />
    </div>
  </section>
</div>
  `,
  styles: [`
    :host { display: block; }
    .vb-page { min-height: 100vh; background: var(--c-base); }
    .vb-searchbar {
      position: sticky;
      top: 0;
      z-index: 30;
      background: var(--c-card);
      padding-block: var(--sp-5);
      box-shadow: var(--sh-md);
      border-radius: 0 0 var(--r-lg) var(--r-lg);
    }
    .vb-head { margin-bottom: var(--sp-6); }
    .vb-head h1 { font-size: var(--f-3xl); color: var(--dk-blue); letter-spacing: -.02em; }
    .vb-head p { color: var(--t-400); max-width: 62ch; margin-top: var(--sp-2); font-size: var(--f-md); }
    .vb-count { color: var(--t-400); font-size: var(--f-sm); margin-bottom: var(--sp-5); }

    /* Selector "¿Qué problema quieres resolver?" (PDF §13) */
    .vb-problema { margin-bottom: var(--sp-6); }
    .vb-problema__titulo {
      font-size: var(--f-sm); font-weight: var(--w-7); color: var(--t-100);
      margin-bottom: var(--sp-3);
    }
    .vb-problema__chips { display: flex; flex-wrap: wrap; gap: var(--sp-2); }
    .vb-problema__nota { margin-top: var(--sp-2); font-size: var(--f-xs); color: var(--t-400); }
    .vb-count__ciudad { color: var(--dk-blue); font-weight: var(--w-6); }
    .vb-chip {
      display: inline-block; margin-left: var(--sp-2);
      padding: 2px var(--sp-2); border-radius: var(--r-full);
      background: var(--c-accent-lo); color: var(--dk-blue);
      font-size: var(--f-xs); font-weight: var(--w-6);
    }
    /* La tarjeta (imagen 70-75%, badges, rating, precio) la aporta <rs-card>
       en modo "resultado" (HU-3.1) — ver rs-card.component.ts. */
    .vb-grid { display: grid; grid-template-columns: repeat(3, 1fr); align-items: stretch; gap: var(--sp-5); @media (max-width: 1024px) { grid-template-columns: repeat(2, 1fr); } @media (max-width: 640px) { grid-template-columns: 1fr; } }
    .vb-empty { grid-column: 1 / -1; text-align: center; padding: var(--sp-20); color: var(--t-400); h3 { color: var(--t-200); margin: var(--sp-4) 0 var(--sp-2); } }
  `],
})
export class VerticalBrowseComponent implements OnInit {
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

  /** Búsqueda activa, leída de la URL (fuente de verdad compartida). */
  /** Pública: la lee también el carrusel de experiencias de la comunidad. */
  readonly busqueda = signal<Busqueda>({});

  /**
   * Resume lo que el usuario pidió (fecha, hora, mascota) junto al recuento:
   * sin esto, al quitarse el botón "Buscar" no queda ninguna confirmación
   * visible de que la búsqueda se aplicó.
   */
  readonly contextoBusqueda = computed(() => {
    const { desde, hora, perroId } = this.busqueda();
    const chips: string[] = [];
    if (desde) chips.push(desde);
    if (hora) chips.push(hora);
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

  private async cargar(): Promise<void> {
    this.cargando.set(true);
    this.error.set(false);
    this.solicitadoId.set(null);
    try {
      // Datos reales del catálogo: nunca mocks, para no ofrecer servicios
      // inexistentes que romperían la reserva.
      this.items.set(await this.browseService.buscar(this.cfg().vertical, {
        ciudad: this.busqueda().ciudad,
        perroId: this.busqueda().perroId,
      }));
    } catch {
      this.items.set([]);
      this.error.set(true);
    } finally {
      this.cargando.set(false);
    }
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
