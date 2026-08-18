/**
 * diagnostico-catalogo.ts — sólo lectura
 *
 * Uso: bun run --cwd apps/api diagnostico:catalogo
 *
 * Responde a "¿qué se vería hoy en el buscador y qué se verá después del
 * backfill de `comercioActivo`?". Se escribió al detectar que el backfill dejaba
 * 0 listados visibles: antes de aplicar una migración que puede vaciar el
 * catálogo hay que saber si eso es lo correcto (comercios de verdad sin aprobar)
 * o el síntoma de otra cosa.
 *
 * **No escribe nada.**
 */
import mongoose from 'mongoose';
import { prepararEntorno } from './entorno';

const MONGODB_URI = prepararEntorno();

async function diagnosticar(): Promise<void> {
  await mongoose.connect(MONGODB_URI as string);
  const db = mongoose.connection.db;
  if (!db) throw new Error('Sin conexión a la base de datos');

  const comercios = db.collection('comercios');
  const servicios = db.collection('servicios');

  console.log('── Comercios por estado ───────────────────');
  const porEstado = await comercios
    .aggregate<{ _id: string; n: number }>([{ $group: { _id: '$estado', n: { $sum: 1 } } }])
    .toArray();
  for (const fila of porEstado) console.log(`  ${String(fila._id).padEnd(12)}: ${fila.n}`);

  console.log('');
  console.log('── Listados por estado ────────────────────');
  const servPorEstado = await servicios
    .aggregate<{ _id: string; n: number }>([{ $group: { _id: '$estado', n: { $sum: 1 } } }])
    .toArray();
  for (const fila of servPorEstado) console.log(`  ${String(fila._id).padEnd(12)}: ${fila.n}`);

  console.log('');
  console.log('── Listados publicados, por estado de su comercio ──');
  const cruce = await servicios
    .aggregate<{ _id: string | null; n: number }>([
      { $match: { estado: 'publicado' } },
      {
        $lookup: {
          from: 'comercios', localField: 'comercioId', foreignField: '_id', as: 'comercio',
        },
      },
      { $group: { _id: { $ifNull: [{ $first: '$comercio.estado' }, 'SIN COMERCIO'] }, n: { $sum: 1 } } },
    ])
    .toArray();
  for (const fila of cruce) console.log(`  ${String(fila._id).padEnd(14)}: ${fila.n}`);

  console.log('');
  console.log('── ¿Por qué no cruzan? ────────────────────');
  /*
   * Un `$lookup` que no encuentra nada tiene dos causas posibles y muy
   * distintas: que el listado apunte a un comercio borrado, o que `comercioId`
   * esté guardado como texto y `_id` sea un ObjectId, en cuyo caso los datos
   * están bien y lo que falla es el tipo.
   */
  const muestra = await servicios
    .find({ estado: 'publicado' }, { projection: { comercioId: 1, titulo: 1 } })
    .limit(200)
    .toArray();

  const tipos = muestra.reduce<Record<string, number>>((acc, s) => {
    const valor = (s as Record<string, unknown>)['comercioId'];
    const tipo = valor === undefined ? 'ausente'
      : valor === null ? 'null'
      : (valor as object).constructor.name;
    acc[tipo] = (acc[tipo] ?? 0) + 1;
    return acc;
  }, {});
  console.log('  tipo de servicios.comercioId:', JSON.stringify(tipos));

  const referencias = [...new Set(
    muestra.map((s) => (s as Record<string, unknown>)['comercioId']).filter(Boolean).map(String),
  )];
  console.log(`  comercios distintos referenciados: ${referencias.length}`);

  const idsComercios = (await comercios.find({}, { projection: { _id: 1 } }).toArray())
    .map((c) => String(c._id));
  const huerfanos = referencias.filter((r) => !idsComercios.includes(r));
  console.log(`  referencias sin comercio existente: ${huerfanos.length}`);
  if (huerfanos.length) console.log('   ', huerfanos.slice(0, 5).join(', '));

  console.log('');
  console.log('── Comercios existentes ───────────────────');
  const fichas = await comercios
    .find({}, { projection: { nombreComercial: 1, estado: 1, createdAt: 1 } })
    .toArray();
  for (const c of fichas) {
    const doc = c as Record<string, unknown>;
    console.log(`  ${String(doc['_id'])} | ${String(doc['estado'])} | ${String(doc['nombreComercial'])}`);
  }

  console.log('');
  console.log('── Reservas sobre los listados publicados ──');
  const reservas = await db.collection('reservas').countDocuments({});
  console.log(`  reservas en total: ${reservas}`);

  console.log('');
  console.log('── Qué vería el buscador ──────────────────');
  const antes = await servicios.countDocuments({ estado: 'publicado' });
  const despues = cruce.find((c) => c._id === 'activo')?.n ?? 0;
  console.log(`  Filtro anterior (sólo publicado)        : ${antes}`);
  console.log(`  Filtro nuevo (publicado + comercio activo): ${despues}`);

  console.log('');
  console.log('── Lugares de /explora ────────────────────');
  const lugares = db.collection('lugares');
  const porTipo = await lugares
    .aggregate<{ _id: string; n: number; conGeo: number }>([
      { $match: { estado: 'publicado' } },
      {
        $group: {
          _id: '$tipo',
          n: { $sum: 1 },
          conGeo: { $sum: { $cond: [{ $ifNull: ['$ubicacion.geo', false] }, 1, 0] } },
        },
      },
    ])
    .toArray();
  for (const t of porTipo) console.log(`  ${String(t._id).padEnd(12)}: ${t.n} (con mapa: ${t.conGeo})`);

  const porProvincia = await lugares
    .aggregate<{ _id: string; n: number }>([
      { $match: { estado: 'publicado' } },
      { $group: { _id: '$ubicacion.provincia', n: { $sum: 1 } } },
      { $sort: { n: -1 } },
    ])
    .toArray();
  console.log('  por provincia:', porProvincia.map((p) => `${p._id}=${p.n}`).join(', '));

  const ejemplo = await lugares.findOne({ estado: 'publicado', 'ubicacion.geo': { $exists: true } });
  if (ejemplo) {
    const doc = ejemplo as Record<string, unknown>;
    const ubi = doc['ubicacion'] as { ciudad: string; geo?: { coordinates: number[] } };
    console.log(`  ejemplo: ${String(doc['nombre'])} — ${ubi.ciudad} ${JSON.stringify(ubi.geo?.coordinates)}`);
  }

  await mongoose.disconnect();
}

diagnosticar().catch((error) => {
  console.error('❌  Error en el diagnóstico:', error);
  process.exit(1);
});
