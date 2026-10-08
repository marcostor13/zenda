import { Test } from '@nestjs/testing';
import { CuponesService } from './cupones.service';
import { CuponesRepository } from './cupones.repository';
import { AlphaService } from '../alpha/alpha.service';
import { CatalogRepository } from '../catalog/catalog.repository';
import { DomainException } from '../../shared/exceptions/domain.exception';

describe('CuponesService', () => {
  let service: CuponesService;
  let repo: jest.Mocked<CuponesRepository>;
  let alpha: jest.Mocked<Pick<AlphaService, 'obtenerEstado'>>;
  let catalogo: jest.Mocked<Pick<CatalogRepository, 'obtenerPorId'>>;

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
          useValue: {
            findByCodigo: jest.fn(),
            incrementarUso: jest.fn(),
            crear: jest.fn(),
            actualizar: jest.fn(),
            contarReservasPagadas: jest.fn().mockResolvedValue(0),
            contarUsosDe: jest.fn().mockResolvedValue(0),
          },
        },
        { provide: AlphaService, useValue: { obtenerEstado: jest.fn().mockResolvedValue({ nivelActual: 1 }) } },
        { provide: CatalogRepository, useValue: { obtenerPorId: jest.fn().mockResolvedValue(null) } },
      ],
    }).compile();
    service = mod.get(CuponesService);
    repo = mod.get(CuponesRepository);
    alpha = mod.get(AlphaService);
    catalogo = mod.get(CatalogRepository);
  });

  /**
   * Restricciones que el panel deja configurar (TCK-8037). Se guardaban en el
   * cupón y nadie las comprobaba: un cupón «uno por persona, sólo en este
   * comercio» lo usaba cualquiera, las veces que quisiera y en cualquier sitio.
   */
  describe('alcance del cupón', () => {
    const COMERCIO = '64b000000000000000000001';
    const OTRO = '64b000000000000000000002';
    const conCupon = (extra: Record<string, unknown>) =>
      repo.findByCodigo.mockResolvedValue({ ...base, ...extra } as never);

    it('debería rechazarlo en un comercio que no es el suyo', async () => {
      conCupon({ comercioId: { toString: () => COMERCIO } });

      await expect(service.validar('VERANO', 'alojamiento', 100, { comercioId: OTRO }))
        .rejects.toThrow('El cupón no aplica a este comercio');
    });

    it('debería aceptarlo en su comercio', async () => {
      conCupon({ comercioId: { toString: () => COMERCIO } });

      await expect(service.validar('VERANO', 'alojamiento', 100, { comercioId: COMERCIO }))
        .resolves.toMatchObject({ descuento: 20 });
    });

    it('debería rechazarlo fuera de su ciudad', async () => {
      conCupon({ ciudad: 'Valencia' });

      await expect(service.validar('VERANO', 'alojamiento', 100, { ciudad: 'Madrid' }))
        .rejects.toThrow('El cupón sólo aplica en Valencia');
    });

    it('debería reconocer la ciudad aunque cambien mayúsculas y tildes', async () => {
      conCupon({ ciudad: 'Málaga' });

      await expect(service.validar('VERANO', 'alojamiento', 100, { ciudad: ' malaga ' }))
        .resolves.toMatchObject({ descuento: 20 });
    });

    it('debería rechazar un cupón de ciudad en un servicio que no la tiene', async () => {
      conCupon({ ciudad: 'Valencia' });

      await expect(service.validar('VERANO', 'alojamiento', 100, { ciudad: '' }))
        .rejects.toBeInstanceOf(DomainException);
    });

    it('no debería comprobar el alcance si no se sabe dónde se reserva', async () => {
      // La vista previa de un cliente antiguo no manda el servicio; quien no
      // puede saltárselo es la reserva, que pasa siempre el contexto entero.
      conCupon({ comercioId: { toString: () => COMERCIO }, ciudad: 'Valencia' });

      await expect(service.validar('VERANO', 'alojamiento', 100)).resolves.toMatchObject({ descuento: 20 });
    });
  });

  describe('restricciones por cliente', () => {
    const conCupon = (extra: Record<string, unknown>) =>
      repo.findByCodigo.mockResolvedValue({ ...base, ...extra } as never);
    const paraElCliente = () => service.validar('VERANO', 'alojamiento', 100, { usuarioId: 'user-1' });

    it('debería rechazar un cupón de primera reserva a quien ya ha reservado', async () => {
      conCupon({ soloPrimeraReserva: true });
      repo.contarReservasPagadas.mockResolvedValue(1);

      await expect(paraElCliente()).rejects.toThrow('Este cupón es sólo para tu primera reserva');
    });

    it('debería aceptarlo a quien aún no ha pagado ninguna reserva', async () => {
      conCupon({ soloPrimeraReserva: true });

      await expect(paraElCliente()).resolves.toMatchObject({ descuento: 20 });
      expect(repo.contarReservasPagadas).toHaveBeenCalledWith('user-1');
    });

    it('debería rechazarlo cuando el cliente ya lo ha gastado las veces permitidas', async () => {
      conCupon({ usosPorUsuario: 1 });
      repo.contarUsosDe.mockResolvedValue(1);

      await expect(paraElCliente()).rejects.toThrow('Ya has usado este cupón');
      expect(repo.contarUsosDe).toHaveBeenCalledWith('VERANO', 'user-1');
    });

    it('debería dejarlo usar mientras le queden usos', async () => {
      conCupon({ usosPorUsuario: 2 });
      repo.contarUsosDe.mockResolvedValue(1);

      await expect(paraElCliente()).resolves.toMatchObject({ descuento: 20 });
    });

    it('debería exigir el nivel Alpha mínimo', async () => {
      conCupon({ nivelAlphaMinimo: 3 });
      alpha.obtenerEstado.mockResolvedValue({ nivelActual: 2 } as never);

      await expect(paraElCliente()).rejects.toThrow('Este cupón requiere el nivel Alpha 3');
    });

    it('debería aceptarlo a quien ya tiene ese nivel', async () => {
      conCupon({ nivelAlphaMinimo: 3 });
      alpha.obtenerEstado.mockResolvedValue({ nivelActual: 3 } as never);

      await expect(paraElCliente()).resolves.toMatchObject({ descuento: 20 });
    });

    it('no debería consultar nada del cliente en un cupón sin restricciones', async () => {
      // Los cupones antiguos no traen estos campos: se leen como «sin límite».
      conCupon({});

      await paraElCliente();

      expect(repo.contarReservasPagadas).not.toHaveBeenCalled();
      expect(repo.contarUsosDe).not.toHaveBeenCalled();
      expect(alpha.obtenerEstado).not.toHaveBeenCalled();
    });

    it('no debería comprobar al cliente si no se sabe quién es', async () => {
      conCupon({ soloPrimeraReserva: true, usosPorUsuario: 1, nivelAlphaMinimo: 3 });

      await expect(service.validar('VERANO', 'alojamiento', 100)).resolves.toMatchObject({ descuento: 20 });
      expect(repo.contarReservasPagadas).not.toHaveBeenCalled();
    });
  });

  describe('validarParaCliente', () => {
    const dto = { codigo: 'VERANO', vertical: 'alojamiento', montoSubtotal: 100 };

    it('debería sacar el comercio y la ciudad del servicio, no del cliente', async () => {
      repo.findByCodigo.mockResolvedValue({ ...base, ciudad: 'Valencia' } as never);
      catalogo.obtenerPorId.mockResolvedValue({
        comercioId: { toString: () => 'comercio-1' }, ubicacion: { ciudad: 'Madrid' },
      } as never);

      await expect(service.validarParaCliente({ ...dto, servicioId: 'servicio-1' }, 'user-1'))
        .rejects.toThrow('El cupón sólo aplica en Valencia');
      expect(catalogo.obtenerPorId).toHaveBeenCalledWith('servicio-1');
    });

    it('debería tratar como sin ciudad un servicio que no la tiene', async () => {
      repo.findByCodigo.mockResolvedValue({ ...base, ciudad: 'Valencia' } as never);
      catalogo.obtenerPorId.mockResolvedValue({ comercioId: { toString: () => 'comercio-1' } } as never);

      await expect(service.validarParaCliente({ ...dto, servicioId: 'servicio-1' }, 'user-1'))
        .rejects.toBeInstanceOf(DomainException);
    });

    it('debería comprobar al cliente aunque no llegue el servicio', async () => {
      repo.findByCodigo.mockResolvedValue({ ...base, soloPrimeraReserva: true, ciudad: 'Valencia' } as never);
      repo.contarReservasPagadas.mockResolvedValue(3);

      await expect(service.validarParaCliente(dto, 'user-1'))
        .rejects.toThrow('Este cupón es sólo para tu primera reserva');
      expect(catalogo.obtenerPorId).not.toHaveBeenCalled();
    });
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
