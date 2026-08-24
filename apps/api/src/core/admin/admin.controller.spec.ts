import { Test, TestingModule } from '@nestjs/testing';
import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';
import { UsersRepository } from '../users/users.repository';
import { MotivoBajaComercio, VerticalKey, Rol } from 'shared';

describe('AdminController', () => {
  let controller: AdminController;
  let adminService: jest.Mocked<AdminService>;

  const reporteMock = {
    fechaDesde: '2025-01-01T00:00:00.000Z',
    fechaHasta: '2025-01-31T00:00:00.000Z',
    gmv: 885,
    ingresosPlataforma: 112.5,
    costoStripe: 27.87,
    margenNetoPlataforma: 84.63,
    liquidacionesComercio: 744.63,
    totalReservas: 2,
    porVertical: [],
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AdminController],
      providers: [
        // El guard de permisos resuelve el administrador por id (TCK-8040 §7).
        { provide: UsersRepository, useValue: { findById: jest.fn().mockResolvedValue({ permisosAdmin: [] }) } },
        {
          provide: AdminService,
          useValue: {
            listarComisiones: jest.fn().mockResolvedValue([]),
            actualizarComision: jest.fn().mockResolvedValue({ vertical: VerticalKey.ALOJAMIENTO }),
            listarNivelesAlpha: jest.fn().mockResolvedValue([]),
            actualizarNivelAlpha: jest.fn().mockResolvedValue({ nivel: 2 }),
            generarReporteFinanciero: jest.fn().mockResolvedValue(reporteMock),
            obtenerDashboard: jest.fn().mockResolvedValue({}),
            listarComercios: jest.fn().mockResolvedValue({ items: [], total: 0 }),
            resumenComercios: jest.fn().mockResolvedValue({}),
            fichaComercio: jest.fn().mockResolvedValue({}),
            crearComercio: jest.fn().mockResolvedValue({}),
            actualizarComercio: jest.fn().mockResolvedValue({}),
            cambiarVerificacionComercio: jest.fn().mockResolvedValue({}),
            eliminarComercio: jest.fn().mockResolvedValue({ comercioId: 'comercio-1', purgado: false }),
            impactoBajaComercio: jest.fn().mockResolvedValue({ puedeDarseDeBaja: true }),
            restaurarComercio: jest.fn().mockResolvedValue({ _id: 'comercio-1' }),
            listarUsuarios: jest.fn().mockResolvedValue({ items: [], total: 0 }),
            resumenUsuarios: jest.fn().mockResolvedValue({}),
            fichaUsuario: jest.fn().mockResolvedValue({}),
            crearUsuario: jest.fn().mockResolvedValue({}),
            actualizarUsuario: jest.fn().mockResolvedValue({}),
            eliminarUsuario: jest.fn().mockResolvedValue(undefined),
            listarPagos: jest.fn().mockResolvedValue({ items: [], total: 0 }),
            resumenPagos: jest.fn().mockResolvedValue({}),
            evolucion: jest.fn().mockResolvedValue([]),
            resumenReservas: jest.fn().mockResolvedValue({}),
            listarReservas: jest.fn().mockResolvedValue({ items: [], total: 0 }),
            cambiarEstadoReserva: jest.fn().mockResolvedValue({}),
            obtenerAnalitica: jest.fn().mockResolvedValue({}),
          },
        },
      ],
    }).compile();

    controller = module.get<AdminController>(AdminController);
    adminService = module.get(AdminService);
  });

  describe('listarComisiones', () => {
    it('debería retornar todas las configuraciones de comisión', async () => {
      const resultado = await controller.listarComisiones();
      expect(adminService.listarComisiones).toHaveBeenCalled();
      expect(resultado).toEqual([]);
    });
  });

  describe('actualizarComision', () => {
    it('debería actualizar la comisión y retornar la config actualizada', async () => {
      const req: any = { user: { sub: 'admin-1', rol: Rol.ADMIN } };
      const dto = {
        vertical: VerticalKey.ALOJAMIENTO as any,
        comisionPct: 0.18,
        stripePct: 0.029,
        stripeFijoEur: 1.1,
        activo: true,
      };

      const resultado = await controller.actualizarComision(dto, req);
      expect(adminService.actualizarComision).toHaveBeenCalledWith(dto, 'admin-1');
    });
  });

  describe('listarNivelesAlpha', () => {
    it('debería retornar la escalera de niveles Alpha', async () => {
      const resultado = await controller.listarNivelesAlpha();
      expect(adminService.listarNivelesAlpha).toHaveBeenCalled();
      expect(resultado).toEqual([]);
    });
  });

  describe('actualizarNivelAlpha', () => {
    it('debería actualizar el nivel Alpha con el admin del token', async () => {
      const req: any = { user: { sub: 'admin-1', rol: Rol.ADMIN } };
      const dto = { nivel: 2, nombre: 'Alpha 2', reservasRequeridas: 5, descuentoPct: 0.05, beneficios: ['x'] };

      await controller.actualizarNivelAlpha(dto, req);

      expect(adminService.actualizarNivelAlpha).toHaveBeenCalledWith(dto, 'admin-1');
    });
  });

  const admin = { user: { sub: 'admin-1', rol: Rol.ADMIN } } as never;

  describe('dashboard', () => {
    it('deberia usar el rango por defecto del servicio si no se indican fechas', async () => {
      await controller.obtenerDashboard();

      expect(adminService.obtenerDashboard).toHaveBeenCalledWith(undefined);
    });

    it('deberia exigir ambas fechas para acotar el rango', async () => {
      // Con solo una, el rango quedaria abierto por un lado y el KPI no
      // significaria nada.
      await controller.obtenerDashboard('2026-08-01');

      expect(adminService.obtenerDashboard).toHaveBeenCalledWith(undefined);
    });

    it('deberia convertir a fecha el rango completo', async () => {
      await controller.obtenerDashboard('2026-08-01', '2026-08-31');

      expect(adminService.obtenerDashboard).toHaveBeenCalledWith({
        desde: new Date('2026-08-01'),
        hasta: new Date('2026-08-31'),
      });
    });
  });

  describe('comercios', () => {
    it('no deberia filtrar por Alpha si no llega el parametro', async () => {
      await controller.listarComercios(1, 20);

      expect(adminService.listarComercios).toHaveBeenCalledWith(1, 20, undefined, undefined, undefined);
    });

    it('deberia traducir el filtro Alpha de texto a booleano', async () => {
      await controller.listarComercios(1, 20, 'activo', 'perro', 'true');
      expect(adminService.listarComercios).toHaveBeenCalledWith(1, 20, 'activo', 'perro', true);

      await controller.listarComercios(1, 20, undefined, undefined, 'false');
      expect(adminService.listarComercios).toHaveBeenLastCalledWith(1, 20, undefined, undefined, false);
    });

    it('deberia devolver el resumen y la ficha', async () => {
      await controller.resumenComercios();
      await controller.fichaComercio('comercio-1');

      expect(adminService.resumenComercios).toHaveBeenCalled();
      expect(adminService.fichaComercio).toHaveBeenCalledWith('comercio-1');
    });

    it('deberia crear y actualizar el comercio con el cuerpo recibido', async () => {
      await controller.crearComercio({ razonSocial: 'X SL', vatNumber: 'B1', nombreComercial: 'X' });
      await controller.actualizarComercio('comercio-1', { plan: 'pro' });

      expect(adminService.crearComercio).toHaveBeenCalledWith(
        expect.objectContaining({ vatNumber: 'B1' }),
      );
      expect(adminService.actualizarComercio).toHaveBeenCalledWith('comercio-1', { plan: 'pro' });
    });

    it('deberia registrar que admin verifica la documentacion', async () => {
      await controller.cambiarVerificacionComercio(
        'comercio-1', { estado: 'rechazado', motivo: 'licencia caducada' }, admin,
      );

      expect(adminService.cambiarVerificacionComercio).toHaveBeenCalledWith(
        'comercio-1', 'rechazado', 'licencia caducada', 'admin-1',
      );
    });

    it('deberia dar de baja el comercio pasando motivo, comentario y quien lo hace', async () => {
      await controller.eliminarComercio(
        'comercio-1',
        { motivo: MotivoBajaComercio.CIERRE_NEGOCIO, comentario: 'cierra', purgar: false },
        admin,
      );

      expect(adminService.eliminarComercio).toHaveBeenCalledWith(
        'comercio-1',
        { motivo: MotivoBajaComercio.CIERRE_NEGOCIO, comentario: 'cierra', purgar: false },
        'admin-1',
      );
    });

    it('deberia restaurar un comercio dado de baja', async () => {
      await controller.restaurarComercio('comercio-1', admin);
      expect(adminService.restaurarComercio).toHaveBeenCalledWith('comercio-1', 'admin-1');
    });
  });

  describe('usuarios', () => {
    it('deberia traducir el filtro de verificacion a booleano', async () => {
      await controller.listarUsuarios(1, 20, 'cliente', 'juan', 'true');
      expect(adminService.listarUsuarios).toHaveBeenCalledWith(1, 20, 'cliente', 'juan', true);

      await controller.listarUsuarios(1, 20);
      expect(adminService.listarUsuarios).toHaveBeenLastCalledWith(1, 20, undefined, undefined, undefined);
    });

    it('deberia devolver el resumen y la ficha', async () => {
      await controller.resumenUsuarios();
      await controller.fichaUsuario('user-1');

      expect(adminService.fichaUsuario).toHaveBeenCalledWith('user-1');
    });

    it('deberia registrar que admin edita o elimina una cuenta', async () => {
      // Editar roles y borrar cuentas son las acciones mas sensibles del panel:
      // sin actor no hay a quien pedir explicaciones.
      await controller.actualizarUsuario('user-1', { rol: Rol.ADMIN }, admin);
      await controller.eliminarUsuario('user-1', admin);

      expect(adminService.actualizarUsuario).toHaveBeenCalledWith('user-1', { rol: Rol.ADMIN }, 'admin-1');
      expect(adminService.eliminarUsuario).toHaveBeenCalledWith('user-1', 'admin-1');
    });

    it('deberia crear la cuenta con el cuerpo recibido', async () => {
      const dto = { nombre: 'Ana', email: 'ana@test.com', password: 'secreta8' };

      await controller.crearUsuario(dto);

      expect(adminService.crearUsuario).toHaveBeenCalledWith(dto);
    });
  });

  describe('pagos, reservas y analitica', () => {
    it('deberia pasar los filtros de pagos agrupados', async () => {
      await controller.listarPagos(2, 50, 'aprobado', 'comercio-1', 'RES-1');

      expect(adminService.listarPagos).toHaveBeenCalledWith(2, 50, {
        estado: 'aprobado', comercioId: 'comercio-1', buscar: 'RES-1',
      });
    });

    it('deberia devolver los resumenes y la evolucion', async () => {
      await controller.resumenPagos();
      await controller.resumenReservas();
      await controller.evolucion(7);
      await controller.obtenerAnalitica();

      expect(adminService.evolucion).toHaveBeenCalledWith(7);
      expect(adminService.obtenerAnalitica).toHaveBeenCalled();
    });

    it('deberia convertir a numero los importes del filtro de reservas', async () => {
      await controller.listarReservas(1, 20, { importeMin: '100', importeMax: '500', estado: 'confirmada' });

      expect(adminService.listarReservas).toHaveBeenCalledWith(1, 20,
        expect.objectContaining({ importeMin: 100, importeMax: 500, estado: 'confirmada' }));
    });

    it('deberia descartar importes vacios o no numericos en vez de mandar NaN', async () => {
      // Un NaN en el filtro haria que Mongo no devolviera nada, sin error visible.
      await controller.listarReservas(1, 20, { importeMin: '', importeMax: 'mucho' });

      expect(adminService.listarReservas).toHaveBeenCalledWith(1, 20,
        expect.objectContaining({ importeMin: undefined, importeMax: undefined }));
    });

    it('deberia registrar que admin cambia el estado de una reserva', async () => {
      await controller.cambiarEstadoReserva('reserva-1', { estado: 'cancelada', motivo: 'fraude' }, admin);

      expect(adminService.cambiarEstadoReserva).toHaveBeenCalledWith(
        'reserva-1', 'cancelada', 'admin-1', 'fraude',
      );
    });
  });

  describe('reporteFinanciero', () => {
    it('debería retornar el reporte con los filtros correctos', async () => {
      const resultado = await controller.reporteFinanciero('2025-01-01', '2025-01-31');

      expect(adminService.generarReporteFinanciero).toHaveBeenCalledWith(
        expect.objectContaining({
          fechaDesde: new Date('2025-01-01'),
          fechaHasta: new Date('2025-01-31'),
        }),
      );
      expect(resultado.gmv).toBe(885);
      expect(resultado.margenNetoPlataforma).toBe(84.63);
    });

    it('debería pasar filtros opcionales de vertical y comercio', async () => {
      await controller.reporteFinanciero('2025-01-01', '2025-01-31', 'alojamiento', 'comercio-1');

      expect(adminService.generarReporteFinanciero).toHaveBeenCalledWith(
        expect.objectContaining({ vertical: 'alojamiento', comercioId: 'comercio-1' }),
      );
    });
  });
});
