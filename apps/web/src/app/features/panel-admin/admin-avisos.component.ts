import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { RsIconComponent } from '../../shared/components/icon/rs-icon.component';
import { TraducirPipe } from '../../core/i18n/traducir.pipe';
import {
  AdminAvisosService, AvisoProgramado, EstadoPush, ResultadoAviso,
} from './services/admin-avisos.service';

/** Qué dispara cada aviso, en lenguaje del panel. */
const DISPARADORES = [
  { valor: 'difusion', label: 'Difusión: a todo el segmento', pideDias: false },
  { valor: 'pago_pendiente', label: 'Recordatorio de pago pendiente', pideDias: true },
  { valor: 'membresia_por_vencer', label: 'Membresía a punto de vencer', pideDias: true },
  { valor: 'reserva_proxima', label: 'Reserva próxima', pideDias: true },
] as const;

const SEGMENTOS = [
  { valor: 'todos', label: 'Todos' },
  { valor: 'clientes', label: 'Clientes' },
  { valor: 'comercios', label: 'Comercios' },
] as const;

const DIAS = ['D', 'L', 'M', 'X', 'J', 'V', 'S'];

@Component({
  selector: 'app-admin-avisos',
  standalone: true,
  imports: [
    TraducirPipe, ReactiveFormsModule, DatePipe, RsIconComponent
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
<div class="avisos">
  <header class="avisos__cabecera">
    <div>
      <h1>{{ 'Notificaciones push' | t }}</h1>
      <p>{{ 'Envía un aviso ahora o prográmalo para que salga solo.' | t }}</p>
    </div>
  </header>

  @if (estado(); as e) {
    <!--
      Lo primero es si el envío está operativo: sin credenciales de FCM el
      formulario aceptaría el envío y no llegaría nada a nadie.
    -->
    <div class="rs-alert" [class.rs-alert--warning]="!e.configurado" [class.rs-alert--info]="e.configurado">
      <rs-icon [name]="e.configurado ? 'check-circle' : 'alert-circle'" [size]="16" [stroke]="2" />
      @if (e.configurado) {
        <span>Envío operativo · {{ e.dispositivos.todos }} dispositivos registrados
          ({{ e.dispositivos.clientes }} clientes, {{ e.dispositivos.comercios }} comercios).</span>
      } @else {
        <span>{{ 'El envío está apagado: faltan las credenciales de Firebase en el servidor (' | t }}<code>{{ 'FCM_PROJECT_ID' | t }}</code>, <code>{{ 'FCM_CLIENT_EMAIL' | t }}</code>, <code>{{ 'FCM_PRIVATE_KEY' | t }}</code>).
          Los dispositivos se siguen registrando: hay {{ e.dispositivos.todos }}.</span>
      }
    </div>
  }

  <!-- ─── Envío inmediato ─── -->
  <section class="rs-card avisos__bloque">
    <h2>{{ 'Enviar ahora' | t }}</h2>

    <form [formGroup]="formEnvio" (ngSubmit)="enviar()">
      <div class="avisos__fila">
        <div class="rs-field">
          <label class="rs-lbl">{{ 'Destinatarios' | t }}</label>
          <select class="rs-inp" formControlName="segmento">
            @for (s of segmentos; track s.valor) { <option [value]="s.valor">{{ s.label | t }}</option> }
          </select>
        </div>
        <div class="rs-field">
          <label class="rs-lbl">{{ 'Al tocar, abrir' | t }}</label>
          <input class="rs-inp" formControlName="ruta" placeholder="/reservas" />
        </div>
      </div>

      <div class="rs-field">
        <label class="rs-lbl">{{ 'Título' | t }}</label>
        <input class="rs-inp" formControlName="titulo" maxlength="80" [placeholder]="'Tu reserva es mañana' | t" />
      </div>

      <div class="rs-field">
        <label class="rs-lbl">{{ 'Mensaje' | t }}</label>
        <textarea class="rs-inp" formControlName="cuerpo" rows="3" maxlength="300"
                  [placeholder]="'Recuerda llevar la cartilla de vacunación al día.' | t"></textarea>
      </div>

      @if (resultado(); as r) {
        <div class="rs-alert rs-alert--success">
          <rs-icon name="check-circle" [size]="16" [stroke]="2" />
          <span>Enviado a {{ r.enviados }} de {{ r.destinatarios }} dispositivos.</span>
        </div>
      }
      @if (error()) {
        <div class="rs-alert rs-alert--error">
          <rs-icon name="alert-circle" [size]="16" [stroke]="2" /> <span>{{ error() }}</span>
        </div>
      }

      <button type="submit" class="rs-btn rs-btn--primary" [disabled]="formEnvio.invalid || enviando()">
        @if (enviando()) { <span class="rs-spin"></span> Enviando… } @else { Enviar notificación }
      </button>
    </form>
  </section>

  <!-- ─── Avisos automáticos ─── -->
  <section class="rs-card avisos__bloque">
    <div class="avisos__bloque-cabecera">
      <h2>{{ 'Avisos automáticos' | t }}</h2>
      <button type="button" class="rs-btn rs-btn--outline rs-btn--sm" (click)="alternarFormulario()">
        {{ mostrandoFormulario() ? 'Cancelar' : '+ Programar aviso' }}
      </button>
    </div>

    @if (mostrandoFormulario()) {
      <form [formGroup]="formProgramado" (ngSubmit)="guardarProgramado()" class="avisos__form">
        <div class="avisos__fila">
          <div class="rs-field">
            <label class="rs-lbl">{{ 'Nombre interno' | t }}</label>
            <input class="rs-inp" formControlName="nombre" [placeholder]="'Recordatorio de pago' | t" />
          </div>
          <div class="rs-field">
            <label class="rs-lbl">{{ 'Cuándo se dispara' | t }}</label>
            <select class="rs-inp" formControlName="disparador">
              @for (d of disparadores; track d.valor) { <option [value]="d.valor">{{ d.label | t }}</option> }
            </select>
          </div>
        </div>

        <div class="avisos__fila">
          <div class="rs-field">
            <label class="rs-lbl">{{ 'Destinatarios' | t }}</label>
            <select class="rs-inp" formControlName="segmento">
              @for (s of segmentos; track s.valor) { <option [value]="s.valor">{{ s.label | t }}</option> }
            </select>
          </div>
          <div class="rs-field">
            <label class="rs-lbl">{{ 'Hora de envío' | t }}</label>
            <input class="rs-inp" type="time" formControlName="hora" />
          </div>
          @if (pideDias()) {
            <div class="rs-field">
              <label class="rs-lbl">{{ 'Días de antelación' | t }}</label>
              <input class="rs-inp" type="number" min="0" max="365" formControlName="diasAntelacion" />
            </div>
          }
        </div>

        <div class="rs-field">
          <label class="rs-lbl">{{ 'Días de la semana' | t }}</label>
          <div class="avisos__dias">
            @for (dia of dias; track $index) {
              <button type="button" class="avisos__dia" [class.activo]="tieneDia($index)"
                      [attr.aria-pressed]="tieneDia($index)" (click)="alternarDia($index)">{{ dia }}</button>
            }
          </div>
          <span class="rs-field-hint">{{ 'Sin ninguno marcado, sale todos los días.' | t }}</span>
        </div>

        <div class="rs-field">
          <label class="rs-lbl">{{ 'Título' | t }}</label>
          <input class="rs-inp" formControlName="titulo" maxlength="80" />
        </div>
        <div class="rs-field">
          <label class="rs-lbl">{{ 'Mensaje' | t }}</label>
          <textarea class="rs-inp" formControlName="cuerpo" rows="2" maxlength="300"></textarea>
        </div>
        <div class="rs-field">
          <label class="rs-lbl">{{ 'Al tocar, abrir' | t }}</label>
          <input class="rs-inp" formControlName="ruta" placeholder="/reservas" />
        </div>

        <button type="submit" class="rs-btn rs-btn--primary rs-btn--sm"
                [disabled]="formProgramado.invalid || guardando()">
          {{ editandoId() ? 'Guardar cambios' : 'Programar' }}
        </button>
      </form>
    }

    @if (cargando()) {
      <p class="avisos__vacio"><span class="rs-spin"></span> {{ 'Cargando…' | t }}</p>
    } @else if (!programados().length) {
      <p class="avisos__vacio">{{ 'Todavía no hay avisos automáticos.' | t }}</p>
    } @else {
      <div class="avisos__tabla-wrap">
        <table class="avisos__tabla">
          <thead>
            <tr><th>{{ 'Aviso' | t }}</th><th>{{ 'Cuándo' | t }}</th><th>{{ 'A quién' | t }}</th><th>{{ 'Última vez' | t }}</th><th></th></tr>
          </thead>
          <tbody>
            @for (a of programados(); track a._id) {
              <tr [class.inactivo]="!a.activo">
                <td>
                  <strong>{{ a.nombre }}</strong>
                  <span class="avisos__sub">{{ a.titulo }}</span>
                </td>
                <td>
                  {{ etiquetaDisparador(a.disparador) }}<br />
                  <span class="avisos__sub">{{ a.hora }} · {{ etiquetaDias(a.diasSemana) }}</span>
                </td>
                <td>{{ etiquetaSegmento(a.segmento) }}</td>
                <td>
                  @if (a.ultimaEjecucion) {
                    {{ a.ultimaEjecucion | date:'dd/MM HH:mm' }}<br />
                    <span class="avisos__sub">{{ a.ultimoEnviados }} enviados</span>
                  } @else { <span class="avisos__sub">{{ 'Nunca' | t }}</span> }
                </td>
                <td class="avisos__acciones">
                  <button type="button" class="rs-btn rs-btn--ghost rs-btn--xs" (click)="editar(a)">{{ 'Editar' | t }}</button>
                  <button type="button" class="rs-btn rs-btn--ghost rs-btn--xs" (click)="probar(a)">{{ 'Probar' | t }}</button>
                  <button type="button" class="rs-btn rs-btn--ghost rs-btn--xs" (click)="alternarActivo(a)">
                    {{ a.activo ? 'Pausar' : 'Activar' }}
                  </button>
                  <button type="button" class="rs-btn rs-btn--danger rs-btn--xs" (click)="eliminar(a)">{{ 'Quitar' | t }}</button>
                </td>
              </tr>
            }
          </tbody>
        </table>
      </div>
    }
  </section>
</div>
  `,
  styles: [`
    :host { display: block; }
    .avisos { display: flex; flex-direction: column; gap: var(--sp-6); }
    .avisos__cabecera h1 { font-size: var(--f-2xl); font-weight: var(--w-8); color: var(--t-100); }
    .avisos__cabecera p { font-size: var(--f-sm); color: var(--t-400); margin-top: var(--sp-1); }

    .avisos__bloque { padding: var(--sp-6); display: flex; flex-direction: column; gap: var(--sp-4); }
    .avisos__bloque h2 { font-size: var(--f-md); font-weight: var(--w-7); color: var(--t-100); }
    .avisos__bloque-cabecera {
      display: flex; align-items: center; justify-content: space-between;
      gap: var(--sp-3); flex-wrap: wrap;
    }
    .avisos__bloque form { display: flex; flex-direction: column; gap: var(--sp-4); }

    .avisos__fila {
      display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: var(--sp-4);
    }

    .avisos__form {
      padding: var(--sp-4); border: 1px dashed var(--b-2); border-radius: var(--r-lg);
      background: var(--c-raised);
    }

    .avisos__dias { display: flex; gap: var(--sp-2); flex-wrap: wrap; }
    .avisos__dia {
      width: 40px; height: 40px; flex-shrink: 0;
      border: 1px solid var(--b-2); border-radius: var(--r-full);
      background: var(--c-card); color: var(--t-300);
      font-family: var(--font); font-size: var(--f-sm); font-weight: var(--w-6); cursor: pointer;
      transition: background var(--d-2), color var(--d-2);
    }
    .avisos__dia.activo { background: var(--c-accent); border-color: var(--c-accent); color: #fff; }

    /* La tabla se desplaza dentro de su caja: el panel no puede crecer a lo ancho. */
    .avisos__tabla-wrap { overflow-x: auto; }
    .avisos__tabla { width: 100%; border-collapse: collapse; font-size: var(--f-sm); }
    .avisos__tabla th {
      text-align: left; padding: var(--sp-2) var(--sp-3);
      font-size: var(--f-xs); text-transform: uppercase; letter-spacing: .05em; color: var(--t-400);
      border-bottom: 1px solid var(--b-1); white-space: nowrap;
    }
    .avisos__tabla td {
      padding: var(--sp-3); border-bottom: 1px solid var(--b-1);
      color: var(--t-200); vertical-align: top;
    }
    .avisos__tabla tr.inactivo { opacity: .55; }
    .avisos__sub { display: block; font-size: var(--f-xs); color: var(--t-400); }
    .avisos__acciones { display: flex; gap: var(--sp-1); flex-wrap: wrap; }
    .avisos__vacio {
      display: flex; align-items: center; gap: var(--sp-2);
      font-size: var(--f-sm); color: var(--t-400);
    }
  `],
})
export class AdminAvisosComponent implements OnInit {
  private readonly api = inject(AdminAvisosService);
  private readonly fb = inject(FormBuilder);

  readonly disparadores = DISPARADORES;
  readonly segmentos = SEGMENTOS;
  readonly dias = DIAS;

  readonly estado = signal<EstadoPush | null>(null);
  readonly programados = signal<AvisoProgramado[]>([]);
  readonly cargando = signal(true);
  readonly enviando = signal(false);
  readonly guardando = signal(false);
  readonly resultado = signal<ResultadoAviso | null>(null);
  readonly error = signal<string | null>(null);
  readonly mostrandoFormulario = signal(false);
  readonly editandoId = signal<string | null>(null);
  readonly diasElegidos = signal<number[]>([]);

  readonly formEnvio = this.fb.nonNullable.group({
    segmento: ['todos', Validators.required],
    titulo: ['', [Validators.required, Validators.minLength(3)]],
    cuerpo: ['', [Validators.required, Validators.minLength(3)]],
    ruta: ['/'],
  });

  readonly formProgramado = this.fb.nonNullable.group({
    nombre: ['', [Validators.required, Validators.minLength(3)]],
    disparador: ['difusion', Validators.required],
    segmento: ['todos', Validators.required],
    titulo: ['', [Validators.required, Validators.minLength(3)]],
    cuerpo: ['', [Validators.required, Validators.minLength(3)]],
    ruta: ['/'],
    hora: ['10:00', Validators.required],
    diasAntelacion: [3],
  });

  /** Los días de antelación sólo tienen sentido en los disparadores con condición. */
  readonly pideDias = computed(() => {
    const elegido = this.formProgramado.controls.disparador.value;
    return DISPARADORES.find((d) => d.valor === elegido)?.pideDias ?? false;
  });

  ngOnInit(): void {
    void this.cargar();
  }

  private async cargar(): Promise<void> {
    this.cargando.set(true);
    try {
      const [estado, programados] = await Promise.all([this.api.estado(), this.api.listar()]);
      this.estado.set(estado);
      this.programados.set(programados);
    } catch {
      this.error.set('No se pudieron cargar los avisos.');
    } finally {
      this.cargando.set(false);
    }
  }

  async enviar(): Promise<void> {
    if (this.formEnvio.invalid) return;

    this.enviando.set(true);
    this.error.set(null);
    this.resultado.set(null);
    try {
      this.resultado.set(await this.api.enviar(this.formEnvio.getRawValue()));
      this.formEnvio.patchValue({ titulo: '', cuerpo: '' });
    } catch {
      this.error.set('No se pudo enviar la notificación.');
    } finally {
      this.enviando.set(false);
    }
  }

  alternarFormulario(): void {
    this.mostrandoFormulario.update((v) => !v);
    if (!this.mostrandoFormulario()) this.limpiarFormulario();
  }

  tieneDia(dia: number): boolean {
    return this.diasElegidos().includes(dia);
  }

  alternarDia(dia: number): void {
    this.diasElegidos.update((l) => (l.includes(dia) ? l.filter((d) => d !== dia) : [...l, dia]));
  }

  editar(aviso: AvisoProgramado): void {
    this.editandoId.set(aviso._id);
    this.mostrandoFormulario.set(true);
    this.diasElegidos.set(aviso.diasSemana ?? []);
    this.formProgramado.patchValue({
      nombre: aviso.nombre, disparador: aviso.disparador, segmento: aviso.segmento,
      titulo: aviso.titulo, cuerpo: aviso.cuerpo, ruta: aviso.ruta,
      hora: aviso.hora, diasAntelacion: aviso.diasAntelacion,
    });
  }

  async guardarProgramado(): Promise<void> {
    if (this.formProgramado.invalid) return;

    this.guardando.set(true);
    this.error.set(null);
    const datos = { ...this.formProgramado.getRawValue(), diasSemana: this.diasElegidos() };

    try {
      const id = this.editandoId();
      if (id) await this.api.actualizar(id, datos);
      else await this.api.crear(datos);

      this.limpiarFormulario();
      this.mostrandoFormulario.set(false);
      await this.cargar();
    } catch {
      this.error.set('No se pudo guardar el aviso.');
    } finally {
      this.guardando.set(false);
    }
  }

  async alternarActivo(aviso: AvisoProgramado): Promise<void> {
    await this.api.actualizar(aviso._id, { activo: !aviso.activo });
    await this.cargar();
  }

  async probar(aviso: AvisoProgramado): Promise<void> {
    this.resultado.set(await this.api.ejecutar(aviso._id));
    await this.cargar();
  }

  async eliminar(aviso: AvisoProgramado): Promise<void> {
    // Quitar un aviso automático no se deshace: se pregunta antes.
    if (!confirm(`¿Quitar el aviso "${aviso.nombre}"?`)) return;
    await this.api.eliminar(aviso._id);
    await this.cargar();
  }

  etiquetaDisparador(valor: string): string {
    return DISPARADORES.find((d) => d.valor === valor)?.label ?? valor;
  }

  etiquetaSegmento(valor: string): string {
    return SEGMENTOS.find((s) => s.valor === valor)?.label ?? valor;
  }

  etiquetaDias(dias?: number[]): string {
    if (!dias?.length) return 'todos los días';
    return [...dias].sort().map((d) => DIAS[d]).join(' ');
  }

  private limpiarFormulario(): void {
    this.editandoId.set(null);
    this.diasElegidos.set([]);
    this.formProgramado.reset({
      nombre: '', disparador: 'difusion', segmento: 'todos',
      titulo: '', cuerpo: '', ruta: '/', hora: '10:00', diasAntelacion: 3,
    });
  }
}
