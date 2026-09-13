import { DOCUMENT } from '@angular/common';
import { TestBed } from '@angular/core/testing';
import { Capacitor } from '@capacitor/core';
import { RecuperacionChunkService } from './recuperacion-chunk.service';

jest.mock('@capacitor/core', () => ({
  Capacitor: { isNativePlatform: jest.fn(), getPlatform: jest.fn() },
  registerPlugin: jest.fn(),
}));

const capacitor = Capacitor as jest.Mocked<typeof Capacitor>;

describe('RecuperacionChunkService', () => {
  let service: RecuperacionChunkService;
  let asignar: jest.Mock;
  let recargar: jest.Mock;
  let oyentes: Record<string, (evento: unknown) => void>;

  /** El error que lanza el navegador cuando el fichero pedido ya no existe. */
  const errorDeChunk = (): Error =>
    new TypeError('Failed to fetch dynamically imported module: /chunk-5KJ2X9QA.js');

  /**
   * Documento de mentira: el servicio se queda escuchando de por vida y el
   * `document` de jsdom es el mismo para todo el fichero.
   */
  const documentoFalso = (): Document =>
    ({
      defaultView: {
        location: { assign: asignar, reload: recargar },
        addEventListener: (evento: string, oyente: (evento: unknown) => void) => {
          oyentes[evento] = oyente;
        },
      },
    }) as unknown as Document;

  beforeEach(() => {
    jest.clearAllMocks();
    capacitor.isNativePlatform.mockReturnValue(false);
    asignar = jest.fn();
    recargar = jest.fn();
    oyentes = {};
    sessionStorage.clear();

    TestBed.configureTestingModule({
      providers: [{ provide: DOCUMENT, useFactory: documentoFalso }],
    });
    service = TestBed.inject(RecuperacionChunkService);
  });

  it('debería ir al destino cuando la pantalla pedida no se pudo cargar', () => {
    // La barra de direcciones se quedó en la página anterior: recargar sin más
    // devolvería al visitante a donde estaba, no a donde iba.
    const recuperado = service.recuperar(errorDeChunk(), '/veterinaria?ciudad=Madrid');

    expect(recuperado).toBe(true);
    expect(asignar).toHaveBeenCalledWith('/veterinaria?ciudad=Madrid');
  });

  it('debería recargar la página cuando el fallo no venía de una navegación', () => {
    const recuperado = service.recuperar(errorDeChunk());

    expect(recuperado).toBe(true);
    expect(recargar).toHaveBeenCalled();
  });

  it('no debería tocar nada si el error no es de carga de un trozo', () => {
    const recuperado = service.recuperar(new Error('Http failure response: 500'), '/reservas');

    expect(recuperado).toBe(false);
    expect(asignar).not.toHaveBeenCalled();
    expect(recargar).not.toHaveBeenCalled();
  });

  it('no debería recargar dos veces seguidas', () => {
    // Si tras recargar el fichero sigue sin estar, el problema no es la versión
    // guardada: insistir dejaría al visitante en un bucle de pantallas blancas.
    service.recuperar(errorDeChunk(), '/veterinaria');
    asignar.mockClear();

    const segunda = service.recuperar(errorDeChunk(), '/peluqueria');

    expect(segunda).toBe(false);
    expect(asignar).not.toHaveBeenCalled();
  });

  it('no debería recargar dentro de la app nativa', () => {
    // Allí el código viene del paquete instalado: recargar no trae nada nuevo.
    capacitor.isNativePlatform.mockReturnValue(true);

    expect(service.recuperar(errorDeChunk(), '/veterinaria')).toBe(false);
    expect(asignar).not.toHaveBeenCalled();
  });

  it('debería recuperar también los fallos que no pasan por el router', () => {
    service.iniciar();

    oyentes['unhandledrejection']({ reason: errorDeChunk() });

    expect(recargar).toHaveBeenCalled();
  });

  it('no debería escuchar nada dentro de la app nativa', () => {
    capacitor.isNativePlatform.mockReturnValue(true);

    service.iniciar();

    expect(oyentes['unhandledrejection']).toBeUndefined();
  });
});
