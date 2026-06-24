import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ComisionConfig, ComisionConfigSchema } from './comision-config.schema';
import { ComisionConfigRepository } from './comision-config.repository';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: ComisionConfig.name, schema: ComisionConfigSchema }]),
  ],
  providers: [ComisionConfigRepository],
  exports: [ComisionConfigRepository],
})
export class ComisionConfigsModule {}
