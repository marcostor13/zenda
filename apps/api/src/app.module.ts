import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import { AuthModule } from './core/auth/auth.module';
import { UsersModule } from './core/users/users.module';
import { ComerciosModule } from './core/comercios/comercios.module';
import { CatalogModule } from './core/catalog/catalog.module';
import { AvailabilityModule } from './core/availability/availability.module';
import { BookingsModule } from './core/bookings/bookings.module';
import { PaymentsModule } from './core/payments/payments.module';
import { ReviewsModule } from './core/reviews/reviews.module';
import { NotificationsModule } from './core/notifications/notifications.module';
import { AdminModule } from './core/admin/admin.module';
import { HotelesModule } from './verticals/hoteles/hoteles.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    MongooseModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        uri: config.getOrThrow<string>('MONGODB_URI'),
      }),
    }),
    AuthModule,
    UsersModule,
    ComerciosModule,
    CatalogModule,
    AvailabilityModule,
    BookingsModule,
    PaymentsModule,
    ReviewsModule,
    NotificationsModule,
    AdminModule,
    HotelesModule,
  ],
})
export class AppModule {}
