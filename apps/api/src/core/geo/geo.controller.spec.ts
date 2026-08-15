import { Test, TestingModule } from '@nestjs/testing';
import { GeoController } from './geo.controller';
import { GeoService } from './geo.service';

describe('GeoController', () => {
  let controller: GeoController;
  let geoService: jest.Mocked<
    Pick<GeoService, 'autocompletar' | 'coordenadas' | 'direccion' | 'tiposDeCambio'>
  >;

  beforeEach(async () => {
    geoService = {
      autocompletar: jest.fn().mockResolvedValue([]),
      coordenadas: jest.fn().mockResolvedValue(null),
      direccion: jest.fn().mockResolvedValue(null),
      tiposDeCambio: jest.fn().mockResolvedValue({ base: 'EUR', fecha: '2026-07-24', tasas: { EUR: 1 } }),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [GeoController],
      providers: [{ provide: GeoService, useValue: geoService }],
    }).compile();

    controller = module.get(GeoController);
  });

  it('debería pasar el término y el token de sesión al servicio', async () => {
    await controller.autocompletar('val', 'sesion-1');

    expect(geoService.autocompletar).toHaveBeenCalledWith('val', 'sesion-1', 'ciudad');
  });

  it('debería tolerar la llamada sin término, sin romper el buscador', async () => {
    await expect(controller.autocompletar(undefined)).resolves.toEqual([]);

    expect(geoService.autocompletar).toHaveBeenCalledWith('', undefined, 'ciudad');
  });

  it('debería buscar portales cuando se pide el tipo dirección', async () => {
    await controller.autocompletar('calle mayor 2', 'sesion-1', 'direccion');

    expect(geoService.autocompletar).toHaveBeenCalledWith('calle mayor 2', 'sesion-1', 'direccion');
  });

  it('debería caer a poblaciones si el tipo no se reconoce', async () => {
    await controller.autocompletar('val', undefined, 'lo-que-sea');

    expect(geoService.autocompletar).toHaveBeenCalledWith('val', undefined, 'ciudad');
  });

  it('debería geocodificar la población elegida', async () => {
    await controller.geocodificar('place-1');

    expect(geoService.coordenadas).toHaveBeenCalledWith('place-1');
  });

  it('debería pedir la dirección completa del portal elegido', async () => {
    await controller.direccion('place-9');

    expect(geoService.direccion).toHaveBeenCalledWith('place-9');
  });

  it('debería exponer los tipos de cambio con base euro', async () => {
    await expect(controller.tiposDeCambio()).resolves.toEqual(
      expect.objectContaining({ base: 'EUR' }),
    );
  });
});
