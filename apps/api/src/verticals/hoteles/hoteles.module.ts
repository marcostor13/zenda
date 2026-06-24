import { Module, OnModuleInit } from '@nestjs/common';
import { HotelAvailabilityStrategy } from './hotel-availability.strategy';
import { AvailabilityRegistry } from '../../core/availability/availability.registry';
import { AvailabilityModule } from '../../core/availability/availability.module';
import { CatalogModule } from '../../core/catalog/catalog.module';

@Module({
  imports: [AvailabilityModule, CatalogModule],
  providers: [HotelAvailabilityStrategy],
})
export class HotelesModule implements OnModuleInit {
  constructor(
    private readonly registry: AvailabilityRegistry,
    private readonly hotelStrategy: HotelAvailabilityStrategy,
  ) {}

  onModuleInit(): void {
    this.registry.registrar(this.hotelStrategy);
  }
}
