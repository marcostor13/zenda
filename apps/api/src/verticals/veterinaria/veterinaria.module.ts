import { Module, OnModuleInit } from '@nestjs/common';
import { VeterinariaAvailabilityStrategy } from './veterinaria-availability.strategy';
import { VeterinariaSeeder } from './veterinaria.seeder';
import { AvailabilityRegistry } from '../../core/availability/availability.registry';
import { AvailabilityModule } from '../../core/availability/availability.module';
import { CatalogModule } from '../../core/catalog/catalog.module';

/** Vertical Veterinaria autocontenido; se auto-registra en el AvailabilityRegistry. */
@Module({
  imports: [AvailabilityModule, CatalogModule],
  providers: [VeterinariaAvailabilityStrategy, VeterinariaSeeder],
})
export class VeterinariaModule implements OnModuleInit {
  constructor(
    private readonly registry: AvailabilityRegistry,
    private readonly veterinariaStrategy: VeterinariaAvailabilityStrategy,
  ) {}

  onModuleInit(): void {
    this.registry.registrar(this.veterinariaStrategy);
  }
}
