import { Module, OnModuleInit } from '@nestjs/common';
import { PeluqueriaAvailabilityStrategy } from './peluqueria-availability.strategy';
import { PeluqueriaSeeder } from './peluqueria.seeder';
import { AvailabilityRegistry } from '../../core/availability/availability.registry';
import { AvailabilityModule } from '../../core/availability/availability.module';
import { CatalogModule } from '../../core/catalog/catalog.module';

/** Vertical Peluquería canina autocontenido; se auto-registra en el AvailabilityRegistry. */
@Module({
  imports: [AvailabilityModule, CatalogModule],
  providers: [PeluqueriaAvailabilityStrategy, PeluqueriaSeeder],
})
export class PeluqueriaModule implements OnModuleInit {
  constructor(
    private readonly registry: AvailabilityRegistry,
    private readonly peluqueriaStrategy: PeluqueriaAvailabilityStrategy,
  ) {}

  onModuleInit(): void {
    this.registry.registrar(this.peluqueriaStrategy);
  }
}
