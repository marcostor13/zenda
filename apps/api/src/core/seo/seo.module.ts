import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Servicio, ServicioSchema } from '../catalog/servicio.schema';
import { Lugar, LugarSchema } from '../lugares/lugar.schema';
import { SeoController } from './seo.controller';
import { SitemapService } from './sitemap.service';

/**
 * Lo que Google necesita del API: de momento, el sitemap.
 *
 * Registra `Servicio` sin discriminadores a propósito. El sitemap sólo lee el
 * id, el vertical y la fecha del documento base; no necesita saber si es una
 * residencia o una clínica, y declarar aquí los ocho discriminadores sería
 * duplicar el registro de `CatalogModule` sin ganar nada.
 */
@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Servicio.name, schema: ServicioSchema },
      { name: Lugar.name, schema: LugarSchema },
    ]),
  ],
  controllers: [SeoController],
  providers: [SitemapService],
})
export class SeoModule {}
