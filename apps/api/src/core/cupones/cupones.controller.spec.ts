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
        { provide: CuponesService, useValue: { validar: jest.fn(), crear: jest.fn(), actualizar: jest.fn() } },
        { provide: CuponesRepository, useValue: { listar: jest.fn(), eliminar: jest.fn() } },
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

  it('debería crear delegando en el service', async () => {
    const dto = { codigo: 'NEW', tipo: 'porcentaje' as const, valor: 0.1 };
    service.crear.mockResolvedValue({ id: 'c1' } as never);

    await controller.crear(dto);

    expect(service.crear).toHaveBeenCalledWith(dto);
  });

  it('debería actualizar delegando en el service', async () => {
    service.actualizar.mockResolvedValue(null);

    await controller.actualizar('c1', { activo: false });

    expect(service.actualizar).toHaveBeenCalledWith('c1', { activo: false });
  });

  it('debería eliminar el cupón indicado', async () => {
    await controller.eliminar('c1');

    expect(repo.eliminar).toHaveBeenCalledWith('c1');
  });

  it('lista cupones', async () => {
    repo.listar.mockResolvedValue([] as never);
    await controller.listar();
    expect(repo.listar).toHaveBeenCalled();
  });
});
