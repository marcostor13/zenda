import { Injectable, computed, effect, signal } from '@angular/core';
import {
  ConfirmacionEntrega, EspecieMascota, FranjaTransporte, MascotaViaje, ModalidadTransporte, ModoHorarioTransporte,
  NECESIDAD_OTRA, NecesidadTransporte, OrdenTransporte, PatronRecurrenciaTransporte, PersonaContactoViaje, PuntoViaje,
  SolicitudViaje, TamanoPerro, VueltaTransporte, diasDelPatron, hoyEnZona,
} from 'shared';
import { almacenSesion } from '../../../core/plataforma/almacen';

/** Mascota elegida en la pantalla 2: guardada (con `perroId`) o descrita a mano. */
export interface MascotaElegida extends MascotaViaje {
  readonly foto?: string;
  readonly raza?: string;
}

export interface ContactoViajeBorrador {
  quien: PersonaContactoViaje;
  nombre: string;
  telefono: string;
  complementoDireccion: string;
  indicaciones: string;
}

/** La empresa que el cliente ha elegido en resultados o en la ficha. */
export interface EleccionTransporte {
  servicioId: string;
  comercioId: string;
  titulo: string;
  modalidad: ModalidadTransporte;
  total: number;
}

/**
 * Todo lo que el cliente va rellenando, de la pantalla 1 al pago. Es el
 * borrador del viaje: plano y serializable, para poder guardarlo tal cual.
 */
export interface BorradorViaje {
  tipoServicio: NecesidadTransporte;
  origen: PuntoViaje | null;
  destino: PuntoViaje | null;
  fecha: string;
  modoHorario: ModoHorarioTransporte;
  hora: string;
  franja: FranjaTransporte;
  vueltaModo: VueltaTransporte;
  vueltaHora: string;
  vueltaHoras: number;
  vueltaFecha: string;
  patron: PatronRecurrenciaTransporte;
  diasSemana: number[];
  hasta: string;
  mascotas: MascotaElegida[];
  /** Sin sesión o sin mascotas guardadas: cómo son y cuántas. */
  especieManual: EspecieMascota;
  tamanoManual: TamanoPerro;
  numeroManual: number;
  /** Valores de `NECESIDADES_MASCOTA` y `otra`. */
  necesidades: string[];
  necesidadOtra: string;
  comportamiento: string;
  notaTransportista: string;
  modalidad: ModalidadTransporte;
  personas: number;
  /** Valor de `EQUIPAJE_TRANSPORTE`. */
  equipaje: string;
  /** Valores de `PREFERENCIAS_VIAJE`. */
  preferencias: string[];
  orden: OrdenTransporte;
  filtroModalidad: ModalidadTransporte | 'todas';
  filtroIncluidos: string[];
  recogida: ContactoViajeBorrador;
  entrega: ContactoViajeBorrador;
  confirmacionEntrega: ConfirmacionEntrega;
  eleccion: EleccionTransporte | null;
  presupuestoId: string | null;
}

const CLAVE = 'doogking_viaje_transporte';

/** Un punto sirve si el servidor puede situarlo: por su `placeId` o por sus coordenadas. */
export function puntoValido(punto: PuntoViaje | null | undefined): boolean {
  if (!punto) return false;
  return !!punto.placeId || (Number.isFinite(punto.lat) && Number.isFinite(punto.lng));
}

/** Versión del borrador: si cambia la forma, se descarta el guardado viejo en vez de romper. */
const VERSION = 2;

const contactoVacio = (): ContactoViajeBorrador => ({
  quien: PersonaContactoViaje.YO, nombre: '', telefono: '', complementoDireccion: '', indicaciones: '',
});

export function borradorInicial(): BorradorViaje {
  return {
    tipoServicio: NecesidadTransporte.SOLO_IDA,
    origen: null,
    destino: null,
    fecha: '',
    modoHorario: ModoHorarioTransporte.HORA_CONCRETA,
    hora: '10:00',
    franja: FranjaTransporte.MANANA,
    vueltaModo: VueltaTransporte.HORA,
    vueltaHora: '18:00',
    vueltaHoras: 2,
    vueltaFecha: '',
    patron: PatronRecurrenciaTransporte.LABORABLES,
    diasSemana: [1, 3],
    hasta: '',
    mascotas: [],
    especieManual: EspecieMascota.PERRO,
    tamanoManual: TamanoPerro.MEDIANO,
    numeroManual: 1,
    necesidades: [],
    necesidadOtra: '',
    comportamiento: '',
    notaTransportista: '',
    modalidad: ModalidadTransporte.COMPARTIDO,
    personas: 1,
    equipaje: 'sin_equipaje',
    preferencias: [],
    orden: OrdenTransporte.RECOMENDADOS,
    filtroModalidad: 'todas',
    filtroIncluidos: [],
    recogida: contactoVacio(),
    entrega: contactoVacio(),
    confirmacionEntrega: ConfirmacionEntrega.NOTIFICACION,
    eleccion: null,
    presupuestoId: null,
  };
}

/**
 * Estado del flujo de Transporte, compartido por todas sus pantallas.
 *
 * Se guarda en `sessionStorage` a cada cambio: volver atrás, pulsar
 * «Modificar búsqueda», recargar o pasar por el login a mitad no borra nada
 * (regla 12 del flujo: «mantener los datos introducidos al volver atrás»). Va
 * en la sesión y no en `localStorage` porque es un viaje de hoy, no una
 * preferencia; y cualquier fallo al leer o escribir cae al borrador vacío.
 */
@Injectable({ providedIn: 'root' })
export class TransporteViajeStore {
  private readonly estado = signal<BorradorViaje>(this.cargar());

  readonly borrador = this.estado.asReadonly();

  /** Mascotas del viaje: las elegidas o, sin ninguna, las descritas a mano. */
  readonly mascotasDelViaje = computed<MascotaViaje[]>(() => {
    const b = this.estado();
    if (b.mascotas.length) {
      return b.mascotas.map(({ perroId, nombre, especie, tamano }) => ({ perroId, nombre, especie, tamano }));
    }
    return Array.from({ length: Math.max(1, b.numeroManual) }, () => ({ especie: b.especieManual, tamano: b.tamanoManual }));
  });

  /** La pantalla 1 está completa: hay por dónde y cuándo. */
  readonly rutaCompleta = computed(() => {
    const b = this.estado();
    return puntoValido(b.origen) && puntoValido(b.destino) && !!b.fecha && this.horarioCompleto(b);
  });

  /** La solicitud tal como la espera el API; `null` mientras falte algo de la pantalla 1. */
  readonly solicitud = computed<SolicitudViaje | null>(() => {
    const b = this.estado();
    if (!this.rutaCompleta() || !b.origen || !b.destino) return null;
    return {
      tipoServicio: b.tipoServicio,
      origen: b.origen,
      destino: b.destino,
      fecha: b.fecha,
      modoHorario: b.modoHorario,
      hora: b.modoHorario === ModoHorarioTransporte.HORA_CONCRETA ? b.hora : undefined,
      franja: b.modoHorario === ModoHorarioTransporte.FLEXIBLE ? b.franja : undefined,
      vuelta: this.vueltaDe(b),
      recurrencia: this.recurrenciaDe(b),
      mascotas: this.mascotasDelViaje(),
      necesidades: b.necesidades,
      necesidadOtra: b.necesidades.includes(NECESIDAD_OTRA) ? b.necesidadOtra || undefined : undefined,
      comportamiento: b.comportamiento || undefined,
      notaTransportista: b.notaTransportista || undefined,
      modalidad: b.modalidad,
      personas: b.modalidad === ModalidadTransporte.CON_PROPIETARIO ? b.personas : undefined,
      equipaje: b.modalidad === ModalidadTransporte.CON_PROPIETARIO ? b.equipaje : undefined,
      preferencias: b.preferencias,
    };
  });

  constructor() {
    effect(() => this.guardar(this.estado()));
  }

  actualizar(cambios: Partial<BorradorViaje>): void {
    this.estado.update((b) => ({ ...b, ...cambios }));
  }

  /** Aplica los atajos de cada tipo de servicio sin pisar lo que el cliente ya eligió a mano. */
  elegirTipo(tipo: NecesidadTransporte): void {
    const cambios: Partial<BorradorViaje> = { tipoServicio: tipo };
    if (tipo === NecesidadTransporte.URGENTE) {
      cambios.modoHorario = ModoHorarioTransporte.LO_ANTES_POSIBLE;
      cambios.fecha = hoyEnZona();
    }
    if (tipo === NecesidadTransporte.VIAJO_CON_MI_MASCOTA) cambios.modalidad = ModalidadTransporte.CON_PROPIETARIO;
    if (tipo !== NecesidadTransporte.VIAJO_CON_MI_MASCOTA && this.estado().modalidad === ModalidadTransporte.CON_PROPIETARIO) {
      cambios.modalidad = ModalidadTransporte.COMPARTIDO;
    }
    this.actualizar(cambios);
  }

  intercambiarPuntos(): void {
    this.estado.update((b) => ({ ...b, origen: b.destino, destino: b.origen }));
  }

  elegir(eleccion: EleccionTransporte): void {
    this.actualizar({ eleccion, modalidad: eleccion.modalidad, presupuestoId: null });
  }

  /**
   * Rehace el borrador a partir de una solicitud ya enviada (un presupuesto
   * aceptado desde «Mis presupuestos»): el cliente no vuelve a rellenar nada.
   */
  cargarSolicitud(s: SolicitudViaje, presupuestoId: string, eleccion: EleccionTransporte): void {
    const base = borradorInicial();
    this.estado.set({
      ...base,
      tipoServicio: s.tipoServicio,
      origen: s.origen,
      destino: s.destino,
      fecha: s.fecha,
      modoHorario: s.modoHorario,
      hora: s.hora ?? base.hora,
      franja: s.franja ?? base.franja,
      vueltaModo: s.vuelta?.modo ?? base.vueltaModo,
      vueltaHora: s.vuelta?.hora ?? base.vueltaHora,
      vueltaHoras: s.vuelta?.horas ?? base.vueltaHoras,
      vueltaFecha: s.vuelta?.fecha ?? base.vueltaFecha,
      patron: s.recurrencia?.patron ?? base.patron,
      diasSemana: s.recurrencia?.diasSemana ?? base.diasSemana,
      hasta: s.recurrencia?.hasta ?? base.hasta,
      mascotas: s.mascotas.map((m) => ({ ...m })),
      numeroManual: s.mascotas.length,
      necesidades: s.necesidades,
      necesidadOtra: s.necesidadOtra ?? '',
      comportamiento: s.comportamiento ?? '',
      notaTransportista: s.notaTransportista ?? '',
      modalidad: s.modalidad,
      personas: s.personas ?? 1,
      equipaje: s.equipaje ?? base.equipaje,
      preferencias: s.preferencias,
      eleccion,
      presupuestoId,
    });
  }

  /** Tras pagar: el viaje queda en «Mis reservas» y el borrador ya no sirve. */
  reiniciar(): void {
    this.estado.set(borradorInicial());
  }

  private horarioCompleto(b: BorradorViaje): boolean {
    if (b.modoHorario === ModoHorarioTransporte.HORA_CONCRETA && !b.hora) return false;
    if (b.tipoServicio === NecesidadTransporte.RECURRENTE && !b.hasta) return false;
    if (b.tipoServicio === NecesidadTransporte.IDA_VUELTA && b.vueltaModo === VueltaTransporte.OTRO_DIA && !b.vueltaFecha) {
      return false;
    }
    return true;
  }

  private vueltaDe(b: BorradorViaje): SolicitudViaje['vuelta'] {
    if (b.tipoServicio !== NecesidadTransporte.IDA_VUELTA) return undefined;
    switch (b.vueltaModo) {
      case VueltaTransporte.HORA: return { modo: b.vueltaModo, hora: b.vueltaHora };
      case VueltaTransporte.TRAS_HORAS: return { modo: b.vueltaModo, horas: b.vueltaHoras };
      case VueltaTransporte.OTRO_DIA: return { modo: b.vueltaModo, fecha: b.vueltaFecha, hora: b.vueltaHora };
      default: return { modo: b.vueltaModo };
    }
  }

  private recurrenciaDe(b: BorradorViaje): SolicitudViaje['recurrencia'] {
    if (b.tipoServicio !== NecesidadTransporte.RECURRENTE || !b.hasta) return undefined;
    return {
      patron: b.patron,
      diasSemana: diasDelPatron(b.patron, b.diasSemana),
      hora: b.modoHorario === ModoHorarioTransporte.HORA_CONCRETA ? b.hora : '09:00',
      hasta: b.hasta,
    };
  }

  private cargar(): BorradorViaje {
    try {
      const guardado = almacenSesion().getItem(CLAVE);
      if (!guardado) return borradorInicial();
      const { version, borrador } = JSON.parse(guardado) as { version: number; borrador: Partial<BorradorViaje> };
      return version === VERSION ? { ...borradorInicial(), ...borrador } : borradorInicial();
    } catch {
      return borradorInicial();
    }
  }

  private guardar(borrador: BorradorViaje): void {
    try {
      almacenSesion().setItem(CLAVE, JSON.stringify({ version: VERSION, borrador }));
    } catch {
      // Navegación privada o almacenamiento lleno: el flujo sigue, sólo que sin
      // sobrevivir a una recarga.
    }
  }
}
