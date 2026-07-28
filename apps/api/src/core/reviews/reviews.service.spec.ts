import { Test } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { Types } from 'mongoose';
import { ReservaEstado } from 'shared';
import { ReviewsService } from './reviews.service';
import { ReviewsRepository } from './reviews.repository';
import { Reserva } from '../bookings/reserva.schema';
import { Servicio } from '../catalog/servicio.schema';
import { Usuario } from '../users/usuario.schema';
import { DomainException } from '../../shared/exceptions/domain.exception';
import { GrowthService } from '../eventos/growth.service';

const USUARIO_ID = new Types.ObjectId().toString();
const SERVICIO_ID = new Types.ObjectId();

function reservaMock(estado: ReservaEstado) {
  return {
    _id: new Types.ObjectId(),
    usuarioId: { toString: () => USUARIO_ID },
    servicioId: SERVICIO_ID,
    comercioId: new Types.ObjectId(),
    vertical: 'alojamiento',
    estado,
  };
}

describe('ReviewsService', () => {
  let service: ReviewsService;
  let repo: jest.Mocked<ReviewsRepository>;
  let reservaModel: { findById: jest.Mock; find: jest.Mock };
  let servicioModel: { findById: () => unknown; findByIdAndUpdate: () => unknown; find: jest.Mock };
  let growthService: jest.Mocked<Pick<GrowthService, 'marcarCompletada'>>;

  const dto = { reservaId: new Types.ObjectId().toString(), puntuacion: 5, comentario: 'Excelente' };

  beforeEach(async () => {
    reservaModel = { findById: jest.fn(), find: jest.fn() };
    const leanExec = (val: unknown) => ({ select: () => ({ lean: () => ({ exec: () => Promise.resolve(val) }) }) });

    servicioModel = {
      findById: () => leanExec({ titulo: 'Suite Canina' }),
      findByIdAndUpdate: () => ({ exec: () => Promise.resolve(null) }),
      find: jest.fn(),
    };

    const moduleRef = await Test.createTestingModule({
      providers: [
        ReviewsService,
        {
          provide: ReviewsRepository,
          useValue: {
            findByReserva: jest.fn().mockResolvedValue(null),
            crear: jest.fn().mockImplementation((d) => Promise.resolve({ _id: 'r1', ...d })),
            agregadoServicio: jest.fn().mockResolvedValue({ promedio: 5, total: 1 }),
            findById: jest.fn(),
            actualizar: jest.fn(),
            eliminar: jest.fn(),
            guardarRespuesta: jest.fn(),
            listarPorComercio: jest.fn(),
            listarReservaIdsReseñados: jest.fn().mockResolvedValue([]),
          },
        },
        { provide: getModelToken(Reserva.name), useValue: reservaModel },
        { provide: getModelToken(Servicio.name), useValue: servicioModel },
        {
          provide: getModelToken(Usuario.name),
          useValue: { findById: () => leanExec({ nombre: 'Juan' }) },
        },
        {
          provide: GrowthService,
          useValue: { marcarCompletada: jest.fn().mockResolvedValue(undefined) },
        },
      ],
    }).compile();

    service = moduleRef.get(ReviewsService);
    repo = moduleRef.get(ReviewsRepository);
    growthService = moduleRef.get(GrowthService);
  });

  it('debería cerrar la solicitud automática al publicar la reseña', async () => {
    const reserva = reservaMock(ReservaEstado.COMPLETADA);
    reservaModel.findById.mockReturnValue({ exec: () => Promise.resolve(reserva) });

    await service.crear(USUARIO_ID, dto);

    // Sin esto, el recordatorio de los 3 días llegaría a quien ya ha valorado.
    expect(growthService.marcarCompletada).toHaveBeenCalledWith(reserva._id.toString());
  });

  it('debería crear la reseña y recalcular el rating del servicio para una reserva confirmada', async () => {
    reservaModel.findById.mockReturnValue({ exec: () => Promise.resolve(reservaMock(ReservaEstado.CONFIRMADA)) });

    await service.crear(USUARIO_ID, dto);

    expect(repo.crear).toHaveBeenCalledWith(
      expect.objectContaining({ puntuacion: 5, usuarioNombre: 'Juan', servicioTitulo: 'Suite Canina' }),
    );
    expect(repo.agregadoServicio).toHaveBeenCalledWith(SERVICIO_ID.toString());
  });

  it('debería lanzar 404 si la reserva no es del usuario', async () => {
    reservaModel.findById.mockReturnValue({ exec: () => Promise.resolve(reservaMock(ReservaEstado.CONFIRMADA)) });
    await expect(service.crear('otro-usuario', dto)).rejects.toThrow(DomainException);
  });

  it('debería lanzar 400 si la reserva está pendiente', async () => {
    reservaModel.findById.mockReturnValue({ exec: () => Promise.resolve(reservaMock(ReservaEstado.PENDIENTE)) });
    await expect(service.crear(USUARIO_ID, dto)).rejects.toThrow(DomainException);
  });

  it('debería lanzar 409 si ya existe una reseña para la reserva', async () => {
    reservaModel.findById.mockReturnValue({ exec: () => Promise.resolve(reservaMock(ReservaEstado.COMPLETADA)) });
    repo.findByReserva.mockResolvedValue({ _id: 'existe' } as never);
    await expect(service.crear(USUARIO_ID, dto)).rejects.toThrow(DomainException);
  });

  it('debería impedir responder una reseña de otro comercio', async () => {
    repo.findById.mockResolvedValue({ comercioId: { toString: () => 'comercio-A' } } as never);
    await expect(service.responder('r1', 'comercio-B', 'gracias')).rejects.toThrow(DomainException);
  });

  it('debería guardar aspectos y fotos al crear la reseña', async () => {
    reservaModel.findById.mockReturnValue({ exec: () => Promise.resolve(reservaMock(ReservaEstado.COMPLETADA)) });
    const dtoConAspectos = { ...dto, aspectos: { limpieza: 5, trato: 4 }, fotos: ['foto1.jpg'] };

    await service.crear(USUARIO_ID, dtoConAspectos);

    expect(repo.crear).toHaveBeenCalledWith(
      expect.objectContaining({ aspectos: { limpieza: 5, trato: 4 }, fotos: ['foto1.jpg'] }),
    );
  });

  describe('actualizar', () => {
    it('debería editar una reseña propia y recalcular el rating si cambia la puntuación', async () => {
      repo.findById.mockResolvedValue({
        usuarioId: { toString: () => USUARIO_ID },
        servicioId: SERVICIO_ID,
        eliminada: false,
      } as never);
      repo.actualizar.mockResolvedValue({ _id: 'r1', puntuacion: 4 } as never);

      const resultado = await service.actualizar(USUARIO_ID, 'r1', { puntuacion: 4 });

      expect(repo.actualizar).toHaveBeenCalledWith('r1', expect.objectContaining({ puntuacion: 4 }));
      expect(repo.agregadoServicio).toHaveBeenCalledWith(SERVICIO_ID.toString());
      expect(resultado).toEqual({ _id: 'r1', puntuacion: 4 });
    });

    it('no debería recalcular el rating si solo cambian las fotos', async () => {
      repo.findById.mockResolvedValue({
        usuarioId: { toString: () => USUARIO_ID },
        servicioId: SERVICIO_ID,
        eliminada: false,
      } as never);
      repo.actualizar.mockResolvedValue({ _id: 'r1' } as never);
      repo.agregadoServicio.mockClear();

      await service.actualizar(USUARIO_ID, 'r1', { fotos: ['nueva.jpg'] });

      expect(repo.agregadoServicio).not.toHaveBeenCalled();
    });

    it('debería impedir editar una reseña de otro usuario', async () => {
      repo.findById.mockResolvedValue({ usuarioId: { toString: () => 'otro' }, eliminada: false } as never);
      await expect(service.actualizar(USUARIO_ID, 'r1', { puntuacion: 3 })).rejects.toThrow(DomainException);
    });

    it('debería impedir editar una reseña ya eliminada', async () => {
      repo.findById.mockResolvedValue({ usuarioId: { toString: () => USUARIO_ID }, eliminada: true } as never);
      await expect(service.actualizar(USUARIO_ID, 'r1', { puntuacion: 3 })).rejects.toThrow(DomainException);
    });
  });

  describe('eliminar', () => {
    it('debería marcar la reseña como eliminada y recalcular el rating', async () => {
      repo.findById.mockResolvedValue({ usuarioId: { toString: () => USUARIO_ID }, servicioId: SERVICIO_ID } as never);

      await service.eliminar(USUARIO_ID, 'r1');

      expect(repo.eliminar).toHaveBeenCalledWith('r1');
      expect(repo.agregadoServicio).toHaveBeenCalledWith(SERVICIO_ID.toString());
    });

    it('debería impedir eliminar una reseña de otro usuario', async () => {
      repo.findById.mockResolvedValue({ usuarioId: { toString: () => 'otro' } } as never);
      await expect(service.eliminar(USUARIO_ID, 'r1')).rejects.toThrow(DomainException);
    });
  });

  describe('pendientesDeValorar', () => {
    it('debería excluir reservas ya reseñadas y enriquecer con datos del servicio', async () => {
      const reservaPendiente = {
        _id: new Types.ObjectId(),
        servicioId: SERVICIO_ID,
        vertical: 'alojamiento',
        fechaInicio: new Date('2026-02-01'),
      };
      reservaModel.find.mockReturnValue({
        select: () => ({ sort: () => ({ lean: () => ({ exec: () => Promise.resolve([reservaPendiente]) }) }) }),
      });
      repo.listarReservaIdsReseñados.mockResolvedValue([]);
      servicioModel.find.mockReturnValue({
        select: () => ({
          lean: () => ({
            exec: () => Promise.resolve([{ _id: SERVICIO_ID, titulo: 'Suite Canina', imagenes: ['a.jpg'] }]),
          }),
        }),
      });

      const resultado = await service.pendientesDeValorar(USUARIO_ID);

      expect(resultado).toEqual([
        {
          reservaId: String(reservaPendiente._id),
          servicioId: SERVICIO_ID.toString(),
          servicioTitulo: 'Suite Canina',
          vertical: 'alojamiento',
          imagen: 'a.jpg',
          fechaInicio: reservaPendiente.fechaInicio.toISOString(),
        },
      ]);
    });

    it('debería devolver lista vacía si ya se reseñaron todas las reservas resenables', async () => {
      const reservaId = new Types.ObjectId();
      reservaModel.find.mockReturnValue({
        select: () => ({
          sort: () => ({
            lean: () => ({
              exec: () => Promise.resolve([{ _id: reservaId, servicioId: SERVICIO_ID, vertical: 'alojamiento', fechaInicio: new Date() }]),
            }),
          }),
        }),
      });
      repo.listarReservaIdsReseñados.mockResolvedValue([String(reservaId)]);

      const resultado = await service.pendientesDeValorar(USUARIO_ID);

      expect(resultado).toEqual([]);
      expect(servicioModel.find).not.toHaveBeenCalled();
    });
  });
});
