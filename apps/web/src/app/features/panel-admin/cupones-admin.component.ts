import { Component, OnInit, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { RsNavbarComponent } from '../../shared/components/navbar/rs-navbar.component';
import { CuponesAdminService, Cupon } from './services/cupones-admin.service';

@Component({
  selector: 'app-cupones-admin',
  standalone: true,
  imports: [ReactiveFormsModule, RsNavbarComponent],
  template: `
<div style="min-height:100vh;background:var(--c-base)">
  <rs-navbar />
  <div class="rs-wrap" style="padding-block:var(--sp-10);max-width:var(--w-lg)">

    <div style="margin-bottom:var(--sp-8)">
      <h1 style="font-size:var(--f-3xl);font-weight:var(--w-9);color:var(--t-100)">🎟️ Cupones</h1>
      <p style="color:var(--t-400)">Crea y gestiona promociones de descuento.</p>
    </div>

    <div class="cupones-grid">
      <!-- Crear -->
      <div class="rs-card" style="padding:var(--sp-6);height:fit-content">
        <h3 style="font-size:var(--f-md);font-weight:var(--w-7);color:var(--t-100);margin-bottom:var(--sp-5)">Nuevo cupón</h3>
        <form [formGroup]="form" (ngSubmit)="crear()">
          <div class="rs-field"><label class="rs-lbl">Código</label>
            <input formControlName="codigo" class="rs-inp" placeholder="VERANO20" style="text-transform:uppercase" /></div>
          <div class="form-2">
            <div class="rs-field"><label class="rs-lbl">Tipo</label>
              <select formControlName="tipo" class="rs-inp">
                <option value="porcentaje">Porcentaje</option>
                <option value="fijo">Importe fijo (€)</option>
              </select></div>
            <div class="rs-field"><label class="rs-lbl">{{ form.value.tipo === 'porcentaje' ? 'Valor (0–1)' : 'Importe €' }}</label>
              <input formControlName="valor" type="number" step="0.01" class="rs-inp" placeholder="0.2" /></div>
          </div>
          <div class="form-2">
            <div class="rs-field"><label class="rs-lbl">Vertical</label>
              <select formControlName="vertical" class="rs-inp">
                <option value="global">Todos</option>
                <option value="hoteles">Hoteles</option>
                <option value="taxis">Taxis</option>
                <option value="vuelos">Vuelos</option>
                <option value="transporte">Transporte</option>
                <option value="guarderia">Guardería</option>
              </select></div>
            <div class="rs-field"><label class="rs-lbl">Monto mínimo €</label>
              <input formControlName="montoMinimo" type="number" class="rs-inp" placeholder="0" /></div>
          </div>
          @if (error()) { <div class="rs-alert rs-alert--error" style="margin-bottom:var(--sp-4)">{{ error() }}</div> }
          @if (ok()) { <div class="rs-alert rs-alert--success" style="margin-bottom:var(--sp-4)">✓ Cupón creado</div> }
          <button type="submit" class="rs-btn rs-btn--primary rs-btn--block" [disabled]="form.invalid || guardando()">
            {{ guardando() ? 'Creando…' : 'Crear cupón' }}
          </button>
        </form>
      </div>

      <!-- Lista -->
      <div class="rs-card" style="padding:var(--sp-6)">
        <h3 style="font-size:var(--f-md);font-weight:var(--w-7);color:var(--t-100);margin-bottom:var(--sp-5)">Cupones activos</h3>
        @if (cargando()) { <p style="color:var(--t-400)">Cargando…</p> }
        @else {
          @for (c of cupones(); track c.codigo) {
            <div class="cupon-row">
              <div>
                <div style="font-weight:var(--w-7);color:var(--t-100);font-family:monospace">{{ c.codigo }}</div>
                <div style="font-size:var(--f-xs);color:var(--t-400)">
                  {{ c.tipo === 'porcentaje' ? (c.valor * 100) + '%' : '€' + c.valor }} · {{ c.vertical }}
                </div>
              </div>
              <span class="rs-badge" [class]="c.activo ? 'rs-badge--success' : 'rs-badge--neutral'">
                {{ c.usados ?? 0 }} usos
              </span>
            </div>
          }
          @if (cupones().length === 0) { <p style="color:var(--t-400)">Aún no hay cupones.</p> }
        }
      </div>
    </div>
  </div>
</div>
  `,
  styles: [`
    .cupones-grid { display: grid; grid-template-columns: 380px 1fr; gap: var(--sp-6); align-items: start; @media (max-width: 900px) { grid-template-columns: 1fr; } }
    .rs-field { margin-bottom: var(--sp-4); }
    .form-2 { display: grid; grid-template-columns: 1fr 1fr; gap: var(--sp-3); }
    .cupon-row { display: flex; align-items: center; justify-content: space-between; padding: var(--sp-3) 0; border-bottom: 1px solid var(--b-1); &:last-child { border: none; } }
  `],
})
export class CuponesAdminComponent implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly service = inject(CuponesAdminService);

  readonly cupones = signal<Cupon[]>([]);
  readonly cargando = signal(true);
  readonly guardando = signal(false);
  readonly error = signal<string | null>(null);
  readonly ok = signal(false);

  readonly form = this.fb.group({
    codigo: ['', Validators.required],
    tipo: ['porcentaje' as 'porcentaje' | 'fijo', Validators.required],
    valor: [0.2, [Validators.required, Validators.min(0)]],
    vertical: ['global', Validators.required],
    montoMinimo: [0],
  });

  ngOnInit(): void {
    void this.cargar();
  }

  private async cargar(): Promise<void> {
    this.cargando.set(true);
    try {
      this.cupones.set(await this.service.listar());
    } catch {
      this.cupones.set([]);
    } finally {
      this.cargando.set(false);
    }
  }

  async crear(): Promise<void> {
    if (this.form.invalid) return;
    this.guardando.set(true);
    this.error.set(null);
    this.ok.set(false);
    try {
      const v = this.form.value;
      await this.service.crear({
        codigo: (v.codigo ?? '').toUpperCase(),
        tipo: v.tipo ?? 'porcentaje',
        valor: Number(v.valor),
        vertical: v.vertical ?? 'global',
        montoMinimo: Number(v.montoMinimo) || 0,
      });
      this.ok.set(true);
      this.form.patchValue({ codigo: '' });
      await this.cargar();
    } catch {
      this.error.set('No se pudo crear el cupón (¿código duplicado o sin permisos de admin?).');
    } finally {
      this.guardando.set(false);
    }
  }
}
