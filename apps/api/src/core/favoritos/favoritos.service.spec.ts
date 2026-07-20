import { Test } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { Types } from 'mongoose';
import { FavoritosService } from './favoritos.service';
import { FavoritosRepository } from './favoritos.repository';
import { Servicio } from '../catalog/servicio.schema';

const USUARIO_ID = new Types.ObjectId().toString();

describe('FavoritosService', () => {
  let service: FavoritosService;
  let repo: jest.Mocked<Pick<FavoritosRepository, 'agregar' | 'eliminar' | 'listarServicioIds' | 'contar'>>;
  let servicioModel: { find: jest.Mock };

  beforeEach(async () => {
    repo = {
      agregar: jest.fn(),
      eliminar: jest.fn(),
      listarServicioIds: jest.fn(),
      contar: jest.fn(),
    };
    servicioModel = { find: jest.fn() };

    const moduleRef = await Test.createTestingModule({
      providers: [
        FavoritosService,
        { provide: FavoritosRepository, useValue: repo },
        { provide: getModelToken(Servicio.name), useValue: servicioModel },
      ],
    }).compile();

    service = moduleRef.get(FavoritosService);
  });

  it('debería marcar un servicio como favorito', async () => {
    repo.agregar.mockResolvedValue({} as never);
    const resultado = await service.agregar(USUARIO_ID, 's1');
    expect(repo.agregar).toHaveBeenCalledWith(USUARIO_ID, 's1');
    expect(resultado).toEqual({ servicioId: 's1', favorito: true });
  });

  it('debería quitar un servicio de favoritos', async () => {
    repo.eliminar.mockResolvedValue(undefined);
    const resultado = await service.eliminar(USUARIO_ID, 's1');
    expect(repo.eliminar).toHaveBeenCalledWith(USUARIO_ID, 's1');
    expect(resultado).toEqual({ servicioId: 's1', favorito: false });
  });

  it('debería devolver lista vacía si el usuario no tiene favoritos', async () => {
    repo.listarServicioIds.mockResolvedValue([]);
    const resultado = await service.listar(USUARIO_ID);
    expect(resultado).toEqual([]);
    expect(servicioModel.find).not.toHaveBeenCalled();
  });

  it('debería enriquecer los favoritos respetando el orden de guardado', async () => {
    const idA = new Types.ObjectId();
    const idB = new Types.ObjectId();
    repo.listarServicioIds.mockResolvedValue([String(idA), String(idB)]);

    const exec = jest.fn().mockResolvedValue([
      // Devueltos en orden inverso a propósito: el servicio debe reordenarlos.
      { _id: idB, titulo: 'Peluquería', imagenes: ['b.jpg'], ubicacion: { ciudad: 'Valencia' }, vertical: 'peluqueria', precioBase: 20, moneda: 'EUR', ratingPromedio: 4, totalReseñas: 3 },
      { _id: idA, titulo: 'Hotel', imagenes: ['a.jpg'], ubicacion: { ciudad: 'Madrid' }, vertical: 'alojamiento', precioBase: 40, moneda: 'EUR', ratingPromedio: 5, totalReseñas: 10 },
    ]);
    servicioModel.find.mockReturnValue({ select: () => ({ lean: () => ({ exec }) }) });

    const resultado = await service.listar(USUARIO_ID);

    expect(resultado.map((r) => r.servicioId)).toEqual([String(idA), String(idB)]);
    expect(resultado[0]).toMatchObject({ titulo: 'Hotel', imagen: 'a.jpg', ciudad: 'Madrid' });
  });

  it('debería descartar favoritos cuyo servicio fue eliminado', async () => {
    const idA = new Types.ObjectId();
    const idBorrado = new Types.ObjectId();
    repo.listarServicioIds.mockResolvedValue([String(idA), String(idBorrado)]);

    const exec = jest.fn().mockResolvedValue([
      { _id: idA, titulo: 'Hotel', imagenes: [], ubicacion: { ciudad: 'Madrid' }, vertical: 'alojamiento', precioBase: 40, moneda: 'EUR', ratingPromedio: 5, totalReseñas: 10 },
    ]);
    servicioModel.find.mockReturnValue({ select: () => ({ lean: () => ({ exec }) }) });

    const resultado = await service.listar(USUARIO_ID);
    expect(resultado).toHaveLength(1);
    expect(resultado[0].imagen).toBeNull();
  });
});
