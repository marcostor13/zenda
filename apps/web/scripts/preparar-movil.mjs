/**
 * Escribe la configuración de la app móvil **dentro del proyecto nativo**, que
 * es lo único que acaba empaquetado en el APK/IPA.
 *
 * Existe por un error concreto, cometido ya dos veces: el APK se compiló con la
 * configuración de desarrollo y llevaba dentro `WEB_API_URL=http://localhost:3051`.
 * Desde un móvil, `localhost` es el propio móvil — la app se instalaba, abría y
 * no respondía nada, sin ningún mensaje que explicara por qué.
 *
 * La primera versión generaba `public/env.js` *antes* del build. No bastaba:
 * cualquier `ng build`/`npm run build` intermedio lo reescribe con el `.env` de
 * desarrollo y el `cap sync` siguiente se lo lleva al APK sin avisar. Por eso
 * ahora se escribe **después de `cap sync`**, directamente en los assets
 * nativos, y se verifica releyendo el fichero. Así ningún paso posterior puede
 * colar la URL local, venga el build de donde venga.
 *
 * Para probar contra un API de la red local:
 *   WEB_API_URL=http://192.168.1.50:3051/api/v1 bun run movil:sync
 * (y hace falta `cleartext: true` en capacitor.config.ts, ver android/DEPLOY-MOVIL.md).
 */
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';

import { configuracionWeb, escribirEnvJs, raizWeb } from './generar-env.mjs';

/** API público de Doogking: lo que debe llevar dentro una app instalada. */
const API_POR_DEFECTO = 'https://apizenda.marcostorresalarcon.com/api/v1';

/** Direcciones que sólo resuelven dentro del equipo que compila. */
const SOLO_LOCALES = ['localhost', '127.0.0.1', '0.0.0.0', '[::1]'];

/**
 * Assets que Capacitor empaqueta. Se escriben los que existan: quien no tenga
 * el proyecto de iOS sincronizado no debe ver un fallo por ello.
 */
const ASSETS_NATIVOS = [
  join(raizWeb, 'android', 'app', 'src', 'main', 'assets', 'public', 'env.js'),
  join(raizWeb, 'ios', 'App', 'App', 'public', 'env.js'),
];

/** Con `--verificar` no escribe nada: sólo comprueba lo que ya está empaquetado. */
const soloVerificar = process.argv.includes('--verificar');

function abortar(mensaje) {
  console.error(`\n✗ ${mensaje}\n`);
  process.exit(1);
}

/** Una URL que sólo resuelve en el equipo que compila no sirve dentro de un APK. */
function exigirUrlAlcanzable(url) {
  const anfitrion = new URL(url).hostname;
  if (SOLO_LOCALES.includes(anfitrion)) {
    abortar(
      `WEB_API_URL apunta a "${anfitrion}", que desde un móvil es el propio móvil.\n`
        + `  La app se instalaría y no respondería nada.\n\n`
        + `  Para la app real, no pases nada: se usa ${API_POR_DEFECTO}\n`
        + `  Para probar contra tu equipo, usa su IP de red:\n`
        + `    WEB_API_URL=http://192.168.1.50:3051/api/v1 bun run movil:sync`,
    );
  }
  return url;
}

/** Relee el fichero empaquetado: fiarse de la variable no demuestra qué se escribió. */
function urlEmpaquetada(ruta) {
  const url = readFileSync(ruta, 'utf8').match(/"WEB_API_URL":\s*"([^"]+)"/)?.[1];
  if (!url) abortar(`${ruta} no lleva WEB_API_URL. La app no sabría a dónde llamar.`);
  return exigirUrlAlcanzable(url);
}

const destinos = ASSETS_NATIVOS.filter((ruta) => existsSync(soloVerificar ? ruta : dirname(ruta)));
if (!destinos.length) {
  abortar('No hay proyecto nativo sincronizado. Ejecuta `bun run movil:sync` antes de compilar.');
}

if (!soloVerificar) {
  // Se valida antes de escribir para no dejar atrás un env.js que ya se sabe roto.
  const api = exigirUrlAlcanzable(process.env.WEB_API_URL || API_POR_DEFECTO);
  destinos.forEach((ruta) => escribirEnvJs(ruta, { ...configuracionWeb(), WEB_API_URL: api }));
}

const rotulo = soloVerificar ? 'El paquete que se va a compilar apunta a' : 'La app apuntará a';
console.log(`\n✓ ${rotulo}: ${destinos.map(urlEmpaquetada)[0]}\n`);
