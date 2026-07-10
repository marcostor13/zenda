import { Test } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { AdiestramientoSeeder } from './adiestramiento.seeder';
import { Adiestramiento } from './adiestramiento.schema';

describe('AdiestramientoSeeder', () => {
  let seeder: AdiestramientoSeeder;
  let model: { countDocuments: jest.Mock; insertMany: jest.Mock };
  const setCount = (n: number) => model.countDocuments.mockReturnValue({ exec: jest.fn().mockResolvedValue(n) });

  beforeEach(async () => {
    model = {
      countDocuments: jest.fn().mockReturnValue({ exec: jest.fn().mockResolvedValue(0) }),
      insertMany: jest.fn().mockResolvedValue([]),
    };
    const ref = await Test.createTestingModule({
      providers: [AdiestramientoSeeder, { provide: getModelToken(Adiestramiento.name), useValue: model }],
    }).compile();
    seeder = ref.get(AdiestramientoSeeder);
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
