import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Evento, EventoSchema } from './evento.schema';
import { SolicitudValoracion, SolicitudValoracionSchema } from './solicitud-valoracion.schema';
import { Reserva, ReservaSchema } from '../bookings/reserva.schema';
import { Usuario, UsuarioSchema } from '../users/usuario.schema';
import { EventosService } from './eventos.service';
import { GrowthService } from './growth.service';
import { EventosController } from './eventos.controller';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Evento.name, schema: EventoSchema },
      { name: SolicitudValoracion.name, schema: SolicitudValoracionSchema },
      { name: Reserva.name, schema: ReservaSchema },
      { name: Usuario.name, schema: UsuarioSchema },
    ]),
    NotificationsModule,
  ],
  controllers: [EventosController],
  providers: [EventosService, GrowthService],
  exports: [EventosService, GrowthService],
})
export class EventosModule {}
