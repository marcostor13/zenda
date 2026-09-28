/**
 * sembrar-lugares-explora.ts — restaurantes pet friendly y tiendas de animales
 * de la Comunitat Valenciana (PDF del cliente, 24-09-2026)
 *
 * Uso:
 *   bun run --cwd apps/api sembrar:lugares-explora                (simulación)
 *   bun run --cwd apps/api sembrar:lugares-explora -- --aplicar
 *
 * Lee `docs/datos/explora-cv-2026-09-24.json`. La conversión de cada fila vive
 * en `core/lugares/explora-cv.ts`, que tiene tests; aquí sólo se geocodifica y
 * se guarda.
 *
 * - **Tiendas (62)**: se publican; vienen comprobadas con los localizadores
 *   oficiales de Miscota, Tiendanimal y Kiwoko.
 * - **Restaurantes (32)**: entran **pendientes de moderación**. El propio PDF
 *   avisa de que es una selección documental sin confirmar por teléfono; se
 *   aprueban uno a uno desde Admin → Comunidad después de llamar al local.
 *
 * A diferencia del censo de municipios, aquí se geocodifica **la dirección**, no
 * el pueblo: un restaurante en el centro del municipio no sirve para «cómo
 * llegar». Si la dirección no se encuentra, se usa el centro de la población y
 * se avisa en el resumen para revisarlo a mano.
 *
 * **Idempotente**: tipo + población + nombre identifican la ficha.
 */
import 'reflect-metadata';
import mongoose from 'mongoose';
import * as fs from 'fs';
import * as path from 'path';
import { EstadoModeracion } from 'shared';
import { prepararEntorno } from './entorno';
import { FilaExplora, LugarExplora, lugaresDeFilas } from '../core/lugares/explora-cv';
import { slugDeLugar, slugLibre } from '../core/lugares/slug.util';
import { Geocodificador, Punto, elegirGeocodificador } from './geocodificar';

const MONGODB_URI = prepararEntorno();
const APLICAR = process.argv.includes('--aplicar');

const FICHERO = path.resolve(__dirname, '../../../../docs/datos/explora-cv-2026-09-24.json');

interface Geocodificado {
  geo?: { type: 'Point'; coordinates: Punto };
  precision: 'direccion' | 'poblacion' | 'ninguna';
}

async function situar(lugar: LugarExplora, buscar: Geocodificador): Promise<Geocodificado> {
  const { ciudad, provincia, direccion } = lugar.ubicacion;
  const exacto = await buscar(`${lugar.nombre.split(' · ')[0]}, ${direccion}, ${ciudad}, ${provincia}, España`)
    ?? await buscar(`${direccion}, ${ciudad}, ${provincia}, España`);
  if (exacto) return { geo: { type: 'Point', coordinates: exacto }, precision: 'direccion' };

  const centro = await buscar(`${ciudad}, ${provincia}, España`);
  return centro
    ? { geo: { type: 'Point', coordinates: centro }, precision: 'poblacion' }
    : { precision: 'ninguna' };
}

function leer(): LugarExplora[] {
  const datos = JSON.parse(fs.readFileSync(FICHERO, 'utf8')) as { lugares: FilaExplora[] };
  return lugaresDeFilas(datos.lugares);
}

function resumirLectura(lugares: LugarExplora[]): void {
  const cuenta = (filtro: (l: LugarExplora) => boolean): number => lugares.filter(filtro).length;
  console.log('── Fichero leído ──────────────────────────');
  console.log(`Fichas              : ${lugares.length}`);
  console.log(`  tiendas           : ${cuenta((l) => l.tipo === 'tienda')} (se publican)`);
  console.log(`  restaurantes      : ${cuenta((l) => l.tipo === 'restaurante')} (pendientes de moderación)`);
}

async function asignarSlug(
  lugares: mongoose.mongo.Collection, id: mongoose.Types.ObjectId, lugar: LugarExplora,
): Promise<void> {
  const slug = await slugLibre(slugDeLugar(lugar.nombre.replace(' · ', ' '), lugar.ubicacion.ciudad), async (candidato) =>
    (await lugares.countDocuments({ slug: candidato, _id: { $ne: id } })) > 0);
  await lugares.updateOne({ _id: id, slug: { $exists: false } }, { $set: { slug } });
}

async function sembrar(): Promise<void> {
  const fichas = leer();
  resumirLectura(fichas);

  if (!APLICAR) {
    console.log('');
    for (const f of fichas.slice(0, 6)) console.log(`   · [${f.tipo}] ${f.nombre} — ${f.ubicacion.ciudad}`);
    console.log('');
    console.log('ℹ️  Simulación. Vuelve a ejecutarlo con --aplicar para guardar.');
    return;
  }

  const { buscar, proveedor } = await elegirGeocodificador();
  console.log(`Geocodificador      : ${proveedor}`);

  await mongoose.connect(MONGODB_URI as string);
  const db = mongoose.connection.db;
  if (!db) throw new Error('Sin conexión a la base de datos');
  const lugares = db.collection('lugares');

  let creados = 0;
  let actualizados = 0;
  const aproximados: string[] = [];

  for (const ficha of fichas) {
    const { geo, precision } = await situar(ficha, buscar);
    if (precision !== 'direccion') aproximados.push(`${ficha.nombre} (${ficha.ubicacion.ciudad}): ${precision}`);

    const clave = { tipo: ficha.tipo, 'ubicacion.ciudad': ficha.ubicacion.ciudad, nombre: ficha.nombre };
    // El estado sólo se fija al crear: si un admin ya aprobó un restaurante, volver
    // a sembrar no puede devolverlo a la cola de moderación.
    const { estado, ...resto } = ficha;
    const resultado = await lugares.updateOne(
      clave,
      {
        $set: { ...resto, ubicacion: { ...ficha.ubicacion, ...(geo ? { geo } : {}) }, updatedAt: new Date() },
        $setOnInsert: { estado, createdAt: new Date(), ratingPromedio: 0, totalReviews: 0, reportes: 0 },
      },
      { upsert: true },
    );
    if (resultado.upsertedCount) creados++;
    else if (resultado.modifiedCount) actualizados++;

    // Las pendientes reciben el slug al publicarse (LugaresService.moderar).
    if (estado === EstadoModeracion.PUBLICADO) {
      const guardado = await lugares.findOne(clave, { projection: { _id: 1 } });
      if (guardado) await asignarSlug(lugares, guardado._id, ficha);
    }
  }

  console.log('');
  console.log('── Resumen ────────────────────────────────');
  console.log(`Creadas             : ${creados}`);
  console.log(`Actualizadas        : ${actualizados}`);
  console.log(`Sin dirección exacta: ${aproximados.length}`);
  for (const linea of aproximados) console.log(`   · ${linea}`);

  await mongoose.disconnect();
}

sembrar().catch((error) => {
  console.error('❌  Error sembrando los lugares:', error);
  process.exit(1);
});
