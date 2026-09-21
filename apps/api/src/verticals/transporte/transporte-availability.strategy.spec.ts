import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { TransporteAvailabilityStrategy } from './transporte-availability.strategy';
import { Servicio } from '../../core/catalog/servicio.schema';
import { DomainException } from '../../shared/exceptions/domain.exception';
import {
  ModeloPrecio, ModoDisponibilidadTransporte, UnidadCobro, VerticalKey,
} from 'shared';

interface ServicioModelMock {
  findById: jest.Mock;
}

describe('TransporteAvailabilityStrategy', () => {
  let strategy: TransporteAvailabilityStrategy;
  let servicioModel: ServicioModelMock;

  const transporteMock = {
    _id: 'transporte-1',
    vertical: VerticalKey.TRANSPORTE,
    tipoVehiculo: 'van_acondicionada',
    capacidadPerros: 4,
    tarifaBase: 12,
    tarifaKm: 1.2,
    unidadesDisponibles: 6,
    serviciosAdicionales: [
      { nombre: 'Recogida a domicilio', precio: 15 },
      { nombre: 'Fotos del trayecto', precio: 5 },
    ],
  };

  const mockFindById = (doc: unknown): void => {
    servicioModel.findById = jest.fn().mockReturnValue({
      lean: jest.fn().mockReturnThis(),
      exec: jest.fn().mockResolvedValue(doc),
    });
  };

  beforeEach(async () => {
    servicioModel = { findById: jest.fn() };
    mockFindById(transporteMock);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TransporteAvailabilityStrategy,
        { provide: getModelToken(Servicio.name), useValue: servicioModel },
      ],
    }).compile();

    strategy = module.get<TransporteAvailabilityStrategy>(TransporteAvailabilityStrategy);
  });

  it('debería declarar el vertical TRANSPORTE', () => {
    expect(strategy.vertical).toBe(VerticalKey.TRANSPORTE);
  });

  describe('checkAvailability', () => {
    it('debería lanzar DomainException 404 si el servicio no existe', async () => {
      mockFindById(null);

      await expect(
        strategy.checkAvailability('no-existe', { fechaInicio: new Date() }),
      ).rejects.toThrow(DomainException);
      await expect(
        strategy.checkAvailability('no-existe', { fechaInicio: new Date() }),
      ).rejects.toMatchObject({ statusCode: 404 });
    });

    it('debería retornar disponible=false si no hay unidades disponibles', async () => {
      mockFindById({ ...transporteMock, unidadesDisponibles: 0 });

      const resultado = await strategy.checkAvailability('transporte-1', {
        fechaInicio: new Date('2026-07-15T10:00:00Z'),
      });

      expect(resultado.disponible).toBe(false);
    });

    it('debería retornar disponible=false si unidadesDisponibles no está definido', async () => {
      mockFindById({ ...transporteMock, unidadesDisponibles: undefined });

      const resultado = await strategy.checkAvailability('transporte-1', {
        fechaInicio: new Date('2026-07-15T10:00:00Z'),
      });

      expect(resultado.disponible).toBe(false);
    });

    it('debería retornar disponible=false con motivo si los perros exceden la capacidad', async () => {
      const resultado = await strategy.checkAvailability('transporte-1', {
        fechaInicio: new Date('2026-07-15T10:00:00Z'),
        cantidad: 5,
      });

      expect(resultado.disponible).toBe(false);
      expect(resultado.metadata?.motivo).toBe('capacidad_insuficiente');
      expect(resultado.metadata?.perros).toBe(5);
    });

    it('debería lanzar DomainException 400 si la distancia es menor o igual a 0', async () => {
      await expect(
        strategy.checkAvailability('transporte-1', {
          fechaInicio: new Date(),
          parametrosExtra: { distanciaKm: 0 },
        }),
      ).rejects.toMatchObject({ statusCode: 400 });

      await expect(
        strategy.checkAvailability('transporte-1', {
          fechaInicio: new Date(),
          parametrosExtra: { distanciaKm: -5 },
        }),
      ).rejects.toThrow(DomainException);
    });

    it('debería calcular el precio como tarifaBase + tarifaKm × distancia (por trayecto, no por perro)', async () => {
      const resultado = await strategy.checkAvailability('transporte-1', {
        fechaInicio: new Date('2026-07-15T10:00:00Z'),
        cantidad: 3,
        parametrosExtra: { distanciaKm: 25 },
      });

      expect(resultado.disponible).toBe(true);
      expect(resultado.precioCalculado).toBe(12 + 1.2 * 25); // 42 — no se multiplica por perros
      expect(resultado.capacidadRestante).toBe(6);
      // `toMatchObject`: el desglose del motor trae además los kilómetros
      // facturables y la regla aplicada, que antes no existían.
      expect(resultado.metadata).toMatchObject({
        distanciaKm: 25,
        kmFacturables: 25,
        tipoVehiculo: 'van_acondicionada',
        capacidadPerros: 4,
        perros: 3,
        exclusivo: false,
        extras: 0,
        requierePresupuesto: false,
      });
    });

    it('debería sumar los servicios adicionales elegidos por el cliente', async () => {
      const resultado = await strategy.checkAvailability('transporte-1', {
        fechaInicio: new Date('2026-07-15T10:00:00Z'),
        parametrosExtra: {
          distanciaKm: 25,
          extras: ['Recogida a domicilio', 'Fotos del trayecto'],
        },
      });

      expect(resultado.precioCalculado).toBe(12 + 1.2 * 25 + 15 + 5); // 62
      expect(resultado.metadata?.['extras']).toBe(20);
    });

    it('debería ignorar los extras que el transportista no ofrece', async () => {
      const resultado = await strategy.checkAvailability('transporte-1', {
        fechaInicio: new Date('2026-07-15T10:00:00Z'),
        parametrosExtra: { distanciaKm: 25, extras: ['Masaje canino'] },
      });

      expect(resultado.precioCalculado).toBe(12 + 1.2 * 25); // 42, sin cargo fantasma
    });

    it('debería usar la distancia por defecto (10 km) si no se indica', async () => {
      const resultado = await strategy.checkAvailability('transporte-1', {
        fechaInicio: new Date('2026-07-15T10:00:00Z'),
      });

      expect(resultado.precioCalculado).toBe(12 + 1.2 * 10); // 24
      expect(resultado.metadata?.distanciaKm).toBe(10);
      expect(resultado.metadata?.perros).toBe(1);
    });

    it('debería usar la distancia por defecto si el valor recibido no es numérico', async () => {
      const resultado = await strategy.checkAvailability('transporte-1', {
        fechaInicio: new Date('2026-07-15T10:00:00Z'),
        parametrosExtra: { distanciaKm: 'no-es-un-numero' },
      });

      expect(resultado.metadata?.distanciaKm).toBe(10);
      expect(resultado.precioCalculado).toBe(12 + 1.2 * 10);
    });

    describe('transporte exclusivo', () => {
      it('añade el suplemento de exclusividad configurado por el comercio', async () => {
        mockFindById({ ...transporteMock, precioExclusivo: 20 });
        const resultado = await strategy.checkAvailability('transporte-1', {
          fechaInicio: new Date('2026-07-15T10:00:00Z'),
          parametrosExtra: { distanciaKm: 10, exclusivo: true },
        });
        expect(resultado.precioCalculado).toBe(12 + 1.2 * 10 + 20);
        expect(resultado.metadata?.exclusivo).toBe(true);
      });

      it('no añade suplemento si no se solicita transporte exclusivo', async () => {
        mockFindById({ ...transporteMock, precioExclusivo: 20 });
        const resultado = await strategy.checkAvailability('transporte-1', {
          fechaInicio: new Date('2026-07-15T10:00:00Z'),
          parametrosExtra: { distanciaKm: 10 },
        });
        expect(resultado.precioCalculado).toBe(12 + 1.2 * 10);
      });

      it('no añade suplemento si el comercio no configuró precioExclusivo', async () => {
        const resultado = await strategy.checkAvailability('transporte-1', {
          fechaInicio: new Date('2026-07-15T10:00:00Z'),
          parametrosExtra: { distanciaKm: 10, exclusivo: true },
        });
        expect(resultado.precioCalculado).toBe(12 + 1.2 * 10);
      });
    });
  });

  describe('servicios configurados con el asistente de alta', () => {
    /*
     * Fecha futura: un servicio del alta nueva exige 24 h de antelación por
     * defecto, así que una fecha fija del pasado lo rechazaría todo.
     */
    const dentroDeUnaSemana = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    /** Una empresa con precio cerrado por zona: ni tarifa base ni km. */
    const conReglas = {
      ...transporteMock,
      tarifaBase: undefined,
      tarifaKm: undefined,
      reglasTarifa: [{
        id: 'r1', nombre: 'Castellón ciudad', modelo: ModeloPrecio.ZONA,
        unidadCobro: UnidadCobro.VEHICULO, zonas: ['Castellón'], precioIda: 25,
      }],
      maxMascotasPorReserva: 3,
    };

    it('debería cobrar la regla de tarifa que encaja con el trayecto', async () => {
      mockFindById(conReglas);

      const resultado = await strategy.checkAvailability('transporte-1', {
        fechaInicio: dentroDeUnaSemana,
        parametrosExtra: { distanciaKm: 8, municipioOrigen: 'Castellón' },
      });

      expect(resultado.precioCalculado).toBe(25);
      expect(resultado.metadata?.['reglaAplicada']).toBe('Castellón ciudad');
    });

    /**
     * Sin precio cerrado la reserva no se cae: se ofrece presupuesto. Decir
     * "no disponible" mandaría al cliente de vuelta al listado teniendo una
     * venta delante.
     */
    it('debería seguir disponible y pedir presupuesto si ninguna regla encaja', async () => {
      mockFindById(conReglas);

      const resultado = await strategy.checkAvailability('transporte-1', {
        fechaInicio: dentroDeUnaSemana,
        parametrosExtra: { distanciaKm: 400, municipioOrigen: 'Sevilla' },
      });

      expect(resultado.disponible).toBe(true);
      expect(resultado.metadata?.['requierePresupuesto']).toBe(true);
      expect(resultado.precioCalculado).toBe(0);
    });

    it('debería rechazar una especie que el transportista no lleva', async () => {
      mockFindById({ ...conReglas, especiesAdmitidas: ['Perro'] });

      const resultado = await strategy.checkAvailability('transporte-1', {
        fechaInicio: dentroDeUnaSemana,
        parametrosExtra: { distanciaKm: 8, municipioOrigen: 'Castellón', especie: 'Reptil' },
      });

      expect(resultado.disponible).toBe(false);
      expect(resultado.metadata?.['motivo']).toBe('especie_no_admitida');
    });

    it('debería rechazar más acompañantes de los que caben', async () => {
      mockFindById({ ...conReglas, plazasAcompanantes: 1 });

      const resultado = await strategy.checkAvailability('transporte-1', {
        fechaInicio: dentroDeUnaSemana,
        parametrosExtra: { distanciaKm: 8, municipioOrigen: 'Castellón', pasajeros: 3 },
      });

      expect(resultado.disponible).toBe(false);
      expect(resultado.metadata?.['motivo']).toBe('sin_plazas_acompanante');
    });

    it('debería rechazar una recogida sin la antelación que pide la empresa', async () => {
      mockFindById({
        ...conReglas,
        modoDisponibilidad: ModoDisponibilidadTransporte.CALENDARIO,
        antelacionMinimaHoras: 24,
      });

      const enUnaHora = new Date(Date.now() + 60 * 60 * 1000);
      const resultado = await strategy.checkAvailability('transporte-1', {
        fechaInicio: enUnaHora,
        parametrosExtra: { distanciaKm: 8, municipioOrigen: 'Castellón' },
      });

      expect(resultado.disponible).toBe(false);
      expect(resultado.metadata?.['motivo']).toBe('antelacion_insuficiente');
    });

    /** Un servicio urgente existe justamente para el aviso de última hora. */
    it('no debería exigir antelación a un servicio bajo demanda', async () => {
      mockFindById({
        ...conReglas,
        modoDisponibilidad: ModoDisponibilidadTransporte.BAJO_DEMANDA,
        antelacionMinimaHoras: 24,
      });

      const enUnaHora = new Date(Date.now() + 60 * 60 * 1000);
      const resultado = await strategy.checkAvailability('transporte-1', {
        fechaInicio: enUnaHora,
        parametrosExtra: { distanciaKm: 8, municipioOrigen: 'Castellón' },
      });

      expect(resultado.disponible).toBe(true);
    });

    it('debería marcar que la empresa tiene que confirmar una situación declarada', async () => {
      mockFindById({ ...conReglas, situacionesConfirmacion: ['conducta_reactiva'] });

      const resultado = await strategy.checkAvailability('transporte-1', {
        fechaInicio: dentroDeUnaSemana,
        parametrosExtra: {
          distanciaKm: 8, municipioOrigen: 'Castellón', necesidades: ['conducta_reactiva'],
        },
      });

      expect(resultado.metadata?.['requiereConfirmacion']).toBe(true);
    });
  });

  describe('reserveSlot / releaseSlot', () => {
    it('debería crear un hold con id y expiración, y liberarlo sin error', async () => {
      const hold = await strategy.reserveSlot('transporte-1', {
        usuarioId: 'u1',
        fechaInicio: new Date(),
      });

      expect(hold.holdId).toContain('transporte-1');
      expect(hold.expiraEn).toBeInstanceOf(Date);
      expect(hold.expiraEn.getTime()).toBeGreaterThan(Date.now());
      await expect(strategy.releaseSlot(hold.holdId)).resolves.toBeUndefined();
    });
  });
});
