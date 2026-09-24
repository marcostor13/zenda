import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { SolicitudPresupuesto, SolicitudPresupuestoSchema } from './solicitud-presupuesto.schema';
import { Usuario, UsuarioSchema } from '../users/usuario.schema';
import { CatalogModule } from '../catalog/catalog.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { PresupuestosRepository } from './presupuestos.repository';
import { PresupuestosService } from './presupuestos.service';
import { PresupuestosComercioController, PresupuestosController } from './presupuestos.controller';

/**
 * Presupuestos a medida, genéricos para cualquier vertical. No depende de
 * `bookings`: es `bookings` quien le pregunta el importe al convertir una
 * solicitud en reserva.
 */
@Module({
  imports: [
    MongooseModule.forFeature([
      { name: SolicitudPresupuesto.name, schema: SolicitudPresupuestoSchema },
      // Sólo el nombre del cliente para la bandeja del comercio.
      { name: Usuario.name, schema: UsuarioSchema },
    ]),
    CatalogModule,
    NotificationsModule,
  ],
  controllers: [PresupuestosController, PresupuestosComercioController],
  providers: [PresupuestosRepository, PresupuestosService],
  exports: [PresupuestosService],
})
export class PresupuestosModule {}
