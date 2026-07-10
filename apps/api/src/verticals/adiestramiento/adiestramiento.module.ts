import { Module, OnModuleInit } from '@nestjs/common';
import { AdiestramientoAvailabilityStrategy } from './adiestramiento-availability.strategy';
import { AdiestramientoSeeder } from './adiestramiento.seeder';
import { AvailabilityRegistry } from '../../core/availability/availability.registry';
import { AvailabilityModule } from '../../core/availability/availability.module';
import { CatalogModule } from '../../core/catalog/catalog.module';

/** Vertical Adiestramiento canino autocontenido; se auto-registra en el AvailabilityRegistry. */
@Module({
  imports: [AvailabilityModule, CatalogModule],
  providers: [AdiestramientoAvailabilityStrategy, AdiestramientoSeeder],
})
export class AdiestramientoModule implements OnModuleInit {
  constructor(
    private readonly registry: AvailabilityRegistry,
    private readonly adiestramientoStrategy: AdiestramientoAvailabilityStrategy,
  ) {}

  onModuleInit(): void {
    this.registry.registrar(this.adiestramientoStrategy);
  }
}
