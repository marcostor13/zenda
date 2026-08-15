/// <reference types="google.maps" />

/**
 * Carga del SDK de Google Maps JavaScript.
 *
 * La referencia de arriba es necesaria: los tsconfig del proyecto declaran
 * `"types": []`, así que los tipos de Google no entran solos y el SDK no se
 * importa desde npm (no se publica ahí).
 *
 * Va por `<script>` inyectado y no por un `import()` porque Google no publica
 * el SDK en npm: la etiqueta es la vía soportada y además permite pedir el
 * idioma y la región del mercado (§9 de CLAUDE.md).
 *
 * La promesa se guarda a nivel de módulo: en el listado conviven la miniatura
 * del mapa y el mapa a pantalla completa, y cargar el SDK dos veces duplicaría
 * la descarga y haría saltar el aviso de Google por incluirlo repetido.
 */

/** Nombre del callback global que Google invoca al terminar de cargar. */
const CALLBACK = '__doogkingGoogleMapsListo';
/** Idioma y país del mercado inicial; el resto de Europa se lee igual en es. */
const IDIOMA = 'es';
const REGION = 'ES';

type MapsApi = typeof google.maps;

interface VentanaConCallback {
  [CALLBACK]?: () => void;
  google?: { maps?: MapsApi };
}

let carga: Promise<MapsApi> | null = null;

/**
 * Devuelve el SDK ya listo. Rechaza si la clave no vale o si la red falla, y
 * quien llama debe caer entonces a OpenStreetMap: un mapa de otro proveedor es
 * mejor que un hueco gris donde deberían salir los listados.
 */
export function cargarGoogleMaps(apiKey: string): Promise<MapsApi> {
  carga ??= iniciarCarga(apiKey);
  return carga;
}

/**
 * Olvida la carga anterior. Solo para tests: en la aplicación el SDK se carga
 * una vez y no se descarga nunca.
 */
export function reiniciarCargaGoogleMaps(): void {
  carga = null;
}

function iniciarCarga(apiKey: string): Promise<MapsApi> {
  const ventana = globalThis as unknown as VentanaConCallback;

  // Otro punto de entrada (o una recarga en caliente) pudo dejarlo ya cargado.
  const yaCargado = ventana.google?.maps;
  if (yaCargado) return Promise.resolve(yaCargado);

  return new Promise<MapsApi>((resolver, rechazar) => {
    const script = document.createElement('script');
    const params = new URLSearchParams({
      key: apiKey,
      language: IDIOMA,
      region: REGION,
      loading: 'async',
      callback: CALLBACK,
    });

    ventana[CALLBACK] = (): void => {
      const maps = ventana.google?.maps;
      delete ventana[CALLBACK];
      if (maps) resolver(maps);
      else rechazar(new Error('Google Maps se cargó sin exponer el SDK'));
    };

    script.src = `https://maps.googleapis.com/maps/api/js?${params.toString()}`;
    script.async = true;
    script.onerror = (): void => {
      delete ventana[CALLBACK];
      // La promesa cacheada guardaría el fallo para siempre; soltarla permite
      // reintentar si el usuario recupera la conexión y abre el mapa otra vez.
      carga = null;
      rechazar(new Error('No se pudo descargar Google Maps'));
    };

    document.head.appendChild(script);
  });
}
