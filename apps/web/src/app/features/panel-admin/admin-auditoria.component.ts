import { Component, OnInit, inject, signal, computed } from '@angular/core';
import { DatePipe } from '@angular/common';
import { firstValueFrom } from 'rxjs';
import { ENTIDAD_AUDITADA_LABELS, EntidadAuditada } from 'shared';
import { AdminApiService, RegistroAuditoria } from './admin-api.service';
import { RsIconComponent } from '../../shared/components/icon/rs-icon.component';
import { TraducirPipe } from '../../core/i18n/traducir.pipe';

const LIMITE = 30;

const ICONO_ENTIDAD: Record<string, string> = {
  comercio: 'building',
  usuario: 'users',
  comision: 'percent',
  alpha: 'crown',
  resena: 'star',
  reserva: 'calendar',
  incidencia: 'alert-circle',
};

/**
 * Historial de acciones administrativas (TCK-8030 §8, TCK-8034 y TCK-8035 §9).
 * Con varias personas en administración, saber quién cambió qué y cuándo es lo
 * que permite auditar y revertir decisiones.
 */
@Component({
  selector: 'app-admin-auditoria',
  standalone: true,
  imports: [
    TraducirPipe, DatePipe, RsIconComponent
  ],
  template: `
    <div class="rs-page-header">
      <div>
        <h1 class="rs-page-title">{{ 'Historial administrativo' | t }}</h1>
        <p class="rs-page-sub">{{ 'Quién ha cambiado qué en el panel, y por qué.' | t }}</p>
      </div>
    </div>

    <div class="rs-toolbar">
      <div class="rs-toolbar__grupo">
        <button class="rs-btn rs-btn--sm"
                [class.rs-btn--primary]="filtroEntidad() === ''"
                [class.rs-btn--ghost]="filtroEntidad() !== ''"
                (click)="cambiarEntidad('')">{{ 'Todo' | t }}</button>
        @for (e of entidades; track e.valor) {
          <button class="rs-btn rs-btn--sm"
                  [class.rs-btn--primary]="filtroEntidad() === e.valor"
                  [class.rs-btn--ghost]="filtroEntidad() !== e.valor"
                  (click)="cambiarEntidad(e.valor)">{{ e.label | t }}</button>
        }
      </div>
      <div class="rs-toolbar__campo rs-toolbar__campo--buscador">
        <label class="rs-toolbar__lbl" for="fa-buscar">{{ 'Buscar' | t }}</label>
        <input id="fa-buscar" class="rs-inp rs-toolbar__control" type="search"
               [placeholder]="'Descripción, administrador o motivo…' | t"
               [value]="buscar()" (keyup.enter)="aplicarBusqueda($any($event.target).value)" />
      </div>
    </div>

    @if (errorMsg()) {
      <div class="rs-alert rs-alert--error">{{ errorMsg() }}</div>
    }

    @if (cargando()) {
      <p style="color:var(--t-400)">{{ 'Cargando el historial…' | t }}</p>
    } @else if (registros().length === 0) {
      <div class="rs-card vacio">
        <rs-icon name="clock" [size]="34" [stroke]="1.5"></rs-icon>
        <p>
          {{ filtroEntidad() || buscar()
             ? 'Ninguna acción coincide con el filtro.'
             : 'Todavía no hay acciones registradas. Aquí irá quedando todo lo que cambie el equipo de administración.' }}
        </p>
      </div>
    } @else {
      <ol class="linea">
        @for (r of registros(); track r._id) {
          <li class="registro">
            <span class="registro__icono">
              <rs-icon [name]="icono(r.entidad)" [size]="15" [stroke]="2"></rs-icon>
            </span>
            <div class="registro__cuerpo">
              <p class="registro__descripcion">{{ r.descripcion }}</p>
              @if (r.motivo) { <p class="registro__motivo">Motivo: {{ r.motivo }}</p> }
              <p class="registro__meta">
                {{ r.actorNombre }} · {{ r.createdAt | date:'d MMM yyyy, HH:mm' }}
                · {{ etiquetaEntidad(r.entidad) }}
              </p>
            </div>
          </li>
        }
      </ol>

      @if (totalPaginas() > 1) {
        <div class="paginacion">
          <button class="rs-btn rs-btn--secondary rs-btn--sm"
                  [disabled]="pagina() <= 1" (click)="cambiarPagina(pagina() - 1)">{{ '← Anterior' | t }}</button>
          <span>Página {{ pagina() }} de {{ totalPaginas() }} · {{ total() }} acciones</span>
          <button class="rs-btn rs-btn--secondary rs-btn--sm"
                  [disabled]="pagina() >= totalPaginas()" (click)="cambiarPagina(pagina() + 1)">{{ 'Siguiente →' | t }}</button>
        </div>
      }
    }
  `,
  styles: [`
    :host { display: contents; }

    .vacio { padding: var(--sp-12); text-align: center; color: var(--t-400); display: flex; flex-direction: column; align-items: center; gap: var(--sp-3); }
    .vacio p { max-width: 48ch; line-height: 1.6; }

    .linea { display: flex; flex-direction: column; gap: var(--sp-2); list-style: none; }
    .registro {
      display: flex; gap: var(--sp-4); align-items: flex-start;
      padding: var(--sp-4) var(--sp-5);
      background: var(--c-card); border: 1px solid var(--b-1); border-radius: var(--r-xl);
    }
    .registro__icono {
      width: 34px; height: 34px; border-radius: var(--r-lg); flex-shrink: 0;
      display: flex; align-items: center; justify-content: center;
      background: var(--c-accent-lo); color: var(--c-accent);
    }
    .registro__cuerpo { display: flex; flex-direction: column; gap: 2px; }
    .registro__descripcion { font-size: var(--f-sm); color: var(--t-100); }
    .registro__motivo { font-size: var(--f-sm); color: var(--t-300); font-style: italic; }
    .registro__meta { font-size: var(--f-xs); color: var(--t-400); }

    .paginacion { display: flex; align-items: center; justify-content: center; gap: var(--sp-4); font-size: var(--f-sm); color: var(--t-400); }
  `],
})
export class AdminAuditoriaComponent implements OnInit {
  private readonly adminApi = inject(AdminApiService);

  readonly cargando = signal(true);
  readonly errorMsg = signal('');
  readonly registros = signal<RegistroAuditoria[]>([]);
  readonly total = signal(0);
  readonly pagina = signal(1);

  readonly entidades = Object.values(EntidadAuditada).map((valor) => ({
    valor,
    label: ENTIDAD_AUDITADA_LABELS[valor],
  }));
  readonly filtroEntidad = signal('');
  readonly buscar = signal('');

  readonly totalPaginas = computed(() => Math.max(1, Math.ceil(this.total() / LIMITE)));

  async ngOnInit(): Promise<void> {
    await this.cargar();
  }

  private async cargar(): Promise<void> {
    this.cargando.set(true);
    this.errorMsg.set('');
    try {
      const res = await firstValueFrom(this.adminApi.getAuditoria({
        page: this.pagina(),
        limite: LIMITE,
        entidad: this.filtroEntidad() || undefined,
        buscar: this.buscar() || undefined,
      }));
      this.registros.set(res.items);
      this.total.set(res.total);
    } catch {
      this.errorMsg.set('Error cargando el historial. Verifica que el API esté activo.');
    } finally {
      this.cargando.set(false);
    }
  }

  icono(entidad: string): string { return ICONO_ENTIDAD[entidad] ?? 'circle'; }
  etiquetaEntidad(entidad: string): string {
    return ENTIDAD_AUDITADA_LABELS[entidad as EntidadAuditada] ?? entidad;
  }

  async cambiarEntidad(entidad: string): Promise<void> {
    this.filtroEntidad.set(entidad);
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
}
