import { Module, OnModuleInit } from '@nestjs/common';
import { HotelesAvailabilityStrategy } from './hoteles-availability.strategy';
import { HotelesSeeder } from './hoteles.seeder';
import { AvailabilityRegistry } from '../../core/availability/availability.registry';
import { AvailabilityModule } from '../../core/availability/availability.module';
import { CatalogModule } from '../../core/catalog/catalog.module';

/** Vertical Hotel pet-friendly autocontenido; se auto-registra en el AvailabilityRegistry. */
@Module({
  imports: [AvailabilityModule, CatalogModule],
  providers: [HotelesAvailabilityStrategy, HotelesSeeder],
})
export class HotelesModule implements OnModuleInit {
  constructor(
    private readonly registry: AvailabilityRegistry,
    private readonly hotelesStrategy: HotelesAvailabilityStrategy,
  ) {}

  onModuleInit(): void {
    this.registry.registrar(this.hotelesStrategy);
  }
}
