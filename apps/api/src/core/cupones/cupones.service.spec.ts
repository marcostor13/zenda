import { Test } from '@nestjs/testing';
import { CuponesService } from './cupones.service';
import { CuponesRepository } from './cupones.repository';
import { DomainException } from '../../shared/exceptions/domain.exception';

describe('CuponesService', () => {
  let service: CuponesService;
  let repo: jest.Mocked<CuponesRepository>;

  const base = {
    codigo: 'VERANO', tipo: 'porcentaje', valor: 0.2, vertical: 'global',
    montoMinimo: 0, topeDescuento: 0, usoMaximo: 0, usados: 0, activo: true,
  };

  beforeEach(async () => {
    const mod = await Test.createTestingModule({
      providers: [
        CuponesService,
        { provide: CuponesRepository, useValue: { findByCodigo: jest.fn(), incrementarUso: jest.fn() } },
      ],
    }).compile();
    service = mod.get(CuponesService);
    repo = mod.get(CuponesRepository);
  });

  it('aplica un descuento porcentual', async () => {
    repo.findByCodigo.mockResolvedValue(base as never);
    const r = await service.validar('VERANO', 'hoteles', 100);
    expect(r.descuento).toBe(20);
  });

  it('respeta el tope de descuento', async () => {
    repo.findByCodigo.mockResolvedValue({ ...base, topeDescuento: 15 } as never);
    const r = await service.validar('VERANO', 'hoteles', 100);
    expect(r.descuento).toBe(15);
  });

  it('aplica un descuento fijo sin superar el subtotal', async () => {
    repo.findByCodigo.mockResolvedValue({ ...base, tipo: 'fijo', valor: 150 } as never);
    const r = await service.validar('X', 'hoteles', 100);
    expect(r.descuento).toBe(100);
  });

  it('lanza 404 si el cupón no existe o está inactivo', async () => {
    repo.findByCodigo.mockResolvedValue(null);
    await expect(service.validar('NOPE', 'hoteles', 100)).rejects.toThrow(DomainException);
    repo.findByCodigo.mockResolvedValue({ ...base, activo: false } as never);
    await expect(service.validar('VERANO', 'hoteles', 100)).rejects.toThrow(DomainException);
  });

  it('lanza si el cupón caducó', async () => {
    repo.findByCodigo.mockResolvedValue({ ...base, validoHasta: new Date('2000-01-01') } as never);
    await expect(service.validar('VERANO', 'hoteles', 100)).rejects.toThrow(DomainException);
  });

  it('lanza si se alcanzó el uso máximo', async () => {
    repo.findByCodigo.mockResolvedValue({ ...base, usoMaximo: 5, usados: 5 } as never);
    await expect(service.validar('VERANO', 'hoteles', 100)).rejects.toThrow(DomainException);
  });

  it('lanza si el vertical no coincide', async () => {
    repo.findByCodigo.mockResolvedValue({ ...base, vertical: 'vuelos' } as never);
    await expect(service.validar('VERANO', 'hoteles', 100)).rejects.toThrow(DomainException);
  });

  it('lanza si no se alcanza el monto mínimo', async () => {
    repo.findByCodigo.mockResolvedValue({ ...base, montoMinimo: 200 } as never);
    await expect(service.validar('VERANO', 'hoteles', 100)).rejects.toThrow(DomainException);
  });

  it('aplicar() incrementa el uso del cupón', async () => {
    await service.aplicar('VERANO');
    expect(repo.incrementarUso).toHaveBeenCalledWith('VERANO');
  });
});
