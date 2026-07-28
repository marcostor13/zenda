import { Test } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { Types } from 'mongoose';
import { ReservaEstado } from 'shared';
import { AlphaService } from './alpha.service';
import { AlphaRepository } from './alpha.repository';
import { Reserva } from '../bookings/reserva.schema';

const USUARIO_ID = new Types.ObjectId().toString();

const NIVELES = [
  { nivel: 1, nombre: 'Alpha 1', reservasRequeridas: 0, descuentoPct: 0, beneficios: ['Promos'] },
  { nivel: 2, nombre: 'Alpha 2', reservasRequeridas: 5, descuentoPct: 0.05, beneficios: ['5% descuento'] },
  { nivel: 3, nombre: 'Alpha 3', reservasRequeridas: 15, descuentoPct: 0.1, beneficios: ['10% descuento'] },
];

describe('AlphaService', () => {
  let service: AlphaService;
  let repo: jest.Mocked<Pick<AlphaRepository, 'listarNiveles' | 'upsert'>>;
  let reservaModel: { countDocuments: jest.Mock };

  beforeEach(async () => {
    repo = {
      listarNiveles: jest.fn().mockResolvedValue(NIVELES),
      upsert: jest.fn(),
    };
    reservaModel = { countDocuments: jest.fn().mockReturnValue({ exec: () => Promise.resolve(0) }) };

    const moduleRef = await Test.createTestingModule({
      providers: [
        AlphaService,
        { provide: AlphaRepository, useValue: repo },
        { provide: getModelToken(Reserva.name), useValue: reservaModel },
      ],
    }).compile();

    service = moduleRef.get(AlphaService);
  });

  const contar = (n: number) => reservaModel.countDocuments.mockReturnValue({ exec: () => Promise.resolve(n) });

  describe('obtenerEstado', () => {
    it('debería situar a un usuario nuevo en Alpha 1 con progreso al nivel 2', async () => {
      contar(0);

      const estado = await service.obtenerEstado(USUARIO_ID);

      expect(estado.nivelActual).toBe(1);
      expect(estado.nombreNivel).toBe('Alpha 1');
      expect(estado.reservasCompletadas).toBe(0);
      expect(estado.reservasParaSiguiente).toBe(5);
      expect(estado.siguienteNivel?.nivel).toBe(2);
      expect(estado.esMaximoNivel).toBe(false);
    });

    it('debería subir a Alpha 2 al alcanzar el umbral de reservas', async () => {
      contar(5);

      const estado = await service.obtenerEstado(USUARIO_ID);

      expect(estado.nivelActual).toBe(2);
      expect(estado.descuentoPct).toBe(0.05);
      expect(estado.reservasParaSiguiente).toBe(10);
    });

    it('debería marcar el nivel máximo sin siguiente nivel', async () => {
      contar(20);

      const estado = await service.obtenerEstado(USUARIO_ID);

      expect(estado.nivelActual).toBe(3);
      expect(estado.esMaximoNivel).toBe(true);
      expect(estado.reservasParaSiguiente).toBeNull();
      expect(estado.siguienteNivel).toBeNull();
    });

    it('debería contar solo reservas con estado COMPLETADA', async () => {
      contar(3);

      await service.obtenerEstado(USUARIO_ID);

      expect(reservaModel.countDocuments).toHaveBeenCalledWith(
        expect.objectContaining({ estado: ReservaEstado.COMPLETADA }),
      );
    });
  });

  describe('actualizarNivel', () => {
    it('debería delegar en el repositorio con los datos del dto', async () => {
      const dto = { nivel: 2, nombre: 'Alpha 2 Pro', reservasRequeridas: 8, descuentoPct: 0.08, beneficios: ['x'] };

      await service.actualizarNivel(dto, 'admin-1');

      expect(repo.upsert).toHaveBeenCalledWith(
        2,
        { nombre: 'Alpha 2 Pro', reservasRequeridas: 8, descuentoPct: 0.08, beneficios: ['x'] },
        'admin-1',
      );
    });
  });
});
