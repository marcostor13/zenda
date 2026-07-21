import { Component, signal, inject, computed, OnInit } from '@angular/core';
import { RouterLink } from '@angular/router';
import { DatePipe, DecimalPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { firstValueFrom } from 'rxjs';
import { RsIconComponent } from '../../shared/components/icon/rs-icon.component';
import { RsImageUploadComponent } from '../../shared/components/image-upload/rs-image-upload.component';
import { ComercioApiService, MiReserva, SuplementoConfig } from './comercio-api.service';
import { PerrosService, HistoriaCompartidaApi } from '../perros/perros.service';

const VERTICAL_ICON: Record<string, string> = {
  alojamiento: 'hotel', transporte: 'truck', veterinaria: 'stethoscope', peluqueria: 'scissors', adiestramiento: 'graduation-cap',
};

const ESTADO_BADGE: Record<string, string> = {
  confirmada: 'rs-badge--success', pendiente: 'rs-badge--warning',
  cancelada: 'rs-badge--error', completada: 'rs-badge--accent', no_show: 'rs-badge--neutral',
  ajuste_solicitado: 'rs-badge--warning',
  en_curso: 'rs-badge--accent', pago_retenido: 'rs-badge--warning',
  pago_liberado: 'rs-badge--success', en_disputa: 'rs-badge--error', reembolsada: 'rs-badge--neutral',
};

type FiltroEstado = 'todas' | 'confirmada' | 'pendiente' | 'cancelada' | 'completada';

const FILTROS: ReadonlyArray<{ valor: FiltroEstado; label: string }> = [
  { valor: 'todas', label: 'Todas' },
  { valor: 'confirmada', label: 'Confirmadas' },
  { valor: 'pendiente', label: 'Pendientes' },
  { valor: 'cancelada', label: 'Canceladas' },
  { valor: 'completada', label: 'Completadas' },
];

@Component({
  selector: 'app-comercio-reservas',
  standalone: true,
  imports: [RouterLink, DatePipe, DecimalPipe, FormsModule, RsIconComponent, RsImageUploadComponent],
  template: `
    <!-- HEADER -->
    <div class="page-header">
      <div>
        <h1 class="page-title">Reservas</h1>
        <p class="page-sub">Gestiona todas las reservas recibidas en tu comercio</p>
      </div>
    </div>

    <!-- FILTER PILLS -->
    <div class="filter-pills">
      @for (f of filtros; track f.valor) {
        <button
          class="filter-pill"
          [class.active]="filtroActivo() === f.valor"
          (click)="filtroActivo.set(f.valor)">
          {{ f.label }}
          <span class="filter-pill__count">{{ contarEstado(f.valor) }}</span>
        </button>
      }
    </div>

    @if (cargando()) {
      <div class="rs-card skeleton-wrap">
        @for (i of [1, 2, 3, 4, 5]; track i) {
          <div class="skeleton-row"></div>
        }
      </div>
    } @else if (reservasFiltradas().length === 0) {
      <div class="rs-card empty-state">
        <rs-icon name="calendar" [size]="40" [stroke]="1.25" style="color:var(--t-400)"></rs-icon>
        <p>No hay reservas{{ filtroActivo() !== 'todas' ? ' con este filtro' : ' aún' }}.</p>
        @if (filtroActivo() !== 'todas') {
          <button class="rs-btn rs-btn--ghost rs-btn--sm" (click)="filtroActivo.set('todas')">
            Ver todas las reservas
          </button>
        }
      </div>
    } @else {
      <div class="rs-card" style="overflow-x:auto">
        <table class="rs-table">
          <thead>
            <tr>
              <th>Código</th>
              <th>Vertical</th>
              <th>Fecha inicio</th>
              <th>Monto total</th>
              <th>Estado</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            @for (r of reservasFiltradas(); track r._id) {
              <tr>
                <td><code>{{ r.codigo }}</code></td>
                <td class="vertical-cell">
                  <rs-icon [name]="iconVertical(r.vertical)" [size]="14" [stroke]="2"></rs-icon>
                  {{ r.vertical }}
                </td>
                <td>{{ r.fechaInicio | date:'d MMM yyyy' }}</td>
                <td>€{{ r.montoTotal | number:'1.2-2' }}</td>
                <td><span class="rs-badge {{ badgeEstado(r.estado) }}">{{ r.estado === 'ajuste_solicitado' ? 'ajuste solicitado' : r.estado }}</span></td>
                <td style="display:flex;gap:var(--sp-2)">
                  @if (r.estado === 'confirmada') {
                    <button class="rs-btn rs-btn--outline rs-btn--sm"
                            [disabled]="completandoId() === r._id"
                            (click)="completar(r)">
                      {{ completandoId() === r._id ? 'Guardando…' : 'Marcar completada' }}
                    </button>
                    @if (r.vertical !== 'veterinaria') {
                      <button class="rs-btn rs-btn--ghost rs-btn--sm" (click)="toggleAjuste(r._id)">
                        Solicitar ajuste
                      </button>
                    }
                  }
                  @if (r.estado === 'completada' && r.perroId && !valoradoId().has(r._id)) {
                    <button class="rs-btn rs-btn--outline rs-btn--sm" (click)="toggleValorar(r._id)">
                      ★ Valorar perro
                    </button>
                  }
                  @if (valoradoId().has(r._id)) {
                    <span class="rs-badge rs-badge--success">★ Valorado</span>
                  }
                  @if (r.vertical === 'veterinaria' && r.perroId) {
                    <button class="rs-btn rs-btn--ghost rs-btn--sm" (click)="toggleHistoriaVeterinaria(r)">
                      🩺 Historia veterinaria
                    </button>
                  }
                  @if (hitosDe(r.vertical).length && (r.estado === 'confirmada' || r.estado === 'en_curso')) {
                    @for (h of hitosDe(r.vertical); track h.hito) {
                      <button class="rs-btn rs-btn--ghost rs-btn--sm"
                              [disabled]="seguimientoId() === r._id"
                              (click)="marcarHito(r, h.hito)">{{ h.label }}</button>
                    }
                  }
                </td>
              </tr>
              @if (historiaAbiertaId() === r._id) {
                <tr>
                  <td colspan="6">
                    <div class="ajuste-panel">
                      @if (cargandoHistoria()) {
                        <p class="ajuste-panel__hint">Cargando historia veterinaria compartida…</p>
                      } @else if (errorHistoria()) {
                        <p class="ajuste-panel__hint">{{ errorHistoria() }}</p>
                      } @else if (historiaVeterinaria(); as h) {
                        <p class="ajuste-panel__hint">
                          {{ h.nombre }} · {{ h.especie }} @if (h.raza) { · {{ h.raza }} } @if (h.peso) { · {{ h.peso }} kg }
                          @if (h.esterilizado) { · Esterilizado/a }
                        </p>
                        @if (h.alergias.length) { <p><strong>Alergias:</strong> {{ h.alergias.join(', ') }}</p> }
                        @if (h.enfermedades.length) { <p><strong>Enfermedades:</strong> {{ h.enfermedades.join(', ') }}</p> }
                        @if (h.medicacion.length) { <p><strong>Medicación:</strong> {{ h.medicacion.join(', ') }}</p> }
                        @if (h.vacunas.length) { <p><strong>Vacunas:</strong> {{ h.vacunas.join(', ') }}</p> }
                        @if (h.dieta) { <p><strong>Dieta:</strong> {{ h.dieta }}</p> }
                        @if (h.historial.length) {
                          <p><strong>Historial de otros profesionales:</strong></p>
                          @for (nota of h.historial; track $index) {
                            <p class="ajuste-panel__hint">· [{{ nota.vertical }}] {{ nota.nota }}</p>
                          }
                        }
                      }
                      <div class="ajuste-panel__actions">
                        <button class="rs-btn rs-btn--ghost rs-btn--sm" (click)="historiaAbiertaId.set(null)">Cerrar</button>
                      </div>
                    </div>
                  </td>
                </tr>
              }
              @if (valorarAbiertoId() === r._id) {
                <tr>
                  <td colspan="6">
                    <div class="ajuste-panel">
                      <p class="ajuste-panel__hint">
                        Tu valoración se suma al pasaporte digital del perro y ayuda a otros profesionales de Doogking
                        a adaptar el servicio.
                      </p>
                      <div class="resena-form__estrellas">
                        @for (n of [1,2,3,4,5]; track n) {
                          <button type="button" class="estrella-btn" [class.activa]="n <= puntuacionValoracion()"
                                  (click)="puntuacionValoracion.set(n)">★</button>
                        }
                      </div>
                      <div class="rs-field">
                        <label class="rs-lbl">Comentario (opcional)</label>
                        <input class="rs-inp" [(ngModel)]="comentarioValoracion"
                               [ngModelOptions]="{standalone: true}"
                               placeholder="Ej. muy tranquilo, excelente comportamiento" />
                      </div>
                      @if (r.vertical === 'adiestramiento') {
                        <div class="rs-field">
                          <label class="rs-lbl">Nivel Doogking (opcional)</label>
                          <select class="rs-inp" [(ngModel)]="nivelDoogking" [ngModelOptions]="{standalone: true}">
                            <option [ngValue]="null">— No actualizar —</option>
                            <option [ngValue]="1">1 · Cachorro</option>
                            <option [ngValue]="2">2 · Básico</option>
                            <option [ngValue]="3">3 · Intermedio</option>
                            <option [ngValue]="4">4 · Avanzado</option>
                            <option [ngValue]="5">5 · Excelente sociabilidad</option>
                          </select>
                          <span class="rs-field-hint">Se guarda en la ficha del perro y lo verá cualquier profesional de Doogking.</span>
                        </div>
                      }
                      <div class="ajuste-panel__actions">
                        <button class="rs-btn rs-btn--ghost rs-btn--sm" (click)="cerrarValorar()">Cancelar</button>
                        <button class="rs-btn rs-btn--primary rs-btn--sm"
                                [disabled]="enviandoValoracion()"
                                (click)="enviarValoracion(r)">
                          {{ enviandoValoracion() ? 'Enviando…' : 'Publicar valoración' }}
                        </button>
                      </div>
                    </div>
                  </td>
                </tr>
              }
              @if (ajusteAbiertoId() === r._id) {
                <tr>
                  <td colspan="6">
                    <div class="ajuste-panel">
                      <p class="ajuste-panel__hint">
                        Selecciona los suplementos detectados en recepción. El cliente recibirá una notificación y
                        deberá aprobarlos antes de que se cobre nada.
                      </p>

                      @if (suplementosCatalogo().length === 0) {
                        <p class="ajuste-panel__empty">
                          No tienes suplementos preconfigurados.
                          <a routerLink="/comercio/suplementos">Créalos aquí</a> para poder seleccionarlos con un click.
                        </p>
                      } @else {
                        <div class="ajuste-panel__checks">
                          @for (s of suplementosCatalogo(); track s._id) {
                            <label class="filter-check">
                              <input type="checkbox" [checked]="seleccionados().has(s._id)"
                                     (change)="toggleSuplemento(s._id)" />
                              {{ s.concepto }} (+€{{ s.monto | number:'1.2-2' }})
                            </label>
                          }
                        </div>
                      }

                      <div class="ajuste-panel__evidencia">
                        <label class="rs-lbl">Foto del estado del animal al llegar (opcional pero recomendado)</label>
                        <rs-image-upload [(ngModel)]="evidenciaUrl"></rs-image-upload>
                      </div>

                      @if (totalSuplementoSeleccionado() > 0) {
                        <p class="ajuste-panel__total">Suplemento total: +€{{ totalSuplementoSeleccionado() | number:'1.2-2' }}</p>
                      }

                      <div class="ajuste-panel__actions">
                        <button class="rs-btn rs-btn--ghost rs-btn--sm" (click)="cerrarAjuste()">Cancelar</button>
                        <button class="rs-btn rs-btn--primary rs-btn--sm"
                                [disabled]="enviandoAjuste() || seleccionados().size === 0"
                                (click)="enviarAjuste(r)">
                          {{ enviandoAjuste() ? 'Enviando…' : 'Enviar solicitud al cliente' }}
                        </button>
                      </div>
                    </div>
                  </td>
                </tr>
              }
            }
          </tbody>
        </table>
      </div>
    }

    @if (errorMsg()) {
      <div class="rs-alert rs-alert--error">{{ errorMsg() }}</div>
    }
  `,
  styles: [`
    :host { display: contents; }

    .page-header { display: flex; justify-content: space-between; align-items: flex-start; }
    .page-title { font-size: var(--f-2xl); font-weight: var(--w-8); color: var(--t-100); margin-bottom: var(--sp-1); }
    .page-sub { color: var(--t-400); font-size: var(--f-sm); }

    .filter-pills { display: flex; flex-wrap: wrap; gap: var(--sp-2); }
    .filter-pill {
      display: inline-flex; align-items: center; gap: var(--sp-2);
      padding: var(--sp-2) var(--sp-4); border-radius: var(--r-full);
      border: 1px solid var(--b-2); background: var(--c-raised);
      color: var(--t-300); font-size: var(--f-sm); cursor: pointer; transition: all var(--d-2);
      &:hover { border-color: var(--c-accent); color: var(--c-accent); }
      &.active { background: var(--c-accent-lo); border-color: var(--c-accent); color: var(--c-accent); font-weight: var(--w-6); }
    }
    .filter-pill__count {
      background: var(--c-surface); border-radius: var(--r-full);
      padding: 1px var(--sp-2); font-size: var(--f-xs); color: var(--t-400);
    }
    .filter-pill.active .filter-pill__count { background: rgba(22,104,227,.15); color: var(--c-accent); }

    .skeleton-wrap { padding: var(--sp-4); display: flex; flex-direction: column; gap: var(--sp-3); }
    .skeleton-row {
      height: 44px;
      background: linear-gradient(90deg, var(--c-raised) 25%, var(--c-surface) 50%, var(--c-raised) 75%);
      background-size: 200% 100%;
      border-radius: var(--r-lg);
      animation: shimmer 1.5s infinite;
    }

    .empty-state {
      padding: var(--sp-16); text-align: center;
      display: flex; flex-direction: column; align-items: center; gap: var(--sp-4);
      p { color: var(--t-400); font-size: var(--f-md); }
    }

    .rs-table {
      width: 100%; border-collapse: collapse; font-size: var(--f-sm);
      th { color: var(--t-400); text-align: left; padding: var(--sp-3) var(--sp-4); border-bottom: 1px solid var(--b-1); font-size: var(--f-xs); text-transform: uppercase; letter-spacing: .06em; font-weight: var(--w-6); white-space: nowrap; }
      td { padding: var(--sp-4); border-bottom: 1px solid var(--b-1); color: var(--t-200); white-space: nowrap; }
      tr:last-child td { border-bottom: none; }
      tr:hover td { background: var(--c-raised); }
      code { font-family: monospace; color: var(--c-accent); background: var(--c-accent-lo); padding: 2px var(--sp-2); border-radius: var(--r-sm); font-size: var(--f-xs); }
    }
    .vertical-cell { display: flex; align-items: center; gap: var(--sp-2); text-transform: capitalize; }

    .ajuste-panel { padding: var(--sp-4) 0; display: flex; flex-direction: column; gap: var(--sp-3); white-space: normal; }
    .ajuste-panel__hint { font-size: var(--f-sm); color: var(--t-400); }
    .ajuste-panel__empty { font-size: var(--f-sm); color: var(--t-400); a { color: var(--c-accent); } }
    .ajuste-panel__checks { display: flex; flex-direction: column; gap: var(--sp-2); }
    .ajuste-panel__evidencia { max-width: 320px; }
    .ajuste-panel__total { font-size: var(--f-sm); font-weight: var(--w-6); color: var(--t-100); }
    .ajuste-panel__actions { display: flex; gap: var(--sp-2); }
    .filter-check { display: flex; align-items: center; gap: var(--sp-2); cursor: pointer; font-size: var(--f-sm); color: var(--t-200); }

    .resena-form__estrellas { display: flex; gap: var(--sp-1); margin-bottom: var(--sp-3); }
    .estrella-btn {
      background: none; border: none; cursor: pointer; font-size: 1.5rem; color: var(--b-2); line-height: 1;
      &.activa { color: var(--c-amber); }
    }
  `],
})
export class ComercioReservasComponent implements OnInit {
  private readonly comercioApi = inject(ComercioApiService);
  private readonly perrosService = inject(PerrosService);

  readonly cargando = signal(true);
  readonly errorMsg = signal('');
  readonly reservas = signal<MiReserva[]>([]);
  readonly filtroActivo = signal<FiltroEstado>('todas');
  readonly completandoId = signal<string | null>(null);
  readonly seguimientoId = signal<string | null>(null);

  // Solicitar ajuste de precio (docs/mejora_servicios.md §7)
  readonly suplementosCatalogo = signal<SuplementoConfig[]>([]);
  readonly ajusteAbiertoId = signal<string | null>(null);
  readonly seleccionados = signal<Set<string>>(new Set());
  readonly enviandoAjuste = signal(false);
  evidenciaUrl = '';

  readonly totalSuplementoSeleccionado = computed(() =>
    this.suplementosCatalogo()
      .filter((s) => this.seleccionados().has(s._id))
      .reduce((acc, s) => acc + s.monto, 0),
  );

  // Reputación bidireccional: el comercio valora al perro tras completar el servicio.
  readonly valorarAbiertoId = signal<string | null>(null);
  readonly valoradoId = signal<Set<string>>(new Set());
  readonly puntuacionValoracion = signal(5);
  readonly enviandoValoracion = signal(false);
  comentarioValoracion = '';
  nivelDoogking: number | null = null;

  readonly historiaAbiertaId = signal<string | null>(null);
  readonly historiaVeterinaria = signal<HistoriaCompartidaApi | null>(null);
  readonly cargandoHistoria = signal(false);
  readonly errorHistoria = signal<string | null>(null);

  readonly reservasFiltradas = computed(() => {
    const filtro = this.filtroActivo();
    if (filtro === 'todas') return this.reservas();
    return this.reservas().filter(r => r.estado === filtro);
  });

  readonly filtros = FILTROS;

  async ngOnInit(): Promise<void> {
    try {
      const [reservas, suplementos] = await Promise.all([
        firstValueFrom(this.comercioApi.getMisReservas()),
        firstValueFrom(this.comercioApi.getMisSuplementos()).catch(() => []),
      ]);
      this.reservas.set(reservas);
      this.suplementosCatalogo.set(suplementos.filter((s) => s.activo));
    } catch {
      this.errorMsg.set('Error al cargar las reservas. Verifica que el API esté activo.');
    } finally {
      this.cargando.set(false);
    }
  }

  toggleAjuste(reservaId: string): void {
    const yaAbierto = this.ajusteAbiertoId() === reservaId;
    this.ajusteAbiertoId.set(yaAbierto ? null : reservaId);
    this.seleccionados.set(new Set());
    this.evidenciaUrl = '';
  }

  cerrarAjuste(): void {
    this.ajusteAbiertoId.set(null);
    this.seleccionados.set(new Set());
    this.evidenciaUrl = '';
  }

  toggleSuplemento(id: string): void {
    this.seleccionados.update((set) => {
      const nuevo = new Set(set);
      if (nuevo.has(id)) nuevo.delete(id); else nuevo.add(id);
      return nuevo;
    });
  }

  async enviarAjuste(r: MiReserva): Promise<void> {
    const suplementos = this.suplementosCatalogo()
      .filter((s) => this.seleccionados().has(s._id))
      .map((s) => ({ concepto: s.concepto, monto: s.monto }));

    if (!suplementos.length) return;

    this.enviandoAjuste.set(true);
    try {
      const actualizado = await firstValueFrom(
        this.comercioApi.solicitarAjuste(r._id, { suplementos, evidenciaUrl: this.evidenciaUrl || undefined }),
      );
      this.reservas.update((lista) => lista.map((x) => (x._id === r._id ? actualizado : x)));
      this.cerrarAjuste();
    } catch {
      this.errorMsg.set('No se pudo enviar la solicitud de ajuste. Inténtalo de nuevo.');
    } finally {
      this.enviandoAjuste.set(false);
    }
  }

  toggleValorar(reservaId: string): void {
    const yaAbierto = this.valorarAbiertoId() === reservaId;
    this.valorarAbiertoId.set(yaAbierto ? null : reservaId);
    this.puntuacionValoracion.set(5);
    this.comentarioValoracion = '';
    this.nivelDoogking = null;
  }

  cerrarValorar(): void {
    this.valorarAbiertoId.set(null);
  }

  async toggleHistoriaVeterinaria(r: MiReserva): Promise<void> {
    if (this.historiaAbiertaId() === r._id) {
      this.historiaAbiertaId.set(null);
      return;
    }
    if (!r.perroId) return;

    this.historiaAbiertaId.set(r._id);
    this.historiaVeterinaria.set(null);
    this.errorHistoria.set(null);
    this.cargandoHistoria.set(true);
    try {
      const historia = await this.perrosService.historiaVeterinaria(r.perroId);
      this.historiaVeterinaria.set(historia);
    } catch {
      this.errorHistoria.set('No se pudo cargar el historial (el propietario podría no haber autorizado compartirlo).');
    } finally {
      this.cargandoHistoria.set(false);
    }
  }

  async enviarValoracion(r: MiReserva): Promise<void> {
    if (!r.perroId) return;

    this.enviandoValoracion.set(true);
    this.errorMsg.set('');
    try {
      await this.perrosService.crearValoracion(r.perroId, {
        reservaId: r._id,
        puntuacion: this.puntuacionValoracion(),
        comentario: this.comentarioValoracion || undefined,
        atributos: this.nivelDoogking !== null ? { nivelDoogking: this.nivelDoogking } : undefined,
      });
      this.valoradoId.update((set) => new Set(set).add(r._id));
      this.cerrarValorar();
    } catch {
      this.errorMsg.set('No se pudo publicar la valoración. Inténtalo de nuevo.');
    } finally {
      this.enviandoValoracion.set(false);
    }
  }

  iconVertical(v: string): string { return VERTICAL_ICON[v] ?? 'building'; }
  badgeEstado(e: string): string { return ESTADO_BADGE[e] ?? 'rs-badge--neutral'; }
  contarEstado(filtro: FiltroEstado): number {
    if (filtro === 'todas') return this.reservas().length;
    return this.reservas().filter(r => r.estado === filtro).length;
  }

  async completar(r: MiReserva): Promise<void> {
    this.completandoId.set(r._id);
    try {
      await firstValueFrom(this.comercioApi.completarReserva(r._id));
      this.reservas.update((lista) =>
        lista.map((x) => (x._id === r._id ? { ...x, estado: 'completada' } : x)),
      );
    } catch {
      this.errorMsg.set('No se pudo marcar la reserva como completada. Inténtalo de nuevo.');
    } finally {
      this.completandoId.set(null);
    }
  }

  /** Hitos de seguimiento en tiempo real según el tipo de servicio. */
  hitosDe(vertical: string): Array<{ hito: string; label: string }> {
    if (vertical === 'transporte') {
      return [
        { hito: 'recogida', label: '🐾 Recogida' },
        { hito: 'en_ruta', label: '🚐 En ruta' },
        { hito: 'entregada', label: '📍 Entregada' },
        { hito: 'finalizada', label: '✅ Finalizar' },
      ];
    }
    if (vertical === 'alojamiento' || vertical === 'hoteles') {
      return [
        { hito: 'entrada', label: '🏠 Entrada' },
        { hito: 'salida', label: '🐾 Salida' },
        { hito: 'finalizada', label: '✅ Finalizar' },
      ];
    }
    return [];
  }

  async marcarHito(r: MiReserva, hito: string): Promise<void> {
    this.seguimientoId.set(r._id);
    try {
      const actualizada = await firstValueFrom(this.comercioApi.marcarSeguimiento(r._id, hito));
      this.reservas.update((lista) =>
        lista.map((x) => (x._id === r._id ? { ...x, estado: actualizada.estado } : x)),
      );
    } catch {
      this.errorMsg.set('No se pudo registrar el hito de seguimiento.');
      setTimeout(() => this.errorMsg.set(''), 3000);
    } finally {
      this.seguimientoId.set(null);
    }
  }
}
