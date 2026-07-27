import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Cupon, CuponSchema } from './cupon.schema';
import { Campana, CampanaSchema } from './campana.schema';
import { CuponesRepository } from './cupones.repository';
import { CuponesService } from './cupones.service';
import { CuponesController } from './cupones.controller';
import { CampanasService } from './campanas.service';
import { CampanasController } from './campanas.controller';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Cupon.name, schema: CuponSchema },
      { name: Campana.name, schema: CampanaSchema },
    ]),
  ],
  controllers: [CuponesController, CampanasController],
  providers: [CuponesRepository, CuponesService, CampanasService],
  exports: [CuponesService, CuponesRepository, CampanasService],
})
export class CuponesModule {}
