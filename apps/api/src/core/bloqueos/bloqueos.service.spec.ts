import { Test } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { Types } from 'mongoose';
import { BloqueosService } from './bloqueos.service';
import { BloqueoServicio } from './bloqueo-servicio.schema';
import { Reserva } from '../bookings/reserva.schema';
import { Servicio } from '../catalog/servicio.schema';
import { DomainException } from '../../shared/exceptions/domain.exception';

describe('BloqueosService', () => {
  let service: BloqueosService;
  let bloqueoModel: Record<string, jest.Mock>;
  let reservaModel: Record<string, jest.Mock>;
  let servicioModel: Record<string, jest.Mock>;

  const COMERCIO = new Types.ObjectId().toString();
  const SERVICIO = new Types.ObjectId().toString();
  const BLOQUEO = new Types.ObjectId().toString();

  /** Encadenable de mongoose: `.find().sort().lean().exec()`. */
  const cadena = (resultado: unknown) => ({
    select: jest.fn().mockReturnThis(),
    sort: jest.fn().mockReturnThis(),
    populate: jest.fn().mockReturnThis(),
    lean: jest.fn().mockReturnThis(),
    exec: jest.fn().mockResolvedValue(resultado),
  });

  const bloqueoGuardado = (extra: Record<string, unknown> = {}) => ({
    _id: 'b1',
    servicioId: SERVICIO,
    desde: new Date('2026-09-01'),
    hasta: new Date('2026-09-03'),
    motivo: 'Vacaciones',
    ...extra,
  });

  beforeEach(async () => {
    bloqueoModel = {
      find: jest.fn().mockReturnValue(cadena([])),
      findOne: jest.fn().mockReturnValue(cadena(null)),
      findOneAndDelete: jest.fn().mockReturnValue(cadena(bloqueoGuardado())),
      create: jest.fn().mockResolvedValue(bloqueoGuardado()),
    };
    reservaModel = { find: jest.fn().mockReturnValue(cadena([])) };
    servicioModel = { findOne: jest.fn().mockReturnValue(cadena({ _id: SERVICIO })) };

    const ref = await Test.createTestingModule({
      providers: [
        BloqueosService,
        { provide: getModelToken(BloqueoServicio.name), useValue: bloqueoModel },
        { provide: getModelToken(Reserva.name), useValue: reservaModel },
        { provide: getModelToken(Servicio.name), useValue: servicioModel },
      ],
    }).compile();

    service = ref.get(BloqueosService);
  });

  describe('crear', () => {
    const dto = { servicioId: SERVICIO, desde: '2026-09-01', hasta: '2026-09-03', motivo: 'Vacaciones' };

    it('debería cerrar el tramo pedido', async () => {
      const creado = await service.crear(COMERCIO, dto);

      expect(bloqueoModel['create']).toHaveBeenCalledWith(
        expect.objectContaining({ motivo: 'Vacaciones' }),
      );
      expect(creado.motivo).toBe('Vacaciones');
    });

    /**
     * Multi-tenant: sin esta comprobación un comercio podría cerrarle la agenda
     * a otro pasando su `servicioId`.
     */
    it('debería rechazar un servicio que no es del comercio', async () => {
      servicioModel['findOne'].mockReturnValue(cadena(null));

      await expect(service.crear(COMERCIO, dto)).rejects.toThrow(DomainException);
      expect(bloqueoModel['create']).not.toHaveBeenCalled();
    });

    it('debería rechazar un tramo que acaba antes de empezar', async () => {
      await expect(service.crear(COMERCIO, { ...dto, hasta: '2026-08-30' }))
        .rejects.toThrow('posterior a su inicio');
    });

    it('debería rechazar un tramo de duración cero', async () => {
      await expect(service.crear(COMERCIO, { ...dto, hasta: dto.desde }))
        .rejects.toThrow(DomainException);
    });

    it('debería limpiar los espacios sobrantes del motivo', async () => {
      await service.crear(COMERCIO, { ...dto, motivo: '  Obras en la nave  ' });

      expect(bloqueoModel['create']).toHaveBeenCalledWith(
        expect.objectContaining({ motivo: 'Obras en la nave' }),
      );
    });

    it('debería guardar quién lo cerró', async () => {
      const usuario = new Types.ObjectId().toString();

      await service.crear(COMERCIO, dto, usuario);

      expect(bloqueoModel['create']).toHaveBeenCalledWith(
        expect.objectContaining({ creadoPor: expect.anything() }),
      );
    });
  });

  describe('listar', () => {
    it('debería acotar al comercio de la sesión', async () => {
      await service.listar(COMERCIO);

      const filtro = bloqueoModel['find'].mock.calls.at(-1)![0] as Record<string, unknown>;
      expect(filtro['comercioId']).toBeDefined();
    });

    /**
     * Solapamiento, no contención: un bloqueo de agosto entero tiene que salir
     * al mirar la semana del 15, aunque ni empiece ni acabe dentro de ella.
     */
    it('debería traer los bloqueos que solapan el rango, no sólo los contenidos', async () => {
      await service.listar(COMERCIO, {
        desde: new Date('2026-08-15'), hasta: new Date('2026-08-22'),
      });

      const filtro = bloqueoModel['find'].mock.calls.at(-1)![0] as Record<string, Record<string, Date>>;
      expect(filtro['desde']['$lt']).toEqual(new Date('2026-08-22'));
      expect(filtro['hasta']['$gt']).toEqual(new Date('2026-08-15'));
    });

    it('debería poder acotar a un servicio', async () => {
      await service.listar(COMERCIO, { servicioId: SERVICIO });

      const filtro = bloqueoModel['find'].mock.calls.at(-1)![0] as Record<string, unknown>;
      expect(filtro['servicioId']).toBeDefined();
    });
  });

  describe('eliminar', () => {
    it('debería reabrir el tramo', async () => {
      await expect(service.eliminar(COMERCIO, BLOQUEO)).resolves.toBeUndefined();
    });

    it('debería lanzar 404 si el bloqueo no es de ese comercio', async () => {
      bloqueoModel['findOneAndDelete'].mockReturnValue(cadena(null));

      await expect(service.eliminar(COMERCIO, BLOQUEO)).rejects.toThrow(DomainException);
    });
  });

  describe('actualizar', () => {
    /** Documento hidratado: `actualizar` lo modifica y lo guarda, no usa `lean`. */
    const documento = (extra: Record<string, unknown> = {}) => ({
      ...bloqueoGuardado({ cantidad: 2, ...extra }),
      save: jest.fn().mockResolvedValue(undefined),
    });

    const conDocumento = (doc: Record<string, unknown>): void => {
      bloqueoModel['findOne'].mockReturnValue({ exec: jest.fn().mockResolvedValue(doc) });
    };

    it('debería cambiar el motivo y las fechas del tramo', async () => {
      const doc = documento();
      conDocumento(doc);

      const actualizado = await service.actualizar(COMERCIO, BLOQUEO, {
        desde: '2026-09-05', hasta: '2026-09-08', motivo: '  Obras  ',
      });

      expect(doc.save).toHaveBeenCalled();
      expect(actualizado.motivo).toBe('Obras');
      expect(actualizado.hasta).toBe(new Date('2026-09-08').toISOString());
    });

    it('debería dejar como está lo que no viene en la petición', async () => {
      const doc = documento();
      conDocumento(doc);

      const actualizado = await service.actualizar(COMERCIO, BLOQUEO, { motivo: 'Obras' });

      expect(actualizado.cantidad).toBe(2);
      expect(actualizado.desde).toBe(new Date('2026-09-01').toISOString());
    });

    /**
     * `null` es la orden explícita de pasar a cerrar el servicio entero; sin esa
     * distinción, un cierre parcial no se podría convertir nunca en uno total.
     */
    it('debería pasar a cierre total con cantidad null', async () => {
      const doc = documento();
      conDocumento(doc);

      const actualizado = await service.actualizar(COMERCIO, BLOQUEO, { cantidad: null });

      expect(actualizado.cantidad).toBeUndefined();
    });

    it('debería rechazar un tramo que termina antes de empezar', async () => {
      conDocumento(documento());

      await expect(service.actualizar(COMERCIO, BLOQUEO, { hasta: '2026-08-01' }))
        .rejects.toThrow(DomainException);
    });

    it('debería lanzar 404 si el bloqueo no es de ese comercio', async () => {
      // Multi-tenant: el filtro lleva el comercio de la sesión, nunca el del cuerpo.
      bloqueoModel['findOne'].mockReturnValue({ exec: jest.fn().mockResolvedValue(null) });

      await expect(service.actualizar(COMERCIO, BLOQUEO, { motivo: 'Obras' }))
        .rejects.toThrow(DomainException);
    });
  });

  describe('cierreQueSolapa', () => {
    it('debería mirar sólo los cierres totales', async () => {
      // Los parciales restan inventario; no cortan la reserva.
      await service.cierreQueSolapa(SERVICIO, new Date('2026-09-01'), new Date('2026-09-02'));

      const filtro = bloqueoModel['findOne'].mock.calls.at(-1)![0] as Record<string, unknown>;
      expect(filtro['cantidad']).toEqual({ $in: [null, undefined] });
    });

    it('debería tratar una cita sin fin como un instante', async () => {
      await service.cierreQueSolapa(SERVICIO, new Date('2026-09-01T10:00:00Z'));

      const filtro = bloqueoModel['findOne'].mock.calls.at(-1)![0] as Record<string, Record<string, Date>>;
      expect(filtro['hasta']['$gt']).toEqual(new Date('2026-09-01T10:00:00Z'));
    });

    it('debería devolver null cuando no hay nada cerrado', async () => {
      await expect(service.cierreQueSolapa(SERVICIO, new Date('2026-09-01'))).resolves.toBeNull();
    });
  });

  describe('listarCitas', () => {
    it('debería devolver las reservas vivas con su cliente y su perro', async () => {
      reservaModel['find'].mockReturnValue(cadena([{
        _id: 'r1', codigo: 'RES-1', servicioId: SERVICIO,
        fechaInicio: new Date('2026-09-01T10:00:00Z'),
        fechaFin: new Date('2026-09-01T11:00:00Z'),
        estado: 'confirmada',
        usuarioId: { nombre: 'Ana' },
        perroSnapshot: { nombre: 'Toby' },
      }]));

      const citas = await service.listarCitas(COMERCIO, new Date('2026-09-01'), new Date('2026-09-02'));

      expect(citas[0]).toMatchObject({ codigo: 'RES-1', cliente: 'Ana', perro: 'Toby' });
    });

    it('debería dar un día completo a la cita que no declara fin', async () => {
      // Es lo que la agenda tiene que pintar; sin fin no habría nada que dibujar.
      reservaModel['find'].mockReturnValue(cadena([{
        _id: 'r1', codigo: 'RES-1', servicioId: SERVICIO,
        fechaInicio: new Date('2026-09-01T00:00:00Z'), estado: 'pendiente',
      }]));

      const citas = await service.listarCitas(COMERCIO, new Date('2026-09-01'), new Date('2026-09-03'));

      expect(citas[0].hasta).toBe(new Date('2026-09-02T00:00:00Z').toISOString());
    });

    it('debería aguantar una reserva sin cliente poblado', async () => {
      reservaModel['find'].mockReturnValue(cadena([{
        _id: 'r1', codigo: 'RES-1', servicioId: SERVICIO,
        fechaInicio: new Date('2026-09-01'), estado: 'pendiente',
      }]));

      const citas = await service.listarCitas(COMERCIO, new Date('2026-09-01'), new Date('2026-09-02'));

      expect(citas[0].cliente).toBe('Cliente');
    });
  });
});
