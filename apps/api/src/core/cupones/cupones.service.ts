import { Injectable } from '@nestjs/common';
import { CuponesRepository } from './cupones.repository';
import { CuponDocument } from './cupon.schema';
import { DomainException } from '../../shared/exceptions/domain.exception';

export interface DescuentoAplicado {
  codigo: string;
  tipo: string;
  descuento: number;
  descripcion?: string;
}

@Injectable()
export class CuponesService {
  constructor(private readonly repo: CuponesRepository) {}

  /**
   * Valida un cupón para un vertical y un importe, y devuelve el descuento en €.
   * Lanza DomainException si el cupón no es aplicable. No incrementa el uso
   * (eso ocurre al confirmar la reserva, vía aplicar()).
   */
  async validar(codigo: string, vertical: string, montoSubtotal: number): Promise<DescuentoAplicado> {
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

    return {
      codigo: cupon.codigo,
      tipo: cupon.tipo,
      descuento: this.calcularDescuento(cupon, montoSubtotal),
      descripcion: cupon.descripcion,
    };
  }

  async aplicar(codigo: string): Promise<void> {
    await this.repo.incrementarUso(codigo);
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
