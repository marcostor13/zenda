/**
 * Genera `public/env.js` con la configuración de la web.
 *
 * La web es una SPA: **todo lo que llega al navegador es público**. Esto no
 * oculta valores al visitante; lo que evita es tenerlos escritos en el
 * repositorio y permite cambiarlos por entorno sin tocar el código.
 *
 * Fuentes, de menor a mayor prioridad: `apps/web/.env` y las variables reales
 * del proceso. Sólo se publican las que empiezan por `WEB_`: así una variable
 * de servidor (una clave de Google, una cadena de Mongo) no puede colarse en el
 * bundle por descuido.
 *
 * En producción este fichero lo vuelve a escribir el contenedor al arrancar
 * (`docker-entrypoint.sh`), para no rehacer la imagen por cambiar una URL.
 *
 * `preparar-movil.mjs` reutiliza las funciones exportadas de aquí para escribir
 * el `env.js` de la app móvil, que no sale de `.env` sino de la URL pública.
 */
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

export const raizWeb = join(dirname(fileURLToPath(import.meta.url)), '..');
const PREFIJO = 'WEB_';

/** Lee un `.env` sencillo: `CLAVE=valor`, con comentarios y comillas opcionales. */
export function leerFicheroEnv(ruta) {
  if (!existsSync(ruta)) return {};

  return readFileSync(ruta, 'utf8')
    .split(/\r?\n/)
    .reduce((acumulado, linea) => {
      const limpia = linea.trim();
      if (!limpia || limpia.startsWith('#')) return acumulado;

      const separador = limpia.indexOf('=');
      if (separador <= 0) return acumulado;

      const clave = limpia.slice(0, separador).trim();
      const valor = limpia.slice(separador + 1).trim().replace(/^["']|["']$/g, '');
      return { ...acumulado, [clave]: valor };
    }, {});
}

/** Deja sólo las claves `WEB_` con valor: el resto no debe llegar al navegador. */
export function soloPublicas(configuracion) {
  return Object.fromEntries(
    Object.entries(configuracion).filter(
      ([clave, valor]) => clave.startsWith(PREFIJO) && valor !== undefined && valor !== '',
    ),
  );
}

/** Contenido del fichero a partir de las variables ya filtradas. */
export function contenidoEnvJs(publicas) {
  return (
    `// Generado por scripts/generar-env.mjs. No editar a mano ni versionar.\n` +
    `window.__env = ${JSON.stringify(publicas, null, 2)};\n`
  );
}

/** Escribe el `env.js` en `destino`, creando el directorio si hace falta. */
export function escribirEnvJs(destino, publicas) {
  mkdirSync(dirname(destino), { recursive: true });
  writeFileSync(destino, contenidoEnvJs(publicas), 'utf8');
}

/** Configuración efectiva de la web: `.env` primero, variables del proceso encima. */
export function configuracionWeb() {
  return soloPublicas({ ...leerFicheroEnv(join(raizWeb, '.env')), ...process.env });
}

// Ejecutado como script (`node scripts/generar-env.mjs`), no importado.
if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const publicas = configuracionWeb();
  escribirEnvJs(join(raizWeb, 'public', 'env.js'), publicas);

  const nombres = Object.keys(publicas);
  console.log(
    nombres.length
      ? `env.js generado con: ${nombres.join(', ')}`
      : 'env.js generado vacío: la web usará los valores por defecto compilados.',
  );
}
