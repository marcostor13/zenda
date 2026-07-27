import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { Types } from 'mongoose';
import { AgendaService } from './agenda.service';
import { Agenda, Bloqueo, Recurso } from './agenda.schema';
import { CALENDAR_CONNECTORS, CalendarConnector } from './calendar-connector.interface';
import { DomainException } from '../../shared/exceptions/domain.exception';

const AGENDA_ID = new Types.ObjectId();
const COMERCIO_ID = new Types.ObjectId();

/** Lunes 7 de septiembre de 2026. */
const LUNES = new Date('2026-09-07T00:00:00');

const agendaBase = (extra: Record<string, unknown> = {}) => ({
  _id: AGENDA_ID,
  comercioId: COMERCIO_ID,
  activa: true,
  margenMinutos: 0,
  zonaHoraria: 'Europe/Madrid',
  franjas: [{ diaSemana: 1, desde: '09:00', hasta: '12:00' }],
  save: jest.fn().mockResolvedValue(undefined),
  ...extra,
});

describe('AgendaService', () => {
  let service: AgendaService;
  let agendaModel: {
    find: jest.Mock; findById: jest.Mock; findOne: jest.Mock;
    findOneAndUpdate: jest.Mock; create: jest.Mock; updateOne: jest.Mock;
  };
  let recursoModel: { find: jest.Mock; create: jest.Mock };
  let bloqueoModel: {
    find: jest.Mock; findById: jest.Mock; create: jest.Mock;
    updateOne: jest.Mock; deleteMany: jest.Mock;
  };
  let conector: jest.Mocked<CalendarConnector>;

  const conAgenda = (agenda: unknown): void => {
    agendaModel.findById.mockReturnValue({
      select: () => ({ exec: () => Promise.resolve(agenda) }),
      exec: () => Promise.resolve(agenda),
    });
    agendaModel.findOne.mockReturnValue({ exec: () => Promise.resolve(agenda) });
  };

  const conBloqueos = (bloqueos: unknown[]): void => {
    bloqueoModel.find.mockReturnValue({
      sort: () => ({ lean: () => ({ exec: () => Promise.resolve(bloqueos) }) }),
    });
  };

  beforeEach(async () => {
    agendaModel = {
      find: jest.fn().mockReturnValue({ sort: () => ({ exec: () => Promise.resolve([]) }) }),
      findById: jest.fn(),
      findOne: jest.fn(),
      findOneAndUpdate: jest.fn().mockReturnValue({ exec: () => Promise.resolve(null) }),
      create: jest.fn().mockImplementation((d) => Promise.resolve(d)),
      updateOne: jest.fn().mockReturnValue({ exec: () => Promise.resolve({}) }),
    };
    recursoModel = {
      find: jest.fn().mockReturnValue({ exec: () => Promise.resolve([]) }),
      create: jest.fn().mockImplementation((d) => Promise.resolve(d)),
    };
    bloqueoModel = {
      find: jest.fn(),
      findById: jest.fn().mockReturnValue({ exec: () => Promise.resolve(null) }),
      create: jest.fn().mockImplementation((d) => Promise.resolve(d)),
      updateOne: jest.fn().mockReturnValue({ exec: () => Promise.resolve({}) }),
      deleteMany: jest.fn().mockReturnValue({ exec: () => Promise.resolve({ deletedCount: 0 }) }),
    };
    conector = {
      proveedor: 'google',
      urlAutorizacion: jest.fn().mockReturnValue('https://google/auth'),
      canjearCodigo: jest.fn(),
      refrescar: jest.fn(),
      listarEventos: jest.fn().mockResolvedValue([]),
      crearEvento: jest.fn(),
      eliminarEvento: jest.fn(),
    } as unknown as jest.Mocked<CalendarConnector>;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AgendaService,
        { provide: getModelToken(Agenda.name), useValue: agendaModel },
        { provide: getModelToken(Recurso.name), useValue: recursoModel },
        { provide: getModelToken(Bloqueo.name), useValue: bloqueoModel },
        { provide: CALENDAR_CONNECTORS, useValue: [conector] },
      ],
    }).compile();

    service = module.get(AgendaService);
    conAgenda(agendaBase());
    conBloqueos([]);
  });

  describe('huecosDe', () => {
    it('debería generar los huecos de la jornada declarada', async () => {
      const huecos = await service.huecosDe(AGENDA_ID.toString(), LUNES, 60);

      expect(huecos).toHaveLength(3);
      expect(huecos[0].inicio.getHours()).toBe(9);
      expect(huecos[2].inicio.getHours()).toBe(11);
    });

    it('no debería ofrecer huecos un día sin jornada', async () => {
      const domingo = new Date('2026-09-06T00:00:00');

      await expect(service.huecosDe(AGENDA_ID.toString(), domingo, 60)).resolves.toEqual([]);
    });

    it('debería respetar el margen entre citas', async () => {
      conAgenda(agendaBase({ margenMinutos: 30 }));

      const huecos = await service.huecosDe(AGENDA_ID.toString(), LUNES, 60);

      // 09:00 y 10:30 caben; a las 12:00 ya cierra.
      expect(huecos).toHaveLength(2);
      expect(huecos[1].inicio.getHours()).toBe(10);
      expect(huecos[1].inicio.getMinutes()).toBe(30);
    });

    it('debería saltar por encima de un bloqueo, no ofrecer esa franja', async () => {
      conBloqueos([{
        inicio: new Date('2026-09-07T09:00:00'),
        fin: new Date('2026-09-07T10:00:00'),
      }]);

      const huecos = await service.huecosDe(AGENDA_ID.toString(), LUNES, 60);

      expect(huecos).toHaveLength(2);
      expect(huecos[0].inicio.getHours()).toBe(10);
    });

    it('debería soportar jornada partida como dos franjas del mismo día', async () => {
      conAgenda(agendaBase({
        franjas: [
          { diaSemana: 1, desde: '09:00', hasta: '11:00' },
          { diaSemana: 1, desde: '16:00', hasta: '18:00' },
        ],
      }));

      const huecos = await service.huecosDe(AGENDA_ID.toString(), LUNES, 60);

      expect(huecos.map((h) => h.inicio.getHours())).toEqual([9, 10, 16, 17]);
    });

    it('no debería ofrecer nada si la agenda está desactivada', async () => {
      conAgenda(agendaBase({ activa: false }));

      await expect(service.huecosDe(AGENDA_ID.toString(), LUNES, 60)).resolves.toEqual([]);
    });

    it('no debería ofrecer una cita que no cabe antes del cierre', async () => {
      const huecos = await service.huecosDe(AGENDA_ID.toString(), LUNES, 120);

      // Jornada de 09:00 a 12:00: solo cabe una cita de dos horas, porque los
      // huecos son consecutivos, no solapados.
      expect(huecos).toHaveLength(1);
      expect(huecos[0].inicio.getHours()).toBe(9);
      expect(huecos[0].fin.getHours()).toBe(11);
    });
  });

  describe('bloquear', () => {
    it('debería exigir que el bloqueo termine después de empezar', async () => {
      await expect(
        service.bloquear(
          AGENDA_ID.toString(), COMERCIO_ID.toString(),
          new Date('2026-09-07T12:00:00'), new Date('2026-09-07T10:00:00'),
        ),
      ).rejects.toThrow(DomainException);
    });

    it('debería lanzar 404 si la agenda no es del comercio', async () => {
      agendaModel.findOne.mockReturnValue({ exec: () => Promise.resolve(null) });

      await expect(
        service.bloquear(
          AGENDA_ID.toString(), COMERCIO_ID.toString(),
          new Date('2026-09-07T10:00:00'), new Date('2026-09-07T12:00:00'),
        ),
      ).rejects.toThrow(DomainException);
    });
  });

  describe('desbloquear', () => {
    it('no debería permitir borrar aquí un bloqueo del calendario externo', async () => {
      bloqueoModel.findById.mockReturnValue({
        exec: () => Promise.resolve({ agendaId: AGENDA_ID, origen: 'externo' }),
      });

      await expect(
        service.desbloquear(new Types.ObjectId().toString(), COMERCIO_ID.toString()),
      ).rejects.toThrow(DomainException);
    });

    it('debería borrar un bloqueo manual', async () => {
      const bloqueo = {
        agendaId: AGENDA_ID, origen: 'manual',
        deleteOne: jest.fn().mockResolvedValue(undefined),
      };
      bloqueoModel.findById.mockReturnValue({ exec: () => Promise.resolve(bloqueo) });

      await service.desbloquear(new Types.ObjectId().toString(), COMERCIO_ID.toString());

      expect(bloqueo.deleteOne).toHaveBeenCalled();
    });
  });

  describe('sincronizar', () => {
    const tokensVigentes = {
      accessToken: 'a', refreshToken: 'r',
      expiraEn: new Date(Date.now() + 3_600_000),
    };

    it('no debería hacer nada si la agenda no tiene calendario conectado', async () => {
      const resultado = await service.sincronizar(AGENDA_ID.toString());

      expect(resultado).toEqual({ importados: 0, eliminados: 0 });
      expect(conector.listarEventos).not.toHaveBeenCalled();
    });

    it('debería reflejar como bloqueo solo los eventos que ocupan', async () => {
      conAgenda(agendaBase({ proveedor: 'google', tokens: tokensVigentes }));
      conector.listarEventos.mockResolvedValue([
        { externalEventId: 'e1', titulo: 'Cita', inicio: new Date(), fin: new Date(), ocupado: true },
        { externalEventId: 'e2', titulo: 'Libre', inicio: new Date(), fin: new Date(), ocupado: false },
      ]);

      const resultado = await service.sincronizar(AGENDA_ID.toString());

      expect(resultado.importados).toBe(1);
      expect(bloqueoModel.updateOne).toHaveBeenCalledTimes(1);
    });

    it('debería limpiar los bloqueos de eventos que ya no existen fuera', async () => {
      conAgenda(agendaBase({ proveedor: 'google', tokens: tokensVigentes }));
      conector.listarEventos.mockResolvedValue([
        { externalEventId: 'e1', titulo: 'Cita', inicio: new Date(), fin: new Date(), ocupado: true },
      ]);

      await service.sincronizar(AGENDA_ID.toString());

      const filtro = bloqueoModel.deleteMany.mock.calls[0][0] as Record<string, unknown>;
      expect(filtro['origen']).toBe('externo');
      expect(filtro['externalEventId']).toEqual({ $nin: ['e1'] });
    });

    it('debería refrescar el acceso caducado sin volver a pedir permiso', async () => {
      conAgenda(agendaBase({
        proveedor: 'google',
        tokens: { accessToken: 'viejo', refreshToken: 'r', expiraEn: new Date(Date.now() - 1000) },
      }));
      conector.refrescar.mockResolvedValue({
        accessToken: 'nuevo', refreshToken: 'r', expiraEn: new Date(Date.now() + 3_600_000),
      });

      await service.sincronizar(AGENDA_ID.toString());

      expect(conector.refrescar).toHaveBeenCalledWith('r');
      expect(conector.listarEventos.mock.calls[0][0].accessToken).toBe('nuevo');
    });

    it('no debería tumbar la agenda si el proveedor falla', async () => {
      conAgenda(agendaBase({ proveedor: 'google', tokens: tokensVigentes }));
      conector.listarEventos.mockRejectedValue(new Error('Google caído'));

      await expect(service.sincronizar(AGENDA_ID.toString())).resolves.toEqual({
        importados: 0, eliminados: 0,
      });
    });
  });

  describe('conector', () => {
    it('debería resolver el proveedor registrado', () => {
      expect(service.conector('google').proveedor).toBe('google');
    });

    it('debería rechazar un proveedor desconocido', () => {
      expect(() => service.conector('microsoft')).toThrow(DomainException);
    });
  });

  describe('desconectarCalendario', () => {
    it('debería retirar los bloqueos externos al desconectar', async () => {
      await service.desconectarCalendario(AGENDA_ID.toString(), COMERCIO_ID.toString());

      expect(bloqueoModel.deleteMany).toHaveBeenCalledWith(
        expect.objectContaining({ origen: 'externo' }),
      );
    });
  });
});
