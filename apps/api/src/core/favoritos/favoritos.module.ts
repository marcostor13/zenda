import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Favorito, FavoritoSchema } from './favorito.schema';
import { Servicio, ServicioSchema } from '../catalog/servicio.schema';
import { FavoritosService } from './favoritos.service';
import { FavoritosRepository } from './favoritos.repository';
import { FavoritosController } from './favoritos.controller';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Favorito.name, schema: FavoritoSchema },
      { name: Servicio.name, schema: ServicioSchema },
    ]),
    AuthModule,
  ],
  controllers: [FavoritosController],
  providers: [FavoritosService, FavoritosRepository],
  exports: [FavoritosService],
})
export class FavoritosModule {}
