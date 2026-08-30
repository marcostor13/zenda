import { Test, TestingModule } from '@nestjs/testing';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { SocialAuthService } from './social-auth.service';
import { Rol } from 'shared';

describe('AuthController', () => {
  let controller: AuthController;
  let authService: jest.Mocked<AuthService>;
  let socialAuthService: jest.Mocked<SocialAuthService>;

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
            registro: jest.fn().mockResolvedValue({ requiereVerificacion: true, email: 'juan@test.com' }),
            loginConGoogle: jest.fn().mockResolvedValue(authResponseMock),
            loginConFacebook: jest.fn().mockResolvedValue(authResponseMock),
            verificarEmail: jest.fn().mockResolvedValue(authResponseMock),
            reenviarVerificacion: jest.fn().mockResolvedValue(undefined),
          },
        },
        {
          provide: SocialAuthService,
          useValue: {
            configPublica: jest.fn().mockReturnValue({ googleClientId: 'client-web', facebookAppId: 'app-1' }),
          },
        },
      ],
    }).compile();

    controller = module.get<AuthController>(AuthController);
    authService = module.get(AuthService);
    socialAuthService = module.get(SocialAuthService);
  });

  /*
   * El navegador dibuja los botones con lo que sale de aquí, y el API valida
   * contra lo mismo: es lo que impide que las dos configuraciones se separen.
   */
  describe('configSocial', () => {
    it('debería servir los client IDs públicos del login social', () => {
      expect(controller.configSocial()).toEqual({ googleClientId: 'client-web', facebookAppId: 'app-1' });
      expect(socialAuthService.configPublica).toHaveBeenCalled();
    });
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
    it('debería delegar al AuthService y devolver el estado pendiente de verificación', async () => {
      const dto = { nombre: 'Juan', email: 'juan@test.com', password: 'password123' };
      const resultado = await controller.registro(dto);

      expect(authService.registro).toHaveBeenCalledWith(dto);
      expect(resultado).toEqual({ requiereVerificacion: true, email: 'juan@test.com' });
    });
  });

  describe('verificarEmail', () => {
    it('debería delegar el token y devolver la sesión', async () => {
      const resultado = await controller.verificarEmail({ token: 'tok' });

      expect(authService.verificarEmail).toHaveBeenCalledWith('tok');
      expect(resultado).toEqual(authResponseMock);
    });
  });

  describe('reenviarVerificacion', () => {
    it('debería delegar el email y devolver ok', async () => {
      const resultado = await controller.reenviarVerificacion({ email: 'juan@test.com' });

      expect(authService.reenviarVerificacion).toHaveBeenCalledWith('juan@test.com');
      expect(resultado).toEqual({ ok: true });
    });
  });

  describe('google', () => {
    it('debería delegar el ID token al AuthService', async () => {
      const resultado = await controller.google({ idToken: 'id-token' });

      expect(authService.loginConGoogle).toHaveBeenCalledWith('id-token');
      expect(resultado).toEqual(authResponseMock);
    });
  });

  describe('facebook', () => {
    it('debería delegar el access token al AuthService', async () => {
      const resultado = await controller.facebook({ accessToken: 'access-token' });

      expect(authService.loginConFacebook).toHaveBeenCalledWith('access-token');
      expect(resultado).toEqual(authResponseMock);
    });
  });
});
