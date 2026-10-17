import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Comercio, ComercioSchema } from '../core/comercios/comercio.schema';
import { Usuario, UsuarioSchema } from '../core/users/usuario.schema';
import { DatosDemoSeeder } from './datos-demo.seeder';

/**
 * Datos ficticios del entorno de desarrollo. Siempre se importa, pero no hace
 * nada salvo con `SEMBRAR_DATOS_DEMO=true` (ver `DatosDemoSeeder`).
 */
@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Comercio.name, schema: ComercioSchema },
      { name: Usuario.name, schema: UsuarioSchema },
    ]),
  ],
  providers: [DatosDemoSeeder],
})
export class DatosDemoModule {}
