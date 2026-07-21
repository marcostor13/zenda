import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Favorito, FavoritoSchema } from './favorito.schema';
import { FavoritosService } from './favoritos.service';
import { FavoritosRepository } from './favoritos.repository';
import { FavoritosController } from './favoritos.controller';
import { AuthModule } from '../auth/auth.module';
import { CatalogModule } from '../catalog/catalog.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Favorito.name, schema: FavoritoSchema },
    ]),
    // El modelo Servicio (con sus discriminadores por vertical) lo provee CatalogModule.
    CatalogModule,
    AuthModule,
  ],
  controllers: [FavoritosController],
  providers: [FavoritosService, FavoritosRepository],
  exports: [FavoritosService],
})
export class FavoritosModule {}
