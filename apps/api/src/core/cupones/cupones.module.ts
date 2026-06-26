import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Cupon, CuponSchema } from './cupon.schema';
import { CuponesRepository } from './cupones.repository';
import { CuponesService } from './cupones.service';
import { CuponesController } from './cupones.controller';

@Module({
  imports: [MongooseModule.forFeature([{ name: Cupon.name, schema: CuponSchema }])],
  controllers: [CuponesController],
  providers: [CuponesRepository, CuponesService],
  exports: [CuponesService, CuponesRepository],
})
export class CuponesModule {}
