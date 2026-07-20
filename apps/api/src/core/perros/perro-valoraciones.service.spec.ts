import { Test } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { Types } from 'mongoose';
import { ReservaEstado, VerticalKey } from 'shared';
import { PerroValoracionesService } from './perro-valoraciones.service';
import { PerroValoracion } from './perro-valoracion.schema';
import { Perro } from './perro.schema';
import { Reserva } from '../bookings/reserva.schema';
import { DomainException } from '../../shared/exceptions/domain.exception';

const PERRO_ID = new Types.ObjectId().toString();
const COMERCIO_ID = new Types.ObjectId().toString();
const RESERVA_ID = new Types.ObjectId().toString();

function reservaMock(overrides: Record<string, unknown> = {}) {
  return {
    comercioId: { toString: () => COMERCIO_ID },
    perroId: { toString: () => PERRO_ID },
    estado: ReservaEstado.COMPLETADA,
    vertical: VerticalKey.PELUQUERIA,
    ...overrides,
  };
}

describe('PerroValoracionesService', () => {
  let service: PerroValoracionesService;
  let valoracionModel: { create: jest.Mock; findOne: jest.Mock; find: jest.Mock };
  let reservaModel: { findById: jest.Mock };
  let perroModel: { updateOne: jest.Mock };

  beforeEach(async () => {
    valoracionModel = { create: jest.fn(), findOne: jest.fn(), find: jest.fn() };
    reservaModel = { findById: jest.fn() };
    perroModel = { updateOne: jest.fn().mockReturnValue({ exec: () => Promise.resolve({}) }) };

    const moduleRef = await Test.createTestingModule({
      providers: [
        PerroValoracionesService,
        { provide: getModelToken(PerroValoracion.name), useValue: valoracionModel },
        { provide: getModelToken(Reserva.name), useValue: reservaModel },
        { provide: getModelToken(Perro.name), useValue: perroModel },
      ],
    }).compile();

    service = moduleRef.get(PerroValoracionesService);
  });

  describe('crear', () => {
    const dto = { reservaId: RESERVA_ID, puntuacion: 5, atributos: { sociabilidad: 5 } };

    it('debería crear la valoración cuando la reserva está completada y es del comercio', async () => {
      reservaModel.findById.mockReturnValue({ exec: () => Promise.resolve(reservaMock()) });
      valoracionModel.findOne.mockReturnValue({ exec: () => Promise.resolve(null) });
      valoracionModel.create.mockResolvedValue({ _id: 'v1' });

      await service.crear(PERRO_ID, COMERCIO_ID, dto);

      expect(valoracionModel.create).toHaveBeenCalledWith(
        expect.objectContaining({ perroId: PERRO_ID, comercioId: COMERCIO_ID, vertical: VerticalKey.PELUQUERIA }),
      );
    });

    it('debería lanzar 404 si la reserva no existe', async () => {
      reservaModel.findById.mockReturnValue({ exec: () => Promise.resolve(null) });
      await expect(service.crear(PERRO_ID, COMERCIO_ID, dto)).rejects.toThrow(DomainException);
    });

    it('debería lanzar 403 si la reserva no es del comercio', async () => {
      reservaModel.findById.mockReturnValue({ exec: () => Promise.resolve(reservaMock({ comercioId: { toString: () => 'otro' } })) });
      await expect(service.crear(PERRO_ID, COMERCIO_ID, dto)).rejects.toThrow(DomainException);
    });

    it('debería lanzar 400 si la reserva no corresponde a ese perro', async () => {
      reservaModel.findById.mockReturnValue({ exec: () => Promise.resolve(reservaMock({ perroId: { toString: () => 'otro-perro' } })) });
      await expect(service.crear(PERRO_ID, COMERCIO_ID, dto)).rejects.toThrow(DomainException);
    });

    it('debería lanzar 400 si la reserva no está completada', async () => {
      reservaModel.findById.mockReturnValue({ exec: () => Promise.resolve(reservaMock({ estado: ReservaEstado.CONFIRMADA })) });
      await expect(service.crear(PERRO_ID, COMERCIO_ID, dto)).rejects.toThrow(DomainException);
    });

    it('debería lanzar 409 si la reserva ya fue valorada', async () => {
      reservaModel.findById.mockReturnValue({ exec: () => Promise.resolve(reservaMock()) });
      valoracionModel.findOne.mockReturnValue({ exec: () => Promise.resolve({ _id: 'existente' }) });
      await expect(service.crear(PERRO_ID, COMERCIO_ID, dto)).rejects.toThrow(DomainException);
    });

    it('debería actualizar el Nivel Doogking cuando la reserva es de adiestramiento y se informa el atributo', async () => {
      reservaModel.findById.mockReturnValue({ exec: () => Promise.resolve(reservaMock({ vertical: VerticalKey.ADIESTRAMIENTO })) });
      valoracionModel.findOne.mockReturnValue({ exec: () => Promise.resolve(null) });
      valoracionModel.create.mockResolvedValue({ _id: 'v1' });

      await service.crear(PERRO_ID, COMERCIO_ID, { reservaId: RESERVA_ID, puntuacion: 5, atributos: { nivelDoogking: 3 } });

      expect(perroModel.updateOne).toHaveBeenCalledWith({ _id: PERRO_ID }, { $set: { nivelDoogking: 3 } });
    });

    it('no debería tocar el Nivel Doogking en verticales que no son adiestramiento', async () => {
      reservaModel.findById.mockReturnValue({ exec: () => Promise.resolve(reservaMock({ vertical: VerticalKey.PELUQUERIA })) });
      valoracionModel.findOne.mockReturnValue({ exec: () => Promise.resolve(null) });
      valoracionModel.create.mockResolvedValue({ _id: 'v1' });

      await service.crear(PERRO_ID, COMERCIO_ID, { reservaId: RESERVA_ID, puntuacion: 5, atributos: { nivelDoogking: 3 } });

      expect(perroModel.updateOne).not.toHaveBeenCalled();
    });

    it('no debería actualizar el Nivel Doogking si el valor está fuera de rango', async () => {
      reservaModel.findById.mockReturnValue({ exec: () => Promise.resolve(reservaMock({ vertical: VerticalKey.ADIESTRAMIENTO })) });
      valoracionModel.findOne.mockReturnValue({ exec: () => Promise.resolve(null) });
      valoracionModel.create.mockResolvedValue({ _id: 'v1' });

      await service.crear(PERRO_ID, COMERCIO_ID, { reservaId: RESERVA_ID, puntuacion: 5, atributos: { nivelDoogking: 9 } });

      expect(perroModel.updateOne).not.toHaveBeenCalled();
    });
  });

  describe('indiceComportamiento', () => {
    it('debería devolver ceros si no hay valoraciones', async () => {
      valoracionModel.find.mockReturnValue({ lean: () => ({ exec: () => Promise.resolve([]) }) });

      const resultado = await service.indiceComportamiento(PERRO_ID);

      expect(resultado).toEqual({ puntuacionPromedio: 0, totalValoraciones: 0, atributosPromedio: {} });
    });

    it('debería promediar puntuación y atributos de todas las valoraciones', async () => {
      valoracionModel.find.mockReturnValue({
        lean: () => ({
          exec: () => Promise.resolve([
            { puntuacion: 5, atributos: { sociabilidad: 5, limpieza: 4 } },
            { puntuacion: 3, atributos: { sociabilidad: 3 } },
          ]),
        }),
      });

      const resultado = await service.indiceComportamiento(PERRO_ID);

      expect(resultado.totalValoraciones).toBe(2);
      expect(resultado.puntuacionPromedio).toBe(4);
      expect(resultado.atributosPromedio).toEqual({ sociabilidad: 4, limpieza: 4 });
    });
  });
});
