import { Test, TestingModule } from '@nestjs/testing';
import { UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { AuthService } from './auth.service';
import { SocialAuthService } from './social-auth.service';
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
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
    usersRepository = module.get(UsersRepository);
    jwtService = module.get(JwtService);
    socialAuthService = module.get(SocialAuthService);
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
    it('debería crear el usuario y retornar accessToken', async () => {
      usersRepository.findByEmail.mockResolvedValue(null);
      (bcryptMock.hash as jest.Mock).mockResolvedValue('hashed-password');
      usersRepository.crear.mockResolvedValue(usuarioMock as any);

      const resultado = await service.registro({
        nombre: 'Juan Pérez',
        email: 'juan@test.com',
        password: 'password123',
      });

      expect(resultado.accessToken).toBe('jwt-token');
      expect(usersRepository.crear).toHaveBeenCalledWith(
        expect.objectContaining({ email: 'juan@test.com' }),
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
});
