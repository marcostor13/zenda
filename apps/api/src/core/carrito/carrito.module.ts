import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Carrito, CarritoSchema } from './carrito.schema';
import { CarritoService } from './carrito.service';
import { CarritoController } from './carrito.controller';
import { AvailabilityModule } from '../availability/availability.module';
import { BookingsModule } from '../bookings/bookings.module';
import { CatalogModule } from '../catalog/catalog.module';
import { PaymentsModule } from '../payments/payments.module';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: Carrito.name, schema: CarritoSchema }]),
    AvailabilityModule,
    BookingsModule,
    CatalogModule,
    PaymentsModule,
  ],
  controllers: [CarritoController],
  providers: [CarritoService],
  exports: [CarritoService],
})
export class CarritoModule {}
