/**
 * diagnostico-ubicaciones.ts — sólo lectura
 *
 * Uso:
 *   bun run --cwd apps/api diagnostico:ubicaciones             (todos los publicados sin coordenadas)
 *   bun run --cwd apps/api diagnostico:ubicaciones -- "texto"  (filtra por nombre de comercio o listado)
 *
 * Responde a "guardé la ubicación pero no sale en el mapa, ¿no se guardaron las
 * coordenadas?". El buscador por mapa (`GET /catalog/servicios/mapa`) sólo
 * devuelve pines de listados con `ubicacion.geo.coordinates`; el resumen
 * "N resultados · M sin ubicación exacta" ya lo dice, pero no dice *por qué*
 * falta. Este script mira el documento real para saberlo:
 *   - sin `ubicacion.geo` en absoluto → nunca se eligió una sugerencia del
 *     desplegable de población/dirección al guardar (guardar texto libre no
 *     geocodifica).
 *   - el comercio SÍ tiene su dirección fiscal geocodificada → el backfill
 *     (`situarServiciosSinCoordenadas`) sólo actúa sobre listados que a esa
 *     fecha no tuvieran coordenadas; si el listado se creó después sin elegir
 *     población, sigue sin ellas.
 *
 * **No escribe nada.**
 */
import mongoose, { Types } from 'mongoose';
import { prepararEntorno } from './entorno';

const MONGODB_URI = prepararEntorno();

const FILTRO_TEXTO = process.argv[2];

async function diagnosticar(): Promise<void> {
  await mongoose.connect(MONGODB_URI as string);
  const db = mongoose.connection.db;
  if (!db) throw new Error('Sin conexión a la base de datos');

  const servicios = db.collection('servicios');
  const comercios = db.collection('comercios');

  console.log('── Listados publicados, con o sin coordenadas ──────────');
  const [conGeo, sinGeo] = await Promise.all([
    servicios.countDocuments({ estado: 'publicado', 'ubicacion.geo.coordinates': { $exists: true } }),
    servicios.countDocuments({ estado: 'publicado', 'ubicacion.geo.coordinates': { $exists: false } }),
  ]);
  console.log(`  con coordenadas    : ${conGeo}`);
  console.log(`  SIN coordenadas    : ${sinGeo}  ← invisibles en el mapa, cuentan en el total`);

  const filtroMongo: Record<string, unknown> = {
    estado: 'publicado',
    'ubicacion.geo.coordinates': { $exists: false },
  };
  if (FILTRO_TEXTO) filtroMongo['titulo'] = { $regex: FILTRO_TEXTO, $options: 'i' };

  const sinUbicar = await servicios
    .find(filtroMongo, { projection: { titulo: 1, comercioId: 1, 'ubicacion.ciudad': 1, vertical: 1 } })
    .limit(30)
    .toArray();

  if (!sinUbicar.length) {
    console.log('');
    console.log(FILTRO_TEXTO ? 'Ningún listado publicado coincide con ese filtro y le falta ubicación.' : 'Nada pendiente: todo lo publicado tiene coordenadas.');
    await mongoose.disconnect();
    return;
  }

  console.log('');
  console.log('── Detalle de los que faltan (máx. 30) ──────────────────');
  const idsComercio = [...new Set(sinUbicar.map((s) => String(s['comercioId'])))].map((id) => new Types.ObjectId(id));
  const susComercios = await comercios
    .find({ _id: { $in: idsComercio } }, { projection: { nombreComercial: 1, 'direccion.lat': 1, 'direccion.lng': 1, 'direccion.ciudad': 1 } })
    .toArray();
  const comercioPorId = new Map(susComercios.map((c) => [String(c['_id']), c]));

  for (const s of sinUbicar) {
    const comercio = comercioPorId.get(String(s['comercioId']));
    const direccion = (comercio?.['direccion'] ?? {}) as { lat?: number; lng?: number; ciudad?: string };
    const comercioGeocodificado = Number.isFinite(direccion.lat) && Number.isFinite(direccion.lng);

    console.log(`  · "${s['titulo']}" (${s['vertical']}) — ciudad guardada: "${(s['ubicacion'] as { ciudad?: string } | undefined)?.ciudad ?? '(vacía)'}"`);
    console.log(`      comercio: ${comercio?.['nombreComercial'] ?? '(no encontrado)'}`);
    if (comercioGeocodificado) {
      // El backfill sólo corre al GUARDAR la dirección del comercio; si el
      // listado se creó después de esa fecha, no se benefició de él.
      console.log('      → el comercio SÍ tiene su dirección fiscal geocodificada.');
      console.log('        Este listado se creó (o se le cambió la ciudad) después de eso: para');
      console.log('        situarlo hay que reabrir "Ubicación" en el listado y elegir la población');
      console.log('        de la lista desplegable (no basta con volver a guardar el comercio).');
    } else {
      console.log('      → el comercio TAMPOCO tiene dirección fiscal geocodificada.');
      console.log('        Nunca se eligió una sugerencia del desplegable de calle/población.');
    }
    console.log('');
  }

  await mongoose.disconnect();
}

diagnosticar().catch((error) => {
  console.error('❌  Error en el diagnóstico:', error);
  process.exit(1);
});
