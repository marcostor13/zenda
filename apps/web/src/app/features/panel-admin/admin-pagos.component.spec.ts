import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { of } from 'rxjs';
import { AdminPagosComponent } from './admin-pagos.component';
import { AdminApiService } from './admin-api.service';

const pago = (extra: Record<string, unknown> = {}) => ({
  _id: 'p1', codigoReserva: 'RES-AAAA1111', comercio: 'VilaCan', vertical: 'alojamiento',
  montoTotal: 590, comisionPlataforma: 75, stripeFee: 18.21, montoLiquidacion: 496.79,
  estado: 'aprobado', createdAt: '2026-07-01T00:00:00.000Z', ...extra,
});

const resumen = {
  cobrado: 885, comisionDoogking: 112.5, costePasarela: 27.87,
  liquidadoComercios: 744.63, pendienteLiquidar: 300, reembolsado: 0,
};

/** Fallo síncrono: una promesa rechazada la reporta zone.js como error global. */
const fallo = (mensaje: string) => jest.fn(() => { throw new Error(mensaje); });

describe('AdminPagosComponent', () => {
  let fixture: ComponentFixture<AdminPagosComponent>;
  let componente: AdminPagosComponent;
  let api: Record<string, jest.Mock>;

  const crear = async (ajustes: Record<string, jest.Mock> = {}): Promise<void> => {
    api = {
      getPagos: jest.fn().mockReturnValue(of({ items: [pago()], total: 1 })),
      getResumenPagos: jest.fn().mockReturnValue(of(resumen)),
      ...ajustes,
    };

    await TestBed.configureTestingModule({
      imports: [AdminPagosComponent],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: AdminApiService, useValue: api },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(AdminPagosComponent);
    componente = fixture.componentInstance;
    fixture.detectChanges();
    await fixture.whenStable();
    // ngOnInit encadena listado → resumen: hace falta un macrotask real.
    await new Promise((resolve) => setTimeout(resolve, 0));
    fixture.detectChanges();
  };

  afterEach(() => {
    fixture?.destroy();
    jest.clearAllMocks();
  });

  it('debería cargar pagos y totales al iniciar', async () => {
    await crear();

    expect(componente.pagos()).toHaveLength(1);
    expect(componente.total()).toBe(1);
    expect(componente.resumen()?.comisionDoogking).toBe(112.5);
    expect(componente.cargando()).toBe(false);
  });

  it('debería seguir mostrando la tabla aunque fallen los totales', async () => {
    await crear({ getResumenPagos: fallo('500') });

    expect(componente.pagos()).toHaveLength(1);
    expect(componente.resumen()).toBeNull();
  });

  it('debería avisar si los pagos no cargan', async () => {
    await crear({ getPagos: fallo('500') });

    expect(componente.errorMsg()).toContain('Error cargando los pagos');
    expect(componente.cargando()).toBe(false);
  });

  it('debería filtrar por estado volviendo a la primera página', async () => {
    await crear();
    componente.pagina.set(3);

    await componente.cambiarFiltro('reembolsado');

    expect(api['getPagos']).toHaveBeenLastCalledWith(
      expect.objectContaining({ estado: 'reembolsado', page: 1 }),
    );
  });

  it('debería buscar por código sin espacios sobrantes', async () => {
    await crear();

    await componente.aplicarBusqueda('  RES-AAAA1111  ');

    expect(api['getPagos']).toHaveBeenLastCalledWith(
      expect.objectContaining({ buscar: 'RES-AAAA1111' }),
    );
  });

  describe('liquidaciones', () => {
    const liquidacion = {
      _id: 'l1', comercioNombre: 'VilaCan', desde: '2026-09-01', hasta: '2026-09-30',
      facturacionBruta: 590, comisionPlataforma: 75, stripeFee: 18.21, importeNeto: 496.79,
      reservas: 2, estado: 'pendiente',
    };

    const conLiquidaciones = (ajustes: Record<string, jest.Mock> = {}) => ({
      getLiquidaciones: jest.fn().mockReturnValue(of({ items: [liquidacion], total: 1 })),
      getComercios: jest.fn().mockReturnValue(of({ items: [{ _id: 'c1', nombreComercial: 'VilaCan' }], total: 1 })),
      generarLiquidacion: jest.fn().mockReturnValue(of(liquidacion)),
      marcarLiquidacionPagada: jest.fn().mockReturnValue(of({ ...liquidacion, estado: 'pagada', referencia: 'TRF-1' })),
      ...ajustes,
    });

    it('debería cargar historial y comercios al abrir la pestaña', async () => {
      await crear(conLiquidaciones());

      await componente.cambiarALiquidaciones();

      expect(componente.vista()).toBe('liquidaciones');
      expect(componente.liquidaciones()).toHaveLength(1);
      expect(componente.comercios()).toHaveLength(1);
    });

    it('debería mandar las fechas tal cual salen del campo, sin pasarlas por el huso local', async () => {
      // Convertirlas aquí a ISO corría el periodo un día fuera de UTC.
      await crear(conLiquidaciones());
      componente.comercioSel.set('c1');
      componente.desdeSel.set('2026-09-01');
      componente.hastaSel.set('2026-09-30');

      await componente.generarLiquidacion();

      expect(api['generarLiquidacion']).toHaveBeenCalledWith({
        comercioId: 'c1', desde: '2026-09-01', hasta: '2026-09-30',
      });
    });

    it('debería enseñar el motivo que devuelve el API al no poder generar', async () => {
      await crear(conLiquidaciones({
        generarLiquidacion: jest.fn(() => {
          throw { error: { message: 'Ese periodo ya está liquidado (del 2026-09-01 al 2026-09-30).' } };
        }),
      }));
      componente.comercioSel.set('c1');
      componente.desdeSel.set('2026-09-01');
      componente.hastaSel.set('2026-09-30');

      await componente.generarLiquidacion();

      expect(componente.errorMsg()).toContain('ya está liquidado');
      expect(componente.generando()).toBe(false);
    });

    it('no debería generar sin comercio ni periodo elegidos', async () => {
      await crear(conLiquidaciones());

      await componente.generarLiquidacion();

      expect(api['generarLiquidacion']).not.toHaveBeenCalled();
    });

    it('debería marcar como pagada con la referencia y cerrar el formulario', async () => {
      await crear(conLiquidaciones());
      await componente.cambiarALiquidaciones();
      componente.abrirPago('l1');
      componente.referencia.set('  TRF-1  ');

      await componente.confirmarPago(componente.liquidaciones()[0]);

      expect(api['marcarLiquidacionPagada']).toHaveBeenCalledWith('l1', 'TRF-1');
      expect(componente.liquidaciones()[0].estado).toBe('pagada');
      expect(componente.pagandoId()).toBe('');
    });

    it('debería enseñar el motivo del API si ya estaba pagada', async () => {
      await crear(conLiquidaciones({
        marcarLiquidacionPagada: jest.fn(() => {
          throw { error: { message: 'Esa liquidación ya se marcó como pagada (ref. TRF-BUENA).' } };
        }),
      }));
      await componente.cambiarALiquidaciones();
      componente.referencia.set('TRF-OTRA');

      await componente.confirmarPago(componente.liquidaciones()[0]);

      expect(componente.errorMsg()).toContain('ya se marcó como pagada');
    });
  });

  it('debería traducir el estado del pago a una etiqueta legible', async () => {
    await crear();

    expect(componente.etiqueta('aprobado')).toBe('Cobrado');
    expect(componente.etiqueta('inventado')).toBe('inventado');
    expect(componente.badge('reembolsado')).toContain('neutral');
  });
});
