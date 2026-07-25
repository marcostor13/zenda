import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Perro, PerroSchema } from './perro.schema';
import { PerroHistorial, PerroHistorialSchema } from './perro-historial.schema';
import { PerroValoracion, PerroValoracionSchema } from './perro-valoracion.schema';
import { PerroVersion, PerroVersionSchema } from './perro-version.schema';
import { Consentimiento, ConsentimientoSchema } from './consentimiento.schema';
import { Reserva, ReservaSchema } from '../bookings/reserva.schema';
import { PerrosService } from './perros.service';
import { PerroValoracionesService } from './perro-valoraciones.service';
import { PerrosController } from './perros.controller';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Perro.name, schema: PerroSchema },
      { name: PerroHistorial.name, schema: PerroHistorialSchema },
      { name: PerroValoracion.name, schema: PerroValoracionSchema },
      { name: PerroVersion.name, schema: PerroVersionSchema },
      { name: Consentimiento.name, schema: ConsentimientoSchema },
      { name: Reserva.name, schema: ReservaSchema },
    ]),
  ],
  controllers: [PerrosController],
  providers: [PerrosService, PerroValoracionesService],
  exports: [PerrosService, PerroValoracionesService],
})
export class PerrosModule {}
