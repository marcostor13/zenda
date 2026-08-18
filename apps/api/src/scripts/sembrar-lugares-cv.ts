/**
 * sembrar-lugares-cv.ts — carga del censo `docs/municipios_final.xlsx`
 *
 * Uso:
 *   bun run --cwd apps/api sembrar:lugares-cv                  (simulación)
 *   bun run --cwd apps/api sembrar:lugares-cv -- --aplicar
 *   bun run --cwd apps/api sembrar:lugares-cv -- --aplicar --geo
 *
 * Llena `/explora` con los recursos caninos de los 542 municipios de la
 * Comunitat Valenciana: playas caninas, tramos de río y pipicanes. La conversión
 * de cada fila vive en `core/lugares/municipios-cv.ts`, que sí tiene tests; aquí
 * sólo se lee el fichero, se geocodifica si se pide y se guarda.
 *
 * **Idempotente**: cada ficha se identifica por tipo + ciudad + nombre, así que
 * volver a ejecutarlo actualiza lo que ya existe en vez de duplicarlo.
 *
 * `--geo` añade las coordenadas de cada municipio con Places (New), la misma API
 * que usa `GeoService`. Sin ellas las fichas salen en el listado y en los
 * filtros, pero **no en el mapa ni en "cerca de mí"**, que necesitan un punto.
 */
// Los DTOs de `shared` llevan decoradores de class-validator, que necesitan el
// registro de metadatos disponible antes de importarlos.
import 'reflect-metadata';
import mongoose from 'mongoose';
import * as dotenv from 'dotenv';
import * as path from 'path';
import * as XLSX from 'xlsx';
import { lugaresDeMunicipio, type FilaMunicipio, type LugarSembrado } from '../core/lugares/municipios-cv';

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const MONGODB_URI = process.env['MONGODB_URI'];
if (!MONGODB_URI) {
  console.error('❌  MONGODB_URI no definida en .env');
  process.exit(1);
}

const APLICAR = process.argv.includes('--aplicar');
const CON_GEO = process.argv.includes('--geo');

const HOJA = path.resolve(__dirname, '../../../../docs/municipios_final.xlsx');

const PLACES_AUTOCOMPLETE_URL = 'https://places.googleapis.com/v1/places:autocomplete';
const PLACES_DETAILS_URL = 'https://places.googleapis.com/v1/places';

/** Pausa entre llamadas a Google: no hay prisa y evita topar con el límite. */
const PAUSA_MS = 120;

const esperar = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms));

/**
 * Coordenadas del municipio con Places (New), en dos pasos como `GeoService`:
 * autocompletado para obtener el `placeId` y detalles para el punto. Devuelve
 * `null` ante cualquier fallo: una ficha sin mapa es mejor que no cargarla.
 */
async function coordenadasDe(
  municipio: string,
  provincia: string | undefined,
  apiKey: string,
): Promise<[number, number] | null> {
  const consulta = provincia ? `${municipio}, ${provincia}, España` : `${municipio}, España`;

  try {
    const sugerencias = await fetch(PLACES_AUTOCOMPLETE_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Goog-Api-Key': apiKey },
      body: JSON.stringify({
        input: consulta,
        includedPrimaryTypes: ['locality', 'administrative_area_level_2'],
        includedRegionCodes: ['es'],
        languageCode: 'es',
      }),
    });
    if (!sugerencias.ok) return null;

    const datos = (await sugerencias.json()) as {
      suggestions?: Array<{ placePrediction?: { placeId?: string } }>;
    };
    const placeId = datos.suggestions?.[0]?.placePrediction?.placeId;
    if (!placeId) return null;

    const detalles = await fetch(`${PLACES_DETAILS_URL}/${encodeURIComponent(placeId)}`, {
      headers: { 'X-Goog-Api-Key': apiKey, 'X-Goog-FieldMask': 'location' },
    });
    if (!detalles.ok) return null;

    const punto = (await detalles.json()) as { location?: { latitude?: number; longitude?: number } };
    const lat = punto.location?.latitude;
    const lng = punto.location?.longitude;
    if (lat == null || lng == null) return null;

    // GeoJSON guarda [lng, lat], no al revés.
    return [lng, lat];
  } catch {
    return null;
  }
}

/** Lee la hoja y devuelve las fichas que produce, ya normalizadas. */
function leerCenso(): { fichas: LugarSembrado[]; municipios: number } {
  const libro = XLSX.readFile(HOJA);
  const hoja = libro.Sheets['Resultados'];
  if (!hoja) throw new Error("La hoja 'Resultados' no está en el fichero");

  const filas = XLSX.utils.sheet_to_json<Record<string, string>>(hoja, { defval: '' });

  const fichas = filas.flatMap((f) =>
    lugaresDeMunicipio({
      provincia: f['Provincia'],
      comarca: f['Comarca'],
      municipio: f['Municipio'],
      playaCanina: f['Playa canina'],
      rio: f['Rio'],
      pipican: f['Pipican'],
    } as FilaMunicipio),
  );

  return { fichas, municipios: filas.length };
}

async function sembrar(): Promise<void> {
  const { fichas, municipios } = leerCenso();

  const porTipo = fichas.reduce<Record<string, number>>((acc, f) => {
    acc[f.tipo] = (acc[f.tipo] ?? 0) + 1;
    return acc;
  }, {});

  console.log('── Censo leído ────────────────────────────');
  console.log(`Municipios en la hoja : ${municipios}`);
  console.log(`Fichas a sembrar      : ${fichas.length}`);
  for (const [tipo, n] of Object.entries(porTipo)) {
    console.log(`  ${tipo.padEnd(12)}: ${n}`);
  }

  const apiKey = process.env['GOOGLE_MAPS_API_KEY'];
  if (CON_GEO && !apiKey) {
    console.error('❌  --geo necesita GOOGLE_MAPS_API_KEY en .env');
    process.exit(1);
  }
  if (!CON_GEO) {
    console.log('');
    console.log('ℹ️  Sin --geo: las fichas saldrán en el listado y los filtros, pero');
    console.log('   NO en el mapa ni en "cerca de mí", que necesitan coordenadas.');
  }

  if (!APLICAR) {
    console.log('');
    console.log('Ejemplos de lo que se crearía:');
    for (const f of fichas.slice(0, 5)) {
      console.log(`   · [${f.tipo}] ${f.nombre} — ${f.ubicacion.ciudad} (${f.ubicacion.provincia})`);
    }
    console.log('');
    console.log('ℹ️  Simulación. Vuelve a ejecutarlo con --aplicar para guardar.');
    return;
  }

  await mongoose.connect(MONGODB_URI as string);
  const db = mongoose.connection.db;
  if (!db) throw new Error('Sin conexión a la base de datos');
  const lugares = db.collection('lugares');

  // Una consulta a Google por municipio, no por ficha: un pueblo con playa, río
  // y pipicán comparte el mismo punto.
  const puntos = new Map<string, [number, number] | null>();
  let geocodificados = 0;

  let creados = 0;
  let actualizados = 0;

  for (const ficha of fichas) {
    let geo: { type: 'Point'; coordinates: [number, number] } | undefined;

    if (CON_GEO) {
      const clave = `${ficha.ubicacion.ciudad}|${ficha.ubicacion.provincia ?? ''}`;
      if (!puntos.has(clave)) {
        puntos.set(clave, await coordenadasDe(ficha.ubicacion.ciudad, ficha.ubicacion.provincia, apiKey as string));
        await esperar(PAUSA_MS);
      }
      const punto = puntos.get(clave);
      if (punto) {
        geo = { type: 'Point', coordinates: punto };
        geocodificados++;
      }
    }

    const clave = {
      tipo: ficha.tipo,
      'ubicacion.ciudad': ficha.ubicacion.ciudad,
      nombre: ficha.nombre,
    };

    const resultado = await lugares.updateOne(
      clave,
      {
        $set: {
          ...ficha,
          ubicacion: { ...ficha.ubicacion, ...(geo ? { geo } : {}) },
          updatedAt: new Date(),
        },
        $setOnInsert: { createdAt: new Date(), ratingPromedio: 0, totalReviews: 0, reportes: 0 },
      },
      { upsert: true },
    );

    if (resultado.upsertedCount) creados++;
    else if (resultado.modifiedCount) actualizados++;
  }

  console.log('');
  console.log('── Resumen ────────────────────────────────');
  console.log(`Fichas creadas        : ${creados}`);
  console.log(`Fichas actualizadas   : ${actualizados}`);
  if (CON_GEO) console.log(`Con coordenadas       : ${geocodificados} de ${fichas.length}`);

  await mongoose.disconnect();
}

sembrar().catch((error) => {
  console.error('❌  Error sembrando los lugares:', error);
  process.exit(1);
});
