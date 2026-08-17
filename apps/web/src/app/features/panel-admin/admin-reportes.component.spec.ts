import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { of } from 'rxjs';
import { VerticalKey } from 'shared';
import { AdminReportesComponent } from './admin-reportes.component';
import { AdminApiService, ReporteFinanciero } from './admin-api.service';

const reporte = (extra: Partial<ReporteFinanciero> = {}): ReporteFinanciero => ({
  fechaDesde: '2026-07-01', fechaHasta: '2026-07-31',
  gmv: 1000, ingresosPlataforma: 150, costoStripe: 30,
  margenNetoPlataforma: 120, liquidacionesComercio: 820, totalReservas: 10,
  porVertical: [
    {
      vertical: VerticalKey.ALOJAMIENTO, gmv: 800, comision: 120,
      costoStripe: 24, margenNeto: 96, totalReservas: 8,
    },
  ],
  totalReservasConAjuste: 0,
  importeTotalAjustes: 0,
  ajustesPorComercio: [],
  ...extra,
} as ReporteFinanciero);

describe('AdminReportesComponent', () => {
  let fixture: ComponentFixture<AdminReportesComponent>;
  let componente: AdminReportesComponent;
  let api: Record<string, jest.Mock>;

  const crear = async (ajustes: Record<string, jest.Mock> = {}): Promise<void> => {
    api = {
      getReporteFinanciero: jest.fn().mockReturnValue(of(reporte())),
      getComercios: jest.fn().mockReturnValue(of({ items: [{ _id: 'c1', nombreComercial: 'Royal Dog' }], total: 1 })),
      ...ajustes,
    };

    await TestBed.configureTestingModule({
      imports: [AdminReportesComponent],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: AdminApiService, useValue: api },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(AdminReportesComponent);
    componente = fixture.componentInstance;
    fixture.detectChanges();
    // ngOnInit encadena reporte, comparativa y lista de comercios.
    await fixture.whenStable();
    await fixture.whenStable();
    fixture.detectChanges();
  };

  afterEach(() => jest.clearAllMocks());

  it('debería cargar solo, con los últimos 30 días ya calculados', async () => {
    await crear();

    // La pantalla nunca se ve como un formulario vacío (TCK-8032/8033).
    expect(componente.reporte()).not.toBeNull();
    expect(componente.atajoActivo()).toBe('30d');
    expect(componente.fechaDesde).not.toBe('');
    expect(componente.fechaHasta).not.toBe('');
    expect(componente.cargando()).toBe(false);
  });

  it('debería ofrecer los comercios para el filtro', async () => {
    await crear();

    expect(componente.comercios()).toEqual([{ _id: 'c1', nombreComercial: 'Royal Dog' }]);
  });

  it('debería seguir mostrando el reporte aunque no cargue la lista de comercios', async () => {
    await crear({ getComercios: jest.fn(() => { throw new Error('500'); }) });

    expect(componente.comercios()).toEqual([]);
    expect(componente.reporte()).not.toBeNull();
  });

  it('debería avisar cuando el reporte no se puede generar', async () => {
    await crear({ getReporteFinanciero: jest.fn(() => { throw new Error('500'); }) });

    expect(componente.errorMsg()).toContain('Error generando el reporte');
    expect(componente.reporte()).toBeNull();
  });

  describe('atajos de periodo', () => {
    it('debería recalcular al elegir un atajo', async () => {
      await crear();
      jest.clearAllMocks();

      await componente.aplicarAtajo('7d');

      expect(componente.atajoActivo()).toBe('7d');
      expect(api['getReporteFinanciero']).toHaveBeenCalled();
    });

    it('debería empezar el rango el día 1 al elegir "este mes"', async () => {
      await crear();

      await componente.aplicarAtajo('mes');

      expect(componente.fechaDesde.slice(-2)).toBe('01');
    });

    it('debería empezar el rango en enero al elegir "este año"', async () => {
      await crear();

      await componente.aplicarAtajo('ano');

      expect(componente.fechaDesde.slice(-5)).toBe('01-01');
    });

    it('no debería tocar las fechas con el periodo personalizado', async () => {
      await crear();
      const desde = componente.fechaDesde;
      jest.clearAllMocks();

      await componente.aplicarAtajo('personalizado');

      // Las elige el usuario a mano: recalcular aquí las pisaría.
      expect(componente.fechaDesde).toBe(desde);
      expect(api['getReporteFinanciero']).not.toHaveBeenCalled();
    });
  });

  describe('comparativa con el periodo anterior', () => {
    it('debería calcular la variación de GMV, comisión y reservas', async () => {
      await crear({
        getReporteFinanciero: jest.fn()
          .mockReturnValueOnce(of(reporte()))
          .mockReturnValueOnce(of(reporte({ gmv: 500, ingresosPlataforma: 100, totalReservas: 5 }))),
      });

      expect(componente.comparativa()).toEqual({ gmv: 100, ingresos: 50, reservas: 100 });
    });

    it('no debería enseñar porcentaje si en el periodo previo no hubo actividad', async () => {
      await crear({
        getReporteFinanciero: jest.fn()
          .mockReturnValueOnce(of(reporte()))
          .mockReturnValueOnce(of(reporte({ gmv: 0, ingresosPlataforma: 0, totalReservas: 0 }))),
      });

      // Un "+100 %" desde cero engaña más de lo que informa.
      expect(componente.comparativa()).toEqual({ gmv: null, ingresos: null, reservas: null });
    });
  });

  describe('exportación CSV', () => {
    // jsdom no implementa la API de blobs: se sustituye para poder observarla.
    let crearUrl: jest.Mock;
    let click: jest.SpyInstance;

    beforeEach(() => {
      crearUrl = jest.fn().mockReturnValue('blob:x');
      (URL as unknown as Record<string, unknown>)['createObjectURL'] = crearUrl;
      (URL as unknown as Record<string, unknown>)['revokeObjectURL'] = jest.fn();
      click = jest.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => undefined);
    });

    afterEach(() => click.mockRestore());

    it('debería descargar el reporte con su desglose por vertical', async () => {
      await crear();

      componente.exportarCsv();

      expect(crearUrl).toHaveBeenCalled();
      expect(click).toHaveBeenCalled();
    });

    it('no debería exportar nada si el reporte no cargó', async () => {
      await crear({ getReporteFinanciero: jest.fn(() => { throw new Error('500'); }) });

      componente.exportarCsv();

      expect(crearUrl).not.toHaveBeenCalled();
    });
  });
});
