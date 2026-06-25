import { Test, TestingModule } from '@nestjs/testing';
import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';
import { VerticalKey, Rol } from 'shared';

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
        {
          provide: AdminService,
          useValue: {
            listarComisiones: jest.fn().mockResolvedValue([]),
            actualizarComision: jest.fn().mockResolvedValue({ vertical: VerticalKey.HOTELES }),
            generarReporteFinanciero: jest.fn().mockResolvedValue(reporteMock),
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
        vertical: VerticalKey.HOTELES as any,
        comisionPct: 0.18,
        stripePct: 0.029,
        stripeFijoEur: 1.1,
        activo: true,
      };

      const resultado = await controller.actualizarComision(dto, req);
      expect(adminService.actualizarComision).toHaveBeenCalledWith(dto, 'admin-1');
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
      await controller.reporteFinanciero('2025-01-01', '2025-01-31', 'hoteles', 'comercio-1');

      expect(adminService.generarReporteFinanciero).toHaveBeenCalledWith(
        expect.objectContaining({ vertical: 'hoteles', comercioId: 'comercio-1' }),
      );
    });
  });
});
