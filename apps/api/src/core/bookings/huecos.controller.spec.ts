import { Test } from '@nestjs/testing';
import { HuecosController } from './huecos.controller';
import { BookingsService } from './bookings.service';

describe('HuecosController', () => {
  let controller: HuecosController;
  let huecosDelDia: jest.Mock;
  let agendaCitas: jest.Mock;

  beforeEach(async () => {
    huecosDelDia = jest.fn().mockResolvedValue({ soportado: true, estado: 'abierto', huecos: [] });
    agendaCitas = jest.fn().mockResolvedValue({ soportado: true, dias: [] });
    const modulo = await Test.createTestingModule({
      controllers: [HuecosController],
      providers: [{ provide: BookingsService, useValue: { huecosDelDia, agendaCitas } }],
    }).compile();
    controller = modulo.get(HuecosController);
  });

  it('debería pedir las citas del día con el servicio elegido y el perro del usuario', async () => {
    const respuesta = await controller.huecosDelDia(
      { servicioId: 's1', fecha: '2026-09-21', servicio: 'Baño', perroId: 'p1', cantidad: 2 },
      { user: { sub: 'u1' } } as never,
    );

    expect(respuesta).toEqual({ soportado: true, estado: 'abierto', huecos: [] });
    expect(huecosDelDia).toHaveBeenCalledWith({
      usuarioId: 'u1', servicioId: 's1', fecha: '2026-09-21', perroId: 'p1', cantidad: 2, detalle: { servicio: 'Baño' },
    });
  });

  it('debería atender a un invitado sin mirar ninguna ficha de perro', async () => {
    await controller.huecosDelDia({ servicioId: 's1', fecha: '2026-09-21', perroId: 'p1' }, {} as never);

    expect(huecosDelDia).toHaveBeenCalledWith({
      usuarioId: undefined, servicioId: 's1', fecha: '2026-09-21', perroId: undefined, cantidad: undefined, detalle: undefined,
    });
  });

  describe('agenda del calendario', () => {
    it('debería pedir el rango con el servicio elegido y el perro del usuario', async () => {
      const respuesta = await controller.agenda(
        { servicioId: 's1', desde: '2026-09-01', hasta: '2026-09-30', servicio: 'Baño', perroId: 'p1', cantidad: 2 },
        { user: { sub: 'u1' } } as never,
      );

      expect(respuesta).toEqual({ soportado: true, dias: [] });
      expect(agendaCitas).toHaveBeenCalledWith({
        usuarioId: 'u1', servicioId: 's1', desde: '2026-09-01', hasta: '2026-09-30',
        perroId: 'p1', cantidad: 2, detalle: { servicio: 'Baño' },
      });
    });

    it('debería atender a un invitado sin mirar ninguna ficha de perro', async () => {
      await controller.agenda({ servicioId: 's1', desde: '2026-09-01', hasta: '2026-09-30', perroId: 'p1' }, {} as never);

      expect(agendaCitas).toHaveBeenCalledWith({
        usuarioId: undefined, servicioId: 's1', desde: '2026-09-01', hasta: '2026-09-30',
        perroId: undefined, cantidad: undefined, detalle: undefined,
      });
    });
  });
});
