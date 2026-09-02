import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { RouterTestingModule } from '@angular/router/testing';
import { ActivatedRoute, convertToParamMap } from '@angular/router';
import { MisReservasComponent } from './mis-reservas.component';
import { ReservasService, ReservaApi } from '../services/reservas.service';
import { ReviewsService } from '../services/reviews.service';
import { AlojamientoService } from '../../alojamiento/services/alojamiento.service';
import { AuthService } from '../../../core/auth/auth.service';
import { PagoEnCursoService } from '../services/pago-en-curso.service';

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
      esCliente: () => true,
      clienteVerificado: () => false,
    };

    await TestBed.configureTestingModule({
      imports: [MisReservasComponent, RouterTestingModule],
      providers: [
        // La cabecera lleva el selector de región, que consulta tipos de cambio.
        provideHttpClient(),
        provideHttpClientTesting(),
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

  describe('filtros', () => {
    it('debería mostrar todas las reservas por defecto', () => {
      expect(component.reservasFiltradas()).toHaveLength(2);
      expect(component.conteo('todas')).toBe(2);
    });

    it('debería filtrar por estado y contar cada uno', () => {
      component.filtroActivo.set('completada');

      expect(component.reservasFiltradas()).toHaveLength(1);
      expect(component.conteo('confirmada')).toBe(1);
      expect(component.conteo('cancelada')).toBe(0);
    });
  });

  describe('etiquetas de estado', () => {
    it('debería dar texto y color a cada estado', () => {
      expect(component.estadoLabel('confirmada')).toContain('Confirmada');
      expect(component.estadoLabel('ajuste_solicitado')).toContain('Ajuste');
      expect(component.estadoBadge('completada')).toContain('accent');
      expect(component.estadoBadge('cancelada')).toContain('danger');
    });

    it('debería mostrar tal cual un estado desconocido', () => {
      expect(component.estadoLabel('inventado')).toBe('inventado');
      expect(component.estadoBadge('inventado')).toBe('');
    });
  });

  describe('tarjetas por vertical', () => {
    /** Reconstruye el listado con una reserva concreta para inspeccionar su tarjeta. */
    const conReserva = async (extra: Partial<ReservaApi>) => {
      reservasService.misReservas.mockResolvedValue([{ ...reservaConfirmada, ...extra } as ReservaApi]);
      await component.ngOnInit();
      return component.reservas()[0];
    };

    it('debería contar los perros en una estancia', async () => {
      const card = await conReserva({ vertical: 'alojamiento', cantidad: 2 });

      expect(card.subtitulo).toBe('2 perros');
      expect(card.icono).toBe('home');
    });

    it('debería mostrar el trayecto del transporte', async () => {
      const card = await conReserva({
        vertical: 'transporte', detalle: { origen: 'Madrid', destino: 'Toledo' },
      });

      expect(card.subtitulo).toBe('Madrid → Toledo');
    });

    it('debería tolerar un transporte sin origen ni destino', async () => {
      const card = await conReserva({ vertical: 'transporte', detalle: {} });

      expect(card.subtitulo).toBe('Trayecto');
    });

    it('debería mostrar la hora de la cita', async () => {
      const card = await conReserva({ vertical: 'veterinaria', detalle: { hora: '10:30' } });

      expect(card.subtitulo).toBe('Cita · 10:30');
    });

    it('debería distinguir programa de sesión en adiestramiento', async () => {
      expect((await conReserva({ vertical: 'adiestramiento', detalle: { modalidad: 'programa' } })).subtitulo)
        .toBe('Programa completo');
      expect((await conReserva({ vertical: 'adiestramiento', detalle: {} })).subtitulo).toBe('Sesión');
    });

    it('debería contar mascotas en un hotel', async () => {
      const card = await conReserva({ vertical: 'hoteles', cantidad: 1 });

      expect(card.subtitulo).toBe('1 mascota');
      expect(card.icono).toBe('hotel');
    });

    it('debería tolerar un vertical desconocido', async () => {
      const card = await conReserva({ vertical: 'inventado', cantidad: 3 });

      expect(card.vertical).toBe('inventado');
      expect(card.icono).toBe('paw');
      expect(card.subtitulo).toBe('3 unidades');
    });

    it('debería tratar como pendiente un estado que no reconoce', async () => {
      const card = await conReserva({ estado: 'inventado' as ReservaApi['estado'] });

      // Mejor mostrarla como pendiente que ocultarla del listado.
      expect(card.estado).toBe('pendiente');
    });

    it('debería usar el título y la imagen del detalle si el servicio no se puede leer', async () => {
      const card = await conReserva({ detalle: { titulo: 'Villa Perruna', imagen: '/villa.jpg' } });

      expect(card.titulo).toBe('Villa Perruna');
      expect(card.imagen).toBe('/villa.jpg');
    });

    it('debería mostrar el nombre de la mascota de la reserva', async () => {
      const card = await conReserva({ perroSnapshot: { nombre: 'Maya' } });

      expect(card.mascota).toBe('Maya');
    });

    it('debería dejar la fecha tal cual si no es una fecha válida', async () => {
      const card = await conReserva({ fechaInicio: 'sin-fecha' });

      expect(card.fechaInicio).toBe('sin-fecha');
    });
  });

  describe('estado del panel de reseña', () => {
    it('debería cerrar el panel sin publicar nada', () => {
      component.abrirResena('res-2');

      component.cerrarResena();

      expect(component.resenandoId()).toBeNull();
      expect(reviewsService.crear).not.toHaveBeenCalled();
    });

    it('debería avisar si la reseña no se puede publicar', async () => {
      reviewsService.crear.mockRejectedValue(new Error('500'));
      const reserva = component.reservas().find((r) => r.codigo === 'RES-COMP02')!;
      component.abrirResena(reserva.id);
      component.comentarioCtrl.setValue('Muy buen servicio con mi perro');

      await component.enviarResena(reserva);

      expect(component.errorResena()).toContain('No se pudo publicar');
      expect(component.enviandoResena()).toBe(false);
    });

    it('debería marcar como ya reseñadas las reservas con reseña previa', async () => {
      reviewsService.misResenas.mockResolvedValue([{ reservaId: 'res-2' }] as never);

      await component.ngOnInit();

      expect(component.reservas().find((r) => r.codigo === 'RES-COMP02')?.yaResenada).toBe(true);
    });
  });

  describe('cancelación', () => {
    it('debería avisar si la cancelación falla', async () => {
      jest.spyOn(window, 'confirm').mockReturnValue(true);
      const alerta = jest.spyOn(window, 'alert').mockImplementation(() => undefined);
      reservasService.cancelar.mockRejectedValue(new Error('500'));
      const reserva = component.reservas().find((r) => r.codigo === 'RES-CONF01')!;

      await component.cancelar(reserva);

      expect(alerta).toHaveBeenCalled();
      expect(component.cancelandoId()).toBeNull();
    });
  });

  describe('línea temporal (HU-9.4)', () => {
    it('debería señalar el pago como el paso en curso de una reserva pendiente', () => {
      // El primer hito es el pago y no se da por hecho hasta que lo está: antes
      // daba «Reserva realizada» por cumplida sin haber cobrado nada.
      const reserva = component.reservas().find((r) => r.codigo === 'RES-CONF01')!;
      reserva.estado = 'pendiente';

      const pasos = component.pasosTimeline(reserva);

      expect(pasos[0]).toEqual({ label: 'Pago', hecho: false, actual: true });
      expect(pasos[1]).toEqual({ label: 'Confirmada', hecho: false, actual: false });
    });

    it('debería marcar todos los pasos hechos para una reserva completada y ya valorada', () => {
      const reserva = component.reservas().find((r) => r.codigo === 'RES-COMP02')!;
      reserva.yaResenada = true;

      const pasos = component.pasosTimeline(reserva);

      expect(pasos.every((p) => p.hecho)).toBe(true);
    });

    it('debería marcar "Valorada" como paso actual en una reserva completada sin reseñar', () => {
      const reserva = component.reservas().find((r) => r.codigo === 'RES-COMP02')!;
      reserva.yaResenada = false;

      const pasos = component.pasosTimeline(reserva);

      expect(pasos[3]).toEqual({ label: 'Valorada', hecho: false, actual: true });
    });
  });

  describe('acciones rápidas (HU-9.3)', () => {
    it('debería abrir Google Maps con el nombre y la ciudad del establecimiento', () => {
      const reserva = component.reservas().find((r) => r.codigo === 'RES-CONF01')!;
      reserva.ciudad = 'Madrid';
      const openSpy = jest.spyOn(window, 'open').mockImplementation(() => null);

      component.comoLlegar(reserva);

      expect(openSpy).toHaveBeenCalledWith(
        expect.stringContaining('google.com/maps/search'),
        '_blank',
        'noopener',
      );
    });

    it('debería generar un archivo .ics descargable para añadir al calendario', () => {
      const reserva = component.reservas().find((r) => r.codigo === 'RES-CONF01')!;
      const clickSpy = jest.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => undefined);
      const createObjectURL = jest.fn().mockReturnValue('blob:mock');
      (URL as unknown as { createObjectURL: typeof createObjectURL }).createObjectURL = createObjectURL;
      (URL as unknown as { revokeObjectURL: () => void }).revokeObjectURL = jest.fn();

      component.anadirACalendario(reserva);

      expect(createObjectURL).toHaveBeenCalled();
      expect(clickSpy).toHaveBeenCalled();
    });

    it('debería compartir con la Web Share API cuando está disponible', async () => {
      const reserva = component.reservas().find((r) => r.codigo === 'RES-CONF01')!;
      const share = jest.fn().mockResolvedValue(undefined);
      (navigator as unknown as { share: typeof share }).share = share;

      await component.compartir(reserva);

      expect(share).toHaveBeenCalledWith(expect.objectContaining({ title: 'Doogking' }));
    });

    it('debería copiar al portapapeles si no hay Web Share API', async () => {
      const reserva = component.reservas().find((r) => r.codigo === 'RES-CONF01')!;
      delete (navigator as unknown as { share?: unknown }).share;
      const writeText = jest.fn().mockResolvedValue(undefined);
      Object.assign(navigator, { clipboard: { writeText } });

      await component.compartir(reserva);

      expect(writeText).toHaveBeenCalledWith(expect.stringContaining('RES-CONF01'));
    });
  });
  describe('estado de una reserva sin pagar', () => {
    const sinPagar = {
      _id: 'res-3', codigo: 'RES-PEND03', vertical: 'alojamiento', servicioId: 'serv-3',
      comercioId: 'com-3', montoSubtotal: 50, comisionMonto: 7.5, descuentoMonto: 0,
      montoTotal: 60, moneda: 'EUR', fechaInicio: '2026-10-01T00:00:00.000Z',
      cantidad: 1, estado: 'pendiente',
    } as ReservaApi;

    it('debería decir de qué está pendiente', () => {
      // «Pendiente» a secas no distinguía una reserva que espera al comercio de
      // una que se dejó a medias en el pago, que es lo que significa el estado.
      expect(component.estadoLabel('pendiente')).toBe('Pendiente de pago');
    });

    it('no debería dar el pago por hecho mientras no se haya cobrado', async () => {
      reservasService.misReservas.mockResolvedValue([sinPagar]);
      await component.ngOnInit();
      const reserva = component.reservas().find((r) => r.codigo === 'RES-PEND03')!;

      const [pago, confirmada] = component.pasosTimeline(reserva);

      expect(pago).toEqual({ label: 'Pago', hecho: false, actual: true });
      expect(confirmada.hecho).toBe(false);
    });

    it('debería dar por hecho el pago de una reserva confirmada', () => {
      const reserva = component.reservas().find((r) => r.codigo === 'RES-CONF01')!;

      const [pago] = component.pasosTimeline(reserva);

      expect(pago).toEqual({ label: 'Pago', hecho: true, actual: false });
    });

    it('debería dejar cancelar una reserva que se quedó sin pagar', async () => {
      // Es la salida del cliente que abandonó el pago: sin ella la reserva se
      // queda en el listado para siempre.
      reservasService.misReservas.mockResolvedValue([sinPagar]);
      await component.ngOnInit();
      jest.spyOn(window, 'confirm').mockReturnValue(true);
      const reserva = component.reservas().find((r) => r.codigo === 'RES-PEND03')!;

      await component.cancelar(reserva);

      expect(reservasService.cancelar).toHaveBeenCalledWith('res-3');
    });
  });

  describe('recordatorio de qué llevar (HU-9.7)', () => {
    it('debería ofrecerlo en una estancia confirmada', () => {
      const reserva = component.reservas().find((r) => r.codigo === 'RES-CONF01')!;

      expect(component.necesitaChecklist(reserva)).toBe(true);
    });

    it('no debería ofrecerlo en una reserva sin pagar', () => {
      // Decirle a alguien qué meter en la bolsa da por hecha una estancia que
      // todavía no está cobrada.
      const reserva = component.reservas().find((r) => r.codigo === 'RES-CONF01')!;
      reserva.estado = 'pendiente';

      expect(component.necesitaChecklist(reserva)).toBe(false);
    });

    it('no debería ofrecerlo en una categoría que no es de estancia', () => {
      const reserva = component.reservas().find((r) => r.codigo === 'RES-COMP02')!;

      expect(component.necesitaChecklist(reserva)).toBe(false);
    });
  });

  /**
   * El API tiene más estados de los que esta pantalla distingue, y el fallback
   * era «pendiente» para todo lo desconocido: a quien ya había pagado se le
   * decía que no había pagado.
   */
  describe('estados operativos del API', () => {
    const conEstado = async (estado: string) => {
      reservasService.misReservas.mockResolvedValue([{ ...reservaConfirmada, estado } as ReservaApi]);
      await component.ngOnInit();
      return component.reservas()[0];
    };

    it('debería enseñar «En revisión» una reserva cobrada que se quedó sin plaza', async () => {
      const reserva = await conEstado('en_disputa');

      expect(reserva.estado).toBe('en_disputa');
      expect(component.estadoLabel('en_disputa')).toBe('En revisión');
      expect(component.estadoBadge('en_disputa')).toBe('rs-badge--warning');
    });

    it('debería dar el pago por hecho en una reserva en revisión', async () => {
      const reserva = await conEstado('en_disputa');

      const [pago, confirmada] = component.pasosTimeline(reserva);

      expect(pago.hecho).toBe(true);
      expect(confirmada).toEqual({ label: 'Confirmada', hecho: false, actual: true });
    });

    it('debería tratar como confirmadas las reservas ya cobradas', async () => {
      expect((await conEstado('en_curso')).estado).toBe('confirmada');
      expect((await conEstado('pago_retenido')).estado).toBe('confirmada');
    });

    it('debería tratar como completadas las que ya se liquidaron o no se presentaron', async () => {
      expect((await conEstado('pago_liberado')).estado).toBe('completada');
      expect((await conEstado('no_show')).estado).toBe('completada');
    });

    it('debería tratar un reembolso como una cancelación', async () => {
      expect((await conEstado('reembolsada')).estado).toBe('cancelada');
    });

    it('debería caer en pendiente sólo ante un estado que no existe', async () => {
      expect((await conEstado('inventado')).estado).toBe('pendiente');
    });

    it('debería ofrecer el filtro de las reservas en revisión', () => {
      expect(component.filtros.map((f) => f.valor)).toContain('en_disputa');
    });
  });

  /**
   * Es la pantalla a la que Stripe devuelve al cliente tras autenticar la
   * tarjeta: si no se cerrara el cobro aquí, la reserva recién pagada se
   * enseñaría como «pendiente» hasta que llegara el webhook, que es justo
   * cuando el cliente teme haber perdido el dinero.
   */
  describe('vuelta del pago', () => {
    const montarConPagoPendiente = async (
      pendiente: string | null,
      cerrado: boolean,
      queryParams: Record<string, string> = {},
    ): Promise<{ cerrarPendiente: jest.Mock }> => {
      const pagoEnCurso = {
        pendiente: jest.fn().mockReturnValue(pendiente),
        cerrarPendiente: jest.fn().mockResolvedValue(cerrado),
        anotar: jest.fn(),
        olvidar: jest.fn(),
        sincronizar: jest.fn(),
      };

      TestBed.resetTestingModule();
      await TestBed.configureTestingModule({
        imports: [MisReservasComponent, RouterTestingModule],
        providers: [
          provideHttpClient(),
          provideHttpClientTesting(),
          { provide: ReservasService, useValue: reservasService },
          { provide: ReviewsService, useValue: reviewsService },
          { provide: AlojamientoService, useValue: { obtener: jest.fn().mockRejectedValue(new Error('n/a')) } },
          { provide: AuthService, useValue: { usuario: () => ({ id: 'user-1' }), estaAutenticado: () => true, esAdmin: () => false, esComercio: () => false, esCliente: () => true, clienteVerificado: () => false } },
          { provide: PagoEnCursoService, useValue: pagoEnCurso },
          { provide: ActivatedRoute, useValue: { snapshot: { queryParamMap: convertToParamMap(queryParams) } } },
        ],
      }).compileComponents();

      fixture = TestBed.createComponent(MisReservasComponent);
      component = fixture.componentInstance;
      fixture.detectChanges();
      await fixture.whenStable();
      fixture.detectChanges();

      return pagoEnCurso;
    };

    it('debería cerrar contra el servidor el pago que quedó a medias', async () => {
      const pagoEnCurso = await montarConPagoPendiente('pago-1', true);

      expect(pagoEnCurso.cerrarPendiente).toHaveBeenCalled();
      expect(component.confirmacionPendiente()).toBe(false);
    });

    it('debería avisar de que la confirmación va con retraso si el servidor no la cierra', async () => {
      await montarConPagoPendiente('pago-1', false);

      expect(component.confirmacionPendiente()).toBe(true);
      expect((fixture.nativeElement as HTMLElement).textContent)
        .toContain('Estamos terminando de confirmar la reserva');
    });

    it('debería avisar también cuando lo dice quien nos ha traído aquí', async () => {
      // El pago del viaje ya consultó al servidor y navega con la marca puesta.
      await montarConPagoPendiente(null, false, { confirmacionPendiente: '1' });

      expect(component.confirmacionPendiente()).toBe(true);
    });

    it('no debería llamar al servidor cuando no se viene de pagar', async () => {
      const pagoEnCurso = await montarConPagoPendiente(null, false);

      expect(pagoEnCurso.cerrarPendiente).not.toHaveBeenCalled();
      expect(component.confirmacionPendiente()).toBe(false);
    });
  });
});
