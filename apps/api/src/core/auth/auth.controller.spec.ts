import { Test, TestingModule } from '@nestjs/testing';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { Rol } from 'shared';

describe('AuthController', () => {
  let controller: AuthController;
  let authService: jest.Mocked<AuthService>;

  const authResponseMock = {
    accessToken: 'jwt-token',
    usuario: { id: 'user-1', nombre: 'Juan', email: 'juan@test.com', rol: Rol.CLIENTE },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [
        {
          provide: AuthService,
          useValue: {
            login: jest.fn().mockResolvedValue(authResponseMock),
            registro: jest.fn().mockResolvedValue(authResponseMock),
          },
        },
      ],
    }).compile();

    controller = module.get<AuthController>(AuthController);
    authService = module.get(AuthService);
  });

  describe('login', () => {
    it('debería delegar al AuthService y retornar la respuesta', async () => {
      const dto = { email: 'juan@test.com', password: 'password123' };
      const resultado = await controller.login(dto);

      expect(authService.login).toHaveBeenCalledWith(dto);
      expect(resultado).toEqual(authResponseMock);
    });
  });

  describe('registro', () => {
    it('debería delegar al AuthService y retornar la respuesta', async () => {
      const dto = { nombre: 'Juan', email: 'juan@test.com', password: 'password123' };
      const resultado = await controller.registro(dto);

      expect(authService.registro).toHaveBeenCalledWith(dto);
      expect(resultado).toEqual(authResponseMock);
    });
  });
});
