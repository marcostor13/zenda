import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Servicio, ServicioSchema } from './servicio.schema';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: Servicio.name, schema: ServicioSchema }]),
  ],
  exports: [MongooseModule],
})
export class CatalogModule {}
