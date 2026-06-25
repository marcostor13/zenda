import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Comercio, ComercioSchema } from './comercio.schema';
import { ComerciosRepository } from './comercios.repository';
import { ComerciosService } from './comercios.service';
import { ComerciosController } from './comercios.controller';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: Comercio.name, schema: ComercioSchema }]),
  ],
  controllers: [ComerciosController],
  providers: [ComerciosRepository, ComerciosService],
  exports: [ComerciosRepository, ComerciosService],
})
export class ComerciosModule {}
