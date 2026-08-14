import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { of } from 'rxjs';
import { VerticalKey } from 'shared';
import { AdminComisionesComponent } from './admin-comisiones.component';
import { AdminApiService } from './admin-api.service';

const comision = (extra: Record<string, unknown> = {}) => ({
  vertical: VerticalKey.ALOJAMIENTO, comisionPct: 0.15, stripePct: 0.015,
  stripeFijoEur: 0.25, activo: true, ...extra,
});

/** Fallo síncrono: una promesa rechazada la reporta zone.js como error global. */
const fallo = (mensaje: string) => jest.fn(() => { throw new Error(mensaje); });

describe('AdminComisionesComponent', () => {
  let fixture: ComponentFixture<AdminComisionesComponent>;
  let componente: AdminComisionesComponent;
  let api: Record<string, jest.Mock>;

  const crear = async (
    comisiones: unknown[] = [comision()],
    ajustes: Record<string, jest.Mock> = {},
  ): Promise<void> => {
    api = {
      getComisiones: jest.fn().mockReturnValue(of(comisiones)),
      updateComision: jest.fn().mockReturnValue(of({})),
      ...ajustes,
    };

    await TestBed.configureTestingModule({
      imports: [AdminComisionesComponent],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: AdminApiService, useValue: api },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(AdminComisionesComponent);
    componente = fixture.componentInstance;
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  };

  afterEach(() => {
    fixture?.destroy();
    jest.clearAllMocks();
  });

  it('debería cargar las comisiones al iniciar', async () => {
    await crear();

    expect(componente.comisiones()).toHaveLength(1);
    expect(componente.cargando()).toBe(false);
  });

  it('debería avisar si las comisiones no cargan', async () => {
    await crear([], { getComisiones: fallo('500') });

    expect(componente.errorMsg()).toContain('Error cargando las comisiones');
    expect(componente.cargando()).toBe(false);
  });

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
    await crear([comision(), comision({ vertical: VerticalKey.VETERINARIA, comisionPct: 0.1 })]);

    await componente.guardar();

    expect(api['updateComision']).toHaveBeenCalledTimes(2);
    expect(componente.guardadoMsg()).toBe(true);
  });

  it('debería avisar si el guardado falla', async () => {
    await crear([comision()], { updateComision: fallo('500') });

    await componente.guardar();

    expect(componente.errorMsg()).toContain('Error al guardar las comisiones');
    expect(componente.guardadoMsg()).toBe(false);
  });
});
