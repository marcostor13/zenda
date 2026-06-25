import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { AdminService } from './admin.service';
import { ComisionConfigRepository } from '../comision-configs/comision-config.repository';
import { ComerciosRepository } from '../comercios/comercios.repository';
import { Pago } from '../payments/pago.schema';
import { Reserva } from '../bookings/reserva.schema';
import { VerticalKey, PagoEstado, IVA_RATE } from 'shared';

describe('AdminService', () => {
  let service: AdminService;
  let comisionConfigRepo: jest.Mocked<ComisionConfigRepository>;
  let pagoModel: any;
  let reservaModel: any;

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
    { _id: { toString: () => 'res-1' }, vertical: VerticalKey.HOTELES },
    { _id: { toString: () => 'res-2' }, vertical: VerticalKey.HOTELES },
  ];

  beforeEach(async () => {
    reservaModel = {
      find: jest.fn().mockReturnValue({
        select: jest.fn().mockReturnThis(),
        lean: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue(reservasMock),
      }),
    };

    pagoModel = {
      find: jest.fn().mockReturnValue({
        lean: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue(pagosMock),
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AdminService,
        {
          provide: ComisionConfigRepository,
          useValue: {
            listarTodas: jest.fn().mockResolvedValue([]),
            upsert: jest.fn().mockResolvedValue({ vertical: VerticalKey.HOTELES, comisionPct: 0.18 }),
          },
        },
        {
          provide: ComerciosRepository,
          useValue: { listar: jest.fn().mockResolvedValue([]) },
        },
        { provide: getModelToken(Pago.name), useValue: pagoModel },
        { provide: getModelToken(Reserva.name), useValue: reservaModel },
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
      const hoteles = reporte.porVertical.find((v) => v.vertical === VerticalKey.HOTELES);

      expect(hoteles).toBeDefined();
      expect(hoteles!.totalReservas).toBe(2);
    });
  });

  describe('actualizarComision', () => {
    it('debería delegar al repositorio con los datos correctos', async () => {
      const dto = {
        vertical: VerticalKey.HOTELES as any,
        comisionPct: 0.18,
        stripePct: 0.029,
        stripeFijoEur: 1.1,
        activo: true,
      };

      await service.actualizarComision(dto, 'admin-1');

      expect(comisionConfigRepo.upsert).toHaveBeenCalledWith(
        VerticalKey.HOTELES,
        expect.objectContaining({ comisionPct: 0.18 }),
        'admin-1',
      );
    });
  });
});
