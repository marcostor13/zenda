import { Test } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { TransporteSeeder } from './transporte.seeder';
import { Transporte } from './transporte.schema';

describe('TransporteSeeder', () => {
  let seeder: TransporteSeeder;
  let model: { countDocuments: jest.Mock; insertMany: jest.Mock };
  const setCount = (n: number) => model.countDocuments.mockReturnValue({ exec: jest.fn().mockResolvedValue(n) });

  beforeEach(async () => {
    model = {
      countDocuments: jest.fn().mockReturnValue({ exec: jest.fn().mockResolvedValue(0) }),
      insertMany: jest.fn().mockResolvedValue([]),
    };
    const ref = await Test.createTestingModule({
      providers: [TransporteSeeder, { provide: getModelToken(Transporte.name), useValue: model }],
    }).compile();
    seeder = ref.get(TransporteSeeder);
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
