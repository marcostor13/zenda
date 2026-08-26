import { Component, OnInit, inject, signal, computed } from '@angular/core';
import { DatePipe } from '@angular/common';
import { HttpClient, HttpParams } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { RsIconComponent } from '../../shared/components/icon/rs-icon.component';
import { environment } from '../../../environments/environment';

/** Reseña tal y como la ve la administración, con su estado de visibilidad. */
interface ResenaAdmin {
  _id: string;
  usuarioNombre: string;
  servicioTitulo: string;
  vertical: string;
  puntuacion: number;
  comentario: string;
  respuesta?: string | null;
  eliminada?: boolean;
  createdAt: string;
  reservaId: string;
  comercioId: string;
}

const LIMITE = 20;

const FILTROS_VISIBILIDAD = [
  { label: 'Todas', valor: '' },
  { label: 'Publicadas', valor: 'false' },
  { label: 'Ocultas', valor: 'true' },
] as const;

/**
 * Gestión administrativa de reseñas (TCK-8040 §3). Ocultar no borra: la reseña
 * sigue guardada para poder revisarla o reponerla, y al cambiar la visibilidad
 * el backend recalcula la nota del servicio.
 */
@Component({
  selector: 'app-admin-resenas',
  standalone: true,
  imports: [DatePipe, RsIconComponent],
  template: `
    <div class="rs-page-header">
      <div>
        <h1 class="rs-page-title">Reseñas</h1>
        <p class="rs-page-sub">Consulta todas las opiniones publicadas y retira las que den problemas.</p>
      </div>
      <div class="rs-card page-kpi">
        <span class="kpi-num">{{ total() }}</span>
        <span class="kpi-lbl">reseñas</span>
      </div>
    </div>

    <div class="rs-toolbar">
      <div class="rs-toolbar__grupo">
        @for (f of filtros; track f.valor) {
          <button class="rs-btn rs-btn--sm"
                  [class.rs-btn--primary]="visibilidad() === f.valor"
                  [class.rs-btn--ghost]="visibilidad() !== f.valor"
                  (click)="cambiarVisibilidad(f.valor)">
            {{ f.label }}
          </button>
        }
      </div>
      <div class="rs-toolbar__campo">
        <label class="rs-toolbar__lbl" for="fr-puntuacion">Puntuación</label>
        <select id="fr-puntuacion" class="rs-inp rs-toolbar__control" [value]="puntuacion()"
                (change)="cambiarPuntuacion($any($event.target).value)">
          <option value="">Cualquiera</option>
          @for (n of [5,4,3,2,1]; track n) {
            <option [value]="n">{{ n }} estrellas</option>
          }
        </select>
      </div>

      <div class="rs-toolbar__campo rs-toolbar__campo--buscador">
        <label class="rs-toolbar__lbl" for="fr-buscar">Buscar</label>
        <input id="fr-buscar" class="rs-inp rs-toolbar__control" type="search"
               placeholder="Cliente, servicio o texto…"
               [value]="buscar()" (keyup.enter)="aplicarBusqueda($any($event.target).value)" />
      </div>
    </div>

    @if (errorMsg()) {
      <div class="rs-alert rs-alert--error">{{ errorMsg() }}</div>
    }

    @if (cargando()) {
      <p style="color:var(--t-400)">Cargando reseñas…</p>
    } @else if (resenas().length === 0) {
      <div class="rs-card vacio">
        <rs-icon name="star" [size]="34" [stroke]="1.5"></rs-icon>
        <p>
          {{ buscar() || puntuacion() || visibilidad()
             ? 'Ninguna reseña coincide con el filtro.'
             : 'Todavía no hay reseñas en Doogking.' }}
        </p>
      </div>
    } @else {
      <div class="lista">
        @for (r of resenas(); track r._id) {
          <div class="resena" [class.resena--oculta]="r.eliminada">
            <div class="resena__cabecera">
              <div class="resena__estrellas" [attr.aria-label]="r.puntuacion + ' de 5'">
                @for (n of [1,2,3,4,5]; track n) {
                  <rs-icon name="star" [size]="14" [stroke]="2" [filled]="n <= r.puntuacion"
                           [style.color]="n <= r.puntuacion ? 'var(--c-amber)' : 'var(--b-2)'"></rs-icon>
                }
              </div>
              <strong class="resena__autor">{{ r.usuarioNombre }}</strong>
              <span class="resena__servicio">sobre {{ r.servicioTitulo }}</span>
              <span class="resena__fecha">{{ r.createdAt | date:'d MMM yyyy' }}</span>
              @if (r.eliminada) {
                <span class="rs-badge rs-badge--neutral">Oculta</span>
              }
            </div>

            <p class="resena__texto">{{ r.comentario || 'Sin comentario' }}</p>

            @if (r.respuesta) {
              <p class="resena__respuesta">
                <rs-icon name="message-square" [size]="13" [stroke]="2"></rs-icon>
                Respuesta del comercio: {{ r.respuesta }}
              </p>
            }

            <div class="resena__acciones">
              <button class="rs-btn rs-btn--ghost rs-btn--sm"
                      [disabled]="accionando() === r._id"
                      (click)="alternarVisibilidad(r)">
                @if (r.eliminada) {
                  <rs-icon name="eye" [size]="13" [stroke]="2"></rs-icon> Reponer
                } @else {
                  <rs-icon name="x" [size]="13" [stroke]="2.5"></rs-icon> Ocultar
                }
              </button>
            </div>
          </div>
        }
      </div>

      @if (totalPaginas() > 1) {
        <div class="paginacion">
          <button class="rs-btn rs-btn--secondary rs-btn--sm"
                  [disabled]="pagina() <= 1" (click)="cambiarPagina(pagina() - 1)">← Anterior</button>
          <span>Página {{ pagina() }} de {{ totalPaginas() }} · {{ total() }} reseñas</span>
          <button class="rs-btn rs-btn--secondary rs-btn--sm"
                  [disabled]="pagina() >= totalPaginas()" (click)="cambiarPagina(pagina() + 1)">Siguiente →</button>
        </div>
      }
    }
  `,
  styles: [`
    :host { display: contents; }

    .page-kpi { padding: var(--sp-3) var(--sp-5); display: flex; flex-direction: column; }
    .kpi-num { font-family: var(--font-accent); font-size: var(--f-xl); font-weight: var(--w-8); color: var(--t-100); }
    .kpi-lbl { font-size: var(--f-xs); color: var(--t-400); }

    .vacio { padding: var(--sp-12); text-align: center; color: var(--t-400); display: flex; flex-direction: column; align-items: center; gap: var(--sp-3); }

    .lista { display: flex; flex-direction: column; gap: var(--sp-3); }
    .resena { background: var(--c-card); border: 1px solid var(--b-1); border-radius: var(--r-xl); padding: var(--sp-5); }
    .resena--oculta { opacity: .65; border-style: dashed; }
    .resena__cabecera { display: flex; flex-wrap: wrap; align-items: center; gap: var(--sp-3); margin-bottom: var(--sp-2); }
    .resena__estrellas { display: inline-flex; gap: 2px; }
    .resena__autor { font-size: var(--f-sm); font-weight: var(--w-7); color: var(--t-100); }
    .resena__servicio { font-size: var(--f-sm); color: var(--t-300); }
    .resena__fecha { font-size: var(--f-xs); color: var(--t-400); margin-left: auto; }
    .resena__texto { font-size: var(--f-sm); color: var(--t-200); line-height: 1.6; }
    .resena__respuesta {
      display: flex; align-items: center; gap: var(--sp-2);
      margin-top: var(--sp-3); padding: var(--sp-3);
      background: var(--c-raised); border-radius: var(--r-lg);
      font-size: var(--f-sm); color: var(--t-300);
    }
    .resena__acciones { display: flex; gap: var(--sp-2); margin-top: var(--sp-3); }

    .paginacion { display: flex; align-items: center; justify-content: center; gap: var(--sp-4); font-size: var(--f-sm); color: var(--t-400); }
  `],
})
export class AdminResenasComponent implements OnInit {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiUrl}/reviews`;

  readonly cargando = signal(true);
  readonly errorMsg = signal('');
  readonly resenas = signal<ResenaAdmin[]>([]);
  readonly total = signal(0);
  readonly pagina = signal(1);
  readonly accionando = signal<string | null>(null);

  readonly filtros = FILTROS_VISIBILIDAD;
  readonly visibilidad = signal('');
  readonly puntuacion = signal('');
  readonly buscar = signal('');

  readonly totalPaginas = computed(() => Math.max(1, Math.ceil(this.total() / LIMITE)));

  async ngOnInit(): Promise<void> {
    await this.cargar();
  }

  private async cargar(): Promise<void> {
    this.cargando.set(true);
    this.errorMsg.set('');
    try {
      let params = new HttpParams()
        .set('page', String(this.pagina()))
        .set('limite', String(LIMITE));
      if (this.visibilidad()) params = params.set('ocultas', this.visibilidad());
      if (this.puntuacion()) params = params.set('puntuacion', this.puntuacion());
      if (this.buscar()) params = params.set('buscar', this.buscar());

      const res = await firstValueFrom(
        this.http.get<{ items: ResenaAdmin[]; total: number }>(`${this.base}/admin`, { params }),
      );
      this.resenas.set(res.items);
      this.total.set(res.total);
    } catch {
      this.errorMsg.set('Error cargando las reseñas. Verifica que el API esté activo.');
    } finally {
      this.cargando.set(false);
    }
  }

  async cambiarVisibilidad(valor: string): Promise<void> {
    this.visibilidad.set(valor);
    this.pagina.set(1);
    await this.cargar();
  }

  async cambiarPuntuacion(valor: string): Promise<void> {
    this.puntuacion.set(valor);
    this.pagina.set(1);
    await this.cargar();
  }

  async aplicarBusqueda(valor: string): Promise<void> {
    this.buscar.set(valor.trim());
    this.pagina.set(1);
    await this.cargar();
  }

  async cambiarPagina(pagina: number): Promise<void> {
    this.pagina.set(pagina);
    await this.cargar();
  }

  /** Ocultar no borra: la reseña se puede reponer y la nota se recalcula sola. */
  async alternarVisibilidad(resena: ResenaAdmin): Promise<void> {
    this.accionando.set(resena._id);
    try {
      await firstValueFrom(
        this.http.patch(`${this.base}/${resena._id}/visibilidad`, { oculta: !resena.eliminada }),
      );
      this.resenas.update((lista) =>
        lista.map((r) => (r._id === resena._id ? { ...r, eliminada: !resena.eliminada } : r)),
      );
    } catch {
      this.errorMsg.set('No se pudo cambiar la visibilidad de la reseña.');
      setTimeout(() => this.errorMsg.set(''), 3000);
    } finally {
      this.accionando.set(null);
    }
  }
}
