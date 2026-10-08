import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Cupon, CuponSchema } from './cupon.schema';
import { Campana, CampanaSchema } from './campana.schema';
import { CuponesRepository } from './cupones.repository';
import { CuponesService } from './cupones.service';
import { CuponesController } from './cupones.controller';
import { CampanasService } from './campanas.service';
import { CampanasController } from './campanas.controller';
import { Reserva, ReservaSchema } from '../bookings/reserva.schema';
import { AlphaModule } from '../alpha/alpha.module';
import { CatalogModule } from '../catalog/catalog.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Cupon.name, schema: CuponSchema },
      { name: Campana.name, schema: CampanaSchema },
      // Para contar lo que ya ha reservado un cliente: «sólo primera reserva»
      // y «usos por persona» se deciden mirando sus reservas pagadas.
      { name: Reserva.name, schema: ReservaSchema },
    ]),
    AlphaModule,
    // Para leer de qué comercio y de qué ciudad es el servicio en la vista previa.
    CatalogModule,
  ],
  controllers: [CuponesController, CampanasController],
  providers: [CuponesRepository, CuponesService, CampanasService],
  exports: [CuponesService, CuponesRepository, CampanasService],
})
export class CuponesModule {}
