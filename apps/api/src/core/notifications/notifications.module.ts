import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Notificacion, NotificacionSchema } from './notificacion.schema';
import { Dispositivo, DispositivoSchema } from './dispositivo.schema';
import { Reserva, ReservaSchema } from '../bookings/reserva.schema';
import { Servicio, ServicioSchema } from '../catalog/servicio.schema';
import { Usuario, UsuarioSchema } from '../users/usuario.schema';
import { NotificationsRepository } from './notifications.repository';
import { NotificationsService } from './notifications.service';
import { MailerService } from './mailer.service';
import { PushService } from './push.service';
import { PushController } from './push.controller';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Notificacion.name, schema: NotificacionSchema },
      { name: Dispositivo.name, schema: DispositivoSchema },
      { name: Reserva.name, schema: ReservaSchema },
      { name: Servicio.name, schema: ServicioSchema },
      { name: Usuario.name, schema: UsuarioSchema },
    ]),
  ],
  controllers: [PushController],
  providers: [NotificationsRepository, NotificationsService, MailerService, PushService],
  exports: [NotificationsService, PushService],
})
export class NotificationsModule {}
