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
      expect(component.iconVertical('inventado')).toBe('paw');
    });

    it('debería dar un badge por estado con respaldo neutro', () => {
      expect(component.badgeEstado('confirmada')).toContain('rs-badge--');
      expect(component.badgeEstado('inventado')).toContain('neutral');
    });
  });

  // ── Funcionalidad del Informe Gerencial (Ref. N5, VET5, ADI3/ADI5, ADI4) ──

  describe('resumen automático del perro (Ref. N5)', () => {
    const conSnapshot = (snapshot: Record<string, unknown>): MiReserva =>
      ({ ...reservaConfirmada, perroSnapshot: snapshot });

    it('no debería mostrar nada si la reserva no trae ficha del perro', () => {
      expect(component.resumenPerro(reservaConfirmada)).toEqual([]);
    });

    it('debería resumir alergias, miedos y medicación con su detalle', () => {
      const chips = component.resumenPerro(conSnapshot({
        alergias: ['pollo', 'polen'], miedos: ['secador'], medicacion: ['apoquel'],
      }));

      expect(chips).toContain('Alergias: pollo, polen');
      expect(chips).toContain('Miedos: secador');
      expect(chips).toContain('Medicación: apoquel');
    });

    it('debería avisar de las conductas relevantes para el servicio', () => {
      const chips = component.resumenPerro(conSnapshot({
        ansiedadSeparacion: true, protectorRecursos: true, reactividadCorrea: true,
        destructivoEnSoledad: true, orinaEnInterior: true,
      }));

      expect(chips).toHaveLength(5);
      expect(chips.join(' ')).toContain('Ansiedad por separación');
      expect(chips.join(' ')).toContain('Protector de recursos');
    });

    it('debería destacar lo que importa al transportista (Ref. TRA2)', () => {
      const chips = component.resumenPerro(conSnapshot({ seMarea: true, requiereTransportin: true }));

      expect(chips).toContain('Se marea en viajes');
      expect(chips).toContain('Requiere transportín');
    });

    it('no debería inventar avisos con una ficha sin nada reseñable', () => {
      expect(component.resumenPerro(conSnapshot({ alergias: [], miedos: [], seMarea: false }))).toEqual([]);
    });
  });

  describe('vídeos del comportamiento (Ref. ADI3)', () => {
    it('debería devolver las URLs subidas al reservar', () => {
      const r = { ...reservaConfirmada, detalle: { videosUrl: ['http://x/1.mp4'] } };

      expect(component.videosDe(r)).toEqual(['http://x/1.mp4']);
    });

    it('debería devolver lista vacía si la reserva no trae vídeos', () => {
      expect(component.videosDe(reservaConfirmada)).toEqual([]);
    });

    it('no debería romperse si el detalle trae algo que no es una lista', () => {
      const r = { ...reservaConfirmada, detalle: { videosUrl: 'no-es-una-lista' } };

      expect(component.videosDe(r)).toEqual([]);
    });
  });

  describe('seguimiento estructurado de adiestramiento (Ref. ADI5)', () => {
    const reservaAdi: MiReserva = {
      ...reservaConfirmada, _id: 'res-adi', vertical: 'adiestramiento', perroId: 'perro-1',
    };

    beforeEach(() => {
      perrosService.agregarHistorial = jest.fn().mockResolvedValue({ _id: 'h1' });
    });

    it('debería abrir y cerrar el panel del seguimiento', () => {
      component.toggleSeguimientoAdiestramiento('res-adi');
      expect(component.seguimientoAbiertoId()).toBe('res-adi');

      component.toggleSeguimientoAdiestramiento('res-adi');
      expect(component.seguimientoAbiertoId()).toBeNull();
    });

    it('debería limpiar los campos al abrir el panel de otra reserva', () => {
      component.seguimientoObjetivos.set('lo de antes');
      component.toggleSeguimientoAdiestramiento('otra');

      expect(component.seguimientoObjetivos()).toBe('');
    });

    it('no debería dejar guardar un seguimiento completamente vacío', () => {
      expect(component.puedeGuardarSeguimiento()).toBe(false);

      component.seguimientoObjetivos.set('   ');
      expect(component.puedeGuardarSeguimiento()).toBe(false);

      component.seguimientoObjetivos.set('Llamada');
      expect(component.puedeGuardarSeguimiento()).toBe(true);
    });

    it('debería guardar objetivos, evolución y tareas como datos estructurados', () => {
      // El valor de ADI5 es justamente que no sea texto libre.
      component.seguimientoObjetivos.set('Llamada a distancia');
      component.seguimientoEvolucion.set('Responde al 70 %');
      component.seguimientoTareas.set('10 min diarios');

      return component.guardarSeguimientoAdiestramiento(reservaAdi).then(() => {
        const [perroId, payload] = (perrosService.agregarHistorial as jest.Mock).mock.calls[0];
        expect(perroId).toBe('perro-1');
        expect(payload.vertical).toBe('adiestramiento');
        expect(payload.reservaId).toBe('res-adi');
        expect(payload.datosEstructurados).toEqual({
          objetivos: 'Llamada a distancia',
          evolucion: 'Responde al 70 %',
          tareasCasa: '10 min diarios',
        });
      });
    });

    it('debería omitir del guardado los campos que se dejaron en blanco', async () => {
      component.seguimientoObjetivos.set('Solo objetivos');

      await component.guardarSeguimientoAdiestramiento(reservaAdi);

      const payload = (perrosService.agregarHistorial as jest.Mock).mock.calls[0][1];
      expect(payload.datosEstructurados.evolucion).toBeUndefined();
      expect(payload.datosEstructurados.tareasCasa).toBeUndefined();
    });

    it('no debería llamar al API si la reserva no tiene perro asociado', async () => {
      component.seguimientoObjetivos.set('X');

      await component.guardarSeguimientoAdiestramiento({ ...reservaAdi, perroId: undefined });

      expect(perrosService.agregarHistorial).not.toHaveBeenCalled();
    });

    it('debería avisar sin romperse si el guardado falla', async () => {
      perrosService.agregarHistorial = jest.fn().mockRejectedValue(new Error('500'));
      component.seguimientoObjetivos.set('X');

      await component.guardarSeguimientoAdiestramiento(reservaAdi);

      expect(component.mensajeSeguimiento()).toContain('No se pudo');
      expect(component.guardandoSeguimiento()).toBe(false);
    });
  });

  describe('plan personalizado de adiestramiento (Ref. ADI4)', () => {
    const reservaAdi: MiReserva = {
      ...reservaConfirmada, _id: 'res-adi', vertical: 'adiestramiento', estado: 'confirmada',
    };

    it('no debería considerar válido un plan sin nombre o sin precio', () => {
      expect(component.planValido()).toBe(false);

      component.planNombre = 'Bono 5 sesiones';
      expect(component.planValido()).toBe(false);

      component.planPrecio = 0;
      expect(component.planValido()).toBe(false);

      component.planPrecio = 200;
      expect(component.planValido()).toBe(true);
    });

    it('debería permitir enviar el ajuste solo con el plan, sin suplementos marcados', () => {
      expect(component.puedeEnviarAjuste()).toBe(false);

      component.planNombre = 'Bono';
      component.planPrecio = 150;
      expect(component.puedeEnviarAjuste()).toBe(true);
    });

    it('debería enviar el plan como un suplemento con su concepto compuesto', async () => {
      // ADI4 reutiliza el ciclo de ajuste ya probado en vez de un flujo de pago nuevo.
      comercioApi.solicitarAjuste = jest.fn().mockReturnValue(of(reservaAdi));
      component.planNombre = 'Modificación de conducta';
      component.planSesiones = 5;
      component.planPrecio = 250;

      await component.enviarAjuste(reservaAdi);

      const payload = (comercioApi.solicitarAjuste as jest.Mock).mock.calls[0][1];
      expect(payload.suplementos).toHaveLength(1);
      expect(payload.suplementos[0].concepto).toContain('Modificación de conducta');
      expect(payload.suplementos[0].concepto).toContain('5 sesiones');
      expect(payload.suplementos[0].monto).toBe(250);
    });

    it('debería describirlo como programa si no se indica número de sesiones', async () => {
      comercioApi.solicitarAjuste = jest.fn().mockReturnValue(of(reservaAdi));
      component.planNombre = 'Curso intensivo';
      component.planPrecio = 400;

      await component.enviarAjuste(reservaAdi);

      const payload = (comercioApi.solicitarAjuste as jest.Mock).mock.calls[0][1];
      expect(payload.suplementos[0].concepto).toContain('programa');
    });

    it('debería limpiar el plan al cerrar el panel de ajuste', () => {
      component.planNombre = 'Bono';
      component.planSesiones = 3;
      component.planPrecio = 100;

      component.cerrarAjuste();

      expect(component.planNombre).toBe('');
      expect(component.planSesiones).toBeNull();
      expect(component.planPrecio).toBeNull();
    });
  });

  describe('importación de historial clínico (Ref. VET5)', () => {
    beforeEach(() => {
      perrosService.previsualizarImportacion = jest.fn().mockResolvedValue([
        { fecha: '12/03/2026', concepto: 'Vacuna rabia', detalle: 'Refuerzo' },
      ]);
      perrosService.importarHistorial = jest.fn().mockResolvedValue({ importadas: 1 });
      perrosService.historiaVeterinaria = jest.fn().mockResolvedValue(
        { nombre: 'Nala', historial: [] } as unknown as HistoriaCompartidaApi,
      );
    });

    it('no debería previsualizar sin panel abierto ni texto pegado', async () => {
      await component.previsualizarImportacion();

      expect(perrosService.previsualizarImportacion).not.toHaveBeenCalled();
    });

    it('debería convertir el texto pegado en filas revisables', async () => {
      await component.toggleHistoriaVeterinaria(reservaVeterinaria);
      component.textoImportar.set('12/03/2026\tVacuna rabia\tRefuerzo');

      await component.previsualizarImportacion();

      expect(component.filasImportar()).toHaveLength(1);
      expect(component.filasImportar()[0].concepto).toBe('Vacuna rabia');
    });

    it('debería avisar si no se reconoce ninguna fila', async () => {
      perrosService.previsualizarImportacion = jest.fn().mockResolvedValue([]);
      await component.toggleHistoriaVeterinaria(reservaVeterinaria);
      component.textoImportar.set('texto sin formato');

      await component.previsualizarImportacion();

      expect(component.mensajeImportacion()).toContain('No se reconoció');
    });

    it('debería permitir descartar una fila antes de guardar', async () => {
      await component.toggleHistoriaVeterinaria(reservaVeterinaria);
      component.filasImportar.set([{ concepto: 'A' }, { concepto: 'B' }]);

      component.quitarFilaImportar(0);

      expect(component.filasImportar()).toEqual([{ concepto: 'B' }]);
    });

    it('debería guardar las filas revisadas y limpiar el formulario', async () => {
      await component.toggleHistoriaVeterinaria(reservaVeterinaria);
      component.filasImportar.set([{ concepto: 'Vacuna rabia' }]);

      await component.importarHistorial(reservaVeterinaria);

      expect(perrosService.importarHistorial).toHaveBeenCalledWith(
        'res-2', 'veterinaria', [{ concepto: 'Vacuna rabia' }],
      );
      expect(component.filasImportar()).toEqual([]);
      expect(component.mensajeImportacion()).toContain('1 fila');
    });

    it('no debería guardar si no hay filas revisadas', async () => {
      await component.toggleHistoriaVeterinaria(reservaVeterinaria);

      await component.importarHistorial(reservaVeterinaria);

      expect(perrosService.importarHistorial).not.toHaveBeenCalled();
    });

    it('debería avisar sin romperse si el guardado falla', async () => {
      perrosService.importarHistorial = jest.fn().mockRejectedValue(new Error('500'));
      await component.toggleHistoriaVeterinaria(reservaVeterinaria);
      component.filasImportar.set([{ concepto: 'X' }]);

      await component.importarHistorial(reservaVeterinaria);

      expect(component.mensajeImportacion()).toContain('No se pudo');
      expect(component.importandoHistorial()).toBe(false);
    });

    it('debería limpiar la importación al abrir la historia de otra reserva', async () => {
      await component.toggleHistoriaVeterinaria(reservaVeterinaria);
      component.textoImportar.set('algo');
      component.filasImportar.set([{ concepto: 'X' }]);

      component.historiaAbiertaId.set(null);
      await component.toggleHistoriaVeterinaria(reservaVeterinaria);

      expect(component.textoImportar()).toBe('');
      expect(component.filasImportar()).toEqual([]);
    });
  });

  describe('filtros de la agenda', () => {
    /** Reserva situada en el día indicado, con fin opcional para estancias. */
    const enFecha = (id: string, inicio: string, fin?: string): MiReserva => ({
      ...reservaConfirmada, _id: id, codigo: id, fechaInicio: inicio, fechaFin: fin,
    });

    const hoyIso = () => new Date().toISOString();
    const diasDesdeHoy = (dias: number) => {
      const d = new Date();
      d.setDate(d.getDate() + dias);
      return d.toISOString();
    };

    it('debería alternar la vista de hoy al pulsarla dos veces', () => {
      component.verHoy();
      expect(component.periodo()).toBe('hoy');

      component.verHoy();
      expect(component.periodo()).toBe('todas');
    });

    it('debería deseleccionar el día del calendario al cambiar a la vista de hoy', () => {
      component.diaSeleccionado.set('2026-08-01');

      component.verHoy();

      expect(component.diaSeleccionado()).toBeNull();
    });

    it('debería alternar el filtro de pendientes', () => {
      component.verPendientes();
      expect(component.filtroActivo()).toBe('pendiente');

      component.verPendientes();
      expect(component.filtroActivo()).toBe('todas');
    });

    it('debería devolver todos los filtros a su estado inicial', () => {
      component.filtroActivo.set('pendiente');
      component.busqueda.set('nala');
      component.periodo.set('mes');
      component.desde.set('2026-08-01');
      component.hasta.set('2026-08-31');
      component.servicioFiltro.set('Suite');
      component.diaSeleccionado.set('2026-08-05');

      component.limpiarFiltros();

      expect(component.filtroActivo()).toBe('todas');
      expect(component.busqueda()).toBe('');
      expect(component.periodo()).toBe('todas');
      expect(component.desde()).toBe('');
      expect(component.hasta()).toBe('');
      expect(component.servicioFiltro()).toBe('');
      expect(component.diaSeleccionado()).toBeNull();
    });

    it('debería navegar entre meses hacia delante y hacia atrás', () => {
      component.mes.set(new Date(2026, 7, 1));

      component.cambiarMes(1);
      expect(component.mes().getMonth()).toBe(8);

      component.cambiarMes(-2);
      expect(component.mes().getMonth()).toBe(6);
    });

    it('debería cruzar bien el cambio de año al retroceder desde enero', () => {
      component.mes.set(new Date(2026, 0, 1));

      component.cambiarMes(-1);

      expect(component.mes().getFullYear()).toBe(2025);
      expect(component.mes().getMonth()).toBe(11);
    });

    it('debería alternar el día seleccionado del calendario', () => {
      component.seleccionarDia('2026-08-05');
      expect(component.diaSeleccionado()).toBe('2026-08-05');

      component.seleccionarDia('2026-08-05');
      expect(component.diaSeleccionado()).toBeNull();
    });

    it('debería filtrar por el periodo de hoy incluyendo estancias en curso', async () => {
      // Una estancia ocupa todos sus días, no solo el de entrada: una reserva
      // que empezó ayer y acaba mañana tiene que salir en la vista de hoy.
      comercioApi.getMisReservas.mockReturnValue(of([
        enFecha('en-curso', diasDesdeHoy(-1), diasDesdeHoy(1)),
        enFecha('lejana', diasDesdeHoy(30)),
      ]));
      await component.ngOnInit();
      component.periodo.set('hoy');

      const codigos = component.reservasFiltradas().map((r) => r._id);
      expect(codigos).toContain('en-curso');
      expect(codigos).not.toContain('lejana');
    });

    it('debería filtrar por un rango de fechas indicado a mano', async () => {
      comercioApi.getMisReservas.mockReturnValue(of([
        enFecha('dentro', diasDesdeHoy(2)),
        enFecha('fuera', diasDesdeHoy(40)),
      ]));
      await component.ngOnInit();
      component.periodo.set('rango');
      component.desde.set(new Date().toISOString().slice(0, 10));
      component.hasta.set(diasDesdeHoy(7).slice(0, 10));

      const codigos = component.reservasFiltradas().map((r) => r._id);
      expect(codigos).toContain('dentro');
      expect(codigos).not.toContain('fuera');
    });

    it('no debería filtrar nada si se elige rango pero no se ponen fechas', async () => {
      comercioApi.getMisReservas.mockReturnValue(of([enFecha('a', hoyIso()), enFecha('b', diasDesdeHoy(60))]));
      await component.ngOnInit();
      component.periodo.set('rango');

      expect(component.reservasFiltradas()).toHaveLength(2);
    });
  });

  describe('incidencias', () => {
    it('debería abrir el panel limpiando lo escrito antes', () => {
      component.incidenciaAsunto.set('viejo');
      component.incidenciaDescripcion.set('descripción anterior');

      component.toggleIncidencia('res-1');

      expect(component.incidenciaAbiertaId()).toBe('res-1');
      expect(component.incidenciaTipo()).toBe('incidencia');
      expect(component.incidenciaAsunto()).toBe('');
      expect(component.incidenciaDescripcion()).toBe('');
    });

    it('debería cerrarse al pulsarlo de nuevo', () => {
      component.toggleIncidencia('res-1');
      component.toggleIncidencia('res-1');

      expect(component.incidenciaAbiertaId()).toBeNull();
    });

    it('debería exigir asunto y una descripción con fondo antes de enviar', () => {
      // El backend lo rechazaría igualmente: mejor avisar antes de la llamada.
      expect(component.puedeEnviarIncidencia()).toBe(false);

      component.incidenciaAsunto.set('ab');
      component.incidenciaDescripcion.set('descripción larga suficiente');
      expect(component.puedeEnviarIncidencia()).toBe(false);

      component.incidenciaAsunto.set('Problema');
      component.incidenciaDescripcion.set('corta');
      expect(component.puedeEnviarIncidencia()).toBe(false);

      component.incidenciaDescripcion.set('descripción larga suficiente');
      expect(component.puedeEnviarIncidencia()).toBe(true);
    });

    it('debería cerrar el panel de incidencia', () => {
      component.toggleIncidencia('res-1');

      component.cerrarIncidencia();

      expect(component.incidenciaAbiertaId()).toBeNull();
    });
  });

  describe('detalle y gestión', () => {
    it('debería alternar el detalle de una reserva', () => {
      component.toggleDetalle('res-1');
      expect(component.detalleAbiertoId()).toBe('res-1');

      component.toggleDetalle('res-1');
      expect(component.detalleAbiertoId()).toBeNull();
    });

    it('debería alternar el panel de gestión', () => {
      component.toggleGestion('res-1');
      expect(component.gestionAbiertaId()).toBe('res-1');

      component.toggleGestion('res-1');
      expect(component.gestionAbiertaId()).toBeNull();
    });
  });
});
