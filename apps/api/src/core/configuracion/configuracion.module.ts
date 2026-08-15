import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ConfiguracionPlataforma, ConfiguracionPlataformaSchema } from './configuracion.schema';
import { ConfiguracionService } from './configuracion.service';
import { ConfiguracionController } from './configuracion.controller';
import { AuditoriaModule } from '../auditoria/auditoria.module';
import { UsersModule } from '../users/users.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: ConfiguracionPlataforma.name, schema: ConfiguracionPlataformaSchema },
    ]),
    AuditoriaModule,
    UsersModule,
  ],
  controllers: [ConfiguracionController],
  providers: [ConfiguracionService],
  exports: [ConfiguracionService],
})
export class ConfiguracionModule {}
