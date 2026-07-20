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

  it('no siembra si ya existen datos', async () => {
    setCount(3);
    await seeder.onModuleInit();
    expect(model.insertMany).not.toHaveBeenCalled();
  });
});
