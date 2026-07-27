import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { Types } from 'mongoose';
import { COMISION_PCT_DEFAULT, VerticalKey } from 'shared';
import { ComisionResolverService } from './comision-resolver.service';
import { ComisionConfigRepository } from './comision-config.repository';
import { Comercio } from '../comercios/comercio.schema';

const COMERCIO_ID = new Types.ObjectId().toString();

/** Tramos del plan: <30 → 8 %, 30–100 → 10 %, 100–300 → 12 %, resto → 15 %. */
const TRAMOS = [
  { hastaEur: 30, comisionPct: 0.08 },
  { hastaEur: 100, comisionPct: 0.1 },
  { hastaEur: 300, comisionPct: 0.12 },
  { hastaEur: Number.MAX_SAFE_INTEGER, comisionPct: 0.15 },
];

describe('ComisionResolverService', () => {
  let service: ComisionResolverService;
  let comercioModel: { findById: jest.Mock };
  let configRepo: { obtenerComisionEfectiva: jest.Mock };

  const conConfig = (extra: Record<string, unknown> = {}): void => {
    configRepo.obtenerComisionEfectiva.mockResolvedValue({
      comisionPct: 0.15, stripePct: 0.015, stripeFijoEur: 0.25, tramos: [], ...extra,
    });
  };

  const conComercio = (comercio: unknown): void => {
    comercioModel.findById.mockReturnValue({
      select: () => ({ exec: () => Promise.resolve(comercio) }),
    });
  };

  const resolver = (montoSubtotal = 50, comercioId?: string) =>
    service.resolver({ vertical: VerticalKey.ALOJAMIENTO, montoSubtotal, comercioId });

  beforeEach(async () => {
    comercioModel = { findById: jest.fn() };
    configRepo = { obtenerComisionEfectiva: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ComisionResolverService,
        { provide: getModelToken(Comercio.name), useValue: comercioModel },
        { provide: ComisionConfigRepository, useValue: configRepo },
      ],
    }).compile();

    service = module.get(ComisionResolverService);
    conConfig();
    conComercio(null);
  });

  describe('prioridad de la jerarquía', () => {
    it('la comisión congelada del socio fundador gana sobre todo lo demás', async () => {
      conConfig({ tramos: TRAMOS });
      conComercio({
        socioFundador: true,
        comisionPctCongelada: 0.06,
        comisionPctOverride: 0.2,
        congelacionHasta: new Date(Date.now() + 86_400_000),
      });

      const resuelta = await resolver(50, COMERCIO_ID);

      expect(resuelta.comisionPct).toBe(0.06);
      expect(resuelta.origen).toBe('socio_fundador');
    });

    it('una congelación vencida deja de aplicarse y vuelve la tarifa vigente', async () => {
      conConfig({ tramos: TRAMOS });
      conComercio({
        socioFundador: true,
        comisionPctCongelada: 0.06,
        congelacionHasta: new Date(Date.now() - 86_400_000),
      });

      const resuelta = await resolver(50, COMERCIO_ID);

      expect(resuelta.origen).toBe('tramo_vertical');
      expect(resuelta.comisionPct).toBe(0.1);
    });

    it('el override del comercio gana sobre los tramos', async () => {
      conConfig({ tramos: TRAMOS });
      conComercio({ comisionPctOverride: 0.2 });

      const resuelta = await resolver(50, COMERCIO_ID);

      expect(resuelta.comisionPct).toBe(0.2);
      expect(resuelta.origen).toBe('override_comercio');
    });

    it('debería respetar un override del 0 %, no confundirlo con "sin valor"', async () => {
      conComercio({ comisionPctOverride: 0 });

      const resuelta = await resolver(50, COMERCIO_ID);

      expect(resuelta.comisionPct).toBe(0);
      expect(resuelta.origen).toBe('override_comercio');
    });

    it('sin tramos ni override usa la comisión del vertical', async () => {
      const resuelta = await resolver(50);

      expect(resuelta.comisionPct).toBe(0.15);
      expect(resuelta.origen).toBe('vertical');
    });

    it('sin nada configurado cae en la comisión por defecto', async () => {
      conConfig({ comisionPct: null });

      const resuelta = await resolver(50);

      expect(resuelta.comisionPct).toBe(COMISION_PCT_DEFAULT);
      expect(resuelta.origen).toBe('defecto');
    });
  });

  describe('tramos por importe', () => {
    beforeEach(() => conConfig({ tramos: TRAMOS }));

    it('debería aplicar el 8 % por debajo de 30 €', async () => {
      await expect(resolver(20)).resolves.toMatchObject({ comisionPct: 0.08 });
    });

    it('debería incluir el límite en su propio tramo', async () => {
      await expect(resolver(30)).resolves.toMatchObject({ comisionPct: 0.08 });
      await expect(resolver(100)).resolves.toMatchObject({ comisionPct: 0.1 });
    });

    it('debería saltar al tramo siguiente justo por encima del límite', async () => {
      await expect(resolver(30.01)).resolves.toMatchObject({ comisionPct: 0.1 });
    });

    it('debería aplicar el último tramo a importes muy altos', async () => {
      await expect(resolver(5000)).resolves.toMatchObject({ comisionPct: 0.15 });
    });

    it('debería ordenar los tramos aunque lleguen desordenados', async () => {
      conConfig({ tramos: [...TRAMOS].reverse() });

      await expect(resolver(20)).resolves.toMatchObject({ comisionPct: 0.08 });
    });

    it('debería informar del tramo aplicado, para poder explicarlo en el reporte', async () => {
      const resuelta = await resolver(50);

      expect(resuelta.tramoHastaEur).toBe(100);
    });
  });

  it('debería ignorar un comercioId malformado en vez de reventar', async () => {
    const resuelta = await resolver(50, 'no-es-un-id');

    expect(resuelta.origen).toBe('vertical');
    expect(comercioModel.findById).not.toHaveBeenCalled();
  });

  it('debería propagar siempre las tarifas de Stripe del vertical', async () => {
    conConfig({ stripePct: 0.029, stripeFijoEur: 0.3 });

    const resuelta = await resolver(50);

    expect(resuelta.stripePct).toBe(0.029);
    expect(resuelta.stripeFijoEur).toBe(0.3);
  });
});
