/**
 * diagnostico-email.ts — sólo lectura salvo que se pida un envío de prueba
 *
 * Uso:
 *   bun run --cwd apps/api diagnostico:email
 *   bun run --cwd apps/api diagnostico:email -- --enviar tu@correo.com
 *
 * Responde a «¿por qué no llega ningún correo?» antes de mirar el código. El
 * fallo más habitual no está en la plataforma: **Resend sólo acepta envíos
 * desde un dominio verificado en la cuenta**, y hasta que `doogking.com` no lo
 * esté, todo envío a un tercero se rechaza con 403 y queda como `fallido` en la
 * colección `notificaciones`.
 *
 * Sin `--enviar` no manda ningún correo: sólo consulta la clave, los dominios
 * de la cuenta y si el remitente configurado pertenece a uno verificado.
 */
import { config as cargarEnv } from 'dotenv';
import * as path from 'path';

/*
 * Carga el `.env` a mano y no con `prepararEntorno()`: ese exige `MONGODB_URI`
 * y sale si falta, y aquí no se toca la base de datos. Un diagnóstico de correo
 * tiene que poder ejecutarse aunque la conexión a Mongo no esté a mano.
 */
cargarEnv({ path: path.resolve(__dirname, '../../.env') });

const API = 'https://api.resend.com';
const REMITENTE_POR_DEFECTO = 'hola@doogking.com';

interface DominioResend {
  name: string;
  status: string;
  region?: string;
}

/** `--enviar destino@x.com`; sin la bandera no se manda nada. */
function destinoDePrueba(): string | null {
  const i = process.argv.indexOf('--enviar');
  return i >= 0 ? process.argv[i + 1] ?? null : null;
}

async function diagnosticar(): Promise<void> {
  const clave = process.env['RESEND_API_KEY'];
  const remitente = process.env['EMAIL_FROM'] ?? REMITENTE_POR_DEFECTO;
  const nombre = process.env['EMAIL_FROM_NOMBRE'] ?? 'Doogking';

  console.log('── Configuración ──────────────────────────');
  console.log(`  RESEND_API_KEY : ${clave ? `presente (${clave.slice(0, 3)}…)` : 'AUSENTE'}`);
  console.log(`  Remitente      : ${nombre} <${remitente}>`);

  if (!clave) {
    console.log('');
    console.log('❌  Sin RESEND_API_KEY no sale ningún correo. Se saca en resend.com → API Keys.');
    process.exit(1);
  }

  const cabeceras = { Authorization: `Bearer ${clave}`, 'Content-Type': 'application/json' };

  console.log('');
  console.log('── Dominios de la cuenta ──────────────────');
  const respuesta = await fetch(`${API}/domains`, { headers: cabeceras });

  if (!respuesta.ok) {
    console.log(`❌  Resend respondió ${respuesta.status}: ${JSON.stringify(await respuesta.json())}`);
    console.log('    Un 401 significa que la clave no vale o es de otra cuenta.');
    process.exit(1);
  }

  const { data = [] } = (await respuesta.json()) as { data?: DominioResend[] };
  if (!data.length) console.log('  (ninguno dado de alta)');
  for (const d of data) console.log(`  ${d.name.padEnd(38)} ${d.status}`);

  const dominioRemitente = remitente.split('@')[1] ?? '';
  const suyo = data.find((d) => d.name.toLowerCase() === dominioRemitente.toLowerCase());

  console.log('');
  console.log('── ¿Puede salir el correo? ────────────────');
  if (!suyo) {
    console.log(`❌  "${dominioRemitente}" no está dado de alta en esta cuenta de Resend.`);
    console.log('    Mientras no lo esté, cualquier envío a un tercero se rechaza con 403.');
    console.log('    Resend → Domains → Add Domain, y publicar los registros DNS de SPF y DKIM.');
  } else if (suyo.status !== 'verified') {
    console.log(`❌  "${dominioRemitente}" está dado de alta pero en estado "${suyo.status}".`);
    console.log('    Faltan registros DNS por publicar o por propagar.');
  } else {
    console.log(`✅  "${dominioRemitente}" está verificado: el correo puede salir.`);
  }

  const destino = destinoDePrueba();
  if (!destino) {
    console.log('');
    console.log('ℹ️  Para probar un envío real: -- --enviar tu@correo.com');
    return;
  }

  console.log('');
  console.log(`── Envío de prueba a ${destino} ──`);
  const envio = await fetch(`${API}/emails`, {
    method: 'POST',
    headers: cabeceras,
    body: JSON.stringify({
      from: `${nombre} <${remitente}>`,
      to: [destino],
      subject: 'Prueba de envío de Doogking',
      html: '<p>Si lees esto, el correo transaccional de Doogking sale correctamente.</p>',
    }),
  });

  const cuerpo = await envio.json();
  console.log(`  ${envio.status} · ${JSON.stringify(cuerpo)}`);
  console.log(envio.ok ? '✅  Aceptado por Resend.' : '❌  Rechazado; el motivo está arriba.');
}

diagnosticar().catch((error) => {
  console.error('❌  Error en el diagnóstico:', error);
  process.exit(1);
});
