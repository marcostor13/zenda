import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { firstValueFrom } from 'rxjs';
import { EstadoSolicitudSeguros, ESTADO_SOLICITUD_SEGUROS_LABELS } from 'shared';
import { RsIconComponent } from '../../shared/components/icon/rs-icon.component';
import { AdminApiService, SolicitudSeguros } from './admin-api.service';

/**
 * Alta de aseguradoras.
 *
 * Es el otro extremo del formulario de solicitud del comercio: aquí se lee lo
 * que la compañía ha declarado, se abren sus documentos y se decide. Tiene
 * pantalla propia y no una pestaña dentro de Comercios porque el cupo
 * (tres compañías) convierte cada aprobación en una decisión de negocio, no en
 * un trámite más de la cola de altas.
 */
@Component({
  selector: 'app-admin-seguros',
  standalone: true,
  imports: [RsIconComponent, DatePipe],
  template: `
    <div class="rs-page-header">
      <div>
        <h1 class="rs-page-title">Aseguradoras</h1>
        <p class="rs-page-sub">
          Solicitudes de alta con su documentación. Doogking trabaja con
          {{ maximo() }} compañías como máximo.
        </p>
      </div>
      <span class="cupo" [class.cupo--lleno]="plazasLibres() === 0">
        <rs-icon name="crown" [size]="14" [stroke]="2"></rs-icon>
        {{ aprobadas() }} de {{ maximo() }} plazas ocupadas
      </span>
    </div>

    @if (error()) {
      <div class="rs-alert rs-alert--error" role="alert">{{ error() }}</div>
    }

    @if (cargando()) {
      <p style="color:var(--t-400)">Cargando solicitudes…</p>
    } @else if (!solicitudes().length) {
      <div class="rs-card admin-panel">
        <p style="color:var(--t-400)">Todavía no hay ninguna solicitud de aseguradora.</p>
      </div>
    } @else {
      <div class="sols">
        @for (s of solicitudes(); track s.servicioId) {
          <article class="rs-card sol">
            <header class="sol__cab">
              <div>
                <h2 class="sol__tit">{{ s.solicitud?.aseguradora?.razonSocial || s.titulo }}</h2>
                <p class="sol__meta">
                  @if (s.solicitud?.aseguradora?.nifCif) { {{ s.solicitud?.aseguradora?.nifCif }} · }
                  @if (s.creadaEn) { Solicitada el {{ s.creadaEn | date:'d MMM y' }} }
                </p>
              </div>
              <span class="rs-badge" [class]="claseEstado(s.estadoSolicitud)">
                {{ etiquetaEstado(s.estadoSolicitud) }}
              </span>
            </header>

            <div class="sol__cols">
              <div>
                <h3 class="sol__sub">Contacto</h3>
                <dl class="sol__datos">
                  <div><dt>Persona</dt><dd>{{ s.solicitud?.contacto?.nombre || '—' }}</dd></div>
                  @if (s.solicitud?.contacto?.cargo) {
                    <div><dt>Cargo</dt><dd>{{ s.solicitud?.contacto?.cargo }}</dd></div>
                  }
                  <div>
                    <dt>Correo</dt>
                    <dd><a [href]="'mailto:' + s.solicitud?.contacto?.email">{{ s.solicitud?.contacto?.email || '—' }}</a></dd>
                  </div>
                  <div>
                    <dt>Teléfono</dt>
                    <dd><a [href]="'tel:' + s.solicitud?.contacto?.telefono">{{ s.solicitud?.contacto?.telefono || '—' }}</a></dd>
                  </div>
                </dl>
              </div>

              <div>
                <h3 class="sol__sub">Compañía</h3>
                <dl class="sol__datos">
                  <div><dt>Registro DGSFP</dt><dd>{{ s.solicitud?.aseguradora?.registroDgs || '—' }}</dd></div>
                  <div><dt>Ámbito</dt><dd>{{ s.solicitud?.aseguradora?.ambito || '—' }}</dd></div>
                  <div>
                    <dt>Web</dt>
                    <dd>
                      @if (s.solicitud?.aseguradora?.web) {
                        <a [href]="s.solicitud?.aseguradora?.web" target="_blank" rel="noopener">
                          {{ s.solicitud?.aseguradora?.web }}
                        </a>
                      } @else { — }
                    </dd>
                  </div>
                </dl>
              </div>
            </div>

            <h3 class="sol__sub">Documentación</h3>
            @if (s.solicitud?.documentos?.length) {
              <ul class="docs">
                @for (d of s.solicitud?.documentos ?? []; track d.url) {
                  <li>
                    <rs-icon name="file-text" [size]="15" [stroke]="2"></rs-icon>
                    <a [href]="d.url" target="_blank" rel="noopener">{{ d.nombre }}</a>
                  </li>
                }
              </ul>
            } @else {
              <p class="sol__vacio">La compañía no adjuntó documentos.</p>
            }

            @if (s.solicitud?.notas) {
              <h3 class="sol__sub">Notas de la compañía</h3>
              <p class="sol__notas">{{ s.solicitud?.notas }}</p>
            }

            @if (s.motivoRechazo) {
              <p class="sol__rechazo">
                <rs-icon name="alert-circle" [size]="14" [stroke]="2"></rs-icon>
                No aprobada: {{ s.motivoRechazo }}
              </p>
            }

            <footer class="sol__pie">
              @if (rechazando() === s.servicioId) {
                <!-- El motivo no es opcional: es lo que se le explica a la compañía. -->
                <input class="rs-inp" [value]="motivo()" placeholder="¿Por qué no se aprueba?"
                       (input)="motivo.set($any($event.target).value)" />
                <button class="rs-btn rs-btn--danger rs-btn--sm" [disabled]="!motivo().trim() || guardando()"
                        (click)="rechazar(s)">Confirmar</button>
                <button class="rs-btn rs-btn--ghost rs-btn--sm" (click)="rechazando.set(null)">Cancelar</button>
              } @else {
                @if (s.estadoSolicitud !== 'aprobada') {
                  <button class="rs-btn rs-btn--primary rs-btn--sm"
                          [disabled]="guardando() || (plazasLibres() === 0)"
                          (click)="aprobar(s)">
                    <rs-icon name="check" [size]="14" [stroke]="2.5"></rs-icon> Aprobar y publicar
                  </button>
                }
                @if (s.estadoSolicitud !== 'rechazada') {
                  <button class="rs-btn rs-btn--outline rs-btn--sm" [disabled]="guardando()"
                          (click)="rechazando.set(s.servicioId); motivo.set('')">
                    No aprobar
                  </button>
                }
                @if (s.estadoSolicitud !== 'aprobada' && plazasLibres() === 0) {
                  <span class="sol__cupo">
                    Sin plazas libres: da de baja a una aseguradora antes de aprobar otra.
                  </span>
                }
              }
            </footer>
          </article>
        }
      </div>
    }
  `,
  styles: [`
    .cupo {
      display: inline-flex; align-items: center; gap: var(--sp-2);
      padding: var(--sp-2) var(--sp-3);
      border-radius: var(--r-full);
      background: var(--c-accent-lo); color: var(--dk-blue);
      font-size: var(--f-sm); font-weight: var(--w-6);
    }
    .cupo--lleno { background: rgba(245,158,11,.14); color: #B45309; }

    .sols { display: flex; flex-direction: column; gap: var(--sp-4); }
    .sol { padding: var(--sp-5); display: flex; flex-direction: column; gap: var(--sp-3); }

    .sol__cab { display: flex; align-items: flex-start; justify-content: space-between; gap: var(--sp-3); }
    .sol__tit { font-size: var(--f-md); font-weight: var(--w-7); color: var(--t-100); }
    .sol__meta { font-size: var(--f-sm); color: var(--t-400); margin-top: 2px; }

    .sol__cols {
      display: grid; grid-template-columns: 1fr 1fr; gap: var(--sp-5);
      @media (max-width: 720px) { grid-template-columns: 1fr; }
    }

    .sol__sub {
      font-size: var(--f-xs); font-weight: var(--w-7); text-transform: uppercase;
      letter-spacing: .06em; color: var(--t-400);
    }

    .sol__datos {
      margin-top: var(--sp-2);
      display: flex; flex-direction: column; gap: var(--sp-2);
      font-size: var(--f-sm);

      div { display: flex; gap: var(--sp-2); }
      dt { color: var(--t-400); min-width: 110px; }
      dd { color: var(--t-100); word-break: break-word; }
      a { color: var(--dk-blue); text-decoration: none; }
      a:hover { text-decoration: underline; }
    }

    .docs {
      list-style: none; padding: 0; margin-top: var(--sp-2);
      display: flex; flex-direction: column; gap: var(--sp-2);

      li {
        display: flex; align-items: center; gap: var(--sp-2);
        padding: var(--sp-2) var(--sp-3);
        background: var(--c-raised); border: 1px solid var(--b-1); border-radius: var(--r-md);
        font-size: var(--f-sm);
      }
      a { color: var(--dk-blue); text-decoration: none; word-break: break-word; }
      a:hover { text-decoration: underline; }
    }

    .sol__vacio, .sol__notas { font-size: var(--f-sm); color: var(--t-400); line-height: 1.6; }
    .sol__rechazo {
      display: flex; align-items: center; gap: var(--sp-2);
      font-size: var(--f-sm); color: #B91C1C;
    }

    .sol__pie {
      display: flex; align-items: center; gap: var(--sp-2); flex-wrap: wrap;
      padding-top: var(--sp-3); border-top: 1px solid var(--b-1);

      .rs-inp { flex: 1; min-width: 220px; }
    }
    .sol__cupo { font-size: var(--f-xs); color: var(--t-400); }
  `],
})
export class AdminSegurosComponent implements OnInit {
  private readonly api = inject(AdminApiService);

  readonly solicitudes = signal<SolicitudSeguros[]>([]);
  readonly aprobadas = signal(0);
  readonly maximo = signal(3);
  readonly cargando = signal(true);
  readonly guardando = signal(false);
  readonly error = signal('');

  /** Solicitud cuyo rechazo se está escribiendo; sólo una a la vez. */
  readonly rechazando = signal<string | null>(null);
  readonly motivo = signal('');

  readonly plazasLibres = computed(() => Math.max(0, this.maximo() - this.aprobadas()));

  async ngOnInit(): Promise<void> {
    await this.cargar();
  }

  private async cargar(): Promise<void> {
    this.cargando.set(true);
    try {
      const datos = await firstValueFrom(this.api.solicitudesSeguros());
      this.solicitudes.set(datos.solicitudes);
      this.aprobadas.set(datos.aprobadas);
      this.maximo.set(datos.maximo);
    } catch {
      this.error.set('No pudimos cargar las solicitudes de aseguradoras.');
    } finally {
      this.cargando.set(false);
    }
  }

  async aprobar(s: SolicitudSeguros): Promise<void> {
    this.guardando.set(true);
    this.error.set('');
    try {
      await firstValueFrom(this.api.aprobarSolicitudSeguros(s.servicioId));
      await this.cargar();
    } catch {
      this.error.set('No se pudo aprobar la solicitud. Comprueba que quede alguna plaza libre.');
    } finally {
      this.guardando.set(false);
    }
  }

  async rechazar(s: SolicitudSeguros): Promise<void> {
    this.guardando.set(true);
    this.error.set('');
    try {
      await firstValueFrom(this.api.rechazarSolicitudSeguros(s.servicioId, this.motivo().trim()));
      this.rechazando.set(null);
      this.motivo.set('');
      await this.cargar();
    } catch {
      this.error.set('No se pudo registrar el rechazo.');
    } finally {
      this.guardando.set(false);
    }
  }

  etiquetaEstado(estado: string): string {
    return ESTADO_SOLICITUD_SEGUROS_LABELS[estado as EstadoSolicitudSeguros] ?? estado;
  }

  claseEstado(estado: string): string {
    if (estado === EstadoSolicitudSeguros.APROBADA) return 'rs-badge--success';
    if (estado === EstadoSolicitudSeguros.RECHAZADA) return 'rs-badge--error';
    return 'rs-badge--warning';
  }
}
