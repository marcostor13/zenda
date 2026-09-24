import { Module, OnModuleInit } from '@nestjs/common';
import { TransporteAvailabilityStrategy } from './transporte-availability.strategy';
import { TransporteSeeder } from './transporte.seeder';
import { TransporteRepository } from './transporte.repository';
import { TransporteCotizadorService } from './transporte-cotizador.service';
import { TransporteController } from './transporte.controller';
import { AvailabilityRegistry } from '../../core/availability/availability.registry';
import { AvailabilityModule } from '../../core/availability/availability.module';
import { CatalogModule } from '../../core/catalog/catalog.module';
import { GeoModule } from '../../core/geo/geo.module';

/**
 * Vertical Transporte de mascotas (Doogking). Autocontenido: aporta su
 * estrategia de disponibilidad/precio, su cotizador de viajes y su seed, y se
 * auto-registra en el AvailabilityRegistry al iniciar. El core no se modifica.
 */
@Module({
  imports: [AvailabilityModule, CatalogModule, GeoModule],
  controllers: [TransporteController],
  providers: [TransporteAvailabilityStrategy, TransporteSeeder, TransporteRepository, TransporteCotizadorService],
})
export class TransporteModule implements OnModuleInit {
  constructor(
    private readonly registry: AvailabilityRegistry,
    private readonly transporteStrategy: TransporteAvailabilityStrategy,
  ) {}

  onModuleInit(): void {
    this.registry.registrar(this.transporteStrategy);
  }
}
