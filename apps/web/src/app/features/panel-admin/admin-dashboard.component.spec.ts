import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { RouterTestingModule } from '@angular/router/testing';
import { of } from 'rxjs';
import { VerticalKey } from 'shared';
import { AdminDashboardComponent } from './admin-dashboard.component';
import { AdminApiService } from './admin-api.service';

const kpis = (extra: Record<string, number> = {}) => ({
  totalReservas: 120, gmvMes: 5000, ingresosMes: 750,
  comerciosPendientesCount: 2, totalUsuarios: 300,
  verificacionesPendientes: 1, nuevosComerciosMes: 4,
  mascotasRegistradas: 210, tasaCancelacionMes: 0.05,
  pagosRetenidosMonto: 300, pagosRetenidosCount: 3,
  incidenciasAbiertas: 4,
  ...extra,
});

/** Fallo síncrono: una promesa rechazada la reporta zone.js como error global. */
const fallo = (mensaje: string) => jest.fn(() => { throw new Error(mensaje); });

describe('AdminDashboardComponent', () => {
  let fixture: ComponentFixture<AdminDashboardComponent>;
  let componente: AdminDashboardComponent;
  let api: Record<string, jest.Mock>;

  const crear = async (
    datos: Record<string, unknown> = {},
    ajustes: Record<string, jest.Mock> = {},
  ): Promise<void> => {
    api = {
      getDashboard: jest.fn().mockReturnValue(of({
        kpis: kpis(),
        comerciosPendientes: [{ id: 'c1', nombreComercial: 'Canes' }],
        ultimasReservas: [{ _id: 'r1', codigo: 'RES-AAAA1111', estado: 'confirmada' }],
        comparativa: { gmvPct: 12.5, ingresosPct: null, reservasPct: -4, comerciosPct: null },
        ...datos,
      })),
      aprobarComercio: jest.fn().mockReturnValue(of({})),
      rechazarComercio: jest.fn().mockReturnValue(of({})),
      getResumenComercios: jest.fn().mockReturnValue(of({ total: 5, activos: 3, pendientes: 1, suspendidos: 1, verificados: 2 })),
      ...ajustes,
    };

    await TestBed.configureTestingModule({
      imports: [AdminDashboardComponent, RouterTestingModule],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: AdminApiService, useValue: api },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(AdminDashboardComponent);
    componente = fixture.componentInstance;
    fixture.detectChanges();
    await fixture.whenStable();
    // ngOnInit encadena dashboard → resumen de comercios; whenStable() no basta
    // para esperar la cadena completa, se necesita un macrotask real.
    await new Promise((resolve) => setTimeout(resolve, 0));
    fixture.detectChanges();
  };

  afterEach(() => {
    fixture?.destroy();
    jest.clearAllMocks();
  });

  describe('carga', () => {
    it('debería repartir los datos del dashboard', async () => {
      await crear();

      expect(componente.kpis().totalReservas).toBe(120);
      expect(componente.comerciosPendientes()).toHaveLength(1);
      expect(componente.ultimasReservas()).toHaveLength(1);
      expect(componente.cargando()).toBe(false);
    });

    it('debería avisar si el dashboard no carga', async () => {
      await crear({}, { getDashboard: fallo('500') });

      expect(componente.errorMsg()).toContain('Error cargando el dashboard');
      expect(componente.cargando()).toBe(false);
    });
  });

  describe('alertas', () => {
    it('debería sumar todo lo que requiere intervención del admin', async () => {
      await crear();

      // 1 verificación + 2 comercios + 3 pagos retenidos + 4 incidencias.
      expect(componente.totalAlertas()).toBe(10);
    });

    it('no debería mostrar alertas con todo al día', async () => {
      await crear({
        kpis: kpis({
          verificacionesPendientes: 0, comerciosPendientesCount: 0,
          pagosRetenidosCount: 0, incidenciasAbiertas: 0,
        }),
      });

      expect(componente.totalAlertas()).toBe(0);
    });
  });

  describe('aprobación de comercios', () => {
    it('debería sacar el comercio aprobado de la cola', async () => {
      await crear();

      await componente.aprobarComercio('c1');

      expect(api['aprobarComercio']).toHaveBeenCalledWith('c1');
      expect(componente.comerciosPendientes()).toHaveLength(0);
      expect(componente.kpis().comerciosPendientesCount).toBe(1);
    });

    it('debería sacar también el comercio rechazado', async () => {
      await crear();

      await componente.rechazarComercio('c1');

      expect(api['rechazarComercio']).toHaveBeenCalledWith('c1');
      expect(componente.comerciosPendientes()).toHaveLength(0);
    });

    it('debería dejar el comercio en la cola si la aprobación falla', async () => {
      await crear({}, { aprobarComercio: fallo('500') });

      await componente.aprobarComercio('c1');

      expect(componente.errorMsg()).toContain('Error al aprobar');
      expect(componente.comerciosPendientes()).toHaveLength(1);
    });

    it('debería avisar si el rechazo falla', async () => {
      await crear({}, { rechazarComercio: fallo('500') });

      await componente.rechazarComercio('c1');

      expect(componente.errorMsg()).toContain('Error al rechazar');
    });
  });

  describe('etiquetas', () => {
    it('debería dar un icono Lucide por vertical con respaldo (TCK-8010)', async () => {
      await crear();

      expect(componente.iconoVertical(VerticalKey.ALOJAMIENTO)).toBe('hotel');
      expect(componente.iconoVertical('hoteles')).toBe('building');
      expect(componente.iconoVertical('inventado')).toBe('paw');
    });

    it('debería dar un badge por estado de reserva', async () => {
      await crear();

      expect(componente.badgeEstado('confirmada')).toContain('rs-badge--');
      expect(componente.badgeEstado('inventado')).toContain('neutral');
    });
  });
});
