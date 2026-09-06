import { Test } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { Types } from 'mongoose';
import { PagoEstado, ReservaEstado } from 'shared';
import { Pago } from '../payments/pago.schema';
import { Reserva } from './reserva.schema';
import { HORAS_CADUCIDAD_RESERVA_PENDIENTE, ReservasCaducidadService } from './reservas-caducidad.service';

describe('ReservasCaducidadService', () => {
  let service: ReservasCaducidadService;
  let reservaModel: {
    find: jest.Mock;
    updateMany: jest.Mock;
  };
  let pagoModel: { find: jest.Mock };

  const abandonadaId = new Types.ObjectId();
  const cobradaId = new Types.ObjectId();

  /** Cadena `find().select().limit().lean().exec()` con el resultado indicado. */
  function cadenaFind(resultado: unknown[]) {
    return {
      select: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
      lean: jest.fn().mockReturnThis(),
      exec: jest.fn().mockResolvedValue(resultado),
    };
  }

  beforeEach(async () => {
    reservaModel = {
      find: jest.fn().mockReturnValue(cadenaFind([])),
      updateMany: jest.fn().mockReturnValue({
        exec: jest.fn().mockResolvedValue({ modifiedCount: 1 }),
      }),
    };
    pagoModel = { find: jest.fn().mockReturnValue(cadenaFind([])) };

    const moduleRef = await Test.createTestingModule({
      providers: [
        ReservasCaducidadService,
        { provide: getModelToken(Reserva.name), useValue: reservaModel },
        { provide: getModelToken(Pago.name), useValue: pagoModel },
      ],
    }).compile();

    service = moduleRef.get(ReservasCaducidadService);
  });

  it('no debería tocar nada si no hay reservas pendientes viejas', async () => {
    expect(await service.caducarPendientesAbandonadas()).toBe(0);
    expect(reservaModel.updateMany).not.toHaveBeenCalled();
  });

  it('debería buscar sólo pendientes anteriores a la ventana de gracia', async () => {
    await service.caducarPendientesAbandonadas();

    const filtro = reservaModel.find.mock.calls[0][0];
    expect(filtro.estado).toBe(ReservaEstado.PENDIENTE);
    const limite = filtro.createdAt.$lt as Date;
    const esperado = Date.now() - HORAS_CADUCIDAD_RESERVA_PENDIENTE * 3_600_000;
    expect(Math.abs(limite.getTime() - esperado)).toBeLessThan(5_000);
  });

  it('debería cancelar la reserva abandonada dejando el motivo en el historial', async () => {
    reservaModel.find.mockReturnValue(cadenaFind([{ _id: abandonadaId, codigo: 'DK-1' }]));

    expect(await service.caducarPendientesAbandonadas()).toBe(1);

    const [filtro, cambios] = reservaModel.updateMany.mock.calls[0];
    expect(filtro._id.$in).toEqual([abandonadaId]);
    // Se vuelve a exigir `pendiente` en el filtro: entre la lectura y la
    // escritura el webhook del pago puede haber confirmado la reserva.
    expect(filtro.estado).toBe(ReservaEstado.PENDIENTE);
    expect(cambios.$set.estado).toBe(ReservaEstado.CANCELADA);
    expect(cambios.$push.historialEstados).toMatchObject({
      estado: ReservaEstado.CANCELADA,
      por: 'sistema',
      motivo: expect.stringContaining('pago'),
    });
  });

  it('no debería cancelar una reserva que ya tiene el pago aprobado', async () => {
    // Es dinero cobrado con el webhook perdido: cancelarla dejaría al cliente
    // pagado y sin servicio. Se deja viva para que alguien la revise.
    reservaModel.find.mockReturnValue(
      cadenaFind([{ _id: abandonadaId, codigo: 'DK-1' }, { _id: cobradaId, codigo: 'DK-2' }]),
    );
    pagoModel.find.mockReturnValue(cadenaFind([{ reservaId: cobradaId }]));

    await service.caducarPendientesAbandonadas();

    expect(pagoModel.find.mock.calls[0][0].estado).toBe(PagoEstado.APROBADO);
    expect(reservaModel.updateMany.mock.calls[0][0]._id.$in).toEqual([abandonadaId]);
  });

  it('no debería escribir si todas las candidatas tenían pago aprobado', async () => {
    reservaModel.find.mockReturnValue(cadenaFind([{ _id: cobradaId, codigo: 'DK-2' }]));
    pagoModel.find.mockReturnValue(cadenaFind([{ reservaId: cobradaId }]));

    expect(await service.caducarPendientesAbandonadas()).toBe(0);
    expect(reservaModel.updateMany).not.toHaveBeenCalled();
  });
});
