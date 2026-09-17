import { Component, HostListener, OnInit, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { RsNavbarComponent } from '../../shared/components/navbar/rs-navbar.component';
import { RsIconComponent } from '../../shared/components/icon/rs-icon.component';
import { ImgFallbackDirective } from '../../shared/directives/img-fallback.directive';
import { TraducirPipe } from '../../core/i18n/traducir.pipe';
import { descargarFichero } from '../../shared/exportacion/descarga';
import { nombreInforme } from '../../shared/exportacion/descargar-archivo';
import { PerroFichaComponent } from './perro-ficha.component';
import {
  PerrosService, PerroApi, IndiceComportamientoApi, IndiceBienestarApi,
  porcentajeCompletitud,
} from './perros.service';

/** Etiqueta de estado de la ficha: icono Lucide + variante del badge (TCK-8010). */
interface EtiquetaEstado {
  readonly icon: string;
  readonly variante: 'success' | 'warning';
  readonly label: string;
}

/**
 * Tarjeta de acceso del pie de la página. `tab` abre la pestaña concreta de la
 * ficha; los accesos que no son de la mascota lo dejan a null.
 */
interface AccesoRapido {
  readonly icono: string;
  readonly tono: 'azul' | 'rosa' | 'oro';
  readonly titulo: string;
  readonly texto: string;
  readonly ruta: readonly string[];
  readonly tab: string | null;
}

/**
 * "Mis mascotas": el punto de entrada del cliente a las fichas de sus animales.
 *
 * Con una sola mascota la página **no** enseña una tarjeta-resumen que obligue a
 * un clic más: monta directamente su ficha completa, que es lo único que ese
 * cliente puede querer ver aquí. La tarjeta-resumen sólo tiene sentido cuando
 * hay varias y hace falta elegir.
 */
@Component({
  selector: 'app-perros-lista',
  standalone: true,
  imports: [
    TraducirPipe, RouterLink, RsNavbarComponent, RsIconComponent, ImgFallbackDirective,
    PerroFichaComponent,
  ],
  template: `
<div class="dk-pagina">
  <rs-navbar />

  <div class="rs-wrap mascotas">
    <header class="cabecera">
      <div>
        <h1 class="cabecera__titulo">{{ 'Mis mascotas' | t }}</h1>
        <p class="cabecera__sub">{{ 'Crea una ficha para cada mascota y úsala automáticamente en tus reservas.' | t }}</p>
      </div>
      <div class="cabecera__acciones">
        @if (unica(); as u) {
          <div class="menu" (click)="$event.stopPropagation()">
            <button type="button" class="menu__boton" [attr.aria-label]="'Más opciones' | t"
                    [attr.aria-expanded]="menuAbierto() === u._id" (click)="alternarMenu(u._id)">
              <rs-icon name="more-horizontal" [size]="18" [stroke]="2"></rs-icon>
            </button>
            @if (menuAbierto() === u._id) {
              <div class="menu__panel" role="menu">
                <a [routerLink]="['/perros', u._id, 'editar']" role="menuitem" (click)="menuAbierto.set(null)">
                  <rs-icon name="pencil" [size]="15" [stroke]="2"></rs-icon> {{ 'Editar ficha' | t }}
                </a>
                <a [routerLink]="['/perros', u._id, 'privacidad']" role="menuitem" (click)="menuAbierto.set(null)">
                  <rs-icon name="lock" [size]="15" [stroke]="2"></rs-icon> {{ 'Privacidad' | t }}
                </a>
                <button type="button" role="menuitem" [disabled]="descargandoId() === u._id" (click)="descargarInforme(u)">
                  <rs-icon name="download" [size]="15" [stroke]="2"></rs-icon>
                  {{ (descargandoId() === u._id ? 'Preparando…' : 'Informe PDF') | t }}
                </button>
                <button type="button" role="menuitem" class="menu__peligro"
                        [disabled]="eliminandoId() === u._id" (click)="eliminar(u)">
                  <rs-icon name="trash" [size]="15" [stroke]="2"></rs-icon>
                  {{ (eliminandoId() === u._id ? 'Eliminando…' : 'Eliminar') | t }}
                </button>
              </div>
            }
          </div>
        }
        <a routerLink="/perros/nuevo" class="rs-btn rs-btn--primary">
          <rs-icon name="plus" [size]="16" [stroke]="2.5"></rs-icon>
          {{ 'Añadir mascota' | t }}
        </a>
      </div>
    </header>

    @if (errorMsg()) {
      <div class="rs-alert rs-alert--error" style="margin-bottom:var(--sp-5)">{{ errorMsg() }}</div>
    }

    @if (cargando()) {
      <div class="rs-card cargando"><span class="rs-spinner"></span> {{ 'Cargando…' | t }}</div>
    } @else if (perros().length === 0) {
      <div class="vacio">
        <span class="vacio__icono"><rs-icon name="paw" [size]="30" [stroke]="1.5"></rs-icon></span>
        <p>{{ 'Aún no has registrado ninguna mascota.' | t }}</p>
        <a routerLink="/perros/nuevo" class="rs-btn rs-btn--primary rs-btn--sm">{{ 'Registrar mi primera mascota' | t }}</a>
      </div>
    } @else if (unica(); as u) {
      <app-perro-ficha [perroId]="u._id" [embebida]="true" />
    } @else {
      <div class="mascotas-grid">
        @for (p of perros(); track p._id) {
          <article class="mascota">
            <div class="mascota__foto">
              @if (p.fotos.length) {
                <img [src]="p.fotos[0]" [alt]="p.nombre" rsImg />
              } @else {
                <rs-icon name="paw" [size]="40" [stroke]="1.5"></rs-icon>
              }
              <span class="mascota__sello" aria-hidden="true"><rs-icon name="heart" [size]="13" [stroke]="2"></rs-icon></span>
            </div>

            <div class="mascota__info">
              <div class="mascota__titular">
                <h2><a [routerLink]="['/perros', p._id]">{{ p.nombre }}</a></h2>
                <div class="menu" (click)="$event.stopPropagation()">
                  <button type="button" class="menu__boton" [attr.aria-label]="'Más opciones' | t"
                          [attr.aria-expanded]="menuAbierto() === p._id" (click)="alternarMenu(p._id)">
                    <rs-icon name="more-horizontal" [size]="18" [stroke]="2"></rs-icon>
                  </button>
                  @if (menuAbierto() === p._id) {
                    <div class="menu__panel" role="menu">
                      <a [routerLink]="['/perros', p._id, 'editar']" role="menuitem" (click)="menuAbierto.set(null)">
                        <rs-icon name="pencil" [size]="15" [stroke]="2"></rs-icon> {{ 'Editar ficha' | t }}
                      </a>
                      <a [routerLink]="['/perros', p._id, 'privacidad']" role="menuitem" (click)="menuAbierto.set(null)">
                        <rs-icon name="lock" [size]="15" [stroke]="2"></rs-icon> {{ 'Privacidad' | t }}
                      </a>
                      <button type="button" role="menuitem" [disabled]="descargandoId() === p._id" (click)="descargarInforme(p)">
                        <rs-icon name="download" [size]="15" [stroke]="2"></rs-icon>
                        {{ (descargandoId() === p._id ? 'Preparando…' : 'Informe PDF') | t }}
                      </button>
                      <button type="button" role="menuitem" class="menu__peligro"
                              [disabled]="eliminandoId() === p._id" (click)="eliminar(p)">
                        <rs-icon name="trash" [size]="15" [stroke]="2"></rs-icon>
                        {{ (eliminandoId() === p._id ? 'Eliminando…' : 'Eliminar') | t }}
                      </button>
                    </div>
                  }
                </div>
              </div>

              <p class="mascota__linea">
                {{ p.raza || ('Mestizo' | t) }}
                @if (p.sexo) { · {{ (p.sexo === 'macho' ? 'Macho' : 'Hembra') | t }} }
                @if (edadDe(p); as e) { · {{ e }} }
              </p>

              @if (p.peso || p.tamano) {
                <p class="mascota__dato">
                  <rs-icon name="scale" [size]="14" [stroke]="2"></rs-icon>
                  @if (p.peso) { {{ p.peso }} kg }
                  @if (p.peso && p.tamano) { · }
                  @if (p.tamano) { {{ 'Tamaño' | t }} {{ p.tamano }} }
                </p>
              }
              @if (p.ciudad) {
                <p class="mascota__dato">
                  <rs-icon name="map-pin" [size]="14" [stroke]="2"></rs-icon> {{ p.ciudad }}
                </p>
              }

              <div class="mascota__badges">
                @for (t of etiquetasEstado(p); track t.label) {
                  <span class="rs-badge" [class]="'rs-badge--' + t.variante">
                    <rs-icon [name]="t.icon" [size]="13" [stroke]="2.5"></rs-icon> {{ t.label | t }}
                  </span>
                }
                @if (p.temperamento) { <span class="rs-badge rs-badge--neutral">{{ p.temperamento }}</span> }
                @if (indices()[p._id]?.totalValoraciones) {
                  <span class="rs-badge rs-badge--success">
                    <rs-icon name="star" [size]="13" [stroke]="2.5"></rs-icon>
                    {{ indices()[p._id].puntuacionPromedio }} ({{ indices()[p._id].totalValoraciones }})
                  </span>
                }
                @if (p.nivelDoogking) {
                  <span class="rs-badge rs-badge--accent">
                    <rs-icon name="graduation-cap" [size]="13" [stroke]="2"></rs-icon>
                    Nivel Doogking {{ p.nivelDoogking }}/5
                  </span>
                }
                @if (bienestar()[p._id]; as ib) {
                  <span class="rs-badge" [class]="'rs-badge--' + varianteBienestar(ib.nivel)">
                    <rs-icon [name]="iconoBienestar(ib.nivel)" [size]="13" [stroke]="2.5"></rs-icon>
                    Bienestar {{ ib.puntuacion }}/100
                  </span>
                }
              </div>
            </div>

            <div class="mascota__acciones">
              <a [routerLink]="['/perros', p._id]" class="rs-btn rs-btn--primary rs-btn--block">
                {{ 'Ver ficha' | t }} <rs-icon name="arrow-right" [size]="15" [stroke]="2"></rs-icon>
              </a>
              <a routerLink="/buscador" class="rs-btn rs-btn--outline rs-btn--block">
                <rs-icon name="calendar" [size]="15" [stroke]="2"></rs-icon> {{ 'Reservar servicio' | t }}
              </a>
            </div>

            <div class="completitud">
              <p class="completitud__cifra">
                {{ 'Ficha completada al {pct} %' | t: { pct: porcentajeCompletitud(p) } }}
              </p>
              <div class="completitud__barra"><div [style.width.%]="porcentajeCompletitud(p)"></div></div>
              @if (porcentajeCompletitud(p) < 100) {
                <small>{{ 'Completa los datos veterinarios para reservar todos los servicios.' | t }}</small>
              }
            </div>
          </article>
        }

        <a routerLink="/perros/nuevo" class="anadir">
          <span class="anadir__icono"><rs-icon name="paw" [size]="26" [stroke]="1.75"></rs-icon></span>
          <span class="anadir__texto">
            <rs-icon name="plus" [size]="15" [stroke]="2.5"></rs-icon> {{ 'Añadir otra mascota' | t }}
          </span>
        </a>
      </div>
    }

    @if (accesos().length) {
      <div class="accesos">
        @for (a of accesos(); track a.titulo) {
          <a class="acceso" [routerLink]="a.ruta" [queryParams]="a.tab ? { tab: a.tab } : null">
            <span class="acceso__icono" [class]="'acceso__icono--' + a.tono">
              <rs-icon [name]="a.icono" [size]="18" [stroke]="2"></rs-icon>
            </span>
            <span class="acceso__texto">
              <strong>{{ a.titulo | t }}</strong>
              <small>{{ a.texto | t }}</small>
            </span>
            <rs-icon name="chevron-right" [size]="16" [stroke]="2" class="acceso__ir"></rs-icon>
          </a>
        }
      </div>
    }
  </div>
</div>
  `,
  styles: [`
    .mascotas { padding-block: var(--sp-10) var(--sp-16); }

    .cabecera { display: flex; justify-content: space-between; align-items: flex-start; gap: var(--sp-4); flex-wrap: wrap; margin-bottom: var(--sp-8); }
    .cabecera__titulo { font-family: var(--font-display); font-size: var(--f-3xl); font-weight: var(--w-8); color: var(--t-100); margin-bottom: var(--sp-2); }
    .cabecera__sub { color: var(--t-400); font-size: var(--f-base); max-width: 560px; }
    .cabecera__acciones { display: flex; align-items: center; gap: var(--sp-2); }

    .cargando { padding: var(--sp-16); display: flex; justify-content: center; align-items: center; gap: var(--sp-3); color: var(--t-400); }

    /* ══ Menú de acciones (el "…" de la tarjeta del diseño) ══════════ */
    .menu { position: relative; }
    .menu__boton {
      width: 34px; height: 34px; border-radius: var(--r-full); border: 1px solid transparent;
      background: transparent; color: var(--t-400); display: flex; align-items: center; justify-content: center;
      cursor: pointer; transition: background var(--d-2), color var(--d-2);
    }
    .menu__boton:hover { background: var(--c-raised); color: var(--t-100); }
    .menu__panel {
      position: absolute; top: calc(100% + var(--sp-2)); right: 0; z-index: 20;
      min-width: 190px; padding: var(--sp-2); display: grid; gap: 2px;
      background: var(--c-card); border: 1px solid var(--b-1); border-radius: var(--r-lg); box-shadow: var(--sh-lg);

      a, button {
        display: flex; align-items: center; gap: var(--sp-2); width: 100%;
        padding: var(--sp-2) var(--sp-3); border: 0; border-radius: var(--r-md);
        background: transparent; color: var(--t-200); font: inherit; font-size: var(--f-sm);
        text-align: left; text-decoration: none; cursor: pointer;
      }
      a:hover, button:hover:not(:disabled) { background: var(--c-accent-lo); color: var(--c-accent); }
      button:disabled { color: var(--t-500); cursor: default; }
    }
    .menu__peligro { color: var(--c-error) !important; }
    .menu__peligro:hover:not(:disabled) { background: var(--c-error-lo) !important; }

    /* ══ Tarjeta de mascota ═════════════════════════════════════════ */
    .mascotas-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(min(620px, 100%), 1fr)); gap: var(--sp-5); align-items: stretch; }

    .mascota {
      display: grid; grid-template-columns: auto minmax(0, 1fr) auto;
      gap: var(--sp-2) var(--sp-5); align-items: start;
      padding: var(--sp-6); background: var(--c-card);
      border: 1px solid var(--b-1); border-radius: var(--r-2xl); box-shadow: var(--sh-card);
    }
    .mascota__foto {
      position: relative; width: 132px; height: 132px; border-radius: var(--r-full); overflow: visible;
      background: var(--c-raised); color: var(--t-300); display: flex; align-items: center; justify-content: center;
      img { width: 100%; height: 100%; border-radius: var(--r-full); object-fit: cover; }
    }
    /* Guiño del diseño: el corazón asoma en el borde del retrato. */
    .mascota__sello {
      position: absolute; left: 2px; bottom: 6px; width: 30px; height: 30px; border-radius: var(--r-full);
      background: var(--c-card); color: var(--dk-gold); box-shadow: var(--sh-sm);
      display: flex; align-items: center; justify-content: center;
    }
    .mascota__info { min-width: 0; }
    .mascota__titular { display: flex; align-items: flex-start; justify-content: space-between; gap: var(--sp-2); }
    .mascota__titular h2 { font-family: var(--font-display); font-size: var(--f-xl); font-weight: var(--w-8); color: var(--t-100); line-height: 1.2; }
    .mascota__titular a { color: inherit; text-decoration: none; &:hover { color: var(--c-accent); } }
    .mascota__linea { font-size: var(--f-sm); color: var(--t-400); margin-top: 2px; }
    .mascota__dato { display: flex; align-items: center; gap: var(--sp-2); font-size: var(--f-sm); color: var(--t-400); margin-top: var(--sp-2); }
    .mascota__badges { display: flex; gap: var(--sp-2); flex-wrap: wrap; margin-top: var(--sp-3); }
    .mascota__acciones { display: grid; align-self: center; gap: var(--sp-2); min-width: 190px; }

    .completitud { grid-column: 2 / -1; margin-top: var(--sp-4); }
    .completitud__cifra { font-size: var(--f-sm); font-weight: var(--w-6); color: var(--t-200); margin-bottom: var(--sp-2); }
    .completitud__barra { height: 8px; border-radius: var(--r-full); background: var(--c-raised); overflow: hidden; }
    .completitud__barra div { height: 100%; border-radius: var(--r-full); background: var(--g-warm); transition: width var(--d-3); }
    .completitud small { display: block; margin-top: var(--sp-2); font-size: var(--f-xs); color: var(--t-400); }

    /* ══ Tarjetas punteadas: añadir mascota y estado vacío ══════════ */
    .anadir, .vacio {
      display: flex; align-items: center; justify-content: center; gap: var(--sp-4);
      text-align: center; text-decoration: none;
      border: 2px dashed var(--b-2); border-radius: var(--r-2xl); background: var(--c-card);
      color: var(--t-400); transition: border-color var(--d-2), background var(--d-2);
    }
    /* Una franja, no una tarjeta del alto de una mascota: lo que se añade aquí
       no compite con las fichas, las cierra. */
    .anadir { padding: var(--sp-6); align-self: start; }
    .anadir:hover { border-color: var(--c-accent); background: var(--c-accent-lo); }
    .vacio { flex-direction: column; padding: var(--sp-16) var(--sp-10); gap: var(--sp-4); }
    .anadir__icono, .vacio__icono {
      flex: none; width: 56px; height: 56px; border-radius: var(--r-full); background: var(--c-accent-lo); color: var(--c-accent);
      display: flex; align-items: center; justify-content: center;
    }
    .anadir__texto { display: inline-flex; align-items: center; gap: var(--sp-2); font-size: var(--f-base); font-weight: var(--w-6); color: var(--c-accent); }
    .vacio p { font-size: var(--f-md); }

    /* ══ Accesos del pie ════════════════════════════════════════════ */
    .accesos { display: grid; grid-template-columns: repeat(auto-fit, minmax(min(230px, 100%), 1fr)); gap: var(--sp-4); margin-top: var(--sp-6); }
    .acceso {
      display: grid; grid-template-columns: auto minmax(0, 1fr) auto; align-items: center; gap: var(--sp-3);
      padding: var(--sp-4) var(--sp-5); text-decoration: none;
      background: var(--c-card); border: 1px solid var(--b-1); border-radius: var(--r-xl); box-shadow: var(--sh-card);
      transition: transform var(--d-2), box-shadow var(--d-2);
    }
    .acceso:hover { transform: translateY(-2px); box-shadow: var(--sh-lg); }
    .acceso__icono { width: 40px; height: 40px; border-radius: var(--r-md); display: flex; align-items: center; justify-content: center; }
    .acceso__icono--azul { background: var(--c-accent-lo); color: var(--c-accent); }
    .acceso__icono--rosa { background: var(--c-error-lo); color: var(--c-error); }
    .acceso__icono--oro  { background: var(--dk-gold-lo); color: var(--dk-gold-text); }
    .acceso__texto { display: grid; gap: 2px; min-width: 0; }
    .acceso__texto strong { font-size: var(--f-base); font-weight: var(--w-7); color: var(--t-100); }
    .acceso__texto small { font-size: var(--f-xs); color: var(--t-400); }
    .acceso__ir { color: var(--t-500); }

    @media (max-width: 720px) {
      /* En móvil la tarjeta se apila: el retrato encabeza y los botones cierran. */
      .mascota { grid-template-columns: 1fr; justify-items: center; text-align: center; }
      .mascota__titular { justify-content: center; }
      .mascota__dato { justify-content: center; }
      .mascota__badges { justify-content: center; }
      .mascota__acciones { width: 100%; }
      .completitud { grid-column: 1; width: 100%; text-align: left; }
    }
  `],
})
export class PerrosListaComponent implements OnInit {
  private readonly perrosService = inject(PerrosService);

  readonly cargando = signal(true);
  readonly errorMsg = signal('');
  readonly perros = signal<PerroApi[]>([]);
  readonly eliminandoId = signal<string | null>(null);
  readonly indices = signal<Record<string, IndiceComportamientoApi>>({});
  readonly bienestar = signal<Record<string, IndiceBienestarApi>>({});
  readonly porcentajeCompletitud = porcentajeCompletitud;

  /** Ficha cuyo informe se está preparando; el PDF se arma en el servidor. */
  readonly descargandoId = signal<string | null>(null);

  /** Menú "…" abierto, identificado por la mascota a la que pertenece. */
  readonly menuAbierto = signal<string | null>(null);

  /** La única mascota del cliente, o null si tiene varias (o ninguna). */
  readonly unica = computed<PerroApi | null>(() => {
    const perros = this.perros();
    return perros.length === 1 ? perros[0] : null;
  });

  /**
   * Accesos del pie. Dos llevan a una pestaña de la ficha, así que sólo se
   * ofrecen cuando está claro de qué mascota se habla: con varias, cada tarjeta
   * ya lleva a la suya.
   */
  readonly accesos = computed<AccesoRapido[]>(() => {
    const unica = this.unica();
    if (!unica) return [];
    return [
      { icono: 'calendar', tono: 'azul', ruta: ['/reservas'], tab: null,
        titulo: 'Próximas reservas', texto: 'Consulta y gestiona tus servicios reservados.' },
      { icono: 'heart', tono: 'rosa', ruta: ['/perros', unica._id], tab: 'salud',
        titulo: 'Recordatorios de salud', texto: 'Vacunas, revisiones y tratamientos al día.' },
      { icono: 'file-text', tono: 'azul', ruta: ['/perros', unica._id], tab: 'documentos',
        titulo: 'Documentos y vacunas', texto: 'Guarda y accede a toda su documentación.' },
      { icono: 'star', tono: 'oro', ruta: ['/buscador'], tab: null,
        titulo: 'Servicios recomendados', texto: 'Descubre servicios pensados para su bienestar.' },
    ];
  });

  async ngOnInit(): Promise<void> {
    try {
      const perros = await this.perrosService.misPerros();
      this.perros.set(perros);
      // Con una sola mascota manda su ficha completa, que trae sus propios
      // índices: pedirlos aquí serían dos llamadas que nadie llega a ver.
      if (perros.length > 1) {
        await this.cargarIndices(perros);
        await this.cargarBienestar(perros);
      }
    } catch {
      this.errorMsg.set('No se pudieron cargar tus mascotas. Verifica que el API esté activo.');
    } finally {
      this.cargando.set(false);
    }
  }

  private async cargarIndices(perros: PerroApi[]): Promise<void> {
    const entradas = await Promise.all(
      perros.map(async (p) => [p._id, await this.perrosService.indiceComportamiento(p._id).catch(() => null)] as const),
    );
    const mapa: Record<string, IndiceComportamientoApi> = {};
    for (const [id, indice] of entradas) {
      if (indice) mapa[id] = indice;
    }
    this.indices.set(mapa);
  }

  /** Índice de Bienestar (HU-8.1.7): cuidado preventivo, no un juicio al propietario. */
  private async cargarBienestar(perros: PerroApi[]): Promise<void> {
    const entradas = await Promise.all(
      perros.map(async (p) => [p._id, await this.perrosService.bienestar(p._id).catch(() => null)] as const),
    );
    const mapa: Record<string, IndiceBienestarApi> = {};
    for (const [id, indice] of entradas) {
      if (indice) mapa[id] = indice;
    }
    this.bienestar.set(mapa);
  }

  alternarMenu(id: string): void {
    this.menuAbierto.update((abierto) => (abierto === id ? null : id));
  }

  /** Cierra el menú "…" al hacer clic fuera de él. */
  @HostListener('document:click')
  cerrarMenu(): void {
    this.menuAbierto.set(null);
  }

  /** Icono Lucide del nivel de bienestar; el color lo pone la variante del badge. */
  iconoBienestar(nivel: IndiceBienestarApi['nivel']): string {
    return { inicial: 'circle', bueno: 'trending-up', muy_bueno: 'check-circle', excelente: 'award' }[nivel];
  }

  varianteBienestar(nivel: IndiceBienestarApi['nivel']): 'neutral' | 'warning' | 'success' {
    return { inicial: 'neutral', bueno: 'warning', muy_bueno: 'success', excelente: 'success' }[nivel] as 'neutral' | 'warning' | 'success';
  }

  /** HU-8.1.1: edad legible desde la fecha de nacimiento. */
  edadDe(p: PerroApi): string | null {
    if (!p.fechaNacimiento) return null;
    const nacimiento = new Date(p.fechaNacimiento);
    if (Number.isNaN(nacimiento.getTime())) return null;
    const meses = (Date.now() - nacimiento.getTime()) / (30.44 * 24 * 60 * 60 * 1000);
    if (meses < 12) return `${Math.max(1, Math.round(meses))} meses`;
    return `${Math.floor(meses / 12)} años`;
  }

  /** HU-8.1.1: etiquetas de estado a partir de datos reales, nunca texto manual. */
  etiquetasEstado(p: PerroApi): EtiquetaEstado[] {
    const tags: EtiquetaEstado[] = [];
    if (p.sociabilidadPerros === 'alta') tags.push({ icon: 'users', variante: 'success', label: 'Sociable' });
    if (p.vacunas.length > 0 || (p.vacunasDetalle?.length ?? 0) > 0) {
      tags.push({ icon: 'syringe', variante: 'success', label: 'Vacunada' });
    }
    if (p.esterilizado) tags.push({ icon: 'check-circle', variante: 'success', label: 'Esterilizada' });
    if (p.ansiedadSeparacion || /nervios/i.test(p.temperamento ?? '')) {
      tags.push({ icon: 'alert-triangle', variante: 'warning', label: 'Nerviosa' });
    }
    if (p.microchip) tags.push({ icon: 'radio-tower', variante: 'success', label: 'Microchip' });
    return tags;
  }

  /**
   * Descarga el informe de salud en PDF.
   *
   * Es el documento que el cliente se lleva a otro profesional: la ficha, la
   * salud y todas las anotaciones que le han dejado, no las tres que caben en
   * el resumen de esta pantalla.
   */
  async descargarInforme(p: PerroApi): Promise<void> {
    this.descargandoId.set(p._id);
    this.errorMsg.set('');
    try {
      const pdf = await this.perrosService.informePdf(p._id);
      descargarFichero(pdf, nombreInforme(p.nombre));
    } catch {
      this.errorMsg.set('No se pudo preparar el informe. Inténtalo de nuevo.');
    } finally {
      this.descargandoId.set(null);
      this.menuAbierto.set(null);
    }
  }

  async eliminar(p: PerroApi): Promise<void> {
    if (!confirm(`¿Eliminar la ficha de ${p.nombre}? Esta acción no se puede deshacer.`)) return;
    this.eliminandoId.set(p._id);
    try {
      await this.perrosService.eliminar(p._id);
      this.perros.update((lista) => lista.filter((x) => x._id !== p._id));
    } catch {
      this.errorMsg.set('No se pudo eliminar la mascota. Inténtalo de nuevo.');
    } finally {
      this.eliminandoId.set(null);
      this.menuAbierto.set(null);
    }
  }
}
