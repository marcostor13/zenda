import { Test } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { GuarderiaSeeder } from './guarderia.seeder';
import { Guarderia } from './guarderia.schema';

describe('GuarderiaSeeder', () => {
  let seeder: GuarderiaSeeder;
  let model: { countDocuments: jest.Mock; insertMany: jest.Mock };
  const setCount = (n: number) => model.countDocuments.mockReturnValue({ exec: jest.fn().mockResolvedValue(n) });

  beforeEach(async () => {
    model = {
      countDocuments: jest.fn().mockReturnValue({ exec: jest.fn().mockResolvedValue(0) }),
      insertMany: jest.fn().mockResolvedValue([]),
    };
    const ref = await Test.createTestingModule({
      providers: [GuarderiaSeeder, { provide: getModelToken(Guarderia.name), useValue: model }],
    }).compile();
    seeder = ref.get(GuarderiaSeeder);
  });

  it('siembra demo cuando la colección está vacía', async () => {
    setCount(0);
    await seeder.onModuleInit();
    expect(model.insertMany).toHaveBeenCalledTimes(1);
  });

  it('no siembra si ya existen datos', async () => {
    setCount(2);
    await seeder.onModuleInit();
    expect(model.insertMany).not.toHaveBeenCalled();
  });
});
