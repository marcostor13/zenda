import * as dns from 'dns';
import * as dotenv from 'dotenv';
import * as path from 'path';

/**
 * Arranque común de los scripts de línea de comandos.
 *
 * Carga el `.env` del API y fija los servidores DNS **antes** de que nadie
 * intente conectar. Sin esto, la resolución `SRV` de `mongodb+srv://` falla con
 * `querySrv ECONNREFUSED` en cualquier red cuyo DNS no responda a consultas SRV
 * —routers domésticos y VPN corporativas, sobre todo—, y el script muere sin
 * llegar a tocar la base de datos.
 *
 * `main.ts` hace lo mismo para el servidor; esto es su equivalente para los
 * scripts, que se ejecutan sueltos y no pasan por el bootstrap de NestJS.
 */

/** Resolutores públicos: los mismos que usa `seed-admin` desde siempre. */
const DNS_POR_DEFECTO = '8.8.8.8,1.1.1.1';

/** @returns la cadena de conexión ya validada, para no repetir la comprobación. */
export function prepararEntorno(): string {
  dotenv.config({ path: path.resolve(__dirname, '../../.env') });

  dns.setServers((process.env['NODE_DNS_SERVERS'] ?? DNS_POR_DEFECTO).split(','));

  const uri = process.env['MONGODB_URI'];
  if (!uri) {
    console.error('❌  MONGODB_URI no definida en .env');
    process.exit(1);
  }

  return uri;
}
