import { Test } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { CatalogSeeder } from './catalog.seeder';
import { Hotel } from '../../verticals/hoteles/hotel.schema';

describe('CatalogSeeder', () => {
  let seeder: CatalogSeeder;
  let model: { estimatedDocumentCount: jest.Mock; insertMany: jest.Mock };

  const setCount = (n: number) =>
    model.estimatedDocumentCount.mockReturnValue({ exec: jest.fn().mockResolvedValue(n) });

  beforeEach(async () => {
    model = {
      estimatedDocumentCount: jest.fn().mockReturnValue({ exec: jest.fn().mockResolvedValue(0) }),
      insertMany: jest.fn().mockResolvedValue([]),
    };

    const moduleRef = await Test.createTestingModule({
      providers: [CatalogSeeder, { provide: getModelToken(Hotel.name), useValue: model }],
    }).compile();

    seeder = moduleRef.get(CatalogSeeder);
  });

  it('debería sembrar hoteles demo cuando la colección está vacía', async () => {
    setCount(0);
    await seeder.onModuleInit();
    expect(model.insertMany).toHaveBeenCalledTimes(1);
    expect(model.insertMany.mock.calls[0][0].length).toBeGreaterThan(0);
  });

  it('no debería sembrar si ya existen servicios', async () => {
    setCount(5);
    await seeder.onModuleInit();
    expect(model.insertMany).not.toHaveBeenCalled();
  });

  it('no debería propagar errores de inserción (el seed es opcional)', async () => {
    setCount(0);
    model.insertMany.mockRejectedValue(new Error('db caída'));
    await expect(seeder.onModuleInit()).resolves.toBeUndefined();
  });
});
