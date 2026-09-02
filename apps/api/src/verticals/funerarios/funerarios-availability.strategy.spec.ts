import { Test } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import {
  LugarRecogida, ModoPrecioRecogida, TipoServicioFunerario, UrgenciaFunerario, VerticalKey,
} from 'shared';
import { FunerariosAvailabilityStrategy, TIPOS_SIN_CENIZAS } from './funerarios-availability.strategy';
import { Servicio } from '../../core/catalog/servicio.schema';
import { DomainException } from '../../shared/exceptions/domain.exception';

describe('FunerariosAvailabilityStrategy', () => {
  let strategy: FunerariosAvailabilityStrategy;
  let model: { findById: jest.Mock };

  /** Servicio de catálogo por defecto: cremación individual, con cenizas. */
  const cremacionIndividual = {
    nombre: 'Cremación individual',
    tipo: TipoServicioFunerario.CREMACION_INDIVIDUAL,
    precioBase: 180,
    devuelveCenizas: true,
    urnaIncluida: true,
    certificadoIncluido: true,
    tiempoEstimadoHoras: 48,
    activo: true,
  };

  const empresa = (extra: Record<string, unknown> = {}): Record<string, unknown> => ({
    _id: 'f1',
    vertical: VerticalKey.FUNERARIOS,
    precioBase: 180,
    cuposDisponibles: 3,
    serviciosFunerarios: [cremacionIndividual],
    extras: [],
    ofreceRecogida: false,
    modoPrecioRecogida: ModoPrecioRecogida.FIJA,
    ...extra,
  });

  const daPorEncontrada = (doc: unknown): void => {
    model.findById = jest.fn().mockReturnValue({
      lean: jest.fn().mockReturnThis(),
      exec: jest.fn().mockResolvedValue(doc),
    });
  };

  /** Consulta con el rango mínimo; lo que decide aquí es `parametrosExtra`. */
  const consultar = (parametrosExtra: Record<string, unknown> = {}) =>
    strategy.checkAvailability('f1', {
      fechaInicio: new Date('2026-09-01'),
      cantidad: 1,
      parametrosExtra,
    });

  beforeEach(async () => {
    model = { findById: jest.fn() };
    daPorEncontrada(empresa());

    const ref = await Test.createTestingModule({
      providers: [
        FunerariosAvailabilityStrategy,
        { provide: getModelToken(Servicio.name), useValue: model },
      ],
    }).compile();
    strategy = ref.get(FunerariosAvailabilityStrategy);
  });

  it('debería declarar el vertical FUNERARIOS', () => {
    expect(strategy.vertical).toBe(VerticalKey.FUNERARIOS);
  });

  it('debería fallar con 404 si la empresa no existe', async () => {
    daPorEncontrada(null);

    await expect(consultar()).rejects.toThrow(DomainException);
    await expect(consultar()).rejects.toMatchObject({ statusCode: 404 });
  });

  describe('cupos', () => {
    it('debería rechazar la contratación cuando la empresa no tiene huecos', async () => {
      daPorEncontrada(empresa({ cuposDisponibles: 0 }));

      const resultado = await consultar();

      expect(resultado.disponible).toBe(false);
      expect(resultado.capacidadRestante).toBe(0);
      expect(resultado.metadata?.['motivo']).toBe('sin_cupos');
    });

    it('debería tratar la falta del contador como cero huecos', async () => {
      daPorEncontrada(empresa({ cuposDisponibles: undefined }));

      expect((await consultar()).disponible).toBe(false);
    });

    it('debería descontar el hueco que se está contratando', async () => {
      const resultado = await consultar();

      expect(resultado.disponible).toBe(true);
      expect(resultado.capacidadRestante).toBe(2);
    });
  });

  describe('elección del servicio', () => {
    it('debería tomar el primero activo cuando no se pide ninguno', async () => {
      const resultado = await consultar();

      expect(resultado.metadata?.['servicio']).toBe('Cremación individual');
    });

    it('debería ignorar los servicios que la empresa ha desactivado', async () => {
      daPorEncontrada(empresa({
        serviciosFunerarios: [
          { ...cremacionIndividual, nombre: 'Retirado', activo: false },
          { ...cremacionIndividual, nombre: 'Vigente' },
        ],
      }));

      expect((await consultar()).metadata?.['servicio']).toBe('Vigente');
    });

    it('debería rechazar un servicio que esta empresa no ofrece', async () => {
      const resultado = await consultar({ servicioNombre: 'Entierro con lápida' });

      expect(resultado.disponible).toBe(false);
      expect(resultado.metadata?.['motivo']).toBe('servicio_no_ofrecido');
    });

    it('debería rechazar la contratación si el catálogo está vacío', async () => {
      daPorEncontrada(empresa({ serviciosFunerarios: [] }));

      expect((await consultar()).disponible).toBe(false);
    });
  });

  describe('consentimiento de las cenizas', () => {
    const colectiva = {
      ...cremacionIndividual,
      nombre: 'Cremación colectiva',
      tipo: TipoServicioFunerario.CREMACION_COLECTIVA,
      precioBase: 90,
      devuelveCenizas: false,
    };

    it('no debería dejar contratar sin aceptar que no hay devolución de cenizas', async () => {
      daPorEncontrada(empresa({ serviciosFunerarios: [colectiva] }));

      const resultado = await consultar();

      expect(resultado.disponible).toBe(false);
      expect(resultado.metadata?.['motivo']).toBe('falta_aceptacion_cenizas');
    });

    it('no debería dar por aceptado nada que no sea un sí explícito', async () => {
      daPorEncontrada(empresa({ serviciosFunerarios: [colectiva] }));

      // Un 'true' de texto llega de un formulario mal serializado, no de una
      // casilla marcada: aquí no vale por sí.
      const resultado = await consultar({ aceptaSinCenizas: 'true' });

      expect(resultado.disponible).toBe(false);
    });

    it('debería dejar seguir con la aceptación marcada', async () => {
      daPorEncontrada(empresa({ serviciosFunerarios: [colectiva] }));

      const resultado = await consultar({ aceptaSinCenizas: true });

      expect(resultado.disponible).toBe(true);
      expect(resultado.metadata?.['devuelveCenizas']).toBe(false);
    });

    it('no debería pedir nada cuando el servicio sí devuelve las cenizas', async () => {
      expect((await consultar()).disponible).toBe(true);
    });
  });

  describe('precio según el peso', () => {
    const conTramos = {
      ...cremacionIndividual,
      tramosPeso: [
        { hastaKg: 30, precio: 260 },
        { hastaKg: 10, precio: 150 },
      ],
    };

    it('debería cobrar el precio base cuando el servicio no tiene tramos', async () => {
      expect((await consultar({ pesoKg: 12 })).precioCalculado).toBe(180);
    });

    it('debería cobrar el precio base si no se declara el peso', async () => {
      daPorEncontrada(empresa({ serviciosFunerarios: [conTramos] }));

      expect((await consultar()).precioCalculado).toBe(180);
    });

    it('debería elegir el primer tramo que cubre el peso, ordenando por límite', async () => {
      // Los tramos llegan desordenados a propósito: el de 30 kg va primero.
      daPorEncontrada(empresa({ serviciosFunerarios: [conTramos] }));

      expect((await consultar({ pesoKg: 8 })).precioCalculado).toBe(150);
      expect((await consultar({ pesoKg: 25 })).precioCalculado).toBe(260);
    });

    it('debería cobrar el tramo más alto a un animal por encima del último', async () => {
      daPorEncontrada(empresa({ serviciosFunerarios: [conTramos] }));

      expect((await consultar({ pesoKg: 60 })).precioCalculado).toBe(260);
    });

    it('debería incluir el límite del tramo, no dejarlo fuera', async () => {
      daPorEncontrada(empresa({ serviciosFunerarios: [conTramos] }));

      expect((await consultar({ pesoKg: 10 })).precioCalculado).toBe(150);
    });
  });

  describe('recogida', () => {
    it('no debería cobrar desplazamiento si el cliente no la pide', async () => {
      daPorEncontrada(empresa({ ofreceRecogida: true, precioRecogida: 40 }));

      const resultado = await consultar({ necesitaRecogida: false });

      expect(resultado.precioCalculado).toBe(180);
      expect(resultado.metadata?.['precioRecogida']).toBe(0);
    });

    it('debería rechazarla si la empresa no recoge', async () => {
      const resultado = await consultar({ necesitaRecogida: true });

      expect(resultado.disponible).toBe(false);
      expect(resultado.metadata?.['motivo']).toBe('sin_recogida');
    });

    it('debería rechazar un lugar que la empresa no cubre', async () => {
      daPorEncontrada(empresa({
        ofreceRecogida: true,
        lugaresRecogida: [LugarRecogida.DOMICILIO],
      }));

      const resultado = await consultar({
        necesitaRecogida: true, lugarRecogida: LugarRecogida.RESIDENCIA,
      });

      expect(resultado.disponible).toBe(false);
      expect(resultado.metadata?.['motivo']).toBe('lugar_no_cubierto');
    });

    it('debería aceptar cualquier lugar si la empresa no ha declarado ninguno', async () => {
      daPorEncontrada(empresa({ ofreceRecogida: true, precioRecogida: 40 }));

      const resultado = await consultar({
        necesitaRecogida: true, lugarRecogida: LugarRecogida.VETERINARIO,
      });

      expect(resultado.disponible).toBe(true);
    });

    /* Fuera del radio no se cobra caro: no se puede contratar (brief §recogida). */
    it('debería cortar la contratación fuera del radio declarado', async () => {
      daPorEncontrada(empresa({ ofreceRecogida: true, radioRecogidaKm: 25 }));

      const resultado = await consultar({ necesitaRecogida: true, distanciaKm: 40 });

      expect(resultado.disponible).toBe(false);
      expect(resultado.motivo).toContain('25 km');
      expect(resultado.metadata?.['motivo']).toBe('fuera_de_cobertura');
    });

    it('debería aceptar una dirección justo en el límite del radio', async () => {
      daPorEncontrada(empresa({ ofreceRecogida: true, radioRecogidaKm: 25, precioRecogida: 40 }));

      expect((await consultar({ necesitaRecogida: true, distanciaKm: 25 })).disponible).toBe(true);
    });

    it('debería cobrar el precio fijo declarado', async () => {
      daPorEncontrada(empresa({ ofreceRecogida: true, precioRecogida: 40 }));

      const resultado = await consultar({ necesitaRecogida: true });

      expect(resultado.precioCalculado).toBe(220);
      expect(resultado.metadata?.['precioRecogida']).toBe(40);
    });

    it('debería cobrar por kilómetro cuando así lo tarifica', async () => {
      daPorEncontrada(empresa({
        ofreceRecogida: true, radioRecogidaKm: 50,
        modoPrecioRecogida: ModoPrecioRecogida.POR_KM, precioRecogidaPorKm: 1.35,
      }));

      const resultado = await consultar({ necesitaRecogida: true, distanciaKm: 18 });

      // 1,35 × 18 = 24,30 exactos: sin redondeo saldría 24.299999999999997.
      expect(resultado.metadata?.['precioRecogida']).toBe(24.3);
      expect(resultado.precioCalculado).toBe(204.3);
    });

    it('debería cobrar el precio de la zona cuando tarifica por zonas', async () => {
      daPorEncontrada(empresa({
        ofreceRecogida: true,
        modoPrecioRecogida: ModoPrecioRecogida.POR_ZONA,
        zonasRecogida: [{ nombre: 'Norte', precio: 30 }, { nombre: 'Sur', precio: 45 }],
      }));

      const resultado = await consultar({ necesitaRecogida: true, zonaRecogida: 'Sur' });

      expect(resultado.metadata?.['precioRecogida']).toBe(45);
    });

    it('debería rechazar una zona que la empresa no cubre', async () => {
      daPorEncontrada(empresa({
        ofreceRecogida: true,
        modoPrecioRecogida: ModoPrecioRecogida.POR_ZONA,
        zonasRecogida: [{ nombre: 'Norte', precio: 30 }],
      }));

      const resultado = await consultar({ necesitaRecogida: true, zonaRecogida: 'Sur' });

      expect(resultado.disponible).toBe(false);
      expect(resultado.metadata?.['motivo']).toBe('fuera_de_cobertura');
    });
  });

  describe('suplemento de urgencia', () => {
    it('no debería cobrarlo por elegir una fecha', async () => {
      daPorEncontrada(empresa({ servicioUrgente: true, suplementoUrgencia: 60 }));

      const resultado = await consultar({ urgencia: UrgenciaFunerario.FECHA });

      expect(resultado.metadata?.['suplementoUrgencia']).toBe(0);
      expect(resultado.precioCalculado).toBe(180);
    });

    it('no debería cobrarlo si no se declara urgencia', async () => {
      daPorEncontrada(empresa({ servicioUrgente: true, suplementoUrgencia: 60 }));

      expect((await consultar()).metadata?.['suplementoUrgencia']).toBe(0);
    });

    it('debería cobrarlo en una urgencia real', async () => {
      daPorEncontrada(empresa({ servicioUrgente: true, suplementoUrgencia: 60 }));

      const resultado = await consultar({ urgencia: UrgenciaFunerario.LO_ANTES_POSIBLE });

      expect(resultado.metadata?.['suplementoUrgencia']).toBe(60);
      expect(resultado.precioCalculado).toBe(240);
    });

    it('debería aceptar la urgencia de quien atiende 24 h sin marcar urgente', async () => {
      daPorEncontrada(empresa({ atiende24h: true, suplementoUrgencia: 75 }));

      const resultado = await consultar({ urgencia: UrgenciaFunerario.HOY });

      expect(resultado.disponible).toBe(true);
      expect(resultado.metadata?.['suplementoUrgencia']).toBe(75);
    });

    it('debería rechazar la urgencia en una empresa que no la atiende', async () => {
      const resultado = await consultar({ urgencia: UrgenciaFunerario.HOY });

      expect(resultado.disponible).toBe(false);
      expect(resultado.metadata?.['motivo']).toBe('urgencia_no_ofrecida');
    });
  });

  describe('extras', () => {
    const conExtras = {
      extras: [
        { nombre: 'Urna de madera', precio: 45, activo: true },
        { nombre: 'Huella en arcilla', precio: 20, activo: true },
        { nombre: 'Ceremonia', precio: 120, activo: false },
      ],
    };

    it('no debería cobrar nada si no se elige ninguno', async () => {
      daPorEncontrada(empresa(conExtras));

      const resultado = await consultar();

      expect(resultado.metadata?.['precioExtras']).toBe(0);
      expect(resultado.metadata?.['extras']).toEqual([]);
    });

    it('debería sumar los extras elegidos y nombrarlos', async () => {
      daPorEncontrada(empresa(conExtras));

      const resultado = await consultar({ extras: ['Urna de madera', 'Huella en arcilla'] });

      expect(resultado.metadata?.['precioExtras']).toBe(65);
      expect(resultado.metadata?.['extras']).toEqual(['Urna de madera', 'Huella en arcilla']);
      expect(resultado.precioCalculado).toBe(245);
    });

    it('debería ignorar los extras que la empresa ha desactivado', async () => {
      daPorEncontrada(empresa(conExtras));

      const resultado = await consultar({ extras: ['Ceremonia'] });

      expect(resultado.metadata?.['precioExtras']).toBe(0);
    });

    it('debería ignorar un extra que la empresa no tiene en su catálogo', async () => {
      daPorEncontrada(empresa(conExtras));

      expect((await consultar({ extras: ['Lápida'] })).metadata?.['precioExtras']).toBe(0);
    });
  });

  describe('precio cerrado', () => {
    it('debería sumar servicio, recogida, urgencia y extras', async () => {
      daPorEncontrada(empresa({
        serviciosFunerarios: [{ ...cremacionIndividual, tramosPeso: [{ hastaKg: 20, precio: 200 }] }],
        ofreceRecogida: true, radioRecogidaKm: 50,
        modoPrecioRecogida: ModoPrecioRecogida.POR_KM, precioRecogidaPorKm: 1.5,
        servicioUrgente: true, suplementoUrgencia: 60,
        extras: [{ nombre: 'Urna de madera', precio: 45, activo: true }],
      }));

      const resultado = await consultar({
        pesoKg: 15,
        necesitaRecogida: true, distanciaKm: 20,
        urgencia: UrgenciaFunerario.LO_ANTES_POSIBLE,
        extras: ['Urna de madera'],
      });

      // 200 servicio + 30 recogida + 60 urgencia + 45 extra
      expect(resultado.precioCalculado).toBe(335);
    });

    it('debería devolver en el detalle todo lo que compone el precio', async () => {
      const resultado = await consultar({ pesoKg: 10 });

      expect(resultado.metadata).toMatchObject({
        servicio: 'Cremación individual',
        tipo: TipoServicioFunerario.CREMACION_INDIVIDUAL,
        precioServicio: 180,
        precioRecogida: 0,
        suplementoUrgencia: 0,
        precioExtras: 0,
        devuelveCenizas: true,
        tiempoEstimadoHoras: 48,
      });
    });

    it('debería redondear a céntimos, que es lo que se cobra', async () => {
      daPorEncontrada(empresa({
        serviciosFunerarios: [{ ...cremacionIndividual, precioBase: 0.1 }],
        ofreceRecogida: true, radioRecogidaKm: 50,
        modoPrecioRecogida: ModoPrecioRecogida.POR_KM, precioRecogidaPorKm: 0.2,
      }));

      const resultado = await consultar({ necesitaRecogida: true, distanciaKm: 1 });

      expect(resultado.precioCalculado).toBe(0.3);
    });
  });

  describe('retención de la plaza', () => {
    it('debería retener el hueco y devolver el detalle del precio', async () => {
      const hold = await strategy.reserveSlot('f1', {
        usuarioId: 'u1',
        fechaInicio: new Date('2026-09-01'),
        cantidad: 1,
        parametrosExtra: { pesoKg: 10 },
      });

      expect(hold.holdId).toMatch(/^fun-/);
      expect(hold.servicioId).toBe('f1');
      expect(hold.expiraEn.getTime()).toBeGreaterThan(Date.now());
      expect(hold.metadata?.['servicio']).toBe('Cremación individual');
    });

    it('debería caducar la retención a los 15 minutos', async () => {
      const antes = Date.now();

      const hold = await strategy.reserveSlot('f1', {
        usuarioId: 'u1', fechaInicio: new Date('2026-09-01'), cantidad: 1,
      });

      const minutos = (hold.expiraEn.getTime() - antes) / 60_000;
      expect(minutos).toBeGreaterThan(14.9);
      expect(minutos).toBeLessThanOrEqual(15);
    });

    it('debería dar un identificador distinto a cada retención', async () => {
      const params = { usuarioId: 'u1', fechaInicio: new Date('2026-09-01'), cantidad: 1 };

      const [uno, otro] = await Promise.all([
        strategy.reserveSlot('f1', params),
        strategy.reserveSlot('f1', params),
      ]);

      expect(uno.holdId).not.toBe(otro.holdId);
    });

    it('no debería retener nada si la contratación no es posible', async () => {
      daPorEncontrada(empresa({ cuposDisponibles: 0 }));

      await expect(strategy.reserveSlot('f1', {
        usuarioId: 'u1', fechaInicio: new Date('2026-09-01'), cantidad: 1,
      })).rejects.toMatchObject({ statusCode: 409 });
    });

    it('debería explicar por qué no se puede retener', async () => {
      await expect(strategy.reserveSlot('f1', {
        usuarioId: 'u1',
        fechaInicio: new Date('2026-09-01'),
        cantidad: 1,
        parametrosExtra: { necesitaRecogida: true },
      })).rejects.toThrow('Esta empresa no ofrece recogida.');
    });

    it('debería liberar la retención sin protestar aunque no exista', async () => {
      const hold = await strategy.reserveSlot('f1', {
        usuarioId: 'u1', fechaInicio: new Date('2026-09-01'), cantidad: 1,
      });

      await expect(strategy.releaseSlot(hold.holdId)).resolves.toBeUndefined();
      await expect(strategy.releaseSlot('fun-inexistente')).resolves.toBeUndefined();
    });
  });

  describe('TIPOS_SIN_CENIZAS', () => {
    it('debería nombrar la cremación colectiva, que es la que no las devuelve', () => {
      expect(TIPOS_SIN_CENIZAS).toContain(TipoServicioFunerario.CREMACION_COLECTIVA);
      expect(TIPOS_SIN_CENIZAS).not.toContain(TipoServicioFunerario.CREMACION_INDIVIDUAL);
    });
  });
});
