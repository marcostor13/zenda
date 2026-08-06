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
import { ComisionConfigsModule } from './core/comision-configs/comision-configs.module';
import { AlphaModule } from './core/alpha/alpha.module';
import { CuponesModule } from './core/cupones/cupones.module';
import { PerrosModule } from './core/perros/perros.module';
import { FavoritosModule } from './core/favoritos/favoritos.module';
import { SuplementosModule } from './core/suplementos/suplementos.module';
import { RecomendadorModule } from './core/recomendador/recomendador.module';
import { AlojamientoModule } from './verticals/alojamiento/alojamiento.module';
import { TransporteModule } from './verticals/transporte/transporte.module';
import { VeterinariaModule } from './verticals/veterinaria/veterinaria.module';
import { PeluqueriaModule } from './verticals/peluqueria/peluqueria.module';
import { AdiestramientoModule } from './verticals/adiestramiento/adiestramiento.module';
import { HotelesModule } from './verticals/hoteles/hoteles.module';
import { SegurosModule } from './verticals/seguros/seguros.module';
import { CuidadoresModule } from './verticals/cuidadores/cuidadores.module';
import { UploadModule } from './core/upload/upload.module';
import { AiSearchModule } from './core/ai-search/ai-search.module';
import { GeoModule } from './core/geo/geo.module';
import { CarritoModule } from './core/carrito/carrito.module';
import { LugaresModule } from './core/lugares/lugares.module';
import { EventosModule } from './core/eventos/eventos.module';
import { PlanificadorModule } from './core/planificador/planificador.module';
import { AgendaModule } from './core/agenda/agenda.module';
import { ListaEsperaModule } from './core/lista-espera/lista-espera.module';

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
    ComisionConfigsModule,
    AlphaModule,
    CuponesModule,
    PerrosModule,
    FavoritosModule,
    SuplementosModule,
    RecomendadorModule,
    AlojamientoModule,
    TransporteModule,
    VeterinariaModule,
    PeluqueriaModule,
    AdiestramientoModule,
    HotelesModule,
    SegurosModule,
    CuidadoresModule,
    UploadModule,
    AiSearchModule,
    GeoModule,
    CarritoModule,
    LugaresModule,
    EventosModule,
    PlanificadorModule,
    AgendaModule,
    ListaEsperaModule,
  ],
})
export class AppModule {}
