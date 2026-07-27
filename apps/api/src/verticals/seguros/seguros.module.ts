import { Module, OnModuleInit } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Poliza, PolizaSchema } from './poliza.schema';
import { SegurosAvailabilityStrategy } from './seguros-availability.strategy';
import { SegurosService } from './seguros.service';
import { SegurosController } from './seguros.controller';
import { AvailabilityRegistry } from '../../core/availability/availability.registry';
import { AvailabilityModule } from '../../core/availability/availability.module';
import { CatalogModule } from '../../core/catalog/catalog.module';
import { PerrosModule } from '../../core/perros/perros.module';

/**
 * Vertical Seguros, autocontenido: aporta su discriminador, su estrategia de
 * elegibilidad y su colección de pólizas, y se auto-registra en el
 * `AvailabilityRegistry`. **El core no se ha tocado para añadirlo**, que es la
 * prueba de que el patrón de extensibilidad funciona (§3.3 de CLAUDE.md).
 */
@Module({
  imports: [
    MongooseModule.forFeature([{ name: Poliza.name, schema: PolizaSchema }]),
    AvailabilityModule,
    CatalogModule,
    PerrosModule,
  ],
  controllers: [SegurosController],
  providers: [SegurosAvailabilityStrategy, SegurosService],
  exports: [SegurosService],
})
export class SegurosModule implements OnModuleInit {
  constructor(
    private readonly registry: AvailabilityRegistry,
    private readonly segurosStrategy: SegurosAvailabilityStrategy,
  ) {}

  onModuleInit(): void {
    this.registry.registrar(this.segurosStrategy);
  }
}
