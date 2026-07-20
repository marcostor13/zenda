import { Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { DecimalPipe } from '@angular/common';
import { firstValueFrom } from 'rxjs';
import { RsIconComponent } from '../../shared/components/icon/rs-icon.component';
import { ComercioApiService, SuplementoConfig } from './comercio-api.service';

const UNIDAD_LABEL: Record<string, string> = {
  fijo: 'Importe fijo',
  por_dia: '€ / día',
  por_noche: '€ / noche',
};

@Component({
  selector: 'app-comercio-suplementos',
  standalone: true,
  imports: [FormsModule, DecimalPipe, RsIconComponent],
  template: `
    <div class="page-header">
      <div>
        <h1 class="page-title">Suplementos</h1>
        <p class="page-sub">
          Predefine los suplementos que puedes solicitar en recepción cuando el estado real del animal difiere de lo
          reservado (nudos severos, segunda mascota, etc.). El cliente siempre debe aprobar el cargo antes de cobrarse.
        </p>
      </div>
    </div>

    <div class="rs-card" style="padding:var(--sp-6);margin-bottom:var(--sp-6)">
      <h2 class="section-title">Nuevo suplemento</h2>
      <div class="form-row">
        <div class="rs-field">
          <label class="rs-lbl">Concepto</label>
          <input class="rs-inp" [(ngModel)]="nuevoConcepto" placeholder="Ej. Nudos severos" />
        </div>
        <div class="rs-field">
          <label class="rs-lbl">Importe (€)</label>
          <input type="number" min="0.01" step="0.01" class="rs-inp" [(ngModel)]="nuevoMonto" />
        </div>
        <div class="rs-field">
          <label class="rs-lbl">Unidad</label>
          <select class="rs-inp" [(ngModel)]="nuevaUnidad">
            <option value="fijo">Importe fijo</option>
            <option value="por_dia">€ / día</option>
            <option value="por_noche">€ / noche</option>
          </select>
        </div>
        <div class="rs-field" style="flex:0;align-self:flex-end">
          <button class="rs-btn rs-btn--primary" [disabled]="creando()" (click)="crear()">
            {{ creando() ? 'Guardando…' : 'Añadir' }}
          </button>
        </div>
      </div>
    </div>

    @if (cargando()) {
      <div class="rs-card" style="padding:var(--sp-16);text-align:center;color:var(--t-400)">Cargando…</div>
    } @else if (suplementos().length === 0) {
      <div class="rs-card empty-state">
        <rs-icon name="tag" [size]="36" [stroke]="1.25" style="color:var(--t-400)"></rs-icon>
        <p>Aún no has configurado ningún suplemento.</p>
      </div>
    } @else {
      <div class="rs-card" style="overflow-x:auto">
        <table class="rs-table">
          <thead>
            <tr><th>Concepto</th><th>Importe</th><th>Unidad</th><th>Estado</th><th></th></tr>
          </thead>
          <tbody>
            @for (s of suplementos(); track s._id) {
              <tr>
                <td>{{ s.concepto }}</td>
                <td>€{{ s.monto | number:'1.2-2' }}</td>
                <td>{{ unidadLabel(s.unidad) }}</td>
                <td>
                  <span class="rs-badge" [class.rs-badge--success]="s.activo" [class.rs-badge--neutral]="!s.activo">
                    {{ s.activo ? 'Activo' : 'Inactivo' }}
                  </span>
                </td>
                <td style="display:flex;gap:var(--sp-2)">
                  <button class="rs-btn rs-btn--outline rs-btn--sm" (click)="toggleActivo(s)">
                    {{ s.activo ? 'Desactivar' : 'Activar' }}
                  </button>
                  <button class="rs-btn rs-btn--ghost rs-btn--sm" [disabled]="eliminandoId() === s._id" (click)="eliminar(s)">
                    Eliminar
                  </button>
                </td>
              </tr>
            }
          </tbody>
        </table>
      </div>
    }

    @if (errorMsg()) {
      <div class="rs-alert rs-alert--error" style="margin-top:var(--sp-4)">{{ errorMsg() }}</div>
    }
  `,
  styles: [`
    :host { display: contents; }
    .page-header { margin-bottom: var(--sp-2); }
    .page-title { font-size: var(--f-2xl); font-weight: var(--w-8); color: var(--t-100); margin-bottom: var(--sp-1); }
    .page-sub { color: var(--t-400); font-size: var(--f-sm); max-width: 640px; }
    .section-title { font-size: var(--f-md); font-weight: var(--w-7); color: var(--t-100); margin-bottom: var(--sp-4); }
    .form-row { display: flex; gap: var(--sp-4); flex-wrap: wrap; align-items: flex-end; }
    .form-row .rs-field { flex: 1; min-width: 160px; }
    .empty-state { padding: var(--sp-16); text-align: center; display: flex; flex-direction: column; align-items: center; gap: var(--sp-4); p { color: var(--t-400); } }
    .rs-table { width: 100%; border-collapse: collapse; font-size: var(--f-sm);
      th { color: var(--t-400); text-align: left; padding: var(--sp-3) var(--sp-4); border-bottom: 1px solid var(--b-1); font-size: var(--f-xs); text-transform: uppercase; letter-spacing: .06em; }
      td { padding: var(--sp-4); border-bottom: 1px solid var(--b-1); color: var(--t-200); white-space: nowrap; }
      tr:last-child td { border-bottom: none; }
    }
  `],
})
export class ComercioSuplementosComponent implements OnInit {
  private readonly comercioApi = inject(ComercioApiService);

  readonly cargando = signal(true);
  readonly creando = signal(false);
  readonly eliminandoId = signal<string | null>(null);
  readonly errorMsg = signal('');
  readonly suplementos = signal<SuplementoConfig[]>([]);

  nuevoConcepto = '';
  nuevoMonto: number | null = null;
  nuevaUnidad: 'fijo' | 'por_dia' | 'por_noche' = 'fijo';

  async ngOnInit(): Promise<void> {
    try {
      this.suplementos.set(await firstValueFrom(this.comercioApi.getMisSuplementos()));
    } catch {
      this.errorMsg.set('No se pudieron cargar los suplementos.');
    } finally {
      this.cargando.set(false);
    }
  }

  unidadLabel(u: string): string {
    return UNIDAD_LABEL[u] ?? u;
  }

  async crear(): Promise<void> {
    if (!this.nuevoConcepto.trim() || !this.nuevoMonto || this.nuevoMonto <= 0) {
      this.errorMsg.set('Indica un concepto y un importe válido.');
      return;
    }
    this.creando.set(true);
    this.errorMsg.set('');
    try {
      const creado = await firstValueFrom(this.comercioApi.crearSuplemento({
        concepto: this.nuevoConcepto.trim(),
        monto: this.nuevoMonto,
        unidad: this.nuevaUnidad,
      }));
      this.suplementos.update((lista) => [creado, ...lista]);
      this.nuevoConcepto = '';
      this.nuevoMonto = null;
      this.nuevaUnidad = 'fijo';
    } catch {
      this.errorMsg.set('No se pudo crear el suplemento.');
    } finally {
      this.creando.set(false);
    }
  }

  async toggleActivo(s: SuplementoConfig): Promise<void> {
    try {
      const actualizado = await firstValueFrom(this.comercioApi.actualizarSuplemento(s._id, { activo: !s.activo }));
      this.suplementos.update((lista) => lista.map((x) => (x._id === s._id ? actualizado : x)));
    } catch {
      this.errorMsg.set('No se pudo actualizar el suplemento.');
    }
  }

  async eliminar(s: SuplementoConfig): Promise<void> {
    this.eliminandoId.set(s._id);
    try {
      await firstValueFrom(this.comercioApi.eliminarSuplemento(s._id));
      this.suplementos.update((lista) => lista.filter((x) => x._id !== s._id));
    } catch {
      this.errorMsg.set('No se pudo eliminar el suplemento.');
    } finally {
      this.eliminandoId.set(null);
    }
  }
}
