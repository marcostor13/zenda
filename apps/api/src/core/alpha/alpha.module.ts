import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { AlphaNivelConfig, AlphaNivelConfigSchema } from './alpha-nivel.schema';
import { Reserva, ReservaSchema } from '../bookings/reserva.schema';
import { AlphaRepository } from './alpha.repository';
import { AlphaService } from './alpha.service';
import { AlphaController } from './alpha.controller';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: AlphaNivelConfig.name, schema: AlphaNivelConfigSchema },
      { name: Reserva.name, schema: ReservaSchema },
    ]),
  ],
  controllers: [AlphaController],
  providers: [AlphaRepository, AlphaService],
  exports: [AlphaRepository, AlphaService],
})
export class AlphaModule {}
