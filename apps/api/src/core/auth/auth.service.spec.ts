import { Test, TestingModule } from '@nestjs/testing';
import { UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import { AuthService } from './auth.service';
import { SocialAuthService } from './social-auth.service';
import { NotificationsService } from '../notifications/notifications.service';
import { UsersRepository } from '../users/users.repository';
import { DomainException } from '../../shared/exceptions/domain.exception';
import { Rol } from 'shared';

jest.mock('bcrypt');

const bcryptMock = bcrypt as jest.Mocked<typeof bcrypt>;

describe('AuthService', () => {
  let service: AuthService;
  let usersRepository: jest.Mocked<UsersRepository>;
  let jwtService: jest.Mocked<JwtService>;
  let socialAuthService: jest.Mocked<SocialAuthService>;
  let notificationsService: jest.Mocked<NotificationsService>;

  const usuarioMock = {
    id: 'user-id-1',
    nombre: 'Juan Pérez',
    email: 'juan@test.com',
    passwordHash: 'hashed-password',
    rol: Rol.CLIENTE,
    comercioId: undefined,
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        {
          provide: UsersRepository,
          useValue: {
            findByEmail: jest.fn(),
            crear: jest.fn(),
            vincularProveedor: jest.fn(),
            establecerTokenVerificacion: jest.fn(),
            findByVerificacionToken: jest.fn(),
            confirmarVerificacion: jest.fn(),
          },
        },
        {
          provide: JwtService,
          useValue: { sign: jest.fn().mockReturnValue('jwt-token') },
        },
        {
          provide: SocialAuthService,
          useValue: {
            verificarGoogle: jest.fn(),
            verificarFacebook: jest.fn(),
          },
        },
        {
          provide: NotificationsService,
          useValue: { enviarVerificacionEmail: jest.fn() },
        },
        {
          provide: ConfigService,
          useValue: { get: jest.fn().mockReturnValue(undefined) },
        },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
    usersRepository = module.get(UsersRepository);
    jwtService = module.get(JwtService);
    socialAuthService = module.get(SocialAuthService);
    notificationsService = module.get(NotificationsService);
  });

  describe('login', () => {
    it('debería retornar accessToken cuando las credenciales son válidas', async () => {
      usersRepository.findByEmail.mockResolvedValue(usuarioMock as any);
      (bcryptMock.compare as jest.Mock).mockResolvedValue(true);

      const resultado = await service.login({ email: 'juan@test.com', password: 'password123' });

      expect(resultado.accessToken).toBe('jwt-token');
      expect(resultado.usuario.email).toBe('juan@test.com');
      expect(jwtService.sign).toHaveBeenCalledWith(
        expect.objectContaining({ sub: 'user-id-1', email: 'juan@test.com' }),
      );
    });

    it('debería lanzar UnauthorizedException si el email no existe', async () => {
      usersRepository.findByEmail.mockResolvedValue(null);

      await expect(
        service.login({ email: 'noexiste@test.com', password: 'password123' }),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('debería lanzar UnauthorizedException si la contraseña es incorrecta', async () => {
      usersRepository.findByEmail.mockResolvedValue(usuarioMock as any);
      (bcryptMock.compare as jest.Mock).mockResolvedValue(false);

      await expect(
        service.login({ email: 'juan@test.com', password: 'wrong-password' }),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('debería rechazar el login por contraseña si la cuenta es solo social (sin passwordHash)', async () => {
      (bcryptMock.compare as jest.Mock).mockClear();
      usersRepository.findByEmail.mockResolvedValue({ ...usuarioMock, passwordHash: undefined } as any);

      await expect(
        service.login({ email: 'juan@test.com', password: 'password123' }),
      ).rejects.toThrow(UnauthorizedException);
      expect(bcryptMock.compare).not.toHaveBeenCalled();
    });
  });

  describe('loginConGoogle', () => {
    const perfilGoogle = { email: 'ana@gmail.com', nombre: 'Ana', avatarUrl: 'http://foto' };

    it('debería vincular el proveedor y devolver sesión si el usuario ya existe', async () => {
      socialAuthService.verificarGoogle.mockResolvedValue(perfilGoogle);
      usersRepository.findByEmail.mockResolvedValue({ ...usuarioMock, id: 'user-9' } as any);
      usersRepository.vincularProveedor.mockResolvedValue({ ...usuarioMock, id: 'user-9' } as any);

      const resultado = await service.loginConGoogle('id-token');

      expect(socialAuthService.verificarGoogle).toHaveBeenCalledWith('id-token');
      expect(usersRepository.vincularProveedor).toHaveBeenCalledWith('user-9', 'google');
      expect(usersRepository.crear).not.toHaveBeenCalled();
      expect(resultado.accessToken).toBe('jwt-token');
    });

    it('debería crear una cuenta cliente sin contraseña si el email no existe', async () => {
      socialAuthService.verificarGoogle.mockResolvedValue(perfilGoogle);
      usersRepository.findByEmail.mockResolvedValue(null);
      usersRepository.crear.mockResolvedValue({ ...usuarioMock, email: perfilGoogle.email } as any);

      await service.loginConGoogle('id-token');

      expect(usersRepository.crear).toHaveBeenCalledWith(
        expect.objectContaining({
          email: 'ana@gmail.com',
          proveedores: ['google'],
          verificado: true,
        }),
      );
    });
  });

  describe('loginConFacebook', () => {
    it('debería verificar el token de Meta y resolver la cuenta', async () => {
      socialAuthService.verificarFacebook.mockResolvedValue({ email: 'leo@fb.com', nombre: 'Leo' });
      usersRepository.findByEmail.mockResolvedValue(null);
      usersRepository.crear.mockResolvedValue({ ...usuarioMock, email: 'leo@fb.com' } as any);

      await service.loginConFacebook('access-token');

      expect(socialAuthService.verificarFacebook).toHaveBeenCalledWith('access-token');
      expect(usersRepository.crear).toHaveBeenCalledWith(
        expect.objectContaining({ email: 'leo@fb.com', proveedores: ['facebook'] }),
      );
    });
  });

  describe('registro', () => {
    it('debería crear el usuario pendiente y enviar el correo de verificación (sin sesión)', async () => {
      usersRepository.findByEmail.mockResolvedValue(null);
      (bcryptMock.hash as jest.Mock).mockResolvedValue('hashed-password');
      usersRepository.crear.mockResolvedValue(usuarioMock as any);

      const resultado = await service.registro({
        nombre: 'Juan Pérez',
        email: 'juan@test.com',
        password: 'password123',
      });

      expect(resultado).toEqual({ requiereVerificacion: true, email: 'juan@test.com' });
      expect((resultado as { accessToken?: string }).accessToken).toBeUndefined();
      expect(usersRepository.establecerTokenVerificacion).toHaveBeenCalledWith(
        'user-id-1',
        expect.any(String),
        expect.any(Date),
      );
      expect(notificationsService.enviarVerificacionEmail).toHaveBeenCalledWith(
        'juan@test.com',
        'Juan Pérez',
        expect.stringContaining('/auth/verificar?token='),
      );
    });

    it('debería lanzar DomainException 409 si el email ya existe', async () => {
      usersRepository.findByEmail.mockResolvedValue(usuarioMock as any);

      await expect(
        service.registro({ nombre: 'Juan', email: 'juan@test.com', password: 'password123' }),
      ).rejects.toThrow(DomainException);

      try {
        await service.registro({ nombre: 'Juan', email: 'juan@test.com', password: 'password123' });
      } catch (error) {
        expect((error as DomainException).statusCode).toBe(409);
      }
    });
  });

  describe('verificación de email', () => {
    it('login debería bloquear una cuenta local con el email sin verificar (403)', async () => {
      usersRepository.findByEmail.mockResolvedValue({
        ...usuarioMock,
        requiereVerificacionEmail: true,
        verificado: false,
      } as any);
      (bcryptMock.compare as jest.Mock).mockResolvedValue(true);

      await expect(service.login({ email: 'juan@test.com', password: 'password123' })).rejects.toThrow(
        'Verifica tu email',
      );
    });

    it('verificarEmail debería confirmar la cuenta y devolver sesión con un token válido', async () => {
      const futuro = new Date(Date.now() + 60_000);
      usersRepository.findByVerificacionToken.mockResolvedValue({ ...usuarioMock, verificacionExpira: futuro } as any);
      usersRepository.confirmarVerificacion.mockResolvedValue(usuarioMock as any);

      const resultado = await service.verificarEmail('token-valido');

      expect(usersRepository.confirmarVerificacion).toHaveBeenCalledWith('user-id-1');
      expect(resultado.accessToken).toBe('jwt-token');
    });

    it('verificarEmail debería rechazar un token caducado', async () => {
      const pasado = new Date(Date.now() - 60_000);
      usersRepository.findByVerificacionToken.mockResolvedValue({ ...usuarioMock, verificacionExpira: pasado } as any);

      await expect(service.verificarEmail('token-caducado')).rejects.toThrow(DomainException);
      expect(usersRepository.confirmarVerificacion).not.toHaveBeenCalled();
    });

    it('verificarEmail debería rechazar un token inexistente', async () => {
      usersRepository.findByVerificacionToken.mockResolvedValue(null);
      await expect(service.verificarEmail('no-existe')).rejects.toThrow(DomainException);
    });

    it('reenviarVerificacion solo reenvía si la cuenta está pendiente', async () => {
      usersRepository.findByEmail.mockResolvedValue({
        ...usuarioMock,
        requiereVerificacionEmail: true,
        verificado: false,
      } as any);

      await service.reenviarVerificacion('juan@test.com');

      expect(usersRepository.establecerTokenVerificacion).toHaveBeenCalled();
      expect(notificationsService.enviarVerificacionEmail).toHaveBeenCalled();
    });

    it('reenviarVerificacion no hace nada si el email no existe o ya está verificado', async () => {
      usersRepository.findByEmail.mockResolvedValue(null);
      await service.reenviarVerificacion('desconocido@test.com');
      expect(notificationsService.enviarVerificacionEmail).not.toHaveBeenCalled();
    });
  });
});
