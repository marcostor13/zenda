import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { VerticalKey } from 'shared';
import { Servicio, ServicioSchema } from './servicio.schema';
import { Hotel, HotelSchema } from '../../verticals/hoteles/hotel.schema';
import { Taxi, TaxiSchema } from '../../verticals/taxis/taxi.schema';
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
        ],
      },
    ]),
  ],
  controllers: [CatalogController],
  providers: [CatalogRepository, CatalogService, CatalogSeeder],
  exports: [MongooseModule, CatalogService, CatalogRepository],
})
export class CatalogModule {}
