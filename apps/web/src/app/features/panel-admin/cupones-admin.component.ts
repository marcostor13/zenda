import { Component, OnInit, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { RouterLink } from '@angular/router';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { firstValueFrom } from 'rxjs';
import { RsIconComponent } from '../../shared/components/icon/rs-icon.component';
import { RsNavbarComponent } from '../../shared/components/navbar/rs-navbar.component';
import { CuponesAdminService, Cupon } from './services/cupones-admin.service';
import { AdminApiService } from './admin-api.service';
import { environment } from '../../../environments/environment';

import { euros } from '../../shared/pipes/euros.pipe';
import { TraducirPipe } from '../../core/i18n/traducir.pipe';
@Component({
  selector: 'app-cupones-admin',
  standalone: true,
  imports: [
    TraducirPipe, RouterLink, RsNavbarComponent, ReactiveFormsModule, RsIconComponent
  ],
  template: `
<div class="dk-pagina">
  <rs-navbar />
  <div class="rs-wrap" style="padding-block:var(--sp-10);max-width:1100px">

    <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:var(--sp-4);margin-bottom:var(--sp-8);flex-wrap:wrap">
      <div>
        <a routerLink="/admin" class="back-link">{{ '← Panel admin' | t }}</a>
        <h1 style="font-size:var(--f-3xl);font-weight:var(--w-9);color:var(--t-100)"><rs-icon name="ticket" [size]="26" [stroke]="2"></rs-icon> {{ 'Cupones' | t }}</h1>
        <p style="color:var(--t-400)">{{ 'Crea y gestiona promociones de descuento.' | t }}</p>
      </div>
      <div class="page-kpi rs-card">
        <span class="kpi-num">{{ cupones().length }}</span>
        <span class="kpi-lbl">{{ 'cupones' | t }}</span>
      </div>
    </div>

    <div class="cupones-barra">
      <button class="rs-btn rs-btn--primary rs-btn--sm" (click)="alternarFormulario()">
        <rs-icon [name]="formularioVisible() ? 'x' : 'plus'" [size]="14" [stroke]="2.5"></rs-icon>
        {{ formularioVisible() ? 'Cerrar formulario' : 'Nuevo cupón' }}
      </button>
    </div>

    <div class="cupones-grid">
      <!-- CREAR -->
      @if (formularioVisible() || editandoId()) {
      <div class="rs-card" style="padding:var(--sp-6);height:fit-content">
        <h3 class="section-title">
          <rs-icon [name]="editandoId() ? 'pencil' : 'plus'" [size]="16" [stroke]="2"></rs-icon>
          {{ editandoId() ? 'Editar cupón' : 'Nuevo cupón' }}
        </h3>
        <form [formGroup]="form" (ngSubmit)="guardar()">
          <div class="rs-form-group">
            <label class="rs-label">{{ 'Código' | t }}</label>
            <input formControlName="codigo" class="rs-input" [placeholder]="'VERANO20' | t" style="text-transform:uppercase"
              [attr.readonly]="editandoId() ? true : null" />
          </div>
          <div class="form-2">
            <div class="rs-form-group">
              <label class="rs-label">{{ 'Tipo' | t }}</label>
              <select formControlName="tipo" class="rs-input">
                <option value="porcentaje">{{ 'Porcentaje' | t }}</option>
                <option value="fijo">{{ 'Importe fijo' | t }}</option>
              </select>
            </div>
            <!-- Un 20 % se escribe "20", no "0.2" (TCK-8037) -->
            <div class="rs-form-group">
              <label class="rs-label">{{ form.value.tipo === 'porcentaje' ? 'Descuento (%)' : 'Importe del descuento (€)' }}</label>
              <input formControlName="valor" type="number" step="1" class="rs-input"
                     [placeholder]="form.value.tipo === 'porcentaje' ? '20' : '10'" inputmode="numeric" />
            </div>
          </div>
          <div class="form-2">
            <div class="rs-form-group">
              <label class="rs-label">{{ 'Vertical' | t }}</label>
              <select formControlName="vertical" class="rs-input">
                <option value="global">{{ 'Todas' | t }}</option>
                <option value="alojamiento">{{ 'Alojamiento canino' | t }}</option>
                <option value="transporte">{{ 'Transporte de animales' | t }}</option>
                <option value="veterinaria">{{ 'Veterinarios' | t }}</option>
                <option value="peluqueria">{{ 'Peluquerías caninas' | t }}</option>
                <option value="adiestramiento">{{ 'Adiestramiento canino' | t }}</option>
              </select>
            </div>
            <div class="rs-form-group">
              <label class="rs-label">{{ 'Importe mínimo de reserva (€)' | t }}</label>
              <input formControlName="montoMinimo" type="number" class="rs-input" placeholder="0" inputmode="numeric" />
            </div>
          </div>
          <!-- Nada de "0 = sin límite": se marca la casilla y el campo desaparece -->
          <div class="form-2">
            <div class="rs-form-group">
              <label class="rs-label">{{ 'Descuento máximo (€)' | t }}</label>
              @if (!sinTope()) {
                <input formControlName="topeDescuento" type="number" class="rs-input" placeholder="0" inputmode="numeric" />
              }
              <label class="casilla">
                <input type="checkbox" [checked]="sinTope()" (change)="alternarSinTope()" /> {{ 'Sin límite' | t }}
              </label>
            </div>
            <div class="rs-form-group">
              <label class="rs-label">{{ 'Límite total de usos' | t }}</label>
              @if (!usosIlimitados()) {
                <input formControlName="usoMaximo" type="number" class="rs-input" placeholder="0" inputmode="numeric" />
              }
              <label class="casilla">
                <input type="checkbox" [checked]="usosIlimitados()" (change)="alternarUsosIlimitados()" /> {{ 'Ilimitado' | t }}
              </label>
            </div>
          </div>

          <div class="rs-form-group">
            <label class="rs-label">{{ 'Fecha de finalización' | t }}</label>
            @if (!sinCaducidad()) {
              <input formControlName="validoHasta" type="date" class="rs-input" />
            }
            <label class="casilla">
              <input type="checkbox" [checked]="sinCaducidad()" (change)="alternarSinCaducidad()" />
              {{ 'Sin fecha de caducidad' | t }}
            </label>
          </div>
          <div class="form-2">
            <div class="rs-form-group">
              <label class="rs-label">{{ 'Quién asume el descuento' | t }}</label>
              <select formControlName="asumeDescuento" class="rs-input">
                <option value="plataforma">Doogking</option>
                <option value="comercio">{{ 'El comercio' | t }}</option>
              </select>
            </div>
            <div class="rs-form-group">
              <label class="rs-label">{{ 'Quién puede usarlo' | t }}</label>
              <label class="casilla">
                <input type="checkbox" formControlName="soloPrimeraReserva" />
                {{ 'Sólo clientes nuevos (primera reserva)' | t }}
              </label>
            </div>
          </div>

          <!-- Alcance y límite por persona (TCK-8037 §5 y §6) -->
          <div class="form-2">
            <div class="rs-form-group">
              <label class="rs-label">{{ 'Dónde funciona' | t }}</label>
              <select formControlName="comercioId" class="rs-input">
                <option value="">{{ 'Toda la plataforma' | t }}</option>
                @for (c of comercios(); track c._id) {
                  <option [value]="c._id">Solo {{ c.nombreComercial }}</option>
                }
              </select>
            </div>
            <div class="rs-form-group">
              <label class="rs-label">{{ 'Ciudad (opcional)' | t }}</label>
              <input formControlName="ciudad" class="rs-input" [placeholder]="'Ej. Valencia' | t" />
            </div>
          </div>

          <div class="form-2">
            <div class="rs-form-group">
              <label class="rs-label">{{ 'Usos por persona' | t }}</label>
              @if (!usosPorUsuarioIlimitado()) {
                <input formControlName="usosPorUsuario" type="number" min="1" class="rs-input" inputmode="numeric" />
              }
              <label class="casilla">
                <input type="checkbox" [checked]="usosPorUsuarioIlimitado()"
                       (change)="alternarUsosPorUsuario()" /> {{ 'Sin límite por persona' | t }}
              </label>
            </div>
            <div class="rs-form-group">
              <label class="rs-label">{{ 'Nivel Alpha mínimo' | t }}</label>
              <select formControlName="nivelAlphaMinimo" class="rs-input">
                <option [value]="0">{{ 'Cualquier cliente' | t }}</option>
                <option [value]="1">{{ 'ALPHA I o superior' | t }}</option>
                <option [value]="2">{{ 'ALPHA II o superior' | t }}</option>
                <option [value]="3">{{ 'ALPHA III' | t }}</option>
              </select>
            </div>
          </div>

          <!-- Cupón y campaña dejan de ser dos apartados sueltos (TCK-8038 §5) -->
          @if (campanas().length) {
            <div class="rs-form-group">
              <label class="rs-label">{{ 'Campaña asociada' | t }}</label>
              <select formControlName="campanaId" class="rs-input">
                <option value="">{{ 'Sin campaña' | t }}</option>
                @for (c of campanas(); track c._id) {
                  <option [value]="c._id">{{ c.nombre }}</option>
                }
              </select>
            </div>
          }

          <div class="rs-form-group">
            <label class="rs-label">{{ 'Descripción' | t }}</label>
            <input formControlName="descripcion" class="rs-input" [placeholder]="'Descripción opcional' | t" />
          </div>
          @if (formError()) { <div class="rs-alert rs-alert--error" style="margin-bottom:var(--sp-4)">{{ formError() }}</div> }
          @if (formOk()) { <div class="rs-alert rs-alert--success" style="margin-bottom:var(--sp-4)">
          <rs-icon name="check" [size]="14" [stroke]="3"></rs-icon> {{ formOk() }}
        </div> }
          <div style="display:flex;gap:var(--sp-3)">
            @if (editandoId()) {
              <button type="button" class="rs-btn rs-btn--ghost rs-btn--block" (click)="cancelarEdicion()">{{ 'Cancelar' | t }}</button>
            }
            <button type="submit" class="rs-btn rs-btn--primary rs-btn--block" [disabled]="form.invalid || guardando()">
              {{ guardando() ? 'Guardando…' : (editandoId() ? 'Guardar cambios' : 'Crear cupón') }}
            </button>
          </div>
        </form>
      </div>
      }

      <!-- LISTA -->
      <div class="rs-card" style="padding:var(--sp-6)">
        <h3 class="section-title">{{ 'Cupones registrados' | t }}</h3>
        @if (cargando()) { <p style="color:var(--t-400)">{{ 'Cargando…' | t }}</p> }
        @else if (cupones().length === 0) { <p style="color:var(--t-400)">{{ 'Aún no hay cupones.' | t }}</p> }
        @else {
          @for (c of cupones(); track c._id ?? c.codigo) {
            <div class="cupon-row" [class.cupon-row--inactivo]="!c.activo">
              <div class="cupon-info">
                <div class="cupon-codigo">{{ c.codigo }}</div>
                <div class="cupon-meta">
                  {{ c.tipo === 'porcentaje' ? (c.valor * 100).toFixed(0) + '%' : euros(c.valor) }}
                  · {{ c.vertical }}
                  @if ((c.usoMaximo ?? 0) > 0) { · máx {{ c.usoMaximo }} usos }
                  · lo asume {{ c.asumeDescuento === 'comercio' ? 'el comercio' : 'Doogking' }}
                  @if (c.soloPrimeraReserva) { · sólo clientes nuevos }
                  @if (c.ciudad) { · sólo en {{ c.ciudad }} }
                  @if (c.comercioId) { · un solo comercio }
                  @if (c.usosPorUsuario) { · máx {{ c.usosPorUsuario }} por persona }
                  @if (c.validoHasta) { · hasta {{ c.validoHasta.slice(0, 10) }} }
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
                <button class="rs-btn rs-btn--ghost rs-btn--sm" [title]="'Editar' | t"
                  (click)="iniciarEdicion(c)" [attr.aria-label]="'Editar cupón' | t">
                  <rs-icon name="pencil" [size]="13" [stroke]="2"></rs-icon>
                </button>
                <button class="rs-btn rs-btn--ghost rs-btn--sm"
                  [title]="c.activo ? 'Desactivar' : 'Activar'"
                  (click)="toggleActivo(c)" [attr.aria-label]="c.activo ? 'Pausar cupón' : 'Activar cupón'">
                  <rs-icon [name]="c.activo ? 'pause' : 'play'" [size]="13" [stroke]="2"></rs-icon>
                </button>
                <button class="rs-btn rs-btn--ghost rs-btn--sm" style="color:#F87171" [title]="'Eliminar' | t"
                  (click)="confirmarEliminar(c)" [attr.aria-label]="'Eliminar cupón' | t">
                  <rs-icon name="trash" [size]="13" [stroke]="2"></rs-icon>
                </button>
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
      <h2 class="modal-title">{{ 'Eliminar cupón' | t }}</h2>
      <p style="color:var(--t-300);margin-bottom:var(--sp-5)">
        {{ '¿Estás seguro de que quieres eliminar el cupón' | t }}
        <strong style="color:var(--t-100);font-family:monospace">{{ eliminarCupon()!.codigo }}</strong>{{ '? Esta acción no se puede deshacer.' | t }}
      </p>
      @if (deleteError()) {
        <div class="rs-alert rs-alert--error" style="margin-bottom:var(--sp-4)">{{ deleteError() }}</div>
      }
      <div class="modal-actions">
        <button class="rs-btn rs-btn--ghost" (click)="cancelarEliminar()">{{ 'Cancelar' | t }}</button>
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

    .cupones-barra { display: flex; justify-content: flex-end; margin-bottom: var(--sp-4); }
    .casilla { display: inline-flex; align-items: center; gap: var(--sp-2); margin-top: var(--sp-2); font-size: var(--f-sm); color: var(--t-300); cursor: pointer; }
    .cupones-grid { display: grid; grid-template-columns: 1fr; gap: var(--sp-6); align-items: start; }
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
    .modal {
      width: 100%; max-width: 420px; padding: var(--sp-8);
      /* El backdrop centra el modal en la ventana, asi que un formulario mas
         alto que la pantalla se salia por arriba y por abajo sin scroll: en un
         movil los botones de guardar quedaban fuera de alcance. */
      max-height: calc(100dvh - var(--sp-8));
      overflow-y: auto;
      overscroll-behavior: contain;
    }
    .modal-title { font-size: var(--f-xl); font-weight: var(--w-8); color: var(--t-100); margin-bottom: var(--sp-6); }
    .modal-actions { display: flex; gap: var(--sp-3); justify-content: flex-end; }
  `],
})
export class CuponesAdminComponent implements OnInit {
  /** Formato de los importes; la plantilla lo necesita como miembro. */
  protected readonly euros = euros;

  private readonly fb = inject(FormBuilder);
  private readonly service = inject(CuponesAdminService);
  private readonly adminApi = inject(AdminApiService);
  private readonly http = inject(HttpClient);

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
    // Se escribe en las unidades del admin: 20 para un 20 % (TCK-8037).
    valor: [20, [Validators.required, Validators.min(0)]],
    vertical: ['global', Validators.required],
    montoMinimo: [0],
    topeDescuento: [0],
    usoMaximo: [0],
    validoHasta: [''],
    asumeDescuento: ['plataforma' as 'plataforma' | 'comercio'],
    soloPrimeraReserva: [false],
    usosPorUsuario: [1],
    comercioId: [''],
    ciudad: [''],
    nivelAlphaMinimo: [0],
    campanaId: [''],
    descripcion: [''],
  });

  /** Campañas vivas, para poder colgar el cupón de una (TCK-8038 §5). */
  readonly campanas = signal<Array<{ _id: string; nombre: string }>>([]);

  /** Comercios para acotar el alcance del cupón (TCK-8037 §5). */
  readonly comercios = signal<Array<{ _id: string; nombreComercial: string }>>([]);
  readonly usosPorUsuarioIlimitado = signal(true);

  alternarUsosPorUsuario(): void {
    this.usosPorUsuarioIlimitado.update((v) => !v);
    if (this.usosPorUsuarioIlimitado()) this.form.patchValue({ usosPorUsuario: 0 });
  }

  /** Los campos de alcance viajan juntos: se arman una sola vez. */
  private alcanceDelFormulario(): Record<string, unknown> {
    const v = this.form.value;
    return {
      usosPorUsuario: this.usosPorUsuarioIlimitado() ? 0 : Number(v.usosPorUsuario) || 0,
      comercioId: v.comercioId || undefined,
      ciudad: v.ciudad || undefined,
      nivelAlphaMinimo: Number(v.nivelAlphaMinimo) || 0,
      campanaId: v.campanaId || undefined,
    };
  }

  /** Opciones especiales como casilla, no como un 0 con significado oculto. */
  readonly sinTope = signal(true);
  readonly usosIlimitados = signal(true);
  readonly sinCaducidad = signal(true);
  readonly formularioVisible = signal(false);

  alternarFormulario(): void {
    const abriendo = !this.formularioVisible();
    this.formularioVisible.set(abriendo);
    if (!abriendo) this.cancelarEdicion();
  }

  alternarSinTope(): void {
    this.sinTope.update((v) => !v);
    if (this.sinTope()) this.form.patchValue({ topeDescuento: 0 });
  }

  alternarUsosIlimitados(): void {
    this.usosIlimitados.update((v) => !v);
    if (this.usosIlimitados()) this.form.patchValue({ usoMaximo: 0 });
  }

  alternarSinCaducidad(): void {
    this.sinCaducidad.update((v) => !v);
    if (this.sinCaducidad()) this.form.patchValue({ validoHasta: '' });
  }

  /** El backend guarda el porcentaje como fracción; el formulario, en enteros. */
  private valorAGuardar(): number {
    const valor = Number(this.form.value.valor) || 0;
    return this.form.value.tipo === 'porcentaje' ? valor / 100 : valor;
  }

  async ngOnInit(): Promise<void> {
    await this.cargar();
    try {
      const res = await firstValueFrom(this.adminApi.getComercios({ limite: 200 }));
      this.comercios.set(res.items.map((c) => ({ _id: c._id, nombreComercial: c.nombreComercial })));
    } catch {
      // Sin la lista, el cupón se queda con alcance global: sigue siendo válido.
    }

    try {
      const campanas = await firstValueFrom(
        this.http.get<Array<{ _id: string; nombre: string }>>(`${environment.apiUrl}/campanas`),
      );
      this.campanas.set(campanas);
    } catch {
      // Sin campañas el selector no se pinta y el cupón vive suelto.
    }
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
          valor: this.valorAGuardar(),
          vertical: v.vertical,
          montoMinimo: Number(v.montoMinimo) || 0,
          topeDescuento: this.sinTope() ? 0 : Number(v.topeDescuento) || 0,
          usoMaximo: this.usosIlimitados() ? 0 : Number(v.usoMaximo) || 0,
          validoHasta: this.sinCaducidad() || !v.validoHasta ? undefined : v.validoHasta,
          asumeDescuento: v.asumeDescuento ?? 'plataforma',
          soloPrimeraReserva: !!v.soloPrimeraReserva,
          ...this.alcanceDelFormulario(),
          descripcion: v.descripcion || undefined,
        }));
        this.formOk.set('Cupón actualizado correctamente.');
        this.cancelarEdicion();
      } else {
        await this.service.crear({
          codigo: (v.codigo ?? '').toUpperCase(),
          tipo: v.tipo ?? 'porcentaje',
          valor: this.valorAGuardar(),
          vertical: v.vertical ?? 'global',
          montoMinimo: Number(v.montoMinimo) || 0,
          topeDescuento: this.sinTope() ? 0 : Number(v.topeDescuento) || 0,
          usoMaximo: this.usosIlimitados() ? 0 : Number(v.usoMaximo) || 0,
          validoHasta: this.sinCaducidad() || !v.validoHasta ? undefined : v.validoHasta,
          asumeDescuento: v.asumeDescuento ?? 'plataforma',
          soloPrimeraReserva: !!v.soloPrimeraReserva,
          ...this.alcanceDelFormulario(),
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
    this.sinTope.set(!(c.topeDescuento ?? 0));
    this.usosIlimitados.set(!(c.usoMaximo ?? 0));
    this.sinCaducidad.set(!c.validoHasta);
    this.usosPorUsuarioIlimitado.set(!(c.usosPorUsuario ?? 0));
    this.formularioVisible.set(true);
    this.form.patchValue({
      codigo: c.codigo,
      tipo: c.tipo,
      valor: c.tipo === 'porcentaje' ? Math.round(c.valor * 100) : c.valor,
      vertical: c.vertical,
      montoMinimo: c.montoMinimo,
      topeDescuento: c.topeDescuento ?? 0,
      usoMaximo: c.usoMaximo ?? 0,
      validoHasta: c.validoHasta ? String(c.validoHasta).slice(0, 10) : '',
      asumeDescuento: c.asumeDescuento ?? 'plataforma',
      soloPrimeraReserva: c.soloPrimeraReserva ?? false,
      usosPorUsuario: c.usosPorUsuario ?? 1,
      comercioId: c.comercioId ?? '',
      ciudad: c.ciudad ?? '',
      nivelAlphaMinimo: c.nivelAlphaMinimo ?? 0,
      campanaId: c.campanaId ?? '',
      descripcion: c.descripcion ?? '',
    });
    this.formError.set(null);
    this.formOk.set(null);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  cancelarEdicion(): void {
    this.editandoId.set(null);
    this.form.reset({
      tipo: 'porcentaje', valor: 20, vertical: 'global', montoMinimo: 0,
      topeDescuento: 0, usoMaximo: 0, validoHasta: '',
      asumeDescuento: 'plataforma', soloPrimeraReserva: false,
      usosPorUsuario: 1, comercioId: '', ciudad: '', nivelAlphaMinimo: 0, campanaId: '',
    });
    this.usosPorUsuarioIlimitado.set(true);
    this.sinTope.set(true);
    this.usosIlimitados.set(true);
    this.sinCaducidad.set(true);
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
