/**
 * Prepara `public/env.js` para un build de la app móvil.
 *
 * Existe por un error concreto: el primer APK se compiló con la configuración
 * de desarrollo, así que llevaba dentro `WEB_API_URL=http://localhost:3051`.
 * Desde un móvil, `localhost` es el propio móvil — la app se instalaba, abría
 * y no respondía nada, sin ningún mensaje que explicara por qué.
 *
 * Aquí se pone la URL pública por defecto y **se aborta el build** si la que
 * quedara apuntase al equipo de desarrollo. Es preferible no generar el APK a
 * generar uno que no puede funcionar.
 *
 * Para probar contra un API de la red local:
 *   WEB_API_URL=http://192.168.1.50:3051/api/v1 node scripts/preparar-movil.mjs
 * (y hace falta `cleartext: true` en capacitor.config.ts, ver DEPLOY-MOVIL.md).
 */
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const raizWeb = join(dirname(fileURLToPath(import.meta.url)), '..');

/**
 * Con `--verificar` no genera nada: comprueba el `env.js` que ya está copiado
 * dentro del proyecto Android, justo antes de compilar el APK.
 *
 * Hace falta porque generar bien al principio no basta. Cualquier `ng build` o
 * `npm run build` intermedio reescribe `public/env.js` con la configuración de
 * desarrollo, y el `cap sync` siguiente se la lleva al APK sin avisar. Pasó:
 * un APK salió apuntando a localhost pese a existir ya esta comprobación.
 */
const soloVerificar = process.argv.includes('--verificar');

/** API público de Doogking: lo que debe llevar dentro una app instalada. */
const API_POR_DEFECTO = 'https://apizenda.marcostorresalarcon.com/api/v1';

/** Direcciones que sólo resuelven dentro del equipo que compila. */
const SOLO_LOCALES = ['localhost', '127.0.0.1', '0.0.0.0', '[::1]'];

if (!soloVerificar) {
  process.env.WEB_API_URL ||= API_POR_DEFECTO;

  execFileSync(process.execPath, [join(raizWeb, 'scripts', 'generar-env.mjs')], {
    stdio: 'inherit',
    env: process.env,
  });
}

// Se relee el fichero en vez de fiarse de la variable: lo que acaba dentro del
// APK es esto, y es lo único que merece la pena comprobar.
const fichero = soloVerificar
  ? join(raizWeb, 'android', 'app', 'src', 'main', 'assets', 'public', 'env.js')
  : join(raizWeb, 'public', 'env.js');
const generado = readFileSync(fichero, 'utf8');
const url = generado.match(/"WEB_API_URL":\s*"([^"]+)"/)?.[1];

if (!url) {
  console.error('\n✗ env.js no lleva WEB_API_URL. La app no sabría a dónde llamar.');
  process.exit(1);
}

const anfitrion = new URL(url).hostname;
if (SOLO_LOCALES.includes(anfitrion)) {
  console.error(
    `\n✗ WEB_API_URL apunta a "${anfitrion}", que desde un móvil es el propio móvil.\n`
    + `  La app se instalaría y no respondería nada.\n\n`
    + `  Para la app real, no pases nada: se usa ${API_POR_DEFECTO}\n`
    + `  Para probar contra tu equipo, usa su IP de red:\n`
    + `    WEB_API_URL=http://192.168.1.50:3051/api/v1 bun run movil:sync\n`,
  );
  process.exit(1);
}

const destino = soloVerificar ? 'El APK que se va a compilar apunta a' : 'La app apuntará a';
console.log(`
✓ ${destino}: ${url}
`);
