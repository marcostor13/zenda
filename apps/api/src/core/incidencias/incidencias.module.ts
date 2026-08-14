import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Incidencia, IncidenciaSchema } from './incidencia.schema';
import { Reserva, ReservaSchema } from '../bookings/reserva.schema';
import { IncidenciasRepository } from './incidencias.repository';
import { IncidenciasService } from './incidencias.service';
import { IncidenciasController } from './incidencias.controller';
import { UsersModule } from '../users/users.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Incidencia.name, schema: IncidenciaSchema },
      { name: Reserva.name, schema: ReservaSchema },
    ]),
    UsersModule,
  ],
  controllers: [IncidenciasController],
  providers: [IncidenciasRepository, IncidenciasService],
  exports: [IncidenciasService, IncidenciasRepository],
})
export class IncidenciasModule {}
