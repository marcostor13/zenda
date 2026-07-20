import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Comercio, ComercioSchema } from './comercio.schema';
import { Pago, PagoSchema } from '../payments/pago.schema';
import { ComerciosRepository } from './comercios.repository';
import { ComerciosService } from './comercios.service';
import { ComerciosController } from './comercios.controller';
import { CatalogModule } from '../catalog/catalog.module';
import { BookingsModule } from '../bookings/bookings.module';
import { ReviewsModule } from '../reviews/reviews.module';
import { AuthModule } from '../auth/auth.module';
import { UsersModule } from '../users/users.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Comercio.name, schema: ComercioSchema },
      { name: Pago.name, schema: PagoSchema },
    ]),
    CatalogModule,
    BookingsModule,
    ReviewsModule,
    AuthModule,
    UsersModule,
  ],
  controllers: [ComerciosController],
  providers: [ComerciosRepository, ComerciosService],
  exports: [ComerciosRepository, ComerciosService],
})
export class ComerciosModule {}
