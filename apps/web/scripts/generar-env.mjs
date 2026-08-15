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
 */
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const raizWeb = join(dirname(fileURLToPath(import.meta.url)), '..');
const PREFIJO = 'WEB_';

/** Lee un `.env` sencillo: `CLAVE=valor`, con comentarios y comillas opcionales. */
function leerFicheroEnv(ruta) {
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

const configuracion = { ...leerFicheroEnv(join(raizWeb, '.env')), ...process.env };
const publicas = Object.entries(configuracion)
  .filter(([clave, valor]) => clave.startsWith(PREFIJO) && valor !== undefined && valor !== '');

const destino = join(raizWeb, 'public', 'env.js');
mkdirSync(dirname(destino), { recursive: true });
writeFileSync(
  destino,
  `// Generado por scripts/generar-env.mjs. No editar a mano ni versionar.\n` +
    `window.__env = ${JSON.stringify(Object.fromEntries(publicas), null, 2)};\n`,
  'utf8',
);

const nombres = publicas.map(([clave]) => clave);
console.log(
  nombres.length
    ? `env.js generado con: ${nombres.join(', ')}`
    : 'env.js generado vacío: la web usará los valores por defecto compilados.',
);
