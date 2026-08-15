import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { PasoEmbudo, TipoEvento } from 'shared';
import { environment } from '../../../environments/environment';

const CLAVE_SESION = 'doogking_sesion';
const CLAVE_INICIO = 'doogking_embudo_inicio';

/** Tras dos horas, el embudo se considera otro distinto. */
const VIDA_EMBUDO_MS = 2 * 60 * 60 * 1000;

interface EventoPayload {
  tipo: TipoEvento;
  sesionId: string;
  reservaId?: string;
  servicioId?: string;
  vertical?: string;
  paso?: PasoEmbudo;
  msDesdeInicio?: number;
  payload?: Record<string, unknown>;
}

/**
 * Instrumentación del embudo (DK-M09 / T4).
 *
 * Mide cuánto tarda de verdad una reserva, porque la meta de "menos de 30
 * segundos" no es verificable a ojo. Es telemetría: **nunca bloquea ni rompe
 * el flujo**, y si el envío falla se pierde una traza, no una venta.
 */
@Injectable({ providedIn: 'root' })
export class EventosService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiUrl}/eventos`;

  /**
   * Arranca el cronómetro del embudo (sólo si el anterior ya caducó) y anota la
   * búsqueda. El evento se registra **siempre**: el embudo del panel necesita
   * cuántas búsquedas hubo de verdad (TCK-8031), no cuántas sesiones empezaron.
   */
  iniciarEmbudo(vertical?: string): void {
    const inicio = this.leerInicio();
    if (!inicio || Date.now() - inicio >= VIDA_EMBUDO_MS) {
      sessionStorage.setItem(CLAVE_INICIO, String(Date.now()));
    }
    this.registrar(TipoEvento.BUSQUEDA_INICIADA, { vertical, paso: PasoEmbudo.BUSQUEDA });
  }

  /** Visita a la ficha de un servicio: el paso que faltaba entre buscar y reservar. */
  registrarVistaServicio(servicioId: string, vertical?: string): void {
    this.registrar(TipoEvento.SERVICIO_ABIERTO, { servicioId, vertical, paso: PasoEmbudo.DETALLE });
  }

  registrar(
    tipo: TipoEvento,
    datos: Omit<EventoPayload, 'tipo' | 'sesionId' | 'msDesdeInicio'> = {},
  ): void {
    const cuerpo: EventoPayload = {
      tipo,
      sesionId: this.sesionId(),
      msDesdeInicio: this.msDesdeInicio(),
      ...datos,
    };

    // Sin `await` y con el error tragado: la medición no puede frenar la reserva.
    this.http.post(this.base, cuerpo).subscribe({ error: () => undefined });
  }

  /** Cierra el embudo: la próxima reserva empieza a contar de cero. */
  cerrarEmbudo(reservaId?: string, vertical?: string): void {
    this.registrar(TipoEvento.RESERVA_CONFIRMADA, {
      reservaId, vertical, paso: PasoEmbudo.CONFIRMACION,
    });
    sessionStorage.removeItem(CLAVE_INICIO);
  }

  private msDesdeInicio(): number | undefined {
    const inicio = this.leerInicio();
    return inicio ? Date.now() - inicio : undefined;
  }

  private leerInicio(): number | null {
    const guardado = Number(sessionStorage.getItem(CLAVE_INICIO));
    return Number.isFinite(guardado) && guardado > 0 ? guardado : null;
  }

  /**
   * Identifica al visitante **sin sesión iniciada**, que es justo donde se
   * producen los abandonos más tempranos. No contiene datos personales.
   */
  private sesionId(): string {
    const guardado = localStorage.getItem(CLAVE_SESION);
    if (guardado) return guardado;

    const nuevo = `s-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
    localStorage.setItem(CLAVE_SESION, nuevo);
    return nuevo;
  }
}
