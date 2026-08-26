import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { AvisoProgramado, AvisoProgramadoSchema } from './aviso-programado.schema';
import { AvisosService } from './avisos.service';
import { AvisosController } from './avisos.controller';
import { NotificationsModule } from '../notifications/notifications.module';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: AvisoProgramado.name, schema: AvisoProgramadoSchema }]),
    NotificationsModule,
    AuthModule,
  ],
  controllers: [AvisosController],
  providers: [AvisosService],
  exports: [AvisosService],
})
export class AvisosModule {}
