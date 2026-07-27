import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { ActivatedRoute, convertToParamMap } from '@angular/router';
import { RouterTestingModule } from '@angular/router/testing';
import { ReservaEstado, VerticalKey } from 'shared';
import { MiViajeComponent } from './mi-viaje.component';
import { ReservaApi, ReservasService } from '../services/reservas.service';

const reserva = (extra: Partial<ReservaApi> = {}): ReservaApi => ({
  _id: 'r1', codigo: 'RES-AAAA1111', vertical: VerticalKey.ALOJAMIENTO,
  servicioId: 's1', comercioId: 'c1',
  montoSubtotal: 100, comisionMonto: 15, descuentoMonto: 0, montoTotal: 121, moneda: 'EUR',
  fechaInicio: '2026-09-01T10:00:00.000Z', cantidad: 1,
  estado: ReservaEstado.CONFIRMADA, servicioTitulo: 'Residencia Royal',
  ...extra,
});

describe('MiViajeComponent', () => {
  let fixture: ComponentFixture<MiViajeComponent>;
  let componente: MiViajeComponent;
  let reservasService: jest.Mocked<Pick<ReservasService, 'viaje' | 'cancelar'>>;

  const crear = async (reservas: ReservaApi[]): Promise<void> => {
    reservasService = {
      viaje: jest.fn().mockResolvedValue(reservas),
      cancelar: jest.fn().mockResolvedValue(undefined),
    };

    await TestBed.configureTestingModule({
      imports: [MiViajeComponent, RouterTestingModule],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: ReservasService, useValue: reservasService },
        { provide: ActivatedRoute, useValue: { snapshot: { paramMap: convertToParamMap({ reservaMadreId: 'r1' }) } } },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(MiViajeComponent);
    componente = fixture.componentInstance;
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  };

  it('debería mostrar todos los servicios del viaje', async () => {
    await crear([reserva(), reserva({ _id: 'r2', codigo: 'RES-BBBB2222', vertical: VerticalKey.PELUQUERIA })]);

    expect(componente.reservas()).toHaveLength(2);
    expect(fixture.nativeElement.querySelectorAll('.mv-item')).toHaveLength(2);
  });

  it('debería sumar solo lo que sigue activo, no lo cancelado', async () => {
    await crear([
      reserva(),
      reserva({ _id: 'r2', codigo: 'RES-BBBB2222', estado: ReservaEstado.CANCELADA, montoTotal: 50 }),
    ]);

    expect(componente.totalConfirmado()).toBe(121);
  });

  it('debería cancelar un solo servicio sin tocar el resto del viaje', async () => {
    const otra = reserva({ _id: 'r2', codigo: 'RES-BBBB2222', vertical: VerticalKey.PELUQUERIA });
    await crear([reserva(), otra]);

    await componente.cancelar(otra);

    expect(reservasService.cancelar).toHaveBeenCalledWith('r2');
    expect(componente.reservas()[0].estado).toBe(ReservaEstado.CONFIRMADA);
    expect(componente.reservas()[1].estado).toBe(ReservaEstado.CANCELADA);
  });

  it('no debería ofrecer cancelar lo que ya está cancelado o completado', async () => {
    await crear([reserva({ estado: ReservaEstado.CANCELADA })]);

    expect(componente.puedeCancelar(componente.reservas()[0])).toBe(false);
    expect(componente.puedeCancelar(reserva({ estado: ReservaEstado.COMPLETADA }))).toBe(false);
    expect(componente.puedeCancelar(reserva({ estado: ReservaEstado.CONFIRMADA }))).toBe(true);
  });

  it('debería traducir cada estado a un texto y un tono legibles', async () => {
    await crear([reserva({ estado: ReservaEstado.AJUSTE_SOLICITADO })]);

    expect(componente.etiquetaEstado(componente.reservas()[0])).toBe('Cambio de importe pendiente');
    expect(componente.tono(componente.reservas()[0])).toBe('aviso');
  });

  it('debería avisar si el viaje no se puede cargar', async () => {
    reservasService = {
      viaje: jest.fn().mockRejectedValue(new Error('caído')),
      cancelar: jest.fn(),
    };
    await TestBed.configureTestingModule({
      imports: [MiViajeComponent, RouterTestingModule],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: ReservasService, useValue: reservasService },
        { provide: ActivatedRoute, useValue: { snapshot: { paramMap: convertToParamMap({ reservaMadreId: 'r1' }) } } },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(MiViajeComponent);
    componente = fixture.componentInstance;
    fixture.detectChanges();
    await fixture.whenStable();

    expect(componente.error()).toContain('No se pudo cargar');
  });
});
