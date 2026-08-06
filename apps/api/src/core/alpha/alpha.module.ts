import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { AlphaNivelConfig, AlphaNivelConfigSchema } from './alpha-nivel.schema';
import { Reserva, ReservaSchema } from '../bookings/reserva.schema';
import { Comercio, ComercioSchema } from '../comercios/comercio.schema';
import { Servicio, ServicioSchema } from '../catalog/servicio.schema';
import { AlphaRepository } from './alpha.repository';
import { AlphaService } from './alpha.service';
import { AlphaController } from './alpha.controller';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: AlphaNivelConfig.name, schema: AlphaNivelConfigSchema },
      { name: Reserva.name, schema: ReservaSchema },
      // Para resolver qué negocios están adheridos al programa (HU-13.3).
      { name: Comercio.name, schema: ComercioSchema },
      { name: Servicio.name, schema: ServicioSchema },
    ]),
  ],
  controllers: [AlphaController],
  providers: [AlphaRepository, AlphaService],
  exports: [AlphaRepository, AlphaService],
})
export class AlphaModule {}
