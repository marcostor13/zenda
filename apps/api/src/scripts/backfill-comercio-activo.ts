/**
 * backfill-comercio-activo.ts — Auditoría 2026-08-17, hallazgo E3
 *
 * Uso:
 *   bun run --cwd apps/api backfill:comercio-activo            (simulación)
 *   bun run --cwd apps/api backfill:comercio-activo -- --aplicar
 *
 * El buscador del catálogo filtraba sólo por `estado: 'publicado'` del listado,
 * así que los servicios de un comercio suspendido o aún pendiente de aprobación
 * seguían siendo públicos y reservables. Ahora el filtro exige además
 * `comercioActivo: true`, un flag denormalizado en `servicios`.
 *
 * **Sin este backfill, el catálogo se queda vacío**: el campo nace con `false`
 * por defecto y ningún listado existente lo tiene todavía.
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

async function migrar(): Promise<void> {
  await mongoose.connect(MONGODB_URI as string);
  const db = mongoose.connection.db;
  if (!db) throw new Error('Sin conexión a la base de datos');

  const comercios = db.collection('comercios');
  const servicios = db.collection('servicios');

  const activos = await comercios.find({ estado: 'activo' }, { projection: { _id: 1 } }).toArray();
  const idsActivos = activos.map((c) => c._id);

  const totalServicios = await servicios.countDocuments({});
  const aActivar = await servicios.countDocuments({
    comercioId: { $in: idsActivos },
    comercioActivo: { $ne: true },
  });
  const aDesactivar = await servicios.countDocuments({
    comercioId: { $nin: idsActivos },
    comercioActivo: { $ne: false },
  });

  if (APLICAR) {
    await servicios.updateMany({ comercioId: { $in: idsActivos } }, { $set: { comercioActivo: true } });
    await servicios.updateMany({ comercioId: { $nin: idsActivos } }, { $set: { comercioActivo: false } });
  }

  console.log('');
  console.log('── Resumen ────────────────────────────────');
  console.log(`Comercios activos            : ${idsActivos.length}`);
  console.log(`Listados totales             : ${totalServicios}`);
  console.log(`Listados que pasan a visibles: ${aActivar}`);
  console.log(`Listados que quedan ocultos  : ${aDesactivar}`);

  if (!APLICAR) {
    console.log('');
    console.log('ℹ️  Simulación. Vuelve a ejecutarlo con --aplicar para guardar los cambios.');
    console.log('⚠️  Hasta que se aplique, el buscador no devolverá ningún listado.');
  }

  await mongoose.disconnect();
}

migrar().catch((error) => {
  console.error('❌  Error en la migración:', error);
  process.exit(1);
});
