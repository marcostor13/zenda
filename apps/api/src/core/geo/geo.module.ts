import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { GeoController } from './geo.controller';
import { GeoService } from './geo.service';
import { CentroPoblacion, CentroPoblacionSchema } from './centro-poblacion.schema';
import { CentrosPoblacionRepository } from './centros-poblacion.repository';
import { CentrosPoblacionService } from './centros-poblacion.service';

@Module({
  imports: [MongooseModule.forFeature([{ name: CentroPoblacion.name, schema: CentroPoblacionSchema }])],
  controllers: [GeoController],
  providers: [GeoService, CentrosPoblacionRepository, CentrosPoblacionService],
  exports: [GeoService, CentrosPoblacionService],
})
export class GeoModule {}
