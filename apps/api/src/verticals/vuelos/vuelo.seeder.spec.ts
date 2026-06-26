import { Test } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { VueloSeeder } from './vuelo.seeder';
import { Vuelo } from './vuelo.schema';

describe('VueloSeeder', () => {
  let seeder: VueloSeeder;
  let model: { countDocuments: jest.Mock; insertMany: jest.Mock };
  const setCount = (n: number) => model.countDocuments.mockReturnValue({ exec: jest.fn().mockResolvedValue(n) });

  beforeEach(async () => {
    model = {
      countDocuments: jest.fn().mockReturnValue({ exec: jest.fn().mockResolvedValue(0) }),
      insertMany: jest.fn().mockResolvedValue([]),
    };
    const ref = await Test.createTestingModule({
      providers: [VueloSeeder, { provide: getModelToken(Vuelo.name), useValue: model }],
    }).compile();
    seeder = ref.get(VueloSeeder);
  });

  it('siembra vuelos demo cuando no hay ninguno', async () => {
    setCount(0);
    await seeder.onModuleInit();
    expect(model.insertMany).toHaveBeenCalledTimes(1);
  });

  it('no siembra si ya existen vuelos', async () => {
    setCount(2);
    await seeder.onModuleInit();
    expect(model.insertMany).not.toHaveBeenCalled();
  });
});
