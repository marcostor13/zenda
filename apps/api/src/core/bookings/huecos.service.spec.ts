import { Test } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { Types } from 'mongoose';
import { horarioSemanal } from 'shared';
import { HuecosService, type ServicioConCitas } from './huecos.service';
import { Reserva } from './reserva.schema';
import { BloqueosService } from '../bloqueos/bloqueos.service';

describe('HuecosService', () => {
  let service: HuecosService;
  let reservas: Array<Record<string, unknown>>;
  let find: jest.Mock;
  let bloqueos: { listar: jest.Mock };

  const servicio: ServicioConCitas = {
    servicioId: new Types.ObjectId().toString(),
    comercioId: new Types.ObjectId().toString(),
    horario: horarioSemanal({ dias: ['lunes'], abre: '09:00', cierra: '11:00' }),
    excepcionesHorario: [{ fecha: '2026-09-28', cerrado: true, motivo: 'Festivo' }],
    duracionMin: 60,
    capacidad: 1,
  };
  const antes = new Date('2026-09-01T00:00:00Z');

  beforeEach(async () => {
    reservas = [];
    find = jest.fn(() => ({
      select: jest.fn().mockReturnThis(),
      lean: jest.fn().mockReturnThis(),
      exec: jest.fn(async () => reservas),
    }));
    bloqueos = { listar: jest.fn().mockResolvedValue([]) };

    const modulo = await Test.createTestingModule({
      providers: [
        HuecosService,
        { provide: getModelToken(Reserva.name), useValue: { find } },
        { provide: BloqueosService, useValue: bloqueos },
      ],
    }).compile();
    service = modulo.get(HuecosService);
  });

  it('debería cruzar el horario con las citas vivas del servicio', async () => {
    reservas = [
      // Cita nueva, con instante y fin.
      { fechaInicio: new Date('2026-09-21T07:00:00Z'), fechaFin: new Date('2026-09-21T08:00:00Z'), detalle: {} },
      // Un día suelto sin hora no tapa ninguna cita.
      { fechaInicio: new Date('2026-09-21T00:00:00Z'), detalle: {} },
    ];

    const respuesta = await service.huecosDelDia(servicio, '2026-09-21', antes);

    expect(respuesta).toMatchObject({ soportado: true, estado: 'abierto', duracionMin: 60 });
    expect(respuesta.huecos.map((h) => [h.hora, h.disponible])).toEqual([['09:00', false], ['09:30', false], ['10:00', true]]);
    expect(find.mock.calls[0][0]).toMatchObject({ servicioId: new Types.ObjectId(servicio.servicioId) });
  });

  it('debería tapar las citas antiguas guardadas con la hora aparte', async () => {
    reservas = [{ fechaInicio: new Date('2026-09-21T00:00:00Z'), detalle: { hora: '10:00', duracionMin: 60 } }];

    const respuesta = await service.huecosDelDia(servicio, '2026-09-21', antes);

    expect(respuesta.huecos.filter((h) => h.disponible).map((h) => h.hora)).toEqual(['09:00']);
  });

  it('debería restar los cierres del comercio y no consultar nada un día cerrado', async () => {
    bloqueos.listar.mockResolvedValue([
      { _id: 'b', servicioId: servicio.servicioId, desde: '2026-09-21T07:00:00.000Z', hasta: '2026-09-21T07:30:00.000Z' },
    ]);

    const abierto = await service.huecosDelDia({ ...servicio, capacidad: 5 }, '2026-09-21', antes);
    expect(abierto.huecos.filter((h) => h.disponible).map((h) => h.hora)).toEqual(['09:30', '10:00']);

    const festivo = await service.huecosDelDia(servicio, '2026-09-28', antes);
    expect(festivo).toMatchObject({ estado: 'cerrado', motivo: expect.stringContaining('Festivo'), huecos: [] });
    expect(find).toHaveBeenCalledTimes(1);
  });

  it('debería decir si queda plaza para una hora concreta', async () => {
    bloqueos.listar.mockResolvedValue([
      { _id: 'b', servicioId: servicio.servicioId, desde: '2026-09-21T08:00:00.000Z', hasta: '2026-09-21T09:00:00.000Z', cantidad: 1 },
    ]);
    reservas = [{ fechaInicio: new Date('2026-09-21T07:00:00Z'), fechaFin: new Date('2026-09-21T08:00:00Z'), detalle: {} }];

    await expect(service.hayPlaza(servicio, new Date('2026-09-21T07:30:00Z'), new Date('2026-09-21T08:30:00Z'))).resolves.toBe(false);
    await expect(service.hayPlaza({ ...servicio, capacidad: 2 }, new Date('2026-09-21T07:30:00Z'), new Date('2026-09-21T08:30:00Z'))).resolves.toBe(true);
    await expect(service.hayPlaza(servicio, new Date('2026-09-21T09:00:00Z'), new Date('2026-09-21T10:00:00Z'))).resolves.toBe(true);
  });
});
