import { Test } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { Types } from 'mongoose';
import { TipoFavorito } from 'shared';
import { FavoritosRepository } from './favoritos.repository';
import { Favorito } from './favorito.schema';

describe('FavoritosRepository', () => {
  let repository: FavoritosRepository;
  let model: Record<string, jest.Mock>;

  const USUARIO = '650000000000000000000001';
  const SERVICIO = '650000000000000000000002';
  const LUGAR = '650000000000000000000003';

  /** Cadena de consulta con los métodos que encadena el repositorio. */
  const cadena = (resultado: unknown) => {
    const chain: Record<string, jest.Mock> = {};
    ['sort', 'select', 'lean'].forEach((m) => (chain[m] = jest.fn(() => chain)));
    chain['exec'] = jest.fn().mockResolvedValue(resultado);
    return chain;
  };

  beforeEach(async () => {
    model = {
      findOneAndUpdate: jest.fn().mockReturnValue({ exec: jest.fn().mockResolvedValue({}) }),
      deleteOne: jest.fn().mockReturnValue({ exec: jest.fn().mockResolvedValue({}) }),
      find: jest.fn().mockReturnValue(cadena([])),
      countDocuments: jest.fn().mockReturnValue({ exec: jest.fn().mockResolvedValue(0) }),
    };

    const moduleRef = await Test.createTestingModule({
      providers: [FavoritosRepository, { provide: getModelToken(Favorito.name), useValue: model }],
    }).compile();

    repository = moduleRef.get(FavoritosRepository);
  });

  describe('agregar', () => {
    it('debería ser idempotente vía upsert', async () => {
      await repository.agregar(USUARIO, SERVICIO);

      const [, , opciones] = model['findOneAndUpdate'].mock.calls[0];
      expect(opciones).toEqual({ upsert: true, new: true });
    });

    it('debería fijar el precio sólo al insertar, no al repetir', async () => {
      // Si se pisara, volver a pulsar el corazón borraría el precio original y
      // la alerta de bajada de precio dejaría de tener referencia.
      await repository.agregar(USUARIO, SERVICIO, 120);

      const [, actualizacion] = model['findOneAndUpdate'].mock.calls[0];
      expect(actualizacion.$setOnInsert).toMatchObject({
        tipo: TipoFavorito.SERVICIO,
        precioGuardado: 120,
      });
      expect(actualizacion.$set).toBeUndefined();
    });

    it('debería convertir los ids a ObjectId', async () => {
      await repository.agregar(USUARIO, SERVICIO);

      const [clave] = model['findOneAndUpdate'].mock.calls[0];
      expect(clave.usuarioId).toBeInstanceOf(Types.ObjectId);
      expect(clave.servicioId).toBeInstanceOf(Types.ObjectId);
    });
  });

  it('debería eliminar sólo el favorito de ese usuario', async () => {
    await repository.eliminar(USUARIO, SERVICIO);

    const [filtro] = model['deleteOne'].mock.calls[0];
    expect(String(filtro.usuarioId)).toBe(USUARIO);
    expect(String(filtro.servicioId)).toBe(SERVICIO);
  });

  describe('listados', () => {
    it('debería devolver los ids de servicio como texto y del más reciente al más antiguo', async () => {
      const chain = cadena([{ servicioId: new Types.ObjectId(SERVICIO) }]);
      model['find'].mockReturnValue(chain);

      const ids = await repository.listarServicioIds(USUARIO);

      expect(ids).toEqual([SERVICIO]);
      expect(chain['sort']).toHaveBeenCalledWith({ createdAt: -1 });
    });

    it('debería separar los favoritos de servicio de los de lugar', async () => {
      // Comparten colección, así que sin el $exists se mezclarían los dos.
      await repository.listarServicioIds(USUARIO);
      expect(model['find'].mock.calls[0][0]).toMatchObject({ servicioId: { $exists: true } });

      await repository.listarLugarIds(USUARIO);
      expect(model['find'].mock.calls[1][0]).toMatchObject({ lugarId: { $exists: true } });
    });

    it('debería devolver fecha y precio snapshot al listar servicios', async () => {
      const guardado = new Date('2026-08-01');
      model['find'].mockReturnValue(
        cadena([{ servicioId: new Types.ObjectId(SERVICIO), createdAt: guardado, precioGuardado: 99 }]),
      );

      await expect(repository.listarServicios(USUARIO)).resolves.toEqual([
        { servicioId: SERVICIO, createdAt: guardado, precioGuardado: 99 },
      ]);
    });
  });

  it('debería contar sólo los favoritos de servicio', async () => {
    await repository.contar(USUARIO);

    expect(model['countDocuments'].mock.calls[0][0]).toMatchObject({ servicioId: { $exists: true } });
  });

  it('debería marcar los favoritos de lugar con su propio tipo', async () => {
    await repository.agregarLugar(USUARIO, LUGAR);

    const [, actualizacion] = model['findOneAndUpdate'].mock.calls[0];
    expect(actualizacion.$setOnInsert.tipo).toBe(TipoFavorito.LUGAR);
  });

  it('debería eliminar el favorito de lugar por usuario y lugar', async () => {
    await repository.eliminarLugar(USUARIO, LUGAR);

    const [filtro] = model['deleteOne'].mock.calls[0];
    expect(String(filtro.lugarId)).toBe(LUGAR);
  });
});
