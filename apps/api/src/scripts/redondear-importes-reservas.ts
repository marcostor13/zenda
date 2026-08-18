/**
 * redondear-importes-reservas.ts — Auditoría 2026-08-17, hallazgo E2
 *
 * Uso:
 *   bun run --cwd apps/api redondear:importes            (simulación)
 *   bun run --cwd apps/api redondear:importes -- --aplicar
 *
 * `BookingsService.crear` calculaba IVA, comisión y total sin redondear, así que
 * se persistieron importes de coma flotante (121.34000000000002). El código ya
 * está corregido; esto arregla lo que quedó guardado antes, que de otro modo
 * seguiría ensuciando los agregados del reporte financiero del admin.
 *
 * Sólo redondea al céntimo. **No recalcula nada**: si un importe estuviera mal
 * por otro motivo, este script no lo toca ni lo disimula.
 */
import mongoose from 'mongoose';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const MONGODB_URI = process.env['MONGODB_URI'];
if (!MONGODB_URI) {
  console.error('❌  MONGODB_URI no definida en .env');
  process.exit(1);
}

const APLICAR = process.argv.includes('--aplicar');

/** Campos monetarios de una reserva, en euros. */
const CAMPOS = ['montoSubtotal', 'comisionMonto', 'montoTotal', 'descuentoMonto', 'montoAjustado'] as const;

type CampoMonetario = (typeof CAMPOS)[number];

const redondearEuros = (importe: number): number => Math.round(importe * 100) / 100;

/** true si el valor guardado tiene más de dos decimales significativos. */
function necesitaRedondeo(valor: unknown): valor is number {
  return typeof valor === 'number' && Number.isFinite(valor) && valor !== redondearEuros(valor);
}

async function migrar(): Promise<void> {
  await mongoose.connect(MONGODB_URI as string);
  const db = mongoose.connection.db;
  if (!db) throw new Error('Sin conexión a la base de datos');

  const reservas = db.collection('reservas');
  const cursor = reservas.find({}, { projection: { _id: 1, codigo: 1, ...camposProyectados() } });

  let revisadas = 0;
  let tocadas = 0;
  const porCampo: Record<string, number> = {};
  const ejemplos: string[] = [];

  for await (const reserva of cursor) {
    revisadas++;
    const cambios: Partial<Record<CampoMonetario, number>> = {};

    for (const campo of CAMPOS) {
      const valor = (reserva as Record<string, unknown>)[campo];
      if (!necesitaRedondeo(valor)) continue;

      cambios[campo] = redondearEuros(valor);
      porCampo[campo] = (porCampo[campo] ?? 0) + 1;

      if (ejemplos.length < 10) {
        ejemplos.push(`   · ${String(reserva['codigo'])} ${campo}: ${valor} → ${redondearEuros(valor)}`);
      }
    }

    if (!Object.keys(cambios).length) continue;
    tocadas++;

    if (APLICAR) {
      await reservas.updateOne({ _id: reserva._id }, { $set: cambios });
    }
  }

  console.log('');
  console.log('── Resumen ────────────────────────────────');
  console.log(`Reservas revisadas          : ${revisadas}`);
  console.log(`Reservas con importes sucios: ${tocadas}`);
  for (const campo of CAMPOS) {
    if (porCampo[campo]) console.log(`  ${campo.padEnd(16)}: ${porCampo[campo]}`);
  }

  if (ejemplos.length) {
    console.log('');
    console.log('Ejemplos:');
    ejemplos.forEach((linea) => console.log(linea));
  }

  if (!APLICAR) {
    console.log('');
    console.log('ℹ️  Simulación. Vuelve a ejecutarlo con --aplicar para guardar los cambios.');
  }

  await mongoose.disconnect();
}

function camposProyectados(): Record<string, 1> {
  return Object.fromEntries(CAMPOS.map((campo) => [campo, 1])) as Record<string, 1>;
}

migrar().catch((error) => {
  console.error('❌  Error en la migración:', error);
  process.exit(1);
});
