import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { of, throwError } from 'rxjs';
import { ConfirmacionEntrega, HitoViaje, PersonaContactoViaje } from 'shared';
import { environment } from '../../../../environments/environment';
import { ComercioApiService, MiReserva } from '../comercio-api.service';
import { GestionViajeComponent } from './gestion-viaje.component';

const reserva = (extra: Partial<MiReserva> = {}): MiReserva => ({
  _id: 'r1', codigo: 'RES-T1', vertical: 'transporte', montoTotal: 80, estado: 'confirmada',
  fechaInicio: '2026-10-01T08:00:00.000Z', createdAt: '2026-09-20T00:00:00.000Z',
  ...extra,
});

type GeolocalizacionFalsa = {
  watchPosition: jest.Mock;
  clearWatch: jest.Mock;
};

const posicion = (lat: number, lng: number, heading: number | null = 90): GeolocationPosition => ({
  coords: { latitude: lat, longitude: lng, accuracy: 8, heading, altitude: null, altitudeAccuracy: null, speed: null },
  timestamp: 0,
} as unknown as GeolocationPosition);

describe('GestionViajeComponent', () => {
  let fixture: ComponentFixture<GestionViajeComponent>;
  let componente: GestionViajeComponent;
  let api: jest.Mocked<Pick<ComercioApiService, 'resolverAceptacion' | 'marcarSeguimiento' | 'enviarPosicion'>>;
  let http: HttpTestingController;
  let geo: GeolocalizacionFalsa;
  let emitidas: MiReserva[];
  const geoOriginal = Object.getOwnPropertyDescriptor(navigator, 'geolocation');

  const crear = async (datos: MiReserva = reserva()): Promise<void> => {
    await TestBed.configureTestingModule({
      imports: [GestionViajeComponent],
      providers: [provideHttpClient(), provideHttpClientTesting(), { provide: ComercioApiService, useValue: api }],
    }).compileComponents();
    http = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(GestionViajeComponent);
    componente = fixture.componentInstance;
    fixture.componentRef.setInput('reserva', datos);
    emitidas = [];
    componente.actualizada.subscribe((r) => emitidas.push(r));
    fixture.detectChanges();
  };

  beforeEach(() => {
    api = {
      resolverAceptacion: jest.fn().mockReturnValue(of(reserva({ estado: 'confirmada' }))),
      marcarSeguimiento: jest.fn().mockReturnValue(of(reserva())),
      enviarPosicion: jest.fn().mockReturnValue(of({ ok: true })),
    };
    geo = { watchPosition: jest.fn().mockReturnValue(7), clearWatch: jest.fn() };
    Object.defineProperty(navigator, 'geolocation', { value: geo, configurable: true });
  });

  afterEach(() => {
    // Se destruye antes de devolver la geolocalización real: al destruirse deja de vigilar.
    fixture?.destroy();
    if (geoOriginal) Object.defineProperty(navigator, 'geolocation', geoOriginal);
    else delete (navigator as unknown as Record<string, unknown>)['geolocation'];
    jest.restoreAllMocks();
  });

  describe('aceptación', () => {
    const pendiente = reserva({ aceptacion: { requerida: true, estado: 'pendiente', plazoMin: 30, venceEn: '2026-10-01T07:30:00.000Z' } });

    it('debería pedir aceptar el viaje antes de ofrecer los hitos', async () => {
      await crear(pendiente);

      expect(componente.pendienteDeAceptar()).toBe(true);
      expect(fixture.nativeElement.querySelector('.gv__aceptar')).not.toBeNull();
      expect(fixture.nativeElement.querySelector('.gv__hitos')).toBeNull();
    });

    it('debería aceptar con la hora confirmada y emitir la reserva actualizada', async () => {
      await crear(pendiente);
      componente.horaConfirmada.set('09:15');
      componente.motivo.set('no debería ir');

      await componente.resolver('aceptar');

      expect(api.resolverAceptacion).toHaveBeenCalledWith('r1', { decision: 'aceptar', horaConfirmada: '09:15', motivo: undefined });
      expect(emitidas).toHaveLength(1);
      expect(componente.ocupado()).toBe(false);
    });

    it('debería rechazar con su motivo y sin hora', async () => {
      await crear(pendiente);
      componente.motivo.set('Sin vehículo');

      await componente.resolver('rechazar');

      expect(api.resolverAceptacion).toHaveBeenCalledWith('r1', { decision: 'rechazar', horaConfirmada: undefined, motivo: 'Sin vehículo' });
    });

    it('debería enseñar el error si no se puede aceptar', async () => {
      await crear(pendiente);
      api.resolverAceptacion.mockReturnValue(throwError(() => new Error('500')));

      await componente.resolver('aceptar');

      expect(componente.error()).toBeTruthy();
      expect(emitidas).toHaveLength(0);
      expect(componente.ocupado()).toBe(false);
    });
  });

  describe('hitos', () => {
    it('debería proponer el siguiente hito sin marcar, entendiendo el hito antiguo en_ruta', async () => {
      await crear(reserva({
        seguimiento: [
          { hito: 'asignado', at: 'x' }, { hito: 'de_camino', at: 'x' }, { hito: 'recogida', at: 'x' }, { hito: 'en_ruta', at: 'x' },
        ],
      }));

      expect(componente.marcados().has(HitoViaje.EN_TRAYECTO)).toBe(true);
      expect(componente.siguienteHito()).toBe(HitoViaje.ENTREGADA);
      const botones = Array.from(fixture.nativeElement.querySelectorAll('.gv__hitos button')) as HTMLButtonElement[];
      expect(botones).toHaveLength(6);
      expect(botones.filter((b) => b.disabled)).toHaveLength(4);
    });

    it('no debería ofrecer hitos si la reserva no está en servicio', async () => {
      await crear(reserva({ estado: 'completada' }));
      expect(fixture.nativeElement.querySelector('.gv__hitos')).toBeNull();
    });

    it('debería marcar un hito y emitir el resultado', async () => {
      await crear();

      await componente.marcar(HitoViaje.DE_CAMINO);

      expect(api.marcarSeguimiento).toHaveBeenCalledWith('r1', HitoViaje.DE_CAMINO, undefined, undefined);
      expect(emitidas).toHaveLength(1);
    });

    it('debería mandar la foto sólo con la entrega y dejar de compartir la ubicación', async () => {
      await crear();
      componente.fotoUrl.set('https://f/entrega.jpg');
      componente.alternarUbicacion();

      await componente.marcar(HitoViaje.ENTREGADA);

      expect(api.marcarSeguimiento).toHaveBeenCalledWith('r1', HitoViaje.ENTREGADA, undefined, 'https://f/entrega.jpg');
      expect(geo.clearWatch).toHaveBeenCalledWith(7);
      expect(componente.compartiendo()).toBe(false);
    });

    it('debería avisar si el hito no se registra', async () => {
      await crear();
      api.marcarSeguimiento.mockReturnValue(throwError(() => new Error('500')));

      await componente.marcar(HitoViaje.RECOGIDA);

      expect(componente.error()).toBeTruthy();
    });

    it('debería dar etiqueta e icono a cada hito', async () => {
      await crear();
      expect(componente.etiquetaHito(HitoViaje.RECOGIDA)).toBe('Mascota recogida');
      expect(componente.iconoHito(HitoViaje.EN_TRAYECTO)).toBe('truck');
    });
  });

  describe('datos de entrega', () => {
    it('debería pintar el resumen y los contactos de recogida y entrega', async () => {
      await crear(reserva({
        detalle: {
          resumen: [['Origen', 'Madrid'], ['Destino', 'Toledo']],
          entrega: {
            recogida: { quien: PersonaContactoViaje.YO, telefono: '600000000', complementoDireccion: '2º B' },
            entrega: { quien: PersonaContactoViaje.OTRA, nombre: 'Luis', indicaciones: 'Timbre roto' },
          },
        },
      }));

      expect(componente.resumen()).toHaveLength(2);
      expect(componente.contactos().map((c) => c.titulo)).toEqual(['Entrega la mascota', 'Recibe la mascota']);
      const texto = fixture.nativeElement.textContent as string;
      expect(texto).toContain('Luis');
      expect(texto).toContain('Yo');
      expect(texto).toContain('Timbre roto');
      expect(componente.etiquetaQuien(undefined)).toBe('');
    });

    it('no debería pintar resumen ni contactos si el detalle no los trae', async () => {
      await crear(reserva({ detalle: { resumen: 'raro' } }));

      expect(componente.resumen()).toEqual([]);
      expect(componente.contactos()).toEqual([]);
    });
  });

  describe('foto de la entrega', () => {
    const conFoto = reserva({ detalle: { entrega: { confirmacionEntrega: ConfirmacionEntrega.NOTIFICACION_Y_FOTO } } });
    const eventoCon = (archivo?: File): Event => ({ target: { files: archivo ? [archivo] : [] } } as unknown as Event);

    it('debería pedir la foto si el cliente la quiso y la entrega no está marcada', async () => {
      await crear(conFoto);
      expect(componente.pideFoto()).toBe(true);
      expect(fixture.nativeElement.querySelector('.gv__foto input[type="file"]')).not.toBeNull();
    });

    it('debería subir la foto y guardarla para la entrega', async () => {
      await crear(conFoto);

      const subida = componente.subirFoto(eventoCon(new File(['x'], 'f.jpg', { type: 'image/jpeg' })));
      const req = http.expectOne(`${environment.apiUrl}/upload/image`);
      expect(req.request.body instanceof FormData).toBe(true);
      req.flush({ url: 'https://f/nueva.jpg' });
      await subida;

      expect(componente.fotoUrl()).toBe('https://f/nueva.jpg');
      expect(componente.ocupado()).toBe(false);
    });

    it('debería avisar si la foto no se sube', async () => {
      await crear(conFoto);

      const subida = componente.subirFoto(eventoCon(new File(['x'], 'f.jpg')));
      http.expectOne(`${environment.apiUrl}/upload/image`).flush('fallo', { status: 500, statusText: 'Error' });
      await subida;

      expect(componente.fotoUrl()).toBeNull();
      expect(componente.error()).toBeTruthy();
    });

    it('no debería hacer nada sin archivo', async () => {
      await crear(conFoto);
      await componente.subirFoto(eventoCon());
      http.expectNone(`${environment.apiUrl}/upload/image`);
    });
  });

  describe('ubicación en vivo', () => {
    it('debería vigilar la posición y enviarla con precisión y rumbo', async () => {
      await crear();

      componente.alternarUbicacion();
      const alMoverse = geo.watchPosition.mock.calls[0][0] as (p: GeolocationPosition) => void;
      alMoverse(posicion(40.4, -3.7));

      expect(componente.compartiendo()).toBe(true);
      expect(api.enviarPosicion).toHaveBeenCalledWith('r1', { lat: 40.4, lng: -3.7, precision: 8, rumbo: 90 });
    });

    it('debería espaciar los envíos al menos 15 segundos', async () => {
      await crear();
      const ahora = jest.spyOn(Date, 'now').mockReturnValue(100_000);
      componente.alternarUbicacion();
      const alMoverse = geo.watchPosition.mock.calls[0][0] as (p: GeolocationPosition) => void;

      alMoverse(posicion(1, 1));
      ahora.mockReturnValue(110_000);
      alMoverse(posicion(2, 2));
      expect(api.enviarPosicion).toHaveBeenCalledTimes(1);

      ahora.mockReturnValue(116_000);
      alMoverse(posicion(3, 3, null));
      expect(api.enviarPosicion).toHaveBeenCalledTimes(2);
      expect(api.enviarPosicion).toHaveBeenLastCalledWith('r1', { lat: 3, lng: 3, precision: 8, rumbo: undefined });
    });

    it('debería dejar de compartir si el envío falla', async () => {
      await crear();
      api.enviarPosicion.mockReturnValue(throwError(() => new Error('500')));
      componente.alternarUbicacion();

      (geo.watchPosition.mock.calls[0][0] as (p: GeolocationPosition) => void)(posicion(1, 1));

      expect(geo.clearWatch).toHaveBeenCalledWith(7);
      expect(componente.compartiendo()).toBe(false);
    });

    it('debería avisar si no hay permiso de ubicación', async () => {
      await crear();
      componente.alternarUbicacion();

      (geo.watchPosition.mock.calls[0][1] as () => void)();

      expect(componente.error()).toContain('permiso');
      expect(componente.compartiendo()).toBe(false);
    });

    it('debería parar al volver a pulsar y al destruir la pantalla', async () => {
      await crear();
      componente.alternarUbicacion();
      componente.alternarUbicacion();
      expect(geo.clearWatch).toHaveBeenCalledTimes(1);

      componente.alternarUbicacion();
      fixture.destroy();
      expect(geo.clearWatch).toHaveBeenCalledTimes(2);
    });

    it('debería avisar si el dispositivo no tiene geolocalización', async () => {
      Object.defineProperty(navigator, 'geolocation', { value: undefined, configurable: true });
      await crear();

      componente.alternarUbicacion();

      expect(componente.error()).toContain('no permite compartir');
      expect(componente.compartiendo()).toBe(false);
    });

    it('no debería ofrecer compartir la ubicación una vez entregada la mascota', async () => {
      await crear(reserva({ seguimiento: [{ hito: 'entregada', at: 'x' }] }));
      expect(componente.admiteUbicacion()).toBe(false);
    });
  });
});
