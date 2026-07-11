import { Test } from '@nestjs/testing';
import { CuponesController } from './cupones.controller';
import { CuponesService } from './cupones.service';
import { CuponesRepository } from './cupones.repository';

describe('CuponesController', () => {
  let controller: CuponesController;
  let service: jest.Mocked<CuponesService>;
  let repo: jest.Mocked<CuponesRepository>;

  beforeEach(async () => {
    const mod = await Test.createTestingModule({
      controllers: [CuponesController],
      providers: [
        { provide: CuponesService, useValue: { validar: jest.fn() } },
        { provide: CuponesRepository, useValue: { crear: jest.fn(), listar: jest.fn() } },
      ],
    }).compile();
    controller = mod.get(CuponesController);
    service = mod.get(CuponesService);
    repo = mod.get(CuponesRepository);
  });

  it('valida delegando en el service', async () => {
    service.validar.mockResolvedValue({ codigo: 'X', tipo: 'fijo', descuento: 10 });
    await controller.validar({ codigo: 'X', vertical: 'alojamiento', montoSubtotal: 100 });
    expect(service.validar).toHaveBeenCalledWith('X', 'alojamiento', 100);
  });

  it('crea un cupón con vertical global por defecto y convierte la fecha', async () => {
    repo.crear.mockResolvedValue({ id: 'c1' } as never);
    await controller.crear({ codigo: 'NEW', tipo: 'porcentaje', valor: 0.1, validoHasta: '2030-01-01' });
    const arg = repo.crear.mock.calls[0][0];
    expect(arg.vertical).toBe('global');
    expect(arg.validoHasta).toBeInstanceOf(Date);
  });

  it('lista cupones', async () => {
    repo.listar.mockResolvedValue([] as never);
    await controller.listar();
    expect(repo.listar).toHaveBeenCalled();
  });
});
