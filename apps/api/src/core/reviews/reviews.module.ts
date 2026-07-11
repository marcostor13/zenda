import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Resena, ResenaSchema } from './resena.schema';
import { Reserva, ReservaSchema } from '../bookings/reserva.schema';
import { Servicio, ServicioSchema } from '../catalog/servicio.schema';
import { Usuario, UsuarioSchema } from '../users/usuario.schema';
import { ReviewsRepository } from './reviews.repository';
import { ReviewsService } from './reviews.service';
import { ReviewsController } from './reviews.controller';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Resena.name, schema: ResenaSchema },
      { name: Reserva.name, schema: ReservaSchema },
      { name: Servicio.name, schema: ServicioSchema },
      { name: Usuario.name, schema: UsuarioSchema },
    ]),
  ],
  controllers: [ReviewsController],
  providers: [ReviewsService, ReviewsRepository],
  exports: [ReviewsService, ReviewsRepository],
})
export class ReviewsModule {}
