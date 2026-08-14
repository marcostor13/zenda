import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { EstadoModeracion, TIPO_LUGAR_LABELS, TipoLugar } from 'shared';
import { RsIconComponent } from '../../shared/components/icon/rs-icon.component';
import { environment } from '../../../environments/environment';

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
    <span class="ac__contador">{{ totalPendiente() }} pendientes</span>
  </header>

  @if (cargando()) {
    <p class="ac__cargando">Cargando la cola de moderación…</p>
  } @else if (!totalPendiente()) {
    <div class="ac__vacio">
      <rs-icon name="check-circle" [size]="36" [stroke]="1.5"></rs-icon>
      <p>No hay nada pendiente de moderar. Cuando la comunidad comparta un sitio o
        una reseña, aparecerá aquí para que la revises antes de publicarla.</p>
    </div>
  } @else {
    @if (lugares().length) {
      <section class="ac__bloque">
        <h2>Sitios propuestos ({{ lugares().length }})</h2>
        <ul class="ac__lista">
          @for (l of lugares(); track l._id) {
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

    @if (reviews().length) {
      <section class="ac__bloque">
        <h2>Aportaciones ({{ reviews().length }})</h2>
        <ul class="ac__lista">
          @for (r of reviews(); track r._id) {
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
          `${this.base}/moderacion/pendientes`,
        ),
      );
      this.lugares.set(pendientes.lugares);
      this.reviews.set(pendientes.reviews);
    } catch {
      this.error.set('No se pudo cargar la cola de moderación.');
    } finally {
      this.cargando.set(false);
    }
  }
}
