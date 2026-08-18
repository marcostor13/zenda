import { Test } from '@nestjs/testing';
import type { Response } from 'express';
import { TipoEvento } from 'shared';
import { EventosController } from './eventos.controller';
import { EventosService } from './eventos.service';
import { GrowthService } from './growth.service';

describe('EventosController', () => {
  let controller: EventosController;
  let eventosService: jest.Mocked<EventosService>;
  let growthService: jest.Mocked<GrowthService>;

  /** `Response` de Express con lo justo que usa el píxel. */
  function respuestaFalsa(): Response & { set: jest.Mock; end: jest.Mock } {
    return { set: jest.fn(), end: jest.fn() } as never;
  }

  beforeEach(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [EventosController],
      providers: [
        {
          provide: EventosService,
          useValue: {
            registrar: jest.fn().mockResolvedValue(undefined),
            metricaEmbudo: jest.fn().mockResolvedValue({ total: 0 }),
          },
        },
        {
          provide: GrowthService,
          useValue: {
            abrirPorToken: jest.fn().mockResolvedValue({ reservaId: 'r1', codigo: 'RES-1' }),
            registrarApertura: jest.fn().mockResolvedValue(undefined),
            seguimiento: jest.fn().mockResolvedValue({ enviadas: 0 }),
            solicitarValoracionesPendientes: jest.fn().mockResolvedValue({ enviados: 3 }),
            enviarRecordatorios: jest.fn().mockResolvedValue({ enviados: 1 }),
            recuperarAbandonos: jest.fn().mockResolvedValue({ enviados: 2 }),
          },
        },
      ],
    }).compile();

    controller = moduleRef.get(EventosController);
    eventosService = moduleRef.get(EventosService);
    growthService = moduleRef.get(GrowthService);
  });

  describe('registrar', () => {
    const dto = { tipo: TipoEvento.PASO_COMPLETADO } as never;

    it('debería adjuntar el usuario del token cuando hay sesión', async () => {
      await controller.registrar(dto, { user: { sub: 'u1' } } as never);

      expect(eventosService.registrar).toHaveBeenCalledWith(
        expect.objectContaining({ tipo: TipoEvento.PASO_COMPLETADO, usuarioId: 'u1' }),
      );
    });

    it('debería aceptar eventos anónimos, sin sesión iniciada', async () => {
      // Es público a propósito: media embudo ocurre antes de iniciar sesión y
      // exigir token dejaría fuera los abandonos más tempranos.
      await controller.registrar(dto, {} as never);

      expect(eventosService.registrar).toHaveBeenCalledWith(
        expect.objectContaining({ usuarioId: undefined }),
      );
    });
  });

  describe('píxel de apertura', () => {
    it('debería registrar la apertura y devolver un GIF sin caché', async () => {
      const res = respuestaFalsa();

      await controller.pixelApertura('tok-1', res);

      expect(growthService.registrarApertura).toHaveBeenCalledWith('tok-1');
      const cabeceras = res.set.mock.calls[0][0];
      expect(cabeceras['Content-Type']).toBe('image/gif');
      // Sin caché: si un proxy lo guardara solo contaríamos la primera apertura.
      expect(cabeceras['Cache-Control']).toContain('no-store');
      expect(res.end).toHaveBeenCalledWith(expect.any(Buffer));
    });

    it('debería enviar un GIF de tamaño real, no un cuerpo vacío', async () => {
      const res = respuestaFalsa();

      await controller.pixelApertura('tok-1', res);

      const pixel = res.end.mock.calls[0][0] as Buffer;
      expect(pixel.length).toBeGreaterThan(0);
      expect(res.set.mock.calls[0][0]['Content-Length']).toBe(String(pixel.length));
    });
  });

  describe('endpoints de administración', () => {
    it('debería abrir la valoración por su token único', async () => {
      await expect(controller.abrirValoracion('tok-1'))
        .resolves.toEqual({ reservaId: 'r1', codigo: 'RES-1' });
    });

    it('debería convertir a número los días de la métrica del embudo', async () => {
      await controller.metricaEmbudo('15');

      expect(eventosService.metricaEmbudo).toHaveBeenCalledWith(15);
    });

    it('debería dejar que el servicio aplique su valor por defecto si no se indican días', async () => {
      await controller.metricaEmbudo(undefined);

      expect(eventosService.metricaEmbudo).toHaveBeenCalledWith(undefined);
    });

    it('debería tratar un valor no numérico como "sin indicar"', async () => {
      await controller.metricaEmbudo('no-es-un-numero');

      expect(eventosService.metricaEmbudo).toHaveBeenCalledWith(undefined);
    });

    it('debería delegar el seguimiento de la campaña de reseñas', async () => {
      await controller.seguimiento();

      expect(growthService.seguimiento).toHaveBeenCalled();
    });

    it('debería disparar la tanda de solicitudes de valoración', async () => {
      await expect(controller.tandaValoraciones()).resolves.toEqual({ enviados: 3 });
    });

    it('debería disparar la tanda de recordatorios', async () => {
      await expect(controller.tandaRecordatorios()).resolves.toEqual({ enviados: 1 });
    });

    it('debería disparar la tanda de recuperación de abandonos', async () => {
      await expect(controller.tandaAbandonos()).resolves.toEqual({ enviados: 2 });
    });
  });
});
