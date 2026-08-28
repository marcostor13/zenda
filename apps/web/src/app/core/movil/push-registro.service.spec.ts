import { TestBed } from '@angular/core/testing';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideHttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { Capacitor } from '@capacitor/core';
import { PushNotifications } from '@capacitor/push-notifications';
import { PushRegistroService } from './push-registro.service';
import { AuthService } from '../auth/auth.service';
import { environment } from '../../../environments/environment';

jest.mock('@capacitor/core', () => ({
  Capacitor: { isNativePlatform: jest.fn(), getPlatform: jest.fn() },
}));

jest.mock('@capacitor/push-notifications', () => ({
  PushNotifications: {
    checkPermissions: jest.fn(),
    requestPermissions: jest.fn(),
    register: jest.fn(),
    addListener: jest.fn(),
    removeAllListeners: jest.fn(),
  },
}));

const capacitor = Capacitor as jest.Mocked<typeof Capacitor>;
const push = PushNotifications as unknown as {
  checkPermissions: jest.Mock;
  requestPermissions: jest.Mock;
  register: jest.Mock;
  addListener: jest.Mock;
  removeAllListeners: jest.Mock;
};

describe('PushRegistroService', () => {
  let service: PushRegistroService;
  let http: HttpTestingController;
  let router: { navigateByUrl: jest.Mock };
  let estaAutenticado: jest.Mock;

  /** Oyentes que el servicio registró, por nombre de evento. */
  const oyente = (evento: string): ((dato: unknown) => void) =>
    push.addListener.mock.calls.find((c) => c[0] === evento)![1];

  beforeEach(() => {
    jest.clearAllMocks();
    capacitor.isNativePlatform.mockReturnValue(true);
    capacitor.getPlatform.mockReturnValue('android');
    push.checkPermissions.mockResolvedValue({ receive: 'granted' });
    push.requestPermissions.mockResolvedValue({ receive: 'granted' });
    push.register.mockResolvedValue(undefined);
    push.addListener.mockResolvedValue(undefined);
    push.removeAllListeners.mockResolvedValue(undefined);

    router = { navigateByUrl: jest.fn() };
    estaAutenticado = jest.fn().mockReturnValue(true);

    TestBed.configureTestingModule({
      providers: [
        PushRegistroService,
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: Router, useValue: router },
        { provide: AuthService, useValue: { estaAutenticado } },
      ],
    });
    service = TestBed.inject(PushRegistroService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  describe('iniciar', () => {
    it('debería quedarse en "no disponible" fuera de la app nativa', async () => {
      capacitor.isNativePlatform.mockReturnValue(false);

      await service.iniciar();

      expect(service.permiso()).toBe('no_disponible');
      expect(push.addListener).not.toHaveBeenCalled();
    });

    /*
     * El token cambia con una reinstalación o una restauración, así que con el
     * permiso ya concedido hay que volver a registrarse en cada arranque.
     */
    it('debería re-registrarse si el permiso ya estaba concedido', async () => {
      await service.iniciar();

      expect(service.permiso()).toBe('concedido');
      expect(push.register).toHaveBeenCalled();
    });

    it('no debería registrarse si el permiso está denegado', async () => {
      push.checkPermissions.mockResolvedValue({ receive: 'denied' });

      await service.iniciar();

      expect(service.permiso()).toBe('denegado');
      expect(push.register).not.toHaveBeenCalled();
    });

    it('debería dejar el permiso en "desconocido" mientras no se haya preguntado', async () => {
      push.checkPermissions.mockResolvedValue({ receive: 'prompt' });

      await service.iniciar();

      expect(service.permiso()).toBe('desconocido');
      expect(push.register).not.toHaveBeenCalled();
    });

    /* `iniciar()` corre otra vez tras un login: sin limpiar, el token se enviaría dos veces. */
    it('debería limpiar los oyentes anteriores antes de registrar los suyos', async () => {
      await service.iniciar();

      expect(push.removeAllListeners).toHaveBeenCalled();
      expect(push.addListener.mock.calls.map((c) => c[0])).toEqual([
        'registration', 'registrationError', 'pushNotificationActionPerformed',
      ]);
    });
  });

  describe('solicitarPermiso', () => {
    it('debería decir que no fuera de la app nativa, sin preguntar al sistema', async () => {
      capacitor.isNativePlatform.mockReturnValue(false);

      await expect(service.solicitarPermiso()).resolves.toBe(false);
      expect(push.requestPermissions).not.toHaveBeenCalled();
    });

    it('debería registrar el dispositivo cuando se concede', async () => {
      await expect(service.solicitarPermiso()).resolves.toBe(true);

      expect(service.permiso()).toBe('concedido');
      expect(push.register).toHaveBeenCalled();
    });

    it('no debería registrar nada cuando se deniega', async () => {
      push.requestPermissions.mockResolvedValue({ receive: 'denied' });

      await expect(service.solicitarPermiso()).resolves.toBe(false);

      expect(service.permiso()).toBe('denegado');
      expect(push.register).not.toHaveBeenCalled();
    });
  });

  describe('token del dispositivo', () => {
    it('debería mandar el token al API con la plataforma', async () => {
      await service.iniciar();

      oyente('registration')({ value: 'token-abc' });

      const peticion = http.expectOne(`${environment.apiUrl}/push/dispositivos`);
      expect(peticion.request.body).toEqual({ token: 'token-abc', plataforma: 'android' });
      peticion.flush({});
    });

    it('no debería mandarlo sin sesión iniciada', async () => {
      estaAutenticado.mockReturnValue(false);
      await service.iniciar();

      oyente('registration')({ value: 'token-abc' });

      http.expectNone(`${environment.apiUrl}/push/dispositivos`);
    });

    it('debería aguantar que el envío del token falle', async () => {
      await service.iniciar();

      oyente('registration')({ value: 'token-abc' });

      http.expectOne(`${environment.apiUrl}/push/dispositivos`)
        .flush('', { status: 500, statusText: 'Error' });
      await Promise.resolve();
    });

    it('debería marcar "no disponible" si el registro falla en el sistema', async () => {
      await service.iniciar();

      oyente('registrationError')({});

      expect(service.permiso()).toBe('no_disponible');
    });
  });

  describe('notificación tocada', () => {
    it('debería abrir la ruta que trae el mensaje', async () => {
      await service.iniciar();

      oyente('pushNotificationActionPerformed')({ notification: { data: { ruta: '/reservas/9' } } });

      expect(router.navigateByUrl).toHaveBeenCalledWith('/reservas/9');
    });

    /* Una "ruta" que no empieza por barra podría sacar al usuario de la app. */
    it.each([
      ['una ruta que no es interna', { ruta: 'https://otro-sitio.example' }],
      ['una ruta que no es texto', { ruta: 42 }],
      ['un mensaje sin ruta', {}],
      ['un mensaje sin datos', undefined],
    ])('no debería navegar con %s', async (_caso, data) => {
      await service.iniciar();

      oyente('pushNotificationActionPerformed')({ notification: { data } });

      expect(router.navigateByUrl).not.toHaveBeenCalled();
    });
  });

  describe('darDeBaja', () => {
    it('no debería llamar al API si nunca hubo token', async () => {
      await service.darDeBaja();

      http.expectNone(() => true);
    });

    it('debería borrar el dispositivo del API', async () => {
      await service.iniciar();
      oyente('registration')({ value: 'token abc/1' });
      http.expectOne(`${environment.apiUrl}/push/dispositivos`).flush({});

      const baja = service.darDeBaja();

      http.expectOne(`${environment.apiUrl}/push/dispositivos/${encodeURIComponent('token abc/1')}`)
        .flush({});
      await baja;
    });

    /* Cerrar sesión no puede quedarse colgado porque la baja falle. */
    it('debería olvidar el token aunque el API falle', async () => {
      await service.iniciar();
      oyente('registration')({ value: 'token-abc' });
      http.expectOne(`${environment.apiUrl}/push/dispositivos`).flush({});

      const baja = service.darDeBaja();
      http.expectOne(`${environment.apiUrl}/push/dispositivos/token-abc`)
        .flush('', { status: 500, statusText: 'Error' });
      await expect(baja).resolves.toBeUndefined();

      await service.darDeBaja();
      http.expectNone(() => true);
    });
  });
});
