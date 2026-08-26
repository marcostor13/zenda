import { test as base, type Page, type Route } from '@playwright/test';

/**
 * Intercepción del API para los E2E de la web.
 *
 * Cada prueba declara sólo lo que necesita; el resto de llamadas caen en una
 * respuesta vacía por defecto en vez de salir a la red. Así una pantalla que
 * pide seis endpoints no obliga a describir los seis para probar uno.
 */

/** Cuerpo de una respuesta simulada. */
export type Cuerpo = unknown;

export interface RespuestaSimulada {
  readonly estado?: number;
  readonly cuerpo?: Cuerpo;
}

/** Handler de un endpoint: valor fijo o función del `Route` para casos con lógica. */
export type Handler = RespuestaSimulada | ((route: Route) => RespuestaSimulada | Promise<RespuestaSimulada>);

/**
 * Mapa de rutas simuladas. La clave es `MÉTODO /ruta`, donde la ruta es la
 * parte que sigue a `/api/v1` y admite `*` como comodín de un segmento.
 * Ejemplos: `GET /catalog/servicios`, `POST /auth/login`, `GET /perros/*`.
 */
export type Rutas = Record<string, Handler>;

const BASE_API = '**/api/v1/**';

/** Respuestas por defecto: lo mínimo para que cualquier pantalla cargue sin errores. */
const POR_DEFECTO: Rutas = {
  'GET /catalog/servicios': { cuerpo: { items: [], total: 0, page: 1, totalPages: 0 } },
  'GET /catalog/destacados': { cuerpo: [] },
  'GET /favoritos': { cuerpo: [] },
  'GET /reservas/mis': { cuerpo: [] },
  // El wizard consulta disponibilidad al completar el paso 1; sin esto cae en el
  // 200 vacío, lo lee como "no hay hueco" y no deja avanzar en ninguna prueba.
  'POST /reservas/disponibilidad': { cuerpo: { disponible: true } },
  'GET /reservas/disponibilidad/calendario': { cuerpo: { soportado: false, dias: [] } },
  'GET /reservas/recordatorios': { cuerpo: [] },
  'GET /reservas/proxima': { cuerpo: null },
  'GET /reservas/puntos': { cuerpo: { puntos: 0, proximoUmbral: 100, puntosFaltantes: 100, valorProximoDescuento: 0 } },
  'GET /perros/mis': { cuerpo: [] },
  'POST /eventos': { estado: 201, cuerpo: {} },
  'GET /alpha/mi-nivel': { cuerpo: null },
};

/** Convierte `GET /perros/*` en una expresión regular contra `MÉTODO /ruta`. */
function aRegExp(patron: string): RegExp {
  const escapado = patron
    .replace(/[.+?^${}()|[\]\\]/g, "\\$&")
    .replace(/\*/g, "[^/]+");
  return new RegExp(`^${escapado}$`);
}

/** Localiza el handler declarado para una petición, si lo hay. */
function buscarHandler(rutas: Rutas, metodo: string, ruta: string): Handler | undefined {
  const clave = `${metodo} ${ruta}`;
  if (rutas[clave]) return rutas[clave];
  for (const [patron, handler] of Object.entries(rutas)) {
    if (patron.includes('*') && aRegExp(patron).test(clave)) return handler;
  }
  return undefined;
}

/**
 * Instala la intercepción en la página. Devuelve una función para añadir o
 * sustituir rutas en mitad de una prueba (p.ej. simular que algo empieza a
 * fallar tras la primera carga).
 */
export async function interceptarApi(page: Page, rutas: Rutas = {}) {
  const declaradas: Rutas = { ...POR_DEFECTO, ...rutas };

  await page.route(BASE_API, async (route) => {
    const peticion = route.request();
    const metodo = peticion.method();
    const url = new URL(peticion.url());
    // Se descarta el prefijo del API y la query: las rutas se declaran por camino.
    const ruta = url.pathname.replace(/^.*\/api\/v1/, '') || '/';

    const handler = buscarHandler(declaradas, metodo, ruta);

    if (!handler) {
      // Sin declarar: 200 vacío. Evita que una llamada secundaria tumbe la prueba,
      // y deja rastro en consola para detectar endpoints que faltaba simular.
      console.warn(`[e2e] sin simular: ${metodo} ${ruta} → {} por defecto`);
      await route.fulfill({ status: 200, contentType: 'application/json', body: '{}' });
      return;
    }

    const resuelto = typeof handler === 'function' ? await handler(route) : handler;
    await route.fulfill({
      status: resuelto.estado ?? 200,
      contentType: 'application/json',
      body: JSON.stringify(resuelto.cuerpo ?? {}),
    });
  });

  return (nuevas: Rutas) => Object.assign(declaradas, nuevas);
}

/** Deja la sesión iniciada antes de cargar la página, sin pasar por el login. */
export async function sesionIniciada(
  page: Page,
  usuario: { nombre?: string; email?: string; rol?: string } = {},
) {
  // Claves reales de `auth.service.ts`; el prefijo `zenda_` es herencia del
  // nombre anterior del proyecto y sigue siendo el que la app lee.
  const datos = {
    token: 'token-e2e',
    usuario: {
      _id: 'u-e2e',
      nombre: usuario.nombre ?? 'Ana Ruiz',
      email: usuario.email ?? 'ana@ruiz.com',
      rol: usuario.rol ?? 'cliente',
    },
  };
  await page.addInitScript((d) => {
    localStorage.setItem('zenda_token', d.token);
    localStorage.setItem('zenda_usuario', JSON.stringify(d.usuario));
  }, datos);
}

export const test = base;
export { expect } from '@playwright/test';
