import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { EstadoIncidencia, Rol, TipoIncidencia } from 'shared';
import { IncidenciasService } from './incidencias.service';
import { IncidenciasRepository } from './incidencias.repository';
import { UsersRepository } from '../users/users.repository';
import { Reserva } from '../bookings/reserva.schema';

// Ids reales: el servicio los convierte a ObjectId, como llegan desde el JWT.
const USUARIO_ID = '507f1f77bcf86cd799439011';
const COMERCIO_ID = '507f1f77bcf86cd799439022';
const RESERVA_ID = '507f1f77bcf86cd799439033';

describe('IncidenciasService', () => {
  let service: IncidenciasService;
  let repo: jest.Mocked<IncidenciasRepository>;
  let usersRepo: jest.Mocked<UsersRepository>;
  let reservaModel: { findById: jest.Mock };

  const dto = {
    tipo: TipoIncidencia.RECLAMACION,
    asunto: 'El perro volvió sucio',
    descripcion: 'Recogí a Toby lleno de barro y sin secar.',
  };

  beforeEach(async () => {
    reservaModel = { findById: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        IncidenciasService,
        {
          provide: IncidenciasRepository,
          useValue: {
            crear: jest.fn().mockResolvedValue({ _id: 'i1' }),
            listar: jest.fn(),
            listarPorUsuario: jest.fn(),
            contarPorEstado: jest.fn(),
            actualizarEstado: jest.fn().mockResolvedValue({ _id: 'i1', estado: EstadoIncidencia.RESUELTA }),
          },
        },
        {
          provide: UsersRepository,
          useValue: { findById: jest.fn().mockResolvedValue({ nombre: 'Ana', comercioId: COMERCIO_ID }) },
        },
        { provide: getModelToken(Reserva.name), useValue: reservaModel },
      ],
    }).compile();

    service = module.get(IncidenciasService);
    repo = module.get(IncidenciasRepository);
    usersRepo = module.get(UsersRepository);
  });

  describe('crear', () => {
    it('debería abrir la incidencia con el historial ya iniciado', async () => {
      await service.crear(USUARIO_ID, Rol.CLIENTE, dto);

      expect(repo.crear).toHaveBeenCalledWith(
        expect.objectContaining({
          origen: 'cliente',
          abiertaPorNombre: 'Ana',
          historial: [expect.objectContaining({ estado: EstadoIncidencia.ABIERTA, por: 'Ana' })],
        }),
      );
    });

    it('debería marcar como origen "comercio" cuando la abre personal del negocio', async () => {
      await service.crear(USUARIO_ID, Rol.COMERCIO_ADMIN, dto);

      expect(repo.crear).toHaveBeenCalledWith(expect.objectContaining({ origen: 'comercio' }));
    });

    it('debería rechazar reclamar sobre la reserva de otro', async () => {
      reservaModel.findById.mockReturnValue({
        exec: jest.fn().mockResolvedValue({ _id: RESERVA_ID, usuarioId: 'otro', comercioId: 'com9', codigo: 'RES-1' }),
      });

      await expect(
        service.crear(USUARIO_ID, Rol.CLIENTE, { ...dto, reservaId: RESERVA_ID }),
      ).rejects.toThrow(/no es tuya/i);
    });

    it('debería fallar si la reserva citada no existe', async () => {
      reservaModel.findById.mockReturnValue({ exec: jest.fn().mockResolvedValue(null) });

      await expect(
        service.crear(USUARIO_ID, Rol.CLIENTE, { ...dto, reservaId: RESERVA_ID }),
      ).rejects.toThrow(/Reserva no encontrada/i);
    });
  });

  describe('actualizarEstado', () => {
    it('debería guardar quién hizo el cambio en el historial', async () => {
      await service.actualizarEstado('i1', { estado: EstadoIncidencia.EN_REVISION, nota: 'Pido fotos' }, USUARIO_ID);

      expect(usersRepo.findById).toHaveBeenCalledWith(USUARIO_ID);
      expect(repo.actualizarEstado).toHaveBeenCalledWith(
        'i1',
        EstadoIncidencia.EN_REVISION,
        expect.objectContaining({ por: 'Ana', nota: 'Pido fotos' }),
        undefined,
      );
    });

    it('no debería dejar cerrar una incidencia sin explicar cómo se resolvió', async () => {
      await expect(
        service.actualizarEstado('i1', { estado: EstadoIncidencia.RESUELTA, resolucion: '   ' }, USUARIO_ID),
      ).rejects.toThrow(/cómo se resolvió/i);
      expect(repo.actualizarEstado).not.toHaveBeenCalled();
    });

    it('debería avisar si la incidencia no existe', async () => {
      repo.actualizarEstado.mockResolvedValue(null);

      await expect(
        service.actualizarEstado('i9', { estado: EstadoIncidencia.EN_REVISION }, USUARIO_ID),
      ).rejects.toThrow(/Incidencia no encontrada/i);
    });
  });
});
