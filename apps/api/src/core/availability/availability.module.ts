import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { AvailabilityRegistry } from './availability.registry';
import { OcupacionRepository } from './ocupacion.repository';
import { Reserva, ReservaSchema } from '../bookings/reserva.schema';

/*
 * Registra el modelo de reservas aquí, y no lo toma de `BookingsModule`: el
 * calendario de ocupación se deriva de las reservas, pero depender del módulo
 * entero crearía un ciclo (bookings ya importa availability). Se depende del
 * schema, que no arrastra nada.
 */
@Module({
  imports: [MongooseModule.forFeature([{ name: Reserva.name, schema: ReservaSchema }])],
  providers: [AvailabilityRegistry, OcupacionRepository],
  exports: [AvailabilityRegistry, OcupacionRepository],
})
export class AvailabilityModule {}
