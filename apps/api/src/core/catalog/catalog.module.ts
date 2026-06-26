import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { VerticalKey } from 'shared';
import { Servicio, ServicioSchema } from './servicio.schema';
import { Hotel, HotelSchema } from '../../verticals/hoteles/hotel.schema';
import { Taxi, TaxiSchema } from '../../verticals/taxis/taxi.schema';
import { Vuelo, VueloSchema } from '../../verticals/vuelos/vuelo.schema';
import { Transporte, TransporteSchema } from '../../verticals/transporte/transporte.schema';
import { Guarderia, GuarderiaSchema } from '../../verticals/guarderia/guarderia.schema';
import { CatalogRepository } from './catalog.repository';
import { CatalogService } from './catalog.service';
import { CatalogController } from './catalog.controller';
import { CatalogSeeder } from './catalog.seeder';

@Module({
  imports: [
    MongooseModule.forFeature([
      {
        name: Servicio.name,
        schema: ServicioSchema,
        discriminators: [
          { name: Hotel.name, schema: HotelSchema, value: VerticalKey.HOTELES },
          { name: Taxi.name, schema: TaxiSchema, value: VerticalKey.TAXIS },
          { name: Vuelo.name, schema: VueloSchema, value: VerticalKey.VUELOS },
          { name: Transporte.name, schema: TransporteSchema, value: VerticalKey.TRANSPORTE },
          { name: Guarderia.name, schema: GuarderiaSchema, value: VerticalKey.GUARDERIA },
        ],
      },
    ]),
  ],
  controllers: [CatalogController],
  providers: [CatalogRepository, CatalogService, CatalogSeeder],
  exports: [MongooseModule, CatalogService, CatalogRepository],
})
export class CatalogModule {}
