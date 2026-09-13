import { DOCUMENT } from '@angular/common';
import { TestBed } from '@angular/core/testing';
import { NavigationStart, Router } from '@angular/router';
import { Subject } from 'rxjs';
import { Capacitor } from '@capacitor/core';
import { VersionService } from './version.service';

jest.mock('@capacitor/core', () => ({
  Capacitor: { isNativePlatform: jest.fn(), getPlatform: jest.fn() },
  registerPlugin: jest.fn(),
}));

const capacitor = Capacitor as jest.Mocked<typeof Capacitor>;

describe('VersionService', () => {
  let service: VersionService;
  let eventos: Subject<NavigationStart>;
  let asignar: jest.Mock;
  let oyentes: Record<string, () => void>;
  /** Contenido de `<meta name="dk-build">`; `null` si el HTML no la trae. */
  let marcaDelHtml: string | null;

  /** Respuesta de `/version.json` con la versión indicada. */
  const respuestaCon = (version: string): Response =>
    ({ ok: true, json: async () => ({ version }) }) as Response;

  /** Vacía la cola de microtareas: la consulta encadena varios `await`. */
  const esperarConsulta = (): Promise<void> =>
    new Promise((resolver) => setTimeout(resolver, 0));

  /**
   * Documento de mentira. Se inyecta en lugar del real porque el servicio se
   * queda escuchando `visibilitychange` de por vida: con el `document` de jsdom,
   * que es el mismo para todo el fichero, los oyentes de un test dispararían
   * consultas en el siguiente y se comerían las respuestas simuladas.
   */
  const documentoFalso = (): Document =>
    ({
      visibilityState: 'visible',
      defaultView: { location: { assign: asignar } },
      addEventListener: (evento: string, oyente: () => void) => {
        oyentes[evento] = oyente;
      },
      // La marca que `server.ts` estampa en el HTML renderizado. `null` es el
      // caso sin render de servidor, donde la referencia sigue siendo la
      // primera consulta.
      querySelector: () =>
        marcaDelHtml === null ? null : { getAttribute: () => marcaDelHtml },
    }) as unknown as Document;

  beforeEach(() => {
    jest.restoreAllMocks();
    jest.clearAllMocks();
    capacitor.isNativePlatform.mockReturnValue(false);
    eventos = new Subject<NavigationStart>();
    asignar = jest.fn();
    oyentes = {};
    marcaDelHtml = null;
    sessionStorage.clear();

    TestBed.configureTestingModule({
      providers: [
        { provide: Router, useValue: { events: eventos.asObservable() } },
        { provide: DOCUMENT, useFactory: documentoFalso },
      ],
    });
    service = TestBed.inject(VersionService);
  });

  it('debería guardar la versión publicada al arrancar sin recargar nada', async () => {
    global.fetch = jest.fn().mockResolvedValue(respuestaCon('abc123'));

    service.iniciar();
    await esperarConsulta();
    eventos.next(new NavigationStart(1, '/servicios'));

    expect(global.fetch).toHaveBeenCalledWith('/version.json', { cache: 'no-store' });
    expect(asignar).not.toHaveBeenCalled();
  });

  it('no debería consultar la versión dentro de la app nativa', () => {
    capacitor.isNativePlatform.mockReturnValue(true);
    global.fetch = jest.fn();

    service.iniciar();

    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('debería recargar en la siguiente navegación cuando la versión ha cambiado', async () => {
    global.fetch = jest
      .fn()
      .mockResolvedValueOnce(respuestaCon('abc123'))
      .mockResolvedValueOnce(respuestaCon('def456'));

    service.iniciar();
    await esperarConsulta();

    // Se adelanta el reloj para saltarse el intervalo mínimo entre consultas.
    // El valor se calcula antes del espía: después, `Date.now` ya es el doble.
    const dentroDeDosMinutos = Date.now() + 120_000;
    jest.spyOn(Date, 'now').mockReturnValue(dentroDeDosMinutos);
    oyentes['visibilitychange']();
    await esperarConsulta();

    eventos.next(new NavigationStart(2, '/reservas'));

    expect(asignar).toHaveBeenCalledWith('/reservas');
  });

  it('no debería recargar dos veces seguidas aunque siga viendo otra versión', async () => {
    sessionStorage.setItem('doogking.version.ultimaRecarga', String(Date.now()));
    global.fetch = jest
      .fn()
      .mockResolvedValueOnce(respuestaCon('abc123'))
      .mockResolvedValueOnce(respuestaCon('def456'));

    service.iniciar();
    await esperarConsulta();
    const dentroDeDosMinutos = Date.now() + 120_000;
    jest.spyOn(Date, 'now').mockReturnValue(dentroDeDosMinutos);
    oyentes['visibilitychange']();
    await esperarConsulta();

    eventos.next(new NavigationStart(2, '/reservas'));

    expect(asignar).not.toHaveBeenCalled();
  });

  it('no debería recargar si el servidor no responde', async () => {
    global.fetch = jest.fn().mockRejectedValue(new Error('sin red'));

    service.iniciar();
    await esperarConsulta();
    eventos.next(new NavigationStart(1, '/servicios'));

    expect(asignar).not.toHaveBeenCalled();
  });

  it('debería recargar en la siguiente navegación si el HTML ya era de un despliegue anterior', async () => {
    /*
     * El caso de "a mí se me queda en blanco al buscar": la pestaña arrancó
     * con el HTML de hace días y el contenedor ya sirve otro build. Antes esto
     * no se detectaba —la referencia se tomaba de la primera consulta, que
     * responde el contenedor actual—, así que la pestaña seguía pidiendo
     * ficheros que ya no existen.
     */
    marcaDelHtml = 'abc123';
    global.fetch = jest.fn().mockResolvedValue(respuestaCon('def456'));

    service.iniciar();
    await esperarConsulta();
    eventos.next(new NavigationStart(1, '/veterinaria?ciudad=Madrid'));

    expect(asignar).toHaveBeenCalledWith('/veterinaria?ciudad=Madrid');
  });

  it('no debería recargar si el HTML es del mismo build que sirve el servidor', async () => {
    marcaDelHtml = 'abc123';
    global.fetch = jest.fn().mockResolvedValue(respuestaCon('abc123'));

    service.iniciar();
    await esperarConsulta();
    eventos.next(new NavigationStart(1, '/veterinaria'));

    expect(asignar).not.toHaveBeenCalled();
  });
});
