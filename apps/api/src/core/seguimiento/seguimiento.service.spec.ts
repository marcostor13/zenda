import { Test } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { Types } from 'mongoose';
import { ReservaEstado } from 'shared';
import { Reserva } from '../bookings/reserva.schema';
import { Comercio } from '../comercios/comercio.schema';
import { PosicionViaje } from './posicion-viaje.schema';
import { SeguimientoService } from './seguimiento.service';

const RESERVA_ID = new Types.ObjectId();
const USUARIO = 'user-1';
const COMERCIO = 'comercio-1';

const reservaDoc = (extra: Record<string, unknown> = {}) => ({
  _id: RESERVA_ID,
  usuarioId: { toString: () => USUARIO },
  comercioId: { toString: () => COMERCIO },
  estado: ReservaEstado.EN_CURSO,
  seguimiento: [{ hito: 'recogida' }],
  detalle: { ruta: { origen: { lat: 1, lng: 2 }, destino: { lat: 3, lng: 4 } } },
  ...extra,
});

/** Cadena de Mongoose que termina en `exec` con el valor dado. */
const cadena = (valor: unknown) => {
  const c: Record<string, jest.Mock> = {};
  for (const metodo of ['sort', 'limit', 'select', 'lean']) c[metodo] = jest.fn().mockReturnValue(c);
  c['exec'] = jest.fn().mockResolvedValue(valor);
  return c;
};

describe('SeguimientoService', () => {
  let service: SeguimientoService;
  let posicionModel: { create: jest.Mock; find: jest.Mock; findOne: jest.Mock };
  let reservaModel: { findById: jest.Mock };
  let comercioModel: { findById: jest.Mock };

  const conReserva = (doc: unknown) => reservaModel.findById.mockReturnValue(cadena(doc));

  beforeEach(async () => {
    posicionModel = {
      create: jest.fn().mockResolvedValue({}),
      find: jest.fn().mockReturnValue(cadena([])),
      findOne: jest.fn().mockReturnValue(cadena(null)),
    };
    reservaModel = { findById: jest.fn().mockReturnValue(cadena(reservaDoc())) };
    comercioModel = { findById: jest.fn().mockReturnValue(cadena(null)) };

    const moduleRef = await Test.createTestingModule({
      providers: [
        SeguimientoService,
        { provide: getModelToken(PosicionViaje.name), useValue: posicionModel },
        { provide: getModelToken(Reserva.name), useValue: reservaModel },
        { provide: getModelToken(Comercio.name), useValue: comercioModel },
      ],
    }).compile();

    service = moduleRef.get(SeguimientoService);
  });

  describe('registrarPosicion', () => {
    const dto = { lat: 39.9, lng: -0.05, rumbo: 90 };

    it('debería guardar la posición de un viaje en marcha', async () => {
      await expect(service.registrarPosicion(RESERVA_ID.toString(), COMERCIO, dto)).resolves.toEqual({ ok: true });

      expect(posicionModel.create).toHaveBeenCalledWith(expect.objectContaining({ reservaId: RESERVA_ID, ...dto, at: expect.any(Date) }));
    });

    it('debería responder 404 con un id inválido o una reserva que no existe', async () => {
      await expect(service.registrarPosicion('nada', COMERCIO, dto)).rejects.toMatchObject({ statusCode: 404 });
      expect(reservaModel.findById).not.toHaveBeenCalled();

      conReserva(null);
      await expect(service.registrarPosicion(RESERVA_ID.toString(), COMERCIO, dto)).rejects.toMatchObject({ statusCode: 404 });
    });

    it('debería responder 403 si la reserva es de otro comercio', async () => {
      await expect(service.registrarPosicion(RESERVA_ID.toString(), 'otro', dto)).rejects.toMatchObject({ statusCode: 403 });
      expect(posicionModel.create).not.toHaveBeenCalled();
    });

    it.each([
      ['la reserva no está confirmada ni en curso', { estado: ReservaEstado.PENDIENTE }],
      ['el viaje está pendiente de aceptar', { estado: ReservaEstado.CONFIRMADA, aceptacion: { estado: 'pendiente' } }],
      ['la mascota ya se entregó', { seguimiento: [{ hito: 'recogida' }, { hito: 'entregada' }] }],
      ['el viaje ya terminó', { seguimiento: [{ hito: 'finalizada' }] }],
    ])('debería responder 409 si %s', async (_caso, extra) => {
      conReserva(reservaDoc(extra));
      await expect(service.registrarPosicion(RESERVA_ID.toString(), COMERCIO, dto)).rejects.toMatchObject({ statusCode: 409 });
    });

    it('debería admitir una reserva confirmada sin hitos y con el hito antiguo en_ruta', async () => {
      conReserva(reservaDoc({ estado: ReservaEstado.CONFIRMADA, seguimiento: undefined }));
      await expect(service.registrarPosicion(RESERVA_ID.toString(), COMERCIO, dto)).resolves.toEqual({ ok: true });

      conReserva(reservaDoc({ seguimiento: [{ hito: 'en_ruta' }] }));
      await expect(service.registrarPosicion(RESERVA_ID.toString(), COMERCIO, dto)).resolves.toEqual({ ok: true });
      expect(posicionModel.create).toHaveBeenCalledTimes(2);
    });

    it('debería ignorar posiciones que llegan demasiado seguidas', async () => {
      posicionModel.findOne.mockReturnValue(cadena({ at: new Date(Date.now() - 2000) }));

      await expect(service.registrarPosicion(RESERVA_ID.toString(), COMERCIO, dto)).resolves.toEqual({ ok: true });
      expect(posicionModel.create).not.toHaveBeenCalled();
    });

    it('debería guardar si la última posición es de hace más de unos segundos', async () => {
      posicionModel.findOne.mockReturnValue(cadena({ at: new Date(Date.now() - 10_000) }));

      await service.registrarPosicion(RESERVA_ID.toString(), COMERCIO, dto);
      expect(posicionModel.create).toHaveBeenCalled();
    });
  });

  describe('ubicacion', () => {
    const hace = (segundos: number) => new Date(Date.now() - segundos * 1000);

    it('debería devolver la última posición, el rastro en orden y los extremos de la ruta', async () => {
      posicionModel.find.mockReturnValue(cadena([
        { lat: 3, lng: 3, rumbo: 45, at: hace(10) },
        { lat: 2, lng: 2, at: hace(20) },
        { lat: 1, lng: 1, at: hace(30) },
      ]));

      const ubicacion = await service.ubicacion(RESERVA_ID.toString(), USUARIO);

      expect(ubicacion.compartiendo).toBe(true);
      expect(ubicacion.posicion).toEqual(expect.objectContaining({ lat: 3, lng: 3, rumbo: 45 }));
      expect(ubicacion.rastro).toEqual([{ lat: 1, lng: 1 }, { lat: 2, lng: 2 }, { lat: 3, lng: 3 }]);
      expect(ubicacion.origen).toEqual({ lat: 1, lng: 2 });
      expect(ubicacion.destino).toEqual({ lat: 3, lng: 4 });
      expect(posicionModel.find).toHaveBeenCalledWith({ reservaId: RESERVA_ID });
    });

    it('debería decir que no comparte si la última señal es antigua', async () => {
      posicionModel.find.mockReturnValue(cadena([{ lat: 3, lng: 3, at: hace(10 * 60) }]));

      const ubicacion = await service.ubicacion(RESERVA_ID.toString(), USUARIO);

      expect(ubicacion.compartiendo).toBe(false);
      expect(ubicacion.posicion).toBeDefined();
    });

    it('debería decir que no comparte si el viaje ya se entregó, aunque la señal sea reciente', async () => {
      conReserva(reservaDoc({ seguimiento: [{ hito: 'entregada' }] }));
      posicionModel.find.mockReturnValue(cadena([{ lat: 3, lng: 3, at: hace(5) }]));

      await expect(service.ubicacion(RESERVA_ID.toString(), USUARIO)).resolves.toMatchObject({ compartiendo: false });
    });

    it('debería responder sin posición ni ruta si no hay nada', async () => {
      conReserva(reservaDoc({ detalle: undefined }));

      const ubicacion = await service.ubicacion(RESERVA_ID.toString(), USUARIO);

      expect(ubicacion).toEqual({ compartiendo: false, posicion: undefined, rastro: [], origen: undefined, destino: undefined });
    });

    it('debería responder 403 si la reserva es de otro cliente', async () => {
      await expect(service.ubicacion(RESERVA_ID.toString(), 'otro')).rejects.toMatchObject({ statusCode: 403 });
    });
  });

  describe('contacto', () => {
    it('debería dar teléfono y WhatsApp del comercio con la reserva viva', async () => {
      comercioModel.findById.mockReturnValue(cadena({
        nombreComercial: 'Fido', contacto: { telefono: '+34 600', whatsapp: '+34 611' },
      }));

      await expect(service.contacto(RESERVA_ID.toString(), USUARIO)).resolves.toEqual({
        nombre: 'Fido', telefono: '+34 600', whatsapp: '+34 611',
      });
    });

    it('debería usar el teléfono como WhatsApp si no hay uno propio', async () => {
      comercioModel.findById.mockReturnValue(cadena({ nombreComercial: 'Fido', telefono: '+34 622' }));

      await expect(service.contacto(RESERVA_ID.toString(), USUARIO)).resolves.toEqual({
        nombre: 'Fido', telefono: '+34 622', whatsapp: '+34 622',
      });
    });

    it('debería responder con un nombre genérico si el comercio ya no existe', async () => {
      conReserva(reservaDoc({ estado: ReservaEstado.COMPLETADA }));

      await expect(service.contacto(RESERVA_ID.toString(), USUARIO)).resolves.toEqual({
        nombre: 'El comercio', telefono: undefined, whatsapp: undefined,
      });
    });

    it('debería responder 409 si la reserva no está confirmada', async () => {
      conReserva(reservaDoc({ estado: ReservaEstado.PENDIENTE }));
      await expect(service.contacto(RESERVA_ID.toString(), USUARIO)).rejects.toMatchObject({ statusCode: 409 });
    });

    it('debería responder 403 si la reserva es de otro cliente', async () => {
      await expect(service.contacto(RESERVA_ID.toString(), 'otro')).rejects.toMatchObject({ statusCode: 403 });
    });
  });
});
