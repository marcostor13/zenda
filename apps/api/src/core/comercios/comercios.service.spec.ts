import { Test } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { ComerciosService } from './comercios.service';
import { ComerciosRepository } from './comercios.repository';
import { ReviewsService } from '../reviews/reviews.service';
import { BookingsService } from '../bookings/bookings.service';
import { Reserva } from '../bookings/reserva.schema';
import { Servicio } from '../catalog/servicio.schema';
import { DomainException } from '../../shared/exceptions/domain.exception';

describe('ComerciosService', () => {
  let service: ComerciosService;
  let repo: jest.Mocked<ComerciosRepository>;
  let bookingsService: jest.Mocked<BookingsService>;

  const dto = {
    razonSocial: 'Hoteles Ibéricos S.L.',
    vatNumber: 'B-12345678',
    nombreComercial: 'Gran Hotel Madrid',
  };

  beforeEach(async () => {
    const moduleRef = await Test.createTestingModule({
      providers: [
        ComerciosService,
        {
          provide: ComerciosRepository,
          useValue: {
            findByVatNumber: jest.fn(),
            findById: jest.fn(),
            crear: jest.fn(),
            actualizarEstado: jest.fn(),
            listar: jest.fn(),
          },
        },
        { provide: getModelToken(Reserva.name), useValue: {} },
        { provide: getModelToken(Servicio.name), useValue: {} },
        {
          provide: ReviewsService,
          useValue: { listarPorComercio: jest.fn(), responder: jest.fn() },
        },
        {
          provide: BookingsService,
          useValue: { completar: jest.fn() },
        },
      ],
    }).compile();

    service = moduleRef.get(ComerciosService);
    repo = moduleRef.get(ComerciosRepository);
    bookingsService = moduleRef.get(BookingsService);
  });

  describe('registrar', () => {
    it('debería crear el comercio si el identificador fiscal no existe', async () => {
      repo.findByVatNumber.mockResolvedValue(null);
      repo.crear.mockResolvedValue({ id: 'c1' } as never);

      await service.registrar(dto);

      expect(repo.crear).toHaveBeenCalledWith(expect.objectContaining({ vatNumber: 'B-12345678' }));
    });

    it('debería lanzar 409 si ya existe un comercio con ese identificador fiscal', async () => {
      repo.findByVatNumber.mockResolvedValue({ id: 'existente' } as never);

      await expect(service.registrar(dto)).rejects.toThrow(DomainException);
      expect(repo.crear).not.toHaveBeenCalled();
    });
  });

  describe('obtener', () => {
    it('debería lanzar 404 si el comercio no existe', async () => {
      repo.findById.mockResolvedValue(null);
      await expect(service.obtener('no-existe')).rejects.toThrow(DomainException);
    });
  });

  describe('cambiarEstado', () => {
    it('debería actualizar el estado del comercio', async () => {
      repo.actualizarEstado.mockResolvedValue({ id: 'c1', estado: 'activo' } as never);
      const result = await service.cambiarEstado('c1', 'activo');
      expect(result).toMatchObject({ estado: 'activo' });
    });

    it('debería lanzar 404 si el comercio no existe', async () => {
      repo.actualizarEstado.mockResolvedValue(null);
      await expect(service.cambiarEstado('x', 'suspendido')).rejects.toThrow(DomainException);
    });
  });

  describe('completarReserva', () => {
    it('debería delegar en BookingsService.completar con el comercioId', async () => {
      bookingsService.completar.mockResolvedValue({ estado: 'completada' } as never);

      const resultado = await service.completarReserva('reserva-1', 'comercio-1');

      expect(bookingsService.completar).toHaveBeenCalledWith('reserva-1', 'comercio-1');
      expect(resultado).toMatchObject({ estado: 'completada' });
    });
  });
});
