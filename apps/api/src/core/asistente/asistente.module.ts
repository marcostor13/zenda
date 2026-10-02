import { Module } from '@nestjs/common';
import { CatalogModule } from '../catalog/catalog.module';
import { LugaresModule } from '../lugares/lugares.module';
import { AsistenteController } from './asistente.controller';
import { AsistenteService } from './asistente.service';
import { BusquedaPlataformaService } from './busqueda-plataforma.service';
import { InventarioRepository } from './inventario.repository';

/**
 * El asistente lee el catálogo y Explora a través de sus módulos —búsquedas
 * públicas y modelos exportados—, nunca con una copia propia de sus esquemas.
 */
@Module({
  imports: [CatalogModule, LugaresModule],
  controllers: [AsistenteController],
  providers: [AsistenteService, BusquedaPlataformaService, InventarioRepository],
})
export class AsistenteModule {}
