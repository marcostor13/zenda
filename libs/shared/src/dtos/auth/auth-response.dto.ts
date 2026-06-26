import { Rol } from '../../enums/rol.enum';

export class AuthResponseDto {
  accessToken!: string;
  usuario!: {
    id: string;
    nombre: string;
    email: string;
    rol: Rol;
    comercioId?: string;
  };
}
