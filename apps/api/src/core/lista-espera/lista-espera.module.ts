import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { AuthModule } from '../auth/auth.module';
import { ListaEsperaController } from './lista-espera.controller';
import { ListaEsperaRepository } from './lista-espera.repository';
import { ListaEspera, ListaEsperaSchema } from './lista-espera.schema';
import { ListaEsperaService } from './lista-espera.service';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: ListaEspera.name, schema: ListaEsperaSchema }]),
    AuthModule,
  ],
  controllers: [ListaEsperaController],
  providers: [ListaEsperaService, ListaEsperaRepository],
  exports: [ListaEsperaService],
})
export class ListaEsperaModule {}
