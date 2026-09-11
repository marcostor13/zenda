/**
 * migrar-slugs-lugares.ts — Auditoría SEO 2026-09-11, hallazgo SEO-7
 *
 * Uso:
 *   bun run --cwd apps/api migrar:slugs-lugares            (simulación)
 *   bun run --cwd apps/api migrar:slugs-lugares -- --aplicar
 *
 * Las fichas de `/explora` vivían en direcciones como
 * `/explora/6a8451c2756a745fe5e230eb`: funcionaban, pero no se pueden leer, ni
 * recordar, ni dictar, y compartidas por WhatsApp no dicen nada de lo que hay al
 * otro lado. Con este campo pasan a `/explora/rio-jucar-riola`.
 *
 * **Los enlaces antiguos siguen funcionando**: el API acepta id o slug, y la
 * ficha redirige al slug. Este script sólo rellena el campo que falta.
 *
 * Es idempotente: una ficha que ya tiene slug no se toca nunca, porque cambiarlo
 * rompería los enlaces que ya circulan.
 */
import mongoose from 'mongoose';
import { prepararEntorno } from './entorno';
import { slugDeLugar, slugLibre } from '../core/lugares/slug.util';

// Carga el .env y fija los DNS antes de conectar (ver `entorno.ts`).
const MONGODB_URI = prepararEntorno();

const APLICAR = process.argv.includes('--aplicar');

interface FichaSinSlug {
  _id: unknown;
  nombre?: string;
  ubicacion?: { ciudad?: string };
}

async function migrar(): Promise<void> {
  await mongoose.connect(MONGODB_URI as string);
  const db = mongoose.connection.db;
  if (!db) throw new Error('Sin conexión a la base de datos');

  const lugares = db.collection('lugares');

  const total = await lugares.countDocuments({});
  const pendientes = await lugares
    .find({ $or: [{ slug: { $exists: false } }, { slug: null }, { slug: '' }] })
    .project({ _id: 1, nombre: 1, 'ubicacion.ciudad': 1 })
    .toArray() as FichaSinSlug[];

  /*
   * Los slugs ya asignados se guardan en memoria además de consultarse en la
   * base: dentro de una misma ejecución, dos fichas homónimas se numerarían
   * igual porque ninguna de las dos está escrita todavía.
   */
  const asignados = new Set<string>();
  const existentes = await lugares.distinct('slug', { slug: { $type: 'string' } });
  for (const slug of existentes) asignados.add(String(slug));

  const cambios: { id: unknown; nombre: string; slug: string }[] = [];

  for (const ficha of pendientes) {
    const base = slugDeLugar(ficha.nombre ?? '', ficha.ubicacion?.ciudad);
    const slug = await slugLibre(base, async (candidato) => asignados.has(candidato));

    asignados.add(slug);
    cambios.push({ id: ficha._id, nombre: ficha.nombre ?? '(sin nombre)', slug });
  }

  if (APLICAR) {
    for (const cambio of cambios) {
      await lugares.updateOne({ _id: cambio.id as never }, { $set: { slug: cambio.slug } });
    }
  }

  console.log('');
  console.log('── Resumen ────────────────────────────────');
  console.log(`Fichas totales          : ${total}`);
  console.log(`Ya tenían dirección     : ${total - pendientes.length}`);
  console.log(`Direcciones a asignar   : ${cambios.length}`);

  if (cambios.length) {
    console.log('');
    console.log('── Primeras direcciones ───────────────────');
    for (const cambio of cambios.slice(0, 15)) {
      console.log(`  ${cambio.nombre.padEnd(38).slice(0, 38)} → /explora/${cambio.slug}`);
    }
    if (cambios.length > 15) console.log(`  … y ${cambios.length - 15} más`);
  }

  if (!APLICAR) {
    console.log('');
    console.log('ℹ️  Simulación. Vuelve a ejecutarlo con --aplicar para guardar los cambios.');
  }

  await mongoose.disconnect();
}

migrar().catch((error) => {
  console.error('❌  Error en la migración:', error);
  process.exit(1);
});
