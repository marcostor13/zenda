import { Module, OnModuleInit } from '@nestjs/common';
import { FunerariosAvailabilityStrategy } from './funerarios-availability.strategy';
import { AvailabilityRegistry } from '../../core/availability/availability.registry';
import { AvailabilityModule } from '../../core/availability/availability.module';
import { CatalogModule } from '../../core/catalog/catalog.module';

/** Vertical Servicios funerarios, autocontenido y auto-registrado. */
@Module({
  imports: [AvailabilityModule, CatalogModule],
  providers: [FunerariosAvailabilityStrategy],
})
export class FunerariosModule implements OnModuleInit {
  constructor(
    private readonly registry: AvailabilityRegistry,
    private readonly funerariosStrategy: FunerariosAvailabilityStrategy,
  ) {}

  onModuleInit(): void {
    this.registry.registrar(this.funerariosStrategy);
  }
}
