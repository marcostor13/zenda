import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { AdminService } from './admin.service';
import { AdminController } from './admin.controller';
import { ComisionConfigsModule } from '../comision-configs/comision-configs.module';
import { AlphaModule } from '../alpha/alpha.module';
import { AuditoriaModule } from '../auditoria/auditoria.module';
import { Resena, ResenaSchema } from '../reviews/resena.schema';
import { Incidencia, IncidenciaSchema } from '../incidencias/incidencia.schema';
import { Servicio, ServicioSchema } from '../catalog/servicio.schema';
import { ComerciosModule } from '../comercios/comercios.module';
import { UsersModule } from '../users/users.module';
import { Pago, PagoSchema } from '../payments/pago.schema';
import { Reserva, ReservaSchema } from '../bookings/reserva.schema';
import { Usuario, UsuarioSchema } from '../users/usuario.schema';
import { Comercio, ComercioSchema } from '../comercios/comercio.schema';
import { Perro, PerroSchema } from '../perros/perro.schema';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Pago.name, schema: PagoSchema },
      { name: Reserva.name, schema: ReservaSchema },
      { name: Usuario.name, schema: UsuarioSchema },
      { name: Comercio.name, schema: ComercioSchema },
      { name: Perro.name, schema: PerroSchema },
      { name: Resena.name, schema: ResenaSchema },
      { name: Incidencia.name, schema: IncidenciaSchema },
      { name: Servicio.name, schema: ServicioSchema },
    ]),
    ComisionConfigsModule,
    AlphaModule,
    AuditoriaModule,
    ComerciosModule,
    UsersModule,
    AuthModule,
  ],
  controllers: [AdminController],
  providers: [AdminService],
})
export class AdminModule {}
