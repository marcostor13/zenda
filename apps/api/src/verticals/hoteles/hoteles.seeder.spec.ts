import { Test } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { HotelesSeeder } from './hoteles.seeder';
import { Hoteles } from './hoteles.schema';

describe('HotelesSeeder', () => {
  let seeder: HotelesSeeder;
  let model: { countDocuments: jest.Mock; insertMany: jest.Mock };
  const setCount = (n: number) => model.countDocuments.mockReturnValue({ exec: jest.fn().mockResolvedValue(n) });

  beforeEach(async () => {
    model = {
      countDocuments: jest.fn().mockReturnValue({ exec: jest.fn().mockResolvedValue(0) }),
      insertMany: jest.fn().mockResolvedValue([]),
    };
    const ref = await Test.createTestingModule({
      providers: [HotelesSeeder, { provide: getModelToken(Hoteles.name), useValue: model }],
    }).compile();
    seeder = ref.get(HotelesSeeder);
  });

  it('siembra demo cuando la colección está vacía', async () => {
    setCount(0);
    await seeder.onModuleInit();
    expect(model.insertMany).toHaveBeenCalledTimes(1);
  });

  /**
   * Regresión (reporte del cliente del 10-09-2026). Ningún seeder fijaba
   * `comercioActivo` y el esquema lo deja en `false`: los datos de demostración
   * existían en la base y no salían en ninguna búsqueda, porque el buscador
   * filtra por esa copia y no por el estado del comercio.
   */
  it('siembra los listados visibles para el buscador', async () => {
    setCount(0);
    await seeder.onModuleInit();

    const sembrados = model.insertMany.mock.calls[0][0] as Array<Record<string, unknown>>;
    expect(sembrados.length).toBeGreaterThan(0);
    for (const listado of sembrados) {
      expect(listado['estado']).toBe('publicado');
      expect(listado['comercioActivo']).toBe(true);
    }
  });

  it('no siembra si ya existen datos', async () => {
    setCount(3);
    await seeder.onModuleInit();
    expect(model.insertMany).not.toHaveBeenCalled();
  });
});
