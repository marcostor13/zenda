import { Test } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { ComerciosService } from './comercios.service';
import { ComerciosRepository } from './comercios.repository';
import { ReviewsService } from '../reviews/reviews.service';
import { BookingsService } from '../bookings/bookings.service';
import { CatalogService } from '../catalog/catalog.service';
import { AuthService } from '../auth/auth.service';
import { UsersRepository } from '../users/users.repository';
import { Reserva } from '../bookings/reserva.schema';
import { Servicio } from '../catalog/servicio.schema';
import { DomainException } from '../../shared/exceptions/domain.exception';
import { Rol } from 'shared';

describe('ComerciosService', () => {
  let service: ComerciosService;
  let repo: jest.Mocked<ComerciosRepository>;
  let bookingsService: jest.Mocked<BookingsService>;
  let catalogService: jest.Mocked<CatalogService>;
  let usersRepo: jest.Mocked<UsersRepository>;
  let authService: jest.Mocked<AuthService>;

  const dto = {
    razonSocial: 'Hoteles Ibéricos S.L.',
    vatNumber: 'B-12345678',
    nombreComercial: 'Gran Hotel Madrid',
  };

  const dtoRegistroComercio = {
    nombre: 'Ana Torres',
    email: 'ana@royaldog.eu',
    password: 'password123',
    razonSocial: 'Royal Dog Resort S.L.',
    vatNumber: 'ES-B87654321',
    nombreComercial: 'Royal Dog Resort',
  };

  beforeEach(async () => {
    const moduleRef = await Test.createTestingModule({
      providers: [
        ComerciosService,
        {
          provide: ComerciosRepository,
          useValue: {
            findByVatNumber: jest.fn(),
            findById: jest.fn(),
            crear: jest.fn(),
            actualizarEstado: jest.fn(),
            listar: jest.fn(),
            eliminar: jest.fn(),
          },
        },
        { provide: getModelToken(Reserva.name), useValue: {} },
        { provide: getModelToken(Servicio.name), useValue: {} },
        {
          provide: ReviewsService,
          useValue: { listarPorComercio: jest.fn(), responder: jest.fn() },
        },
        {
          provide: BookingsService,
          useValue: { completar: jest.fn() },
        },
        {
          provide: CatalogService,
          useValue: { actualizarDisponibilidad: jest.fn() },
        },
        {
          provide: AuthService,
          useValue: { emitirTokenParaUsuario: jest.fn() },
        },
        {
          provide: UsersRepository,
          useValue: { findByEmail: jest.fn(), crear: jest.fn() },
        },
      ],
    }).compile();

    service = moduleRef.get(ComerciosService);
    repo = moduleRef.get(ComerciosRepository);
    bookingsService = moduleRef.get(BookingsService);
    catalogService = moduleRef.get(CatalogService);
    authService = moduleRef.get(AuthService);
    usersRepo = moduleRef.get(UsersRepository);
  });

  describe('registrar', () => {
    it('debería crear el comercio si el identificador fiscal no existe', async () => {
      repo.findByVatNumber.mockResolvedValue(null);
      repo.crear.mockResolvedValue({ id: 'c1' } as never);

      await service.registrar(dto);

      expect(repo.crear).toHaveBeenCalledWith(expect.objectContaining({ vatNumber: 'B-12345678' }));
    });

    it('debería lanzar 409 si ya existe un comercio con ese identificador fiscal', async () => {
      repo.findByVatNumber.mockResolvedValue({ id: 'existente' } as never);

      await expect(service.registrar(dto)).rejects.toThrow(DomainException);
      expect(repo.crear).not.toHaveBeenCalled();
    });
  });

  describe('obtener', () => {
    it('debería lanzar 404 si el comercio no existe', async () => {
      repo.findById.mockResolvedValue(null);
      await expect(service.obtener('no-existe')).rejects.toThrow(DomainException);
    });
  });

  describe('cambiarEstado', () => {
    it('debería actualizar el estado del comercio', async () => {
      repo.actualizarEstado.mockResolvedValue({ id: 'c1', estado: 'activo' } as never);
      const result = await service.cambiarEstado('c1', 'activo');
      expect(result).toMatchObject({ estado: 'activo' });
    });

    it('debería lanzar 404 si el comercio no existe', async () => {
      repo.actualizarEstado.mockResolvedValue(null);
      await expect(service.cambiarEstado('x', 'suspendido')).rejects.toThrow(DomainException);
    });
  });

  describe('completarReserva', () => {
    it('debería delegar en BookingsService.completar con el comercioId', async () => {
      bookingsService.completar.mockResolvedValue({ estado: 'completada' } as never);

      const resultado = await service.completarReserva('reserva-1', 'comercio-1');

      expect(bookingsService.completar).toHaveBeenCalledWith('reserva-1', 'comercio-1');
      expect(resultado).toMatchObject({ estado: 'completada' });
    });
  });

  describe('registrarConCuenta', () => {
    it('debería crear el comercio y el usuario comercio_admin, y devolver la sesión', async () => {
      usersRepo.findByEmail.mockResolvedValue(null);
      repo.findByVatNumber.mockResolvedValue(null);
      repo.crear.mockResolvedValue({ id: 'comercio-1' } as never);
      usersRepo.crear.mockResolvedValue({ id: 'user-1' } as never);
      authService.emitirTokenParaUsuario.mockResolvedValue({ accessToken: 'jwt', usuario: {} } as never);

      const resultado = await service.registrarConCuenta(dtoRegistroComercio);

      expect(repo.crear).toHaveBeenCalledWith(
        expect.objectContaining({ vatNumber: 'ES-B87654321', nombreComercial: 'Royal Dog Resort' }),
      );
      expect(usersRepo.crear).toHaveBeenCalledWith(
        expect.objectContaining({ email: 'ana@royaldog.eu', rol: Rol.COMERCIO_ADMIN, comercioId: 'comercio-1' }),
      );
      expect(resultado).toEqual({ accessToken: 'jwt', usuario: {} });
    });

    it('debería lanzar 409 si el email ya está registrado', async () => {
      usersRepo.findByEmail.mockResolvedValue({ id: 'existente' } as never);
      await expect(service.registrarConCuenta(dtoRegistroComercio)).rejects.toThrow(DomainException);
      expect(repo.crear).not.toHaveBeenCalled();
    });

    it('debería lanzar 409 si el identificador fiscal ya existe', async () => {
      usersRepo.findByEmail.mockResolvedValue(null);
      repo.findByVatNumber.mockResolvedValue({ id: 'existente' } as never);
      await expect(service.registrarConCuenta(dtoRegistroComercio)).rejects.toThrow(DomainException);
      expect(repo.crear).not.toHaveBeenCalled();
    });

    it('debería eliminar el comercio si falla la creación del usuario (rollback)', async () => {
      usersRepo.findByEmail.mockResolvedValue(null);
      repo.findByVatNumber.mockResolvedValue(null);
      repo.crear.mockResolvedValue({ id: 'comercio-1' } as never);
      usersRepo.crear.mockRejectedValue(new Error('fallo inesperado'));

      await expect(service.registrarConCuenta(dtoRegistroComercio)).rejects.toThrow('fallo inesperado');
      expect(repo.eliminar).toHaveBeenCalledWith('comercio-1');
    });
  });

  describe('actualizarDisponibilidadServicio', () => {
    it('debería delegar en CatalogService.actualizarDisponibilidad', async () => {
      catalogService.actualizarDisponibilidad.mockResolvedValue({ id: 'servicio-1' } as never);

      const resultado = await service.actualizarDisponibilidadServicio(
        'servicio-1', 'comercio-1', { cuposDisponibles: 5 },
      );

      expect(catalogService.actualizarDisponibilidad).toHaveBeenCalledWith(
        'servicio-1', 'comercio-1', { cuposDisponibles: 5 },
      );
      expect(resultado).toMatchObject({ id: 'servicio-1' });
    });
  });
});
