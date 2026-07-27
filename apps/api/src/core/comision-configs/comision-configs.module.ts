import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ComisionConfig, ComisionConfigSchema } from './comision-config.schema';
import { Comercio, ComercioSchema } from '../comercios/comercio.schema';
import { ComisionConfigRepository } from './comision-config.repository';
import { ComisionResolverService } from './comision-resolver.service';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: ComisionConfig.name, schema: ComisionConfigSchema },
      // El resolver necesita el comercio para los overrides y la congelación de
      // socio fundador; se registra el modelo aquí para no depender del módulo
      // de comercios y evitar una dependencia circular.
      { name: Comercio.name, schema: ComercioSchema },
    ]),
  ],
  providers: [ComisionConfigRepository, ComisionResolverService],
  exports: [ComisionConfigRepository, ComisionResolverService],
})
export class ComisionConfigsModule {}
