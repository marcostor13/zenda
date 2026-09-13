import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { VERTICAL_LABELS, VerticalKey, tieneHistorialDeServicio } from 'shared';
import { RsIconComponent } from '../../shared/components/icon/rs-icon.component';
import { ImgFallbackDirective } from '../../shared/directives/img-fallback.directive';
import { TraducirPipe } from '../../core/i18n/traducir.pipe';
import { I18nService } from '../../core/i18n/i18n.service';
import { AuthService } from '../../core/auth/auth.service';
import { ComercioApiService } from './comercio-api.service';
import {
  ExpedienteApi, ExpedienteService, RegistroServicioApi, RegistroServicioPayload,
} from '../perros/expediente.service';
import { HistorialTimelineComponent } from '../perros/componentes/historial-timeline.component';
import { RegistroServicioFormComponent } from '../perros/componentes/registro-servicio-form.component';
import { FichaPerroDatosComponent } from '../perros/componentes/ficha-perro-datos.component';
import { iconoVertical } from './vertical-icon';
import { edadLegible } from '../perros/edad';
import { proximaCitaDe } from '../perros/componentes/proxima-cita';
import { FechaPipe } from '../../shared/pipes/fecha.pipe';

type Pestana = 'historial' | 'ficha' | 'reservas';

const ESTADOS: Record<string, string> = {
  pendiente: 'Pendiente', confirmada: 'Confirmada', en_curso: 'En curso', completada: 'Completada',
  cancelada: 'Cancelada', no_show: 'No presentado', ajuste_solicitado: 'Ajuste solicitado',
  pago_retenido: 'Completada', pago_liberado: 'Completada', en_disputa: 'En disputa', reembolsada: 'Reembolsada',
};

/**
 * Expediente de una mascota en el panel del comercio: la ficha que rellenó su
 * dueño, las reservas con este negocio y el historial de servicios, donde el
 * equipo anota lo que hizo en cada visita y del que sale el informe PDF.
 */
@Component({
  selector: 'app-comercio-mascota-expediente',
  standalone: true,
  imports: [
    FechaPipe, RouterLink, RsIconComponent, ImgFallbackDirective, TraducirPipe,
    HistorialTimelineComponent, RegistroServicioFormComponent, FichaPerroDatosComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
<a routerLink="/comercio/mascotas" class="volver">
  <rs-icon name="arrow-left" [size]="15" [stroke]="2"></rs-icon> {{ 'Mascotas' | t }}
</a>

@if (cargando()) {
  <div class="rs-card cargando"><span class="rs-spinner"></span> {{ 'Cargando expediente…' | t }}</div>
} @else if (error()) {
  <div class="rs-alert rs-alert--error">{{ error() | t }}</div>
} @else if (expediente(); as exp) {
  <header class="rs-card hero">
    <div class="hero__mascota">
      <div class="hero__avatar">
        @if (exp.perro.fotos.length) { <img [src]="exp.perro.fotos[0]" [alt]="exp.perro.nombre" rsImg /> }
        @else { <rs-icon name="dog" [size]="34" [stroke]="1.5"></rs-icon> }
      </div>
      <div class="hero__id">
        <h1>{{ exp.perro.nombre }}</h1>
        <p>
          {{ exp.perro.raza || ('Mestizo' | t) }}
          @if (edad(); as e) { · {{ e }} }
          @if (exp.perro.sexo) { · {{ (exp.perro.sexo === 'macho' ? 'Macho' : 'Hembra') | t }} }
          @if (exp.perro.peso) { · {{ exp.perro.peso }} kg }
        </p>
        @if (alertas().length) {
          <div class="hero__alertas">
            @for (a of alertas(); track a.texto) {
              <span class="rs-badge" [class]="'rs-badge rs-badge--' + a.variante">
                <rs-icon [name]="a.icono" [size]="11" [stroke]="2.5"></rs-icon> {{ a.etiqueta | t }}: {{ a.texto }}
              </span>
            }
          </div>
        }
      </div>
    </div>

    @if (exp.propietario; as dueno) {
      <div class="hero__dueno">
        <span class="hero__dueno-label">{{ 'Propietario' | t }}</span>
        <strong>{{ dueno.nombre }}</strong>
        @if (dueno.telefono) {
          <a [href]="'tel:' + dueno.telefono"><rs-icon name="phone" [size]="13" [stroke]="2"></rs-icon> {{ dueno.telefono }}</a>
        }
        @if (dueno.email) {
          <a [href]="'mailto:' + dueno.email"><rs-icon name="mail" [size]="13" [stroke]="2"></rs-icon> {{ dueno.email }}</a>
        }
      </div>
    }

    <div class="hero__acciones">
      @if (verticalesConHistorial().length) {
        <button type="button" class="rs-btn rs-btn--primary" (click)="abrirFormulario()">
          <rs-icon name="plus" [size]="16" [stroke]="2"></rs-icon> {{ 'Nuevo registro' | t }}
        </button>
      }
      <button type="button" class="rs-btn rs-btn--outline" [disabled]="descargando()" (click)="descargarPdf()">
        <rs-icon name="download" [size]="16" [stroke]="2"></rs-icon>
        {{ (descargando() ? 'Generando PDF…' : 'Descargar PDF') | t }}
      </button>
    </div>
  </header>

  <div class="kpis">
    <div class="rs-card kpi"><span class="kpi__valor">{{ exp.servicios.length }}</span><span class="kpi__label">{{ 'Reservas contigo' | t }}</span></div>
    <div class="rs-card kpi"><span class="kpi__valor">{{ registrosPropios() }}</span><span class="kpi__label">{{ 'Registros tuyos' | t }}</span></div>
    <div class="rs-card kpi">
      <span class="kpi__valor kpi__valor--fecha">{{ ultimaVisita() ? (ultimaVisita()! | date:'d MMM yyyy') : '—' }}</span>
      <span class="kpi__label">{{ 'Última visita' | t }}</span>
    </div>
    <div class="rs-card kpi">
      <span class="kpi__valor kpi__valor--fecha">{{ proximaCita() ? (proximaCita()! | date:'d MMM yyyy') : '—' }}</span>
      <span class="kpi__label">{{ 'Próxima cita' | t }}</span>
    </div>
  </div>

  <nav class="pestanas" role="tablist">
    @for (p of pestanas; track p.id) {
      <button type="button" role="tab" class="pestana" [class.activa]="pestana() === p.id"
              [attr.aria-selected]="pestana() === p.id" (click)="pestana.set(p.id)">
        <rs-icon [name]="p.icono" [size]="15" [stroke]="2"></rs-icon> {{ p.etiqueta | t }}
      </button>
    }
  </nav>

  @switch (pestana()) {
    @case ('historial') {
      @if (formAbierto()) {
        <div class="rs-card formulario">
          <app-registro-servicio-form
            [verticales]="verticalesConHistorial()"
            [servicios]="exp.servicios"
            [registro]="editando()"
            [guardando]="guardando()"
            [verticalInicial]="verticalInicial()"
            [reservaInicial]="reservaInicial()"
            [profesionalInicial]="nombreUsuario()"
            (guardar)="guardar($event)"
            (cancelar)="cerrarFormulario()" />
          @if (errorGuardar()) { <div class="rs-alert rs-alert--error">{{ errorGuardar() | t }}</div> }
        </div>
      }
      @if (mensaje()) { <div class="rs-alert rs-alert--success">{{ mensaje() | t }}</div> }
      @if (!verticalesConHistorial().length) {
        <div class="rs-alert rs-alert--info">{{ 'El historial de servicios está disponible para veterinarios, peluquerías y adiestradores.' | t }}</div>
      }
      <app-historial-timeline [registros]="exp.registros" [editable]="true"
                              vacio="Aún no hay registros. Anota lo que hiciste en la última visita para empezar su historial."
                              (editar)="editar($event)" (eliminar)="eliminar($event)" />
    }
    @case ('ficha') {
      <p class="nota-ficha">
        <rs-icon name="user" [size]="14" [stroke]="2"></rs-icon>
        {{ 'Datos que ha rellenado el propietario en la ficha de su perro.' | t }}
      </p>
      <app-ficha-perro-datos [perro]="exp.perro" />
    }
    @case ('reservas') {
      @if (exp.servicios.length) {
        <ul class="reservas">
          @for (s of exp.servicios; track s.reservaId) {
            <li class="rs-card reserva">
              <span class="reserva__icono"><rs-icon [name]="icono(s.vertical)" [size]="18" [stroke]="2"></rs-icon></span>
              <div class="reserva__info">
                <strong>{{ s.servicioTitulo || etiquetaVertical(s.vertical) | t }}</strong>
                <span>{{ s.fechaInicio | date:'d MMM yyyy, HH:mm' }} · {{ s.codigo }}</span>
              </div>
              <span class="rs-badge rs-badge--neutral">{{ estado(s.estado) | t }}</span>
              @if (puedeRegistrar(s.vertical)) {
                <button type="button" class="rs-btn rs-btn--ghost rs-btn--sm" (click)="registrarDesdeReserva(s.vertical, s.reservaId)">
                  <rs-icon name="clipboard-list" [size]="14" [stroke]="2"></rs-icon> {{ 'Registrar servicio' | t }}
                </button>
              }
            </li>
          }
        </ul>
      } @else {
        <div class="rs-card vacio">{{ 'Sin reservas con tu negocio.' | t }}</div>
      }
    }
  }
}
  `,
  styles: [`
    :host { display: contents; }
    .volver { display: inline-flex; align-items: center; gap: var(--sp-2); color: var(--t-400); text-decoration: none; font-size: var(--f-sm); width: fit-content; }
    .volver:hover { color: var(--c-accent); }
    .cargando { padding: var(--sp-10); display: flex; align-items: center; justify-content: center; gap: var(--sp-3); color: var(--t-400); }

    .hero {
      padding: var(--sp-6); display: grid; gap: var(--sp-5);
      grid-template-columns: minmax(0, 1fr) auto; align-items: start;
      background: linear-gradient(135deg, var(--c-card) 60%, var(--c-accent-lo));
      border-top: 4px solid var(--dk-gold);
    }
    .hero__mascota { display: flex; gap: var(--sp-4); align-items: center; min-width: 0; }
    .hero__avatar {
      width: 88px; height: 88px; border-radius: var(--r-full); overflow: hidden; flex-shrink: 0;
      background: var(--c-accent-lo); color: var(--c-accent); display: flex; align-items: center; justify-content: center;
      box-shadow: 0 0 0 3px var(--c-card), 0 0 0 5px var(--dk-gold);
      img { width: 100%; height: 100%; object-fit: cover; }
    }
    .hero__id { min-width: 0; }
    .hero__id h1 { font-family: var(--font-display); font-size: var(--f-3xl); font-weight: var(--w-8); color: var(--t-100); margin: 0; line-height: 1.1; }
    .hero__id p { color: var(--t-400); font-size: var(--f-sm); margin: var(--sp-1) 0 0; }
    .hero__alertas { display: flex; flex-wrap: wrap; gap: var(--sp-2); margin-top: var(--sp-3); }
    .hero__alertas .rs-badge { text-transform: none; letter-spacing: 0; }
    .hero__dueno {
      display: flex; flex-direction: column; gap: var(--sp-1); padding: var(--sp-4); min-width: 220px;
      border-radius: var(--r-lg); background: var(--c-card); border: 1px solid var(--b-1); font-size: var(--f-sm);
      strong { color: var(--t-100); }
      a { display: inline-flex; align-items: center; gap: var(--sp-2); color: var(--c-accent); text-decoration: none; overflow-wrap: anywhere; }
    }
    .hero__dueno-label { font-size: var(--f-xs); text-transform: uppercase; letter-spacing: .06em; color: var(--t-400); }
    .hero__acciones { grid-column: 1 / -1; display: flex; gap: var(--sp-3); flex-wrap: wrap; }

    .kpis { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: var(--sp-3); }
    .kpi { padding: var(--sp-4); display: flex; flex-direction: column; gap: var(--sp-1); }
    .kpi__valor { font-family: var(--font-display); font-size: var(--f-2xl); font-weight: var(--w-8); color: var(--t-100); }
    .kpi__valor--fecha { font-size: var(--f-lg); }
    .kpi__label { font-size: var(--f-xs); color: var(--t-400); text-transform: uppercase; letter-spacing: .06em; }

    .pestanas { display: flex; gap: var(--sp-1); border-bottom: 1px solid var(--b-1); overflow-x: auto; }
    .pestana {
      display: inline-flex; align-items: center; gap: var(--sp-2); padding: var(--sp-3) var(--sp-4);
      border: none; background: none; font: inherit; font-size: var(--f-sm); font-weight: var(--w-6);
      color: var(--t-400); cursor: pointer; border-bottom: 3px solid transparent; margin-bottom: -1px; white-space: nowrap;
      &.activa { color: var(--c-accent); border-bottom-color: var(--dk-gold); }
      &:hover { color: var(--c-accent); }
    }
    .formulario { padding: var(--sp-6); display: grid; gap: var(--sp-3); }
    .nota-ficha { display: flex; align-items: center; gap: var(--sp-2); font-size: var(--f-sm); color: var(--t-400); margin: 0; }

    .reservas { list-style: none; margin: 0; padding: 0; display: grid; gap: var(--sp-3); }
    .reserva { display: flex; align-items: center; gap: var(--sp-4); padding: var(--sp-4); flex-wrap: wrap; }
    .reserva__icono { width: 40px; height: 40px; border-radius: var(--r-full); background: var(--c-accent-lo); color: var(--c-accent); display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
    .reserva__info { flex: 1; min-width: 180px; display: flex; flex-direction: column; font-size: var(--f-sm); }
    .reserva__info strong { color: var(--t-100); }
    .reserva__info span { color: var(--t-400); font-size: var(--f-xs); }
    .vacio { padding: var(--sp-8); text-align: center; color: var(--t-400); }

    @media (max-width: 768px) {
      .hero { grid-template-columns: 1fr; padding: var(--sp-5); }
      .hero__avatar { width: 68px; height: 68px; }
      .hero__id h1 { font-size: var(--f-2xl); }
      .kpis { grid-template-columns: repeat(2, minmax(0, 1fr)); }
    }
  `],
})
export class ComercioMascotaExpedienteComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly expedientes = inject(ExpedienteService);
  private readonly comercioApi = inject(ComercioApiService);
  private readonly auth = inject(AuthService);
  private readonly i18n = inject(I18nService);

  readonly pestanas: ReadonlyArray<{ id: Pestana; etiqueta: string; icono: string }> = [
    { id: 'historial', etiqueta: 'Historial', icono: 'clipboard-list' },
    { id: 'ficha', etiqueta: 'Ficha del perro', icono: 'dog' },
    { id: 'reservas', etiqueta: 'Reservas', icono: 'calendar' },
  ];

  readonly cargando = signal(true);
  readonly error = signal('');
  readonly expediente = signal<ExpedienteApi | null>(null);
  readonly verticalesComercio = signal<string[]>([]);
  readonly pestana = signal<Pestana>('historial');

  readonly formAbierto = signal(false);
  readonly editando = signal<RegistroServicioApi | null>(null);
  readonly verticalInicial = signal<string | null>(null);
  readonly reservaInicial = signal<string | null>(null);
  readonly guardando = signal(false);
  readonly errorGuardar = signal('');
  readonly mensaje = signal('');
  readonly descargando = signal(false);

  readonly nombreUsuario = computed(() => this.auth.usuario()?.nombre ?? '');
  readonly verticalesConHistorial = computed(() => this.verticalesComercio().filter(tieneHistorialDeServicio));
  readonly registrosPropios = computed(() => this.expediente()?.registros.filter((r) => r.esPropio).length ?? 0);
  readonly ultimaVisita = computed(() => this.expediente()?.servicios.find((s) => new Date(s.fechaInicio) <= new Date())?.fechaInicio ?? null);
  readonly proximaCita = computed(() => proximaCitaDe(this.expediente()));
  readonly edad = computed(() => edadLegible(this.expediente()?.perro.fechaNacimiento, (t, p) => this.i18n.t(t, p)));

  readonly alertas = computed(() => {
    const perro = this.expediente()?.perro;
    if (!perro) return [];
    return [
      ...perro.alergias.map((texto) => ({ texto, etiqueta: 'Alergia', icono: 'alert-triangle', variante: 'error' })),
      ...perro.enfermedades.map((texto) => ({ texto, etiqueta: 'Patología', icono: 'stethoscope', variante: 'warning' })),
      ...perro.medicacion.map((texto) => ({ texto, etiqueta: 'Medicación', icono: 'pill', variante: 'warning' })),
    ];
  });

  async ngOnInit(): Promise<void> {
    const perroId = this.route.snapshot.paramMap.get('perroId') ?? '';
    const consulta = this.route.snapshot.queryParamMap;
    try {
      const comercio = firstValueFrom(this.comercioApi.getMiComercio()).catch(() => null);
      this.expediente.set(await this.expedientes.delComercio(perroId));
      this.verticalesComercio.set((await comercio)?.verticales ?? []);
      if (consulta.get('registrar')) this.registrarDesdeReserva(consulta.get('registrar')!, consulta.get('reserva'));
    } catch (e) {
      this.error.set(esProhibido(e)
        ? 'Esta mascota no tiene reservas con tu negocio.'
        : 'No se pudo cargar el expediente. Inténtalo de nuevo.');
    } finally {
      this.cargando.set(false);
    }
  }

  abrirFormulario(): void {
    this.editando.set(null);
    this.verticalInicial.set(null);
    this.reservaInicial.set(null);
    this.mostrarFormulario();
  }

  registrarDesdeReserva(vertical: string, reservaId: string | null): void {
    if (!this.puedeRegistrar(vertical)) return;
    this.editando.set(null);
    this.verticalInicial.set(vertical);
    this.reservaInicial.set(reservaId);
    this.mostrarFormulario();
  }

  editar(registro: RegistroServicioApi): void {
    this.editando.set(registro);
    this.mostrarFormulario();
  }

  cerrarFormulario(): void {
    this.formAbierto.set(false);
    this.editando.set(null);
    this.errorGuardar.set('');
  }

  async guardar(payload: RegistroServicioPayload): Promise<void> {
    const exp = this.expediente();
    if (!exp) return;
    this.guardando.set(true);
    this.errorGuardar.set('');
    try {
      const editando = this.editando();
      const guardado = editando
        ? await this.expedientes.actualizarRegistro(exp.perro._id, editando._id, payload)
        : await this.expedientes.crearRegistro(exp.perro._id, payload);
      this.reemplazarRegistro(guardado);
      this.mensaje.set(editando ? 'Registro actualizado.' : 'Registro guardado en el historial.');
      this.cerrarFormulario();
    } catch {
      this.errorGuardar.set('No se pudo guardar el registro. Revisa los datos e inténtalo de nuevo.');
    } finally {
      this.guardando.set(false);
    }
  }

  async eliminar(registro: RegistroServicioApi): Promise<void> {
    const exp = this.expediente();
    if (!exp || !confirm(this.i18n.t('¿Eliminar este registro del historial? No se puede deshacer.'))) return;
    try {
      await this.expedientes.eliminarRegistro(exp.perro._id, registro._id);
      this.expediente.set({ ...exp, registros: exp.registros.filter((r) => r._id !== registro._id) });
      this.mensaje.set('Registro eliminado.');
    } catch {
      this.mensaje.set('No se pudo eliminar el registro.');
    }
  }

  async descargarPdf(): Promise<void> {
    const exp = this.expediente();
    if (!exp) return;
    this.descargando.set(true);
    try {
      await this.expedientes.descargarInformeComercio(exp.perro._id, exp.perro.nombre);
    } catch {
      this.mensaje.set('No se pudo generar el PDF. Inténtalo de nuevo.');
    } finally {
      this.descargando.set(false);
    }
  }

  puedeRegistrar(vertical: string): boolean {
    return this.verticalesConHistorial().includes(vertical);
  }

  icono(vertical: string): string {
    return iconoVertical(vertical);
  }

  etiquetaVertical(vertical: string): string {
    return VERTICAL_LABELS[vertical as VerticalKey] ?? vertical;
  }

  estado(estado: string): string {
    return ESTADOS[estado] ?? estado;
  }

  private mostrarFormulario(): void {
    this.mensaje.set('');
    this.errorGuardar.set('');
    this.pestana.set('historial');
    // Se cierra y reabre para que el formulario arranque de cero con los nuevos datos.
    this.formAbierto.set(false);
    queueMicrotask(() => this.formAbierto.set(true));
  }

  private reemplazarRegistro(registro: RegistroServicioApi): void {
    const exp = this.expediente();
    if (!exp) return;
    const resto = exp.registros.filter((r) => r._id !== registro._id);
    const registros = [registro, ...resto].sort(
      (a, b) => new Date(b.fechaServicio ?? b.createdAt ?? 0).getTime() - new Date(a.fechaServicio ?? a.createdAt ?? 0).getTime(),
    );
    this.expediente.set({ ...exp, registros });
  }
}

function esProhibido(error: unknown): boolean {
  return typeof error === 'object' && error !== null && (error as { status?: number }).status === 403;
}
