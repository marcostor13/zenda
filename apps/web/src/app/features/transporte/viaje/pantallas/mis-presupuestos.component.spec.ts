import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { Router, provideRouter } from '@angular/router';
import { EstadoPresupuesto, PresupuestoDto, VerticalKey } from 'shared';
import { TransporteViajeApi } from '../transporte-viaje.api';
import { MisPresupuestosComponent } from './mis-presupuestos.component';

const presupuesto = (extra: Partial<PresupuestoDto> = {}): PresupuestoDto => ({
  id: 'pr1', codigo: 'PRE-1', vertical: VerticalKey.TRANSPORTE, servicioId: 's1', comercioId: 'c1',
  estado: EstadoPresupuesto.OFERTADO, fechaServicio: '2026-10-10T08:00:00.000Z', moneda: 'EUR',
  solicitud: { resumen: [['Recogida', 'Calle Mayor 1, Madrid'], ['Entrega', 'Rue de Rivoli, París']] },
  importe: 300, condiciones: 'Peajes incluidos', tituloServicio: 'DogVan', createdAt: '2026-09-20T10:00:00.000Z',
  ...extra,
});

describe('MisPresupuestosComponent', () => {
  let fixture: ComponentFixture<MisPresupuestosComponent>;
  let componente: MisPresupuestosComponent;
  let api: jest.Mocked<Pick<TransporteViajeApi, 'misPresupuestos' | 'rechazarPresupuesto'>>;
  let router: Router;

  const crear = async (): Promise<void> => {
    await TestBed.configureTestingModule({
      imports: [MisPresupuestosComponent],
      providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting(), { provide: TransporteViajeApi, useValue: api }],
    }).compileComponents();
    router = TestBed.inject(Router);
    jest.spyOn(router, 'navigate').mockResolvedValue(true);
    fixture = TestBed.createComponent(MisPresupuestosComponent);
    componente = fixture.componentInstance;
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  };

  beforeEach(() => {
    api = {
      misPresupuestos: jest.fn().mockResolvedValue([
        presupuesto(),
        presupuesto({ id: 'pr2', codigo: 'PRE-2', estado: EstadoPresupuesto.SOLICITADO, importe: undefined, tituloServicio: undefined }),
      ]),
      rechazarPresupuesto: jest.fn().mockResolvedValue(presupuesto({ estado: EstadoPresupuesto.RECHAZADO })),
    };
  });

  afterEach(() => fixture?.destroy());

  it('debería listar los presupuestos con la empresa, la ruta, el estado y la oferta', async () => {
    await crear();

    expect(componente.cargando()).toBe(false);
    const el: HTMLElement = fixture.nativeElement;
    const tarjetas = el.querySelectorAll('.mp__presupuesto');
    expect(tarjetas).toHaveLength(2);
    expect(tarjetas[0].querySelector('h2')?.textContent).toContain('DogVan');
    expect(tarjetas[0].querySelector('.mp__fecha')?.textContent).toContain('Calle Mayor 1 → Rue de Rivoli');
    expect(tarjetas[0].querySelector('.mp__estado')?.textContent).toContain('Presupuesto recibido');
    expect(tarjetas[0].textContent).toContain('Peajes incluidos');
    expect(tarjetas[0].querySelectorAll('.mp__acciones button')).toHaveLength(2);
    // Sin empresa en el título, la ruta; sin oferta todavía, la espera.
    expect(tarjetas[1].querySelector('h2')?.textContent).toContain('Calle Mayor 1 → Rue de Rivoli');
    expect(tarjetas[1].querySelector('.mp__espera')).not.toBeNull();
  });

  it('debería usar el código como ruta si el resumen no la trae', async () => {
    await crear();
    expect(componente.ruta(presupuesto({ solicitud: {} }))).toBe('PRE-1');
    expect(componente.resumen(presupuesto({ solicitud: { resumen: 'no es lista' } }))).toEqual([]);
    expect(componente.etiquetaEstado(presupuesto({ estado: 'rara' as EstadoPresupuesto }))).toBe('rara');
  });

  it('debería mostrar el vacío si no hay presupuestos', async () => {
    api.misPresupuestos.mockResolvedValue([]);
    await crear();
    expect(fixture.nativeElement.querySelector('.mp__vacio')).not.toBeNull();
  });

  it('debería avisar si no se pueden cargar', async () => {
    api.misPresupuestos.mockRejectedValue(new Error('500'));
    await crear();
    expect(componente.error()).toBeTruthy();
    expect(fixture.nativeElement.querySelector('.rs-alert--error')).not.toBeNull();
  });

  describe('aceptar', () => {
    it('sólo debería dejar aceptar ofertas vigentes', async () => {
      await crear();

      expect(componente.puedeAceptar(presupuesto())).toBe(true);
      expect(componente.puedeAceptar(presupuesto({ estado: EstadoPresupuesto.SOLICITADO }))).toBe(false);
      expect(componente.puedeAceptar(presupuesto({ estado: EstadoPresupuesto.ACEPTADO }))).toBe(false);
      expect(componente.puedeAceptar(presupuesto({ validoHasta: '2000-01-01T00:00:00.000Z' }))).toBe(false);
      expect(componente.puedeAceptar(presupuesto({ validoHasta: '2999-01-01T00:00:00.000Z' }))).toBe(true);
    });

    it('debería llevar a completar la reserva con el presupuesto', async () => {
      await crear();

      (fixture.nativeElement.querySelector('.mp__acciones .rs-btn--gold') as HTMLButtonElement).click();

      expect(router.navigate).toHaveBeenCalledWith(['/transporte/viaje/reserva'], { queryParams: { presupuesto: 'pr1' } });
    });

    it('debería ofrecer completar el pago de un presupuesto ya aceptado con reserva', async () => {
      api.misPresupuestos.mockResolvedValue([presupuesto({ estado: EstadoPresupuesto.ACEPTADO, reservaId: 'r1' })]);
      await crear();

      const boton = fixture.nativeElement.querySelector('.mp__acciones .rs-btn--primary') as HTMLButtonElement;
      expect(boton.textContent).toContain('Completar el pago');
      boton.click();

      expect(router.navigate).toHaveBeenCalledWith(['/transporte/viaje/reserva'], { queryParams: { presupuesto: 'pr1' } });
    });
  });

  describe('rechazar', () => {
    it('debería rechazar la oferta y actualizarla en la lista', async () => {
      await crear();

      await componente.rechazar(componente.presupuestos()[0]);

      expect(api.rechazarPresupuesto).toHaveBeenCalledWith('pr1');
      expect(componente.presupuestos()[0].estado).toBe(EstadoPresupuesto.RECHAZADO);
      expect(componente.presupuestos()[1].estado).toBe(EstadoPresupuesto.SOLICITADO);
      expect(componente.ocupado()).toBeNull();
    });

    it('debería avisar si no se puede rechazar', async () => {
      await crear();
      api.rechazarPresupuesto.mockRejectedValue(new Error('500'));

      await componente.rechazar(componente.presupuestos()[0]);

      expect(componente.error()).toBeTruthy();
      expect(componente.presupuestos()[0].estado).toBe(EstadoPresupuesto.OFERTADO);
    });
  });
});
