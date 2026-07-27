import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { Types } from 'mongoose';
import { PasoEmbudo, TipoEvento } from 'shared';
import { EventosService } from './eventos.service';
import { Evento } from './evento.schema';

describe('EventosService', () => {
  let service: EventosService;
  let eventoModel: { create: jest.Mock; find: jest.Mock; aggregate: jest.Mock };

  const conConfirmadas = (msDesdeInicio: number[]): void => {
    eventoModel.find.mockReturnValue({
      select: () => ({ lean: () => ({ exec: () => Promise.resolve(msDesdeInicio.map((ms) => ({ msDesdeInicio: ms }))) }) }),
    });
  };

  beforeEach(async () => {
    eventoModel = {
      create: jest.fn().mockResolvedValue({}),
      find: jest.fn(),
      aggregate: jest.fn().mockReturnValue({ exec: () => Promise.resolve([]) }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EventosService,
        { provide: getModelToken(Evento.name), useValue: eventoModel },
      ],
    }).compile();

    service = module.get(EventosService);
    conConfirmadas([]);
  });

  describe('registrar', () => {
    it('debería guardar el evento con su paso y su medición', async () => {
      await service.registrar({
        tipo: TipoEvento.PASO_COMPLETADO,
        sesionId: 's1',
        paso: PasoEmbudo.PAGO,
        msDesdeInicio: 12_000,
      });

      expect(eventoModel.create).toHaveBeenCalledWith(
        expect.objectContaining({ paso: PasoEmbudo.PAGO, msDesdeInicio: 12_000 }),
      );
    });

    it('debería descartar identificadores malformados en vez de reventar', async () => {
      await service.registrar({ tipo: TipoEvento.SERVICIO_ABIERTO, usuarioId: 'no-es-un-id' });

      expect(eventoModel.create.mock.calls[0][0].usuarioId).toBeUndefined();
    });

    it('nunca debería lanzar: la telemetría no puede tumbar una reserva', async () => {
      eventoModel.create.mockRejectedValue(new Error('mongo caído'));

      await expect(service.registrar({ tipo: TipoEvento.RESERVA_INICIADA })).resolves.toBeUndefined();
    });

    it('debería convertir los identificadores válidos a ObjectId', async () => {
      const id = new Types.ObjectId().toString();

      await service.registrar({ tipo: TipoEvento.RESERVA_CONFIRMADA, reservaId: id });

      expect(eventoModel.create.mock.calls[0][0].reservaId).toBeInstanceOf(Types.ObjectId);
    });
  });

  describe('metricaEmbudo', () => {
    it('debería devolver ceros sin datos, sin dividir por cero', async () => {
      await expect(service.metricaEmbudo()).resolves.toEqual({
        medidas: 0, bajo30s: 0, porcentajeBajo30s: 0, medianaSegundos: 0,
      });
    });

    it('debería contar cuántas reservas bajaron de 30 segundos', async () => {
      conConfirmadas([12_000, 25_000, 48_000, 90_000]);

      const metrica = await service.metricaEmbudo();

      expect(metrica.medidas).toBe(4);
      expect(metrica.bajo30s).toBe(2);
      expect(metrica.porcentajeBajo30s).toBe(50);
    });

    it('debería incluir los 30 s exactos como meta cumplida', async () => {
      conConfirmadas([30_000]);

      await expect(service.metricaEmbudo()).resolves.toMatchObject({ bajo30s: 1 });
    });

    it('debería dar la mediana, no la media: un outlier no debe falsear el dato', async () => {
      conConfirmadas([10_000, 20_000, 30_000, 40_000, 600_000]);

      const metrica = await service.metricaEmbudo();

      expect(metrica.medianaSegundos).toBe(30);
    });

    it('solo debería medir reservas confirmadas con cronómetro completo', async () => {
      await service.metricaEmbudo();

      const filtro = eventoModel.find.mock.calls[0][0] as Record<string, unknown>;
      expect(filtro['tipo']).toBe(TipoEvento.RESERVA_CONFIRMADA);
      expect(filtro['msDesdeInicio']).toEqual({ $gt: 0 });
    });
  });

  describe('detectarAbandonos', () => {
    it('no debería considerar abandono a quien acabó reservando', async () => {
      await service.detectarAbandonos();

      const pipeline = eventoModel.aggregate.mock.calls[0][0] as Array<Record<string, unknown>>;
      const filtroFinal = pipeline.find((etapa) => {
        const match = etapa['$match'] as Record<string, unknown> | undefined;
        return match?.['confirmada'] !== undefined;
      });

      expect((filtroFinal?.['$match'] as Record<string, unknown>)['confirmada']).toBe(0);
    });

    it('no debería avisar dos veces del mismo abandono', async () => {
      await service.detectarAbandonos();

      const pipeline = eventoModel.aggregate.mock.calls[0][0] as Array<Record<string, unknown>>;
      const filtroFinal = pipeline.find((etapa) => {
        const match = etapa['$match'] as Record<string, unknown> | undefined;
        return match?.['yaAvisado'] !== undefined;
      });

      expect((filtroFinal?.['$match'] as Record<string, unknown>)['yaAvisado']).toBe(0);
    });

    it('solo debería contar embudos que llegaron a iniciar una reserva', async () => {
      await service.detectarAbandonos();

      const pipeline = eventoModel.aggregate.mock.calls[0][0] as Array<Record<string, unknown>>;
      const filtroFinal = pipeline.find((etapa) => {
        const match = etapa['$match'] as Record<string, unknown> | undefined;
        return match?.['inicios'] !== undefined;
      });

      expect((filtroFinal?.['$match'] as Record<string, unknown>)['inicios']).toEqual({ $gt: 0 });
    });
  });
});
