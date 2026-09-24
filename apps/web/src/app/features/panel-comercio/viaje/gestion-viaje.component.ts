import {
  ChangeDetectionStrategy, Component, DestroyRef, computed, inject, input, output, signal,
} from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import {
  ConfirmacionEntrega, HITO_VIAJE_LABELS, HITOS_VIAJE_ORDEN, HitoViaje, PERSONA_CONTACTO_VIAJE_LABELS,
  PersonaContactoViaje, normalizarHitoViaje,
} from 'shared';
import { RsIconComponent } from '../../../shared/components/icon/rs-icon.component';
import { TraducirPipe } from '../../../core/i18n/traducir.pipe';
import { FechaPipe } from '../../../shared/pipes/fecha.pipe';
import { mensajeDeError } from '../../../shared/mensaje-error';
import { esNavegador } from '../../../core/plataforma/almacen';
import { environment } from '../../../../environments/environment';
import { ComercioApiService, MiReserva } from '../comercio-api.service';

interface ContactoEntrega {
  quien?: PersonaContactoViaje;
  nombre?: string;
  telefono?: string;
  complementoDireccion?: string;
  indicaciones?: string;
}

const ICONO_HITO: Record<HitoViaje, string> = {
  [HitoViaje.ASIGNADO]: 'user',
  [HitoViaje.DE_CAMINO]: 'navigation',
  [HitoViaje.RECOGIDA]: 'paw',
  [HitoViaje.EN_TRAYECTO]: 'truck',
  [HitoViaje.ENTREGADA]: 'map-pin',
  [HitoViaje.FINALIZADA]: 'check-circle',
};

/** Como mucho una posición cada tanto: suficiente para el mapa y amable con la batería. */
const SEGUNDOS_ENTRE_POSICIONES = 15;

/**
 * Gestión de un viaje desde el panel del transportista.
 *
 * - Acepta o rechaza los viajes sin hora cerrada (el cliente ya pagó; si se
 *   rechaza o vence el plazo, se le devuelve el dinero).
 * - Enseña quién entrega y quién recibe, con su teléfono: es lo que necesita el
 *   conductor en la puerta.
 * - Marca los pasos del viaje, con foto de la entrega si el cliente la pidió.
 * - Comparte la ubicación del vehículo mientras la pantalla está abierta.
 */
@Component({
  selector: 'app-gestion-viaje',
  standalone: true,
  imports: [RsIconComponent, TraducirPipe, FechaPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
<div class="gv">
  @if (pendienteDeAceptar()) {
    <div class="gv__aceptar">
      <p class="gv__aviso">
        <rs-icon name="hourglass" [size]="16" [stroke]="2"></rs-icon>
        {{ 'El cliente ya ha pagado. Acepta el viaje antes de las {hora} o se le devolverá el dinero.' | t: { hora: (reserva().aceptacion?.venceEn | date: 'HH:mm') ?? '' } }}
      </p>
      <label class="rs-field">
        <span class="rs-lbl">{{ 'Hora de recogida que confirmas' | t }}</span>
        <input class="rs-inp" type="time" [value]="horaConfirmada()" (input)="horaConfirmada.set($any($event.target).value)" />
      </label>
      <label class="rs-field">
        <span class="rs-lbl">{{ 'Motivo si lo rechazas (opcional)' | t }}</span>
        <input class="rs-inp" [value]="motivo()" (input)="motivo.set($any($event.target).value)" maxlength="500" />
      </label>
      <div class="gv__acciones">
        <button type="button" class="rs-btn rs-btn--danger rs-btn--sm" [disabled]="ocupado()" (click)="resolver('rechazar')">{{ 'Rechazar y devolver' | t }}</button>
        <button type="button" class="rs-btn rs-btn--primary rs-btn--sm" [disabled]="ocupado()" (click)="resolver('aceptar')">{{ 'Aceptar viaje' | t }}</button>
      </div>
    </div>
  }

  @if (resumen().length) {
    <dl class="gv__resumen">
      @for (fila of resumen(); track fila[0]) { <div><dt>{{ fila[0] | t }}</dt><dd>{{ fila[1] }}</dd></div> }
    </dl>
  }

  @if (recogida() || entrega()) {
    <div class="gv__contactos">
      @for (c of contactos(); track c.titulo) {
        <div class="gv__contacto">
          <p class="rs-label-caps">{{ c.titulo | t }}</p>
          <strong>{{ c.datos.nombre || (etiquetaQuien(c.datos.quien) | t) }}</strong>
          @if (c.datos.telefono) { <a [href]="'tel:' + c.datos.telefono">{{ c.datos.telefono }}</a> }
          @if (c.datos.complementoDireccion) { <span>{{ c.datos.complementoDireccion }}</span> }
          @if (c.datos.indicaciones) { <span>{{ c.datos.indicaciones }}</span> }
        </div>
      }
    </div>
  }

  @if (!pendienteDeAceptar() && enServicio()) {
    <div class="gv__hitos">
      @for (h of hitos; track h) {
        <button type="button" class="rs-btn rs-btn--sm"
                [class.rs-btn--primary]="h === siguienteHito()" [class.rs-btn--ghost]="h !== siguienteHito()"
                [class.gv__hito--hecho]="marcados().has(h)"
                [disabled]="ocupado() || marcados().has(h)" (click)="marcar(h)">
          <rs-icon [name]="marcados().has(h) ? 'check' : iconoHito(h)" [size]="13" [stroke]="2.2"></rs-icon> {{ etiquetaHito(h) | t }}
        </button>
      }
    </div>

    @if (pideFoto()) {
      <label class="gv__foto">
        <rs-icon name="camera" [size]="16" [stroke]="2"></rs-icon>
        <span>{{ (fotoUrl() ? 'Foto lista para la entrega' : 'El cliente pidió foto de la entrega: hazla antes de marcarla') | t }}</span>
        <input type="file" accept="image/*" capture="environment" (change)="subirFoto($event)" />
      </label>
    }

    @if (admiteUbicacion()) {
      <button type="button" class="rs-btn rs-btn--sm" [class.rs-btn--outline]="!compartiendo()" [class.rs-btn--gold]="compartiendo()"
              (click)="alternarUbicacion()">
        <rs-icon name="navigation" [size]="14" [stroke]="2"></rs-icon>
        {{ (compartiendo() ? 'Dejar de compartir ubicación' : 'Compartir mi ubicación con el cliente') | t }}
      </button>
      @if (compartiendo()) { <p class="gv__nota">{{ 'Mantén esta pantalla abierta durante el viaje para que el cliente te vea en el mapa.' | t }}</p> }
    }
  }

  @if (error(); as e) { <p class="rs-field-err">{{ e | t }}</p> }
</div>
  `,
  styles: [`
    :host { display: block; width: 100%; }
    .gv { display: flex; flex-direction: column; gap: var(--sp-3); }
    .gv__aceptar { display: flex; flex-direction: column; gap: var(--sp-3); padding: var(--sp-3) var(--sp-4);
      border: 1px solid var(--dk-gold); border-radius: var(--r-lg); background: linear-gradient(0deg, var(--c-card), var(--c-card)), var(--dk-gold-lo); }
    .gv__aviso { display: flex; gap: var(--sp-2); margin: 0; font-size: var(--f-sm); color: var(--t-200); font-weight: var(--w-6); }
    .gv__acciones { display: flex; justify-content: flex-end; gap: var(--sp-2); flex-wrap: wrap; }
    .gv__resumen { display: flex; flex-direction: column; gap: var(--sp-1); margin: 0; font-size: var(--f-xs);
      div { display: grid; grid-template-columns: minmax(96px, 30%) 1fr; gap: var(--sp-2); }
      dt { color: var(--t-400); } dd { margin: 0; color: var(--t-200); overflow-wrap: anywhere; }
    }
    .gv__contactos { display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: var(--sp-2); }
    .gv__contacto { display: flex; flex-direction: column; gap: 2px; padding: var(--sp-3); border-radius: var(--r-lg); background: var(--c-surface);
      p { margin: 0; } strong { color: var(--t-100); font-size: var(--f-sm); }
      a { color: var(--c-accent); font-weight: var(--w-6); font-size: var(--f-sm); }
      span { font-size: var(--f-xs); color: var(--t-300); }
    }
    .gv__hitos { display: flex; flex-wrap: wrap; gap: var(--sp-2); }
    .gv__hito--hecho { opacity: .6; }
    .gv__foto { position: relative; display: flex; align-items: center; gap: var(--sp-2); padding: var(--sp-2) var(--sp-3);
      border: 1px dashed var(--b-a); border-radius: var(--r-lg); font-size: var(--f-sm); color: var(--t-200); cursor: pointer;
      input { position: absolute; inset: 0; opacity: 0; cursor: pointer; }
    }
    .gv__nota { margin: 0; font-size: var(--f-xs); color: var(--t-400); }
  `],
})
export class GestionViajeComponent {
  private readonly api = inject(ComercioApiService);
  private readonly http = inject(HttpClient);

  readonly reserva = input.required<MiReserva>();
  readonly actualizada = output<MiReserva>();

  readonly hitos = HITOS_VIAJE_ORDEN;
  readonly ocupado = signal(false);
  readonly error = signal<string | null>(null);
  readonly horaConfirmada = signal('');
  readonly motivo = signal('');
  readonly fotoUrl = signal<string | null>(null);
  readonly compartiendo = signal(false);

  private vigilancia: number | null = null;
  private ultimoEnvio = 0;

  readonly pendienteDeAceptar = computed(() => this.reserva().aceptacion?.estado === 'pendiente');
  readonly enServicio = computed(() => ['confirmada', 'en_curso'].includes(this.reserva().estado));
  readonly marcados = computed(() => new Set((this.reserva().seguimiento ?? []).map((h) => normalizarHitoViaje(h.hito))));
  readonly siguienteHito = computed(() => HITOS_VIAJE_ORDEN.find((h) => !this.marcados().has(h)) ?? null);
  readonly admiteUbicacion = computed(() => !this.marcados().has(HitoViaje.ENTREGADA) && !this.marcados().has(HitoViaje.FINALIZADA));

  readonly resumen = computed(() => {
    const filas = this.reserva().detalle?.['resumen'];
    return Array.isArray(filas) ? (filas as Array<[string, string]>) : [];
  });
  private readonly datosEntrega = computed(() =>
    this.reserva().detalle?.['entrega'] as { recogida?: ContactoEntrega; entrega?: ContactoEntrega; confirmacionEntrega?: string } | undefined);
  readonly recogida = computed(() => this.datosEntrega()?.recogida ?? null);
  readonly entrega = computed(() => this.datosEntrega()?.entrega ?? null);
  readonly contactos = computed(() => {
    const lista: Array<{ titulo: string; datos: ContactoEntrega }> = [];
    const recogida = this.recogida();
    const entrega = this.entrega();
    if (recogida) lista.push({ titulo: 'Entrega la mascota', datos: recogida });
    if (entrega) lista.push({ titulo: 'Recibe la mascota', datos: entrega });
    return lista;
  });
  readonly pideFoto = computed(() =>
    this.datosEntrega()?.confirmacionEntrega === ConfirmacionEntrega.NOTIFICACION_FOTO && !this.marcados().has(HitoViaje.ENTREGADA));

  constructor() {
    inject(DestroyRef).onDestroy(() => this.pararUbicacion());
  }

  iconoHito(hito: HitoViaje): string {
    return ICONO_HITO[hito];
  }

  etiquetaHito(hito: HitoViaje): string {
    return HITO_VIAJE_LABELS[hito];
  }

  etiquetaQuien(quien?: PersonaContactoViaje): string {
    return quien ? PERSONA_CONTACTO_VIAJE_LABELS[quien] : '';
  }

  async resolver(decision: 'aceptar' | 'rechazar'): Promise<void> {
    await this.ejecutar(() => firstValueFrom(this.api.resolverAceptacion(this.reserva()._id, {
      decision,
      horaConfirmada: decision === 'aceptar' ? this.horaConfirmada() || undefined : undefined,
      motivo: decision === 'rechazar' ? this.motivo() || undefined : undefined,
    })), decision === 'aceptar' ? 'No se pudo aceptar el viaje.' : 'No se pudo rechazar el viaje.');
  }

  async marcar(hito: HitoViaje): Promise<void> {
    const foto = hito === HitoViaje.ENTREGADA ? this.fotoUrl() ?? undefined : undefined;
    const guardado = await this.ejecutar(() => firstValueFrom(this.api.marcarSeguimiento(this.reserva()._id, hito, undefined, foto)),
      'No se pudo registrar este paso del viaje.');
    // Sólo con la entrega guardada: si falló, el cliente todavía necesita ver el vehículo.
    if (guardado && (hito === HitoViaje.ENTREGADA || hito === HitoViaje.FINALIZADA)) this.pararUbicacion();
  }

  async subirFoto(evento: Event): Promise<void> {
    const archivo = (evento.target as HTMLInputElement).files?.[0];
    if (!archivo) return;
    const datos = new FormData();
    datos.append('file', archivo);
    this.ocupado.set(true);
    try {
      const { url } = await firstValueFrom(this.http.post<{ url: string }>(`${environment.apiUrl}/upload/image`, datos));
      this.fotoUrl.set(url);
    } catch (error) {
      this.error.set(mensajeDeError(error, 'No se pudo subir la foto. Inténtalo de nuevo.'));
    } finally {
      this.ocupado.set(false);
    }
  }

  alternarUbicacion(): void {
    if (this.compartiendo()) {
      this.pararUbicacion();
      return;
    }
    if (!esNavegador() || !navigator.geolocation) {
      this.error.set('Este dispositivo no permite compartir la ubicación.');
      return;
    }
    this.compartiendo.set(true);
    this.vigilancia = navigator.geolocation.watchPosition(
      (posicion) => this.enviar(posicion),
      () => {
        this.error.set('No tenemos permiso para usar tu ubicación. Actívalo en el navegador o en los ajustes del móvil.');
        this.pararUbicacion();
      },
      { enableHighAccuracy: true, maximumAge: 10_000, timeout: 30_000 },
    );
  }

  private enviar(posicion: GeolocationPosition): void {
    const ahora = Date.now();
    if (ahora - this.ultimoEnvio < SEGUNDOS_ENTRE_POSICIONES * 1000) return;
    this.ultimoEnvio = ahora;
    const { latitude, longitude, accuracy, heading } = posicion.coords;
    this.api.enviarPosicion(this.reserva()._id, {
      lat: latitude,
      lng: longitude,
      precision: Number.isFinite(accuracy) ? accuracy : undefined,
      rumbo: heading !== null && Number.isFinite(heading) ? heading : undefined,
    }).subscribe({ error: () => this.pararUbicacion() });
  }

  private pararUbicacion(): void {
    if (this.vigilancia !== null && esNavegador()) navigator.geolocation.clearWatch(this.vigilancia);
    this.vigilancia = null;
    this.compartiendo.set(false);
  }

  /** Devuelve si la acción salió bien. */
  private async ejecutar(accion: () => Promise<MiReserva>, mensaje: string): Promise<boolean> {
    this.ocupado.set(true);
    this.error.set(null);
    try {
      this.actualizada.emit(await accion());
      return true;
    } catch (error) {
      this.error.set(mensajeDeError(error, mensaje));
      return false;
    } finally {
      this.ocupado.set(false);
    }
  }
}
