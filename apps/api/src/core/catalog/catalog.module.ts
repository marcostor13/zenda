import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { VerticalKey } from 'shared';
import { Servicio, ServicioSchema } from './servicio.schema';
import { Alojamiento, AlojamientoSchema } from '../../verticals/alojamiento/alojamiento.schema';
import { Transporte, TransporteSchema } from '../../verticals/transporte/transporte.schema';
import { Veterinaria, VeterinariaSchema } from '../../verticals/veterinaria/veterinaria.schema';
import { Peluqueria, PeluqueriaSchema } from '../../verticals/peluqueria/peluqueria.schema';
import { Adiestramiento, AdiestramientoSchema } from '../../verticals/adiestramiento/adiestramiento.schema';
import { CatalogRepository } from './catalog.repository';
import { CatalogService } from './catalog.service';
import { CatalogController } from './catalog.controller';

@Module({
  imports: [
    MongooseModule.forFeature([
      {
        name: Servicio.name,
        schema: ServicioSchema,
        discriminators: [
          { name: Alojamiento.name, schema: AlojamientoSchema, value: VerticalKey.ALOJAMIENTO },
          { name: Transporte.name, schema: TransporteSchema, value: VerticalKey.TRANSPORTE },
          { name: Veterinaria.name, schema: VeterinariaSchema, value: VerticalKey.VETERINARIA },
          { name: Peluqueria.name, schema: PeluqueriaSchema, value: VerticalKey.PELUQUERIA },
          { name: Adiestramiento.name, schema: AdiestramientoSchema, value: VerticalKey.ADIESTRAMIENTO },
        ],
      },
    ]),
  ],
  controllers: [CatalogController],
  providers: [CatalogRepository, CatalogService],
  exports: [MongooseModule, CatalogService, CatalogRepository],
})
export class CatalogModule {}
