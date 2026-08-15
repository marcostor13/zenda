/// <reference types="google.maps" />

import { cargarGoogleMaps, reiniciarCargaGoogleMaps } from './google-maps.loader';

const CALLBACK = '__doogkingGoogleMapsListo';

/** Lo mínimo que hace falta para hacerse pasar por el SDK ya cargado. */
const SDK_FALSO = { Map: class {} } as unknown as typeof google.maps;

interface Ventana {
  [CALLBACK]?: () => void;
  google?: { maps?: typeof google.maps };
}

const ventana = globalThis as unknown as Ventana;

/** Último `<script>` inyectado por el cargador. */
function ultimoScript(): HTMLScriptElement | null {
  const scripts = document.head.querySelectorAll<HTMLScriptElement>('script');
  return scripts.item(scripts.length - 1);
}

describe('cargarGoogleMaps', () => {
  beforeEach(() => {
    reiniciarCargaGoogleMaps();
    delete ventana.google;
    delete ventana[CALLBACK];
    document.head.querySelectorAll('script').forEach((s) => s.remove());
  });

  it('debería inyectar el script con la clave, el idioma y el callback', () => {
    void cargarGoogleMaps('clave-de-prueba');

    const src = ultimoScript()?.src ?? '';
    expect(src).toContain('maps.googleapis.com/maps/api/js');
    expect(src).toContain('key=clave-de-prueba');
    expect(src).toContain('language=es');
    expect(src).toContain('region=ES');
    expect(src).toContain(`callback=${CALLBACK}`);
  });

  it('debería resolver con el SDK cuando Google llama al callback', async () => {
    const promesa = cargarGoogleMaps('clave-de-prueba');

    ventana.google = { maps: SDK_FALSO };
    ventana[CALLBACK]?.();

    await expect(promesa).resolves.toBe(SDK_FALSO);
    // El callback global se limpia: dejarlo colgado ensucia `window` para siempre.
    expect(ventana[CALLBACK]).toBeUndefined();
  });

  it('no debería descargar el SDK dos veces aunque lo pidan varios mapas', () => {
    void cargarGoogleMaps('clave-de-prueba');
    void cargarGoogleMaps('clave-de-prueba');

    expect(document.head.querySelectorAll('script')).toHaveLength(1);
  });

  it('debería resolver sin inyectar nada si el SDK ya está en la página', async () => {
    ventana.google = { maps: SDK_FALSO };

    await expect(cargarGoogleMaps('clave-de-prueba')).resolves.toBe(SDK_FALSO);
    expect(document.head.querySelectorAll('script')).toHaveLength(0);
  });

  it('debería rechazar si el script no se descarga y permitir reintentarlo', async () => {
    const promesa = cargarGoogleMaps('clave-de-prueba');
    ultimoScript()?.onerror?.(new Event('error'));

    await expect(promesa).rejects.toThrow('No se pudo descargar Google Maps');

    // La promesa fallida no se cachea: si el usuario recupera la conexión y
    // vuelve a abrir el mapa, el SDK debe intentar cargarse otra vez.
    void cargarGoogleMaps('clave-de-prueba');
    expect(document.head.querySelectorAll('script')).toHaveLength(2);
  });

  it('debería rechazar si Google carga pero no expone el SDK', async () => {
    const promesa = cargarGoogleMaps('clave-de-prueba');

    ventana.google = {};
    ventana[CALLBACK]?.();

    await expect(promesa).rejects.toThrow('sin exponer el SDK');
  });
});
