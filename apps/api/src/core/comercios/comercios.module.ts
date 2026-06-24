import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Comercio, ComercioSchema } from './comercio.schema';
import { ComerciosRepository } from './comercios.repository';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: Comercio.name, schema: ComercioSchema }]),
  ],
  providers: [ComerciosRepository],
  exports: [ComerciosRepository],
})
export class ComerciosModule {}
