import { Test } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { TransporteSeeder } from './transporte.seeder';
import { Transporte } from './transporte.schema';

describe('TransporteSeeder', () => {
  let seeder: TransporteSeeder;
  let model: { countDocuments: jest.Mock; insertMany: jest.Mock };

  const setCount = (n: number): void => {
    model.countDocuments.mockReturnValue({ exec: jest.fn().mockResolvedValue(n) });
  };

  beforeEach(async () => {
    model = {
      countDocuments: jest.fn().mockReturnValue({ exec: jest.fn().mockResolvedValue(0) }),
      insertMany: jest.fn().mockResolvedValue([]),
    };

    const moduleRef = await Test.createTestingModule({
      providers: [TransporteSeeder, { provide: getModelToken(Transporte.name), useValue: model }],
    }).compile();

    seeder = moduleRef.get(TransporteSeeder);
  });

  it('debería sembrar transportes demo cuando no hay ninguno', async () => {
    setCount(0);
    await seeder.onModuleInit();
    expect(model.insertMany).toHaveBeenCalledTimes(1);

    const sembrados = model.insertMany.mock.calls[0][0] as Partial<Transporte>[];
    expect(sembrados.length).toBe(3);
    expect(sembrados.every((s) => s.moneda === 'EUR')).toBe(true);
    expect(sembrados.every((s) => s.ubicacion?.ciudad === 'Madrid')).toBe(true);
  });

  /**
   * Regresión (reporte del cliente del 10-09-2026). Ningún seeder fijaba
   * `comercioActivo` y el esquema lo deja en `false`: los datos de demostración
   * existían en la base y no salían en ninguna búsqueda, porque el buscador
   * filtra por esa copia y no por el estado del comercio.
   */
  it('debería sembrarlos visibles para el buscador', async () => {
    setCount(0);
    await seeder.onModuleInit();

    const sembrados = model.insertMany.mock.calls[0][0] as Partial<Transporte>[];
    expect(sembrados.every((s) => s.estado === 'publicado')).toBe(true);
    expect(sembrados.every((s) => s.comercioActivo === true)).toBe(true);
  });

  it('no debería sembrar si ya existen transportes', async () => {
    setCount(3);
    await seeder.onModuleInit();
    expect(model.insertMany).not.toHaveBeenCalled();
  });

  it('no debería propagar errores de inserción', async () => {
    setCount(0);
    model.insertMany.mockRejectedValue(new Error('db caída'));
    await expect(seeder.onModuleInit()).resolves.toBeUndefined();
  });
});
