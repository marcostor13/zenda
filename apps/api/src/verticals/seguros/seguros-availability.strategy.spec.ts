import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { ResultadoElegibilidad, TipoSeguro, VerticalKey } from 'shared';
import { SegurosAvailabilityStrategy } from './seguros-availability.strategy';
import { Servicio } from '../../core/catalog/servicio.schema';
import { CondicionesAdmision } from './seguros.schema';
import { DomainException } from '../../shared/exceptions/domain.exception';

const polizaBase = (extra: Record<string, unknown> = {}) => ({
  _id: 'poliza-1',
  vertical: VerticalKey.SEGUROS,
  tiposSeguro: [TipoSeguro.RC_OBLIGATORIA],
  primaAnualBase: 240,
  descuentoPagoAnualPct: 0,
  duracionMeses: 12,
  cupoPolizas: 0,
  condicionesAdmision: {} as CondicionesAdmision,
  limitesCobertura: [],
  ...extra,
});

describe('SegurosAvailabilityStrategy', () => {
  let strategy: SegurosAvailabilityStrategy;
  let servicioModel: { findById: jest.Mock };

  const conPoliza = (doc: unknown): void => {
    servicioModel.findById.mockReturnValue({
      lean: () => ({ exec: () => Promise.resolve(doc) }),
    });
  };

  beforeEach(async () => {
    servicioModel = { findById: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SegurosAvailabilityStrategy,
        { provide: getModelToken(Servicio.name), useValue: servicioModel },
      ],
    }).compile();

    strategy = module.get(SegurosAvailabilityStrategy);
    conPoliza(polizaBase());
  });

  it('debería registrarse como el vertical de seguros', () => {
    expect(strategy.vertical).toBe(VerticalKey.SEGUROS);
  });

  describe('evaluarAdmision', () => {
    it('debería admitir a una mascota que cumple todo', () => {
      const admision = strategy.evaluarAdmision({}, { edadMeses: 24, pesoKg: 12 });

      expect(admision.resultado).toBe(ResultadoElegibilidad.ELEGIBLE);
      expect(admision.recargoPct).toBe(0);
    });

    it('debería rechazar por debajo de la edad mínima, diciendo cuál es', () => {
      const admision = strategy.evaluarAdmision({ edadMinimaMeses: 3 }, { edadMeses: 2 });

      expect(admision.resultado).toBe(ResultadoElegibilidad.NO_ELEGIBLE);
      expect(admision.motivo).toContain('3 meses');
    });

    it('debería rechazar por encima de la edad máxima', () => {
      const admision = strategy.evaluarAdmision({ edadMaximaAnios: 8 }, { edadMeses: 120 });

      expect(admision.resultado).toBe(ResultadoElegibilidad.NO_ELEGIBLE);
    });

    it('debería admitir justo en el límite de edad, no rechazarlo', () => {
      const admision = strategy.evaluarAdmision({ edadMaximaAnios: 8 }, { edadMeses: 96 });

      expect(admision.resultado).toBe(ResultadoElegibilidad.ELEGIBLE);
    });

    it('debería rechazar por peso máximo', () => {
      const admision = strategy.evaluarAdmision({ pesoMaximoKg: 20 }, { pesoKg: 35 });

      expect(admision.resultado).toBe(ResultadoElegibilidad.NO_ELEGIBLE);
      expect(admision.motivo).toContain('20 kg');
    });

    it('debería rechazar PPP y sugerir buscar una póliza que sí lo cubra', () => {
      const admision = strategy.evaluarAdmision({ excluyePPP: true }, { esPPP: true });

      expect(admision.resultado).toBe(ResultadoElegibilidad.NO_ELEGIBLE);
      expect(admision.motivo).toContain('cobertura PPP');
    });

    it('debería comparar razas excluidas sin distinguir tildes ni mayúsculas', () => {
      const admision = strategy.evaluarAdmision(
        { razasExcluidas: ['Dogo Argentino'] },
        { raza: 'dogo argentino' },
      );

      expect(admision.resultado).toBe(ResultadoElegibilidad.NO_ELEGIBLE);
    });

    it('debería rechazar sin vacunación al día cuando la póliza lo exige', () => {
      const admision = strategy.evaluarAdmision(
        { requiereVacunasAlDia: true },
        { vacunasAlDia: false },
      );

      expect(admision.resultado).toBe(ResultadoElegibilidad.NO_ELEGIBLE);
    });

    it('debería cubrir con recargo en vez de rechazar cuando la póliza lo permite', () => {
      const admision = strategy.evaluarAdmision({ recargoRiesgoPct: 0.25 }, { esPPP: true });

      expect(admision.resultado).toBe(ResultadoElegibilidad.ELEGIBLE_CON_RECARGO);
      expect(admision.recargoPct).toBe(0.25);
    });
  });

  describe('checkAvailability', () => {
    it('debería lanzar 404 si la póliza no existe', async () => {
      conPoliza(null);

      await expect(
        strategy.checkAvailability('x', { fechaInicio: new Date() }),
      ).rejects.toThrow(DomainException);
    });

    it('debería marcar el precio como orientativo, no firme', async () => {
      const resultado = await strategy.checkAvailability('poliza-1', { fechaInicio: new Date() });

      expect(resultado.disponible).toBe(true);
      expect(resultado.metadata?.['precioOrientativo']).toBe(true);
    });

    it('debería calcular la prima del periodo, no siempre la anual', async () => {
      conPoliza(polizaBase({ duracionMeses: 3 }));

      const resultado = await strategy.checkAvailability('poliza-1', { fechaInicio: new Date() });

      // 240 € al año → 60 € por tres meses.
      expect(resultado.precioCalculado).toBe(60);
    });

    it('debería aplicar el recargo de riesgo a la prima', async () => {
      conPoliza(polizaBase({ condicionesAdmision: { recargoRiesgoPct: 0.5 } }));

      const resultado = await strategy.checkAvailability('poliza-1', {
        fechaInicio: new Date(),
        parametrosExtra: { esPPP: true },
      });

      expect(resultado.precioCalculado).toBe(360);
    });

    it('no debería aplicar el descuento anual a una póliza temporal', async () => {
      conPoliza(polizaBase({ duracionMeses: 6, descuentoPagoAnualPct: 0.1 }));

      const resultado = await strategy.checkAvailability('poliza-1', { fechaInicio: new Date() });

      expect(resultado.precioCalculado).toBe(120);
    });

    it('debería devolver no disponible con el motivo cuando no es elegible', async () => {
      conPoliza(polizaBase({ condicionesAdmision: { excluyePPP: true } }));

      const resultado = await strategy.checkAvailability('poliza-1', {
        fechaInicio: new Date(),
        parametrosExtra: { esPPP: true },
      });

      expect(resultado.disponible).toBe(false);
      expect(resultado.metadata?.['motivo']).toContain('razas potencialmente peligrosas');
    });
  });

  describe('reserveSlot', () => {
    it('debería rechazar la retención con el motivo de la no elegibilidad', async () => {
      conPoliza(polizaBase({ condicionesAdmision: { pesoMaximoKg: 10 } }));

      await expect(
        strategy.reserveSlot('poliza-1', {
          usuarioId: 'u1', fechaInicio: new Date(), parametrosExtra: { pesoKg: 40 },
        }),
      ).rejects.toThrow(DomainException);
    });

    it('debería liberar la retención al soltarla', async () => {
      const hold = await strategy.reserveSlot('poliza-1', { usuarioId: 'u1', fechaInicio: new Date() });

      await strategy.releaseSlot(hold.holdId);

      // Con el cupo a 1, si el hold no se hubiera liberado no quedaría sitio.
      conPoliza(polizaBase({ cupoPolizas: 1 }));
      const resultado = await strategy.checkAvailability('poliza-1', { fechaInicio: new Date() });
      expect(resultado.disponible).toBe(true);
    });
  });
});
