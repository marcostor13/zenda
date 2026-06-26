import { Module, OnModuleInit } from '@nestjs/common';
import { VueloAvailabilityStrategy } from './vuelo-availability.strategy';
import { VueloSeeder } from './vuelo.seeder';
import { AvailabilityRegistry } from '../../core/availability/availability.registry';
import { AvailabilityModule } from '../../core/availability/availability.module';
import { CatalogModule } from '../../core/catalog/catalog.module';

/** Vertical Vuelos autocontenido; se auto-registra en el AvailabilityRegistry. */
@Module({
  imports: [AvailabilityModule, CatalogModule],
  providers: [VueloAvailabilityStrategy, VueloSeeder],
})
export class VuelosModule implements OnModuleInit {
  constructor(
    private readonly registry: AvailabilityRegistry,
    private readonly vueloStrategy: VueloAvailabilityStrategy,
  ) {}

  onModuleInit(): void {
    this.registry.registrar(this.vueloStrategy);
  }
}
