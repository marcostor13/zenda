import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { AuthModule } from '../auth/auth.module';
import { BookingsModule } from '../bookings/bookings.module';
import { CatalogModule } from '../catalog/catalog.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { Servicio, ServicioSchema } from '../catalog/servicio.schema';
import { PresupuestosController } from './presupuestos.controller';
import { PresupuestosRepository } from './presupuestos.repository';
import { Presupuesto, PresupuestoSchema } from './presupuesto.schema';
import { PresupuestosService } from './presupuestos.service';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Presupuesto.name, schema: PresupuestoSchema },
      { name: Servicio.name, schema: ServicioSchema },
    ]),
    AuthModule,
    BookingsModule,
    CatalogModule,
    NotificationsModule,
  ],
  controllers: [PresupuestosController],
  providers: [PresupuestosService, PresupuestosRepository],
  exports: [PresupuestosService],
})
export class PresupuestosModule {}
