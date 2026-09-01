import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import {
  EstadoPoliza, EstadoSolicitudSeguros, MAX_ASEGURADORAS, ResultadoElegibilidad, TipoSeguro, VerticalKey,
} from 'shared';
import { Servicio, ServicioDocument } from '../../core/catalog/servicio.schema';
import { PerrosService } from '../../core/perros/perros.service';
import { BienestarService } from '../../core/perros/bienestar.service';
import { construirSnapshotPerro } from '../../core/perros/perro-snapshot.util';
import { DomainException } from '../../shared/exceptions/domain.exception';
import { Poliza, PolizaDocument } from './poliza.schema';
import { Seguros } from './seguros.schema';
import { SegurosAvailabilityStrategy } from './seguros-availability.strategy';

const MESES_POR_ANIO = 12;
const DIAS_POR_MES = 30;

/** Solicitud de alta tal y como la ve el administrador que la revisa. */
export interface SolicitudSegurosAdmin {
  servicioId: string;
  comercioId: string;
  titulo: string;
  estadoSolicitud: EstadoSolicitudSeguros;
  motivoRechazo?: string;
  revisadaEn?: Date;
  creadaEn?: Date;
  solicitud?: Record<string, unknown>;
}

/** Lo que ve el admin al abrir la sección: las solicitudes y cuántas plazas quedan. */
export interface ListadoSolicitudesSeguros {
  solicitudes: SolicitudSegurosAdmin[];
  aprobadas: number;
  plazasLibres: number;
  maximo: number;
}

export interface PolizaRecomendada {
  servicioId: string;
  titulo: string;
  coberturas: TipoSeguro[];
  primaAnual: number;
  /** Prima ya con el descuento del Índice de Bienestar aplicado. */
  primaConDescuento: number;
  descuentoBienestarPct: number;
  elegibilidad: ResultadoElegibilidad;
  motivo?: string;
  /** Por qué se recomienda esta póliza a este perro en concreto. */
  razon: string;
}

@Injectable()
export class SegurosService {
  constructor(
    @InjectModel(Servicio.name) private readonly servicioModel: Model<ServicioDocument>,
    @InjectModel(Poliza.name) private readonly polizaModel: Model<PolizaDocument>,
    private readonly estrategia: SegurosAvailabilityStrategy,
    private readonly perrosService: PerrosService,
    private readonly bienestarService: BienestarService,
  ) {}

  /**
   * "Seguro recomendado para tu perro" (HU-041). Evalúa cada póliza publicada
   * contra el perfil real de la mascota y ordena por precio ya con descuento:
   * mostrar primas antes del bonus-malus daría un orden que no es el que el
   * cliente va a pagar.
   */
  async recomendarPara(perroId: string, usuarioId: string): Promise<PolizaRecomendada[]> {
    const perro = await this.perrosService.obtenerPropio(perroId, usuarioId);
    const bienestar = await this.bienestarService.calcular(perroId);

    const polizas = (await this.servicioModel
      .find({ vertical: VerticalKey.SEGUROS, estado: 'publicado' })
      .lean()
      .exec()) as unknown as Array<Seguros & { _id: Types.ObjectId }>;

    const perfil = {
      edadMeses: this.edadEnMeses(perro.fechaNacimiento),
      pesoKg: perro.peso,
      raza: perro.raza,
      esPPP: perro.esPPP,
      vacunasAlDia: (perro.vacunasDetalle ?? []).length > 0,
    };

    const recomendadas = polizas.map((poliza) => {
      const admision = this.estrategia.evaluarAdmision(poliza.condicionesAdmision ?? {}, perfil);
      const primaAnual =
        Math.round(poliza.primaAnualBase * (1 + admision.recargoPct) * 100) / 100;

      return {
        servicioId: String(poliza._id),
        titulo: poliza.titulo,
        coberturas: poliza.tiposSeguro ?? [],
        primaAnual,
        primaConDescuento:
          Math.round(primaAnual * (1 - bienestar.descuentoSeguroPct) * 100) / 100,
        descuentoBienestarPct: bienestar.descuentoSeguroPct,
        elegibilidad: admision.resultado,
        motivo: admision.motivo,
        razon: this.razon(poliza, perfil, admision.resultado),
      };
    });

    // Lo no elegible se muestra al final, no se oculta: saber por qué una
    // póliza no encaja es información útil.
    return recomendadas.sort((a, b) => {
      const noElegible = (r: PolizaRecomendada): number =>
        r.elegibilidad === ResultadoElegibilidad.NO_ELEGIBLE ? 1 : 0;
      return noElegible(a) - noElegible(b) || a.primaConDescuento - b.primaConDescuento;
    });
  }

  /**
   * Contrata una póliza. Nace `pendiente_validacion` (HU-040): el precio que ha
   * visto el cliente es orientativo y la aseguradora aún debe revisar los datos
   * declarados antes de que la cobertura sea firme.
   */
  async contratar(params: {
    servicioId: string;
    perroId: string;
    usuarioId: string;
    reservaId?: string;
    declaracionVeracidadAceptada: boolean;
  }): Promise<PolizaDocument> {
    if (!params.declaracionVeracidadAceptada) {
      throw new DomainException(
        'Debes confirmar que los datos de tu mascota son ciertos para contratar el seguro.',
        400,
      );
    }

    const poliza = (await this.servicioModel.findById(params.servicioId).lean().exec()) as
      | (Seguros & { _id: Types.ObjectId; comercioId: Types.ObjectId })
      | null;

    if (!poliza) {
      throw new DomainException('Póliza no encontrada', 404);
    }

    const perro = await this.perrosService.obtenerPropio(params.perroId, params.usuarioId);
    const admision = this.estrategia.evaluarAdmision(poliza.condicionesAdmision ?? {}, {
      edadMeses: this.edadEnMeses(perro.fechaNacimiento),
      pesoKg: perro.peso,
      raza: perro.raza,
      esPPP: perro.esPPP,
      vacunasAlDia: (perro.vacunasDetalle ?? []).length > 0,
    });

    if (admision.resultado === ResultadoElegibilidad.NO_ELEGIBLE) {
      throw new DomainException(admision.motivo ?? 'Tu mascota no cumple las condiciones de admisión.', 409);
    }

    const ahora = new Date();
    const meses = poliza.duracionMeses || MESES_POR_ANIO;
    const carenciaDias = Math.max(0, ...(poliza.limitesCobertura ?? []).map((l) => l.carenciaDias ?? 0));

    return this.polizaModel.create({
      usuarioId: new Types.ObjectId(params.usuarioId),
      perroId: new Types.ObjectId(params.perroId),
      servicioId: poliza._id,
      aseguradoraComercioId: poliza.comercioId,
      reservaId: params.reservaId ? new Types.ObjectId(params.reservaId) : undefined,
      coberturas: poliza.tiposSeguro ?? [],
      primaAnual: Math.round(poliza.primaAnualBase * (1 + admision.recargoPct) * 100) / 100,
      recargoAplicadoPct: admision.recargoPct,
      franquiciaEur: Math.max(0, ...(poliza.limitesCobertura ?? []).map((l) => l.franquiciaEur ?? 0)),
      carenciaHasta: carenciaDias
        ? new Date(ahora.getTime() + carenciaDias * 24 * 60 * 60 * 1000)
        : undefined,
      vigenciaDesde: ahora,
      vigenciaHasta: new Date(ahora.getTime() + meses * DIAS_POR_MES * 24 * 60 * 60 * 1000),
      renovacionAutomatica: poliza.renovacionAutomatica,
      estado: EstadoPoliza.PENDIENTE_VALIDACION,
      declaracionVeracidadAceptada: true,
      fechaDeclaracion: ahora,
      // Sostiene la declaración: si más tarde hubo omisiones, esto prueba qué
      // datos se declararon al contratar.
      perroSnapshot: construirSnapshotPerro(perro),
    });
  }

  listarDeUsuario(usuarioId: string): Promise<PolizaDocument[]> {
    return this.polizaModel
      .find({ usuarioId: new Types.ObjectId(usuarioId) })
      .sort({ vigenciaHasta: -1 })
      .exec();
  }

  /** La aseguradora revisa los datos y confirma o rechaza la cobertura. */
  async validar(
    polizaId: string,
    comercioId: string,
    aceptada: boolean,
    motivoRechazo?: string,
  ): Promise<PolizaDocument> {
    const poliza = await this.polizaModel.findById(this.aObjectId(polizaId)).exec();

    if (!poliza) {
      throw new DomainException('Póliza no encontrada', 404);
    }
    if (poliza.aseguradoraComercioId.toString() !== comercioId) {
      throw new DomainException('No tienes permiso sobre esta póliza', 403);
    }
    if (poliza.estado !== EstadoPoliza.PENDIENTE_VALIDACION) {
      throw new DomainException('Esta póliza ya fue validada', 400);
    }

    poliza.estado = aceptada ? EstadoPoliza.VIGENTE : EstadoPoliza.RECHAZADA;
    if (!aceptada) poliza.motivoRechazo = motivoRechazo;

    return poliza.save();
  }

  private razon(
    poliza: Seguros,
    perfil: { esPPP?: boolean; edadMeses?: number },
    elegibilidad: ResultadoElegibilidad,
  ): string {
    if (elegibilidad === ResultadoElegibilidad.NO_ELEGIBLE) {
      return 'No encaja con el perfil de tu mascota.';
    }
    if (perfil.esPPP && poliza.tiposSeguro?.includes(TipoSeguro.PPP)) {
      return 'Incluye la cobertura obligatoria para razas potencialmente peligrosas.';
    }
    if ((perfil.edadMeses ?? 0) >= 8 * MESES_POR_ANIO
      && poliza.tiposSeguro?.includes(TipoSeguro.GASTOS_VET_ENFERMEDAD)) {
      return 'Cubre gastos veterinarios por enfermedad, lo más útil en mascotas mayores.';
    }
    if (poliza.tiposSeguro?.includes(TipoSeguro.VIAJE)) {
      return 'Añade cobertura de viaje, útil si viajas con tu mascota.';
    }
    return 'Cumple las condiciones de admisión de tu mascota.';
  }

  private edadEnMeses(fechaNacimiento?: Date): number | undefined {
    if (!fechaNacimiento) return undefined;
    const meses = (Date.now() - new Date(fechaNacimiento).getTime())
      / (DIAS_POR_MES * 24 * 60 * 60 * 1000);
    return Math.max(0, Math.round(meses));
  }

  private aObjectId(id: string): Types.ObjectId {
    if (!Types.ObjectId.isValid(id)) {
      throw new DomainException('Identificador no válido', 400);
    }
    return new Types.ObjectId(id);
  }

  // ── Alta de aseguradoras (solicitud revisada a mano) ───────────────

  /**
   * Todas las solicitudes, la más reciente primero, con el recuento de plazas.
   *
   * El cupo (`MAX_ASEGURADORAS`) no bloquea el envío de solicitudes —una
   * compañía puede quedar en lista de espera—, pero sí la aprobación: es el
   * momento en que de verdad entra en el catálogo.
   */
  async listarSolicitudes(): Promise<ListadoSolicitudesSeguros> {
    const servicios = (await this.servicioModel
      .find({ vertical: VerticalKey.SEGUROS })
      .sort({ createdAt: -1 })
      .lean()
      .exec()) as unknown as Array<Seguros & { _id: Types.ObjectId; comercioId: Types.ObjectId; createdAt?: Date }>;

    const solicitudes = servicios.map((sv) => ({
      servicioId: sv._id.toString(),
      comercioId: sv.comercioId?.toString() ?? '',
      titulo: sv.titulo,
      estadoSolicitud: sv.estadoSolicitud ?? EstadoSolicitudSeguros.PENDIENTE,
      motivoRechazo: sv.motivoRechazoSolicitud,
      revisadaEn: sv.revisadaEn,
      creadaEn: sv.createdAt,
      solicitud: sv.solicitud as unknown as Record<string, unknown> | undefined,
    }));

    const aprobadas = solicitudes.filter((s) => s.estadoSolicitud === EstadoSolicitudSeguros.APROBADA).length;

    return {
      solicitudes,
      aprobadas,
      plazasLibres: Math.max(0, MAX_ASEGURADORAS - aprobadas),
      maximo: MAX_ASEGURADORAS,
    };
  }

  /**
   * Aprueba una solicitud y publica su ficha. Se niega a pasar del cupo: con
   * las tres plazas ocupadas hay que dar de baja a una compañía antes de
   * admitir otra, que es una decisión de negocio, no un descuido a corregir.
   */
  async aprobarSolicitud(servicioId: string): Promise<SolicitudSegurosAdmin> {
    const servicio = await this.servicioModel.findById(servicioId).exec();
    if (!servicio || servicio.vertical !== VerticalKey.SEGUROS) {
      throw new DomainException('Solicitud no encontrada', 404);
    }

    const doc = servicio as unknown as SegurosDoc;
    if (doc.estadoSolicitud !== EstadoSolicitudSeguros.APROBADA) {
      const { aprobadas } = await this.listarSolicitudes();
      if (aprobadas >= MAX_ASEGURADORAS) {
        throw new DomainException(
          `Ya hay ${MAX_ASEGURADORAS} aseguradoras activas. Da de baja a una antes de aprobar otra.`,
          409,
        );
      }
    }

    doc.estadoSolicitud = EstadoSolicitudSeguros.APROBADA;
    doc.motivoRechazoSolicitud = undefined;
    doc.revisadaEn = new Date();
    servicio.estado = 'publicado';
    await servicio.save();

    return this.aVistaAdmin(doc, servicio);
  }

  /** Rechaza la solicitud con un motivo; la ficha vuelve a borrador y no se ve. */
  async rechazarSolicitud(servicioId: string, motivo: string): Promise<SolicitudSegurosAdmin> {
    const servicio = await this.servicioModel.findById(servicioId).exec();
    if (!servicio || servicio.vertical !== VerticalKey.SEGUROS) {
      throw new DomainException('Solicitud no encontrada', 404);
    }

    const doc = servicio as unknown as SegurosDoc;
    doc.estadoSolicitud = EstadoSolicitudSeguros.RECHAZADA;
    doc.motivoRechazoSolicitud = motivo;
    doc.revisadaEn = new Date();
    servicio.estado = 'borrador';
    await servicio.save();

    return this.aVistaAdmin(doc, servicio);
  }

  private aVistaAdmin(doc: SegurosDoc, servicio: ServicioDocument): SolicitudSegurosAdmin {
    return {
      servicioId: servicio._id.toString(),
      comercioId: servicio.comercioId?.toString() ?? '',
      titulo: servicio.titulo,
      estadoSolicitud: doc.estadoSolicitud,
      motivoRechazo: doc.motivoRechazoSolicitud,
      revisadaEn: doc.revisadaEn,
      solicitud: doc.solicitud as unknown as Record<string, unknown> | undefined,
    };
  }
}

/** Campos del discriminador sobre el documento base, que Mongoose no tipa. */
interface SegurosDoc {
  estadoSolicitud: EstadoSolicitudSeguros;
  motivoRechazoSolicitud?: string;
  revisadaEn?: Date;
  solicitud?: unknown;
}
