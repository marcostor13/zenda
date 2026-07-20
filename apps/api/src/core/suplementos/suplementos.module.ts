import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { SuplementoConfig, SuplementoConfigSchema } from './suplemento-config.schema';
import { SuplementosService } from './suplementos.service';
import { SuplementosController } from './suplementos.controller';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: SuplementoConfig.name, schema: SuplementoConfigSchema }]),
  ],
  controllers: [SuplementosController],
  providers: [SuplementosService],
  exports: [SuplementosService],
})
export class SuplementosModule {}
