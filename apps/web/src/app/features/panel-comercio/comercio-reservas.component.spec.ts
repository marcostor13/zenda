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

    it('no debería consultar nada en una reserva sin perro asociado', async () => {
      await component.toggleHistoriaVeterinaria(reservaConfirmada);

      expect(perrosService.historiaVeterinaria).not.toHaveBeenCalled();
      expect(component.historiaAbiertaId()).toBeNull();
    });
  });

  describe('filtros', () => {
    it('debería mostrar todas las reservas por defecto', () => {
      expect(component.reservasFiltradas()).toHaveLength(1);
      expect(component.contarEstado('todas')).toBe(1);
    });

    it('debería filtrar por estado', () => {
      component.filtroActivo.set('completada');

      expect(component.reservasFiltradas()).toHaveLength(0);
      expect(component.contarEstado('confirmada')).toBe(1);
    });
  });

  describe('solicitud de ajuste', () => {
    const suplemento = { _id: 'sup1', concepto: 'Paseo extra', monto: 10, activo: true };

    beforeEach(() => component.suplementosCatalogo.set([suplemento as never]));

    it('debería abrir y cerrar el panel de la reserva', () => {
      component.toggleAjuste('res-1');
      expect(component.ajusteAbiertoId()).toBe('res-1');

      component.toggleAjuste('res-1');
      expect(component.ajusteAbiertoId()).toBeNull();
    });

    it('debería limpiar la selección anterior al cambiar de reserva', () => {
      component.toggleAjuste('res-1');
      component.toggleSuplemento('sup1');
      component.evidenciaUrl = '/foto.jpg';

      component.toggleAjuste('res-2');

      // Arrastrar suplementos entre reservas cobraría de más a quien no toca.
      expect(component.seleccionados().size).toBe(0);
      expect(component.evidenciaUrl).toBe('');
    });

    it('debería sumar solo los suplementos marcados', () => {
      component.suplementosCatalogo.set([
        suplemento as never,
        { _id: 'sup2', concepto: 'Baño', monto: 25, activo: true } as never,
      ]);

      component.toggleSuplemento('sup1');
      expect(component.totalSuplementoSeleccionado()).toBe(10);

      component.toggleSuplemento('sup2');
      expect(component.totalSuplementoSeleccionado()).toBe(35);

      component.toggleSuplemento('sup1');
      expect(component.totalSuplementoSeleccionado()).toBe(25);
    });

    it('no debería enviar un ajuste vacío', async () => {
      await component.enviarAjuste(reservaConfirmada);

      expect(comercioApi.solicitarAjuste).not.toHaveBeenCalled();
    });

    it('debería enviar concepto e importe de cada suplemento', async () => {
      comercioApi.solicitarAjuste.mockReturnValue(
        of({ ...reservaConfirmada, estado: 'ajuste_solicitado' } as MiReserva),
      );
      component.toggleAjuste('res-1');
      component.toggleSuplemento('sup1');
      component.evidenciaUrl = '/foto.jpg';

      await component.enviarAjuste(reservaConfirmada);

      expect(comercioApi.solicitarAjuste).toHaveBeenCalledWith('res-1', {
        suplementos: [{ concepto: 'Paseo extra', monto: 10 }],
        evidenciaUrl: '/foto.jpg',
      });
      expect(component.reservas()[0].estado).toBe('ajuste_solicitado');
      expect(component.ajusteAbiertoId()).toBeNull();
    });

    it('debería avisar si el ajuste no se puede enviar', async () => {
      comercioApi.solicitarAjuste.mockReturnValue(throwError(() => new Error('500')));
      component.toggleSuplemento('sup1');

      await component.enviarAjuste(reservaConfirmada);

      expect(component.errorMsg()).toContain('No se pudo enviar');
      expect(component.enviandoAjuste()).toBe(false);
    });
  });

  describe('valoración del perro', () => {
    it('debería abrir el panel con los valores por defecto', () => {
      component.comentarioValoracion = 'anterior';

      component.toggleValorar('res-2');

      expect(component.valorarAbiertoId()).toBe('res-2');
      expect(component.puntuacionValoracion()).toBe(5);
      expect(component.comentarioValoracion).toBe('');
    });

    it('debería publicar la valoración del perro atendido', async () => {
      perrosService.crearValoracion.mockResolvedValue(undefined as never);
      component.toggleValorar('res-2');
      component.puntuacionValoracion.set(4);
      component.comentarioValoracion = 'Muy tranquilo';
      component.nivelDoogking = 3;

      await component.enviarValoracion(reservaVeterinaria);

      expect(perrosService.crearValoracion).toHaveBeenCalledWith('perro-1', {
        reservaId: 'res-2', puntuacion: 4, comentario: 'Muy tranquilo',
        atributos: { nivelDoogking: 3 },
      });
      expect(component.valoradoId().has('res-2')).toBe(true);
      expect(component.valorarAbiertoId()).toBeNull();
    });

    it('debería omitir los atributos opcionales no rellenados', async () => {
      perrosService.crearValoracion.mockResolvedValue(undefined as never);
      component.toggleValorar('res-2');

      await component.enviarValoracion(reservaVeterinaria);

      const payload = perrosService.crearValoracion.mock.calls[0][1];
      expect(payload.comentario).toBeUndefined();
      expect(payload.atributos).toBeUndefined();
    });

    it('no debería valorar una reserva sin perro asociado', async () => {
      await component.enviarValoracion(reservaConfirmada);

      expect(perrosService.crearValoracion).not.toHaveBeenCalled();
    });

    it('debería avisar si la valoración no se publica', async () => {
      perrosService.crearValoracion.mockRejectedValue(new Error('500'));

      await component.enviarValoracion(reservaVeterinaria);

      expect(component.errorMsg()).toContain('No se pudo publicar');
      expect(component.enviandoValoracion()).toBe(false);
    });
  });

  describe('seguimiento en tiempo real', () => {
    it('debería ofrecer los hitos propios del transporte', () => {
      const hitos = component.hitosDe('transporte').map((h) => h.hito);

      expect(hitos).toEqual(['recogida', 'en_ruta', 'entregada', 'finalizada']);
    });

    it('debería ofrecer entrada y salida en estancias', () => {
      expect(component.hitosDe('alojamiento').map((h) => h.hito)).toEqual(['entrada', 'salida', 'finalizada']);
      expect(component.hitosDe('hoteles')).toHaveLength(3);
    });

    it('no debería ofrecer hitos en los verticales de cita', () => {
      expect(component.hitosDe('veterinaria')).toEqual([]);
    });

    it('debería registrar el hito y reflejar el nuevo estado', async () => {
      comercioApi.marcarSeguimiento = jest.fn().mockReturnValue(of({ ...reservaConfirmada, estado: 'en_curso' }));

      await component.marcarHito(reservaConfirmada, 'entrada');

      expect(comercioApi.marcarSeguimiento).toHaveBeenCalledWith('res-1', 'entrada');
      expect(component.reservas()[0].estado).toBe('en_curso');
      expect(component.seguimientoId()).toBeNull();
    });

    it('debería avisar si el hito no se registra', async () => {
      comercioApi.marcarSeguimiento = jest.fn().mockReturnValue(throwError(() => new Error('500')));

      await component.marcarHito(reservaConfirmada, 'entrada');

      expect(component.errorMsg()).toContain('No se pudo registrar');
    });
  });

  describe('etiquetas', () => {
    it('debería dar un icono por vertical con respaldo genérico', () => {
      expect(component.iconVertical('alojamiento')).toBeTruthy();
      expect(component.iconVertical('inventado')).toBe('building');
    });

    it('debería dar un badge por estado con respaldo neutro', () => {
      expect(component.badgeEstado('confirmada')).toContain('rs-badge--');
      expect(component.badgeEstado('inventado')).toContain('neutral');
    });
  });
});
