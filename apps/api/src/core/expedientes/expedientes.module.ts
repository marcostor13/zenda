import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Perro, PerroSchema } from '../perros/perro.schema';
import { PerroHistorial, PerroHistorialSchema } from '../perros/perro-historial.schema';
import { Reserva, ReservaSchema } from '../bookings/reserva.schema';
import { Comercio, ComercioSchema } from '../comercios/comercio.schema';
import { Servicio, ServicioSchema } from '../catalog/servicio.schema';
import { PerrosModule } from '../perros/perros.module';
import { UsersModule } from '../users/users.module';
import { ExpedientesService } from './expedientes.service';
import { MascotasComercioController } from './mascotas-comercio.controller';
import { ExpedientePropietarioController } from './expediente-propietario.controller';

/**
 * Expediente de las mascotas: historial de servicios que escriben los comercios
 * y la ficha completa que ve el dueño, con informe PDF para ambos.
 *
 * Sólo lee los servicios (título) y los comercios (nombre): registra los
 * esquemas con las mismas instancias que sus módulos dueños, así Mongoose
 * reutiliza el modelo en vez de crear uno nuevo.
 */
@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Perro.name, schema: PerroSchema },
      { name: PerroHistorial.name, schema: PerroHistorialSchema },
      { name: Reserva.name, schema: ReservaSchema },
      { name: Comercio.name, schema: ComercioSchema },
      { name: Servicio.name, schema: ServicioSchema },
    ]),
    PerrosModule,
    UsersModule,
  ],
  controllers: [MascotasComercioController, ExpedientePropietarioController],
  providers: [ExpedientesService],
})
export class ExpedientesModule {}
