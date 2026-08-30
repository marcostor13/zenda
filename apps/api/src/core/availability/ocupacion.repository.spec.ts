import { Test } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { Reserva } from '../bookings/reserva.schema';
import { BloqueoServicio } from '../bloqueos/bloqueo-servicio.schema';
import { OcupacionRepository, claveDia, inicioDelDia, nochesDe } from './ocupacion.repository';

describe('nochesDe', () => {
  it('debería devolver las noches de la estancia sin contar la de salida', () => {
    // Del 1 al 4 se duerme el 1, el 2 y el 3: el día 4 ya te has ido.
    expect(nochesDe(new Date('2026-09-01'), new Date('2026-09-04')))
      .toEqual(['2026-09-01', '2026-09-02', '2026-09-03']);
  });

  it('debería devolver una lista vacía si entrada y salida son el mismo día', () => {
    expect(nochesDe(new Date('2026-09-01'), new Date('2026-09-01'))).toEqual([]);
  });
});

describe('claveDia / inicioDelDia', () => {
  it('debería quedarse con la fecha y descartar la hora', () => {
    expect(claveDia(new Date('2026-09-01T23:45:00Z'))).toBe('2026-09-01');
    expect(inicioDelDia(new Date('2026-09-01T23:45:00Z')).toISOString())
      .toBe('2026-09-01T00:00:00.000Z');
  });
});

describe('OcupacionRepository', () => {
  let repositorio: OcupacionRepository;
  let reservaModel: { find: jest.Mock };
  let bloqueoModel: { find: jest.Mock };

  const conReservas = (reservas: unknown[]) => {
    reservaModel.find = jest.fn().mockReturnValue({
      select: jest.fn().mockReturnThis(),
      lean: jest.fn().mockReturnThis(),
      exec: jest.fn().mockResolvedValue(reservas),
    });
  };

  /** Tramos que el comercio ha cerrado por su cuenta, fuera de Doogking. */
  const conBloqueos = (bloqueos: unknown[]) => {
    bloqueoModel.find = jest.fn().mockReturnValue({
      select: jest.fn().mockReturnThis(),
      lean: jest.fn().mockReturnThis(),
      exec: jest.fn().mockResolvedValue(bloqueos),
    });
  };

  beforeEach(async () => {
    reservaModel = { find: jest.fn() };
    bloqueoModel = { find: jest.fn() };
    conReservas([]);
    conBloqueos([]);

    const ref = await Test.createTestingModule({
      providers: [
        OcupacionRepository,
        { provide: getModelToken(Reserva.name), useValue: reservaModel },
        { provide: getModelToken(BloqueoServicio.name), useValue: bloqueoModel },
      ],
    }).compile();

    repositorio = ref.get(OcupacionRepository);
  });

  it('debería contar una plaza por reserva en cada noche que ocupa', async () => {
    conReservas([
      { fechaInicio: new Date('2026-09-01'), fechaFin: new Date('2026-09-03') },
      { fechaInicio: new Date('2026-09-02'), fechaFin: new Date('2026-09-04') },
    ]);

    const ocupacion = await repositorio.nochesOcupadas({
      servicioId: '65b0000000000000000000a1',
      desde: new Date('2026-09-01'),
      hasta: new Date('2026-09-05'),
    });

    expect(ocupacion.get('2026-09-01')).toBe(1);
    // La única noche que solapan las dos reservas.
    expect(ocupacion.get('2026-09-02')).toBe(2);
    expect(ocupacion.get('2026-09-03')).toBe(1);
    expect(ocupacion.has('2026-09-04')).toBe(false);
  });

  it('debería contar una noche cuando la reserva no tiene fecha de fin', async () => {
    conReservas([{ fechaInicio: new Date('2026-09-01') }]);

    const ocupacion = await repositorio.nochesOcupadas({
      servicioId: '65b0000000000000000000a1',
      desde: new Date('2026-09-01'),
      hasta: new Date('2026-09-05'),
    });

    expect(ocupacion.get('2026-09-01')).toBe(1);
    expect(ocupacion.has('2026-09-02')).toBe(false);
  });

  it('debería dejar fuera las reservas que ya no ocupan plaza', async () => {
    await repositorio.nochesOcupadas({
      servicioId: '65b0000000000000000000a1',
      desde: new Date('2026-09-01'),
      hasta: new Date('2026-09-05'),
    });

    const filtro = reservaModel.find.mock.calls[0][0] as { estado: { $in: string[] } };
    expect(filtro.estado.$in).toEqual(
      expect.arrayContaining(['pendiente', 'confirmada', 'completada']),
    );
    expect(filtro.estado.$in).not.toContain('cancelada');
    expect(filtro.estado.$in).not.toContain('no_show');
    expect(filtro.estado.$in).not.toContain('reembolsada');
  });

  it('debería filtrar por espacio cuando se indica, para no mezclar suites distintas', async () => {
    await repositorio.nochesOcupadas({
      servicioId: '65b0000000000000000000a1',
      desde: new Date('2026-09-01'),
      hasta: new Date('2026-09-05'),
      espacioId: 'suite-1',
    });

    expect(reservaModel.find.mock.calls[0][0]).toMatchObject({ 'detalle.espacioId': 'suite-1' });
  });
  /**
   * Lo que el comercio cierra por su cuenta cuenta como ocupado: si alquila dos
   * suites por teléfono y no se descuentan, Doogking las sigue vendiendo.
   */
  describe('tramos cerrados por el comercio', () => {
    it('debería restar las unidades cerradas de cada noche', async () => {
      conBloqueos([
        { desde: new Date('2026-09-01'), hasta: new Date('2026-09-03'), cantidad: 2 },
      ]);

      const ocupacion = await repositorio.nochesOcupadas({
        servicioId: '507f1f77bcf86cd799439011',
        desde: new Date('2026-09-01'),
        hasta: new Date('2026-09-05'),
      });

      expect(ocupacion.get('2026-09-01')).toBe(2);
      expect(ocupacion.get('2026-09-02')).toBe(2);
      // La noche de salida no se ocupa, igual que en una estancia.
      expect(ocupacion.get('2026-09-03')).toBeUndefined();
    });

    it('debería sumarse a las reservas que ya ocupaban esa noche', async () => {
      conReservas([{ fechaInicio: new Date('2026-09-01'), fechaFin: new Date('2026-09-02') }]);
      conBloqueos([
        { desde: new Date('2026-09-01'), hasta: new Date('2026-09-02'), cantidad: 3 },
      ]);

      const ocupacion = await repositorio.nochesOcupadas({
        servicioId: '507f1f77bcf86cd799439011',
        desde: new Date('2026-09-01'),
        hasta: new Date('2026-09-03'),
      });

      expect(ocupacion.get('2026-09-01')).toBe(4);
    });

    it('debería agotar el inventario cuando el cierre es total', async () => {
      // Sin `cantidad` el comercio cierra el servicio entero ese día.
      conBloqueos([{ desde: new Date('2026-09-01'), hasta: new Date('2026-09-02') }]);

      const ocupacion = await repositorio.nochesOcupadas({
        servicioId: '507f1f77bcf86cd799439011',
        desde: new Date('2026-09-01'),
        hasta: new Date('2026-09-03'),
      });

      expect(ocupacion.get('2026-09-01')).toBeGreaterThan(1000);
    });

    it('debería cerrar el día de un tramo que no llega a la noche', async () => {
      // Bloquear "el martes de 9 a 14" no genera ninguna noche completa, pero
      // ese día el negocio no atiende.
      conBloqueos([
        { desde: new Date('2026-09-01T09:00:00Z'), hasta: new Date('2026-09-01T14:00:00Z'), cantidad: 1 },
      ]);

      const ocupacion = await repositorio.nochesOcupadas({
        servicioId: '507f1f77bcf86cd799439011',
        desde: new Date('2026-09-01'),
        hasta: new Date('2026-09-03'),
      });

      expect(ocupacion.get('2026-09-01')).toBe(1);
    });

    it('debería acotar los bloqueos al espacio consultado', async () => {
      // Cerrar las suites no cierra las plazas estándar.
      await repositorio.nochesOcupadas({
        servicioId: '507f1f77bcf86cd799439011',
        desde: new Date('2026-09-01'),
        hasta: new Date('2026-09-03'),
        espacioId: 'suite',
      });

      const filtro = bloqueoModel.find.mock.calls.at(-1)![0] as Record<string, unknown>;
      expect(filtro['$or']).toEqual([
        { espacioTipo: 'suite' },
        { espacioTipo: { $in: [null, undefined] } },
      ]);
    });
  });
});
