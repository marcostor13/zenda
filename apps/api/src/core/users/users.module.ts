import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Usuario, UsuarioSchema } from './usuario.schema';
import { UsersRepository } from './users.repository';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: Usuario.name, schema: UsuarioSchema }]),
  ],
  providers: [UsersRepository],
  exports: [UsersRepository],
})
export class UsersModule {}
