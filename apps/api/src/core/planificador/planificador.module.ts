import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Lugar, LugarSchema } from '../lugares/lugar.schema';
import { PlanificadorService } from './planificador.service';
import { PlanificadorController } from './planificador.controller';
import { CatalogModule } from '../catalog/catalog.module';
import { PerrosModule } from '../perros/perros.module';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: Lugar.name, schema: LugarSchema }]),
    // Aporta el modelo `Servicio`, del que salen las paradas reservables.
    CatalogModule,
    PerrosModule,
  ],
  controllers: [PlanificadorController],
  providers: [PlanificadorService],
  exports: [PlanificadorService],
})
export class PlanificadorModule {}
