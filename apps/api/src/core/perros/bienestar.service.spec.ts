import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { Types } from 'mongoose';
import { TamanoPerro, Vacuna } from 'shared';
import { BienestarService } from './bienestar.service';
import { Perro } from './perro.schema';
import { PerroHistorial } from './perro-historial.schema';
import { DomainException } from '../../shared/exceptions/domain.exception';

const PERRO_ID = new Types.ObjectId().toString();

const perroCompleto = () => ({
  vacunasDetalle: [
    { tipo: Vacuna.ANTIRRABICA }, { tipo: Vacuna.TETRAVALENTE }, { tipo: Vacuna.TOS_PERRERA },
  ],
  peso: 12,
  tamano: TamanoPerro.MEDIANO,
  microchip: '941000012345678',
  esterilizado: true,
  cartillaSanitariaUrl: 'https://x/cartilla.pdf',
  enfermedades: [],
});

describe('BienestarService', () => {
  let service: BienestarService;
  let perroModel: { findById: jest.Mock };
  let historialModel: { find: jest.Mock };

  const conPerro = (perro: unknown): void => {
    perroModel.findById.mockReturnValue({ lean: () => ({ exec: () => Promise.resolve(perro) }) });
  };

  const conRevisiones = (revisiones: Array<{ createdAt: Date }>): void => {
    historialModel.find.mockReturnValue({
      sort: () => ({ select: () => ({ lean: () => ({ exec: () => Promise.resolve(revisiones) }) }) }),
    });
  };

  beforeEach(async () => {
    perroModel = { findById: jest.fn() };
    historialModel = { find: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BienestarService,
        { provide: getModelToken(Perro.name), useValue: perroModel },
        { provide: getModelToken(PerroHistorial.name), useValue: historialModel },
      ],
    }).compile();

    service = module.get(BienestarService);
    conPerro(perroCompleto());
    conRevisiones([{ createdAt: new Date() }]);
  });

  it('debería dar la máxima puntuación a un perro con todo al día', async () => {
    const indice = await service.calcular(PERRO_ID);

    expect(indice.puntuacion).toBe(100);
    expect(indice.nivel).toBe('excelente');
    expect(indice.descuentoSeguroPct).toBe(0.15);
  });

  it('no debería aconsejar nada en los ejes que ya están al máximo', async () => {
    const indice = await service.calcular(PERRO_ID);

    expect(indice.ejes.every((e) => !e.consejo)).toBe(true);
  });

  it('debería bajar la puntuación y explicar qué falta sin vacunas', async () => {
    conPerro({ ...perroCompleto(), vacunasDetalle: [] });

    const indice = await service.calcular(PERRO_ID);

    expect(indice.puntuacion).toBe(65);
    const vacunas = indice.ejes.find((e) => e.clave === 'vacunas');
    expect(vacunas?.puntos).toBe(0);
    expect(vacunas?.consejo).toContain('antirrábica');
  });

  it('debería penalizar progresivamente la falta de revisiones', async () => {
    const haceDosAnios = new Date(Date.now() - 730 * 24 * 60 * 60 * 1000);
    conRevisiones([{ createdAt: haceDosAnios }]);

    const indice = await service.calcular(PERRO_ID);

    expect(indice.ejes.find((e) => e.clave === 'revisiones')?.puntos).toBe(0);
  });

  it('no debería penalizar a ciegas cuando falta el peso: lo pide', async () => {
    conPerro({ ...perroCompleto(), peso: undefined });

    const indice = await service.calcular(PERRO_ID);
    const peso = indice.ejes.find((e) => e.clave === 'peso');

    expect(peso?.puntos).toBe(10);
    expect(peso?.consejo).toContain('peso');
  });

  it('debería avisar si el peso no encaja con el tamaño declarado', async () => {
    conPerro({ ...perroCompleto(), peso: 45, tamano: TamanoPerro.PEQUENO });

    const indice = await service.calcular(PERRO_ID);

    expect(indice.ejes.find((e) => e.clave === 'peso')?.consejo).toContain('no encaja');
  });

  it('debería dar descuento por tramos, no de forma continua', async () => {
    conPerro({ ...perroCompleto(), vacunasDetalle: [{ tipo: Vacuna.ANTIRRABICA }] });

    const indice = await service.calcular(PERRO_ID);

    // ~76 puntos → tramo del 10 %, no un valor proporcional.
    expect(indice.descuentoSeguroPct).toBe(0.1);
  });

  it('no debería dar descuento a un perro sin cuidado preventivo registrado', async () => {
    conPerro({ vacunasDetalle: [], enfermedades: ['artrosis'], esterilizado: false });
    conRevisiones([]);

    const indice = await service.calcular(PERRO_ID);

    expect(indice.descuentoSeguroPct).toBe(0);
    expect(indice.nivel).toBe('inicial');
  });

  it('debería lanzar 404 si el perro no existe', async () => {
    conPerro(null);

    await expect(service.calcular(PERRO_ID)).rejects.toThrow(DomainException);
  });

  it('debería rechazar un identificador malformado con 400', async () => {
    await expect(service.calcular('no-es-un-id')).rejects.toThrow(DomainException);
  });
});
