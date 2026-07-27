import { Module, OnModuleInit } from '@nestjs/common';
import { CuidadoresAvailabilityStrategy } from './cuidadores-availability.strategy';
import { AvailabilityRegistry } from '../../core/availability/availability.registry';
import { AvailabilityModule } from '../../core/availability/availability.module';
import { CatalogModule } from '../../core/catalog/catalog.module';

/** Vertical Cuidadores a domicilio, autocontenido y auto-registrado (HU-048). */
@Module({
  imports: [AvailabilityModule, CatalogModule],
  providers: [CuidadoresAvailabilityStrategy],
})
export class CuidadoresModule implements OnModuleInit {
  constructor(
    private readonly registry: AvailabilityRegistry,
    private readonly cuidadoresStrategy: CuidadoresAvailabilityStrategy,
  ) {}

  onModuleInit(): void {
    this.registry.registrar(this.cuidadoresStrategy);
  }
}
