/**
 * Acceso a `localStorage` y `sessionStorage` que no revienta fuera del navegador.
 *
 * Dos sitios donde no existen y el código se ejecuta igual:
 *
 * 1. **El render de servidor.** Node no tiene almacenamiento del navegador, y
 *    varios servicios de raíz lo leen al construirse —`AuthService` lee el token
 *    en la inicialización de un campo—, así que la primera petición reventaba
 *    antes de pintar nada.
 * 2. **El navegador con las cookies bloqueadas.** En Safari en modo privado y
 *    con "bloquear todas las cookies" activado, el simple hecho de *acceder* a
 *    `localStorage` lanza una excepción de seguridad. No es un caso raro: es la
 *    configuración por defecto de más de un navegador con protección reforzada.
 *
 * Devuelve un almacén que traga y olvida en vez de fallar: quien lo use no tiene
 * que preguntar dónde se está ejecutando. Lo que se pierde es la persistencia,
 * que fuera del navegador no tiene sentido de todas formas.
 */
const ALMACEN_VACIO: Storage = {
  length: 0,
  clear: () => undefined,
  getItem: () => null,
  key: () => null,
  removeItem: () => undefined,
  setItem: () => undefined,
};

function resolver(nombre: 'localStorage' | 'sessionStorage'): Storage {
  try {
    const global = globalThis as unknown as Record<string, Storage | undefined>;
    return global[nombre] ?? ALMACEN_VACIO;
  } catch {
    return ALMACEN_VACIO;
  }
}

/** `localStorage`, o un almacén que no guarda nada si no se puede usar. */
export function almacenLocal(): Storage {
  return resolver('localStorage');
}

/** `sessionStorage`, o un almacén que no guarda nada si no se puede usar. */
export function almacenSesion(): Storage {
  return resolver('sessionStorage');
}

/**
 * `true` sólo en el navegador. Para lo que no se puede simular con un almacén
 * vacío: medir la pantalla, tocar el DOM, arrancar un mapa.
 *
 * No usa `isPlatformBrowser` de Angular a propósito: esto se llama también desde
 * funciones sueltas y desde inicializadores de campo, donde no hay inyector.
 */
export function esNavegador(): boolean {
  return typeof window !== 'undefined' && typeof document !== 'undefined';
}
