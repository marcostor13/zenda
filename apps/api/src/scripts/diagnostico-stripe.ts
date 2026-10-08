/**
 * diagnostico-stripe.ts — sólo lectura salvo que se pida `--reparar`
 *
 * Uso:
 *   bun run --cwd apps/api diagnostico:stripe
 *   bun run --cwd apps/api diagnostico:stripe -- --pk pk_test_...
 *   bun run --cwd apps/api diagnostico:stripe -- --reparar [--url https://api.midominio.com/api/v1/payments/webhook]
 *
 * Responde a «¿por qué no se confirma ninguna reserva pagada?» antes de mirar
 * el código. Los tres fallos que lo provocan están fuera de él y ninguno da un
 * error visible:
 *
 *  1. **La URL del webhook apunta a la web y no al API.** La web responde 200
 *     a cualquier ruta, así que Stripe da los avisos por entregados y nadie los
 *     procesa.
 *  2. **El webhook no está suscrito a los eventos que el API entiende.**
 *  3. **La clave publicable de la web es de otra cuenta** que la secreta del
 *     API: el formulario de pago no llega a cargar.
 *
 * `--reparar` corrige los eventos del webhook (y su URL, si se da `--url`).
 * No toca nada más de la cuenta.
 */
import { config as cargarEnv } from 'dotenv';
import * as fs from 'fs';
import * as path from 'path';
// El SDK se publica en CommonJS como `module.exports = Stripe`, sin `.default`:
// un `import Stripe from` compila (allowSyntheticDefaultImports) y revienta al arrancar.
import Stripe = require('stripe');
import { EVENTOS_DE_WEBHOOK } from '../core/payments/stripe.gateway';

// Sin `prepararEntorno()`: aquí no se toca Mongo y no debe exigirse su URI.
cargarEnv({ path: path.resolve(__dirname, '../../.env') });

const IMPORTE_DE_PRUEBA_CENTIMOS = 5000;

function argumento(nombre: string): string | null {
  const i = process.argv.indexOf(nombre);
  return i >= 0 ? process.argv[i + 1] ?? null : null;
}

/** `--pk`, o la que tenga configurada la web en su `.env` local. */
function clavePublicable(): string | null {
  const explicita = argumento('--pk');
  if (explicita) return explicita;

  const envWeb = path.resolve(__dirname, '../../../web/.env');
  if (!fs.existsSync(envWeb)) return null;
  const linea = fs.readFileSync(envWeb, 'utf8').split(/\r?\n/)
    .find((l) => l.trim().startsWith('WEB_STRIPE_PUBLIC_KEY='));
  return linea ? linea.split('=')[1].trim() : null;
}

async function revisarCuenta(stripe: Stripe, secreta: string): Promise<void> {
  const cuenta = await stripe.accounts.retrieveCurrent();
  const modo = secreta.startsWith('sk_live_') ? 'REAL' : 'pruebas';

  console.log('── Cuenta ─────────────────────────────────');
  console.log(`  Id             : ${cuenta.id} (${cuenta.country}, ${cuenta.default_currency})`);
  console.log(`  Modo           : ${modo}`);
  console.log(`  Cobros activos : ${cuenta.charges_enabled ? 'sí' : 'NO'}`);
  if (!cuenta.charges_enabled) {
    console.log('  ⚠️  La cuenta no está activada: en pruebas se puede cobrar, en real no.');
    console.log('      Se completa en dashboard.stripe.com → Activar pagos.');
  }
}

/** Un POST sin firma: el API contesta 400 en JSON; cualquier otra cosa no es el API. */
async function llegaAlApi(url: string): Promise<boolean> {
  try {
    const respuesta = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{}',
    });
    const tipo = respuesta.headers.get('content-type') ?? '';
    return respuesta.status === 400 && tipo.includes('json');
  } catch {
    return false;
  }
}

async function revisarWebhook(stripe: Stripe, reparar: boolean): Promise<boolean> {
  console.log('');
  console.log('── Webhook ────────────────────────────────');

  const id = process.env['STRIPE_WEBHOOK_ID'];
  if (!id) {
    console.log('  STRIPE_WEBHOOK_ID ausente: no se puede revisar el endpoint.');
    return true;
  }

  let endpoint = await stripe.webhookEndpoints.retrieve(id);
  const urlNueva = argumento('--url');
  const faltan = EVENTOS_DE_WEBHOOK.filter((evento) => !endpoint.enabled_events.includes(evento));
  const sobran = endpoint.enabled_events.filter(
    (evento) => !(EVENTOS_DE_WEBHOOK as readonly string[]).includes(evento),
  );

  if (reparar) {
    endpoint = await stripe.webhookEndpoints.update(id, {
      enabled_events: [...EVENTOS_DE_WEBHOOK],
      ...(urlNueva ? { url: urlNueva } : {}),
    });
    console.log('  🔧 Endpoint actualizado en Stripe.');
  }

  const alcanzaElApi = await llegaAlApi(endpoint.url);
  const eventosBien = reparar || (faltan.length === 0 && sobran.length === 0);

  console.log(`  URL            : ${endpoint.url}`);
  console.log(`  Estado         : ${endpoint.status}`);
  console.log(`  Llega al API   : ${alcanzaElApi ? 'sí' : 'NO — esa URL no la atiende el API'}`);
  console.log(`  Eventos        : ${eventosBien ? 'correctos' : 'INCORRECTOS'}`);
  if (!eventosBien) {
    if (faltan.length) console.log(`     faltan → ${faltan.join(', ')}`);
    if (sobran.length) console.log(`     sobran → ${sobran.join(', ')}`);
    console.log('     Se corrige con --reparar.');
  }
  if (!alcanzaElApi) {
    console.log('     La URL debe ser la del API: https://<dominio-del-API>/api/v1/payments/webhook');
    console.log('     Se corrige con --reparar --url <esa URL>.');
  }

  return alcanzaElApi && eventosBien;
}

async function revisarCobro(stripe: Stripe): Promise<boolean> {
  console.log('');
  console.log('── Cobro de prueba ────────────────────────');

  const intent = await stripe.paymentIntents.create({
    amount: IMPORTE_DE_PRUEBA_CENTIMOS,
    currency: 'eur',
    automatic_payment_methods: { enabled: true },
    metadata: { diagnostico: 'true' },
  });
  console.log(`  Métodos que se ofrecerían en un pago de ${IMPORTE_DE_PRUEBA_CENTIMOS / 100} €:`);
  console.log(`     ${intent.payment_method_types.join(', ')}`);
  console.log('     (cuáles ve cada cliente depende de su país, moneda y dispositivo;');
  console.log('      se activan en dashboard.stripe.com → Configuración → Métodos de pago)');

  const publicable = clavePublicable();
  let coincide = true;
  if (!publicable) {
    console.log('  Clave publicable: no se ha dado (--pk) ni está en apps/web/.env; no se comprueba.');
  } else {
    // La clave publicable sólo puede leer intents de su propia cuenta.
    const respuesta = await fetch(
      `https://api.stripe.com/v1/payment_intents/${intent.id}?client_secret=${intent.client_secret}`,
      { headers: { Authorization: `Bearer ${publicable}` } },
    );
    coincide = respuesta.ok;
    console.log(`  Clave publicable (${publicable.slice(0, 12)}…): ${coincide
      ? 'es de esta cuenta'
      : 'ES DE OTRA CUENTA — el formulario de pago no cargará'}`);
    if (!coincide) {
      console.log('     La correcta está en dashboard.stripe.com → Desarrolladores → Claves de API,');
      console.log('     y va en WEB_STRIPE_PUBLIC_KEY (apps/web/.env en local, Coolify en producción).');
    }
  }

  await stripe.paymentIntents.cancel(intent.id);
  return coincide;
}

async function diagnosticar(): Promise<void> {
  const secreta = process.env['STRIPE_SECRET_KEY'];
  if (!secreta) {
    console.log('❌  Sin STRIPE_SECRET_KEY no se puede cobrar nada.');
    process.exit(1);
  }

  const stripe = new Stripe(secreta);
  await revisarCuenta(stripe, secreta);
  const webhookBien = await revisarWebhook(stripe, process.argv.includes('--reparar'));
  const cobroBien = await revisarCobro(stripe);

  console.log('');
  if (webhookBien && cobroBien) {
    console.log('✅  Stripe está bien configurado para este entorno.');
    return;
  }
  console.log('❌  Hay configuración que corregir (ver arriba).');
  process.exit(1);
}

diagnosticar().catch((error: unknown) => {
  console.error('❌  El diagnóstico ha fallado:', error instanceof Error ? error.message : error);
  process.exit(1);
});
