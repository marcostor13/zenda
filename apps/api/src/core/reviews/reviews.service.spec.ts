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
  let reservaModel: { findById: jest.Mock };

  const dto = { reservaId: new Types.ObjectId().toString(), puntuacion: 5, comentario: 'Excelente' };

  beforeEach(async () => {
    reservaModel = { findById: jest.fn() };
    const leanExec = (val: unknown) => ({ select: () => ({ lean: () => ({ exec: () => Promise.resolve(val) }) }) });

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
            guardarRespuesta: jest.fn(),
            listarPorComercio: jest.fn(),
          },
        },
        { provide: getModelToken(Reserva.name), useValue: reservaModel },
        {
          provide: getModelToken(Servicio.name),
          useValue: {
            findById: () => leanExec({ titulo: 'Suite Canina' }),
            findByIdAndUpdate: () => ({ exec: () => Promise.resolve(null) }),
          },
        },
        {
          provide: getModelToken(Usuario.name),
          useValue: { findById: () => leanExec({ nombre: 'Juan' }) },
        },
      ],
    }).compile();

    service = moduleRef.get(ReviewsService);
    repo = moduleRef.get(ReviewsRepository);
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
});
