import { Module, OnModuleInit } from '@nestjs/common';
import { TaxiAvailabilityStrategy } from './taxi-availability.strategy';
import { TaxiSeeder } from './taxi.seeder';
import { AvailabilityRegistry } from '../../core/availability/availability.registry';
import { AvailabilityModule } from '../../core/availability/availability.module';
import { CatalogModule } from '../../core/catalog/catalog.module';

/**
 * Vertical Taxis. Autocontenido: aporta su estrategia de disponibilidad/precio
 * y su seed, y se auto-registra en el AvailabilityRegistry al iniciar. El core
 * (bookings, availability, payments) no se modifica.
 */
@Module({
  imports: [AvailabilityModule, CatalogModule],
  providers: [TaxiAvailabilityStrategy, TaxiSeeder],
})
export class TaxisModule implements OnModuleInit {
  constructor(
    private readonly registry: AvailabilityRegistry,
    private readonly taxiStrategy: TaxiAvailabilityStrategy,
  ) {}

  onModuleInit(): void {
    this.registry.registrar(this.taxiStrategy);
  }
}
