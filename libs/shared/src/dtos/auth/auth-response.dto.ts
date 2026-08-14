import { Rol } from '../../enums/rol.enum';

export class AuthResponseDto {
  accessToken!: string;
  usuario!: {
    id: string;
    nombre: string;
    email: string;
    rol: Rol;
    comercioId?: string;
    /**
     * Verificación de la cuenta personal (email confirmado). Es la única
     * verificación que existe del usuario: no confundirla con la verificación
     * documental del comercio (TCK-8029).
     */
    verificado?: boolean;
  };
}
