import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { CurrencyPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { RsIconComponent } from '../../shared/components/icon/rs-icon.component';
import { environment } from '../../../environments/environment';

interface CampanaApi {
  _id: string;
  nombre: string;
  descripcion: string;
  canales: string[];
  desde: string;
  hasta: string;
  activa: boolean;
  enviados: number;
}

interface MetricaApi {
  campanaId: string;
  nombre: string;
  activa: boolean;
  enviados: number;
  cupones: number;
  usos: number;
  tasaConversion: number;
  costePlataforma: number;
  costeComercios: number;
}

/**
 * Panel de campañas de marketing (HU-057).
 *
 * Muestra el coste separado por **quién asume el descuento**: juntarlos daría
 * un margen falso, porque lo que paga el comercio no sale del bolsillo de la
 * plataforma. Esa distinción es todo el motivo de esta pantalla.
 */
@Component({
  selector: 'app-admin-campanas',
  standalone: true,
  imports: [CurrencyPipe, FormsModule, RsIconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
<div class="ac">
  <header class="ac__head">
    <div>
      <h1>Campañas</h1>
      <p>Qué cuesta cada promoción y qué trae.</p>
    </div>
    <button type="button" class="rs-btn rs-btn--primary" (click)="alternarFormulario()">
      <rs-icon name="plus" [size]="15" [stroke]="2"></rs-icon>
      {{ formularioAbierto() ? 'Cancelar' : 'Nueva campaña' }}
    </button>
  </header>

  @if (formularioAbierto()) {
    <div class="rs-card ac__form">
      <div class="ac__form-campos">
        <div class="rs-field">
          <label class="rs-lbl" for="ca-nombre">Nombre *</label>
          <input id="ca-nombre" class="rs-inp" [(ngModel)]="nombre" placeholder="Ej. Vuelta al cole 2026" />
        </div>
        <div class="rs-field">
          <label class="rs-lbl" for="ca-desde">Desde *</label>
          <input id="ca-desde" type="date" class="rs-inp" [(ngModel)]="desde" />
        </div>
        <div class="rs-field">
          <label class="rs-lbl" for="ca-hasta">Hasta *</label>
          <input id="ca-hasta" type="date" class="rs-inp" [(ngModel)]="hasta" />
        </div>
      </div>
      <div class="rs-field">
        <label class="rs-lbl" for="ca-desc">Descripción</label>
        <input id="ca-desc" class="rs-inp" [(ngModel)]="descripcion" />
      </div>

      @if (error()) { <div class="rs-alert rs-alert--error">{{ error() }}</div> }

      <button type="button" class="rs-btn rs-btn--primary" [disabled]="guardando()" (click)="crear()">
        {{ guardando() ? 'Creando…' : 'Crear campaña' }}
      </button>
    </div>
  }

  @if (cargando()) {
    <p class="ac__cargando">Cargando campañas…</p>
  } @else if (!metricas().length) {
    <div class="ac__vacio">
      <rs-icon name="tag" [size]="36" [stroke]="1.5"></rs-icon>
      <p>Todavía no has creado ninguna campaña.</p>
    </div>
  } @else {
    <div class="ac__resumen">
      <div class="ac__kpi">
        <span>Coste asumido por Doogking</span>
        <strong>{{ totalPlataforma() | currency: 'EUR' }}</strong>
      </div>
      <div class="ac__kpi">
        <span>Coste asumido por comercios</span>
        <strong>{{ totalComercios() | currency: 'EUR' }}</strong>
      </div>
      <div class="ac__kpi">
        <span>Cupones canjeados</span>
        <strong>{{ totalUsos() }}</strong>
      </div>
    </div>

    <div class="ac__tabla-wrap">
      <table class="ac__tabla">
        <thead>
          <tr>
            <th scope="col">Campaña</th>
            <th scope="col">Vigencia</th>
            <th scope="col">Envíos</th>
            <th scope="col">Cupones</th>
            <th scope="col">Usos</th>
            <th scope="col">Conversión</th>
            <th scope="col">Coste plataforma</th>
            <th scope="col">Coste comercios</th>
            <th scope="col"></th>
          </tr>
        </thead>
        <tbody>
          @for (m of metricas(); track m.campanaId) {
            <tr [class.is-inactiva]="!m.activa">
              <th scope="row">{{ m.nombre }}</th>
              <td>{{ vigenciaDe(m.campanaId) }}</td>
              <td>{{ m.enviados }}</td>
              <td>{{ m.cupones }}</td>
              <td>{{ m.usos }}</td>
              <td>{{ m.tasaConversion }}%</td>
              <td class="ac__coste">{{ m.costePlataforma | currency: 'EUR' }}</td>
              <td>{{ m.costeComercios | currency: 'EUR' }}</td>
              <td>
                <button type="button" class="rs-btn rs-btn--ghost rs-btn--sm"
                        [disabled]="guardando()" (click)="alternarActiva(m)">
                  {{ m.activa ? 'Desactivar' : 'Activar' }}
                </button>
              </td>
            </tr>
          }
        </tbody>
      </table>
    </div>
  }
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

    .ac__form { padding: var(--sp-5); margin-bottom: var(--sp-6); }
    .ac__form-campos {
      display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
      gap: var(--sp-4); margin-bottom: var(--sp-4);
    }

    .ac__cargando { color: var(--t-400); }
    .ac__vacio {
      display: flex; flex-direction: column; align-items: center; gap: var(--sp-3);
      padding: var(--sp-16) var(--sp-4); color: var(--t-400); text-align: center;
    }

    .ac__resumen {
      display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
      gap: var(--sp-4); margin-bottom: var(--sp-5);
    }
    .ac__kpi {
      display: flex; flex-direction: column; gap: var(--sp-1);
      padding: var(--sp-4);
      background: var(--c-card); border: 1px solid var(--b-1); border-radius: var(--r-lg);
      span { font-size: var(--f-xs); color: var(--t-400); }
      strong { font-size: var(--f-xl); color: var(--dk-blue); }
    }

    .ac__tabla-wrap {
      overflow-x: auto;
      background: var(--c-card); border: 1px solid var(--b-1); border-radius: var(--r-lg);
    }
    .ac__tabla {
      width: 100%; border-collapse: collapse; min-width: 860px;
      th, td { padding: var(--sp-3) var(--sp-4); text-align: left; font-size: var(--f-sm); }
      thead th { color: var(--dk-blue); font-weight: var(--w-7); border-bottom: 1px solid var(--b-1); white-space: nowrap; }
      tbody th { color: var(--t-100); font-weight: var(--w-6); }
      tbody td { color: var(--t-300); }
      tbody tr + tr { border-top: 1px solid var(--b-1); }
      tbody tr.is-inactiva { opacity: .55; }
    }
    .ac__coste { color: var(--dk-blue); font-weight: var(--w-6); }
  `],
})
export class AdminCampanasComponent implements OnInit {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiUrl}/campanas`;

  readonly campanas = signal<CampanaApi[]>([]);
  readonly metricas = signal<MetricaApi[]>([]);
  readonly cargando = signal(true);
  readonly guardando = signal(false);
  readonly error = signal('');
  readonly formularioAbierto = signal(false);

  readonly totalPlataforma = computed(() =>
    Math.round(this.metricas().reduce((s, m) => s + m.costePlataforma, 0) * 100) / 100,
  );
  readonly totalComercios = computed(() =>
    Math.round(this.metricas().reduce((s, m) => s + m.costeComercios, 0) * 100) / 100,
  );
  readonly totalUsos = computed(() => this.metricas().reduce((s, m) => s + m.usos, 0));

  nombre = '';
  descripcion = '';
  desde = '';
  hasta = '';

  async ngOnInit(): Promise<void> {
    await this.cargar();
  }

  alternarFormulario(): void {
    this.formularioAbierto.update((abierto) => !abierto);
    this.error.set('');
  }

  vigenciaDe(campanaId: string): string {
    const campana = this.campanas().find((c) => c._id === campanaId);
    if (!campana) return '';

    const fmt = (iso: string): string => new Date(iso).toLocaleDateString('es-ES');
    return `${fmt(campana.desde)} – ${fmt(campana.hasta)}`;
  }

  async crear(): Promise<void> {
    if (!this.nombre.trim() || !this.desde || !this.hasta) {
      this.error.set('El nombre y la vigencia son obligatorios.');
      return;
    }

    this.guardando.set(true);
    this.error.set('');
    try {
      await firstValueFrom(this.http.post(this.base, {
        nombre: this.nombre.trim(),
        descripcion: this.descripcion.trim() || undefined,
        desde: this.desde,
        hasta: this.hasta,
      }));
      this.nombre = ''; this.descripcion = ''; this.desde = ''; this.hasta = '';
      this.formularioAbierto.set(false);
      await this.cargar();
    } catch (e) {
      const mensaje = (e as { error?: { message?: string } })?.error?.message;
      this.error.set(mensaje ?? 'No se pudo crear la campaña.');
    } finally {
      this.guardando.set(false);
    }
  }

  async alternarActiva(metrica: MetricaApi): Promise<void> {
    const campana = this.campanas().find((c) => c._id === metrica.campanaId);
    if (!campana) return;

    this.guardando.set(true);
    try {
      await firstValueFrom(this.http.patch(`${this.base}/${campana._id}`, {
        nombre: campana.nombre,
        desde: campana.desde,
        hasta: campana.hasta,
        activa: !campana.activa,
      }));
      await this.cargar();
    } catch {
      this.error.set('No se pudo actualizar la campaña.');
    } finally {
      this.guardando.set(false);
    }
  }

  private async cargar(): Promise<void> {
    this.cargando.set(true);
    try {
      const [campanas, metricas] = await Promise.all([
        firstValueFrom(this.http.get<CampanaApi[]>(this.base)),
        firstValueFrom(this.http.get<MetricaApi[]>(`${this.base}/metricas`)),
      ]);
      this.campanas.set(campanas);
      this.metricas.set(metricas);
    } catch {
      this.error.set('No se pudieron cargar las campañas.');
    } finally {
      this.cargando.set(false);
    }
  }
}
