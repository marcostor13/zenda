import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Liquidacion, LiquidacionSchema } from './liquidacion.schema';
import { Pago, PagoSchema } from '../payments/pago.schema';
import { Reserva, ReservaSchema } from '../bookings/reserva.schema';
import { LiquidacionesService } from './liquidaciones.service';
import { LiquidacionesController } from './liquidaciones.controller';
import { ComerciosModule } from '../comercios/comercios.module';
import { AuditoriaModule } from '../auditoria/auditoria.module';
import { UsersModule } from '../users/users.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Liquidacion.name, schema: LiquidacionSchema },
      { name: Pago.name, schema: PagoSchema },
      { name: Reserva.name, schema: ReservaSchema },
    ]),
    ComerciosModule,
    AuditoriaModule,
    UsersModule,
  ],
  controllers: [LiquidacionesController],
  providers: [LiquidacionesService],
  exports: [LiquidacionesService],
})
export class LiquidacionesModule {}
