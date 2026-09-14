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

  describe('agenda del rango', () => {
    /*
     * El servicio sólo abre los lunes de 09:00 a 11:00 y cierra el 28 (festivo),
     * así que en la semana del 21 al 27 de septiembre de 2026 sólo el lunes 21
     * tiene citas. Es justo lo que el cliente no podía saber antes de elegir.
     */
    it('debería marcar cada día como libre, cerrado o pasado', async () => {
      const agenda = await service.agenda(servicio, '2026-09-21', '2026-09-27', antes);

      expect(agenda.dias.map((d) => [d.fecha, d.estado])).toEqual([
        ['2026-09-21', 'libre'],
        ['2026-09-22', 'cerrado'],
        ['2026-09-23', 'cerrado'],
        ['2026-09-24', 'cerrado'],
        ['2026-09-25', 'cerrado'],
        ['2026-09-26', 'cerrado'],
        ['2026-09-27', 'cerrado'],
      ]);
      expect(agenda.dias[0]).toMatchObject({ huecosLibres: 3, primeraHora: '09:00' });
      expect(agenda.dias[1].motivo).toContain('no atiende ese día');
    });

    /*
     * El lunes 28 es festivo en la ficha, así que la primera cita salta al lunes
     * siguiente: la excepción gana al horario semanal, que es lo que el comercio
     * espera al marcar un cierre puntual.
     */
    it('debería apuntar a la primera cita libre del rango, saltándose el festivo', async () => {
      const agenda = await service.agenda(servicio, '2026-09-22', '2026-10-05', antes);

      expect(agenda.dias.find((d) => d.fecha === '2026-09-28'))
        .toMatchObject({ estado: 'cerrado', motivo: expect.stringContaining('Festivo') });
      expect(agenda.primeraLibre).toEqual({ fecha: '2026-10-05', hora: '09:00' });
    });

    it('debería marcar completo el día sin huecos y pasado el que ya no llega a tiempo', async () => {
      reservas = [
        { fechaInicio: new Date('2026-09-21T07:00:00Z'), fechaFin: new Date('2026-09-21T09:00:00Z'), detalle: {} },
      ];

      const agenda = await service.agenda(servicio, '2026-09-21', '2026-09-28', antes);
      expect(agenda.dias[0]).toMatchObject({ estado: 'completo', huecosLibres: 0 });

      // Una semana después el lunes 21 ya pasó: no está lleno, es que no llega.
      const tarde = await service.agenda(servicio, '2026-09-21', '2026-09-28', new Date('2026-09-25T00:00:00Z'));
      expect(tarde.dias[0].estado).toBe('pasado');
    });

    it('debería cerrar el día que el comercio bloquea entero por su cuenta', async () => {
      bloqueos.listar.mockResolvedValue([
        { _id: 'b', servicioId: servicio.servicioId, desde: '2026-09-21T00:00:00.000Z', hasta: '2026-09-22T00:00:00.000Z' },
      ]);

      const agenda = await service.agenda(servicio, '2026-09-21', '2026-09-27', antes);

      expect(agenda.dias[0]).toMatchObject({ estado: 'completo', huecosLibres: 0 });
      expect(agenda.primeraLibre).toBeUndefined();
    });

    /*
     * Lo que hace que el calendario se abra al instante. Pidiendo día a día
     * serían dos consultas por día —sesenta en un mes—; el rango entero son dos.
     */
    it('debería resolver el rango entero con una sola consulta de cada cosa', async () => {
      await service.agenda(servicio, '2026-09-01', '2026-09-30', antes);

      expect(find).toHaveBeenCalledTimes(1);
      expect(bloqueos.listar).toHaveBeenCalledTimes(1);
    });

    it('debería recortar un rango desmedido en vez de recorrer años', async () => {
      const agenda = await service.agenda(servicio, '2026-09-01', '2030-09-01', antes);

      expect(agenda.dias).toHaveLength(62);
    });
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
