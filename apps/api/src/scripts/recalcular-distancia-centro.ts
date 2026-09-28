/**
 * recalcular-distancia-centro.ts — «a X km del centro» para los servicios que
 * ya existían antes de guardarlo
 *
 * Uso:
 *   bun run --cwd apps/api recalcular:distancia-centro                (simulación)
 *   bun run --cwd apps/api recalcular:distancia-centro -- --aplicar
 *   bun run --cwd apps/api recalcular:distancia-centro -- --aplicar --todos
 *
 * Los servicios nuevos o con la ubicación editada lo calculan solos
 * (`CatalogService`). Esto rellena el resto: sitúa el centro de cada población
 * una vez, lo guarda en `centros_poblacion` —la misma colección que usa el
 * API— y escribe `distanciaCentroKm` en cada servicio con coordenadas. Sin
 * `--todos` sólo toca los que aún no lo tienen.
 */
import 'reflect-metadata';
import mongoose from 'mongoose';
import { PuntoGeo, claveUbicacion, distanciaKm, resolverMunicipio } from 'shared';
import { prepararEntorno } from './entorno';
import { Geocodificador, elegirGeocodificador } from './geocodificar';

const MONGODB_URI = prepararEntorno();
const APLICAR = process.argv.includes('--aplicar');
const TODOS = process.argv.includes('--todos');

interface ServicioUbicado {
  _id: mongoose.Types.ObjectId;
  ubicacion: { ciudad: string; provincia?: string; geo: { coordinates: [number, number] } };
}

type Centros = mongoose.mongo.Collection;

async function centroDe(
  centros: Centros, buscar: Geocodificador, ciudad: string, provincia?: string,
): Promise<PuntoGeo | null> {
  const nombre = resolverMunicipio(ciudad)?.municipio.nombre ?? ciudad.trim();
  const clave = claveUbicacion(nombre);
  if (!clave) return null;

  const guardado = await centros.findOne<{ lat: number; lng: number }>({ clave });
  if (guardado) return { lat: guardado.lat, lng: guardado.lng };

  const conProvincia = provincia && claveUbicacion(provincia) !== clave ? `${nombre}, ${provincia}` : nombre;
  const punto = await buscar(`${conProvincia}, España`);
  if (!punto) return null;

  const [lng, lat] = punto;
  await centros.updateOne({ clave }, { $set: { ciudad: nombre, lat, lng, updatedAt: new Date() }, $setOnInsert: { createdAt: new Date() } }, { upsert: true });
  return { lat, lng };
}

async function recalcular(): Promise<void> {
  await mongoose.connect(MONGODB_URI as string);
  const db = mongoose.connection.db;
  if (!db) throw new Error('Sin conexión a la base de datos');

  const filtro: Record<string, unknown> = { 'ubicacion.geo.coordinates.1': { $exists: true } };
  if (!TODOS) filtro['distanciaCentroKm'] = { $exists: false };
  const servicios = await db.collection('servicios')
    .find<ServicioUbicado>(filtro, { projection: { 'ubicacion.ciudad': 1, 'ubicacion.provincia': 1, 'ubicacion.geo': 1 } })
    .toArray();

  console.log(`Servicios con coordenadas a revisar: ${servicios.length}`);
  if (!APLICAR) {
    console.log('ℹ️  Simulación. Vuelve a ejecutarlo con --aplicar para guardar.');
    await mongoose.disconnect();
    return;
  }

  const { buscar, proveedor } = await elegirGeocodificador();
  console.log(`Geocodificador: ${proveedor}`);
  const centros = db.collection('centros_poblacion');

  let actualizados = 0;
  const sinCentro = new Set<string>();
  for (const servicio of servicios) {
    const { ciudad, provincia, geo } = servicio.ubicacion;
    const centro = await centroDe(centros, buscar, ciudad, provincia);
    if (!centro) { sinCentro.add(ciudad); continue; }

    const [lng, lat] = geo.coordinates;
    const km = Math.round(distanciaKm({ lat, lng }, centro) * 10) / 10;
    await db.collection('servicios').updateOne({ _id: servicio._id }, { $set: { distanciaCentroKm: km } });
    actualizados++;
  }

  console.log(`Actualizados: ${actualizados}`);
  if (sinCentro.size) console.log(`Poblaciones sin centro: ${[...sinCentro].join(', ')}`);
  await mongoose.disconnect();
}

recalcular().catch((error) => {
  console.error('❌  Error recalculando distancias:', error);
  process.exit(1);
});
