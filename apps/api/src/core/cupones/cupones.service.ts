import { Injectable } from '@nestjs/common';
import { Types } from 'mongoose';
import { CrearCuponDto, ValidarCuponDto, esFechaSinHora, fechaYHoraEnZona, normalizarUbicacion } from 'shared';
import { CuponesRepository } from './cupones.repository';
import { Cupon, CuponDocument } from './cupon.schema';
import { AlphaService } from '../alpha/alpha.service';
import { CatalogRepository } from '../catalog/catalog.repository';
import { DomainException } from '../../shared/exceptions/domain.exception';

/**
 * Quién quiere usar el cupón y dónde.
 *
 * Lo que falte no se comprueba: la vista previa de un cliente antiguo no sabe
 * qué servicio se reserva. Quien no puede saltárselo es la reserva, que pasa
 * siempre el contexto entero.
 */
export interface ContextoCupon {
  usuarioId?: string;
  comercioId?: string;
  /** Ciudad del servicio; cadena vacía si el servicio no la tiene. */
  ciudad?: string;
}

/** Lo que el panel puede cambiar de un cupón; `validoHasta: null` le quita la caducidad. */
export type CambiosCupon = Omit<Partial<Cupon>, 'validoHasta'> & { validoHasta?: string | Date | null };

const CODIGO_DUPLICADO_EN_MONGO = 11000;
const ULTIMO_MINUTO_DEL_DIA = '23:59';
const MS_HASTA_FIN_DE_MINUTO = 59_999;

/**
 * Hasta cuándo vale un cupón que «caduca el día X».
 *
 * El panel manda sólo el día. Guardado tal cual es la medianoche UTC de ese
 * día, y el cupón moría nada más empezar su último día —a la una o las dos de
 * la madrugada en España—. Vale hasta que ese día termina en la plataforma.
 */
function finDeVigencia(valor: string | Date): Date {
  if (valor instanceof Date) return valor;
  if (!esFechaSinHora(valor)) return new Date(valor);
  return new Date(fechaYHoraEnZona(valor, ULTIMO_MINUTO_DEL_DIA).getTime() + MS_HASTA_FIN_DE_MINUTO);
}

const esCodigoDuplicado = (error: unknown): boolean =>
  (error as { code?: number } | null)?.code === CODIGO_DUPLICADO_EN_MONGO;

export interface DescuentoAplicado {
  codigo: string;
  tipo: string;
  descuento: number;
  descripcion?: string;
}

@Injectable()
export class CuponesService {
  constructor(
    private readonly repo: CuponesRepository,
    private readonly alpha: AlphaService,
    private readonly catalogo: CatalogRepository,
  ) {}

  /**
   * La vista previa del asistente de reserva. El comercio y la ciudad salen
   * del servicio, no de lo que diga el cliente: si los mandara él, bastaría con
   * declarar el comercio del cupón para llevárselo a cualquier otro.
   */
  async validarParaCliente(dto: ValidarCuponDto, usuarioId: string): Promise<DescuentoAplicado> {
    const servicio = dto.servicioId ? await this.catalogo.obtenerPorId(dto.servicioId) : null;

    return this.validar(dto.codigo, dto.vertical, dto.montoSubtotal, {
      usuarioId,
      comercioId: servicio?.comercioId.toString(),
      ciudad: servicio ? servicio.ubicacion?.ciudad ?? '' : undefined,
    });
  }

  /**
   * Valida un cupón para un vertical y un importe, y devuelve el descuento en €.
   * Lanza DomainException si el cupón no es aplicable. No incrementa el uso
   * (eso ocurre al confirmar la reserva, vía aplicar()).
   */
  async validar(
    codigo: string,
    vertical: string,
    montoSubtotal: number,
    contexto: ContextoCupon = {},
  ): Promise<DescuentoAplicado> {
    const cupon = await this.repo.findByCodigo(codigo);

    if (!cupon || !cupon.activo) {
      throw new DomainException('Cupón no válido', 404);
    }
    if (cupon.validoHasta && cupon.validoHasta.getTime() < this.ahora()) {
      throw new DomainException('El cupón ha caducado', 410);
    }
    if (cupon.usoMaximo > 0 && cupon.usados >= cupon.usoMaximo) {
      throw new DomainException('El cupón ha alcanzado su límite de usos', 409);
    }
    if (cupon.vertical !== 'global' && cupon.vertical !== vertical) {
      throw new DomainException('El cupón no aplica a este servicio', 422);
    }
    if (montoSubtotal < cupon.montoMinimo) {
      throw new DomainException(`El cupón requiere un importe mínimo de €${cupon.montoMinimo}`, 422);
    }
    this.comprobarAlcance(cupon, contexto);
    await this.comprobarCliente(cupon, contexto.usuarioId);

    return {
      codigo: cupon.codigo,
      tipo: cupon.tipo,
      descuento: this.calcularDescuento(cupon, montoSubtotal),
      descripcion: cupon.descripcion,
    };
  }

  async crear(dto: CrearCuponDto): Promise<CuponDocument> {
    const { comercioId, campanaId, validoHasta, ...resto } = dto;
    const codigo = dto.codigo.trim().toUpperCase();

    try {
      return await this.repo.crear({
        ...resto,
        codigo,
        vertical: dto.vertical ?? 'global',
        validoHasta: validoHasta ? finDeVigencia(validoHasta) : undefined,
        // El DTO viaja con el id en texto; el documento lo guarda como ObjectId.
        comercioId: comercioId ? new Types.ObjectId(comercioId) : undefined,
        campanaId: campanaId ? new Types.ObjectId(campanaId) : undefined,
      });
    } catch (error) {
      // La unicidad la garantiza el índice, no una consulta previa: así dos
      // altas simultáneas del mismo código no pueden colarse las dos.
      if (esCodigoDuplicado(error)) {
        throw new DomainException(`Ya existe un cupón con el código ${codigo}`, 409);
      }
      throw error;
    }
  }

  async actualizar(id: string, cambios: CambiosCupon): Promise<CuponDocument | null> {
    const { validoHasta, ...resto } = cambios;

    if (validoHasta === null) {
      return this.repo.actualizar(id, { $set: resto, $unset: { validoHasta: 1 } });
    }
    return this.repo.actualizar(id, {
      $set: { ...resto, ...(validoHasta ? { validoHasta: finDeVigencia(validoHasta) } : {}) },
    });
  }

  async aplicar(codigo: string): Promise<void> {
    await this.repo.incrementarUso(codigo);
  }

  /** El cupón puede ser de un solo comercio o de una sola ciudad (TCK-8037 §5). */
  private comprobarAlcance(cupon: CuponDocument, contexto: ContextoCupon): void {
    const { comercioId, ciudad } = contexto;

    if (cupon.comercioId && comercioId !== undefined && cupon.comercioId.toString() !== comercioId) {
      throw new DomainException('El cupón no aplica a este comercio', 422);
    }
    if (cupon.ciudad && ciudad !== undefined
        && normalizarUbicacion(cupon.ciudad) !== normalizarUbicacion(ciudad)) {
      throw new DomainException(`El cupón sólo aplica en ${cupon.ciudad}`, 422);
    }
  }

  /**
   * Lo que depende de quién lo usa (TCK-8037 §4 y §6). Los cupones antiguos no
   * traen estos campos y se leen como «sin restricción».
   */
  private async comprobarCliente(cupon: CuponDocument, usuarioId?: string): Promise<void> {
    if (!usuarioId) return;

    if (cupon.soloPrimeraReserva && (await this.repo.contarReservasPagadas(usuarioId)) > 0) {
      throw new DomainException('Este cupón es sólo para tu primera reserva', 422);
    }
    if (cupon.usosPorUsuario > 0
        && (await this.repo.contarUsosDe(cupon.codigo, usuarioId)) >= cupon.usosPorUsuario) {
      throw new DomainException('Ya has usado este cupón el máximo de veces permitido', 409);
    }
    if (cupon.nivelAlphaMinimo > 0) {
      const { nivelActual } = await this.alpha.obtenerEstado(usuarioId);
      if (nivelActual < cupon.nivelAlphaMinimo) {
        throw new DomainException(`Este cupón requiere el nivel Alpha ${cupon.nivelAlphaMinimo}`, 422);
      }
    }
  }

  private calcularDescuento(cupon: CuponDocument, montoSubtotal: number): number {
    let descuento: number;
    if (cupon.tipo === 'porcentaje') {
      descuento = montoSubtotal * cupon.valor;
      if (cupon.topeDescuento > 0) descuento = Math.min(descuento, cupon.topeDescuento);
    } else {
      descuento = cupon.valor;
    }
    descuento = Math.min(descuento, montoSubtotal); // nunca más que el subtotal
    return Math.round(descuento * 100) / 100;
  }

  // Aislado para poder testear la caducidad de forma determinista.
  private ahora(): number {
    return Date.now();
  }
}
