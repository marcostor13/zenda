import { Module, OnModuleInit } from '@nestjs/common';
import { GuarderiaAvailabilityStrategy } from './guarderia-availability.strategy';
import { GuarderiaSeeder } from './guarderia.seeder';
import { AvailabilityRegistry } from '../../core/availability/availability.registry';
import { AvailabilityModule } from '../../core/availability/availability.module';
import { CatalogModule } from '../../core/catalog/catalog.module';

/** Vertical Guardería autocontenido; se auto-registra en el AvailabilityRegistry. */
@Module({
  imports: [AvailabilityModule, CatalogModule],
  providers: [GuarderiaAvailabilityStrategy, GuarderiaSeeder],
})
export class GuarderiaModule implements OnModuleInit {
  constructor(
    private readonly registry: AvailabilityRegistry,
    private readonly guarderiaStrategy: GuarderiaAvailabilityStrategy,
  ) {}

  onModuleInit(): void {
    this.registry.registrar(this.guarderiaStrategy);
  }
}
