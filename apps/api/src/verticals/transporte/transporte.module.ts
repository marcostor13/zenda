import { Module, OnModuleInit } from '@nestjs/common';
import { TransporteAvailabilityStrategy } from './transporte-availability.strategy';
import { TransporteSeeder } from './transporte.seeder';
import { AvailabilityRegistry } from '../../core/availability/availability.registry';
import { AvailabilityModule } from '../../core/availability/availability.module';
import { CatalogModule } from '../../core/catalog/catalog.module';

/**
 * Vertical Transporte de animales (Doogking). Autocontenido: aporta su
 * estrategia de disponibilidad/precio y su seed, y se auto-registra en el
 * AvailabilityRegistry al iniciar. El core no se modifica.
 */
@Module({
  imports: [AvailabilityModule, CatalogModule],
  providers: [TransporteAvailabilityStrategy, TransporteSeeder],
})
export class TransporteModule implements OnModuleInit {
  constructor(
    private readonly registry: AvailabilityRegistry,
    private readonly transporteStrategy: TransporteAvailabilityStrategy,
  ) {}

  onModuleInit(): void {
    this.registry.registrar(this.transporteStrategy);
  }
}
