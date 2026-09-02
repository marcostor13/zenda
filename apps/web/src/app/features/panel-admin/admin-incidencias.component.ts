import { Component, OnInit, inject, signal, computed } from '@angular/core';
import { DatePipe } from '@angular/common';
import { HttpClient, HttpParams } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { ESTADO_INCIDENCIA_LABELS, EstadoIncidencia, TIPO_INCIDENCIA_LABELS, TipoIncidencia } from 'shared';
import { RsIconComponent } from '../../shared/components/icon/rs-icon.component';
import { environment } from '../../../environments/environment';
import { TraducirPipe } from '../../core/i18n/traducir.pipe';

interface ActuacionIncidencia {
  estado: EstadoIncidencia;
  nota?: string;
  por: string;
  at: string;
}

interface IncidenciaAdmin {
  _id: string;
  codigoReserva?: string;
  abiertaPorNombre: string;
  origen: 'cliente' | 'comercio';
  tipo: TipoIncidencia;
  asunto: string;
  descripcion: string;
  estado: EstadoIncidencia;
  resolucion?: string;
  historial: ActuacionIncidencia[];
  createdAt: string;
}

const LIMITE = 20;

const ESTADO_BADGE: Record<string, string> = {
  abierta: 'rs-badge--error',
  en_revision: 'rs-badge--warning',
  resuelta: 'rs-badge--success',
};

const TABS: ReadonlyArray<{ estado: string; label: string }> = [
  { estado: '', label: 'Todas' },
  { estado: EstadoIncidencia.ABIERTA, label: 'Abiertas' },
  { estado: EstadoIncidencia.EN_REVISION, label: 'En revisión' },
  { estado: EstadoIncidencia.RESUELTA, label: 'Resueltas' },
];

/**
 * Incidencias y disputas (TCK-8040 §2). Cada cambio de estado deja constancia de
 * quién lo hizo y por qué: con varias personas en administración, sin historial
 * no hay forma de saber qué se ha hecho ya.
 */
@Component({
  selector: 'app-admin-incidencias',
  standalone: true,
  imports: [
    TraducirPipe, DatePipe, RsIconComponent
  ],
  template: `
    <div class="rs-page-header">
      <div>
        <h1 class="rs-page-title">{{ 'Incidencias y disputas' | t }}</h1>
        <p class="rs-page-sub">{{ 'Reclamaciones y solicitudes de devolución de clientes y comercios.' | t }}</p>
      </div>
    </div>

    <div class="tabs" role="tablist">
      @for (t of tabs; track t.estado) {
        <button class="tab" role="tab" [attr.aria-selected]="filtroEstado() === t.estado"
                [class.activa]="filtroEstado() === t.estado" (click)="cambiarEstado(t.estado)">
          {{ t.label | t }}
          <span class="tab__num">{{ conteo(t.estado) }}</span>
        </button>
      }
    </div>

    <div class="rs-toolbar">
      <div class="rs-toolbar__campo">
        <label class="rs-toolbar__lbl" for="fi-tipo">{{ 'Tipo' | t }}</label>
        <select id="fi-tipo" class="rs-inp rs-toolbar__control" [value]="filtroTipo()"
                (change)="cambiarTipo($any($event.target).value)">
          <option value="">{{ 'Cualquiera' | t }}</option>
          @for (t of tipos; track t.valor) {
            <option [value]="t.valor">{{ t.label | t }}</option>
          }
        </select>
      </div>

      <div class="rs-toolbar__campo rs-toolbar__campo--buscador">
        <label class="rs-toolbar__lbl" for="fi-buscar">{{ 'Buscar' | t }}</label>
        <input id="fi-buscar" class="rs-inp rs-toolbar__control" type="search"
               [placeholder]="'Asunto, persona o código de reserva…' | t"
               [value]="buscar()" (keyup.enter)="aplicarBusqueda($any($event.target).value)" />
      </div>
    </div>

    @if (errorMsg()) {
      <div class="rs-alert rs-alert--error">{{ errorMsg() }}</div>
    }

    @if (cargando()) {
      <p style="color:var(--t-400)">{{ 'Cargando incidencias…' | t }}</p>
    } @else if (incidencias().length === 0) {
      <div class="rs-card vacio">
        <rs-icon name="check-circle" [size]="34" [stroke]="1.5"></rs-icon>
        <p>
          {{ filtroEstado() || filtroTipo() || buscar()
             ? 'Ninguna incidencia coincide con el filtro.'
             : 'No hay incidencias abiertas. Cuando un cliente o un comercio reclame, aparecerá aquí.' }}
        </p>
      </div>
    } @else {
      <div class="lista">
        @for (i of incidencias(); track i._id) {
          <div class="incidencia">
            <div class="incidencia__cabecera">
              <span class="rs-badge {{ badge(i.estado) }}">{{ etiquetaEstado(i.estado) }}</span>
              <span class="rs-badge rs-badge--neutral">{{ etiquetaTipo(i.tipo) }}</span>
              <strong class="incidencia__asunto">{{ i.asunto }}</strong>
              <span class="incidencia__meta">
                {{ i.abiertaPorNombre }} ({{ i.origen === 'comercio' ? 'comercio' : 'cliente' }})
                @if (i.codigoReserva) { · reserva {{ i.codigoReserva }} }
                · {{ i.createdAt | date:'d MMM yyyy' }}
              </span>
            </div>

            <p class="incidencia__texto">{{ i.descripcion }}</p>

            @if (i.resolucion) {
              <p class="incidencia__resolucion">
                <rs-icon name="check-circle" [size]="13" [stroke]="2"></rs-icon>
                Resolución: {{ i.resolucion }}
              </p>
            }

            <div class="incidencia__acciones">
              @if (i.estado !== 'en_revision' && i.estado !== 'resuelta') {
                <button class="rs-btn rs-btn--outline rs-btn--sm"
                        [disabled]="accionando() === i._id" (click)="tomar(i)">
                  {{ 'Tomar en revisión' | t }}
                </button>
              }
              @if (i.estado !== 'resuelta') {
                <button class="rs-btn rs-btn--primary rs-btn--sm"
                        [disabled]="accionando() === i._id" (click)="abrirResolver(i._id)">
                  {{ 'Resolver' | t }}
                </button>
              }
              <button class="rs-btn rs-btn--ghost rs-btn--sm" (click)="toggleHistorial(i._id)">
                <rs-icon name="clock" [size]="13" [stroke]="2"></rs-icon>
                {{ historialAbierto() === i._id ? 'Ocultar historial' : 'Historial' }}
              </button>
            </div>

            @if (resolviendoId() === i._id) {
              <div class="resolver">
                <label class="rs-lbl" [attr.for]="'res-' + i._id">
                  {{ '¿Cómo se ha resuelto? Queda registrado en el historial.' | t }}
                </label>
                <input class="rs-inp" [id]="'res-' + i._id" [value]="resolucion()"
                       (input)="resolucion.set($any($event.target).value)"
                       [placeholder]="'Ej. reembolso emitido el 12/08 por 45 €' | t" />
                <div class="resolver__acciones">
                  <button class="rs-btn rs-btn--ghost rs-btn--sm" (click)="cancelarResolver()">{{ 'Cancelar' | t }}</button>
                  <button class="rs-btn rs-btn--primary rs-btn--sm"
                          [disabled]="!resolucion().trim() || accionando() === i._id"
                          (click)="resolver(i)">{{ 'Marcar como resuelta' | t }}</button>
                </div>
              </div>
            }

            @if (historialAbierto() === i._id) {
              <ol class="historial">
                @for (h of i.historial; track $index) {
                  <li>
                    <strong>{{ etiquetaEstado(h.estado) }}</strong>
                    <span>{{ h.at | date:'d MMM yyyy, HH:mm' }} · {{ h.por }}</span>
                    @if (h.nota) { <em>"{{ h.nota }}"</em> }
                  </li>
                }
              </ol>
            }
          </div>
        }
      </div>

      @if (totalPaginas() > 1) {
        <div class="paginacion">
          <button class="rs-btn rs-btn--secondary rs-btn--sm"
                  [disabled]="pagina() <= 1" (click)="cambiarPagina(pagina() - 1)">{{ '← Anterior' | t }}</button>
          <span>Página {{ pagina() }} de {{ totalPaginas() }} · {{ total() }} incidencias</span>
          <button class="rs-btn rs-btn--secondary rs-btn--sm"
                  [disabled]="pagina() >= totalPaginas()" (click)="cambiarPagina(pagina() + 1)">{{ 'Siguiente →' | t }}</button>
        </div>
      }
    }
  `,
  styles: [`
    :host { display: contents; }

    .tabs { display: flex; flex-wrap: wrap; gap: var(--sp-2); }
    .tab {
      display: inline-flex; align-items: center; gap: var(--sp-2);
      padding: var(--sp-2) var(--sp-4); border-radius: var(--r-full);
      border: 1px solid var(--b-2); background: var(--c-raised);
      color: var(--t-300); font-size: var(--f-sm); cursor: pointer; transition: all var(--d-2);
    }
    .tab:hover { border-color: var(--c-accent); color: var(--c-accent); }
    .tab.activa { background: var(--c-accent-lo); border-color: var(--c-accent); color: var(--c-accent); font-weight: var(--w-6); }
    .tab__num { padding: 1px var(--sp-2); border-radius: var(--r-full); background: var(--c-surface); font-size: var(--f-xs); color: var(--t-400); }

    .vacio { padding: var(--sp-12); text-align: center; color: var(--t-400); display: flex; flex-direction: column; align-items: center; gap: var(--sp-3); }

    .lista { display: flex; flex-direction: column; gap: var(--sp-3); }
    .incidencia { background: var(--c-card); border: 1px solid var(--b-1); border-radius: var(--r-xl); padding: var(--sp-5); }
    .incidencia__cabecera { display: flex; flex-wrap: wrap; align-items: center; gap: var(--sp-3); margin-bottom: var(--sp-2); }
    .incidencia__asunto { font-size: var(--f-base); font-weight: var(--w-7); color: var(--t-100); }
    .incidencia__meta { font-size: var(--f-xs); color: var(--t-400); margin-left: auto; }
    .incidencia__texto { font-size: var(--f-sm); color: var(--t-200); line-height: 1.6; }
    .incidencia__resolucion {
      display: flex; align-items: center; gap: var(--sp-2);
      margin-top: var(--sp-3); padding: var(--sp-3);
      background: var(--c-raised); border-radius: var(--r-lg);
      font-size: var(--f-sm); color: var(--t-300);
    }
    .incidencia__acciones { display: flex; flex-wrap: wrap; gap: var(--sp-2); margin-top: var(--sp-3); }

    .resolver { margin-top: var(--sp-3); padding-top: var(--sp-3); border-top: 1px solid var(--b-1); display: flex; flex-direction: column; gap: var(--sp-2); }
    .resolver__acciones { display: flex; gap: var(--sp-2); }

    .historial {
      margin-top: var(--sp-3); padding-top: var(--sp-3); border-top: 1px solid var(--b-1);
      display: flex; flex-direction: column; gap: var(--sp-2); list-style: none;
    }
    .historial li { display: flex; flex-wrap: wrap; gap: var(--sp-3); font-size: var(--f-sm); color: var(--t-300); }
    .historial strong { color: var(--t-100); }
    .historial em { color: var(--t-400); }

    .paginacion { display: flex; align-items: center; justify-content: center; gap: var(--sp-4); font-size: var(--f-sm); color: var(--t-400); }
  `],
})
export class AdminIncidenciasComponent implements OnInit {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiUrl}/incidencias`;

  readonly cargando = signal(true);
  readonly errorMsg = signal('');
  readonly incidencias = signal<IncidenciaAdmin[]>([]);
  readonly total = signal(0);
  readonly pagina = signal(1);
  readonly conteos = signal<Record<string, number>>({});
  readonly accionando = signal<string | null>(null);

  readonly tabs = TABS;
  readonly tipos = Object.values(TipoIncidencia).map((valor) => ({ valor, label: TIPO_INCIDENCIA_LABELS[valor] }));
  readonly filtroEstado = signal('');
  readonly filtroTipo = signal('');
  readonly buscar = signal('');

  readonly historialAbierto = signal<string | null>(null);
  readonly resolviendoId = signal<string | null>(null);
  readonly resolucion = signal('');

  readonly totalPaginas = computed(() => Math.max(1, Math.ceil(this.total() / LIMITE)));

  async ngOnInit(): Promise<void> {
    await this.cargar();
  }

  private async cargar(): Promise<void> {
    this.cargando.set(true);
    this.errorMsg.set('');
    try {
      let params = new HttpParams().set('page', String(this.pagina())).set('limite', String(LIMITE));
      if (this.filtroEstado()) params = params.set('estado', this.filtroEstado());
      if (this.filtroTipo()) params = params.set('tipo', this.filtroTipo());
      if (this.buscar()) params = params.set('buscar', this.buscar());

      const res = await firstValueFrom(
        this.http.get<{ items: IncidenciaAdmin[]; total: number }>(this.base, { params }),
      );
      this.incidencias.set(res.items);
      this.total.set(res.total);
    } catch {
      this.errorMsg.set('Error cargando las incidencias. Verifica que el API esté activo.');
    } finally {
      this.cargando.set(false);
    }

    try {
      this.conteos.set(await firstValueFrom(this.http.get<Record<string, number>>(`${this.base}/resumen`)));
    } catch {
      // Sin contadores las pestañas siguen funcionando, sólo salen a cero.
    }
  }

  conteo(estado: string): number {
    const conteos = this.conteos();
    if (!estado) return Object.values(conteos).reduce((total, n) => total + n, 0);
    return conteos[estado] ?? 0;
  }

  etiquetaEstado(estado: EstadoIncidencia): string { return ESTADO_INCIDENCIA_LABELS[estado] ?? estado; }
  etiquetaTipo(tipo: TipoIncidencia): string { return TIPO_INCIDENCIA_LABELS[tipo] ?? tipo; }
  badge(estado: string): string { return ESTADO_BADGE[estado] ?? 'rs-badge--neutral'; }

  async cambiarEstado(estado: string): Promise<void> {
    this.filtroEstado.set(estado);
    this.pagina.set(1);
    await this.cargar();
  }

  async cambiarTipo(tipo: string): Promise<void> {
    this.filtroTipo.set(tipo);
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

  toggleHistorial(id: string): void {
    this.historialAbierto.set(this.historialAbierto() === id ? null : id);
  }

  abrirResolver(id: string): void {
    this.resolviendoId.set(id);
    this.resolucion.set('');
  }

  cancelarResolver(): void {
    this.resolviendoId.set(null);
    this.resolucion.set('');
  }

  async tomar(incidencia: IncidenciaAdmin): Promise<void> {
    await this.cambiarEstadoIncidencia(incidencia, { estado: EstadoIncidencia.EN_REVISION });
  }

  /** Cerrar exige explicar cómo: el backend rechaza una resolución vacía. */
  async resolver(incidencia: IncidenciaAdmin): Promise<void> {
    const resolucion = this.resolucion().trim();
    if (!resolucion) return;
    await this.cambiarEstadoIncidencia(incidencia, { estado: EstadoIncidencia.RESUELTA, resolucion });
    this.cancelarResolver();
  }

  private async cambiarEstadoIncidencia(
    incidencia: IncidenciaAdmin,
    cambio: { estado: EstadoIncidencia; resolucion?: string },
  ): Promise<void> {
    this.accionando.set(incidencia._id);
    try {
      const actualizada = await firstValueFrom(
        this.http.patch<IncidenciaAdmin>(`${this.base}/${incidencia._id}/estado`, cambio),
      );
      this.incidencias.update((lista) =>
        lista.map((i) => (i._id === incidencia._id ? { ...i, ...actualizada } : i)),
      );
      try {
        this.conteos.set(await firstValueFrom(this.http.get<Record<string, number>>(`${this.base}/resumen`)));
      } catch {
        // Los contadores se pondrán al día en la siguiente carga.
      }
    } catch {
      this.errorMsg.set('No se pudo actualizar la incidencia.');
      setTimeout(() => this.errorMsg.set(''), 3000);
    } finally {
      this.accionando.set(null);
    }
  }
}
