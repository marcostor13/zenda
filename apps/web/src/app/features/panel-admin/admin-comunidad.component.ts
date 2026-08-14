import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { EstadoModeracion, TIPO_LUGAR_LABELS, TipoLugar } from 'shared';
import { RsIconComponent } from '../../shared/components/icon/rs-icon.component';
import { environment } from '../../../environments/environment';

const TABS_MODERACION: ReadonlyArray<{ estado: EstadoModeracion; label: string }> = [
  { estado: EstadoModeracion.PENDIENTE, label: 'Pendientes' },
  { estado: EstadoModeracion.PUBLICADO, label: 'Publicados' },
  { estado: EstadoModeracion.RECHAZADO, label: 'Rechazados' },
];

interface LugarPendiente {
  _id: string;
  tipo: TipoLugar;
  nombre: string;
  descripcion: string;
  fotos: string[];
  ubicacion: { ciudad: string; provincia?: string };
  createdAt: string;
}

interface ReviewPendiente {
  _id: string;
  lugarId: string;
  usuarioNombre: string;
  puntuacion: number;
  texto: string;
  fotos: string[];
  esIncidencia: boolean;
  createdAt: string;
}

/**
 * Cola de moderación de la comunidad (HU-045). Nada aportado por usuarios se
 * publica sin pasar por aquí: publicar automáticamente expondría a la
 * plataforma a contenido falso, obsoleto o inapropiado.
 */
@Component({
  selector: 'app-admin-comunidad',
  standalone: true,
  imports: [DatePipe, RsIconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
<div class="ac">
  <header class="ac__head">
    <div>
      <h1>Comunidad</h1>
      <p>Revisa y gestiona el contenido compartido por la comunidad de Doogking.</p>
    </div>
    <span class="ac__contador">{{ conteo('pendiente') }} pendientes</span>
  </header>

  <!-- El admin no sólo aprueba: también revisa lo ya resuelto (TCK-8039) -->
  <div class="ac__tabs" role="tablist">
    @for (t of tabs; track t.estado) {
      <button type="button" class="ac__tab" role="tab"
              [attr.aria-selected]="estadoActivo() === t.estado"
              [class.activa]="estadoActivo() === t.estado"
              (click)="cambiarEstado(t.estado)">
        {{ t.label }}
        <span class="ac__tab-num">{{ conteo(t.estado) }}</span>
      </button>
    }
  </div>

  <label class="ac__buscador">
    <rs-icon name="search" [size]="15" [stroke]="2"></rs-icon>
    <input type="search" placeholder="Buscar por título, usuario o ciudad…"
           [value]="busqueda()" (input)="busqueda.set($any($event.target).value)" />
  </label>

  @if (cargando()) {
    <p class="ac__cargando">Cargando la cola de moderación…</p>
  } @else if (!totalVisible()) {
    <div class="ac__vacio">
      <rs-icon name="check-circle" [size]="36" [stroke]="1.5"></rs-icon>
      <p>{{ mensajeVacio() }}</p>
    </div>
  } @else {
    @if (lugaresVisibles().length) {
      <section class="ac__bloque">
        <h2>Sitios ({{ lugaresVisibles().length }})</h2>
        <ul class="ac__lista">
          @for (l of lugaresVisibles(); track l._id) {
            <li class="ac__card">
              <div class="ac__card-cuerpo">
                <span class="ac__tipo">{{ etiquetaTipo(l.tipo) }}</span>
                <strong>{{ l.nombre }}</strong>
                <em>{{ l.ubicacion.ciudad }}@if (l.ubicacion.provincia) { · {{ l.ubicacion.provincia }} } · {{ l.createdAt | date: 'd MMM y' }}</em>
                @if (l.descripcion) { <p>{{ l.descripcion }}</p> }
                @if (l.fotos.length) {
                  <div class="ac__fotos">
                    @for (f of l.fotos.slice(0, 3); track f) {
                      <img [src]="f" alt="" loading="lazy" />
                    }
                  </div>
                }
              </div>
              <div class="ac__acciones">
                <button type="button" class="rs-btn rs-btn--primary rs-btn--sm"
                        [disabled]="procesandoId() === l._id" (click)="moderarLugar(l, true)">
                  Publicar
                </button>
                <button type="button" class="rs-btn rs-btn--ghost rs-btn--sm"
                        [disabled]="procesandoId() === l._id" (click)="moderarLugar(l, false)">
                  Rechazar
                </button>
              </div>
            </li>
          }
        </ul>
      </section>
    }

    @if (reviewsVisibles().length) {
      <section class="ac__bloque">
        <h2>Aportaciones ({{ reviews().length }})</h2>
        <ul class="ac__lista">
          @for (r of reviewsVisibles(); track r._id) {
            <li class="ac__card">
              <div class="ac__card-cuerpo">
                <span class="ac__tipo">
                  {{ r.esIncidencia ? 'Incidencia reportada' : 'Valoración ' + r.puntuacion + '/5' }}
                </span>
                <strong>{{ r.usuarioNombre }}</strong>
                <em>{{ r.createdAt | date: 'd MMM y' }}</em>
                @if (r.texto) { <p>{{ r.texto }}</p> }
              </div>
              <div class="ac__acciones">
                <button type="button" class="rs-btn rs-btn--primary rs-btn--sm"
                        [disabled]="procesandoId() === r._id" (click)="moderarReview(r, true)">
                  Publicar
                </button>
                <button type="button" class="rs-btn rs-btn--ghost rs-btn--sm"
                        [disabled]="procesandoId() === r._id" (click)="moderarReview(r, false)">
                  Rechazar
                </button>
              </div>
            </li>
          }
        </ul>
      </section>
    }
  }

  @if (error()) { <div class="rs-alert rs-alert--error">{{ error() }}</div> }
</div>
  `,
  styles: [`
    :host { display: block; }

    .ac__head {
      display: flex; align-items: flex-start; justify-content: space-between;
      gap: var(--sp-4); flex-wrap: wrap; margin-bottom: var(--sp-6);
      h1 { font-size: var(--f-2xl); color: var(--dk-blue); }
      p { color: var(--t-400); margin-top: var(--sp-1); font-size: var(--f-sm); }
    }
    .ac__contador {
      padding: var(--sp-2) var(--sp-4); border-radius: var(--r-full);
      background: var(--c-accent-lo); color: var(--dk-blue);
      font-size: var(--f-sm); font-weight: var(--w-6);
    }

    .ac__cargando { color: var(--t-400); }
    .ac__tabs { display: flex; flex-wrap: wrap; gap: var(--sp-2); margin-bottom: var(--sp-4); }
    .ac__tab {
      display: inline-flex; align-items: center; gap: var(--sp-2);
      padding: var(--sp-2) var(--sp-4); border-radius: var(--r-full);
      border: 1px solid var(--b-2); background: var(--c-raised);
      color: var(--t-300); font-size: var(--f-sm); cursor: pointer; transition: all var(--d-2);
    }
    .ac__tab:hover { border-color: var(--c-accent); color: var(--c-accent); }
    .ac__tab.activa { background: var(--c-accent-lo); border-color: var(--c-accent); color: var(--c-accent); font-weight: var(--w-6); }
    .ac__tab-num { padding: 1px var(--sp-2); border-radius: var(--r-full); background: var(--c-surface); font-size: var(--f-xs); color: var(--t-400); }

    .ac__buscador {
      display: flex; align-items: center; gap: var(--sp-2);
      max-width: 420px; height: 40px; padding: 0 var(--sp-3); margin-bottom: var(--sp-5);
      background: var(--c-card); border: 1px solid var(--b-2); border-radius: var(--r-lg);
      color: var(--t-400);
    }
    .ac__buscador:focus-within { border-color: var(--c-accent); }
    .ac__buscador input {
      flex: 1; border: none; background: transparent; outline: none;
      font-size: var(--f-sm); color: var(--t-100); min-width: 0;
    }

    .ac__vacio {
      display: flex; flex-direction: column; align-items: center; gap: var(--sp-3);
      padding: var(--sp-16) var(--sp-4); color: var(--t-400); text-align: center;
      rs-icon { color: #15803D; }
    }

    .ac__bloque { margin-bottom: var(--sp-8); }
    .ac__bloque h2 { font-size: var(--f-lg); color: var(--dk-blue); margin-bottom: var(--sp-4); }

    .ac__lista { list-style: none; display: flex; flex-direction: column; gap: var(--sp-3); }

    .ac__card {
      display: flex; align-items: flex-start; justify-content: space-between;
      gap: var(--sp-5); flex-wrap: wrap;
      padding: var(--sp-5);
      background: var(--c-card); border: 1px solid var(--b-1); border-radius: var(--r-lg);
    }
    .ac__card-cuerpo {
      display: flex; flex-direction: column; gap: 2px; flex: 1; min-width: 240px;
      strong { font-size: var(--f-md); color: var(--t-100); }
      em { font-style: normal; font-size: var(--f-xs); color: var(--t-400); }
      p { margin-top: var(--sp-2); color: var(--t-300); font-size: var(--f-sm); line-height: 1.6; }
    }
    .ac__tipo {
      font-family: var(--font-accent); font-size: var(--f-xs); font-weight: var(--w-7);
      letter-spacing: .06em; text-transform: uppercase; color: var(--dk-gold);
    }

    .ac__fotos {
      display: flex; gap: var(--sp-2); margin-top: var(--sp-3);
      img { width: 82px; height: 62px; object-fit: cover; border-radius: var(--r-md); }
    }

    .ac__acciones { display: flex; gap: var(--sp-2); flex-shrink: 0; }
  `],
})
export class AdminComunidadComponent implements OnInit {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiUrl}/lugares`;

  readonly lugares = signal<LugarPendiente[]>([]);
  readonly reviews = signal<ReviewPendiente[]>([]);
  readonly cargando = signal(true);
  readonly procesandoId = signal<string | null>(null);
  readonly error = signal('');

  readonly totalPendiente = computed(() => this.lugares().length + this.reviews().length);

  /** Pestañas de moderación y buscador (TCK-8039). */
  readonly tabs = TABS_MODERACION;
  readonly estadoActivo = signal<EstadoModeracion>(EstadoModeracion.PENDIENTE);
  readonly busqueda = signal('');
  readonly conteos = signal<Record<string, number>>({});

  private coincide(texto: string): boolean {
    const termino = this.busqueda().trim().toLowerCase();
    return !termino || texto.toLowerCase().includes(termino);
  }

  readonly lugaresVisibles = computed(() =>
    this.lugares().filter((l) => this.coincide(`${l.nombre} ${l.ubicacion.ciudad} ${l.descripcion ?? ''}`)),
  );

  readonly reviewsVisibles = computed(() =>
    this.reviews().filter((r) => this.coincide(`${r.usuarioNombre} ${r.texto ?? ''}`)),
  );

  readonly totalVisible = computed(() => this.lugaresVisibles().length + this.reviewsVisibles().length);

  conteo(estado: string): number {
    return this.conteos()[estado] ?? 0;
  }

  mensajeVacio(): string {
    if (this.busqueda().trim()) return 'Nada coincide con lo que has buscado.';
    if (this.estadoActivo() === EstadoModeracion.PENDIENTE) {
      return 'No hay nada pendiente de moderar. Cuando la comunidad comparta un sitio o una reseña, aparecerá aquí para que la revises antes de publicarla.';
    }
    if (this.estadoActivo() === EstadoModeracion.PUBLICADO) return 'Todavía no has publicado ninguna aportación.';
    return 'No has rechazado ninguna aportación.';
  }

  async cambiarEstado(estado: EstadoModeracion): Promise<void> {
    this.estadoActivo.set(estado);
    await this.cargar();
  }

  async ngOnInit(): Promise<void> {
    await this.cargar();
  }

  etiquetaTipo(tipo: TipoLugar): string {
    return TIPO_LUGAR_LABELS[tipo];
  }

  async moderarLugar(lugar: LugarPendiente, publicar: boolean): Promise<void> {
    this.procesandoId.set(lugar._id);
    this.error.set('');
    try {
      await firstValueFrom(
        this.http.patch(`${this.base}/${lugar._id}/moderar`, { estado: this.estado(publicar) }),
      );
      this.lugares.update((lista) => lista.filter((l) => l._id !== lugar._id));
    } catch {
      this.error.set(`No se pudo moderar "${lugar.nombre}". Vuelve a intentarlo.`);
    } finally {
      this.procesandoId.set(null);
    }
  }

  async moderarReview(review: ReviewPendiente, publicar: boolean): Promise<void> {
    this.procesandoId.set(review._id);
    this.error.set('');
    try {
      await firstValueFrom(
        this.http.patch(`${this.base}/reviews/${review._id}/moderar`, {
          estado: this.estado(publicar),
        }),
      );
      this.reviews.update((lista) => lista.filter((r) => r._id !== review._id));
    } catch {
      this.error.set('No se pudo moderar la aportación. Vuelve a intentarlo.');
    } finally {
      this.procesandoId.set(null);
    }
  }

  private estado(publicar: boolean): EstadoModeracion {
    return publicar ? EstadoModeracion.PUBLICADO : EstadoModeracion.RECHAZADO;
  }

  private async cargar(): Promise<void> {
    this.cargando.set(true);
    try {
      const pendientes = await firstValueFrom(
        this.http.get<{ lugares: LugarPendiente[]; reviews: ReviewPendiente[] }>(
          `${this.base}/moderacion/pendientes?estado=${this.estadoActivo()}`,
        ),
      );
      this.lugares.set(pendientes.lugares);
      this.reviews.set(pendientes.reviews);
      try {
        this.conteos.set(
          await firstValueFrom(this.http.get<Record<string, number>>(`${this.base}/moderacion/resumen`)),
        );
      } catch {
        // Sin contadores las pestañas siguen funcionando, sólo salen a cero.
      }
    } catch {
      this.error.set('No se pudo cargar la cola de moderación.');
    } finally {
      this.cargando.set(false);
    }
  }
}
