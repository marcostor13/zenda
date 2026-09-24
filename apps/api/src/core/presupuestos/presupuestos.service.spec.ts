import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { EstadoPresupuesto, VerticalKey } from 'shared';
import { BookingsService } from '../bookings/bookings.service';
import { Servicio } from '../catalog/servicio.schema';
import { NotificationsService } from '../notifications/notifications.service';
import { DomainException } from '../../shared/exceptions/domain.exception';
import { Presupuesto } from './presupuesto.schema';
import { PresupuestosRepository } from './presupuestos.repository';
import { PresupuestosService } from './presupuestos.service';

/** Documento de presupuesto con `save()` que devuelve el propio objeto. */
const documento = (parcial: Record<string, unknown> = {}) => {
  const doc: Record<string, unknown> = {
    _id: 'pre-1',
    codigo: 'PRE-ABC12345',
    usuarioId: 'u1',
    comercioId: 'c1',
    servicioId: 's1',
    vertical: VerticalKey.TRANSPORTE,
    fechaServicio: new Date('2026-12-01T09:00:00Z'),
    solicitud: { origen: 'Valencia', destino: 'París', mascotas: 2 },
    estado: EstadoPresupuesto.SOLICITADO,
    moneda: 'EUR',
    ...parcial,
  };
  doc['save'] = jest.fn().mockResolvedValue(doc);
  return doc as Record<string, unknown> & { save: jest.Mock };
};

describe('PresupuestosService', () => {
  let service: PresupuestosService;
  let repo: jest.Mocked<PresupuestosRepository>;
  let bookings: jest.Mocked<BookingsService>;
  let servicioModel: { findById: jest.Mock; find: jest.Mock };
  let notifications: jest.Mocked<Pick<NotificationsService, 'notificarSolicitudPresupuesto' | 'notificarPresupuestoRecibido'>>;

  const consulta = (doc: unknown) => ({
    select: jest.fn().mockReturnThis(),
    lean: jest.fn().mockReturnThis(),
    exec: jest.fn().mockResolvedValue(doc),
  });

  const mockServicio = (doc: unknown): void => {
    servicioModel.findById = jest.fn().mockReturnValue(consulta(doc));
  };

  beforeEach(async () => {
    servicioModel = { findById: jest.fn(), find: jest.fn() };
    mockServicio({ comercioId: 'c1', vertical: VerticalKey.TRANSPORTE });

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PresupuestosService,
        {
          provide: PresupuestosRepository,
          useValue: {
            crear: jest.fn(), porId: jest.fn(), porCodigo: jest.fn(),
            delUsuario: jest.fn(), delComercio: jest.fn(), abiertoDe: jest.fn(),
          },
        },
        { provide: BookingsService, useValue: { crear: jest.fn() } },
        { provide: getModelToken(Servicio.name), useValue: servicioModel },
        {
          provide: NotificationsService,
          useValue: {
            notificarSolicitudPresupuesto: jest.fn().mockResolvedValue(undefined),
            notificarPresupuestoRecibido: jest.fn().mockResolvedValue(undefined),
          },
        },
      ],
    }).compile();

    service = module.get(PresupuestosService);
    repo = module.get(PresupuestosRepository);
    bookings = module.get(BookingsService);
    notifications = module.get(NotificationsService);
  });

  it('debería delegar en el repositorio las listas de cliente y de comercio', async () => {
    repo.delUsuario.mockResolvedValue([]);
    repo.delComercio.mockResolvedValue([]);

    await service.misPresupuestos('u1');
    await service.delComercio('c1', EstadoPresupuesto.OFERTADO);

    expect(repo.delUsuario).toHaveBeenCalledWith('u1');
    expect(repo.delComercio).toHaveBeenCalledWith('c1', EstadoPresupuesto.OFERTADO);
  });

  describe('titulosDeServicios', () => {
    const presupuestos = (...servicioIds: string[]): Presupuesto[] =>
      servicioIds.map((servicioId) => ({ servicioId }) as unknown as Presupuesto);

    it('no debería consultar nada sin presupuestos', async () => {
      await expect(service.titulosDeServicios([])).resolves.toEqual(new Map());
      expect(servicioModel.find).not.toHaveBeenCalled();
    });

    it('debería buscar cada servicio una sola vez y dejar vacío el que no tiene título', async () => {
      servicioModel.find.mockReturnValue(consulta([{ _id: 's1', titulo: 'Transportes Fido' }, { _id: 's2' }]));

      const titulos = await service.titulosDeServicios(presupuestos('s1', 's2', 's1'));

      expect(servicioModel.find).toHaveBeenCalledWith({ _id: { $in: ['s1', 's2'] } });
      expect(titulos).toEqual(new Map([['s1', 'Transportes Fido'], ['s2', '']]));
    });
  });

  describe('solicitar', () => {
    it('debería guardar la solicitud con el comercio y el vertical del servicio', async () => {
      repo.abiertoDe.mockResolvedValue(null);
      repo.crear.mockImplementation(async (datos) => documento(datos) as never);

      await service.solicitar({
        usuarioId: 'u1', servicioId: 's1',
        fechaServicio: new Date('2026-12-01T09:00:00Z'),
        solicitud: { origen: 'Valencia' },
      });

      expect(repo.crear).toHaveBeenCalledWith(expect.objectContaining({
        comercioId: 'c1', vertical: VerticalKey.TRANSPORTE, estado: EstadoPresupuesto.SOLICITADO,
      }));
      expect(notifications.notificarSolicitudPresupuesto).toHaveBeenCalledWith(expect.objectContaining({
        comercioId: 'c1', servicio: 'Tu servicio', resumen: [],
      }));
    });

    it('debería avisar a la empresa con el título del servicio y las filas legibles del resumen', async () => {
      mockServicio({ comercioId: 'c1', vertical: VerticalKey.TRANSPORTE, titulo: 'Transportes Fido' });
      repo.abiertoDe.mockResolvedValue(null);
      repo.crear.mockImplementation(async (datos) => documento(datos) as never);
      const larga = 'x'.repeat(400);

      await service.solicitar({
        usuarioId: 'u1', servicioId: 's1',
        fechaServicio: new Date('2026-12-01T09:00:00Z'),
        solicitud: { resumen: [['Recogida', 'Castellón'], ['mal'], 'suelta', ['Nota', larga]] },
      });

      expect(notifications.notificarSolicitudPresupuesto).toHaveBeenCalledWith({
        comercioId: 'c1',
        codigo: expect.stringMatching(/^PRE-/),
        servicio: 'Transportes Fido',
        fechaServicio: new Date('2026-12-01T09:00:00Z'),
        resumen: [['Recogida', 'Castellón'], ['Nota', 'x'.repeat(300)]],
      });
    });

    /** Pulsar dos veces no puede llenar la bandeja de la empresa de duplicados. */
    it('debería devolver la solicitud abierta en vez de crear otra', async () => {
      const abierto = documento();
      repo.abiertoDe.mockResolvedValue(abierto as never);

      const resultado = await service.solicitar({
        usuarioId: 'u1', servicioId: 's1',
        fechaServicio: new Date(), solicitud: {},
      });

      expect(resultado).toBe(abierto);
      expect(repo.crear).not.toHaveBeenCalled();
    });

    it('debería rechazar un servicio que no existe', async () => {
      mockServicio(null);

      await expect(service.solicitar({
        usuarioId: 'u1', servicioId: 'no-existe',
        fechaServicio: new Date(), solicitud: {},
      })).rejects.toThrow(DomainException);
    });
  });

  describe('ofertar', () => {
    it('debería guardar el importe y dejarlo ofertado con fecha de validez', async () => {
      const doc = documento();
      repo.porId.mockResolvedValue(doc as never);

      const resultado = await service.ofertar('pre-1', 'c1', { importe: 480.5, validezHoras: 24 });

      expect(resultado.estado).toBe(EstadoPresupuesto.OFERTADO);
      expect(resultado.importe).toBe(480.5);
      expect(resultado.validoHasta).toBeInstanceOf(Date);
    });

    it('debería avisar al cliente con el nombre de la empresa y la validez por defecto de 48 h', async () => {
      const doc = documento();
      repo.porId.mockResolvedValue(doc as never);
      mockServicio({ titulo: 'Transportes Fido' });
      const antes = Date.now();

      await service.ofertar('pre-1', 'c1', { importe: 99.999, condiciones: 'Pago por adelantado' });

      const aviso = notifications.notificarPresupuestoRecibido.mock.calls[0][0];
      expect(aviso).toMatchObject({
        usuarioId: 'u1', codigo: 'PRE-ABC12345', empresa: 'Transportes Fido', importe: 100, condiciones: 'Pago por adelantado',
      });
      expect(aviso.validoHasta.getTime()).toBeGreaterThanOrEqual(antes + 48 * 3_600_000);
    });

    it('debería avisar con un nombre genérico si el servicio ya no existe', async () => {
      repo.porId.mockResolvedValue(documento({ estado: EstadoPresupuesto.OFERTADO }) as never);
      mockServicio(null);

      await service.ofertar('pre-1', 'c1', { importe: 100 });

      expect(notifications.notificarPresupuestoRecibido).toHaveBeenCalledWith(expect.objectContaining({ empresa: 'La empresa' }));
    });

    it('debería impedir que otra empresa responda al presupuesto', async () => {
      repo.porId.mockResolvedValue(documento() as never);

      await expect(service.ofertar('pre-1', 'otro-comercio', { importe: 100 }))
        .rejects.toMatchObject({ statusCode: 403 });
    });

    it('debería rechazar un importe que no es un importe', async () => {
      repo.porId.mockResolvedValue(documento() as never);

      await expect(service.ofertar('pre-1', 'c1', { importe: 0 }))
        .rejects.toMatchObject({ statusCode: 400 });
    });

    it('no debería admitir ofertas sobre un presupuesto ya aceptado', async () => {
      repo.porId.mockResolvedValue(documento({ estado: EstadoPresupuesto.ACEPTADO }) as never);

      await expect(service.ofertar('pre-1', 'c1', { importe: 100 }))
        .rejects.toMatchObject({ statusCode: 409 });
    });
  });

  describe('aceptar', () => {
    const ofertado = () => documento({
      estado: EstadoPresupuesto.OFERTADO,
      importe: 480,
      validoHasta: new Date(Date.now() + 60 * 60 * 1000),
    });

    /**
     * El corazón del flujo: el cliente no vuelve a rellenar nada. La reserva
     * se crea con lo que ya describió y con el importe pactado.
     */
    it('debería crear la reserva con la solicitud original y el importe pactado', async () => {
      repo.porId.mockResolvedValue(ofertado() as never);
      bookings.crear.mockResolvedValue({ _id: 'res-1' } as never);

      const resultado = await service.aceptar('pre-1', 'u1');

      expect(bookings.crear).toHaveBeenCalledWith(expect.objectContaining({
        servicioId: 's1',
        precioAcordado: 480,
        detalle: expect.objectContaining({ origen: 'Valencia', destino: 'París' }),
      }));
      expect(resultado.estado).toBe(EstadoPresupuesto.ACEPTADO);
      expect(String(resultado.reservaId)).toBe('res-1');
    });

    it('debería añadir al detalle lo que el cliente completa al aceptar, con el perro y el código', async () => {
      repo.porId.mockResolvedValue(documento({
        estado: EstadoPresupuesto.OFERTADO, importe: 480, validoHasta: new Date(Date.now() + 60 * 60 * 1000), perroId: 'perro-1',
      }) as never);
      bookings.crear.mockResolvedValue({ _id: 'res-1' } as never);

      await service.aceptar('pre-1', 'u1', { entrega: { quien: 'yo' }, origen: 'Castellón' });

      expect(bookings.crear).toHaveBeenCalledWith({
        usuarioId: 'u1',
        servicioId: 's1',
        perroId: 'perro-1',
        fechaInicio: new Date('2026-12-01T09:00:00Z'),
        detalle: {
          origen: 'Castellón', destino: 'París', mascotas: 2,
          entrega: { quien: 'yo' }, presupuestoCodigo: 'PRE-ABC12345',
        },
        precioAcordado: 480,
      });
    });

    it('debería marcar caducada una oferta pasada de plazo, sin crear reserva', async () => {
      repo.porId.mockResolvedValue(documento({
        estado: EstadoPresupuesto.OFERTADO,
        importe: 480,
        validoHasta: new Date(Date.now() - 1000),
      }) as never);

      await expect(service.aceptar('pre-1', 'u1')).rejects.toMatchObject({ statusCode: 409 });
      expect(bookings.crear).not.toHaveBeenCalled();
    });

    it('no debería aceptar un presupuesto que todavía no tiene oferta', async () => {
      repo.porId.mockResolvedValue(documento() as never);

      await expect(service.aceptar('pre-1', 'u1')).rejects.toMatchObject({ statusCode: 409 });
    });

    it('debería impedir aceptar el presupuesto de otra persona', async () => {
      repo.porId.mockResolvedValue(ofertado() as never);

      await expect(service.aceptar('pre-1', 'otro-usuario'))
        .rejects.toMatchObject({ statusCode: 403 });
    });
  });

  describe('rechazar', () => {
    it('debería guardar el motivo del rechazo', async () => {
      repo.porId.mockResolvedValue(documento({ estado: EstadoPresupuesto.OFERTADO }) as never);

      const resultado = await service.rechazar('pre-1', 'u1', 'Demasiado caro');

      expect(resultado.estado).toBe(EstadoPresupuesto.RECHAZADO);
      expect(resultado.motivoRechazo).toBe('Demasiado caro');
    });

    it('no debería rechazar lo que ya es una reserva', async () => {
      repo.porId.mockResolvedValue(documento({ estado: EstadoPresupuesto.ACEPTADO }) as never);

      await expect(service.rechazar('pre-1', 'u1')).rejects.toMatchObject({ statusCode: 409 });
    });
  });

  it('debería devolver 404 cuando el presupuesto no existe', async () => {
    repo.porId.mockResolvedValue(null);

    await expect(service.aceptar('no-existe', 'u1')).rejects.toMatchObject({ statusCode: 404 });
  });
});
