import { Test } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { Types } from 'mongoose';
import { ComerciosService } from './comercios.service';
import { ComerciosRepository } from './comercios.repository';
import { ReviewsService } from '../reviews/reviews.service';
import { BookingsService } from '../bookings/bookings.service';
import { CatalogService } from '../catalog/catalog.service';
import { AuthService } from '../auth/auth.service';
import { UsersRepository } from '../users/users.repository';
import { Reserva } from '../bookings/reserva.schema';
import { Servicio } from '../catalog/servicio.schema';
import { Pago } from '../payments/pago.schema';
import { DomainException } from '../../shared/exceptions/domain.exception';
import { Rol, ReservaEstado } from 'shared';

describe('ComerciosService', () => {
  let service: ComerciosService;
  let repo: jest.Mocked<ComerciosRepository>;
  let bookingsService: jest.Mocked<BookingsService>;
  let catalogService: jest.Mocked<CatalogService>;
  let usersRepo: jest.Mocked<UsersRepository>;
  let authService: jest.Mocked<AuthService>;
  let reservaModel: { find: jest.Mock };
  let pagoModel: { find: jest.Mock };

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
    reservaModel = { find: jest.fn() };
    pagoModel = { find: jest.fn() };

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
        { provide: getModelToken(Reserva.name), useValue: reservaModel },
        { provide: getModelToken(Servicio.name), useValue: {} },
        { provide: getModelToken(Pago.name), useValue: pagoModel },
        {
          provide: ReviewsService,
          useValue: { listarPorComercio: jest.fn(), responder: jest.fn() },
        },
        {
          provide: BookingsService,
          useValue: { completar: jest.fn(), solicitarAjuste: jest.fn() },
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
          useValue: {
            findByEmail: jest.fn(), crear: jest.fn(), findById: jest.fn(),
            eliminar: jest.fn(), listarPorComercio: jest.fn(), actualizarAdmin: jest.fn(),
          },
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

  describe('solicitarAjusteReserva', () => {
    it('debería delegar en BookingsService.solicitarAjuste con los suplementos y la evidencia', async () => {
      bookingsService.solicitarAjuste.mockResolvedValue({ estado: 'ajuste_solicitado' } as never);
      const dto = { suplementos: [{ concepto: 'Nudos severos', monto: 15 }], evidenciaUrl: 'https://x/foto.jpg' };

      const resultado = await service.solicitarAjusteReserva('reserva-1', 'comercio-1', dto);

      expect(bookingsService.solicitarAjuste).toHaveBeenCalledWith(
        'reserva-1',
        'comercio-1',
        dto.suplementos,
        dto.evidenciaUrl,
      );
      expect(resultado).toMatchObject({ estado: 'ajuste_solicitado' });
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

    it('debería registrar sin CIF: usa nombreComercial como razón social y no valida el vat', async () => {
      usersRepo.findByEmail.mockResolvedValue(null);
      repo.crear.mockResolvedValue({ id: 'comercio-1' } as never);
      usersRepo.crear.mockResolvedValue({ id: 'user-1' } as never);
      authService.emitirTokenParaUsuario.mockResolvedValue({ accessToken: 'jwt', usuario: {} } as never);

      await service.registrarConCuenta({
        nombre: 'Ana Torres',
        email: 'ana@royaldog.eu',
        password: 'password123',
        nombreComercial: 'Royal Dog Resort',
        ciudad: 'Madrid',
      });

      expect(repo.findByVatNumber).not.toHaveBeenCalled();
      expect(repo.crear).toHaveBeenCalledWith(
        expect.objectContaining({
          razonSocial: 'Royal Dog Resort',
          vatNumber: undefined,
          direccion: { ciudad: 'Madrid' },
        }),
      );
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

  describe('vincularNuevoComercio (onboarding self-service)', () => {
    const dtoComercio = { razonSocial: 'Mi SL', vatNumber: 'B-1', nombreComercial: 'Mi Negocio' };

    it('crea el comercio, vincula la cuenta y devuelve un token nuevo', async () => {
      usersRepo.findById.mockResolvedValue({ comercioId: undefined } as never);
      repo.findByVatNumber.mockResolvedValue(null);
      repo.crear.mockResolvedValue({ id: 'c9' } as never);
      usersRepo.actualizarAdmin.mockResolvedValue({ id: 'u1', comercioId: 'c9' } as never);
      authService.emitirTokenParaUsuario.mockResolvedValue({ accessToken: 'tok' } as never);

      const res = await service.vincularNuevoComercio('u1', dtoComercio);

      expect(usersRepo.actualizarAdmin).toHaveBeenCalledWith('u1', { comercioId: 'c9' });
      expect(res.accessToken).toBe('tok');
    });

    it('rechaza si la cuenta ya tiene comercio', async () => {
      usersRepo.findById.mockResolvedValue({ comercioId: 'ya' } as never);
      await expect(service.vincularNuevoComercio('u1', dtoComercio)).rejects.toThrow(DomainException);
    });
  });

  describe('equipo del comercio', () => {
    it('crearMiembroEquipo da de alta un comercio_staff vinculado al comercio', async () => {
      usersRepo.findByEmail.mockResolvedValue(null);
      usersRepo.crear.mockResolvedValue({ _id: 'u2' } as never);

      await service.crearMiembroEquipo('comercio-1', {
        nombre: 'Recepción', email: 'recep@vila.com', password: 'secret123', puesto: 'recepcion',
      });

      expect(usersRepo.crear).toHaveBeenCalledWith(
        expect.objectContaining({ rol: Rol.COMERCIO_STAFF, comercioId: 'comercio-1', puesto: 'recepcion' }),
      );
    });

    it('crearMiembroEquipo rechaza un email ya existente', async () => {
      usersRepo.findByEmail.mockResolvedValue({ _id: 'x' } as never);
      await expect(
        service.crearMiembroEquipo('comercio-1', { nombre: 'A', email: 'a@a.com', password: '12345678' }),
      ).rejects.toThrow(DomainException);
    });

    it('eliminarMiembroEquipo no permite auto-eliminarse', async () => {
      await expect(service.eliminarMiembroEquipo('comercio-1', 'u1', 'u1')).rejects.toThrow(DomainException);
    });

    it('eliminarMiembroEquipo rechaza a un miembro de otro comercio', async () => {
      usersRepo.findById.mockResolvedValue({ comercioId: { toString: () => 'otro' }, rol: Rol.COMERCIO_STAFF } as never);
      await expect(service.eliminarMiembroEquipo('comercio-1', 'u2', 'u1')).rejects.toThrow(DomainException);
    });

    it('eliminarMiembroEquipo elimina a un staff del propio comercio', async () => {
      usersRepo.findById.mockResolvedValue({ comercioId: { toString: () => 'comercio-1' }, rol: Rol.COMERCIO_STAFF } as never);
      usersRepo.eliminar.mockResolvedValue(undefined);
      await service.eliminarMiembroEquipo('comercio-1', 'u2', 'u1');
      expect(usersRepo.eliminar).toHaveBeenCalledWith('u2');
    });
  });

  describe('guardas de comercio', () => {
    it('obtenerServiciosComercio lanza si no hay comercioId (evita listados huérfanos)', async () => {
      await expect(service.obtenerServiciosComercio('')).rejects.toThrow(DomainException);
    });

    it('obtenerReservasComercio lanza si no hay comercioId', async () => {
      await expect(service.obtenerReservasComercio('')).rejects.toThrow(DomainException);
    });
  });

  describe('obtenerFinanzasComercio', () => {
    const chain = (result: unknown) => ({
      select: () => ({ lean: () => ({ exec: jest.fn().mockResolvedValue(result) }) }),
    });

    it('debería devolver ceros si el comercio no tiene reservas', async () => {
      reservaModel.find.mockReturnValue(chain([]));
      const finanzas = await service.obtenerFinanzasComercio(new Types.ObjectId().toString());
      expect(finanzas).toEqual({
        facturacionBruta: 0, comisionPlataforma: 0, stripeFee: 0,
        reembolsos: 0, liquidacion: 0, proximaLiquidacion: 0, reservasPagadas: 0,
      });
    });

    it('debería sumar pagos y separar reembolsos y próxima liquidación', async () => {
      reservaModel.find.mockReturnValue(chain([
        { _id: 'r1', estado: ReservaEstado.COMPLETADA },
        { _id: 'r2', estado: ReservaEstado.REEMBOLSADA },
        { _id: 'r3', estado: ReservaEstado.CANCELADA },
      ]));
      pagoModel.find.mockReturnValue(chain([
        { reservaId: 'r1', montoTotal: 121, comisionPlataforma: 15, stripeFee: 2, montoLiquidacion: 104 },
        { reservaId: 'r2', montoTotal: 60, comisionPlataforma: 9, stripeFee: 1, montoLiquidacion: 50 },
      ]));

      const finanzas = await service.obtenerFinanzasComercio(new Types.ObjectId().toString());

      // r1 cuenta como facturación + próxima liquidación; r2 es reembolso.
      expect(finanzas.facturacionBruta).toBe(121);
      expect(finanzas.comisionPlataforma).toBe(15);
      expect(finanzas.reembolsos).toBe(50);
      expect(finanzas.liquidacion).toBe(104);
      expect(finanzas.proximaLiquidacion).toBe(104);
      expect(finanzas.reservasPagadas).toBe(2);
    });
  });
});
