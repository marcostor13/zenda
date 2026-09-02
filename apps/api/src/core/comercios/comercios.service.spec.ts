import { Test } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { Types } from 'mongoose';
import { ComerciosService } from './comercios.service';
import { ComerciosRepository } from './comercios.repository';
import { AuditoriaService } from '../auditoria/auditoria.service';
import { ReviewsService } from '../reviews/reviews.service';
import { BookingsService } from '../bookings/bookings.service';
import { CatalogService } from '../catalog/catalog.service';
import { AuthService } from '../auth/auth.service';
import { UsersRepository } from '../users/users.repository';
import { Reserva } from '../bookings/reserva.schema';
import { Servicio } from '../catalog/servicio.schema';
import { Pago } from '../payments/pago.schema';
import { DomainException } from '../../shared/exceptions/domain.exception';
import { Rol, ReservaEstado, CONDICIONES_COMERCIO_VERSION } from 'shared';

describe('ComerciosService', () => {
  let service: ComerciosService;
  let repo: jest.Mocked<ComerciosRepository>;
  let bookingsService: jest.Mocked<BookingsService>;
  let catalogService: jest.Mocked<CatalogService>;
  let usersRepo: jest.Mocked<UsersRepository>;
  let authService: jest.Mocked<AuthService>;
  let reservaModel: { find: jest.Mock };
  let pagoModel: { find: jest.Mock };
  let servicioModel: {
    updateMany: jest.Mock; findOne?: jest.Mock; findOneAndUpdate?: jest.Mock; find?: jest.Mock;
  };

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
    servicioModel = {
      updateMany: jest.fn().mockReturnValue({ exec: jest.fn().mockResolvedValue({}) }),
      findOne: jest.fn(),
      findOneAndUpdate: jest.fn(),
      find: jest.fn().mockReturnValue({
        select: jest.fn().mockReturnThis(),
        lean: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue([]),
      }),
    };

    const moduleRef = await Test.createTestingModule({
      providers: [
        ComerciosService,
        { provide: AuditoriaService, useValue: { registrar: jest.fn(), listar: jest.fn() } },
        {
          provide: ComerciosRepository,
          useValue: {
            findByVatNumber: jest.fn(),
            findById: jest.fn(),
            crear: jest.fn(),
            actualizarEstado: jest.fn(),
            listar: jest.fn(),
            eliminar: jest.fn(),
            actualizarCampos: jest.fn(),
            actualizar: jest.fn(),
          },
        },
        { provide: getModelToken(Reserva.name), useValue: reservaModel },
        { provide: getModelToken(Servicio.name), useValue: servicioModel },
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
          useValue: { emitirTokenParaUsuario: jest.fn(), iniciarVerificacionEmail: jest.fn() },
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

    it('debería sacar del buscador los listados al suspender el comercio', async () => {
      // El catálogo filtra por el flag denormalizado del listado; sin
      // propagarlo, un comercio suspendido seguía siendo visible y reservable.
      repo.actualizarEstado.mockResolvedValue({ _id: 'c1', id: 'c1', estado: 'suspendido' } as never);

      await service.cambiarEstado('c1', 'suspendido', 'documentación caducada');

      expect(servicioModel.updateMany).toHaveBeenCalledWith(
        { comercioId: 'c1' },
        { comercioActivo: false },
      );
    });

    it('debería devolver los listados al buscador al reactivar el comercio', async () => {
      repo.actualizarEstado.mockResolvedValue({ _id: 'c1', id: 'c1', estado: 'activo' } as never);

      await service.cambiarEstado('c1', 'activo');

      expect(servicioModel.updateMany).toHaveBeenCalledWith(
        { comercioId: 'c1' },
        { comercioActivo: true },
      );
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
    it('debería crear el comercio y la cuenta pendiente de verificar email (sin sesión)', async () => {
      usersRepo.findByEmail.mockResolvedValue(null);
      repo.findByVatNumber.mockResolvedValue(null);
      repo.crear.mockResolvedValue({ id: 'comercio-1' } as never);
      usersRepo.crear.mockResolvedValue({ id: 'user-1', email: 'ana@royaldog.eu' } as never);

      const resultado = await service.registrarConCuenta(dtoRegistroComercio);

      expect(repo.crear).toHaveBeenCalledWith(
        expect.objectContaining({ vatNumber: 'ES-B87654321', nombreComercial: 'Royal Dog Resort' }),
      );
      expect(usersRepo.crear).toHaveBeenCalledWith(
        expect.objectContaining({ email: 'ana@royaldog.eu', rol: Rol.COMERCIO_ADMIN, comercioId: 'comercio-1' }),
      );
      expect(authService.iniciarVerificacionEmail).toHaveBeenCalled();
      expect(resultado).toEqual({ requiereVerificacion: true, email: 'ana@royaldog.eu' });
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

    it('debería traducir un error de clave duplicada (E11000) a 409 en vez de 500', async () => {
      usersRepo.findByEmail.mockResolvedValue(null);
      repo.findByVatNumber.mockResolvedValue(null);
      repo.crear.mockResolvedValue({ id: 'comercio-1' } as never);
      usersRepo.crear.mockRejectedValue({ code: 11000, message: 'E11000 duplicate key' });

      await expect(service.registrarConCuenta(dtoRegistroComercio)).rejects.toMatchObject({ statusCode: 409 });
      expect(repo.eliminar).toHaveBeenCalledWith('comercio-1');
    });

    it('debería registrar sin CIF: deja la razón social vacía y no valida el vat', async () => {
      usersRepo.findByEmail.mockResolvedValue(null);
      repo.crear.mockResolvedValue({ id: 'comercio-1' } as never);
      usersRepo.crear.mockResolvedValue({ id: 'user-1', email: 'ana@royaldog.eu' } as never);

      await service.registrarConCuenta({
        nombre: 'Ana Torres',
        email: 'ana@royaldog.eu',
        password: 'password123',
        nombreComercial: 'Royal Dog Resort',
      });

      expect(repo.findByVatNumber).not.toHaveBeenCalled();
      expect(repo.crear).toHaveBeenCalledWith(
        expect.objectContaining({
          nombreComercial: 'Royal Dog Resort',
          razonSocial: undefined,
          vatNumber: undefined,
        }),
      );
    });

    it('debería nombrar el negocio provisionalmente cuando el alta no lo trae', async () => {
      // El registro sólo pide los datos de acceso, pero `nombreComercial` es
      // obligatorio en el documento: hasta el alta guiada lleva un provisional
      // reconocible, no una cadena vacía.
      usersRepo.findByEmail.mockResolvedValue(null);
      repo.crear.mockResolvedValue({ id: 'comercio-1' } as never);
      usersRepo.crear.mockResolvedValue({ id: 'user-1', email: 'ana@royaldog.eu' } as never);

      await service.registrarConCuenta({
        nombre: 'Ana Torres',
        email: 'ana@royaldog.eu',
        password: 'password123',
      });

      expect(repo.crear).toHaveBeenCalledWith(
        expect.objectContaining({
          nombreComercial: 'Negocio de Ana Torres',
          // El provisional nombra el negocio, pero no le inventa una identidad
          // legal: la razón social la escribe el comercio al cerrar el alta.
          razonSocial: undefined,
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

  describe('actualizarComercio', () => {
    const comercioId = new Types.ObjectId().toString();

    beforeEach(() => {
      repo.actualizar = jest.fn().mockResolvedValue({ _id: comercioId } as never);
    });

    /**
     * La dirección salió de la ficha del negocio: ahora cada servicio guarda la
     * suya, así que ya no hay ninguna coordenada del comercio que empujar a los
     * listados.
     */
    it('no debería tocar los listados al guardar el perfil', async () => {
      await service.actualizarComercio(comercioId, { nombreComercial: 'Canes Premium' });

      expect(servicioModel.updateMany).not.toHaveBeenCalled();
    });

    /**
     * El alta guiada crea la ficha antes de pedir los datos del negocio, así que
     * nace en borrador. Cerrar el alta es el momento en que ya cumple: dejarla
     * igualmente en borrador obligaba a ir a «Mis servicios» a darle a publicar,
     * un paso que nadie asocia con «ya he terminado».
     */
    it('debería publicar los servicios que esperaban al cerrar el alta', async () => {
      await service.actualizarComercio(comercioId, { altaCompletada: true });

      const [filtro, cambios] = servicioModel.updateMany!.mock.calls.at(-1)!;
      expect(filtro).toMatchObject({ estado: 'borrador' });
      // Sólo las que llegan al mínimo de fotos: es la otra condición de publicar.
      expect(filtro['imagenes.4']).toEqual({ $exists: true });
      expect(cambios).toEqual({ $set: { estado: 'publicado' } });
    });

    it('no debería publicar nada al aparcar el alta', async () => {
      // «Todavía no tengo los datos»: la ficha sigue guardada, pero no sale.
      await service.actualizarComercio(comercioId, { altaCompletada: false });

      expect(servicioModel.updateMany).not.toHaveBeenCalled();
    });

    it('debería sellar la fecha y la versión de los consentimientos', async () => {
      // Si la marca la pusiera el cliente, la prueba de consentimiento —para lo
      // único que sirve guardar esto— no valdría nada.
      await service.actualizarComercio(comercioId, {
        consentimientos: { operaLegalmente: true, condicionesGenerales: true },
      });

      const guardado = (repo.actualizar as jest.Mock).mock.calls.at(-1)![1] as Record<string, unknown>;
      const sellados = guardado['consentimientos'] as Record<string, { aceptado: boolean; fecha?: Date; version?: string }>;
      expect(sellados['operaLegalmente'].aceptado).toBe(true);
      expect(sellados['operaLegalmente'].fecha).toBeInstanceOf(Date);
      expect(sellados['operaLegalmente'].version).toBe(CONDICIONES_COMERCIO_VERSION);
    });

    /**
     * El paso final del alta es donde el comercio escribe cómo se llama de
     * verdad; la razón social ahí es opcional, así que quien la deja en blanco
     * se quedaba con el «Negocio de Ana Torres» del registro como identidad
     * legal, que es justo lo que veía el panel de admin.
     */
    it('debería llevarse la razón social provisional al nombre que puso el comercio', async () => {
      repo.findById.mockResolvedValue({
        nombreComercial: 'Negocio de Ana Torres',
        razonSocial: 'Negocio de Ana Torres',
      } as never);

      await service.actualizarComercio(comercioId, { nombreComercial: 'Canes Premium' });

      const guardado = (repo.actualizar as jest.Mock).mock.calls.at(-1)![1] as Record<string, unknown>;
      expect(guardado['razonSocial']).toBe('Canes Premium');
    });

    it('debería rellenar la razón social vacía con el nombre del negocio', async () => {
      repo.findById.mockResolvedValue({ nombreComercial: 'Negocio de Ana Torres' } as never);

      await service.actualizarComercio(comercioId, { nombreComercial: 'Canes Premium' });

      const guardado = (repo.actualizar as jest.Mock).mock.calls.at(-1)![1] as Record<string, unknown>;
      expect(guardado['razonSocial']).toBe('Canes Premium');
    });

    it('no debería tocar una razón social que el comercio puso a propósito', async () => {
      repo.findById.mockResolvedValue({
        nombreComercial: 'Canes Premium',
        razonSocial: 'Canes Premium S.L.',
      } as never);

      await service.actualizarComercio(comercioId, { nombreComercial: 'Canes Royal' });

      const guardado = (repo.actualizar as jest.Mock).mock.calls.at(-1)![1] as Record<string, unknown>;
      expect(guardado['razonSocial']).toBeUndefined();
    });

    it('debería respetar la razón social que llega en el mismo guardado', async () => {
      repo.findById.mockResolvedValue({
        nombreComercial: 'Negocio de Ana Torres',
        razonSocial: 'Negocio de Ana Torres',
      } as never);

      await service.actualizarComercio(comercioId, {
        nombreComercial: 'Canes Premium',
        razonSocial: 'Canes Premium S.L.',
      });

      const guardado = (repo.actualizar as jest.Mock).mock.calls.at(-1)![1] as Record<string, unknown>;
      expect(guardado['razonSocial']).toBe('Canes Premium S.L.');
    });

    it('no debería dejar fecha en un consentimiento retirado', async () => {
      // Conservar la fecha de algo que se desmarcó es peor que no tenerla.
      await service.actualizarComercio(comercioId, {
        consentimientos: { operaLegalmente: false, condicionesGenerales: true },
      });

      const guardado = (repo.actualizar as jest.Mock).mock.calls.at(-1)![1] as Record<string, unknown>;
      const sellados = guardado['consentimientos'] as Record<string, { aceptado: boolean; fecha?: Date }>;
      expect(sellados['operaLegalmente']).toEqual({ aceptado: false });
    });
  });

  describe('fijarSocioFundador', () => {
    it('debería lanzar 404 si el comercio no existe', async () => {
      repo.findById.mockResolvedValue(null);

      await expect(service.fijarSocioFundador('no-existe', { socioFundador: true } as never))
        .rejects.toThrow(DomainException);
    });

    it('debería exigir la comisión que se congela al dar de alta', async () => {
      repo.findById.mockResolvedValue({ _id: 'c1' } as never);

      await expect(service.fijarSocioFundador('c1', { socioFundador: true } as never))
        .rejects.toThrow('Indica la comisión');

      expect(repo.actualizarCampos).not.toHaveBeenCalled();
    });

    it('debería congelar la comisión con los meses por defecto', async () => {
      repo.findById.mockResolvedValue({ _id: 'c1' } as never);
      repo.actualizarCampos.mockResolvedValue({ _id: 'c1' } as never);

      await service.fijarSocioFundador('c1', {
        socioFundador: true, comisionPctCongelada: 0.1,
      } as never);

      const campos = repo.actualizarCampos.mock.calls[0][1] as Record<string, unknown>;
      expect(campos.socioFundador).toBe(true);
      expect(campos.comisionPctCongelada).toBe(0.1);
      // 24 meses por defecto: la congelación debe quedar en el futuro.
      expect((campos.congelacionHasta as Date).getTime()).toBeGreaterThan(Date.now());
      // La cohorte se calcula por trimestre cuando no se indica.
      expect(campos.cohorte).toMatch(/^\d{4}-Q[1-4]$/);
    });

    it('debería respetar los meses y la cohorte indicados', async () => {
      repo.findById.mockResolvedValue({ _id: 'c1' } as never);
      repo.actualizarCampos.mockResolvedValue({ _id: 'c1' } as never);

      await service.fijarSocioFundador('c1', {
        socioFundador: true, comisionPctCongelada: 0.12, mesesCongelacion: 6, cohorte: '2026-Q1',
      } as never);

      expect(repo.actualizarCampos.mock.calls[0][1]).toEqual(
        expect.objectContaining({ cohorte: '2026-Q1' }),
      );
    });

    it('debería limpiar comisión y caducidad al dar de baja, sin dejar valores huérfanos', async () => {
      repo.findById.mockResolvedValue({ _id: 'c1' } as never);
      repo.actualizarCampos.mockResolvedValue({ _id: 'c1' } as never);

      await service.fijarSocioFundador('c1', { socioFundador: false } as never);

      expect(repo.actualizarCampos).toHaveBeenCalledWith('c1', {
        socioFundador: false,
        comisionPctCongelada: undefined,
        congelacionHasta: undefined,
      });
    });

    it('debería lanzar 404 si el comercio desaparece entre la lectura y la escritura', async () => {
      repo.findById.mockResolvedValue({ _id: 'c1' } as never);
      repo.actualizarCampos.mockResolvedValue(null);

      await expect(service.fijarSocioFundador('c1', { socioFundador: false } as never))
        .rejects.toThrow('Comercio no encontrado');
    });
  });

  describe('fijarAlphaAdherido', () => {
    it('debería lanzar 404 si el comercio no existe', async () => {
      repo.findById.mockResolvedValue(null);

      await expect(service.fijarAlphaAdherido('no-existe', true)).rejects.toThrow(DomainException);
    });

    it('debería alternar la adhesión al programa', async () => {
      repo.findById.mockResolvedValue({ _id: 'c1' } as never);
      repo.actualizarCampos.mockResolvedValue({ _id: 'c1', alphaAdherido: true } as never);

      await service.fijarAlphaAdherido('c1', true);

      expect(repo.actualizarCampos).toHaveBeenCalledWith('c1', { alphaAdherido: true });
    });
  });

  describe('equipo del comercio', () => {
    const comercioId = new Types.ObjectId().toString();

    it('debería negar el acceso a una cuenta sin comercio vinculado', async () => {
      await expect(service.obtenerEquipo('')).rejects.toThrow('no está vinculada a ningún comercio');
    });

    it('debería rechazar dar de alta a alguien con un email ya usado', async () => {
      usersRepo.findByEmail.mockResolvedValue({ _id: 'otro' } as never);

      await expect(
        service.crearMiembroEquipo(comercioId, { nombre: 'Eva', email: 'eva@c.com', password: 'Segura123!' }),
      ).rejects.toThrow('Ya existe un usuario con ese email');

      expect(usersRepo.crear).not.toHaveBeenCalled();
    });

    it('debería crear al miembro como staff, con la contraseña hasheada', async () => {
      usersRepo.findByEmail.mockResolvedValue(null);
      usersRepo.crear.mockResolvedValue({ _id: 'u1' } as never);

      await service.crearMiembroEquipo(comercioId, {
        nombre: 'Eva', email: 'eva@c.com', password: 'Segura123!', puesto: 'Recepción',
      });

      const datos = usersRepo.crear.mock.calls[0][0];
      expect(datos.rol).toBe(Rol.COMERCIO_STAFF);
      expect(datos.comercioId).toBe(comercioId);
      expect(datos.passwordHash).not.toBe('Segura123!');
      expect(datos).not.toHaveProperty('password');
    });

    it('no debería dejar tocar a un miembro de otro comercio', async () => {
      usersRepo.findById.mockResolvedValue({ comercioId: new Types.ObjectId() } as never);

      await expect(
        service.actualizarMiembroEquipo(comercioId, 'u1', 'yo', { puesto: 'X' }),
      ).rejects.toThrow('Miembro no encontrado en tu equipo');
    });

    it('no debería permitir que alguien se desactive a sí mismo', async () => {
      usersRepo.findById.mockResolvedValue({ comercioId: { toString: () => comercioId } } as never);

      await expect(
        service.actualizarMiembroEquipo(comercioId, 'yo', 'yo', { activo: false }),
      ).rejects.toThrow('No puedes desactivarte a ti mismo');
    });

    it('debería actualizar puesto y permisos de un miembro propio', async () => {
      usersRepo.findById.mockResolvedValue({ comercioId: { toString: () => comercioId } } as never);
      usersRepo.actualizarAdmin.mockResolvedValue({ _id: 'u1', puesto: 'Recepción' } as never);

      const res = await service.actualizarMiembroEquipo(comercioId, 'u1', 'yo', {
        puesto: 'Recepción', permisosComercio: ['reservas'],
      });

      expect(res).toEqual({ _id: 'u1', puesto: 'Recepción' });
    });

    it('no debería permitir que alguien se elimine a sí mismo', async () => {
      await expect(service.eliminarMiembroEquipo(comercioId, 'yo', 'yo'))
        .rejects.toThrow('No puedes eliminarte a ti mismo');
    });

    it('solo debería poder eliminar miembros con rol de staff', async () => {
      usersRepo.findById.mockResolvedValue({
        comercioId: { toString: () => comercioId }, rol: Rol.COMERCIO_ADMIN,
      } as never);

      await expect(service.eliminarMiembroEquipo(comercioId, 'u1', 'yo'))
        .rejects.toThrow('Solo puedes eliminar miembros con rol de staff');

      expect(usersRepo.eliminar).not.toHaveBeenCalled();
    });

    it('debería eliminar a un miembro staff del propio comercio', async () => {
      usersRepo.findById.mockResolvedValue({
        comercioId: { toString: () => comercioId }, rol: Rol.COMERCIO_STAFF,
      } as never);

      await service.eliminarMiembroEquipo(comercioId, 'u1', 'yo');

      expect(usersRepo.eliminar).toHaveBeenCalledWith('u1');
    });
  });

  describe('cambiarEstadoServicio', () => {
    const comercioId = new Types.ObjectId().toString();
    const servicioId = new Types.ObjectId().toString();

    const mockServicioActual = (doc: unknown) => {
      servicioModel.findOne = jest.fn().mockReturnValue({
        lean: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue(doc),
      });
    };

    beforeEach(() => {
      // Publicar exige el alta cerrada; los casos de este bloque prueban otra
      // cosa, así que parten de un comercio que ya la terminó.
      repo.findById.mockResolvedValue({ altaCompletada: true } as never);
    });

    it('no debería dejar publicar con el alta guiada a medias', async () => {
      // Publicaría en el buscador una ficha sin contacto ni condiciones
      // aceptadas, que es justo lo que la pantalla del alta promete evitar.
      mockServicioActual({ vertical: 'peluqueria' });
      repo.findById.mockResolvedValue({ altaCompletada: false } as never);

      await expect(service.cambiarEstadoServicio(servicioId, comercioId, 'publicado'))
        .rejects.toThrow('Termina el alta de tu negocio');
    });

    it('debería dejar pausar aunque el alta esté a medias', async () => {
      // Pausar sólo retira algo de la vista: bloquearlo no protege a nadie.
      mockServicioActual({ vertical: 'peluqueria' });
      repo.findById.mockResolvedValue({ altaCompletada: false } as never);
      servicioModel.findOneAndUpdate = jest.fn().mockReturnValue({
        exec: jest.fn().mockResolvedValue({ _id: servicioId }),
      });

      await expect(service.cambiarEstadoServicio(servicioId, comercioId, 'pausado')).resolves.toBeDefined();
    });

    /** Una ficha sin fotos ya no se publica; las pruebas de otra cosa las traen. */
    const FOTOS_OK = ['/1.jpg', '/2.jpg', '/3.jpg', '/4.jpg', '/5.jpg'];

    it('debería impedir publicar una ficha con menos de cinco fotos', async () => {
      // En un marketplace de reservas la foto es el producto: con dos no se ve
      // el sitio y la ficha no la reserva nadie.
      mockServicioActual({ vertical: 'peluqueria', cuposDisponibles: 3, imagenes: ['/1.jpg', '/2.jpg'] });

      await expect(service.cambiarEstadoServicio(servicioId, comercioId, 'publicado'))
        .rejects.toThrow('al menos 5 fotos');
    });

    it('debería dejar pausar una ficha sin fotos suficientes', async () => {
      // La regla es para salir al buscador; retirarse de él nunca se bloquea.
      mockServicioActual({ vertical: 'peluqueria', cuposDisponibles: 3, imagenes: [] });
      servicioModel.findOneAndUpdate = jest.fn().mockReturnValue({
        exec: jest.fn().mockResolvedValue({ _id: servicioId }),
      });

      await expect(service.cambiarEstadoServicio(servicioId, comercioId, 'pausado'))
        .resolves.toBeDefined();
    });

    it('debería lanzar 404 si el servicio no es de ese comercio', async () => {
      mockServicioActual(null);

      await expect(service.cambiarEstadoServicio(servicioId, comercioId, 'publicado'))
        .rejects.toThrow('Servicio no encontrado');
    });

    it('debería rellenar las plazas al publicar un listado con el contador a cero', async () => {
      // Publicar con el contador a cero dejaba el listado invisible en la web
      // pese a figurar como publicado en el panel.
      mockServicioActual({
        vertical: 'peluqueria', cuposDisponibles: 0, capacidadSimultanea: 3, imagenes: FOTOS_OK,
      });
      servicioModel.findOneAndUpdate = jest.fn().mockReturnValue({
        exec: jest.fn().mockResolvedValue({ _id: servicioId }),
      });

      await service.cambiarEstadoServicio(servicioId, comercioId, 'publicado');

      const cambios = servicioModel.findOneAndUpdate!.mock.calls[0][1];
      expect(cambios).toEqual({ estado: 'publicado', cuposDisponibles: 3 });
    });

    it('no debería tocar un contador que ya tiene plazas', async () => {
      mockServicioActual({
        vertical: 'peluqueria', cuposDisponibles: 5, capacidadSimultanea: 3, imagenes: FOTOS_OK,
      });
      servicioModel.findOneAndUpdate = jest.fn().mockReturnValue({
        exec: jest.fn().mockResolvedValue({ _id: servicioId }),
      });

      await service.cambiarEstadoServicio(servicioId, comercioId, 'publicado');

      expect(servicioModel.findOneAndUpdate!.mock.calls[0][1]).toEqual({ estado: 'publicado' });
    });

    it('no debería deducir plazas al pausar', async () => {
      mockServicioActual({ vertical: 'peluqueria', cuposDisponibles: 0, capacidadSimultanea: 3 });
      servicioModel.findOneAndUpdate = jest.fn().mockReturnValue({
        exec: jest.fn().mockResolvedValue({ _id: servicioId }),
      });

      await service.cambiarEstadoServicio(servicioId, comercioId, 'pausado');

      expect(servicioModel.findOneAndUpdate!.mock.calls[0][1]).toEqual({ estado: 'pausado' });
    });

    it('debería lanzar 404 si el servicio desaparece antes de escribir', async () => {
      mockServicioActual({ vertical: 'peluqueria' });
      servicioModel.findOneAndUpdate = jest.fn().mockReturnValue({
        exec: jest.fn().mockResolvedValue(null),
      });

      await expect(service.cambiarEstadoServicio(servicioId, comercioId, 'pausado'))
        .rejects.toThrow('Servicio no encontrado');
    });
  });

  /**
   * Los datos fiscales son opcionales al registrarse y se completan luego desde
   * el panel, pero `vatNumber` no estaba declarado en el DTO: no había forma de
   * aportarlos y el paso "Datos fiscales (CIF/NIF)" se quedaba pendiente.
   */
  describe('datos fiscales desde el panel', () => {
    const comercioId = new Types.ObjectId().toString();

    beforeEach(() => {
      repo.actualizar.mockResolvedValue({ _id: comercioId } as never);
      repo.findByVatNumber.mockResolvedValue(null);
    });

    it('debería guardar razón social y CIF', async () => {
      await service.actualizarComercio(comercioId, {
        razonSocial: 'Villa Perruna S.L.',
        vatNumber: 'B12345678',
      } as never);

      expect(repo.actualizar).toHaveBeenCalledWith(
        comercioId,
        expect.objectContaining({ razonSocial: 'Villa Perruna S.L.', vatNumber: 'B12345678' }),
      );
    });

    it('debería rechazar un CIF que ya usa otro comercio', async () => {
      repo.findByVatNumber.mockResolvedValue({ id: 'otro-comercio' } as never);

      await expect(
        service.actualizarComercio(comercioId, { vatNumber: 'B12345678' } as never),
      ).rejects.toThrow('Ya existe un comercio con ese identificador fiscal');
      expect(repo.actualizar).not.toHaveBeenCalled();
    });

    it('debería dejar guardar su propio CIF sin cambios', async () => {
      repo.findByVatNumber.mockResolvedValue({ id: comercioId } as never);

      await service.actualizarComercio(comercioId, { vatNumber: 'B12345678' } as never);

      expect(repo.actualizar).toHaveBeenCalled();
    });
  });

});
