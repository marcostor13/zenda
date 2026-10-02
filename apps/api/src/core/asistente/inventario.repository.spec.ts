import { Test } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { EstadoModeracion } from 'shared';
import { Servicio } from '../catalog/servicio.schema';
import { Lugar } from '../lugares/lugar.schema';
import { InventarioRepository } from './inventario.repository';

describe('InventarioRepository', () => {
  let repo: InventarioRepository;
  let servicioAggregate: jest.Mock;
  let lugarAggregate: jest.Mock;

  const devuelve = (filas: unknown[]) => jest.fn().mockReturnValue({ exec: jest.fn().mockResolvedValue(filas) });

  beforeEach(async () => {
    servicioAggregate = devuelve([
      { _id: { clave: 'alojamiento', zona: 'Valencia' }, n: 5 },
      { _id: { clave: 'peluqueria', zona: 'Madrid' }, n: 2 },
      { _id: { clave: 'alojamiento', zona: 'Madrid' }, n: 1 },
      { _id: { clave: null, zona: 'X' }, n: 9 },
    ]);
    lugarAggregate = devuelve([{ _id: { clave: 'playa', zona: 'Valencia' }, n: 14 }]);

    const modulo = await Test.createTestingModule({
      providers: [
        InventarioRepository,
        { provide: getModelToken(Servicio.name), useValue: { aggregate: servicioAggregate } },
        { provide: getModelToken(Lugar.name), useValue: { aggregate: lugarAggregate } },
      ],
    }).compile();
    repo = modulo.get(InventarioRepository);
  });

  /* El mismo filtro que el buscador: si no, el asistente ofrecería comercios suspendidos. */
  it('debería contar sólo servicios publicados de comercios activos', async () => {
    const grupos = await repo.servicios();

    expect(servicioAggregate.mock.calls[0][0][0]).toEqual({ $match: { estado: 'publicado', comercioActivo: true } });
    expect(grupos).toEqual([
      { clave: 'alojamiento', total: 6, zonas: ['Valencia', 'Madrid'] },
      { clave: 'peluqueria', total: 2, zonas: ['Madrid'] },
    ]);
  });

  it('debería contar sólo los sitios con la moderación aprobada', async () => {
    const grupos = await repo.lugares();

    expect(lugarAggregate.mock.calls[0][0][0]).toEqual({ $match: { estado: EstadoModeracion.PUBLICADO } });
    expect(grupos).toEqual([{ clave: 'playa', total: 14, zonas: ['Valencia'] }]);
  });
});
