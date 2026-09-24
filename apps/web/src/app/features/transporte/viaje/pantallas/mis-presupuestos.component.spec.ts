import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { Router, provideRouter } from '@angular/router';
import {
  EstadoRespuestaPresupuesto, EstadoSolicitudPresupuesto, RespuestaPresupuestoVista, SolicitudPresupuestoVista,
  VerticalKey,
} from 'shared';
import { TransporteViajeApi } from '../transporte-viaje.api';
import { MisPresupuestosComponent } from './mis-presupuestos.component';

const respuesta = (estado: EstadoRespuestaPresupuesto, extra: Partial<RespuestaPresupuestoVista> = {}): RespuestaPresupuestoVista => ({
  servicioId: 's1', comercioId: 'c1', titulo: 'DogVan', rating: 4.5, estado, ...extra,
});

const solicitud = (extra: Partial<SolicitudPresupuestoVista> = {}): SolicitudPresupuestoVista => ({
  id: 'pr1', codigo: 'PRE-1', vertical: VerticalKey.TRANSPORTE, estado: EstadoSolicitudPresupuesto.ABIERTA,
  detalle: { resumen: [['Recogida', 'Calle Mayor 1, Madrid'], ['Entrega', 'Rue de Rivoli, París']] },
  fechaServicio: '2026-10-10', createdAt: '2026-09-20T10:00:00.000Z',
  respuestas: [
    respuesta(EstadoRespuestaPresupuesto.RESPONDIDA, { importe: 300, condiciones: 'Peajes incluidos', imagen: 'a.jpg' }),
    respuesta(EstadoRespuestaPresupuesto.PENDIENTE, { servicioId: 's2', rating: 0 }),
    respuesta(EstadoRespuestaPresupuesto.RECHAZADA_POR_COMERCIO, { servicioId: 's3', motivoRechazo: 'Sin hueco' }),
    respuesta(EstadoRespuestaPresupuesto.DESCARTADA, { servicioId: 's4' }),
  ],
  ...extra,
});

describe('MisPresupuestosComponent', () => {
  let fixture: ComponentFixture<MisPresupuestosComponent>;
  let componente: MisPresupuestosComponent;
  let api: jest.Mocked<Pick<TransporteViajeApi, 'misPresupuestos' | 'cancelarPresupuesto'>>;
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
      misPresupuestos: jest.fn().mockResolvedValue([solicitud()]),
      cancelarPresupuesto: jest.fn().mockResolvedValue(solicitud({ estado: EstadoSolicitudPresupuesto.CANCELADA })),
    };
  });

  afterEach(() => fixture?.destroy());

  it('debería listar las solicitudes con su ruta, estado y respuestas', async () => {
    await crear();

    expect(componente.cargando()).toBe(false);
    const el: HTMLElement = fixture.nativeElement;
    expect(el.querySelector('.mp__cabecera h2')?.textContent).toContain('Calle Mayor 1 → Rue de Rivoli');
    expect(el.querySelector('.mp__estado')?.textContent).toContain('Esperando respuestas');
    expect(el.querySelectorAll('.mp__respuesta')).toHaveLength(4);
    expect(el.textContent).toContain('Peajes incluidos');
    expect(el.textContent).toContain('Sin hueco');
    expect(el.querySelectorAll('.mp__oferta button')).toHaveLength(1);
  });

  it('debería usar el código como título si el resumen no trae la ruta', async () => {
    await crear();
    expect(componente.ruta(solicitud({ detalle: {} }))).toBe('PRE-1');
    expect(componente.etiquetaEstado(solicitud({ estado: 'rara' as EstadoSolicitudPresupuesto }))).toBe('rara');
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
    it('sólo debería dejar aceptar respuestas vigentes de solicitudes sin reserva', async () => {
      await crear();
      const respondida = respuesta(EstadoRespuestaPresupuesto.RESPONDIDA, { importe: 300 });

      expect(componente.puedeAceptar(solicitud(), respondida)).toBe(true);
      expect(componente.puedeAceptar(solicitud(), respuesta(EstadoRespuestaPresupuesto.PENDIENTE))).toBe(false);
      expect(componente.puedeAceptar(solicitud({ reservaId: 'r1' }), respondida)).toBe(false);
      expect(componente.puedeAceptar(solicitud({ estado: EstadoSolicitudPresupuesto.CADUCADA }), respondida)).toBe(false);
      expect(componente.puedeAceptar(solicitud(), { ...respondida, validoHasta: '2000-01-01T00:00:00.000Z' })).toBe(false);
      expect(componente.puedeAceptar(solicitud(), { ...respondida, validoHasta: '2999-01-01T00:00:00.000Z' })).toBe(true);
    });

    it('debería llevar al pago con el presupuesto y la empresa', async () => {
      await crear();

      (fixture.nativeElement.querySelector('.mp__oferta button') as HTMLButtonElement).click();

      expect(router.navigate).toHaveBeenCalledWith(['/transporte/viaje/reserva'], { queryParams: { presupuesto: 'pr1', servicio: 's1' } });
    });
  });

  describe('retirar', () => {
    it('debería retirar la solicitud abierta y actualizarla en la lista', async () => {
      await crear();

      await componente.retirar(componente.solicitudes()[0]);

      expect(api.cancelarPresupuesto).toHaveBeenCalledWith('pr1');
      expect(componente.solicitudes()[0].estado).toBe(EstadoSolicitudPresupuesto.CANCELADA);
    });

    it('debería avisar si no se puede retirar', async () => {
      await crear();
      api.cancelarPresupuesto.mockRejectedValue(new Error('500'));

      await componente.retirar(componente.solicitudes()[0]);

      expect(componente.error()).toBeTruthy();
    });

    it('debería enlazar la reserva en vez de retirar si ya se convirtió', async () => {
      api.misPresupuestos.mockResolvedValue([solicitud({ reservaId: 'r1', estado: EstadoSolicitudPresupuesto.CONVERTIDA })]);
      await crear();

      expect(fixture.nativeElement.querySelector('.mp__retirar')).toBeNull();
      expect(fixture.nativeElement.textContent).toContain('Ver la reserva');
    });
  });
});
