import { Test, TestingModule } from '@nestjs/testing';
import { UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { AuthService } from './auth.service';
import { UsersRepository } from '../users/users.repository';
import { DomainException } from '../../shared/exceptions/domain.exception';
import { Rol } from 'shared';

jest.mock('bcrypt');

const bcryptMock = bcrypt as jest.Mocked<typeof bcrypt>;

describe('AuthService', () => {
  let service: AuthService;
  let usersRepository: jest.Mocked<UsersRepository>;
  let jwtService: jest.Mocked<JwtService>;

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
          },
        },
        {
          provide: JwtService,
          useValue: { sign: jest.fn().mockReturnValue('jwt-token') },
        },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
    usersRepository = module.get(UsersRepository);
    jwtService = module.get(JwtService);
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
