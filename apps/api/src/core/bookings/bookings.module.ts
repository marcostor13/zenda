import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Reserva, ReservaSchema } from './reserva.schema';
import { Pago, PagoSchema } from '../payments/pago.schema';
import { BookingsService } from './bookings.service';
import { ReservasCaducidadService } from './reservas-caducidad.service';
import { BookingsController } from './bookings.controller';
import { AvailabilityModule } from '../availability/availability.module';
import { CatalogModule } from '../catalog/catalog.module';
import { CuponesModule } from '../cupones/cupones.module';
import { PerrosModule } from '../perros/perros.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { ComisionConfigsModule } from '../comision-configs/comision-configs.module';
import { EventosModule } from '../eventos/eventos.module';
import { BloqueosModule } from '../bloqueos/bloqueos.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Reserva.name, schema: ReservaSchema },
      // Sólo para el caducador: antes de cancelar una reserva sin pagar hay que
      // descartar que tenga un cobro aprobado cuyo webhook no llegó.
      { name: Pago.name, schema: PagoSchema },
    ]),
    AvailabilityModule,
    // Para leer el servicio y derivar de él comercio y vertical (no del cliente).
    CatalogModule,
    CuponesModule,
    PerrosModule,
    NotificationsModule,
    ComisionConfigsModule,
    EventosModule,
    // Lo que el comercio cierra a mano manda sobre los cupos del vertical.
    BloqueosModule,
  ],
  controllers: [BookingsController],
  providers: [BookingsService, ReservasCaducidadService],
  exports: [BookingsService, ReservasCaducidadService, MongooseModule],
})
export class BookingsModule {}
