import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import {
  BusquedaTransportesRespuesta, MODALIDAD_TRANSPORTE_LABELS, ModalidadTransporte, OrdenTransporte,
  ResultadoTransporte, resumenSolicitudViaje,
} from 'shared';
import { MarcoViajeComponent } from '../componentes/marco-viaje.component';
import { RsOpcionesComponent } from '../../../../shared/components/opciones/rs-opciones.component';
import { RsResumenViajeComponent } from '../../../../shared/components/resumen-viaje/rs-resumen-viaje.component';
import { RsStarsComponent } from '../../../../shared/components/stars/rs-stars.component';
import { RsIconComponent } from '../../../../shared/components/icon/rs-icon.component';
import { EurosPipe } from '../../../../shared/pipes/euros.pipe';
import { TraducirPipe } from '../../../../core/i18n/traducir.pipe';
import { I18nService } from '../../../../core/i18n/i18n.service';
import { AuthService } from '../../../../core/auth/auth.service';
import { mensajeDeError } from '../../../../shared/mensaje-error';
import { TransporteViajeApi } from '../transporte-viaje.api';
import { TransporteViajeStore } from '../transporte-viaje.store';
import { ICONO_INCLUIDO, OPCIONES_INCLUIDOS, OPCIONES_ORDEN, etiquetaIncluido } from '../transporte-viaje.opciones';
import { detallesDelViaje, lugarCorto, textoDuracion } from '../transporte-viaje.formato';

const OPCIONES_FILTRO_MODALIDAD = [
  { valor: 'todas', etiqueta: 'Todos' },
  { valor: ModalidadTransporte.EXCLUSIVO, etiqueta: 'Exclusivo' },
  { valor: ModalidadTransporte.COMPARTIDO, etiqueta: 'Compartido' },
  { valor: ModalidadTransporte.CON_PROPIETARIO, etiqueta: 'Con propietario' },
];

/**
 * Pantalla 3 (diapositiva 05, pantalla 3 del mockup): las empresas que pueden
 * hacer el viaje, cada una con su **precio total**. Nunca se enseña cómo
 * tarifica cada empresa (€/km, zona…): eso lo traduce el servidor.
 */
@Component({
  selector: 'app-resultados-viaje',
  standalone: true,
  imports: [
    ReactiveFormsModule, RouterLink, MarcoViajeComponent, RsOpcionesComponent, RsResumenViajeComponent, RsStarsComponent,
    RsIconComponent, EurosPipe, TraducirPipe,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
<app-marco-viaje [paso]="3" titulo="Elige tu transporte" subtitulo="Compara y selecciona." volverA="/transporte/viaje/mascota" [ancho]="true">
  <rs-resumen-viaje [origen]="origen()" [destino]="destino()" [detalles]="detalles()" (modificar)="modificar()" />

  @if (respuesta()?.ruta; as r) {
    <p class="rv3__ruta">
      <rs-icon name="route" [size]="15" [stroke]="2"></rs-icon>
      {{ '{km} km · {tiempo} de trayecto' | t: { km: r.km, tiempo: duracion(r.duracionMin) } }}
      @if (viajes() > 1) { · {{ '{n} viajes' | t: { n: viajes() } }} }
    </p>
  }

  <div class="rv3">
    <aside class="rv3__filtros" [class.is-abierto]="filtrosAbiertos()">
      <rs-opciones [formControl]="filtroModalidad" leyenda="Modalidad" variante="chip" [opciones]="opcionesModalidad" />
      <rs-opciones [formControl]="filtroIncluidos" leyenda="Que incluya" variante="chip" [multiple]="true" [opciones]="opcionesIncluidos" />
    </aside>

    <section class="rv3__lista" aria-live="polite">
      <div class="rv3__barra">
        <p class="rv3__cuenta">
          @if (cargando()) { {{ 'Buscando transportes…' | t }} }
          @else { {{ '{n} transportes disponibles' | t: { n: filtrados().length } }} }
        </p>
        <button type="button" class="rs-btn rs-btn--outline rs-btn--sm rv3__boton-filtros" (click)="filtrosAbiertos.set(!filtrosAbiertos())"
                [attr.aria-expanded]="filtrosAbiertos()">
          <rs-icon name="settings" [size]="14" [stroke]="2"></rs-icon> {{ 'Filtros' | t }}
        </button>
        <label class="rv3__orden">
          <span>{{ 'Ordenar por' | t }}</span>
          <select class="rs-inp" [formControl]="orden">
            @for (o of opcionesOrden; track o.valor) { <option [value]="o.valor">{{ o.etiqueta | t }}</option> }
          </select>
        </label>
      </div>

      @if (avisoPresupuesto()) {
        <div class="rs-alert rs-alert--success" role="status">
          {{ avisoPresupuesto() }} <a routerLink="/presupuestos">{{ 'Ver mis presupuestos' | t }}</a>
        </div>
      }
      @if (error()) { <div class="rs-alert rs-alert--error">{{ error() }}</div> }

      @if (cargando()) {
        @for (i of [1, 2, 3]; track i) { <div class="rv3__tarjeta rv3__tarjeta--cargando rs-skeleton"></div> }
      } @else if (!filtrados().length) {
        <div class="rv3__vacio">
          <rs-icon name="truck" [size]="36" [stroke]="1.6"></rs-icon>
          <p>{{ (respuesta()?.motivo || 'Ningún transportista coincide con esos filtros.') | t }}</p>
          <div class="rv3__vacio-acciones">
            @if (ocultosPorFiltros() > 0) {
              <button type="button" class="rs-btn rs-btn--gold" (click)="quitarFiltros()">
                {{ 'Quitar filtros ({n} más)' | t: { n: ocultosPorFiltros() } }}
              </button>
            }
            <button type="button" class="rs-btn rs-btn--outline" (click)="modificar()">{{ 'Modificar búsqueda' | t }}</button>
            <a class="rs-btn rs-btn--ghost" routerLink="/transporte/empresas">{{ 'Ver todas las empresas' | t }}</a>
          </div>
        </div>
      } @else {
        @if (conPresupuesto().length > 1) {
          <button type="button" class="rs-btn rs-btn--outline-gold rs-btn--block" [disabled]="pidiendo()" (click)="pedirPresupuesto(conPresupuesto())">
            {{ 'Pedir presupuesto a todas las que lo hacen a medida ({n})' | t: { n: conPresupuesto().length } }}
          </button>
        }
        @for (r of filtrados(); track r.servicioId + r.modalidad) {
          <article class="rv3__tarjeta">
            <div class="rv3__cabecera">
              <div class="rv3__empresa">
                <h2>{{ r.titulo }}</h2>
                <div class="rv3__valoracion">
                  @if (r.totalResenas) {
                    <rs-stars [score]="r.rating" [size]="13" /> <strong>{{ r.rating.toFixed(1) }}</strong> <span>({{ r.totalResenas }})</span>
                  } @else { <span>{{ 'Nuevo en Doogking' | t }}</span> }
                  @if (r.verificado) {
                    <span class="rv3__verificada"><rs-icon name="badge-check" [size]="14" [stroke]="2"></rs-icon>{{ 'Verificada' | t }}</span>
                  }
                </div>
              </div>
              @if (r.imagen) { <img class="rv3__imagen" [src]="r.imagen" [alt]="r.titulo" loading="lazy" /> }
            </div>

            <span class="rv3__modalidad" [attr.data-modalidad]="r.modalidad">{{ etiquetaModalidad(r.modalidad) | t }}</span>

            <ul class="rv3__datos">
              <li><rs-icon name="clock" [size]="14" [stroke]="2"></rs-icon>{{ 'Recogida: {hora}' | t: { hora: horaRecogida() } }}</li>
              <li><rs-icon name="route" [size]="14" [stroke]="2"></rs-icon>{{ 'Duración: {tiempo}' | t: { tiempo: duracion(r.duracionMin) } }}</li>
              @for (inc of r.incluidos.slice(0, 4); track inc) {
                <li><rs-icon [name]="iconoIncluido(inc)" [size]="14" [stroke]="2"></rs-icon>{{ etiquetaIncluido(inc) | t }}</li>
              }
            </ul>

            <div class="rv3__pie">
              <div class="rv3__precio">
                @if (r.estado === 'precio') {
                  <strong>{{ r.total * viajes() | euros }}</strong>
                  <span>{{ 'Precio final · IVA incluido' | t }}</span>
                  @if (r.requiereAceptacion) { <span class="rv3__aceptacion">{{ 'El transportista confirma la hora' | t }}</span> }
                } @else {
                  <strong class="rv3__consultar">{{ 'Precio a medida' | t }}</strong>
                  <span>{{ (r.motivoPresupuesto || 'La empresa estudia el viaje y te da un precio cerrado.') | t }}</span>
                }
              </div>
              <div class="rv3__acciones">
                <a class="rs-btn rs-btn--outline rs-btn--sm" [routerLink]="['/transporte', r.servicioId]" [queryParams]="{ modalidad: r.modalidad }">
                  {{ 'Ver detalles' | t }}
                </a>
                @if (r.estado === 'precio') {
                  <button type="button" class="rs-btn rs-btn--gold rs-btn--sm" (click)="reservar(r)">{{ 'Reservar' | t }}</button>
                } @else {
                  <button type="button" class="rs-btn rs-btn--gold rs-btn--sm" [disabled]="pidiendo()" (click)="pedirPresupuesto([r])">
                    {{ 'Solicitar presupuesto' | t }}
                  </button>
                }
              </div>
            </div>
          </article>
        }
      }
    </section>
  </div>
</app-marco-viaje>
  `,
  styles: [`
    :host { display: block; }
    .rv3__ruta { display: flex; align-items: center; gap: var(--sp-2); margin: var(--sp-3) 0 0; font-size: var(--f-sm); color: var(--t-300); }
    .rv3 { display: grid; grid-template-columns: 240px 1fr; gap: var(--sp-6); margin-top: var(--sp-5); align-items: start; }
    .rv3__filtros {
      position: sticky; top: calc(var(--dk-navbar-h, 64px) + var(--sp-4));
      display: flex; flex-direction: column; gap: var(--sp-5);
      padding: var(--sp-4); background: var(--c-card); border: 1px solid var(--b-2); border-radius: var(--r-xl);
    }
    .rv3__lista { display: flex; flex-direction: column; gap: var(--sp-4); min-width: 0; }
    .rv3__barra { display: flex; align-items: center; gap: var(--sp-3); flex-wrap: wrap; }
    .rv3__cuenta { margin: 0 auto 0 0; font-weight: var(--w-7); color: var(--dk-blue-text); }
    .rv3__boton-filtros { display: none; }
    .rv3__orden { display: flex; align-items: center; gap: var(--sp-2); font-size: var(--f-sm); color: var(--t-400);
      .rs-inp { width: auto; padding-block: var(--sp-2); }
    }
    .rv3__tarjeta {
      display: flex; flex-direction: column; gap: var(--sp-3);
      padding: var(--sp-4) var(--sp-5); background: var(--c-card); border: 1px solid var(--b-2);
      border-radius: var(--r-2xl); box-shadow: var(--sh-sm);
    }
    .rv3__tarjeta--cargando { height: 220px; }
    .rv3__cabecera { display: flex; justify-content: space-between; gap: var(--sp-3); }
    .rv3__empresa h2 { margin: 0; font-family: var(--font-display); font-size: var(--f-lg); font-weight: var(--w-8); color: var(--dk-blue-text); }
    .rv3__valoracion { display: flex; align-items: center; flex-wrap: wrap; gap: var(--sp-1); margin-top: var(--sp-1); font-size: var(--f-xs); color: var(--t-400);
      strong { color: var(--t-100); }
    }
    .rv3__verificada { display: inline-flex; align-items: center; gap: 2px; margin-left: var(--sp-2); color: var(--c-success); font-weight: var(--w-6); }
    .rv3__imagen { width: 112px; height: 72px; object-fit: cover; border-radius: var(--r-lg); flex: 0 0 auto; }
    .rv3__modalidad {
      align-self: flex-start; padding: 2px var(--sp-3); border-radius: var(--r-full);
      font-size: var(--f-xs); font-weight: var(--w-7); background: var(--c-accent-lo); color: var(--dk-blue);
      &[data-modalidad='exclusivo'] { background: var(--dk-gold-lo); color: var(--dk-gold-text); }
    }
    .rv3__datos { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: var(--sp-1) var(--sp-3); margin: 0; padding: 0; list-style: none;
      li { display: flex; align-items: center; gap: var(--sp-1); font-size: var(--f-xs); color: var(--t-300); }
      rs-icon { color: var(--dk-blue); flex: 0 0 auto; }
    }
    .rv3__pie { display: flex; justify-content: space-between; align-items: flex-end; gap: var(--sp-3); flex-wrap: wrap;
      padding-top: var(--sp-3); border-top: 1px solid var(--b-1); }
    .rv3__precio { display: flex; flex-direction: column;
      strong { font-family: var(--font-display); font-size: var(--f-2xl); font-weight: var(--w-8); color: var(--dk-blue-text); line-height: 1.1; }
      span { font-size: var(--f-xs); color: var(--t-400); }
    }
    .rv3__consultar { font-size: var(--f-lg) !important; }
    .rv3__aceptacion { color: var(--dk-gold-text) !important; font-weight: var(--w-6); }
    .rv3__acciones { display: flex; gap: var(--sp-2); }
    .rv3__vacio { display: flex; flex-direction: column; align-items: center; gap: var(--sp-3); padding: var(--sp-10) var(--sp-4);
      text-align: center; color: var(--t-300); background: var(--c-card); border: 1px dashed var(--b-a); border-radius: var(--r-2xl);
      rs-icon { color: var(--t-400); }
    }
    .rv3__vacio-acciones { display: flex; gap: var(--sp-2); flex-wrap: wrap; justify-content: center; }

    @media (max-width: 1024px) {
      .rv3 { grid-template-columns: 1fr; }
      .rv3__filtros { display: none; position: static; }
      .rv3__filtros.is-abierto { display: flex; }
      .rv3__boton-filtros { display: inline-flex; }
    }
    @media (max-width: 480px) {
      .rv3__tarjeta { padding: var(--sp-4); }
      .rv3__imagen { width: 88px; height: 60px; }
      .rv3__acciones { width: 100%; .rs-btn { flex: 1; } }
      .rv3__orden span { display: none; }
    }
  `],
})
export class ResultadosViajeComponent implements OnInit {
  private readonly store = inject(TransporteViajeStore);
  private readonly api = inject(TransporteViajeApi);
  private readonly router = inject(Router);
  private readonly auth = inject(AuthService);
  private readonly i18n = inject(I18nService);

  readonly opcionesOrden = OPCIONES_ORDEN;
  readonly opcionesModalidad = OPCIONES_FILTRO_MODALIDAD;
  readonly opcionesIncluidos = OPCIONES_INCLUIDOS;

  readonly respuesta = signal<BusquedaTransportesRespuesta | null>(null);
  readonly cargando = signal(true);
  readonly error = signal<string | null>(null);
  readonly pidiendo = signal(false);
  readonly avisoPresupuesto = signal<string | null>(null);
  readonly filtrosAbiertos = signal(false);

  readonly orden = new FormControl<string>(OrdenTransporte.RECOMENDADOS, { nonNullable: true });
  readonly filtroModalidad = new FormControl<string>('todas', { nonNullable: true });
  readonly filtroIncluidos = new FormControl<string[]>([], { nonNullable: true });

  private readonly modalidadElegida = signal<string>('todas');
  private readonly incluidosElegidos = signal<string[]>([]);

  readonly origen = computed(() => lugarCorto(this.store.borrador().origen?.texto));
  readonly destino = computed(() => lugarCorto(this.store.borrador().destino?.texto));
  readonly detalles = computed(() => detallesDelViaje(this.store.borrador(), this.store.mascotasDelViaje(), this.i18n));
  readonly horaRecogida = computed(() => this.detalles()[1] ?? '');

  readonly filtrados = computed(() => {
    const modalidad = this.modalidadElegida();
    const incluidos = this.incluidosElegidos();
    return (this.respuesta()?.resultados ?? []).filter((r) =>
      (modalidad === 'todas' || r.modalidad === modalidad)
      && incluidos.every((i) => r.incluidos.includes(i)));
  });

  readonly viajes = computed(() => this.respuesta()?.viajes ?? 1);

  /** Resultados que existen pero esconden los filtros: el estado vacío ofrece quitarlos. */
  readonly ocultosPorFiltros = computed(() => (this.respuesta()?.resultados.length ?? 0) - this.filtrados().length);

  readonly conPresupuesto = computed(() => this.filtrados().filter((r) => r.estado === 'presupuesto'));

  constructor() {
    this.orden.valueChanges.pipe(takeUntilDestroyed()).subscribe((orden) => {
      this.store.actualizar({ orden: orden as OrdenTransporte });
      void this.buscar();
    });
    this.filtroModalidad.valueChanges.pipe(takeUntilDestroyed()).subscribe((m) => {
      this.modalidadElegida.set(m);
      this.store.actualizar({ filtroModalidad: m as ModalidadTransporte | 'todas' });
    });
    this.filtroIncluidos.valueChanges.pipe(takeUntilDestroyed()).subscribe((lista) => {
      this.incluidosElegidos.set(lista);
      this.store.actualizar({ filtroIncluidos: lista });
    });
  }

  ngOnInit(): void {
    if (!this.store.solicitud()) {
      void this.router.navigate(['/transporte']);
      return;
    }
    const b = this.store.borrador();
    // Por defecto se enseña primero la modalidad que el cliente pidió en la pantalla 2.
    const modalidad = b.filtroModalidad === 'todas' ? b.modalidad : b.filtroModalidad;
    this.orden.setValue(b.orden, { emitEvent: false });
    this.filtroModalidad.setValue(modalidad);
    this.filtroIncluidos.setValue(b.filtroIncluidos.length ? b.filtroIncluidos : b.preferencias);
    void this.buscar();
  }

  duracion(minutos: number): string {
    return textoDuracion(minutos);
  }

  etiquetaModalidad(modalidad: ModalidadTransporte): string {
    return MODALIDAD_TRANSPORTE_LABELS[modalidad];
  }

  etiquetaIncluido(incluido: string): string {
    return etiquetaIncluido(incluido);
  }

  iconoIncluido(incluido: string): string {
    return ICONO_INCLUIDO[incluido] ?? 'check';
  }

  quitarFiltros(): void {
    this.filtroModalidad.setValue('todas');
    this.filtroIncluidos.setValue([]);
  }

  modificar(): void {
    void this.router.navigate(['/transporte']);
  }

  reservar(r: ResultadoTransporte): void {
    this.store.elegir({ servicioId: r.servicioId, comercioId: r.comercioId, titulo: r.titulo, modalidad: r.modalidad, total: r.total });
    void this.router.navigate(['/transporte/viaje/reserva']);
  }

  /** Pide presupuesto con los datos ya descritos: el cliente no rellena nada más. */
  async pedirPresupuesto(resultados: ResultadoTransporte[]): Promise<void> {
    if (!this.auth.estaAutenticado()) {
      void this.router.navigate(['/auth/login'], { queryParams: { volverA: '/transporte/viaje/resultados' } });
      return;
    }
    const solicitud = this.store.solicitud();
    if (!solicitud) return;
    this.pidiendo.set(true);
    this.error.set(null);
    try {
      await this.api.pedirPresupuesto({
        servicioIds: [...new Set(resultados.map((r) => r.servicioId))],
        solicitud,
        resumen: resumenSolicitudViaje(solicitud),
      });
      this.avisoPresupuesto.set(this.i18n.t('Solicitud enviada. Te avisaremos en cuanto respondan.'));
    } catch (error) {
      this.error.set(mensajeDeError(error, 'No se pudo enviar la solicitud de presupuesto.'));
    } finally {
      this.pidiendo.set(false);
    }
  }

  private async buscar(): Promise<void> {
    const solicitud = this.store.solicitud();
    if (!solicitud) return;
    this.cargando.set(true);
    this.error.set(null);
    try {
      this.respuesta.set(await this.api.buscar(solicitud, this.orden.value as OrdenTransporte));
    } catch (error) {
      this.respuesta.set(null);
      this.error.set(mensajeDeError(error, 'No hemos podido buscar transportes. Inténtalo de nuevo.'));
    } finally {
      this.cargando.set(false);
    }
  }
}
