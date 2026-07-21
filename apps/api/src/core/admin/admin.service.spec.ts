import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { AdminService } from './admin.service';
import { ComisionConfigRepository } from '../comision-configs/comision-config.repository';
import { ComerciosRepository } from '../comercios/comercios.repository';
import { UsersRepository } from '../users/users.repository';
import { Pago } from '../payments/pago.schema';
import { Reserva } from '../bookings/reserva.schema';
import { Usuario } from '../users/usuario.schema';
import { Comercio } from '../comercios/comercio.schema';
import { Perro } from '../perros/perro.schema';
import { VerticalKey, PagoEstado, IVA_RATE, Rol } from 'shared';

describe('AdminService', () => {
  let service: AdminService;
  let comisionConfigRepo: jest.Mocked<ComisionConfigRepository>;
  let pagoModel: any;
  let reservaModel: any;
  let comercioModel: any;
  let perroModel: any;

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

    perroModel = {
      countDocuments: jest.fn().mockReturnValue({ exec: jest.fn().mockResolvedValue(42) }),
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
        { provide: getModelToken(Pago.name), useValue: pagoModel },
        { provide: getModelToken(Reserva.name), useValue: reservaModel },
        { provide: getModelToken(Usuario.name), useValue: {} },
        { provide: getModelToken(Comercio.name), useValue: comercioModel },
        { provide: getModelToken(Perro.name), useValue: perroModel },
      ],
    }).compile();

    service = module.get<AdminService>(AdminService);
    comisionConfigRepo = module.get(ComisionConfigRepository);
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
        .mockReturnValueOnce({ exec: jest.fn().mockResolvedValue([{ _id: 'veterinaria', reservas: 6 }, { _id: 'peluqueria', reservas: 4 }]) })
        .mockReturnValueOnce({ exec: jest.fn().mockResolvedValue([{ _id: 'Madrid', reservas: 8 }, { _id: null, reservas: 2 }]) });
      pagoModel.aggregate.mockReturnValueOnce({ exec: jest.fn().mockResolvedValue([{ nombre: 'VilaCan', reservas: 5, facturacion: 900 }]) });

      const analitica = await service.obtenerAnalitica();

      expect(analitica.porVertical[0]).toEqual({ vertical: 'veterinaria', reservas: 6, porcentaje: 60 });
      expect(analitica.porCiudad).toEqual([{ ciudad: 'Madrid', reservas: 8 }]); // descarta ciudad nula
      expect(analitica.topComercios[0]).toEqual({ comercio: 'VilaCan', reservas: 5, facturacion: 900 });
      expect(analitica.embudo).toEqual({ registrados: 0, conReserva: 3, pagaron: 7 });
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
});
