import { Injectable } from '@nestjs/common';
import {
  BusquedaTransportesRespuesta, ConfigTransporte, ContextoViaje, CotizacionViaje, ModalidadTransporte,
  OrdenTransporte, PuntoViaje, ResultadoTransporte, SolicitudViaje, cotizarViaje, cubreViaje, horasHasta,
  incluidosDe, instanteDeRecogida, modalidadesDe, resumenCancelacionDe, viajesDeLaSolicitud,
} from 'shared';
import { DireccionLugar, GeoService, Trayecto } from '../../core/geo/geo.service';
import { DomainException } from '../../shared/exceptions/domain.exception';
import { TransporteCotizable, TransporteRepository } from './transporte.repository';
import { configDeServicio } from './transporte-config';

/** La ruta del viaje tal como la calcula el servidor. */
export interface RutaViaje {
  trayecto: Trayecto;
  origen: DireccionLugar | null;
  destino: DireccionLugar | null;
}

const RADIO_TIERRA_KM = 6371;
/** La carretera nunca es una línea recta: mismo factor que usa `GeoService` sin proveedor de rutas. */
const FACTOR_SINUOSIDAD = 1.3;

/**
 * Compara transportistas para un viaje descrito por el cliente.
 *
 * El precio de cada uno lo pone el motor de tarifas con la configuración de su
 * alta (`cotizarViaje` → `calcularPrecioTransporte`); aquí se calcula la ruta
 * **en el servidor** a partir de lo que eligió el cliente, se descartan las
 * empresas que no cubren el viaje y se ordena. La reserva vuelve a pasar por
 * aquí (`cotizarReserva`), así que el precio de los resultados y el cobrado
 * salen de la misma ruta y de la misma función.
 */
@Injectable()
export class TransporteCotizadorService {
  constructor(
    private readonly repo: TransporteRepository,
    private readonly geo: GeoService,
  ) {}

  async buscar(solicitud: SolicitudViaje, orden = OrdenTransporte.RECOMENDADOS): Promise<BusquedaTransportesRespuesta> {
    const ruta = await this.rutaDe(solicitud);
    if (!ruta) return this.sinRuta();

    const empresas = await this.repo.reservables();
    const resultados = empresas.flatMap((empresa) => this.resultadosDe(empresa, solicitud, ruta));

    return {
      ruta: this.rutaPublica(ruta),
      viajes: viajesDeLaSolicitud(solicitud),
      resultados: ordenar(resultados, orden),
      motivo: resultados.length ? undefined : 'Ningún transportista cubre ese viaje todavía.',
    };
  }

  /** Cotización de una sola empresa, para la ficha: todas las modalidades que ofrece. */
  async cotizarEmpresa(servicioId: string, solicitud: SolicitudViaje): Promise<BusquedaTransportesRespuesta> {
    const empresa = await this.repo.porId(servicioId);
    if (!empresa || empresa.estado !== 'publicado' || !empresa.comercioActivo) {
      throw new DomainException('Este transportista ya no acepta reservas', 404);
    }

    const ruta = await this.rutaDe(solicitud);
    if (!ruta) return this.sinRuta();

    const resultados = this.resultadosDe(empresa, solicitud, ruta);
    return {
      ruta: this.rutaPublica(ruta),
      viajes: viajesDeLaSolicitud(solicitud),
      resultados,
      motivo: resultados.length ? undefined : 'Este transportista no cubre ese viaje.',
    };
  }

  /**
   * Precio de una reserva: lo usa la estrategia de disponibilidad al crearla.
   * Misma ruta, misma configuración y misma función que en resultados.
   */
  async cotizarReserva(
    empresa: TransporteCotizable,
    solicitud: SolicitudViaje,
  ): Promise<{ cotizacion: CotizacionViaje; ruta: RutaViaje | null }> {
    const ruta = await this.rutaDe(solicitud);
    if (!ruta) {
      return {
        ruta: null,
        cotizacion: {
          estado: 'no_disponible',
          motivo: 'No hemos podido calcular la ruta. Revisa las direcciones de recogida y entrega.',
          total: 0, desglose: [], requiereAceptacion: false,
        },
      };
    }
    const config = configDeServicio(empresa);
    const contexto = this.contextoDe(solicitud, ruta, empresa);
    if (!cubreViaje(config, contexto)) {
      return {
        ruta,
        cotizacion: {
          estado: 'no_disponible', motivo: 'Este transportista no cubre ese viaje.',
          total: 0, desglose: [], requiereAceptacion: false,
        },
      };
    }
    return { ruta, cotizacion: cotizarViaje(config, solicitud, contexto) };
  }

  /**
   * Ruta por carretera entre los dos puntos. Cada punto vale por su `placeId`
   * (elegido en el autocompletado) o por sus coordenadas (la ubicación actual
   * del cliente, que no tiene `placeId`).
   */
  async rutaDe(solicitud: Pick<SolicitudViaje, 'origen' | 'destino'>): Promise<RutaViaje | null> {
    const [origen, destino] = await Promise.all([this.lugarDe(solicitud.origen), this.lugarDe(solicitud.destino)]);
    if (!origen || !destino) return null;

    const origenId = solicitud.origen?.placeId;
    const destinoId = solicitud.destino?.placeId;
    const trayecto = origenId && destinoId
      ? await this.geo.trayecto(origenId, destinoId)
      : await this.geo.trayectoEntre(origen, destino);
    return trayecto ? { trayecto, origen, destino } : null;
  }

  private async lugarDe(punto?: PuntoViaje): Promise<DireccionLugar | null> {
    if (!punto) return null;
    if (punto.placeId) return this.geo.direccion(punto.placeId);
    const { lat, lng } = punto;
    if (lat !== undefined && lng !== undefined && Number.isFinite(lat) && Number.isFinite(lng)) {
      return this.geo.direccionDePunto(lat, lng);
    }
    return null;
  }

  /**
   * Lo que el motor necesita saber del viaje. Las distancias desde y hasta la
   * base de la empresa son aproximadas (línea recta × sinuosidad): sólo las
   * usan las empresas que cobran el desplazamiento en vacío.
   */
  private contextoDe(solicitud: SolicitudViaje, ruta: RutaViaje, empresa: TransporteCotizable): ContextoViaje {
    const base = empresa.ubicacion?.geo?.coordinates;
    const instante = instanteDeRecogida(solicitud);
    return {
      km: ruta.trayecto.km,
      ciudadOrigen: ruta.origen?.ciudad,
      ciudadDestino: ruta.destino?.ciudad,
      provinciaOrigen: ruta.origen?.provincia,
      provinciaDestino: ruta.destino?.provincia,
      paisOrigen: ruta.origen?.pais,
      paisDestino: ruta.destino?.pais,
      instanteRecogida: instante,
      horasHastaRecogida: horasHasta(instante),
      kmBaseRecogida: kmPorCarretera(base, ruta.origen),
      kmDestinoBase: kmPorCarretera(base, ruta.destino),
    };
  }

  /** Un resultado por modalidad que ofrece la empresa y admite el viaje. */
  private resultadosDe(empresa: TransporteCotizable, solicitud: SolicitudViaje, ruta: RutaViaje): ResultadoTransporte[] {
    if ((empresa.unidadesDisponibles ?? 1) <= 0) return [];
    const config = configDeServicio(empresa);
    const contexto = this.contextoDe(solicitud, ruta, empresa);
    if (!cubreViaje(config, contexto)) return [];

    return modalidadesDe(config).flatMap((modalidad) => {
      const personas = modalidad === ModalidadTransporte.CON_PROPIETARIO ? Math.max(1, solicitud.personas ?? 1) : undefined;
      const cotizacion = cotizarViaje(config, { ...solicitud, modalidad, personas }, contexto);
      if (cotizacion.estado === 'no_disponible') return [];
      return [this.aResultado(empresa, config, modalidad, cotizacion, ruta, contexto)];
    });
  }

  private aResultado(
    empresa: TransporteCotizable,
    config: ConfigTransporte,
    modalidad: ModalidadTransporte,
    cotizacion: CotizacionViaje,
    ruta: RutaViaje,
    contexto: ContextoViaje,
  ): ResultadoTransporte {
    return {
      servicioId: empresa._id.toString(),
      comercioId: empresa.comercioId.toString(),
      titulo: empresa.titulo,
      imagen: empresa.imagenes?.[0],
      ciudadBase: empresa.ubicacion?.ciudad,
      rating: empresa.ratingPromedio ?? 0,
      totalResenas: empresa.totalReseñas ?? 0,
      // Sólo llegan aquí comercios activos, y a `activo` se llega tras la
      // revisión del admin (HU J1): eso es lo que significa «verificada».
      verificado: empresa.comercioActivo === true,
      destacado: empresa.destacado === true,
      modalidad,
      estado: cotizacion.estado === 'precio' ? 'precio' : 'presupuesto',
      motivoPresupuesto: cotizacion.estado === 'presupuesto' ? cotizacion.motivo : undefined,
      total: cotizacion.total,
      desglose: cotizacion.desglose,
      incluidos: incluidosDe(config),
      duracionMin: ruta.trayecto.duracionMin,
      kmHastaRecogida: contexto.kmBaseRecogida === undefined ? undefined : Math.round(contexto.kmBaseRecogida),
      requiereAceptacion: cotizacion.requiereAceptacion,
      cancelacion: resumenCancelacionDe(config),
      tipoVehiculo: empresa.tipoVehiculo,
    };
  }

  private rutaPublica(ruta: RutaViaje): BusquedaTransportesRespuesta['ruta'] {
    const punto = (d: DireccionLugar | null) => (d ? { lat: d.lat, lng: d.lng, provincia: d.provincia, pais: d.pais } : undefined);
    return {
      km: ruta.trayecto.km,
      duracionMin: ruta.trayecto.duracionMin,
      esEstimacion: ruta.trayecto.esEstimacion,
      origen: punto(ruta.origen),
      destino: punto(ruta.destino),
    };
  }

  private sinRuta(): BusquedaTransportesRespuesta {
    return {
      ruta: null,
      viajes: 1,
      resultados: [],
      motivo: 'No hemos podido calcular la ruta. Elige la recogida y la entrega de la lista de sugerencias.',
    };
  }
}

/** Orden de resultados. Los que piden presupuesto van siempre detrás de los que tienen precio. */
function ordenar(resultados: ResultadoTransporte[], orden: OrdenTransporte): ResultadoTransporte[] {
  const conPrecioPrimero = (a: ResultadoTransporte, b: ResultadoTransporte): number =>
    Number(a.estado === 'presupuesto') - Number(b.estado === 'presupuesto');

  const criterios: Record<OrdenTransporte, (a: ResultadoTransporte, b: ResultadoTransporte) => number> = {
    [OrdenTransporte.RECOMENDADOS]: (a, b) => puntuacion(b) - puntuacion(a),
    [OrdenTransporte.PRECIO]: (a, b) => a.total - b.total,
    [OrdenTransporte.VALORACION]: (a, b) => b.rating - a.rating || b.totalResenas - a.totalResenas,
    [OrdenTransporte.RECOGIDA_PROXIMA]: (a, b) => (a.kmHastaRecogida ?? Infinity) - (b.kmHastaRecogida ?? Infinity),
    [OrdenTransporte.DURACION]: (a, b) => a.duracionMin - b.duracionMin || a.total - b.total,
  };
  return [...resultados].sort((a, b) => conPrecioPrimero(a, b) || criterios[orden](a, b));
}

/**
 * «Recomendados»: valoración con peso por número de opiniones, empuje de los
 * destacados (palanca de negocio, CLAUDE.md §1.2) y un pequeño premio a lo que
 * incluye más cosas. El precio no entra: para eso está su propio orden.
 */
function puntuacion(r: ResultadoTransporte): number {
  const confianza = Math.min(1, r.totalResenas / 20);
  return r.rating * (0.5 + 0.5 * confianza) + (r.destacado ? 1 : 0) + r.incluidos.length * 0.05;
}

/** Km aproximados por carretera entre la base de la empresa y un punto. */
function kmPorCarretera(base: [number, number] | undefined, punto: DireccionLugar | null): number | undefined {
  if (!base || !punto) return undefined;
  const [lng, lat] = base;
  const rad = (g: number): number => (g * Math.PI) / 180;
  const dLat = rad(punto.lat - lat);
  const dLng = rad(punto.lng - lng);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(rad(lat)) * Math.cos(rad(punto.lat)) * Math.sin(dLng / 2) ** 2;
  return Math.round(RADIO_TIERRA_KM * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)) * FACTOR_SINUOSIDAD * 10) / 10;
}
