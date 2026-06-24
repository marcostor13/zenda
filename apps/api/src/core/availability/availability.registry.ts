import { Injectable } from '@nestjs/common';
import { VerticalKey } from 'shared';
import { AvailabilityStrategy } from './availability.strategy';
import { DomainException } from '../../shared/exceptions/domain.exception';

@Injectable()
export class AvailabilityRegistry {
  private readonly estrategias = new Map<VerticalKey, AvailabilityStrategy>();

  registrar(estrategia: AvailabilityStrategy): void {
    this.estrategias.set(estrategia.vertical, estrategia);
  }

  obtener(vertical: VerticalKey): AvailabilityStrategy {
    const estrategia = this.estrategias.get(vertical);

    if (!estrategia) {
      throw new DomainException(`No hay estrategia de disponibilidad para el vertical: ${vertical}`, 501);
    }

    return estrategia;
  }

  tieneEstrategia(vertical: VerticalKey): boolean {
    return this.estrategias.has(vertical);
  }
}
