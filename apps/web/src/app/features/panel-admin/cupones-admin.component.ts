import { Component, OnInit, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { firstValueFrom } from 'rxjs';
import { RsNavbarComponent } from '../../shared/components/navbar/rs-navbar.component';
import { CuponesAdminService, Cupon } from './services/cupones-admin.service';
import { AdminApiService } from './admin-api.service';

@Component({
  selector: 'app-cupones-admin',
  standalone: true,
  imports: [RouterLink, RsNavbarComponent, ReactiveFormsModule],
  template: `
<div style="min-height:100vh;background:var(--c-base)">
  <rs-navbar />
  <div class="rs-wrap" style="padding-block:var(--sp-10);max-width:1100px">

    <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:var(--sp-4);margin-bottom:var(--sp-8);flex-wrap:wrap">
      <div>
        <a routerLink="/admin" class="back-link">← Panel admin</a>
        <h1 style="font-size:var(--f-3xl);font-weight:var(--w-9);color:var(--t-100)">🎟️ Cupones</h1>
        <p style="color:var(--t-400)">Crea y gestiona promociones de descuento.</p>
      </div>
      <div class="page-kpi rs-card">
        <span class="kpi-num">{{ cupones().length }}</span>
        <span class="kpi-lbl">cupones</span>
      </div>
    </div>

    <div class="cupones-grid">
      <!-- CREAR -->
      <div class="rs-card" style="padding:var(--sp-6);height:fit-content">
        <h3 class="section-title">{{ editandoId() ? '✏️ Editar cupón' : '➕ Nuevo cupón' }}</h3>
        <form [formGroup]="form" (ngSubmit)="guardar()">
          <div class="rs-form-group">
            <label class="rs-label">Código</label>
            <input formControlName="codigo" class="rs-input" placeholder="VERANO20" style="text-transform:uppercase"
              [attr.readonly]="editandoId() ? true : null" />
          </div>
          <div class="form-2">
            <div class="rs-form-group">
              <label class="rs-label">Tipo</label>
              <select formControlName="tipo" class="rs-input">
                <option value="porcentaje">Porcentaje</option>
                <option value="fijo">Importe fijo</option>
              </select>
            </div>
            <div class="rs-form-group">
              <label class="rs-label">{{ form.value.tipo === 'porcentaje' ? 'Valor (0–1)' : 'Importe S/' }}</label>
              <input formControlName="valor" type="number" step="0.01" class="rs-input" placeholder="0.2" />
            </div>
          </div>
          <div class="form-2">
            <div class="rs-form-group">
              <label class="rs-label">Vertical</label>
              <select formControlName="vertical" class="rs-input">
                <option value="global">Todas</option>
                <option value="alojamiento">Alojamiento canino</option>
                <option value="transporte">Transporte de animales</option>
                <option value="veterinaria">Veterinarios</option>
                <option value="peluqueria">Peluquerías caninas</option>
                <option value="adiestramiento">Adiestramiento canino</option>
              </select>
            </div>
            <div class="rs-form-group">
              <label class="rs-label">Monto mínimo S/</label>
              <input formControlName="montoMinimo" type="number" class="rs-input" placeholder="0" />
            </div>
          </div>
          <div class="form-2">
            <div class="rs-form-group">
              <label class="rs-label">Tope descuento S/ (0 = sin tope)</label>
              <input formControlName="topeDescuento" type="number" class="rs-input" placeholder="0" />
            </div>
            <div class="rs-form-group">
              <label class="rs-label">Máx. usos (0 = ilimitado)</label>
              <input formControlName="usoMaximo" type="number" class="rs-input" placeholder="0" />
            </div>
          </div>
          <div class="rs-form-group">
            <label class="rs-label">Descripción</label>
            <input formControlName="descripcion" class="rs-input" placeholder="Descripción opcional" />
          </div>
          @if (formError()) { <div class="rs-alert rs-alert--error" style="margin-bottom:var(--sp-4)">{{ formError() }}</div> }
          @if (formOk()) { <div class="rs-alert rs-alert--success" style="margin-bottom:var(--sp-4)">✓ {{ formOk() }}</div> }
          <div style="display:flex;gap:var(--sp-3)">
            @if (editandoId()) {
              <button type="button" class="rs-btn rs-btn--ghost rs-btn--block" (click)="cancelarEdicion()">Cancelar</button>
            }
            <button type="submit" class="rs-btn rs-btn--primary rs-btn--block" [disabled]="form.invalid || guardando()">
              {{ guardando() ? 'Guardando…' : (editandoId() ? 'Guardar cambios' : 'Crear cupón') }}
            </button>
          </div>
        </form>
      </div>

      <!-- LISTA -->
      <div class="rs-card" style="padding:var(--sp-6)">
        <h3 class="section-title">Cupones registrados</h3>
        @if (cargando()) { <p style="color:var(--t-400)">Cargando…</p> }
        @else if (cupones().length === 0) { <p style="color:var(--t-400)">Aún no hay cupones.</p> }
        @else {
          @for (c of cupones(); track c._id ?? c.codigo) {
            <div class="cupon-row" [class.cupon-row--inactivo]="!c.activo">
              <div class="cupon-info">
                <div class="cupon-codigo">{{ c.codigo }}</div>
                <div class="cupon-meta">
                  {{ c.tipo === 'porcentaje' ? (c.valor * 100).toFixed(0) + '%' : 'S/ ' + c.valor }}
                  · {{ c.vertical }}
                  @if ((c.usoMaximo ?? 0) > 0) { · máx {{ c.usoMaximo }} usos }
                </div>
                <div class="cupon-uso">
                  {{ c.usados ?? 0 }} usos
                  @if ((c.usoMaximo ?? 0) > 0) { / {{ c.usoMaximo }} }
                </div>
              </div>
              <div class="cupon-acciones">
                <span class="rs-badge" [class]="c.activo ? 'rs-badge--success' : 'rs-badge--neutral'">
                  {{ c.activo ? 'Activo' : 'Inactivo' }}
                </span>
                <button class="rs-btn rs-btn--ghost rs-btn--sm" title="Editar"
                  (click)="iniciarEdicion(c)">✏️</button>
                <button class="rs-btn rs-btn--ghost rs-btn--sm"
                  [title]="c.activo ? 'Desactivar' : 'Activar'"
                  (click)="toggleActivo(c)">{{ c.activo ? '⏸️' : '▶️' }}</button>
                <button class="rs-btn rs-btn--ghost rs-btn--sm" style="color:#F87171" title="Eliminar"
                  (click)="confirmarEliminar(c)">🗑️</button>
              </div>
            </div>
          }
        }
      </div>
    </div>
  </div>
</div>

<!-- MODAL CONFIRMAR ELIMINAR -->
@if (eliminarCupon()) {
  <div class="overlay" (click)="cancelarEliminar()">
    <div class="modal rs-card" (click)="$event.stopPropagation()">
      <h2 class="modal-title">Eliminar cupón</h2>
      <p style="color:var(--t-300);margin-bottom:var(--sp-5)">
        ¿Estás seguro de que quieres eliminar el cupón
        <strong style="color:var(--t-100);font-family:monospace">{{ eliminarCupon()!.codigo }}</strong>?
        Esta acción no se puede deshacer.
      </p>
      @if (deleteError()) {
        <div class="rs-alert rs-alert--error" style="margin-bottom:var(--sp-4)">{{ deleteError() }}</div>
      }
      <div class="modal-actions">
        <button class="rs-btn rs-btn--ghost" (click)="cancelarEliminar()">Cancelar</button>
        <button class="rs-btn rs-btn--danger" [disabled]="guardando()" (click)="ejecutarEliminar()">
          {{ guardando() ? 'Eliminando…' : 'Eliminar' }}
        </button>
      </div>
    </div>
  </div>
}
  `,
  styles: [`
    :host { display: block; }
    .back-link { font-size: var(--f-sm); color: var(--c-accent); text-decoration: none; display: inline-block; margin-bottom: var(--sp-2); }
    .back-link:hover { text-decoration: underline; }
    .page-kpi { padding: var(--sp-4) var(--sp-6); text-align: center; min-width: 100px; }
    .kpi-num { display: block; font-size: var(--f-2xl); font-weight: var(--w-8); color: var(--t-100); }
    .kpi-lbl { font-size: var(--f-xs); color: var(--t-400); text-transform: uppercase; letter-spacing: .06em; }
    .section-title { font-size: var(--f-md); font-weight: var(--w-7); color: var(--t-100); margin-bottom: var(--sp-5); }

    .cupones-grid { display: grid; grid-template-columns: 380px 1fr; gap: var(--sp-6); align-items: start; }
    @media (max-width: 900px) { .cupones-grid { grid-template-columns: 1fr; } }
    .rs-form-group { margin-bottom: var(--sp-4); }
    .form-2 { display: grid; grid-template-columns: 1fr 1fr; gap: var(--sp-3); }

    .cupon-row { display: flex; align-items: center; justify-content: space-between; gap: var(--sp-3); padding: var(--sp-3) 0; border-bottom: 1px solid var(--b-1); }
    .cupon-row:last-child { border: none; }
    .cupon-row--inactivo { opacity: .55; }
    .cupon-info { flex: 1; min-width: 0; }
    .cupon-codigo { font-weight: var(--w-7); color: var(--t-100); font-family: monospace; }
    .cupon-meta { font-size: var(--f-xs); color: var(--t-400); margin-top: 2px; }
    .cupon-uso { font-size: var(--f-xs); color: var(--t-500); margin-top: 2px; }
    .cupon-acciones { display: flex; align-items: center; gap: var(--sp-1); flex-shrink: 0; }

    .overlay { position: fixed; inset: 0; background: rgba(0,0,0,.6); display: flex; align-items: center; justify-content: center; z-index: 1000; padding: var(--sp-4); }
    .modal { width: 100%; max-width: 420px; padding: var(--sp-8); }
    .modal-title { font-size: var(--f-xl); font-weight: var(--w-8); color: var(--t-100); margin-bottom: var(--sp-6); }
    .modal-actions { display: flex; gap: var(--sp-3); justify-content: flex-end; }
  `],
})
export class CuponesAdminComponent implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly service = inject(CuponesAdminService);
  private readonly adminApi = inject(AdminApiService);

  readonly cupones = signal<Cupon[]>([]);
  readonly cargando = signal(true);
  readonly guardando = signal(false);
  readonly formError = signal<string | null>(null);
  readonly formOk = signal<string | null>(null);
  readonly editandoId = signal<string | null>(null);
  readonly eliminarCupon = signal<Cupon | null>(null);
  readonly deleteError = signal('');

  readonly form = this.fb.group({
    codigo: ['', Validators.required],
    tipo: ['porcentaje' as 'porcentaje' | 'fijo', Validators.required],
    valor: [0.2, [Validators.required, Validators.min(0)]],
    vertical: ['global', Validators.required],
    montoMinimo: [0],
    topeDescuento: [0],
    usoMaximo: [0],
    descripcion: [''],
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

  async guardar(): Promise<void> {
    if (this.form.invalid) return;
    this.guardando.set(true);
    this.formError.set(null);
    this.formOk.set(null);
    const v = this.form.value;
    try {
      if (this.editandoId()) {
        await firstValueFrom(this.adminApi.actualizarCupon(this.editandoId()!, {
          tipo: v.tipo,
          valor: Number(v.valor),
          vertical: v.vertical,
          montoMinimo: Number(v.montoMinimo) || 0,
          topeDescuento: Number(v.topeDescuento) || 0,
          usoMaximo: Number(v.usoMaximo) || 0,
          descripcion: v.descripcion || undefined,
        }));
        this.formOk.set('Cupón actualizado correctamente.');
        this.cancelarEdicion();
      } else {
        await this.service.crear({
          codigo: (v.codigo ?? '').toUpperCase(),
          tipo: v.tipo ?? 'porcentaje',
          valor: Number(v.valor),
          vertical: v.vertical ?? 'global',
          montoMinimo: Number(v.montoMinimo) || 0,
        });
        this.formOk.set('Cupón creado correctamente.');
        this.form.patchValue({ codigo: '' });
      }
      await this.cargar();
    } catch {
      this.formError.set(this.editandoId()
        ? 'No se pudo actualizar el cupón.'
        : 'No se pudo crear el cupón (¿código duplicado o sin permisos?).');
    } finally {
      this.guardando.set(false);
    }
  }

  iniciarEdicion(c: Cupon): void {
    this.editandoId.set(c._id ?? c.codigo);
    this.form.patchValue({
      codigo: c.codigo,
      tipo: c.tipo,
      valor: c.valor,
      vertical: c.vertical,
      montoMinimo: c.montoMinimo,
      topeDescuento: c.topeDescuento ?? 0,
      usoMaximo: c.usoMaximo ?? 0,
      descripcion: c.descripcion ?? '',
    });
    this.formError.set(null);
    this.formOk.set(null);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  cancelarEdicion(): void {
    this.editandoId.set(null);
    this.form.reset({ tipo: 'porcentaje', valor: 0.2, vertical: 'global', montoMinimo: 0, topeDescuento: 0, usoMaximo: 0 });
    this.formError.set(null);
    this.formOk.set(null);
  }

  async toggleActivo(c: Cupon): Promise<void> {
    const id = c._id;
    if (!id) return;
    try {
      await firstValueFrom(this.adminApi.actualizarCupon(id, { activo: !c.activo }));
      await this.cargar();
    } catch {
      // silently fail - user sees no change
    }
  }

  confirmarEliminar(c: Cupon): void {
    this.eliminarCupon.set(c);
    this.deleteError.set('');
  }

  cancelarEliminar(): void {
    this.eliminarCupon.set(null);
  }

  async ejecutarEliminar(): Promise<void> {
    const c = this.eliminarCupon();
    if (!c) return;
    const id = c._id;
    if (!id) return;
    this.guardando.set(true);
    this.deleteError.set('');
    try {
      await firstValueFrom(this.adminApi.eliminarCupon(id));
      this.eliminarCupon.set(null);
      await this.cargar();
    } catch {
      this.deleteError.set('Error eliminando el cupón.');
    } finally {
      this.guardando.set(false);
    }
  }
}
