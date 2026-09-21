import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { EstadoPresupuesto, VerticalKey } from 'shared';
import { BookingsService } from '../bookings/bookings.service';
import { Servicio } from '../catalog/servicio.schema';
import { DomainException } from '../../shared/exceptions/domain.exception';
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
  let servicioModel: { findById: jest.Mock };

  const mockServicio = (doc: unknown): void => {
    servicioModel.findById = jest.fn().mockReturnValue({
      select: jest.fn().mockReturnThis(),
      lean: jest.fn().mockReturnThis(),
      exec: jest.fn().mockResolvedValue(doc),
    });
  };

  beforeEach(async () => {
    servicioModel = { findById: jest.fn() };
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
      ],
    }).compile();

    service = module.get(PresupuestosService);
    repo = module.get(PresupuestosRepository);
    bookings = module.get(BookingsService);
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
