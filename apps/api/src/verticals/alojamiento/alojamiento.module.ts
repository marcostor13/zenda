import { Module, OnModuleInit } from '@nestjs/common';
import { AlojamientoAvailabilityStrategy } from './alojamiento-availability.strategy';
import { AlojamientoSeeder } from './alojamiento.seeder';
import { AvailabilityRegistry } from '../../core/availability/availability.registry';
import { AvailabilityModule } from '../../core/availability/availability.module';
import { CatalogModule } from '../../core/catalog/catalog.module';

/** Vertical Alojamiento canino autocontenido; se auto-registra en el AvailabilityRegistry. */
@Module({
  imports: [AvailabilityModule, CatalogModule],
  providers: [AlojamientoAvailabilityStrategy, AlojamientoSeeder],
})
export class AlojamientoModule implements OnModuleInit {
  constructor(
    private readonly registry: AvailabilityRegistry,
    private readonly alojamientoStrategy: AlojamientoAvailabilityStrategy,
  ) {}

  onModuleInit(): void {
    this.registry.registrar(this.alojamientoStrategy);
  }
}
