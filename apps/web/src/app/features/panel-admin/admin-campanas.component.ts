import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { CurrencyPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { RsIconComponent } from '../../shared/components/icon/rs-icon.component';
import { environment } from '../../../environments/environment';
import { TraducirPipe } from '../../core/i18n/traducir.pipe';
import {
  OBJETIVO_CAMPANA_LABELS, ObjetivoCampana,
  SEGMENTO_CAMPANA_LABELS, SegmentoCampana,
} from 'shared';

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
  imports: [
    TraducirPipe, CurrencyPipe, FormsModule, RsIconComponent
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
<div class="ac">
  <header class="ac__head">
    <div>
      <h1>{{ 'Campañas' | t }}</h1>
      <p>{{ 'Gestiona, segmenta y analiza las campañas promocionales de Doogking.' | t }}</p>
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
          <label class="rs-lbl" for="ca-nombre">{{ 'Nombre *' | t }}</label>
          <input id="ca-nombre" class="rs-inp" [(ngModel)]="nombre" [placeholder]="'Ej. Vuelta al cole 2026' | t" />
        </div>
        <div class="rs-field">
          <label class="rs-lbl" for="ca-desde">{{ 'Desde *' | t }}</label>
          <input id="ca-desde" type="date" class="rs-inp" [(ngModel)]="desde" />
        </div>
        <div class="rs-field">
          <label class="rs-lbl" for="ca-hasta">{{ 'Hasta *' | t }}</label>
          <input id="ca-hasta" type="date" class="rs-inp" [(ngModel)]="hasta" />
        </div>
      </div>
      <!-- Objetivo y segmento: sin esto no se puede comparar qué funciona (TCK-8038) -->
      <div class="ac__form-campos">
        <div class="rs-field">
          <label class="rs-lbl" for="ca-objetivo">{{ 'Objetivo' | t }}</label>
          <select id="ca-objetivo" class="rs-inp" [(ngModel)]="objetivo">
            <option value="">{{ 'Sin definir' | t }}</option>
            @for (o of objetivos; track o.valor) {
              <option [value]="o.valor">{{ o.label | t }}</option>
            }
          </select>
        </div>
        <div class="rs-field">
          <label class="rs-lbl" for="ca-segmento">{{ 'A quién se dirige' | t }}</label>
          <select id="ca-segmento" class="rs-inp" [(ngModel)]="segmento">
            @for (sg of segmentos; track sg.valor) {
              <option [value]="sg.valor">{{ sg.label | t }}</option>
            }
          </select>
        </div>
        <div class="rs-field">
          <label class="rs-lbl" for="ca-detalle">{{ 'Ciudad o categoría (opcional)' | t }}</label>
          <input id="ca-detalle" class="rs-inp" [(ngModel)]="segmentoDetalle"
                 [placeholder]="'Ej. Valencia o peluquería' | t" />
        </div>
      </div>

      <div class="rs-field">
        <label class="rs-lbl" for="ca-desc">{{ 'Descripción' | t }}</label>
        <input id="ca-desc" class="rs-inp" [(ngModel)]="descripcion" />
      </div>

      @if (error()) { <div class="rs-alert rs-alert--error">{{ error() }}</div> }

      <button type="button" class="rs-btn rs-btn--primary" [disabled]="guardando()" (click)="crear()">
        {{ guardando() ? 'Creando…' : 'Crear campaña' }}
      </button>
    </div>
  }

  @if (cargando()) {
    <p class="ac__cargando">{{ 'Cargando campañas…' | t }}</p>
  } @else if (!metricas().length) {
    <!-- Estado vacío trabajado: qué es una campaña y para qué sirve (TCK-8038) -->
    <div class="ac__vacio">
      <rs-icon name="tag" [size]="36" [stroke]="1.5"></rs-icon>
      <p class="ac__vacio-titulo">{{ 'Aún no has creado ninguna campaña' | t }}</p>
      <p class="ac__vacio-texto">
        {{ 'Crea tu primera campaña para captar nuevos usuarios, aumentar las reservas o reactivar clientes.' | t }}
      </p>
      <button type="button" class="rs-btn rs-btn--primary" (click)="formularioAbierto.set(true)">
        <rs-icon name="plus" [size]="15" [stroke]="2.5"></rs-icon> {{ 'Crear primera campaña' | t }}
      </button>
      <div class="ac__ejemplos">
        <span class="ac__ejemplo">{{ 'Captar nuevos clientes' | t }}</span>
        <span class="ac__ejemplo">{{ 'Aumentar reservas' | t }}</span>
        <span class="ac__ejemplo">{{ 'Reactivar usuarios' | t }}</span>
      </div>
    </div>
  } @else {
    <div class="ac__resumen">
      <div class="ac__kpi">
        <span>{{ 'Coste asumido por Doogking' | t }}</span>
        <strong>{{ totalPlataforma() | currency: 'EUR' }}</strong>
      </div>
      <div class="ac__kpi">
        <span>{{ 'Coste asumido por comercios' | t }}</span>
        <strong>{{ totalComercios() | currency: 'EUR' }}</strong>
      </div>
      <div class="ac__kpi">
        <span>{{ 'Cupones canjeados' | t }}</span>
        <strong>{{ totalUsos() }}</strong>
      </div>
    </div>

    <div class="ac__tabla-wrap">
      <table class="ac__tabla">
        <thead>
          <tr>
            <th scope="col">{{ 'Campaña' | t }}</th>
            <th scope="col">{{ 'Vigencia' | t }}</th>
            <th scope="col">{{ 'Envíos' | t }}</th>
            <th scope="col">{{ 'Cupones' | t }}</th>
            <th scope="col">{{ 'Usos' | t }}</th>
            <th scope="col">{{ 'Conversión' | t }}</th>
            <th scope="col">{{ 'Coste plataforma' | t }}</th>
            <th scope="col">{{ 'Coste comercios' | t }}</th>
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
    .ac__vacio-titulo { font-size: var(--f-md); font-weight: var(--w-7); color: var(--t-100); }
    .ac__vacio-texto { max-width: 46ch; line-height: 1.6; }
    .ac__ejemplos { display: flex; flex-wrap: wrap; gap: var(--sp-2); justify-content: center; }
    .ac__ejemplo {
      padding: var(--sp-1) var(--sp-3); border-radius: var(--r-full);
      border: 1px dashed var(--b-2); font-size: var(--f-xs); color: var(--t-400);
    }
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
  objetivo = '';
  segmento: string = SegmentoCampana.TODOS;
  segmentoDetalle = '';

  readonly objetivos = Object.values(ObjetivoCampana).map((valor) => ({
    valor, label: OBJETIVO_CAMPANA_LABELS[valor],
  }));
  readonly segmentos = Object.values(SegmentoCampana).map((valor) => ({
    valor, label: SEGMENTO_CAMPANA_LABELS[valor],
  }));

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
        objetivo: this.objetivo || undefined,
        segmento: this.segmento,
        segmentoDetalle: this.segmentoDetalle.trim() || undefined,
      }));
      this.nombre = ''; this.descripcion = ''; this.desde = ''; this.hasta = '';
      this.objetivo = ''; this.segmento = SegmentoCampana.TODOS; this.segmentoDetalle = '';
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
