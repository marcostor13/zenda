import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { BloqueoServicio, BloqueoServicioSchema } from './bloqueo-servicio.schema';
import { BloqueosService } from './bloqueos.service';
import { BloqueosController } from './bloqueos.controller';
import { Reserva, ReservaSchema } from '../bookings/reserva.schema';
import { Servicio, ServicioSchema } from '../catalog/servicio.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: BloqueoServicio.name, schema: BloqueoServicioSchema },
      { name: Reserva.name, schema: ReservaSchema },
      { name: Servicio.name, schema: ServicioSchema },
    ]),
  ],
  controllers: [BloqueosController],
  providers: [BloqueosService],
  // Lo consumen la disponibilidad (para restar lo cerrado) y las reservas
  // (para rechazar las que caen en un tramo cerrado).
  exports: [BloqueosService],
})
export class BloqueosModule {}
