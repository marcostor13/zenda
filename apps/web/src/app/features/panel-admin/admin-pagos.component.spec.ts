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

  it('debería traducir el estado del pago a una etiqueta legible', async () => {
    await crear();

    expect(componente.etiqueta('aprobado')).toBe('Cobrado');
    expect(componente.etiqueta('inventado')).toBe('inventado');
    expect(componente.badge('reembolsado')).toContain('neutral');
  });
});
