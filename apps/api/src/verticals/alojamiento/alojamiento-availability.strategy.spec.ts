import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { AlojamientoAvailabilityStrategy } from './alojamiento-availability.strategy';
import { Servicio } from '../../core/catalog/servicio.schema';
import { OcupacionRepository } from '../../core/availability/ocupacion.repository';
import { DomainException } from '../../shared/exceptions/domain.exception';
import { VerticalKey } from 'shared';

describe('AlojamientoAvailabilityStrategy', () => {
  let strategy: AlojamientoAvailabilityStrategy;
  let servicioModel: { findById: jest.Mock };
  let ocupacion: jest.Mocked<Pick<OcupacionRepository, 'nochesOcupadas'>>;

  const alojamientoMock = {
    _id: 'alojamiento-1',
    vertical: VerticalKey.ALOJAMIENTO,
    espacios: [{ tipo: 'suite', tamanoMaxPerro: 'grande', precioNoche: 45, cantidad: 6 }],
  };

  beforeEach(async () => {
    servicioModel = {
      findById: jest.fn().mockReturnValue({
        lean: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue(alojamientoMock),
      }),
    };

    // Sin reservas vivas por defecto: las noches del rango están libres.
    ocupacion = { nochesOcupadas: jest.fn().mockResolvedValue(new Map<string, number>()) };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AlojamientoAvailabilityStrategy,
        { provide: getModelToken(Servicio.name), useValue: servicioModel },
        { provide: OcupacionRepository, useValue: ocupacion },
      ],
    }).compile();

    strategy = module.get<AlojamientoAvailabilityStrategy>(AlojamientoAvailabilityStrategy);
  });

  /**
   * El catálogo reparte al cliente ids de posición ("esp-0") porque los
   * subdocumentos se guardan sin `_id`. Si la reserva buscase por
   * `espacio.id` no encontraría ninguno y el alojamiento parecería no tener
   * espacios: ni calendario ni reserva posibles.
   */
  describe('tamaño del perro', () => {
    const conEspacioMaximo = (tamanoMaxPerro: string) => {
      servicioModel.findById = jest.fn().mockReturnValue({
        lean: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue({
          ...alojamientoMock,
          espacios: [{ tipo: 'suite', tamanoMaxPerro, precioNoche: 45, cantidad: 6 }],
        }),
      });
    };

    const reservarCon = (perroTamano?: string) => strategy.checkAvailability('alojamiento-1', {
      fechaInicio: new Date('2026-01-10'),
      fechaFin: new Date('2026-01-12'),
      parametrosExtra: perroTamano ? { perroTamano } : {},
    });

    it('debería admitir un perro mini en un espacio que admite hasta mini', async () => {
      // El desplegable del paso 1 se dejaba fuera "mini": con un espacio así
      // ninguna opción elegible pasaba y la reserva se rechazaba siempre.
      conEspacioMaximo('mini');

      await expect(reservarCon('mini')).resolves.toMatchObject({ disponible: true });
    });

    it('debería rechazar un perro mayor con un mensaje legible, no con la clave', async () => {
      conEspacioMaximo('mini');

      await expect(reservarCon('mediano')).rejects.toThrow(/Mini \(0-5 kg\)/);
    });

    it('debería decir qué hacer, y no que pruebe otras fechas', async () => {
      conEspacioMaximo('mini');

      await expect(reservarCon('mediano')).rejects.toThrow(/Elige otro espacio/);
    });

    it('no debería bloquear si el perro no declara tamaño', async () => {
      conEspacioMaximo('mini');

      await expect(reservarCon()).resolves.toMatchObject({ disponible: true });
    });
  });

  describe('espacio elegido por el cliente', () => {
    it('debería resolver el espacio por el id de posición del catálogo', async () => {
      const resultado = await strategy.checkAvailability('alojamiento-1', {
        fechaInicio: new Date('2026-01-10'),
        fechaFin: new Date('2026-01-12'),
        parametrosExtra: { espacioId: 'esp-0' },
      });

      expect(resultado.disponible).toBe(true);
      expect(resultado.precioCalculado).toBe(45 * 2);
    });

    it('debería pintar el calendario del espacio pedido por posición', async () => {
      const dias = await strategy.calendario('alojamiento-1', {
        desde: new Date('2099-09-01'), hasta: new Date('2099-09-01'), espacioId: 'esp-0',
      });

      expect(dias[0]).toEqual({ fecha: '2099-09-01', disponible: true, plazasLibres: 6 });
      // La ocupación se filtra por el mismo id que guardan las reservas.
      expect(ocupacion.nochesOcupadas).toHaveBeenCalledWith(
        expect.objectContaining({ espacioId: 'esp-0' }),
      );
    });

    it('debería rechazar un espacio que no existe, en vez de coger otro', async () => {
      const resultado = await strategy.checkAvailability('alojamiento-1', {
        fechaInicio: new Date('2026-01-10'),
        fechaFin: new Date('2026-01-12'),
        parametrosExtra: { espacioId: 'no-existe' },
      });

      expect(resultado.disponible).toBe(false);
      expect(resultado.motivo).toContain('no tiene ningún espacio publicado');
    });
  });

  describe('calendario', () => {
    it('debería marcar libre cada noche con plaza y llena la que se queda sin ellas', async () => {
      // 6 plazas: la noche del 2 está completa, la del 3 tiene una libre.
      ocupacion.nochesOcupadas.mockResolvedValue(new Map([['2099-09-02', 6], ['2099-09-03', 5]]));

      const dias = await strategy.calendario('alojamiento-1', {
        desde: new Date('2099-09-01'),
        hasta: new Date('2099-09-03'),
      });

      expect(dias).toEqual([
        { fecha: '2099-09-01', disponible: true,  plazasLibres: 6 },
        { fecha: '2099-09-02', disponible: false, plazasLibres: 0 },
        { fecha: '2099-09-03', disponible: true,  plazasLibres: 1 },
      ]);
    });

    it('no debería ofrecer días ya pasados', async () => {
      const dias = await strategy.calendario('alojamiento-1', {
        desde: new Date('2020-01-01'),
        hasta: new Date('2020-01-02'),
      });

      expect(dias.every((dia) => !dia.disponible)).toBe(true);
    });

    it('debería contar sólo la ocupación del espacio pedido', async () => {
      await strategy.calendario('alojamiento-1', {
        desde: new Date('2099-09-01'), hasta: new Date('2099-09-02'), espacioId: 'esp-0',
      });

      expect(ocupacion.nochesOcupadas).toHaveBeenCalledWith(
        expect.objectContaining({ espacioId: 'esp-0' }),
      );
    });
  });

  describe('checkAvailability', () => {
    it('debería rechazar el rango si alguna noche está completa, diciendo cuál', async () => {
      // Sin esto dos clientes reservaban la misma suite las mismas noches y el
      // conflicto no aparecía hasta la llegada.
      ocupacion.nochesOcupadas.mockResolvedValue(new Map([['2026-01-12', 6]]));

      const resultado = await strategy.checkAvailability('alojamiento-1', {
        fechaInicio: new Date('2026-01-10'),
        fechaFin: new Date('2026-01-15'),
      });

      expect(resultado.disponible).toBe(false);
      expect(resultado.motivo).toContain('12 de enero');
    });

    it('no debería mirar la noche de salida: esa mañana ya te has ido', async () => {
      ocupacion.nochesOcupadas.mockResolvedValue(new Map([['2026-01-15', 6]]));

      const resultado = await strategy.checkAvailability('alojamiento-1', {
        fechaInicio: new Date('2026-01-10'),
        fechaFin: new Date('2026-01-15'),
      });

      expect(resultado.disponible).toBe(true);
    });

    it('debería retornar disponible=true con precio calculado por noches y perros', async () => {
      const resultado = await strategy.checkAvailability('alojamiento-1', {
        fechaInicio: new Date('2026-01-10'),
        fechaFin: new Date('2026-01-15'),
        cantidad: 2,
      });

      expect(resultado.disponible).toBe(true);
      expect(resultado.precioCalculado).toBe(45 * 5 * 2); // 5 noches × 45€ × 2 perros
      expect(resultado.metadata?.noches).toBe(5);
      expect(resultado.metadata?.perros).toBe(2);
    });

    it('debería asumir 1 perro cuando no se envía cantidad', async () => {
      const resultado = await strategy.checkAvailability('alojamiento-1', {
        fechaInicio: new Date('2026-01-10'),
        fechaFin: new Date('2026-01-12'),
      });

      expect(resultado.disponible).toBe(true);
      expect(resultado.precioCalculado).toBe(45 * 2); // 2 noches × 45€ × 1 perro
      expect(resultado.metadata?.perros).toBe(1);
    });

    it('debería retornar disponible=false si no hay espacios', async () => {
      servicioModel.findById.mockReturnValue({
        lean: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue({ ...alojamientoMock, espacios: [] }),
      });

      const resultado = await strategy.checkAvailability('alojamiento-1', {
        fechaInicio: new Date('2026-01-10'),
        fechaFin: new Date('2026-01-15'),
      });

      expect(resultado.disponible).toBe(false);
    });

    it('debería lanzar DomainException si no se envía fechaFin', async () => {
      await expect(
        strategy.checkAvailability('alojamiento-1', { fechaInicio: new Date() }),
      ).rejects.toThrow(DomainException);
    });

    it('debería lanzar DomainException 404 si el alojamiento no existe', async () => {
      servicioModel.findById.mockReturnValue({
        lean: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue(null),
      });

      await expect(
        strategy.checkAvailability('no-existe', { fechaInicio: new Date(), fechaFin: new Date() }),
      ).rejects.toThrow(DomainException);
    });

    describe('selección de espacio por espacioId', () => {
      const mockConDosEspacios = {
        ...alojamientoMock,
        espacios: [
          { id: 'e1', tipo: 'estandar', tamanoMaxPerro: 'grande', precioNoche: 20, cantidad: 3 },
          { id: 'e2', tipo: 'suite', tamanoMaxPerro: 'grande', precioNoche: 60, cantidad: 2 },
        ],
      };

      beforeEach(() => {
        servicioModel.findById.mockReturnValue({
          lean: jest.fn().mockReturnThis(),
          exec: jest.fn().mockResolvedValue(mockConDosEspacios),
        });
      });

      it('usa el precio del espacio elegido por el cliente, no el primero', async () => {
        const resultado = await strategy.checkAvailability('alojamiento-1', {
          fechaInicio: new Date('2026-01-10'),
          fechaFin: new Date('2026-01-11'),
          parametrosExtra: { espacioId: 'e2' },
        });
        expect(resultado.precioCalculado).toBe(60);
      });

      it('cae al primer espacio con cupo si no se indica espacioId', async () => {
        const resultado = await strategy.checkAvailability('alojamiento-1', {
          fechaInicio: new Date('2026-01-10'),
          fechaFin: new Date('2026-01-11'),
        });
        expect(resultado.precioCalculado).toBe(20);
      });
    });

    describe('compatibilidad de tamaño', () => {
      const mockConTamano = {
        ...alojamientoMock,
        espacios: [{ id: 'e1', tipo: 'estandar', tamanoMaxPerro: 'mediano', precioNoche: 20, cantidad: 3 }],
      };

      beforeEach(() => {
        servicioModel.findById.mockReturnValue({
          lean: jest.fn().mockReturnThis(),
          exec: jest.fn().mockResolvedValue(mockConTamano),
        });
      });

      it('bloquea la reserva si el perro supera el tamaño máximo del espacio', async () => {
        await expect(strategy.checkAvailability('alojamiento-1', {
          fechaInicio: new Date('2026-01-10'), fechaFin: new Date('2026-01-11'),
          parametrosExtra: { perroTamano: 'gigante' },
        })).rejects.toThrow(DomainException);
      });

      it('permite la reserva si el perro no supera el tamaño máximo', async () => {
        const resultado = await strategy.checkAvailability('alojamiento-1', {
          fechaInicio: new Date('2026-01-10'), fechaFin: new Date('2026-01-11'),
          parametrosExtra: { perroTamano: 'pequeno' },
        });
        expect(resultado.disponible).toBe(true);
      });

      it('acepta también el parámetro legacy tamanoPerro (sin Ficha del Perro/perfil de invitado)', async () => {
        await expect(strategy.checkAvailability('alojamiento-1', {
          fechaInicio: new Date('2026-01-10'), fechaFin: new Date('2026-01-11'),
          parametrosExtra: { tamanoPerro: 'gigante' },
        })).rejects.toThrow(DomainException);
      });
    });

    describe('servicios adicionales (HU-15.1/15.2)', () => {
      const mockConExtras = {
        ...alojamientoMock,
        serviciosAdicionales: [
          { nombre: 'Paseo extra diario', precio: 10 },
          { nombre: 'Baño y cepillado', precio: 25 },
        ],
      };

      beforeEach(() => {
        servicioModel.findById.mockReturnValue({
          lean: jest.fn().mockReturnThis(),
          exec: jest.fn().mockResolvedValue(mockConExtras),
        });
      });

      it('debería sumar el precio de los extras seleccionados por nombre', async () => {
        const resultado = await strategy.checkAvailability('alojamiento-1', {
          fechaInicio: new Date('2026-01-10'), fechaFin: new Date('2026-01-11'),
          parametrosExtra: { extras: ['Paseo extra diario', 'Baño y cepillado'] },
        });

        // 1 noche × 45€ × 1 perro + 10 + 25
        expect(resultado.precioCalculado).toBe(45 + 10 + 25);
        expect(resultado.metadata?.extras).toBe(35);
      });

      it('debería ignorar nombres de extras que no existen en el servicio', async () => {
        const resultado = await strategy.checkAvailability('alojamiento-1', {
          fechaInicio: new Date('2026-01-10'), fechaFin: new Date('2026-01-11'),
          parametrosExtra: { extras: ['Extra inventado'] },
        });

        expect(resultado.precioCalculado).toBe(45);
      });

      it('no debería sumar nada si no se seleccionan extras', async () => {
        const resultado = await strategy.checkAvailability('alojamiento-1', {
          fechaInicio: new Date('2026-01-10'), fechaFin: new Date('2026-01-11'),
        });

        expect(resultado.precioCalculado).toBe(45);
      });
    });

    describe('compatibilidad social', () => {
      const mockConCompatibilidad = {
        ...alojamientoMock,
        compatibilidadSocialAdmitida: ['cualquiera', 'solo_pequenos'],
      };

      beforeEach(() => {
        servicioModel.findById.mockReturnValue({
          lean: jest.fn().mockReturnThis(),
          exec: jest.fn().mockResolvedValue(mockConCompatibilidad),
        });
      });

      it('bloquea la reserva si el perfil social del perro no está admitido', async () => {
        await expect(strategy.checkAvailability('alojamiento-1', {
          fechaInicio: new Date('2026-01-10'), fechaFin: new Date('2026-01-11'),
          parametrosExtra: { compatibilidadSocial: 'individual' },
        })).rejects.toThrow(DomainException);
      });

      it('permite la reserva si el perfil social está admitido', async () => {
        const resultado = await strategy.checkAvailability('alojamiento-1', {
          fechaInicio: new Date('2026-01-10'), fechaFin: new Date('2026-01-11'),
          parametrosExtra: { compatibilidadSocial: 'solo_pequenos' },
        });
        expect(resultado.disponible).toBe(true);
      });
    });
  });

  describe('reserveSlot', () => {
    it('debería crear un hold con TTL de 15 minutos', async () => {
      const hold = await strategy.reserveSlot('alojamiento-1', {
        usuarioId: 'user-1',
        fechaInicio: new Date('2026-01-10'),
        fechaFin: new Date('2026-01-15'),
      });

      expect(hold.holdId).toContain('hold-alojamiento-1');
      expect(hold.expiraEn.getTime()).toBeGreaterThan(Date.now());
    });
  });

  describe('releaseSlot', () => {
    it('debería liberar el hold sin lanzar error', async () => {
      const hold = await strategy.reserveSlot('alojamiento-1', {
        usuarioId: 'user-1',
        fechaInicio: new Date(),
      });

      await expect(strategy.releaseSlot(hold.holdId)).resolves.not.toThrow();
    });
  });
});
