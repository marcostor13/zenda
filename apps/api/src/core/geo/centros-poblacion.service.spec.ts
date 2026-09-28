import { CentrosPoblacionService } from './centros-poblacion.service';
import { CentrosPoblacionRepository } from './centros-poblacion.repository';
import { GeoService } from './geo.service';

describe('CentrosPoblacionService', () => {
  let service: CentrosPoblacionService;
  let repo: jest.Mocked<Pick<CentrosPoblacionRepository, 'buscar' | 'guardar'>>;
  let geo: jest.Mocked<Pick<GeoService, 'coordenadasDePoblacion'>>;

  const CENTRO_CASTELLON = { lat: 39.9864, lng: -0.0513 };

  beforeEach(() => {
    repo = { buscar: jest.fn().mockResolvedValue(null), guardar: jest.fn().mockResolvedValue(undefined) };
    geo = { coordenadasDePoblacion: jest.fn().mockResolvedValue(CENTRO_CASTELLON) };
    service = new CentrosPoblacionService(
      repo as unknown as CentrosPoblacionRepository,
      geo as unknown as GeoService,
    );
  });

  it('debería usar el centro guardado sin volver a geocodificar', async () => {
    repo.buscar.mockResolvedValue(CENTRO_CASTELLON);

    await expect(service.centroDe('Castellón de la Plana')).resolves.toEqual(CENTRO_CASTELLON);
    expect(geo.coordenadasDePoblacion).not.toHaveBeenCalled();
  });

  it('debería geocodificar la primera vez y guardarlo con la clave canónica', async () => {
    await service.centroDe('Castelló de la Plana', 'Castellón');

    expect(geo.coordenadasDePoblacion).toHaveBeenCalledWith('Castellón de la Plana, Castellón');
    expect(repo.guardar).toHaveBeenCalledWith('castellondelaplana', 'Castellón de la Plana', CENTRO_CASTELLON);
  });

  it('no debería repetir la provincia cuando se llama como la población', async () => {
    await service.centroDe('Valencia', 'Valencia');

    expect(geo.coordenadasDePoblacion).toHaveBeenCalledWith('Valencia');
  });

  it('debería devolver null sin guardar nada si no se puede situar', async () => {
    geo.coordenadasDePoblacion.mockResolvedValue(null);

    await expect(service.centroDe('Pueblo inventado')).resolves.toBeNull();
    expect(repo.guardar).not.toHaveBeenCalled();
  });

  it('debería medir la distancia al centro redondeada a una décima', async () => {
    repo.buscar.mockResolvedValue(CENTRO_CASTELLON);

    const km = await service.distanciaAlCentro({ lat: 40.0, lng: -0.03 }, 'Castellón de la Plana');

    expect(km).toBeGreaterThan(2);
    expect(km).toBeLessThan(3);
    expect(Number.isInteger((km ?? 0) * 10)).toBe(true);
  });

  it('debería devolver null si la población no tiene centro', async () => {
    geo.coordenadasDePoblacion.mockResolvedValue(null);

    await expect(service.distanciaAlCentro({ lat: 1, lng: 1 }, 'Nada')).resolves.toBeNull();
  });
});
