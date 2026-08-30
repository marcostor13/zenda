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

      await componente.rechazarComercio('c1', 'documentación caducada');

      expect(api['rechazarComercio']).toHaveBeenCalledWith('c1', 'documentación caducada');
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

      await componente.rechazarComercio('c1', 'documentación caducada');

      expect(componente.errorMsg()).toContain('Error al rechazar');
    });
  });

  /*
   * El rango se calcula aquí y viaja al API: si el periodo elegido no se
   * traduce bien, el panel enseña números de otras fechas sin avisar.
   */
  describe('periodo del panel', () => {
    /** Rango con el que se pidió el dashboard la última vez. */
    const ultimoRango = (): { desde: string; hasta: string } | undefined =>
      api['getDashboard'].mock.calls.at(-1)![0];

    it('debería dejar que el API use su rango por defecto en "este mes"', async () => {
      await crear();

      await componente.cambiarPeriodo('mes');

      expect(ultimoRango()).toBeUndefined();
    });

    it.each([
      ['hoy', 1],
      ['7d', 7],
      ['30d', 30],
    ])('debería pedir el rango de %s', async (clave, dias) => {
      await crear();

      await componente.cambiarPeriodo(clave as 'hoy');

      const rango = ultimoRango()!;
      const abarcados = Math.round(
        (Date.parse(rango.hasta) - Date.parse(rango.desde)) / 86_400_000,
      );
      expect(abarcados).toBe(dias);
    });

    it('debería arrancar el año en el 1 de enero', async () => {
      await crear();

      await componente.cambiarPeriodo('ano');

      expect(new Date(ultimoRango()!.desde).getMonth()).toBe(0);
      expect(new Date(ultimoRango()!.desde).getDate()).toBe(1);
    });

    /* Con medio rango escrito no se recarga: se esperaría a la otra fecha. */
    it('no debería recargar al elegir "personalizado" sin fechas', async () => {
      await crear();
      const llamadas = api['getDashboard'].mock.calls.length;

      await componente.cambiarPeriodo('personalizado');

      expect(api['getDashboard'].mock.calls).toHaveLength(llamadas);
      expect(componente.periodo()).toBe('personalizado');
    });

    it('debería recargar en cuanto están las dos fechas', async () => {
      await crear();
      componente.desde.set('2026-03-01');
      componente.hasta.set('2026-03-31');

      await componente.cambiarPeriodo('personalizado');

      expect(ultimoRango()!.desde).toContain('2026-03-01');
      expect(ultimoRango()!.hasta).toContain('2026-03-31');
    });

    it('debería cerrar el día final del rango personalizado a las 23:59:59', async () => {
      await crear();
      componente.desde.set('2026-03-01');
      componente.hasta.set('2026-03-31');

      await componente.cambiarPeriodo('personalizado');

      expect(new Date(ultimoRango()!.hasta).getHours()).toBe(23);
    });

    it('no debería recargar con solo una de las dos fechas', async () => {
      await crear();
      const llamadas = api['getDashboard'].mock.calls.length;
      componente.desde.set('2026-03-01');

      await componente.recargarPeriodo();

      expect(api['getDashboard'].mock.calls).toHaveLength(llamadas);
    });

    it('debería recargar con las dos fechas puestas', async () => {
      await crear();
      const llamadas = api['getDashboard'].mock.calls.length;
      componente.desde.set('2026-03-01');
      componente.hasta.set('2026-03-31');

      await componente.recargarPeriodo();

      expect(api['getDashboard'].mock.calls.length).toBe(llamadas + 1);
    });
  });

  describe('comparativa con el periodo anterior', () => {
    it('debería quedarse con los porcentajes que manda el API', async () => {
      await crear();

      expect(componente.comparativa()).toMatchObject({ gmvPct: 12.5, reservasPct: -4 });
    });

    /* Un API anterior a TCK-8030 no manda comparativa: no se pinta, no revienta. */
    it('no debería pintar porcentajes si el API no los manda', async () => {
      await crear({ comparativa: undefined });

      expect(componente.comparativa()).toMatchObject({ gmvPct: null, reservasPct: null });
    });
  });

  describe('comercios activos', () => {
    it('debería contar los comercios activos', async () => {
      await crear();

      expect(componente.comerciosActivos()).toBe(3);
    });

    /* Sin ese dato la tarjeta enseña un guion; el resto del panel sigue vivo. */
    it('debería dejar la tarjeta sin dato si el resumen falla', async () => {
      await crear({}, { getResumenComercios: fallo('500') });

      expect(componente.comerciosActivos()).toBeNull();
      expect(componente.kpis().totalReservas).toBe(120);
    });
  });

  describe('etiquetas', () => {
    it('debería dar un icono Lucide por vertical con respaldo (TCK-8010)', async () => {
      await crear();

      // La residencia canina es una casa y el hotel pet friendly un hotel: con
      // el mismo icono de edificio no se distinguían en la barra ni en el panel.
      expect(componente.iconoVertical(VerticalKey.ALOJAMIENTO)).toBe('home');
      expect(componente.iconoVertical('hoteles')).toBe('hotel');
      expect(componente.iconoVertical('inventado')).toBe('paw');
    });

    it('debería dar un badge por estado de reserva', async () => {
      await crear();

      expect(componente.badgeEstado('confirmada')).toContain('rs-badge--');
      expect(componente.badgeEstado('inventado')).toContain('neutral');
    });
  });
});
