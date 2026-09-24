import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { PosicionViaje, PosicionViajeSchema } from './posicion-viaje.schema';
import { Reserva, ReservaSchema } from '../bookings/reserva.schema';
import { Comercio, ComercioSchema } from '../comercios/comercio.schema';
import { SeguimientoService } from './seguimiento.service';
import { SeguimientoClienteController, SeguimientoComercioController } from './seguimiento.controller';

/** Seguimiento en vivo de un viaje y contacto con el comercio. Genérico: no sabe de verticales. */
@Module({
  imports: [
    MongooseModule.forFeature([
      { name: PosicionViaje.name, schema: PosicionViajeSchema },
      { name: Reserva.name, schema: ReservaSchema },
      { name: Comercio.name, schema: ComercioSchema },
    ]),
  ],
  controllers: [SeguimientoClienteController, SeguimientoComercioController],
  providers: [SeguimientoService],
})
export class SeguimientoModule {}
