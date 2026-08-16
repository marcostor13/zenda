import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { AdminService } from './admin.service';
import { ComisionConfigRepository } from '../comision-configs/comision-config.repository';
import { AlphaRepository } from '../alpha/alpha.repository';
import { AuditoriaService } from '../auditoria/auditoria.service';
import { ComerciosRepository } from '../comercios/comercios.repository';
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
import { VerticalKey, PagoEstado, IVA_RATE, Rol } from 'shared';

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
    { _id: { toString: () => 'res-1' }, vertical: VerticalKey.ALOJAMIENTO },
    { _id: { toString: () => 'res-2' }, vertical: VerticalKey.ALOJAMIENTO },
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
    };

    usuarioModel = {
      countDocuments: jest.fn().mockReturnValue({ exec: jest.fn().mockResolvedValue(5) }),
      find: jest.fn(),
    };

    perroModel = {
      countDocuments: jest.fn().mockReturnValue({ exec: jest.fn().mockResolvedValue(42) }),
    };

    auditoria = { registrar: jest.fn(), listar: jest.fn() };

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
          useValue: {
            listar: jest.fn().mockResolvedValue([]),
            findById: jest.fn(),
            actualizar: jest.fn(),
          },
        },
        {
          provide: UsersRepository,
          useValue: { contarTodos: jest.fn().mockResolvedValue(0) },
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
    it('debería exponer las métricas nuevas (verificaciones, nuevos comercios, mascotas)', async () => {
      const dashboard = await service.obtenerDashboard();

      expect(dashboard.kpis.verificacionesPendientes).toBe(3);
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

  describe('cambiarVerificacionComercio', () => {
    it('debería marcar el comercio y sus documentos como verificados', async () => {
      const comerciosRepo = (service as unknown as { comerciosRepo: any }).comerciosRepo;
      comerciosRepo.findById.mockResolvedValue({
        verificacion: { estado: 'pendiente', documentos: [{ tipo: 'cif', url: 'x', estado: 'pendiente' }] },
      });
      comerciosRepo.actualizar.mockResolvedValue({ _id: 'c1' });

      await service.cambiarVerificacionComercio('c1', 'verificado');

      expect(comerciosRepo.actualizar).toHaveBeenCalledWith(
        'c1',
        expect.objectContaining({
          verificacion: expect.objectContaining({
            estado: 'verificado',
            documentos: [expect.objectContaining({ estado: 'verificado' })],
          }),
        }),
      );
    });

    it('debería guardar el motivo al rechazar', async () => {
      const comerciosRepo = (service as unknown as { comerciosRepo: any }).comerciosRepo;
      comerciosRepo.findById.mockResolvedValue({ verificacion: { estado: 'pendiente', documentos: [] } });
      comerciosRepo.actualizar.mockResolvedValue({ _id: 'c1' });

      await service.cambiarVerificacionComercio('c1', 'rechazado', 'CIF ilegible');

      expect(comerciosRepo.actualizar).toHaveBeenCalledWith(
        'c1',
        expect.objectContaining({
          verificacion: expect.objectContaining({ estado: 'rechazado', motivoRechazo: 'CIF ilegible' }),
        }),
      );
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
});
