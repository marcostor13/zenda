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

const comision = (extra: Record<string, unknown> = {}) => ({
  vertical: VerticalKey.ALOJAMIENTO, comisionPct: 0.15, stripePct: 0.015,
  stripeFijoEur: 0.25, activo: true, ...extra,
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
        comisiones: [comision()],
        ...datos,
      })),
      aprobarComercio: jest.fn().mockReturnValue(of({})),
      rechazarComercio: jest.fn().mockReturnValue(of({})),
      updateComision: jest.fn().mockReturnValue(of({})),
      getAlphaNiveles: jest.fn().mockReturnValue(of([
        { nivel: 1, nombre: 'Alpha 1', reservasRequeridas: 0, descuentoPct: 0, beneficios: ['Promos'] },
      ])),
      updateAlphaNivel: jest.fn().mockReturnValue(of({})),
      // Empresas adheridas al programa Alpha, ahora gestionadas aquí (TCK-8034).
      getComercios: jest.fn().mockReturnValue(of({ items: [], total: 0 })),
      fijarAlphaAdherido: jest.fn().mockReturnValue(of({})),
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
    // ngOnInit encadena dashboard → niveles Alpha; whenStable() no basta para
    // esperar la cadena completa, se necesita un macrotask real.
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
      expect(componente.comisiones()).toHaveLength(1);
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

  describe('comisiones', () => {
    it('debería sumar la comisión de la plataforma y la variable de Stripe', async () => {
      await crear();

      // 15% + 1,5% = 16,5%, con coma decimal para el mercado europeo.
      expect(componente.comisionTotal(comision() as never)).toBe('16,5');
    });

    it('debería guardar el porcentaje como fracción', async () => {
      await crear();
      const c = comision() as never as { comisionPct: number };

      componente.actualizarPct(c as never, 12);

      expect(c.comisionPct).toBe(0.12);
    });

    it('debería guardar todas las comisiones de una vez', async () => {
      await crear({ comisiones: [comision(), comision({ vertical: VerticalKey.VETERINARIA, comisionPct: 0.1 })] });

      await componente.guardarComisiones();

      expect(api['updateComision']).toHaveBeenCalledTimes(2);
      expect(componente.guardadoMsg()).toBe(true);
    });

    it('debería avisar si el guardado falla', async () => {
      await crear({}, { updateComision: fallo('500') });

      await componente.guardarComisiones();

      expect(componente.errorMsg()).toContain('Error al guardar las comisiones');
      expect(componente.guardadoMsg()).toBe(false);
    });
  });

  describe('programa Doogking Alpha', () => {
    it('debería cargar la escalera de niveles al iniciar', async () => {
      await crear();

      expect(componente.alphaNiveles()).toHaveLength(1);
      expect(componente.alphaNiveles()[0].nombre).toBe('Alpha 1');
    });

    it('debería seguir mostrando el dashboard aunque falle la carga de Alpha', async () => {
      await crear({}, { getAlphaNiveles: fallo('500') });

      expect(componente.alphaNiveles()).toEqual([]);
      expect(componente.cargando()).toBe(false);
    });

    it('debería convertir el texto de beneficios separado por comas en un array', () => {
      const resultado = componente.beneficiosDesdeTexto('5% descuento,  promos exclusivas ,');
      expect(resultado).toEqual(['5% descuento', 'promos exclusivas']);
    });

    it('debería guardar todos los niveles de una vez', async () => {
      await crear({}, {
        getAlphaNiveles: jest.fn().mockReturnValue(of([
          { nivel: 1, nombre: 'Alpha 1', reservasRequeridas: 0, descuentoPct: 0, beneficios: [] },
          { nivel: 2, nombre: 'Alpha 2', reservasRequeridas: 5, descuentoPct: 0.05, beneficios: [] },
        ])),
      });

      await componente.guardarAlphaNiveles();

      expect(api['updateAlphaNivel']).toHaveBeenCalledTimes(2);
      expect(componente.alphaGuardadoMsg()).toBe(true);
    });

    it('debería avisar si el guardado de Alpha falla', async () => {
      await crear({}, { updateAlphaNivel: fallo('500') });

      await componente.guardarAlphaNiveles();

      expect(componente.errorMsg()).toContain('Error al guardar el programa Alpha');
      expect(componente.alphaGuardadoMsg()).toBe(false);
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
