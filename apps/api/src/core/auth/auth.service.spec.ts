import { createHash } from 'crypto';
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
            establecerTokenRecuperacion: jest.fn(),
            findByRecuperacionTokenHash: jest.fn(),
            restablecerPassword: jest.fn(),
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
          useValue: { enviarVerificacionEmail: jest.fn(), enviarRecuperacionPassword: jest.fn() },
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

    it('no debería revelar si el email existe según el mensaje de error', async () => {
      // El mensaje distinto para las cuentas sociales convertía el login en un
      // buscador de usuarios: se probaban correos y el que cambiaba de texto era
      // uno registrado.
      usersRepository.findByEmail.mockResolvedValue(null);
      const inexistente = await service
        .login({ email: 'noexiste@test.com', password: 'password123' })
        .catch((e: Error) => e.message);

      usersRepository.findByEmail.mockResolvedValue({ ...usuarioMock, passwordHash: undefined } as any);
      const soloSocial = await service
        .login({ email: 'juan@test.com', password: 'password123' })
        .catch((e: Error) => e.message);

      (bcryptMock.compare as jest.Mock).mockResolvedValue(false);
      usersRepository.findByEmail.mockResolvedValue(usuarioMock as any);
      const passwordMala = await service
        .login({ email: 'juan@test.com', password: 'wrong' })
        .catch((e: Error) => e.message);

      expect(soloSocial).toBe(inexistente);
      expect(passwordMala).toBe(inexistente);
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
        false,
      );
    });

    it('debería marcar el correo como de comercio para roles comercio_admin/comercio_staff (HU-6.2.2)', async () => {
      await service.iniciarVerificacionEmail({
        ...usuarioMock, id: 'comercio-1', rol: Rol.COMERCIO_ADMIN,
      } as any);

      expect(notificationsService.enviarVerificacionEmail).toHaveBeenCalledWith(
        'juan@test.com',
        'Juan Pérez',
        expect.any(String),
        true,
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

  describe('recuperación de contraseña', () => {
    const conToken = (): string => {
      usersRepository.findByEmail.mockResolvedValue(usuarioMock as any);
      return '';
    };

    describe('solicitarRecuperacionPassword', () => {
      it('debería enviar el correo con un enlace a /auth/restablecer', async () => {
        conToken();

        await service.solicitarRecuperacionPassword('juan@test.com');

        const [, , url] = notificationsService.enviarRecuperacionPassword.mock.calls[0];
        expect(url).toContain('/auth/restablecer?token=');
      });

      it('debería guardar la HUELLA del token, nunca el token en claro', async () => {
        conToken();

        await service.solicitarRecuperacionPassword('juan@test.com');

        const [, hashGuardado] = usersRepository.establecerTokenRecuperacion.mock.calls[0];
        const [, , url] = notificationsService.enviarRecuperacionPassword.mock.calls[0];
        const tokenDelCorreo = String(url).split('token=')[1];

        // En claro, quien pudiera leer la colección tomaría cualquier cuenta.
        expect(hashGuardado).not.toBe(tokenDelCorreo);
        expect(hashGuardado).toBe(createHash('sha256').update(tokenDelCorreo).digest('hex'));
      });

      it('debería caducar el enlace en una hora', async () => {
        conToken();
        const antes = Date.now();

        await service.solicitarRecuperacionPassword('juan@test.com');

        const [, , expira] = usersRepository.establecerTokenRecuperacion.mock.calls[0];
        const margen = (expira as Date).getTime() - antes;
        expect(margen).toBeGreaterThan(59 * 60 * 1000);
        expect(margen).toBeLessThanOrEqual(60 * 60 * 1000);
      });

      it('no debería revelar que el email no existe', async () => {
        usersRepository.findByEmail.mockResolvedValue(null);

        await expect(service.solicitarRecuperacionPassword('nadie@test.com')).resolves.toBeUndefined();
        expect(notificationsService.enviarRecuperacionPassword).not.toHaveBeenCalled();
      });

      it('no debería crear contraseña a una cuenta que sólo entra con Google', async () => {
        // Sería una vía para entrar sin pasar por el proveedor que verificó el email.
        usersRepository.findByEmail.mockResolvedValue({ ...usuarioMock, passwordHash: undefined } as any);

        await service.solicitarRecuperacionPassword('juan@test.com');

        expect(usersRepository.establecerTokenRecuperacion).not.toHaveBeenCalled();
      });
    });

    describe('restablecerPassword', () => {
      const enUnaHora = (): Date => new Date(Date.now() + 60 * 60 * 1000);

      it('debería fijar la contraseña nueva hasheada y devolver la sesión', async () => {
        usersRepository.findByRecuperacionTokenHash.mockResolvedValue({
          ...usuarioMock, recuperacionExpira: enUnaHora(),
        } as any);
        usersRepository.restablecerPassword.mockResolvedValue(usuarioMock as any);

        const resultado = await service.restablecerPassword('token-del-correo', 'nueva-clave-8');

        expect(bcryptMock.hash).toHaveBeenCalledWith('nueva-clave-8', 10);
        expect(resultado.accessToken).toBeDefined();
      });

      it('debería buscar por la huella del token, no por el token', async () => {
        usersRepository.findByRecuperacionTokenHash.mockResolvedValue({
          ...usuarioMock, recuperacionExpira: enUnaHora(),
        } as any);
        usersRepository.restablecerPassword.mockResolvedValue(usuarioMock as any);

        await service.restablecerPassword('token-del-correo', 'nueva-clave-8');

        expect(usersRepository.findByRecuperacionTokenHash).toHaveBeenCalledWith(
          createHash('sha256').update('token-del-correo').digest('hex'),
        );
      });

      it('debería rechazar un token que no existe', async () => {
        usersRepository.findByRecuperacionTokenHash.mockResolvedValue(null);

        await expect(
          service.restablecerPassword('inventado', 'nueva-clave-8'),
        ).rejects.toThrow(DomainException);
      });

      it('debería rechazar un token caducado', async () => {
        usersRepository.findByRecuperacionTokenHash.mockResolvedValue({
          ...usuarioMock, recuperacionExpira: new Date(Date.now() - 1000),
        } as any);

        await expect(
          service.restablecerPassword('caducado', 'nueva-clave-8'),
        ).rejects.toThrow(DomainException);
      });

      it('debería dar por verificado el email de quien demuestra tener acceso al buzón', async () => {
        // Si no, se quedaría con la contraseña cambiada y sin poder entrar.
        const pendiente = {
          ...usuarioMock, recuperacionExpira: enUnaHora(),
          requiereVerificacionEmail: true, verificado: false,
        };
        usersRepository.findByRecuperacionTokenHash.mockResolvedValue(pendiente as any);
        usersRepository.restablecerPassword.mockResolvedValue(pendiente as any);
        usersRepository.confirmarVerificacion.mockResolvedValue({ ...pendiente, verificado: true } as any);

        const resultado = await service.restablecerPassword('token', 'nueva-clave-8');

        expect(usersRepository.confirmarVerificacion).toHaveBeenCalled();
        expect(resultado.usuario.verificado).toBe(true);
      });
    });
  });
});
