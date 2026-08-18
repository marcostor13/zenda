import { Test } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { Types } from 'mongoose';
import { EstadoIncidencia, TipoIncidencia } from 'shared';
import { IncidenciasRepository } from './incidencias.repository';
import { Incidencia } from './incidencia.schema';

describe('IncidenciasRepository', () => {
  let repository: IncidenciasRepository;
  let model: Record<string, jest.Mock>;

  const cadena = (resultado: unknown) => {
    const chain: Record<string, jest.Mock> = {};
    ['sort', 'skip', 'limit', 'lean'].forEach((m) => (chain[m] = jest.fn(() => chain)));
    chain['exec'] = jest.fn().mockResolvedValue(resultado);
    return chain;
  };

  beforeEach(async () => {
    model = {
      create: jest.fn().mockResolvedValue({ _id: 'inc-1' }),
      findById: jest.fn().mockReturnValue({ exec: jest.fn().mockResolvedValue(null) }),
      find: jest.fn().mockReturnValue(cadena([])),
      countDocuments: jest.fn().mockReturnValue({ exec: jest.fn().mockResolvedValue(0) }),
      findByIdAndUpdate: jest.fn().mockReturnValue({ exec: jest.fn().mockResolvedValue({}) }),
      aggregate: jest.fn().mockReturnValue({ exec: jest.fn().mockResolvedValue([]) }),
    };

    const moduleRef = await Test.createTestingModule({
      providers: [IncidenciasRepository, { provide: getModelToken(Incidencia.name), useValue: model }],
    }).compile();

    repository = moduleRef.get(IncidenciasRepository);
  });

  it('debería crear la incidencia con los datos recibidos', async () => {
    const datos = { asunto: 'x', tipo: TipoIncidencia.RECLAMACION } as never;

    await repository.crear(datos);

    expect(model['create']).toHaveBeenCalledWith(datos);
  });

  describe('listar', () => {
    it('debería devolver la lista vacía sin filtros', async () => {
      await repository.listar({});

      expect(model['find']).toHaveBeenCalledWith({});
    });

    it('debería filtrar por estado y por tipo', async () => {
      await repository.listar({ estado: EstadoIncidencia.ABIERTA, tipo: TipoIncidencia.DEVOLUCION });

      expect(model['find']).toHaveBeenCalledWith({
        estado: EstadoIncidencia.ABIERTA,
        tipo: TipoIncidencia.DEVOLUCION,
      });
    });

    it('debería buscar en asunto, autor y código de reserva a la vez', async () => {
      await repository.listar({ buscar: 'RES-1234' });

      const query = model['find'].mock.calls[0][0] as { $or: Record<string, RegExp>[] };
      expect(query.$or).toHaveLength(3);
      expect(query.$or[0]['asunto']).toBeInstanceOf(RegExp);
    });

    it('debería tratar el término de búsqueda como texto literal', async () => {
      // Un asunto con paréntesis no puede convertirse en un patrón.
      await repository.listar({ buscar: '(a+)+$' });

      const query = model['find'].mock.calls[0][0] as { $or: Record<string, RegExp>[] };
      expect(query.$or[0]['asunto'].test(`${'a'.repeat(40)}!`)).toBe(false);
    });

    it('debería paginar con skip = (page - 1) * limite', async () => {
      const chain = cadena([]);
      model['find'].mockReturnValue(chain);

      await repository.listar({}, 3, 20);

      expect(chain['skip']).toHaveBeenCalledWith(40);
      expect(chain['limit']).toHaveBeenCalledWith(20);
    });
  });

  it('debería listar sólo las incidencias abiertas por ese usuario', async () => {
    await repository.listarPorUsuario('650000000000000000000001');

    const filtro = model['find'].mock.calls[0][0] as { abiertaPorId: Types.ObjectId };
    expect(filtro.abiertaPorId).toBeInstanceOf(Types.ObjectId);
  });

  describe('actualizarEstado', () => {
    it('debería cambiar el estado y apilar la actuación en una sola escritura', async () => {
      const actuacion = { actorId: 'admin-1', nota: 'revisado' } as never;

      await repository.actualizarEstado('inc-1', EstadoIncidencia.EN_REVISION, actuacion);

      const [, cambio] = model['findByIdAndUpdate'].mock.calls[0];
      expect(cambio.$set).toEqual({ estado: EstadoIncidencia.EN_REVISION });
      expect(cambio.$push).toEqual({ historial: actuacion });
    });

    it('debería guardar la resolución sólo cuando se indica', async () => {
      // Escribirla siempre borraría la resolución previa con undefined.
      await repository.actualizarEstado('inc-1', EstadoIncidencia.RESUELTA, {} as never, 'reembolsado');

      const [, cambio] = model['findByIdAndUpdate'].mock.calls[0];
      expect(cambio.$set).toEqual({ estado: EstadoIncidencia.RESUELTA, resolucion: 'reembolsado' });
    });
  });

  it('debería devolver el recuento por estado como diccionario', async () => {
    model['aggregate'].mockReturnValue({
      exec: jest.fn().mockResolvedValue([
        { _id: 'abierta', total: 3 },
        { _id: 'resuelta', total: 7 },
      ]),
    });

    await expect(repository.contarPorEstado()).resolves.toEqual({ abierta: 3, resuelta: 7 });
  });
});
