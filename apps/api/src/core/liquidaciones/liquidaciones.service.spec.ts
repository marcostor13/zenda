import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { LiquidacionesService } from './liquidaciones.service';
import { Liquidacion } from './liquidacion.schema';
import { Pago } from '../payments/pago.schema';
import { Reserva } from '../bookings/reserva.schema';
import { ComerciosRepository } from '../comercios/comercios.repository';
import { AuditoriaService } from '../auditoria/auditoria.service';

const ADMIN_ID = '507f1f77bcf86cd799439011';
const COMERCIO_ID = '507f1f77bcf86cd799439022';

describe('LiquidacionesService', () => {
  let service: LiquidacionesService;
  let liquidacionModel: any;
  let pagoModel: any;
  let comerciosRepo: { findById: jest.Mock };
  let auditoria: { registrar: jest.Mock };

  beforeEach(async () => {
    liquidacionModel = {
      create: jest.fn().mockImplementation((datos) => Promise.resolve(datos)),
      find: jest.fn().mockReturnValue({
        sort: jest.fn().mockReturnThis(), skip: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(), lean: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue([]),
      }),
      countDocuments: jest.fn().mockReturnValue({ exec: jest.fn().mockResolvedValue(0) }),
      // Guardia de solape: por defecto no hay ninguna liquidación previa.
      findOne: jest.fn().mockReturnValue({
        select: jest.fn().mockReturnThis(), lean: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue(null),
      }),
      // Estado actual antes de marcar como pagada.
      findById: jest.fn().mockReturnValue({
        select: jest.fn().mockReturnThis(), lean: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue({ estado: 'pendiente' }),
      }),
      findByIdAndUpdate: jest.fn().mockReturnValue({
        exec: jest.fn().mockResolvedValue({ comercioId: COMERCIO_ID, comercioNombre: 'VilaCan', importeNeto: 400 }),
      }),
    };
    pagoModel = {
      aggregate: jest.fn().mockReturnValue({
        exec: jest.fn().mockResolvedValue([{ bruto: 590, comision: 75, stripe: 18.21, neto: 496.79, pagos: 2 }]),
      }),
    };
    comerciosRepo = { findById: jest.fn().mockResolvedValue({ nombreComercial: 'VilaCan' }) };
    auditoria = { registrar: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        LiquidacionesService,
        { provide: getModelToken(Liquidacion.name), useValue: liquidacionModel },
        { provide: getModelToken(Pago.name), useValue: pagoModel },
        {
          provide: getModelToken(Reserva.name),
          useValue: {
            find: jest.fn().mockReturnValue({
              select: jest.fn().mockReturnThis(), lean: jest.fn().mockReturnThis(),
              exec: jest.fn().mockResolvedValue([{ _id: 'r1' }, { _id: 'r2' }]),
            }),
          },
        },
        { provide: ComerciosRepository, useValue: comerciosRepo },
        { provide: AuditoriaService, useValue: auditoria },
      ],
    }).compile();

    service = module.get(LiquidacionesService);
  });

  const periodo = { desde: new Date('2026-07-01'), hasta: new Date('2026-07-31') };

  it('debería registrar el neto calculado a partir de los pagos cobrados', async () => {
    const liquidacion = await service.generar(COMERCIO_ID, periodo.desde, periodo.hasta, ADMIN_ID);

    expect(liquidacion.importeNeto).toBe(496.79);
    expect(liquidacion.comercioNombre).toBe('VilaCan');
    expect(auditoria.registrar).toHaveBeenCalled();
  });

  it('no debería generar una liquidación sin pagos en el periodo', async () => {
    pagoModel.aggregate.mockReturnValue({ exec: jest.fn().mockResolvedValue([]) });

    await expect(service.generar(COMERCIO_ID, periodo.desde, periodo.hasta, ADMIN_ID))
      .rejects.toThrow(/No hay pagos cobrados/i);
  });

  it('debería rechazar un periodo al revés', async () => {
    await expect(service.generar(COMERCIO_ID, periodo.hasta, periodo.desde, ADMIN_ID))
      .rejects.toThrow(/termina antes de empezar/i);
  });

  it('debería exigir referencia para marcar una liquidación como pagada', async () => {
    await expect(service.marcarPagada('l1', '   ', ADMIN_ID)).rejects.toThrow(/referencia/i);
    expect(liquidacionModel.findByIdAndUpdate).not.toHaveBeenCalled();
  });

  it('debería liquidar el último día completo del periodo', async () => {
    // Las fechas llegan sin hora: sin extender `hasta`, lo cobrado ese día
    // quedaba fuera. Se cierra en UTC para no depender del huso del servidor.
    await service.generar(COMERCIO_ID, periodo.desde, periodo.hasta, ADMIN_ID);

    const [pipeline] = pagoModel.aggregate.mock.calls[0];
    const rango = pipeline[0].$match.createdAt;
    expect(rango.$gte.toISOString()).toBe('2026-07-01T00:00:00.000Z');
    expect(rango.$lte.toISOString()).toBe('2026-07-31T23:59:59.999Z');
  });

  it('debería rechazar un periodo que se solapa con otra liquidación', async () => {
    liquidacionModel.findOne.mockReturnValue({
      select: jest.fn().mockReturnThis(), lean: jest.fn().mockReturnThis(),
      exec: jest.fn().mockResolvedValue({
        desde: new Date('2026-07-15'), hasta: new Date('2026-08-15'),
      }),
    });

    await expect(service.generar(COMERCIO_ID, periodo.desde, periodo.hasta, ADMIN_ID))
      .rejects.toThrow(/ya está liquidado/i);
    expect(liquidacionModel.create).not.toHaveBeenCalled();
  });

  it('debería rechazar fechas que no son fechas', async () => {
    await expect(service.generar(COMERCIO_ID, new Date('vaya'), periodo.hasta, ADMIN_ID))
      .rejects.toThrow(/no son válidas/i);
  });

  it('no debería volver a marcar como pagada una liquidación ya pagada', async () => {
    liquidacionModel.findById.mockReturnValue({
      select: jest.fn().mockReturnThis(), lean: jest.fn().mockReturnThis(),
      exec: jest.fn().mockResolvedValue({ estado: 'pagada', referencia: 'TRF-BUENA' }),
    });

    await expect(service.marcarPagada('l1', 'TRF-OTRA', ADMIN_ID))
      .rejects.toThrow(/ya se marcó como pagada/i);
    expect(liquidacionModel.findByIdAndUpdate).not.toHaveBeenCalled();
  });

  it('debería guardar la referencia y dejar constancia al pagar', async () => {
    await service.marcarPagada('l1', 'TRF-2026-07', ADMIN_ID);

    expect(liquidacionModel.findByIdAndUpdate).toHaveBeenCalledWith(
      'l1',
      expect.objectContaining({ $set: expect.objectContaining({ estado: 'pagada', referencia: 'TRF-2026-07' }) }),
      { new: true },
    );
    expect(auditoria.registrar).toHaveBeenCalledWith(expect.objectContaining({ motivo: 'TRF-2026-07' }));
  });
});
