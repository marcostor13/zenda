import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { Types } from 'mongoose';
import { AdminService } from './admin.service';
import { ComisionConfigRepository } from '../comision-configs/comision-config.repository';
import { AlphaRepository } from '../alpha/alpha.repository';
import { AuditoriaService } from '../auditoria/auditoria.service';
import { ComerciosRepository } from '../comercios/comercios.repository';
import { ComercioCuentaService } from '../comercios/comercio-cuenta.service';
import { UsersRepository } from '../users/users.repository';
import { Pago } from '../payments/pago.schema';
import { Reserva } from '../bookings/reserva.schema';
import { Usuario } from '../users/usuario.schema';
import { Comercio } from '../comercios/comercio.schema';
import { Perro } from '../perros/perro.schema';
import { Resena } from '../reviews/resena.schema';
import { Incidencia } from '../incidencias/incidencia.schema';
import { Servicio } from '../catalog/servicio.schema';
import { Evento } from '../eventos/evento.schema';
import { VerticalKey, PagoEstado, IVA_RATE, MotivoBajaComercio, Rol } from 'shared';

describe('AdminService', () => {
  let service: AdminService;
  let comisionConfigRepo: jest.Mocked<ComisionConfigRepository>;
  let alphaRepo: jest.Mocked<AlphaRepository>;
  let pagoModel: any;
  let reservaModel: any;
  let comercioModel: any;
  let perroModel: any;
  let usuarioModel: any;
  let servicioModel: any;
  let auditoria: { registrar: jest.Mock; listar: jest.Mock };
  let comerciosRepo: any;
  let cuentaComercio: any;
  let usersRepo: any;

  const pagosMock = [
    {
      reservaId: { toString: () => 'res-1' },
      montoTotal: 590,
      montoSubtotal: 500,
      ivaMonto: 90,
      comisionPlataforma: 75,   // 500 × 15%
      stripeFee: 18.21,          // 590 × 2.9% + 1.1
      montoLiquidacion: 496.79,
      estado: PagoEstado.APROBADO,
    },
    {
      reservaId: { toString: () => 'res-2' },
      montoTotal: 295,
      montoSubtotal: 250,
      ivaMonto: 45,
      comisionPlataforma: 37.5,
      stripeFee: 9.66,
      montoLiquidacion: 247.84,
      estado: PagoEstado.APROBADO,
    },
  ];

  const reservasMock = [
    { _id: { toString: () => 'res-1' }, vertical: VerticalKey.ALOJAMIENTO, comercioId: { toString: () => 'comercio-1' } },
    { _id: { toString: () => 'res-2' }, vertical: VerticalKey.ALOJAMIENTO, comercioId: { toString: () => 'comercio-1' } },
  ];

  beforeEach(async () => {
    reservaModel = {
      find: jest.fn().mockReturnValue({
        sort: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        select: jest.fn().mockReturnThis(),
        populate: jest.fn().mockReturnThis(),
        lean: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue(reservasMock),
      }),
      // Distintos filtros devuelven distintos conteos: total 100, del mes 10, canceladas 2.
      countDocuments: jest.fn().mockImplementation((filtro: any = {}) => ({
        exec: jest.fn().mockResolvedValue(filtro.estado ? 2 : filtro.createdAt ? 10 : 100),
      })),
      aggregate: jest.fn().mockReturnValue({
        exec: jest.fn().mockResolvedValue([{ monto: 2350, count: 4 }]),
      }),
      findByIdAndUpdate: jest.fn().mockReturnValue({
        exec: jest.fn().mockResolvedValue({ _id: 'r1', estado: 'reembolsada' }),
      }),
      distinct: jest.fn().mockReturnValue({ exec: jest.fn().mockResolvedValue(['u1', 'u2', 'u3']) }),
    };

    pagoModel = {
      find: jest.fn().mockReturnValue({
        select: jest.fn().mockReturnThis(),
        lean: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue(pagosMock),
      }),
      aggregate: jest.fn().mockReturnValue({
        exec: jest.fn().mockResolvedValue([{ gmv: 885, ingresos: 112.5 }]),
      }),
      countDocuments: jest.fn().mockReturnValue({ exec: jest.fn().mockResolvedValue(7) }),
    };

    comercioModel = {
      countDocuments: jest.fn().mockReturnValue({ exec: jest.fn().mockResolvedValue(3) }),
      find: jest.fn().mockReturnValue({
        select: jest.fn().mockReturnThis(),
        lean: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue([
          { _id: { toString: () => 'comercio-1' }, nombreComercial: 'Comercio Test' },
        ]),
      }),
    };

    usuarioModel = {
      countDocuments: jest.fn().mockReturnValue({ exec: jest.fn().mockResolvedValue(5) }),
      find: jest.fn(),
    };

    perroModel = {
      countDocuments: jest.fn().mockReturnValue({ exec: jest.fn().mockResolvedValue(42) }),
    };

    auditoria = { registrar: jest.fn(), listar: jest.fn() };

    comerciosRepo = {
      listar: jest.fn().mockResolvedValue([]),
      listarPaginado: jest.fn().mockResolvedValue({ items: [], total: 0 }),
      findById: jest.fn(),
      crear: jest.fn().mockImplementation((datos: unknown) => Promise.resolve(datos)),
      actualizar: jest.fn(),
      eliminar: jest.fn().mockResolvedValue(undefined),
    };

    cuentaComercio = {
      darDeBaja: jest.fn().mockResolvedValue({ comercioId: 'c1', purgado: false }),
      impacto: jest.fn().mockResolvedValue({ puedeDarseDeBaja: true }),
      restaurar: jest.fn().mockResolvedValue({ _id: 'c1' }),
    };

    usersRepo = {
      contarTodos: jest.fn().mockResolvedValue(0),
      findById: jest.fn(),
      crear: jest.fn().mockImplementation((datos: unknown) => Promise.resolve(datos)),
      actualizarAdmin: jest.fn(),
      eliminar: jest.fn().mockResolvedValue(undefined),
    };

    servicioModel = {
      countDocuments: jest.fn().mockReturnValue({ exec: jest.fn().mockResolvedValue(0) }),
      find: jest.fn().mockReturnValue({
        select: jest.fn().mockReturnThis(),
        lean: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue([]),
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AdminService,
        {
          provide: ComisionConfigRepository,
          useValue: {
            listarTodas: jest.fn().mockResolvedValue([]),
            upsert: jest.fn().mockResolvedValue({ vertical: VerticalKey.ALOJAMIENTO, comisionPct: 0.18 }),
          },
        },
        {
          provide: AlphaRepository,
          useValue: {
            listarNiveles: jest.fn().mockResolvedValue([]),
            upsert: jest.fn().mockResolvedValue({ nivel: 2, nombre: 'Alpha 2' }),
          },
        },
        {
          provide: ComerciosRepository,
          useValue: comerciosRepo,
        },
        {
          provide: ComercioCuentaService,
          useValue: cuentaComercio,
        },
        {
          provide: UsersRepository,
          useValue: usersRepo,
        },
        { provide: AuditoriaService, useValue: auditoria },
        { provide: getModelToken(Pago.name), useValue: pagoModel },
        { provide: getModelToken(Reserva.name), useValue: reservaModel },
        { provide: getModelToken(Usuario.name), useValue: usuarioModel },
        { provide: getModelToken(Comercio.name), useValue: comercioModel },
        { provide: getModelToken(Perro.name), useValue: perroModel },
        // Las fichas administrativas consultan reseñas, incidencias y servicios.
        { provide: getModelToken(Resena.name), useValue: { countDocuments: jest.fn().mockReturnValue({ exec: jest.fn().mockResolvedValue(0) }), aggregate: jest.fn().mockReturnValue({ exec: jest.fn().mockResolvedValue([]) }) } },
        { provide: getModelToken(Incidencia.name), useValue: { countDocuments: jest.fn().mockReturnValue({ exec: jest.fn().mockResolvedValue(0) }) } },
        { provide: getModelToken(Servicio.name), useValue: servicioModel },
        // El embudo de la analítica cuenta sesiones en la colección de eventos.
        { provide: getModelToken(Evento.name), useValue: { distinct: jest.fn().mockReturnValue({ exec: jest.fn().mockResolvedValue([]) }) } },
      ],
    }).compile();

    service = module.get<AdminService>(AdminService);
    comisionConfigRepo = module.get(ComisionConfigRepository);
    alphaRepo = module.get(AlphaRepository);
  });

  describe('generarReporteFinanciero', () => {
    const filtros = {
      fechaDesde: new Date('2025-01-01'),
      fechaHasta: new Date('2025-01-31'),
    };

    it('debería sumar GMV, ingresos plataforma, costos Stripe y liquidaciones', async () => {
      const reporte = await service.generarReporteFinanciero(filtros);

      expect(reporte.gmv).toBeCloseTo(885, 1); // 590 + 295
      expect(reporte.ingresosPlataforma).toBeCloseTo(112.5, 1); // 75 + 37.5
      expect(reporte.costoStripe).toBeCloseTo(27.87, 1); // 18.21 + 9.66
      expect(reporte.margenNetoPlataforma).toBeCloseTo(84.63, 1); // ingresos - stripe
      expect(reporte.totalReservas).toBe(2);
    });

    it('debería agrupar por vertical correctamente', async () => {
      const reporte = await service.generarReporteFinanciero(filtros);
      const hoteles = reporte.porVertical.find((v) => v.vertical === VerticalKey.ALOJAMIENTO);

      expect(hoteles).toBeDefined();
      expect(hoteles!.totalReservas).toBe(2);
    });

    it('debería reportar ajustes de precio por comercio (Ref. S11)', async () => {
      reservaModel.find.mockReturnValue({
        sort: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        select: jest.fn().mockReturnThis(),
        populate: jest.fn().mockReturnThis(),
        lean: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue([
          { _id: { toString: () => 'res-1' }, vertical: VerticalKey.ALOJAMIENTO, comercioId: { toString: () => 'comercio-1' }, suplementos: [{ monto: 15 }] },
          { _id: { toString: () => 'res-2' }, vertical: VerticalKey.ALOJAMIENTO, comercioId: { toString: () => 'comercio-1' }, suplementos: [] },
        ]),
      });

      const reporte = await service.generarReporteFinanciero(filtros);

      expect(reporte.totalReservasConAjuste).toBe(1);
      expect(reporte.importeTotalAjustes).toBeCloseTo(15, 2);
      expect(reporte.ajustesPorComercio).toEqual([
        {
          comercioId: 'comercio-1', comercioNombre: 'Comercio Test',
          totalReservas: 2, reservasConAjuste: 1, importeAjustes: 15, porcentajeConAjuste: 50,
        },
      ]);
    });

    it('no debería listar comercios sin ningún ajuste', async () => {
      const reporte = await service.generarReporteFinanciero(filtros);
      expect(reporte.ajustesPorComercio).toEqual([]);
      expect(reporte.totalReservasConAjuste).toBe(0);
    });
  });

  describe('listarReservas', () => {
    /** Filtro con el que se consultó la colección de reservas. */
    const filtroUsado = (): Record<string, any> => reservaModel.find.mock.calls.at(-1)![0];

    it('debería consultar sin condiciones cuando no se filtra nada', async () => {
      await service.listarReservas(1, 20);

      expect(filtroUsado()).toEqual({});
    });

    it('debería filtrar por vertical, estado e importe', async () => {
      await service.listarReservas(1, 20, {
        estado: 'confirmada',
        vertical: VerticalKey.PELUQUERIA,
        importeMin: 50,
        importeMax: 200,
      });

      expect(filtroUsado()).toMatchObject({
        estado: 'confirmada',
        vertical: VerticalKey.PELUQUERIA,
        montoTotal: { $gte: 50, $lte: 200 },
      });
    });

    it('debería aplicar sólo el extremo declarado del rango de importe', async () => {
      await service.listarReservas(1, 20, { importeMin: 50 });

      expect(filtroUsado()['montoTotal']).toEqual({ $gte: 50 });
    });

    it('debería resolver la ciudad por el servicio, que es donde vive la ubicación', async () => {
      servicioModel.find.mockReturnValue({
        select: jest.fn().mockReturnThis(),
        lean: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue([{ _id: 'srv-1' }, { _id: 'srv-2' }]),
      });

      await service.listarReservas(1, 20, { ciudad: 'Madrid' });

      expect(filtroUsado()['servicioId']).toEqual({ $in: ['srv-1', 'srv-2'] });
    });

    it('debería resolver el estado del pago por la colección de pagos', async () => {
      pagoModel.find.mockReturnValue({
        select: jest.fn().mockReturnThis(),
        lean: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue([{ reservaId: 'res-1' }]),
      });

      await service.listarReservas(1, 20, { estadoPago: PagoEstado.REEMBOLSADO });

      expect(pagoModel.find).toHaveBeenCalledWith({ estado: PagoEstado.REEMBOLSADO });
      expect(filtroUsado()['_id']).toEqual({ $in: ['res-1'] });
    });

    it('debería buscar por código, cliente o comercio sin tratar el punto como comodín', async () => {
      usuarioModel.find.mockReturnValue({
        select: jest.fn().mockReturnThis(),
        lean: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue([{ _id: 'u1' }]),
      });
      comercioModel.find = jest.fn().mockReturnValue({
        select: jest.fn().mockReturnThis(),
        lean: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue([]),
      });

      await service.listarReservas(1, 20, { buscar: 'ana.perez@correo.com' });

      const condiciones = filtroUsado()['$or'];
      expect(condiciones).toHaveLength(2); // código + usuarios encontrados
      expect(condiciones[0].codigo.source).toContain('ana\\.perez');
    });

    it('debería exponer la política de cancelación del servicio y, si no la tiene, la del comercio', async () => {
      reservaModel.find.mockReturnValue({
        sort: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        populate: jest.fn().mockReturnThis(),
        lean: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue([
          {
            _id: 'r1', codigo: 'RES-1', vertical: VerticalKey.ALOJAMIENTO,
            servicioId: { titulo: 'Villa Canina', politicaCancelacion: 'Gratis hasta 48 h antes' },
            comercioId: { nombreComercial: 'Royal Dog', politicaCancelacion: 'estricta' },
          },
          {
            _id: 'r2', codigo: 'RES-2', vertical: VerticalKey.PELUQUERIA,
            servicioId: { titulo: 'Estilo Canino' },
            comercioId: { nombreComercial: 'Groomer', politicaCancelacion: 'moderada' },
          },
        ]),
      });
      pagoModel.find.mockReturnValue({
        select: jest.fn().mockReturnThis(),
        lean: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue([]),
      });

      const { items } = await service.listarReservas(1, 20);

      expect(items[0]['politicaCancelacion']).toBe('Gratis hasta 48 h antes');
      expect(items[1]['politicaCancelacion']).toBe('moderada');
      // Sin pago registrado, la reserva no se queda sin estado.
      expect(items[0]['estadoPago']).toBe('sin_pago');
    });
  });

  describe('obtenerDashboard', () => {
    it('debería exponer las métricas nuevas (nuevos comercios, mascotas)', async () => {
      const dashboard = await service.obtenerDashboard();

      expect(dashboard.kpis.nuevosComerciosMes).toBe(3);
      expect(dashboard.kpis.mascotasRegistradas).toBe(42);
    });

    it('debería calcular la tasa de cancelación del mes (canceladas/total × 100)', async () => {
      const dashboard = await service.obtenerDashboard();
      // 2 canceladas sobre 10 reservas del mes = 20 %
      expect(dashboard.kpis.tasaCancelacionMes).toBe(20);
    });

    it('debería exponer el monto y conteo de pagos retenidos', async () => {
      const dashboard = await service.obtenerDashboard();
      expect(dashboard.kpis.pagosRetenidosMonto).toBe(2350);
      expect(dashboard.kpis.pagosRetenidosCount).toBe(4);
    });
  });

  describe('obtenerAnalitica', () => {
    it('debería calcular distribución por vertical con porcentajes y el embudo', async () => {
      reservaModel.aggregate
        .mockReturnValueOnce({ exec: jest.fn().mockResolvedValue([
          { _id: 'veterinaria', reservas: 6, facturacion: 600, comision: 90, comercios: ['c1', 'c2'] },
          { _id: 'peluqueria', reservas: 4, facturacion: 200, comision: 30, comercios: ['c3'] },
        ]) })
        .mockReturnValueOnce({ exec: jest.fn().mockResolvedValue([
          { _id: 'Madrid', reservas: 8, facturacion: 700, comercios: ['c1'] },
          { _id: null, reservas: 2, facturacion: 100, comercios: [] },
        ]) });
      pagoModel.aggregate
        .mockReturnValueOnce({ exec: jest.fn().mockResolvedValue([{ nombre: 'VilaCan', reservas: 5, facturacion: 900, valoracion: 4.8 }]) })
        .mockReturnValueOnce({ exec: jest.fn().mockResolvedValue([{ facturacion: 900, comision: 135, pagos: 9 }]) });

      const analitica = await service.obtenerAnalitica();

      expect(analitica.porVertical[0]).toEqual({
        vertical: 'veterinaria', reservas: 6, porcentaje: 60, facturacion: 600, comision: 90, comercios: 2,
      });
      // Descarta la ciudad nula y cuenta comercios distintos por ciudad.
      expect(analitica.porCiudad).toEqual([{ ciudad: 'Madrid', reservas: 8, comercios: 1, facturacion: 700 }]);
      expect(analitica.topComercios[0]).toEqual({ comercio: 'VilaCan', reservas: 5, facturacion: 900, valoracion: 4.8 });
      // Búsquedas y visitas a ficha salen de la colección de eventos (TCK-8031 §3).
      expect(analitica.embudo).toEqual({
        registrados: 0, busquedas: 0, visitasFicha: 0,
        conReserva: 3, pagaron: 7, completaron: 2,
      });
      // Ticket medio = facturación aprobada / pagos aprobados.
      expect(analitica.kpis.ticketMedio).toBe(100);
    });
  });

  describe('crearUsuario', () => {
    it('debería rechazar un usuario de comercio sin comercioId asociado', async () => {
      await expect(
        service.crearUsuario({ nombre: 'X', email: 'x@x.com', password: '123', rol: Rol.COMERCIO_ADMIN }),
      ).rejects.toThrow(/comercioId/i);
    });
  });

  describe('cambiarEstadoReserva', () => {
    it('debería rechazar un estado no permitido para el admin', async () => {
      await expect(service.cambiarEstadoReserva('r1', 'pendiente', 'admin-1')).rejects.toThrow(
        /no permitido/i,
      );
    });

    it('debería actualizar el estado y registrar la transición en el historial', async () => {
      await service.cambiarEstadoReserva('r1', 'reembolsada', 'admin-1', 'Cliente no atendido');
      expect(reservaModel.findByIdAndUpdate).toHaveBeenCalledWith(
        'r1',
        expect.objectContaining({
          estado: 'reembolsada',
          $push: expect.objectContaining({
            historialEstados: expect.objectContaining({ estado: 'reembolsada', motivo: 'Cliente no atendido', por: 'admin:admin-1' }),
          }),
        }),
        { new: true },
      );
    });
  });

  describe('actualizarComision', () => {
    it('debería delegar al repositorio con los datos correctos', async () => {
      const dto = {
        vertical: VerticalKey.ALOJAMIENTO as any,
        comisionPct: 0.18,
        stripePct: 0.029,
        stripeFijoEur: 1.1,
        activo: true,
      };

      await service.actualizarComision(dto, 'admin-1');

      expect(comisionConfigRepo.upsert).toHaveBeenCalledWith(
        VerticalKey.ALOJAMIENTO,
        expect.objectContaining({ comisionPct: 0.18 }),
        'admin-1',
      );
    });
  });

  describe('actualizarNivelAlpha', () => {
    it('debería delegar al repositorio Alpha con los datos correctos', async () => {
      const dto = { nivel: 2, nombre: 'Alpha 2', reservasRequeridas: 5, descuentoPct: 0.05, beneficios: ['x'] };

      await service.actualizarNivelAlpha(dto, 'admin-1');

      expect(alphaRepo.upsert).toHaveBeenCalledWith(
        2,
        expect.objectContaining({ nombre: 'Alpha 2', reservasRequeridas: 5, descuentoPct: 0.05 }),
        'admin-1',
      );
    });

    it('debería dejar en la auditoría el tope y las categorías del descuento', async () => {
      await service.actualizarNivelAlpha({
        nivel: 3, nombre: 'ALPHA III', reservasRequeridas: 15, descuentoPct: 0.1, beneficios: [],
        descuentoMaximoEur: 20,
        verticalesAplicables: [VerticalKey.PELUQUERIA],
      }, 'admin-1');

      expect(auditoria.registrar).toHaveBeenCalledWith(
        expect.objectContaining({
          descripcion: expect.stringContaining('máximo 20 €'),
        }),
      );
      expect(auditoria.registrar.mock.calls.at(-1)![0].descripcion)
        .toContain('sólo en peluqueria');
    });

    it('no debería inventar límites en la auditoría cuando el nivel no los tiene', async () => {
      await service.actualizarNivelAlpha(
        { nivel: 1, nombre: 'ALPHA I', reservasRequeridas: 0, descuentoPct: 0, beneficios: [] },
        'admin-1',
      );

      const descripcion = auditoria.registrar.mock.calls.at(-1)![0].descripcion;
      expect(descripcion).not.toContain('máximo');
      expect(descripcion).not.toContain('sólo en');
    });
  });

  describe('listarNivelesAlpha', () => {
    it('debería delegar en el repositorio Alpha', async () => {
      await service.listarNivelesAlpha();
      expect(alphaRepo.listarNiveles).toHaveBeenCalled();
    });
  });

  // ── CRUD y fichas administrativas ──────────────────────────────────────────

  describe('comercios', () => {
    it('debería delegar el listado paginado con sus filtros', async () => {
      await service.listarComercios(2, 50, 'activo', 'canina', true);

      expect(comerciosRepo.listarPaginado).toHaveBeenCalledWith(
        { estado: 'activo', buscar: 'canina', alphaAdherido: true },
        2,
        50,
      );
    });

    it('debería usar la primera página y 20 elementos por defecto', async () => {
      await service.listarComercios();

      expect(comerciosRepo.listarPaginado).toHaveBeenCalledWith(
        { estado: undefined, buscar: undefined, alphaAdherido: undefined },
        1,
        20,
      );
    });

    it('debería contar los comercios por estado, dejando los dados de baja fuera del total', async () => {
      comercioModel.countDocuments = jest.fn().mockImplementation((filtro: any = {}) => ({
        exec: jest.fn().mockResolvedValue(
          filtro.estado === 'activo' ? 7
            : filtro.estado === 'pendiente' ? 3
            : filtro.estado === 'suspendido' ? 1
            : filtro.estado === 'inactivo' ? 2
            : filtro.estado === 'eliminado' ? 4
            : 11,
        ),
      }));

      const resumen = await service.resumenComercios();

      expect(resumen).toEqual({
        total: 11, activos: 7, pendientes: 3, suspendidos: 1, enPausa: 2, dadosDeBaja: 4,
      });
      // El total pide explícitamente los vivos, no la colección entera.
      expect(comercioModel.countDocuments).toHaveBeenCalledWith({ estado: { $ne: 'eliminado' } });
    });

    it('debería crear el comercio activo si no se indica estado', async () => {
      await service.crearComercio({
        razonSocial: 'Canina SL', vatNumber: 'ESB12345678', nombreComercial: 'Canina',
      });

      expect(comerciosRepo.crear).toHaveBeenCalledWith(
        expect.objectContaining({ nombreComercial: 'Canina', estado: 'activo' }),
      );
    });

    it('debería respetar el estado indicado al crear', async () => {
      await service.crearComercio({
        razonSocial: 'Canina SL', vatNumber: 'ESB12345678', nombreComercial: 'Canina',
        estado: 'pendiente' as never,
      });

      expect(comerciosRepo.crear).toHaveBeenCalledWith(
        expect.objectContaining({ estado: 'pendiente' }),
      );
    });

    it('debería devolver el comercio actualizado', async () => {
      comerciosRepo.actualizar.mockResolvedValue({ _id: 'c1', nombreComercial: 'Nuevo' });

      const res = await service.actualizarComercio('c1', { nombreComercial: 'Nuevo' });

      expect(res).toEqual({ _id: 'c1', nombreComercial: 'Nuevo' });
    });

    it('debería lanzar 404 al actualizar un comercio que no existe', async () => {
      comerciosRepo.actualizar.mockResolvedValue(null);

      await expect(service.actualizarComercio('no-existe', { plan: 'pro' as never }))
        .rejects.toThrow('Comercio no encontrado');
    });

    it('debería dar de baja delegando la cascada en ComercioCuentaService', async () => {
      await service.eliminarComercio('c1', { comentario: 'datos de prueba' }, 'admin1');

      expect(cuentaComercio.darDeBaja).toHaveBeenCalledWith('c1', {
        motivo: MotivoBajaComercio.OTRO,
        comentario: 'datos de prueba',
        purgar: undefined,
        origen: 'admin',
        actorId: 'admin1',
      });
      // Nunca el borrado a pelo: dejaba vivos listados y cuentas del equipo.
      expect(comerciosRepo.eliminar).not.toHaveBeenCalled();
    });

    it('debería propagar la purga cuando el admin la pide', async () => {
      await service.eliminarComercio('c1', { purgar: true }, 'admin1');

      expect(cuentaComercio.darDeBaja).toHaveBeenCalledWith(
        'c1',
        expect.objectContaining({ purgar: true }),
      );
    });

    it('debería impedir fijar el estado eliminado desde la edición del comercio', async () => {
      await expect(
        service.actualizarComercio('c1', { estado: 'eliminado' as never }),
      ).rejects.toThrow('DELETE /admin/comercios/:id');
    });
  });

  describe('usuarios', () => {
    it('debería contar usuarios por rol y los altas del mes', async () => {
      usuarioModel.countDocuments = jest.fn().mockImplementation((filtro: any = {}) => ({
        exec: jest.fn().mockResolvedValue(
          filtro.rol === 'cliente' ? 40
            : filtro.rol?.$in ? 8
            : filtro.rol === 'admin' ? 2
            : filtro.createdAt ? 6
            : 50,
        ),
      }));

      const resumen = await service.resumenUsuarios();

      expect(resumen).toEqual({ total: 50, clientes: 40, comercios: 8, administradores: 2, nuevosMes: 6 });
    });

    it('debería exigir comercioId al crear un usuario de comercio', async () => {
      await expect(
        service.crearUsuario({
          nombre: 'Staff', email: 's@c.com', password: 'Segura123!', rol: 'comercio_admin' as never,
        }),
      ).rejects.toThrow('requiere un comercioId');

      expect(usersRepo.crear).not.toHaveBeenCalled();
    });

    it('debería guardar la contraseña hasheada, nunca en claro', async () => {
      await service.crearUsuario({ nombre: 'Ana', email: 'a@a.com', password: 'Segura123!' });

      const datos = usersRepo.crear.mock.calls[0][0];
      expect(datos.passwordHash).toEqual(expect.any(String));
      expect(datos.passwordHash).not.toBe('Segura123!');
      expect(datos).not.toHaveProperty('password');
      expect(datos.rol).toBe('cliente');
    });

    it('debería lanzar 404 al actualizar un usuario que no existe', async () => {
      usersRepo.findById.mockResolvedValue(null);
      usersRepo.actualizarAdmin.mockResolvedValue(null);

      await expect(service.actualizarUsuario('no-existe', { nombre: 'X' }))
        .rejects.toThrow('Usuario no encontrado');
    });

    it('debería registrar en auditoría quién modificó la cuenta y qué cambió', async () => {
      usersRepo.findById.mockResolvedValue({ nombre: 'Ana', rol: 'cliente', verificado: false });
      usersRepo.actualizarAdmin.mockResolvedValue({ nombre: 'Ana', rol: 'admin' });

      await service.actualizarUsuario('u1', { rol: 'admin' as never }, 'admin-1');

      expect(auditoria.registrar).toHaveBeenCalledWith(
        expect.objectContaining({
          actorId: 'admin-1',
          entidadId: 'u1',
          antes: { rol: 'cliente', verificado: false },
          despues: { rol: 'admin' },
        }),
      );
    });

    it('no debería registrar auditoría si la acción no viene de un admin identificado', async () => {
      usersRepo.findById.mockResolvedValue({ nombre: 'Ana' });
      usersRepo.actualizarAdmin.mockResolvedValue({ nombre: 'Ana' });

      await service.actualizarUsuario('u1', { nombre: 'Ana' });

      expect(auditoria.registrar).not.toHaveBeenCalled();
    });

    it('debería conservar en auditoría los datos del usuario eliminado', async () => {
      usersRepo.findById.mockResolvedValue({ nombre: 'Ana', email: 'a@a.com', rol: 'cliente' });

      await service.eliminarUsuario('u1', 'admin-1');

      expect(usersRepo.eliminar).toHaveBeenCalledWith('u1');
      expect(auditoria.registrar).toHaveBeenCalledWith(
        expect.objectContaining({
          entidadId: 'u1',
          antes: { nombre: 'Ana', email: 'a@a.com', rol: 'cliente' },
        }),
      );
    });

    it('debería eliminar aunque ya no queden datos previos que auditar', async () => {
      usersRepo.findById.mockResolvedValue(null);

      await service.eliminarUsuario('u1', 'admin-1');

      expect(usersRepo.eliminar).toHaveBeenCalledWith('u1');
      expect(auditoria.registrar).toHaveBeenCalledWith(
        expect.objectContaining({ descripcion: expect.stringContaining('un usuario') }),
      );
    });
  });

  describe('fichaUsuario', () => {
    it('debería lanzar 404 si la cuenta no existe', async () => {
      usersRepo.findById.mockResolvedValue(null);

      await expect(service.fichaUsuario(new Types.ObjectId().toString()))
        .rejects.toThrow('Usuario no encontrado');
    });

    it('debería reunir mascotas, reservas y gasto de un cliente', async () => {
      const id = new Types.ObjectId().toString();
      usersRepo.findById.mockResolvedValue({
        _id: id, nombre: 'Ana', email: 'a@a.com', rol: 'cliente', verificado: true,
      });
      perroModel.find = jest.fn().mockReturnValue({
        select: () => ({ lean: () => ({ exec: () => Promise.resolve([{ nombre: 'Nala', raza: 'Border' }]) }) }),
      });
      reservaModel.find.mockReturnValue({
        sort: jest.fn().mockReturnThis(), limit: jest.fn().mockReturnThis(),
        select: jest.fn().mockReturnThis(), lean: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue([
          { codigo: 'R1', estado: 'completada' }, { codigo: 'R2', estado: 'cancelada' },
        ]),
      });
      pagoModel.aggregate.mockReturnValue({
        exec: jest.fn().mockResolvedValue([{ total: 240.567, pagos: 3 }]),
      });

      const ficha: any = await service.fichaUsuario(id);

      expect(ficha.mascotas).toEqual([{ nombre: 'Nala', raza: 'Border' }]);
      expect(ficha.resumen.totalReservas).toBe(2);
      // Las canceladas cuentan como actividad pero no como servicio disfrutado.
      expect(ficha.resumen.canceladas).toBe(1);
      expect(ficha.resumen.totalGastado).toBe(240.57);
      expect(ficha.resumen.pagos).toBe(3);
    });

    it('no debería consultar mascotas ni reservas de una cuenta que no es cliente', async () => {
      const id = new Types.ObjectId().toString();
      usersRepo.findById.mockResolvedValue({ _id: id, nombre: 'Admin', rol: 'admin' });
      perroModel.find = jest.fn();

      const ficha: any = await service.fichaUsuario(id);

      expect(perroModel.find).not.toHaveBeenCalled();
      expect(ficha.mascotas).toEqual([]);
      expect(ficha.resumen.totalGastado).toBe(0);
    });

    it('debería adjuntar el comercio cuando la cuenta pertenece a uno', async () => {
      const id = new Types.ObjectId().toString();
      usersRepo.findById.mockResolvedValue({
        _id: id, nombre: 'Staff', rol: 'comercio_admin', comercioId: 'c1',
      });
      comerciosRepo.findById.mockResolvedValue({
        _id: 'c1', nombreComercial: 'Canina', estado: 'activo', plan: 'pro',
      });

      const ficha: any = await service.fichaUsuario(id);

      expect(ficha.comercio).toEqual({
        _id: 'c1', nombreComercial: 'Canina', estado: 'activo', plan: 'pro',
      });
    });
  });

  describe('fichaComercio', () => {
    it('debería lanzar 404 si el comercio no existe', async () => {
      comerciosRepo.findById.mockResolvedValue(null);

      await expect(service.fichaComercio(new Types.ObjectId().toString()))
        .rejects.toThrow('Comercio no encontrado');
    });

    it('debería redondear facturación, comisión y valoración media', async () => {
      const id = new Types.ObjectId().toString();
      comerciosRepo.findById.mockResolvedValue({
        _id: id, nombreComercial: 'Canina', razonSocial: 'Canina SL',
        vatNumber: 'ESB1', estado: 'activo', plan: 'pro', verticales: [],
      });
      servicioModel.countDocuments = jest.fn().mockReturnValue({ exec: jest.fn().mockResolvedValue(4) });
      reservaModel.find.mockReturnValue({
        sort: jest.fn().mockReturnThis(), limit: jest.fn().mockReturnThis(),
        select: jest.fn().mockReturnThis(), lean: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue([{ codigo: 'R1' }]),
      });
      pagoModel.aggregate.mockReturnValue({
        exec: jest.fn().mockResolvedValue([{ total: 1234.567, comision: 185.185 }]),
      });

      const ficha: any = await service.fichaComercio(id);

      expect(ficha.resumen.servicios).toBe(4);
      expect(ficha.resumen.facturacion).toBe(1234.57);
      expect(ficha.resumen.comision).toBe(185.19);
    });

    it('debería devolver ceros cuando el comercio no tiene actividad', async () => {
      const id = new Types.ObjectId().toString();
      comerciosRepo.findById.mockResolvedValue({ _id: id, nombreComercial: 'Nueva', verticales: [] });
      servicioModel.countDocuments = jest.fn().mockReturnValue({ exec: jest.fn().mockResolvedValue(0) });
      reservaModel.find.mockReturnValue({
        sort: jest.fn().mockReturnThis(), limit: jest.fn().mockReturnThis(),
        select: jest.fn().mockReturnThis(), lean: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue([]),
      });
      pagoModel.aggregate.mockReturnValue({ exec: jest.fn().mockResolvedValue([]) });

      const ficha: any = await service.fichaComercio(id);

      expect(ficha.resumen).toEqual(
        expect.objectContaining({ facturacion: 0, comision: 0, valoracion: 0, resenas: 0 }),
      );
    });
  });

  describe('listarUsuarios', () => {
    /** Filtro con el que se consultó la colección de usuarios. */
    const filtroUsado = (): Record<string, any> => usuarioModel.find.mock.calls.at(-1)![0];

    function mockUsuarios(items: any[]) {
      usuarioModel.find = jest.fn().mockReturnValue({
        sort: jest.fn().mockReturnThis(), skip: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(), lean: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue(items),
      });
      usuarioModel.countDocuments = jest.fn().mockReturnValue({
        exec: jest.fn().mockResolvedValue(items.length),
      });
    }

    it('debería consultar sin condiciones cuando no se filtra nada', async () => {
      mockUsuarios([]);

      await service.listarUsuarios();

      expect(filtroUsado()).toEqual({});
    });

    it('debería filtrar por rol y por estado de verificación', async () => {
      mockUsuarios([]);

      await service.listarUsuarios(1, 20, 'admin', undefined, false);

      expect(filtroUsado()).toEqual({ rol: 'admin', verificado: false });
    });

    it('debería buscar por nombre o email escapando la expresión regular', async () => {
      mockUsuarios([]);

      // Un punto sin escapar convertiría la búsqueda en un comodín.
      await service.listarUsuarios(1, 20, undefined, 'a.b');

      const filtro = filtroUsado();
      expect(filtro['$or']).toHaveLength(2);
      expect(filtro['$or'][0].nombre.source).toBe('a\\.b');
    });

    it('no debería calcular nivel Alpha si no hay ningún cliente en la página', async () => {
      mockUsuarios([{ _id: 'u1', rol: 'admin' }]);

      const res = await service.listarUsuarios();

      expect(res.items).toEqual([{ _id: 'u1', rol: 'admin' }]);
      // Alpha es fidelización de quien reserva: no se consulta para administración.
      expect(alphaRepo.listarNiveles).not.toHaveBeenCalled();
    });

    it('debería asignar a cada cliente su nivel según las reservas completadas', async () => {
      const cliente = new Types.ObjectId();
      mockUsuarios([{ _id: cliente, rol: 'cliente' }]);
      reservaModel.aggregate.mockResolvedValue([
        { _id: cliente, total: 9, completadas: 6 },
      ]);
      alphaRepo.listarNiveles.mockResolvedValue([
        { nivel: 1, nombre: 'Alpha 1', reservasRequeridas: 0 },
        { nivel: 2, nombre: 'Alpha 2', reservasRequeridas: 5 },
        { nivel: 3, nombre: 'Alpha 3', reservasRequeridas: 20 },
      ] as never);

      const res = await service.listarUsuarios();

      expect(res.items[0]).toEqual(
        expect.objectContaining({ reservas: 9, nivelAlpha: 'Alpha 2' }),
      );
    });

    it('debería dar el nivel más bajo a un cliente sin reservas completadas', async () => {
      const cliente = new Types.ObjectId();
      mockUsuarios([{ _id: cliente, rol: 'cliente' }]);
      reservaModel.aggregate.mockResolvedValue([]);
      alphaRepo.listarNiveles.mockResolvedValue([
        { nivel: 1, nombre: 'Alpha 1', reservasRequeridas: 0 },
        { nivel: 2, nombre: 'Alpha 2', reservasRequeridas: 5 },
      ] as never);

      const res = await service.listarUsuarios();

      expect(res.items[0]).toEqual(
        expect.objectContaining({ reservas: 0, nivelAlpha: 'Alpha 1' }),
      );
    });

    it('no debería poner nivel Alpha a las cuentas que no son de cliente', async () => {
      const cliente = new Types.ObjectId();
      mockUsuarios([{ _id: cliente, rol: 'cliente' }, { _id: new Types.ObjectId(), rol: 'admin' }]);
      reservaModel.aggregate.mockResolvedValue([]);
      alphaRepo.listarNiveles.mockResolvedValue([
        { nivel: 1, nombre: 'Alpha 1', reservasRequeridas: 0 },
      ] as never);

      const res = await service.listarUsuarios();

      expect(res.items[0]).toHaveProperty('nivelAlpha');
      expect(res.items[1]).not.toHaveProperty('nivelAlpha');
    });
  });

  describe('listarPagos', () => {
    function mockPagos(items: any[]) {
      pagoModel.find = jest.fn().mockReturnValue({
        sort: jest.fn().mockReturnThis(), skip: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(), populate: jest.fn().mockReturnThis(),
        lean: jest.fn().mockReturnThis(), exec: jest.fn().mockResolvedValue(items),
      });
      pagoModel.countDocuments = jest.fn().mockReturnValue({
        exec: jest.fn().mockResolvedValue(items.length),
      });
      comercioModel.find = jest.fn().mockReturnValue({
        select: jest.fn().mockReturnThis(), lean: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue([]),
      });
    }

    it('debería filtrar por estado del pago', async () => {
      mockPagos([]);

      await service.listarPagos(1, 20, { estado: 'aprobado' });

      expect(pagoModel.find).toHaveBeenCalledWith({ estado: 'aprobado' });
    });

    it('debería llegar al comercio a través de la reserva, porque el pago no lo guarda', async () => {
      mockPagos([]);
      const comercioId = new Types.ObjectId().toString();
      const reservaId = new Types.ObjectId();
      reservaModel.find.mockReturnValue({
        select: jest.fn().mockReturnThis(), lean: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue([{ _id: reservaId }]),
      });

      await service.listarPagos(1, 20, { comercioId });

      expect(pagoModel.find).toHaveBeenCalledWith({ reservaId: { $in: [reservaId] } });
    });

    it('debería buscar por código de reserva escapando la expresión regular', async () => {
      mockPagos([]);
      reservaModel.find.mockReturnValue({
        select: jest.fn().mockReturnThis(), lean: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue([]),
      });

      await service.listarPagos(1, 20, { buscar: 'RES-1.2' });

      const filtroReserva = reservaModel.find.mock.calls.at(-1)![0];
      expect(filtroReserva.codigo.source).toBe('RES-1\\.2');
    });

    it('debería aplanar el pago con el código y el comercio de su reserva', async () => {
      const comercioId = new Types.ObjectId();
      mockPagos([
        {
          _id: 'p1', montoTotal: 100, comisionPlataforma: 15, stripeFee: 3.15,
          montoLiquidacion: 81.85, estado: 'aprobado',
          reservaId: { codigo: 'RES-1', comercioId, vertical: 'alojamiento' },
        },
      ]);
      comercioModel.find = jest.fn().mockReturnValue({
        select: jest.fn().mockReturnThis(), lean: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue([{ _id: comercioId, nombreComercial: 'Canina' }]),
      });

      const res = await service.listarPagos();

      expect(res.items[0]).toEqual(
        expect.objectContaining({
          codigoReserva: 'RES-1', comercio: 'Canina', vertical: 'alojamiento', montoTotal: 100,
        }),
      );
    });

    it('no debería romperse si el pago perdió su reserva asociada', async () => {
      mockPagos([{ _id: 'p1', estado: 'aprobado', reservaId: undefined }]);

      const res = await service.listarPagos();

      expect(res.items[0]).toEqual(
        expect.objectContaining({ codigoReserva: '—', comercio: 'Comercio', montoTotal: 0 }),
      );
    });
  });

  describe('resumenPagos', () => {
    it('debería separar lo cobrado, lo reembolsado y lo pendiente de liquidar', async () => {
      pagoModel.aggregate = jest.fn().mockImplementation((pipeline: any[]) => ({
        exec: jest.fn().mockResolvedValue(
          pipeline[0].$match.estado === 'aprobado'
            ? [{ cobrado: 1000.555, comision: 150.111, stripe: 29.999, liquidacion: 820.4 }]
            : [{ cobrado: 50, comision: 0, stripe: 0, liquidacion: 0 }],
        ),
      }));
      reservaModel.aggregate.mockReturnValue({
        exec: jest.fn().mockResolvedValue([{ monto: 300.456 }]),
      });

      const resumen = await service.resumenPagos();

      expect(resumen).toEqual({
        cobrado: 1000.56,
        comisionDoogking: 150.11,
        costePasarela: 30,
        liquidadoComercios: 820.4,
        pendienteLiquidar: 300.46,
        reembolsado: 50,
      });
    });

    it('debería devolver ceros cuando todavía no hay pagos', async () => {
      pagoModel.aggregate = jest.fn().mockReturnValue({ exec: jest.fn().mockResolvedValue([]) });
      reservaModel.aggregate.mockReturnValue({ exec: jest.fn().mockResolvedValue([]) });

      const resumen = await service.resumenPagos();

      expect(resumen).toEqual({
        cobrado: 0, comisionDoogking: 0, costePasarela: 0,
        liquidadoComercios: 0, pendienteLiquidar: 0, reembolsado: 0,
      });
    });
  });

  describe('resumenReservas', () => {
    it('debería agrupar por estado y sumar el total de todos ellos', async () => {
      reservaModel.aggregate = jest.fn().mockImplementation((pipeline: any[]) => {
        const agrupaPorEstado = pipeline[0].$group?._id === '$estado';
        const totalGeneral = pipeline[0].$group?._id === null;
        return {
          exec: jest.fn().mockResolvedValue(
            agrupaPorEstado
              ? [{ _id: 'confirmada', total: 8 }, { _id: 'cancelada', total: 2 }]
              : totalGeneral
                ? [{ importe: 2500.789, comision: 375.123 }]
                : [{ monto: 120.5 }],
          ),
        };
      });

      const resumen = await service.resumenReservas();

      expect(resumen.porEstado).toEqual({ confirmada: 8, cancelada: 2 });
      expect(resumen.total).toBe(10);
      expect(resumen.importeReservado).toBe(2500.79);
      expect(resumen.comisiones).toBe(375.12);
    });

    it('debería devolver ceros y ningún estado sin reservas todavía', async () => {
      reservaModel.aggregate = jest.fn().mockReturnValue({ exec: jest.fn().mockResolvedValue([]) });

      const resumen = await service.resumenReservas();

      expect(resumen).toEqual({
        porEstado: {}, total: 0, importeReservado: 0,
        comisiones: 0, pagosRetenidos: 0, reembolsos: 0,
      });
    });
  });

  describe('evolucion', () => {
    const clave = (desplazamiento: number): string => {
      const hoy = new Date();
      const dia = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate() + desplazamiento);
      return dia.toISOString().slice(0, 10);
    };

    it('debería devolver una fila por día, también los que no tuvieron actividad', async () => {
      reservaModel.aggregate = jest.fn().mockReturnValue({ exec: jest.fn().mockResolvedValue([]) });
      pagoModel.aggregate = jest.fn().mockReturnValue({ exec: jest.fn().mockResolvedValue([]) });

      const serie = await service.evolucion(7);

      // Rellenar los huecos con ceros es deliberado: una línea con días
      // ausentes miente sobre la tendencia.
      expect(serie).toHaveLength(7);
      expect(serie.every((d) => d.reservas === 0 && d.facturacion === 0)).toBe(true);
      expect(serie.at(-1)!.fecha).toBe(clave(0));
    });

    it('debería usar 30 días cuando no se indica el rango', async () => {
      reservaModel.aggregate = jest.fn().mockReturnValue({ exec: jest.fn().mockResolvedValue([]) });
      pagoModel.aggregate = jest.fn().mockReturnValue({ exec: jest.fn().mockResolvedValue([]) });

      expect(await service.evolucion()).toHaveLength(30);
    });

    it('debería situar reservas y facturación en su día y redondear el importe', async () => {
      const hoy = clave(0);
      reservaModel.aggregate = jest.fn().mockReturnValue({
        exec: jest.fn().mockResolvedValue([{ _id: hoy, total: 4 }]),
      });
      pagoModel.aggregate = jest.fn().mockReturnValue({
        exec: jest.fn().mockResolvedValue([{ _id: hoy, total: 320.456 }]),
      });

      const serie = await service.evolucion(3);
      const dia = serie.find((d) => d.fecha === hoy)!;

      expect(dia.reservas).toBe(4);
      expect(dia.facturacion).toBe(320.46);
      // Los otros días siguen a cero, no heredan el valor del día con actividad.
      expect(serie.filter((d) => d.reservas > 0)).toHaveLength(1);
    });
  });
});
