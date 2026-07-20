import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { ComercioReservasComponent } from './comercio-reservas.component';
import { ComercioApiService, MiReserva } from './comercio-api.service';
import { PerrosService, HistoriaCompartidaApi } from '../perros/perros.service';

describe('ComercioReservasComponent', () => {
  let fixture: ComponentFixture<ComercioReservasComponent>;
  let component: ComercioReservasComponent;
  let comercioApi: jest.Mocked<ComercioApiService>;
  let perrosService: jest.Mocked<PerrosService>;

  const reservaConfirmada: MiReserva = {
    _id: 'res-1', codigo: 'RES-A1', vertical: 'alojamiento', montoTotal: 70,
    estado: 'confirmada', fechaInicio: '2026-08-01T00:00:00.000Z', createdAt: '2026-07-01T00:00:00.000Z',
  };

  const reservaVeterinaria: MiReserva = {
    _id: 'res-2', codigo: 'RES-V1', vertical: 'veterinaria', montoTotal: 40, perroId: 'perro-1',
    estado: 'completada', fechaInicio: '2026-08-01T00:00:00.000Z', createdAt: '2026-07-01T00:00:00.000Z',
  };

  beforeEach(async () => {
    comercioApi = {
      getMisReservas: jest.fn().mockReturnValue(of([reservaConfirmada])),
      completarReserva: jest.fn().mockReturnValue(of({ ...reservaConfirmada, estado: 'completada' })),
      getMisSuplementos: jest.fn().mockReturnValue(of([])),
      solicitarAjuste: jest.fn(),
    } as unknown as jest.Mocked<ComercioApiService>;

    perrosService = { crearValoracion: jest.fn(), historiaVeterinaria: jest.fn() } as unknown as jest.Mocked<PerrosService>;

    await TestBed.configureTestingModule({
      imports: [ComercioReservasComponent],
      providers: [
        { provide: ComercioApiService, useValue: comercioApi },
        { provide: PerrosService, useValue: perrosService },
      ],
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

  describe('toggleHistoriaVeterinaria', () => {
    const historiaMock: HistoriaCompartidaApi = {
      nombre: 'Nala', especie: 'perro', esterilizado: true,
      vacunas: ['rabia'], alergias: [], enfermedades: [], medicacion: [], certificadosUrl: [], historial: [],
    };

    it('debería cargar y mostrar la historia veterinaria compartida', async () => {
      perrosService.historiaVeterinaria.mockResolvedValue(historiaMock);

      await component.toggleHistoriaVeterinaria(reservaVeterinaria);

      expect(perrosService.historiaVeterinaria).toHaveBeenCalledWith('perro-1');
      expect(component.historiaVeterinaria()).toEqual(historiaMock);
      expect(component.historiaAbiertaId()).toBe('res-2');
    });

    it('debería cerrar el panel si ya estaba abierto para esa reserva', async () => {
      perrosService.historiaVeterinaria.mockResolvedValue(historiaMock);
      await component.toggleHistoriaVeterinaria(reservaVeterinaria);

      await component.toggleHistoriaVeterinaria(reservaVeterinaria);

      expect(component.historiaAbiertaId()).toBeNull();
    });

    it('debería mostrar un error si el propietario no autorizó compartir el historial', async () => {
      perrosService.historiaVeterinaria.mockRejectedValue(new Error('403'));

      await component.toggleHistoriaVeterinaria(reservaVeterinaria);

      expect(component.errorHistoria()).toContain('No se pudo cargar');
    });
  });
});
