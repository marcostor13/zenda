import { Test } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { Types } from 'mongoose';
import { ReviewsRepository } from './reviews.repository';
import { Resena } from './resena.schema';

describe('ReviewsRepository', () => {
  let repo: ReviewsRepository;
  let resenaModel: any;

  const USUARIO_ID = new Types.ObjectId().toString();
  const SERVICIO_ID = new Types.ObjectId().toString();
  const COMERCIO_ID = new Types.ObjectId().toString();
  const RESERVA_ID = new Types.ObjectId().toString();

  const conExec = (valor: unknown) => ({ exec: jest.fn().mockResolvedValue(valor) });

  /** Cadena `find().sort().skip().limit().lean().exec()` completa. */
  function mockFind(items: unknown[]) {
    const cadena = {
      sort: jest.fn().mockReturnThis(),
      skip: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      lean: jest.fn().mockReturnThis(),
      exec: jest.fn().mockResolvedValue(items),
    };
    resenaModel.find.mockReturnValue(cadena);
    return cadena;
  }

  beforeEach(async () => {
    resenaModel = {
      create: jest.fn().mockResolvedValue({ _id: 'r1' }),
      find: jest.fn(),
      findOne: jest.fn().mockReturnValue(conExec(null)),
      findById: jest.fn().mockReturnValue(conExec(null)),
      findByIdAndUpdate: jest.fn().mockReturnValue(conExec(null)),
      countDocuments: jest.fn().mockReturnValue(conExec(0)),
      aggregate: jest.fn().mockResolvedValue([]),
    };

    const moduleRef = await Test.createTestingModule({
      providers: [
        ReviewsRepository,
        { provide: getModelToken(Resena.name), useValue: resenaModel },
      ],
    }).compile();

    repo = moduleRef.get(ReviewsRepository);
  });

  describe('consultas básicas', () => {
    it('debería crear la reseña con los datos recibidos', async () => {
      await repo.crear({ puntuacion: 5 } as never);

      expect(resenaModel.create).toHaveBeenCalledWith({ puntuacion: 5 });
    });

    it('debería buscar por reserva convirtiendo el id a ObjectId', async () => {
      await repo.findByReserva(RESERVA_ID);

      const filtro = resenaModel.findOne.mock.calls[0][0];
      expect(filtro.reservaId).toBeInstanceOf(Types.ObjectId);
      expect(String(filtro.reservaId)).toBe(RESERVA_ID);
    });

    it('debería buscar por id', async () => {
      await repo.findById('r1');

      expect(resenaModel.findById).toHaveBeenCalledWith('r1');
    });
  });

  describe('listados públicos', () => {
    it('debería excluir las eliminadas al listar por servicio', async () => {
      mockFind([]);

      await repo.listarPorServicio(SERVICIO_ID);

      const filtro = resenaModel.find.mock.calls[0][0];
      expect(filtro.eliminada).toEqual({ $ne: true });
      expect(String(filtro.servicioId)).toBe(SERVICIO_ID);
    });

    it('debería excluir las eliminadas al listar por comercio', async () => {
      mockFind([]);

      await repo.listarPorComercio(COMERCIO_ID);

      expect(resenaModel.find.mock.calls[0][0].eliminada).toEqual({ $ne: true });
    });

    it('debería incluir las eliminadas al listar las del propio usuario', async () => {
      // El autor debe poder ver las suyas en el filtro "Eliminadas".
      mockFind([]);

      await repo.listarPorUsuario(USUARIO_ID);

      expect(resenaModel.find.mock.calls[0][0]).not.toHaveProperty('eliminada');
    });

    it('debería devolver como texto los ids de reserva ya reseñados', async () => {
      const reservaId = new Types.ObjectId();
      mockFind([{ reservaId }]);

      await expect(repo.listarReservaIdsReseñados(USUARIO_ID))
        .resolves.toEqual([String(reservaId)]);
    });
  });

  describe('listarParaAdmin', () => {
    it('debería consultar sin condiciones cuando no se filtra', async () => {
      mockFind([]);

      await repo.listarParaAdmin({});

      expect(resenaModel.find).toHaveBeenCalledWith({});
    });

    it('debería poder pedir solo las ocultas', async () => {
      // El admin tiene que poder revisar y revertir lo ya retirado.
      mockFind([]);

      await repo.listarParaAdmin({ ocultas: true });

      expect(resenaModel.find.mock.calls[0][0].eliminada).toBe(true);
    });

    it('debería poder pedir solo las visibles', async () => {
      mockFind([]);

      await repo.listarParaAdmin({ ocultas: false });

      expect(resenaModel.find.mock.calls[0][0].eliminada).toEqual({ $ne: true });
    });

    it('debería filtrar por puntuación exacta', async () => {
      mockFind([]);

      await repo.listarParaAdmin({ puntuacion: 1 });

      expect(resenaModel.find.mock.calls[0][0].puntuacion).toBe(1);
    });

    it('debería buscar en autor, servicio y comentario escapando la expresión regular', async () => {
      mockFind([]);

      await repo.listarParaAdmin({ buscar: 'a.b' });

      const query = resenaModel.find.mock.calls[0][0];
      expect(query.$or).toHaveLength(3);
      expect(query.$or[0].usuarioNombre.source).toBe('a\\.b');
    });

    it('debería calcular el salto a partir de la página', async () => {
      const cadena = mockFind([]);

      await repo.listarParaAdmin({}, 3, 20);

      expect(cadena.skip).toHaveBeenCalledWith(40);
      expect(cadena.limit).toHaveBeenCalledWith(20);
    });

    it('debería devolver los elementos junto al total', async () => {
      mockFind([{ _id: 'r1' }]);
      resenaModel.countDocuments.mockReturnValue(conExec(9));

      await expect(repo.listarParaAdmin({}))
        .resolves.toEqual({ items: [{ _id: 'r1' }], total: 9 });
    });
  });

  describe('modificaciones', () => {
    it('debería ocultar sin borrar, para que siga siendo auditable', async () => {
      await repo.fijarOculta('r1', true);

      expect(resenaModel.findByIdAndUpdate)
        .toHaveBeenCalledWith('r1', { eliminada: true }, { new: true });
    });

    it('debería reponer una reseña oculta', async () => {
      await repo.fijarOculta('r1', false);

      expect(resenaModel.findByIdAndUpdate)
        .toHaveBeenCalledWith('r1', { eliminada: false }, { new: true });
    });

    it('debería eliminar con borrado lógico, no físico', async () => {
      await repo.eliminar('r1');

      expect(resenaModel.findByIdAndUpdate)
        .toHaveBeenCalledWith('r1', { eliminada: true }, { new: true });
    });

    it('debería actualizar devolviendo el documento nuevo', async () => {
      await repo.actualizar('r1', { comentario: 'Otro' } as never);

      expect(resenaModel.findByIdAndUpdate)
        .toHaveBeenCalledWith('r1', { comentario: 'Otro' }, { new: true });
    });

    it('debería guardar la respuesta del comercio', async () => {
      await repo.guardarRespuesta('r1', 'Gracias por tu opinión');

      expect(resenaModel.findByIdAndUpdate)
        .toHaveBeenCalledWith('r1', { respuesta: 'Gracias por tu opinión' }, { new: true });
    });
  });

  describe('agregadoServicio', () => {
    it('debería devolver media y total de las reseñas activas', async () => {
      resenaModel.aggregate.mockResolvedValue([{ promedio: 4.5, total: 8 }]);

      await expect(repo.agregadoServicio(SERVICIO_ID))
        .resolves.toEqual({ promedio: 4.5, total: 8 });
    });

    it('debería excluir las eliminadas del agregado', async () => {
      await repo.agregadoServicio(SERVICIO_ID);

      const match = resenaModel.aggregate.mock.calls[0][0][0].$match;
      expect(match.eliminada).toEqual({ $ne: true });
    });

    it('debería devolver ceros cuando el servicio no tiene reseñas', async () => {
      resenaModel.aggregate.mockResolvedValue([]);

      await expect(repo.agregadoServicio(SERVICIO_ID))
        .resolves.toEqual({ promedio: 0, total: 0 });
    });
  });
});
