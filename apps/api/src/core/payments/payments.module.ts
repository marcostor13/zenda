import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Pago, PagoSchema } from './pago.schema';
import { PaymentsService } from './payments.service';
import { PaymentsController } from './payments.controller';
import { StripeGateway } from './stripe.gateway';
import { PAYMENT_GATEWAY } from './payment-gateway.interface';
import { ComisionConfigsModule } from '../comision-configs/comision-configs.module';
import { BookingsModule } from '../bookings/bookings.module';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: Pago.name, schema: PagoSchema }]),
    ComisionConfigsModule,
    BookingsModule,
    AuthModule,
  ],
  controllers: [PaymentsController],
  providers: [
    PaymentsService,
    { provide: PAYMENT_GATEWAY, useClass: StripeGateway },
  ],
  exports: [PaymentsService],
})
export class PaymentsModule {}
