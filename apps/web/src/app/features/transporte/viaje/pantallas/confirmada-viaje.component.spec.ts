import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { ReservaEstado, VerticalKey } from 'shared';
import * as ics from '../../../../shared/calendario/descargar-ics';
import { ReservaApi, ReservasService } from '../../../reservas/services/reservas.service';
import { PagoEnCursoService } from '../../../reservas/services/pago-en-curso.service';
import { TransporteViajeApi } from '../transporte-viaje.api';
import { ConfirmadaViajeComponent } from './confirmada-viaje.component';

jest.mock('../../../../shared/calendario/descargar-ics', () => ({
  ...jest.requireActual('../../../../shared/calendario/descargar-ics'),
  descargarIcs: jest.fn(),
}));

const reserva = (extra: Partial<ReservaApi> = {}): ReservaApi => ({
  _id: 'r1', codigo: 'RES-T1', vertical: VerticalKey.TRANSPORTE, servicioId: 's1', comercioId: 'c1',
  montoSubtotal: 66, comisionMonto: 10, descuentoMonto: 0, montoTotal: 80, moneda: 'EUR',
  fechaInicio: '2026-10-01T08:00:00.000Z', cantidad: 1, estado: ReservaEstado.CONFIRMADA,
  createdAt: '2026-09-20T00:00:00.000Z',
  detalle: {
    origen: 'Calle Mayor 1, Madrid',
    solicitud: { origen: { texto: 'Calle Mayor 1, Madrid' }, destino: { texto: 'Plaza Zocodover, Toledo' } },
  },
  ...extra,
});

describe('ConfirmadaViajeComponent', () => {
  let fixture: ComponentFixture<ConfirmadaViajeComponent>;
  let componente: ConfirmadaViajeComponent;
  let reservas: jest.Mocked<Pick<ReservasService, 'obtenerPorCodigo'>>;
  let pagoEnCurso: jest.Mocked<Pick<PagoEnCursoService, 'cerrarPendiente'>>;

  const crear = async (): Promise<void> => {
    await TestBed.configureTestingModule({
      imports: [ConfirmadaViajeComponent],
      providers: [
        provideRouter([]), provideHttpClient(), provideHttpClientTesting(),
        { provide: ReservasService, useValue: reservas },
        { provide: PagoEnCursoService, useValue: pagoEnCurso },
        { provide: TransporteViajeApi, useValue: { contacto: jest.fn().mockResolvedValue(null), ubicacion: jest.fn() } },
        { provide: ActivatedRoute, useValue: { snapshot: { paramMap: convertToParamMap({ codigo: 'RES-T1' }) } } },
      ],
    }).compileComponents();
    fixture = TestBed.createComponent(ConfirmadaViajeComponent);
    componente = fixture.componentInstance;
  };

  beforeEach(() => {
    reservas = { obtenerPorCodigo: jest.fn().mockResolvedValue(reserva()) };
    pagoEnCurso = { cerrarPendiente: jest.fn().mockResolvedValue(undefined) };
  });

  afterEach(() => {
    fixture?.destroy();
    jest.useRealTimers();
    jest.clearAllMocks();
  });

  it('debería cerrar el pago en curso y enseñar la reserva confirmada', async () => {
    await crear();
    await componente.ngOnInit();
    fixture.detectChanges();

    expect(pagoEnCurso.cerrarPendiente).toHaveBeenCalled();
    expect(reservas.obtenerPorCodigo).toHaveBeenCalledTimes(1);
    expect(componente.pendiente()).toBe(false);
    expect(componente.titulo()).toBe('¡Tu reserva está confirmada!');
    expect(componente.ruta()).toBe('Calle Mayor 1 → Plaza Zocodover');
    expect(fixture.nativeElement.querySelector('.cv__codigo').textContent).toContain('RES-T1');
    expect(fixture.nativeElement.querySelector('app-seguimiento-viaje')).not.toBeNull();
  });

  it('debería reintentar mientras la reserva siga pendiente del webhook', async () => {
    jest.useFakeTimers();
    reservas.obtenerPorCodigo
      .mockResolvedValueOnce(reserva({ estado: ReservaEstado.PENDIENTE }))
      .mockResolvedValueOnce(reserva({ estado: ReservaEstado.PENDIENTE }))
      .mockResolvedValue(reserva());
    await crear();

    const carga = componente.ngOnInit();
    await jest.advanceTimersByTimeAsync(2500);
    await jest.advanceTimersByTimeAsync(2500);
    await carga;

    expect(reservas.obtenerPorCodigo).toHaveBeenCalledTimes(3);
    expect(componente.cargando()).toBe(false);
    expect(componente.pendiente()).toBe(false);
  });

  it('debería rendirse tras cuatro intentos y dar la reserva por recibida', async () => {
    jest.useFakeTimers();
    reservas.obtenerPorCodigo.mockResolvedValue(reserva({ estado: ReservaEstado.PENDIENTE }));
    await crear();

    const carga = componente.ngOnInit();
    await jest.advanceTimersByTimeAsync(10_000);
    await carga;

    expect(reservas.obtenerPorCodigo).toHaveBeenCalledTimes(4);
    expect(componente.pendiente()).toBe(true);
    expect(componente.titulo()).toBe('¡Reserva recibida!');
  });

  it('debería esperar al transportista si el viaje necesita su aceptación', async () => {
    reservas.obtenerPorCodigo.mockResolvedValue(reserva({
      aceptacion: { requerida: true, estado: 'pendiente', plazoMin: 30 },
    }));
    await crear();
    await componente.ngOnInit();

    expect(componente.pendiente()).toBe(true);
    expect(componente.subtitulo()).toContain('tiene que confirmar');
  });

  it('debería avisar si no encuentra la reserva', async () => {
    reservas.obtenerPorCodigo.mockRejectedValue(new Error('404'));
    await crear();
    await componente.ngOnInit();
    fixture.detectChanges();

    expect(componente.reserva()).toBeNull();
    expect(componente.ruta()).toBe('');
    expect(fixture.nativeElement.textContent).toContain('No encontramos esta reserva');
  });

  it('debería añadir el viaje al calendario', async () => {
    await crear();
    await componente.ngOnInit();

    componente.calendario(componente.reserva() as ReservaApi);

    expect(ics.descargarIcs).toHaveBeenCalledWith({
      uid: 'RES-T1',
      titulo: 'Transporte de mascota · Calle Mayor 1 → Plaza Zocodover',
      inicio: new Date('2026-10-01T08:00:00.000Z'),
      lugar: 'Calle Mayor 1, Madrid',
      descripcion: 'Reserva RES-T1',
    });
  });

  it('debería dejar el lugar vacío si la reserva no lo trae', async () => {
    reservas.obtenerPorCodigo.mockResolvedValue(reserva({ detalle: {} }));
    await crear();
    await componente.ngOnInit();

    componente.calendario(componente.reserva() as ReservaApi);

    expect(ics.descargarIcs).toHaveBeenCalledWith(expect.objectContaining({ lugar: '' }));
  });
});
