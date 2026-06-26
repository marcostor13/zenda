import { Test } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { TaxiSeeder } from './taxi.seeder';
import { Taxi } from './taxi.schema';

describe('TaxiSeeder', () => {
  let seeder: TaxiSeeder;
  let model: { countDocuments: jest.Mock; insertMany: jest.Mock };

  const setCount = (n: number) =>
    model.countDocuments.mockReturnValue({ exec: jest.fn().mockResolvedValue(n) });

  beforeEach(async () => {
    model = {
      countDocuments: jest.fn().mockReturnValue({ exec: jest.fn().mockResolvedValue(0) }),
      insertMany: jest.fn().mockResolvedValue([]),
    };

    const moduleRef = await Test.createTestingModule({
      providers: [TaxiSeeder, { provide: getModelToken(Taxi.name), useValue: model }],
    }).compile();

    seeder = moduleRef.get(TaxiSeeder);
  });

  it('debería sembrar taxis demo cuando no hay ninguno', async () => {
    setCount(0);
    await seeder.onModuleInit();
    expect(model.insertMany).toHaveBeenCalledTimes(1);
    expect(model.insertMany.mock.calls[0][0].length).toBeGreaterThan(0);
  });

  it('no debería sembrar si ya existen taxis', async () => {
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
