import { ComponentFixture, TestBed } from '@angular/core/testing';
import { RouterTestingModule } from '@angular/router/testing';
import { MisReservasComponent } from './mis-reservas.component';
import { ReservasService, ReservaApi } from '../services/reservas.service';
import { ReviewsService } from '../services/reviews.service';
import { AlojamientoService } from '../../alojamiento/services/alojamiento.service';
import { AuthService } from '../../../core/auth/auth.service';

describe('MisReservasComponent', () => {
  let fixture: ComponentFixture<MisReservasComponent>;
  let component: MisReservasComponent;
  let reservasService: jest.Mocked<ReservasService>;
  let reviewsService: jest.Mocked<ReviewsService>;

  const reservaConfirmada: ReservaApi = {
    _id: 'res-1', codigo: 'RES-CONF01', vertical: 'alojamiento', servicioId: 'serv-1', comercioId: 'com-1',
    montoSubtotal: 60, comisionMonto: 9, descuentoMonto: 0, montoTotal: 70, moneda: 'EUR',
    fechaInicio: '2026-08-01T00:00:00.000Z', cantidad: 1, estado: 'confirmada',
  };

  const reservaCompletada: ReservaApi = {
    _id: 'res-2', codigo: 'RES-COMP02', vertical: 'peluqueria', servicioId: 'serv-2', comercioId: 'com-2',
    montoSubtotal: 30, comisionMonto: 4.5, descuentoMonto: 0, montoTotal: 35, moneda: 'EUR',
    fechaInicio: '2026-06-01T00:00:00.000Z', cantidad: 1, estado: 'completada',
  };

  beforeEach(async () => {
    reservasService = {
      misReservas: jest.fn().mockResolvedValue([reservaConfirmada, reservaCompletada]),
      cancelar: jest.fn().mockResolvedValue({}),
    } as unknown as jest.Mocked<ReservasService>;

    reviewsService = {
      misResenas: jest.fn().mockResolvedValue([]),
      crear: jest.fn().mockResolvedValue({}),
    } as unknown as jest.Mocked<ReviewsService>;

    const alojamientoService = { obtener: jest.fn().mockRejectedValue(new Error('n/a')) };
    const auth = {
      usuario: () => ({ id: 'user-1' }),
      estaAutenticado: () => true,
      esAdmin: () => false,
      esComercio: () => false,
    };

    await TestBed.configureTestingModule({
      imports: [MisReservasComponent, RouterTestingModule],
      providers: [
        { provide: ReservasService, useValue: reservasService },
        { provide: ReviewsService, useValue: reviewsService },
        { provide: AlojamientoService, useValue: alojamientoService },
        { provide: AuthService, useValue: auth },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(MisReservasComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
    await fixture.whenStable();
  });

  it('debería cargar las reservas del usuario desde la API', () => {
    expect(component.reservas().length).toBe(2);
  });

  it('debería cancelar una reserva confirmada y reflejar el nuevo estado', async () => {
    jest.spyOn(window, 'confirm').mockReturnValue(true);
    const reserva = component.reservas().find((r) => r.codigo === 'RES-CONF01')!;

    await component.cancelar(reserva);

    expect(reservasService.cancelar).toHaveBeenCalledWith('res-1');
    expect(component.reservas().find((r) => r.codigo === 'RES-CONF01')?.estado).toBe('cancelada');
  });

  it('no debería cancelar si el usuario no confirma el diálogo', async () => {
    jest.spyOn(window, 'confirm').mockReturnValue(false);
    const reserva = component.reservas().find((r) => r.codigo === 'RES-CONF01')!;

    await component.cancelar(reserva);

    expect(reservasService.cancelar).not.toHaveBeenCalled();
  });

  it('debería publicar una reseña para una reserva completada', async () => {
    const reserva = component.reservas().find((r) => r.codigo === 'RES-COMP02')!;
    component.abrirResena(reserva.id);
    component.puntuacionSel.set(4);
    component.comentarioCtrl.setValue('Muy buen servicio con mi perro');

    await component.enviarResena(reserva);

    expect(reviewsService.crear).toHaveBeenCalledWith({
      reservaId: 'res-2', puntuacion: 4, comentario: 'Muy buen servicio con mi perro',
    });
    expect(component.reservas().find((r) => r.codigo === 'RES-COMP02')?.yaResenada).toBe(true);
    expect(component.resenandoId()).toBeNull();
  });

  it('debería mostrar un error si el comentario de la reseña es muy corto', async () => {
    const reserva = component.reservas().find((r) => r.codigo === 'RES-COMP02')!;
    component.abrirResena(reserva.id);
    component.comentarioCtrl.setValue('ok');

    await component.enviarResena(reserva);

    expect(reviewsService.crear).not.toHaveBeenCalled();
    expect(component.errorResena()).toContain('al menos 3 caracteres');
  });
});
