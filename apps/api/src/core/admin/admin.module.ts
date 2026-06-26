import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { AdminService } from './admin.service';
import { AdminController } from './admin.controller';
import { ComisionConfigsModule } from '../comision-configs/comision-configs.module';
import { ComerciosModule } from '../comercios/comercios.module';
import { UsersModule } from '../users/users.module';
import { Pago, PagoSchema } from '../payments/pago.schema';
import { Reserva, ReservaSchema } from '../bookings/reserva.schema';
import { Usuario, UsuarioSchema } from '../users/usuario.schema';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Pago.name, schema: PagoSchema },
      { name: Reserva.name, schema: ReservaSchema },
      { name: Usuario.name, schema: UsuarioSchema },
    ]),
    ComisionConfigsModule,
    ComerciosModule,
    UsersModule,
    AuthModule,
  ],
  controllers: [AdminController],
  providers: [AdminService],
})
export class AdminModule {}
