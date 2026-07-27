import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { Types } from 'mongoose';
import { VerticalKey } from 'shared';
import { CarritoService } from './carrito.service';
import { Carrito } from './carrito.schema';
import { AvailabilityRegistry } from '../availability/availability.registry';
import { BookingsService } from '../bookings/bookings.service';
import { CatalogService } from '../catalog/catalog.service';
import { DomainException } from '../../shared/exceptions/domain.exception';

const USUARIO_ID = new Types.ObjectId().toString();
const COMERCIO_ID = new Types.ObjectId().toString();
const SERVICIO_ID = new Types.ObjectId().toString();

const itemDto = (extra: Record<string, unknown> = {}) => ({
  servicioId: SERVICIO_ID,
  comercioId: COMERCIO_ID,
  vertical: VerticalKey.ALOJAMIENTO,
  fechaInicio: '2026-09-01',
  fechaFin: '2026-09-05',
  ...extra,
});

describe('CarritoService', () => {
  let service: CarritoService;
  let carritoModel: { findOne: jest.Mock; create: jest.Mock; updateOne: jest.Mock };
  let availabilityRegistry: { obtener: jest.Mock };
  let bookingsService: { crear: jest.Mock; cancelar: jest.Mock };
  let catalogService: { obtenerServicio: jest.Mock };
  let estrategia: { checkAvailability: jest.Mock };
  let carritoDoc: {
    _id: Types.ObjectId; estado: string; items: unknown[]; reservaIds: unknown[]; save: jest.Mock;
  };

  /** Reserva devuelta por BookingsService.crear, con lo justo para el checkout. */
  const reservaCreada = (montoSubtotal: number) => ({
    _id: new Types.ObjectId(),
    usuarioId: { toString: () => USUARIO_ID },
    montoSubtotal,
    reservaMadreId: undefined as unknown,
    carritoId: undefined as unknown,
    save: jest.fn().mockImplementation(function (this: unknown) { return Promise.resolve(this); }),
  });

  beforeEach(async () => {
    carritoDoc = {
      _id: new Types.ObjectId(),
      estado: 'abierto',
      items: [],
      reservaIds: [],
      save: jest.fn().mockImplementation(function (this: unknown) { return Promise.resolve(this); }),
    };

    carritoModel = {
      findOne: jest.fn().mockReturnValue({ exec: jest.fn().mockResolvedValue(carritoDoc) }),
      create: jest.fn().mockResolvedValue(carritoDoc),
      updateOne: jest.fn().mockReturnValue({ exec: jest.fn().mockResolvedValue({}) }),
    };

    estrategia = {
      checkAvailability: jest.fn().mockResolvedValue({ disponible: true, precioCalculado: 200 }),
    };
    availabilityRegistry = { obtener: jest.fn().mockReturnValue(estrategia) };

    bookingsService = {
      crear: jest.fn().mockImplementation(() => Promise.resolve(reservaCreada(200))),
      cancelar: jest.fn().mockResolvedValue(undefined),
    };

    catalogService = {
      obtenerServicio: jest.fn().mockResolvedValue({ nombre: 'Residencia Royal', precioPorNoche: 50 }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CarritoService,
        { provide: getModelToken(Carrito.name), useValue: carritoModel },
        { provide: AvailabilityRegistry, useValue: availabilityRegistry },
        { provide: BookingsService, useValue: bookingsService },
        { provide: CatalogService, useValue: catalogService },
      ],
    }).compile();

    service = module.get(CarritoService);
  });

  describe('anadirItem', () => {
    it('debería añadir el servicio con su título y precio estimado', async () => {
      await service.anadirItem(USUARIO_ID, itemDto());

      expect(carritoDoc.items).toHaveLength(1);
      expect(carritoDoc.items[0]).toMatchObject({
        titulo: 'Residencia Royal',
        precioEstimado: 200,
      });
    });

    it('no debería bloquear plaza al añadir: el hold se toma en el checkout', async () => {
      await service.anadirItem(USUARIO_ID, itemDto());

      expect(bookingsService.crear).not.toHaveBeenCalled();
    });

    it('debería rechazar un servicio sin disponibilidad, nombrándolo', async () => {
      estrategia.checkAvailability.mockResolvedValue({ disponible: false });

      await expect(service.anadirItem(USUARIO_ID, itemDto())).rejects.toThrow(DomainException);
      expect(carritoDoc.items).toHaveLength(0);
    });

    it('debería dejar un único eje del viaje al marcar otra reserva madre', async () => {
      await service.anadirItem(USUARIO_ID, itemDto({ esReservaMadre: true }));
      await service.anadirItem(USUARIO_ID, itemDto({ esReservaMadre: true, fechaInicio: '2026-09-02' }));

      const madres = (carritoDoc.items as Array<{ esReservaMadre: boolean }>)
        .filter((i) => i.esReservaMadre);
      expect(madres).toHaveLength(1);
    });
  });

  describe('quitarItem', () => {
    it('debería quitar el servicio del viaje', async () => {
      await service.anadirItem(USUARIO_ID, itemDto());
      const { itemId } = carritoDoc.items[0] as { itemId: string };

      await service.quitarItem(USUARIO_ID, itemId);

      expect(carritoDoc.items).toHaveLength(0);
    });

    it('debería lanzar 404 si el servicio no está en el viaje', async () => {
      await expect(service.quitarItem(USUARIO_ID, 'inexistente')).rejects.toThrow(DomainException);
    });
  });

  describe('validar', () => {
    it('debería revalidar cada servicio por separado', async () => {
      await service.anadirItem(USUARIO_ID, itemDto());
      await service.anadirItem(USUARIO_ID, itemDto({ vertical: VerticalKey.PELUQUERIA }));
      estrategia.checkAvailability.mockClear();

      const resultado = await service.validar(USUARIO_ID);

      expect(estrategia.checkAvailability).toHaveBeenCalledTimes(2);
      expect(resultado.todoDisponible).toBe(true);
    });

    it('debería señalar exactamente qué servicio se ha quedado sin plaza', async () => {
      await service.anadirItem(USUARIO_ID, itemDto());
      estrategia.checkAvailability.mockResolvedValue({ disponible: false });

      const resultado = await service.validar(USUARIO_ID);

      expect(resultado.todoDisponible).toBe(false);
      expect(resultado.items[0]).toMatchObject({ titulo: 'Residencia Royal', disponible: false });
    });
  });

  describe('checkout', () => {
    it('debería lanzar 400 si el viaje está vacío', async () => {
      await expect(service.checkout(USUARIO_ID)).rejects.toThrow(DomainException);
    });

    it('debería crear una reserva independiente por servicio', async () => {
      await service.anadirItem(USUARIO_ID, itemDto());
      await service.anadirItem(USUARIO_ID, itemDto({ vertical: VerticalKey.PELUQUERIA }));

      const resultado = await service.checkout(USUARIO_ID);

      expect(bookingsService.crear).toHaveBeenCalledTimes(2);
      expect(resultado.reservas).toHaveLength(2);
    });

    it('debería sumar los subtotales de todas las reservas del viaje', async () => {
      await service.anadirItem(USUARIO_ID, itemDto());
      await service.anadirItem(USUARIO_ID, itemDto({ vertical: VerticalKey.PELUQUERIA }));

      const resultado = await service.checkout(USUARIO_ID);

      expect(resultado.montoSubtotalTotal).toBe(400);
    });

    it('debería crear primero la reserva madre y vincular el resto a ella', async () => {
      await service.anadirItem(USUARIO_ID, itemDto({ vertical: VerticalKey.PELUQUERIA }));
      await service.anadirItem(USUARIO_ID, itemDto({ esReservaMadre: true }));

      const resultado = await service.checkout(USUARIO_ID);

      // El alojamiento (madre) se reserva primero pese a añadirse el segundo.
      expect(bookingsService.crear.mock.calls[0][0].vertical).toBe(VerticalKey.ALOJAMIENTO);
      expect(resultado.reservaMadreId).toBe(resultado.reservas[0]._id.toString());
      expect(resultado.reservas[1].reservaMadreId).toEqual(resultado.reservas[0]._id);
    });

    it('no debería reservar nada si algún servicio ya no tiene plaza', async () => {
      await service.anadirItem(USUARIO_ID, itemDto());
      estrategia.checkAvailability.mockResolvedValue({ disponible: false });

      await expect(service.checkout(USUARIO_ID)).rejects.toThrow(DomainException);
      expect(bookingsService.crear).not.toHaveBeenCalled();
    });

    it('debería conservar el viaje intacto si la revalidación falla', async () => {
      await service.anadirItem(USUARIO_ID, itemDto());
      estrategia.checkAvailability.mockResolvedValue({ disponible: false });

      await expect(service.checkout(USUARIO_ID)).rejects.toThrow(DomainException);
      expect(carritoDoc.items).toHaveLength(1);
      expect(carritoDoc.estado).toBe('abierto');
    });

    it('debería liberar las plazas ya tomadas si una línea falla a mitad', async () => {
      await service.anadirItem(USUARIO_ID, itemDto());
      await service.anadirItem(USUARIO_ID, itemDto({ vertical: VerticalKey.PELUQUERIA }));

      bookingsService.crear
        .mockImplementationOnce(() => Promise.resolve(reservaCreada(200)))
        .mockImplementationOnce(() => Promise.reject(new DomainException('sin plaza', 409)));

      await expect(service.checkout(USUARIO_ID)).rejects.toThrow(DomainException);

      // La primera reserva sí se creó: hay que devolver su plaza al mercado.
      expect(bookingsService.cancelar).toHaveBeenCalledTimes(1);
      expect(carritoDoc.estado).toBe('abierto');
    });
  });
});
