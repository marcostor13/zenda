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
        {
          provide: CuponesRepository,
          useValue: { findByCodigo: jest.fn(), incrementarUso: jest.fn(), crear: jest.fn(), actualizar: jest.fn() },
        },
      ],
    }).compile();
    service = mod.get(CuponesService);
    repo = mod.get(CuponesRepository);
  });

  describe('crear', () => {
    const dto = { codigo: 'NEW', tipo: 'porcentaje' as const, valor: 0.1 };

    it('debería guardar el código en mayúsculas y con vertical global por defecto', async () => {
      await service.crear({ ...dto, codigo: ' verano10 ' });

      expect(repo.crear).toHaveBeenCalledWith(expect.objectContaining({ codigo: 'VERANO10', vertical: 'global' }));
    });

    it('debería dejar el cupón sin caducidad si no se indica', async () => {
      await service.crear(dto);

      expect(repo.crear.mock.calls[0][0].validoHasta).toBeUndefined();
    });

    it('debería hacer valer el cupón hasta el final de su último día en Madrid', async () => {
      // Guardado como medianoche UTC, moría al empezar ese día.
      await service.crear({ ...dto, validoHasta: '2031-07-15' });

      expect(repo.crear.mock.calls[0][0].validoHasta?.toISOString()).toBe('2031-07-15T21:59:59.999Z');
    });

    it('debería contar con el horario de invierno', async () => {
      await service.crear({ ...dto, validoHasta: '2031-01-15' });

      expect(repo.crear.mock.calls[0][0].validoHasta?.toISOString()).toBe('2031-01-15T22:59:59.999Z');
    });

    it('debería respetar un instante exacto si llega con hora', async () => {
      await service.crear({ ...dto, validoHasta: '2031-07-15T10:00:00.000Z' });

      expect(repo.crear.mock.calls[0][0].validoHasta?.toISOString()).toBe('2031-07-15T10:00:00.000Z');
    });

    it('debería guardar comercio y campaña como identificadores de Mongo', async () => {
      await service.crear({
        ...dto, comercioId: '64b000000000000000000001', campanaId: '64b000000000000000000002',
      });

      const guardado = repo.crear.mock.calls[0][0];
      expect(guardado.comercioId?.toString()).toBe('64b000000000000000000001');
      expect(guardado.campanaId?.toString()).toBe('64b000000000000000000002');
    });

    it('debería decir que el código ya existe en vez de romper con un 500', async () => {
      repo.crear.mockRejectedValue({ code: 11000 });

      await expect(service.crear(dto)).rejects.toMatchObject({
        message: 'Ya existe un cupón con el código NEW',
      });
      await expect(service.crear(dto)).rejects.toBeInstanceOf(DomainException);
    });

    it('debería propagar cualquier otro fallo de la base de datos', async () => {
      repo.crear.mockRejectedValue(new Error('conexión perdida'));

      await expect(service.crear(dto)).rejects.toThrow('conexión perdida');
    });
  });

  describe('actualizar', () => {
    it('debería cambiar sólo lo que se le pasa', async () => {
      await service.actualizar('c1', { activo: false });

      expect(repo.actualizar).toHaveBeenCalledWith('c1', { $set: { activo: false } });
    });

    it('debería llevar la caducidad al final del día', async () => {
      await service.actualizar('c1', { validoHasta: '2031-07-15' });

      const cambios = repo.actualizar.mock.calls[0][1] as { $set: { validoHasta: Date } };
      expect(cambios.$set.validoHasta.toISOString()).toBe('2031-07-15T21:59:59.999Z');
    });

    it('debería respetar una fecha que ya es un instante', async () => {
      const instante = new Date('2031-07-15T10:00:00.000Z');

      await service.actualizar('c1', { validoHasta: instante });

      const cambios = repo.actualizar.mock.calls[0][1] as { $set: { validoHasta: Date } };
      expect(cambios.$set.validoHasta).toBe(instante);
    });

    it('debería quitar la caducidad cuando llega a null', async () => {
      await service.actualizar('c1', { validoHasta: null, valor: 0.3 });

      expect(repo.actualizar).toHaveBeenCalledWith('c1', { $set: { valor: 0.3 }, $unset: { validoHasta: 1 } });
    });
  });

  it('aplica un descuento porcentual', async () => {
    repo.findByCodigo.mockResolvedValue(base as never);
    const r = await service.validar('VERANO', 'alojamiento', 100);
    expect(r.descuento).toBe(20);
  });

  it('respeta el tope de descuento', async () => {
    repo.findByCodigo.mockResolvedValue({ ...base, topeDescuento: 15 } as never);
    const r = await service.validar('VERANO', 'alojamiento', 100);
    expect(r.descuento).toBe(15);
  });

  it('aplica un descuento fijo sin superar el subtotal', async () => {
    repo.findByCodigo.mockResolvedValue({ ...base, tipo: 'fijo', valor: 150 } as never);
    const r = await service.validar('X', 'alojamiento', 100);
    expect(r.descuento).toBe(100);
  });

  it('lanza 404 si el cupón no existe o está inactivo', async () => {
    repo.findByCodigo.mockResolvedValue(null);
    await expect(service.validar('NOPE', 'alojamiento', 100)).rejects.toThrow(DomainException);
    repo.findByCodigo.mockResolvedValue({ ...base, activo: false } as never);
    await expect(service.validar('VERANO', 'alojamiento', 100)).rejects.toThrow(DomainException);
  });

  it('lanza si el cupón caducó', async () => {
    repo.findByCodigo.mockResolvedValue({ ...base, validoHasta: new Date('2000-01-01') } as never);
    await expect(service.validar('VERANO', 'alojamiento', 100)).rejects.toThrow(DomainException);
  });

  it('lanza si se alcanzó el uso máximo', async () => {
    repo.findByCodigo.mockResolvedValue({ ...base, usoMaximo: 5, usados: 5 } as never);
    await expect(service.validar('VERANO', 'alojamiento', 100)).rejects.toThrow(DomainException);
  });

  it('lanza si el vertical no coincide', async () => {
    repo.findByCodigo.mockResolvedValue({ ...base, vertical: 'veterinaria' } as never);
    await expect(service.validar('VERANO', 'alojamiento', 100)).rejects.toThrow(DomainException);
  });

  it('lanza si no se alcanza el monto mínimo', async () => {
    repo.findByCodigo.mockResolvedValue({ ...base, montoMinimo: 200 } as never);
    await expect(service.validar('VERANO', 'alojamiento', 100)).rejects.toThrow(DomainException);
  });

  it('aplicar() incrementa el uso del cupón', async () => {
    await service.aplicar('VERANO');
    expect(repo.incrementarUso).toHaveBeenCalledWith('VERANO');
  });
});
