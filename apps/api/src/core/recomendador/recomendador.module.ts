import { Module } from '@nestjs/common';
import { RecomendadorService } from './recomendador.service';
import { RecomendadorController } from './recomendador.controller';

@Module({
  controllers: [RecomendadorController],
  providers: [RecomendadorService],
  exports: [RecomendadorService],
})
export class RecomendadorModule {}
