import { Model } from 'mongoose';
import { CentrosPoblacionRepository } from './centros-poblacion.repository';
import { CentroPoblacionDocument } from './centro-poblacion.schema';

describe('CentrosPoblacionRepository', () => {
  const cadena = (resultado: unknown) => ({
    select: jest.fn().mockReturnThis(),
    lean: jest.fn().mockReturnThis(),
    exec: jest.fn().mockResolvedValue(resultado),
  });

  let modelo: { findOne: jest.Mock; updateOne: jest.Mock };
  let repo: CentrosPoblacionRepository;

  beforeEach(() => {
    modelo = {
      findOne: jest.fn().mockReturnValue(cadena({ lat: 1, lng: 2 })),
      updateOne: jest.fn().mockReturnValue({ exec: jest.fn().mockResolvedValue({}) }),
    };
    repo = new CentrosPoblacionRepository(modelo as unknown as Model<CentroPoblacionDocument>);
  });

  it('debería buscar el centro por su clave', async () => {
    await expect(repo.buscar('valencia')).resolves.toEqual({ lat: 1, lng: 2 });
    expect(modelo.findOne).toHaveBeenCalledWith({ clave: 'valencia' });
  });

  it('debería guardar con upsert para no chocar con el índice único', async () => {
    await repo.guardar('valencia', 'Valencia', { lat: 39.47, lng: -0.38 });

    expect(modelo.updateOne).toHaveBeenCalledWith(
      { clave: 'valencia' },
      { $set: { ciudad: 'Valencia', lat: 39.47, lng: -0.38 } },
      { upsert: true },
    );
  });
});
