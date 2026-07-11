import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { ComercioReservasComponent } from './comercio-reservas.component';
import { ComercioApiService, MiReserva } from './comercio-api.service';

describe('ComercioReservasComponent', () => {
  let fixture: ComponentFixture<ComercioReservasComponent>;
  let component: ComercioReservasComponent;
  let comercioApi: jest.Mocked<ComercioApiService>;

  const reservaConfirmada: MiReserva = {
    _id: 'res-1', codigo: 'RES-A1', vertical: 'alojamiento', montoTotal: 70,
    estado: 'confirmada', fechaInicio: '2026-08-01T00:00:00.000Z', createdAt: '2026-07-01T00:00:00.000Z',
  };

  beforeEach(async () => {
    comercioApi = {
      getMisReservas: jest.fn().mockReturnValue(of([reservaConfirmada])),
      completarReserva: jest.fn().mockReturnValue(of({ ...reservaConfirmada, estado: 'completada' })),
    } as unknown as jest.Mocked<ComercioApiService>;

    await TestBed.configureTestingModule({
      imports: [ComercioReservasComponent],
      providers: [{ provide: ComercioApiService, useValue: comercioApi }],
    }).compileComponents();

    fixture = TestBed.createComponent(ComercioReservasComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
    await fixture.whenStable();
  });

  it('debería cargar las reservas del comercio', () => {
    expect(component.reservas().length).toBe(1);
  });

  it('debería marcar una reserva confirmada como completada', async () => {
    await component.completar(reservaConfirmada);

    expect(comercioApi.completarReserva).toHaveBeenCalledWith('res-1');
    expect(component.reservas()[0].estado).toBe('completada');
    expect(component.completandoId()).toBeNull();
  });

  it('debería mostrar un error si falla la llamada al completar', async () => {
    comercioApi.completarReserva.mockReturnValue(throwError(() => new Error('fallo')));

    await component.completar(reservaConfirmada);

    expect(component.errorMsg()).toContain('No se pudo marcar');
  });
});
