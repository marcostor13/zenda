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
 * `--geo` añade las coordenadas de cada municipio. Intenta primero Places (New),
 * la misma API que usa `GeoService`, y si no está disponible cae a Nominatim
 * (OpenStreetMap) — la misma degradación que ya hace el mapa del frontend cuando
 * falta la clave de Google. Sin coordenadas las fichas salen en el listado y en
 * los filtros, pero **no en el mapa ni en "cerca de mí"**.
 */
// Los DTOs de `shared` llevan decoradores de class-validator, que necesitan el
// registro de metadatos disponible antes de importarlos.
import 'reflect-metadata';
import mongoose from 'mongoose';
import * as path from 'path';
import { prepararEntorno } from './entorno';
import * as XLSX from 'xlsx';
import { lugaresDeMunicipio, type FilaMunicipio, type LugarSembrado } from '../core/lugares/municipios-cv';

// Carga el .env y fija los DNS antes de conectar (ver `entorno.ts`).
const MONGODB_URI = prepararEntorno();

const APLICAR = process.argv.includes('--aplicar');
const CON_GEO = process.argv.includes('--geo');

const HOJA = path.resolve(__dirname, '../../../../docs/municipios_final.xlsx');

const PLACES_AUTOCOMPLETE_URL = 'https://places.googleapis.com/v1/places:autocomplete';
const PLACES_DETAILS_URL = 'https://places.googleapis.com/v1/places';
const NOMINATIM_URL = 'https://nominatim.openstreetmap.org/search';

/** Pausa entre llamadas a Google: no hay prisa y evita topar con el límite. */
const PAUSA_MS = 120;

/**
 * Nominatim pide como máximo una consulta por segundo y un User-Agent que
 * identifique a quien llama. Son 111 municipios: dos minutos largos, una sola
 * vez. Respetarlo no es opcional, es su condición de uso.
 */
const PAUSA_OSM_MS = 1_100;
const USER_AGENT = 'Doogking/1.0 (siembra de lugares; contacto: soporte@doogking.com)';

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

/**
 * Alternativa gratuita cuando Google no responde. El proyecto ya usa
 * OpenStreetMap como respaldo del mapa, así que la fuente no es nueva.
 */
async function coordenadasOsm(
  municipio: string,
  provincia: string | undefined,
): Promise<[number, number] | null> {
  const consulta = provincia ? `${municipio}, ${provincia}, España` : `${municipio}, España`;
  const url = `${NOMINATIM_URL}?format=jsonv2&limit=1&countrycodes=es&q=${encodeURIComponent(consulta)}`;

  try {
    const respuesta = await fetch(url, { headers: { 'User-Agent': USER_AGENT } });
    if (!respuesta.ok) return null;

    const datos = (await respuesta.json()) as Array<{ lat?: string; lon?: string }>;
    const primero = datos[0];
    if (!primero?.lat || !primero.lon) return null;

    // GeoJSON guarda [lng, lat], no al revés.
    return [Number(primero.lon), Number(primero.lat)];
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

  /*
   * Se decide la fuente una sola vez, con una consulta de prueba: si la clave de
   * Google está caducada o suspendida, insistir 111 veces sólo alarga la espera
   * y deja todas las fichas sin punto, que es justo lo que pasó la primera vez.
   */
  let usarGoogle = false;
  if (CON_GEO && apiKey) {
    usarGoogle = (await coordenadasDe('València', 'Valencia', apiKey)) !== null;
    if (!usarGoogle) {
      console.log('');
      console.log('⚠️  Google no responde a la geocodificación (clave ausente, suspendida o sin');
      console.log('   permisos). Se usa OpenStreetMap, el mismo respaldo que el mapa del frontend.');
    }
  } else if (CON_GEO) {
    console.log('');
    console.log('ℹ️  Sin GOOGLE_MAPS_API_KEY: se geocodifica con OpenStreetMap.');
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
        puntos.set(
          clave,
          usarGoogle
            ? await coordenadasDe(ficha.ubicacion.ciudad, ficha.ubicacion.provincia, apiKey as string)
            : await coordenadasOsm(ficha.ubicacion.ciudad, ficha.ubicacion.provincia),
        );
        await esperar(usarGoogle ? PAUSA_MS : PAUSA_OSM_MS);
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
  if (CON_GEO) {
    console.log(`Con coordenadas       : ${geocodificados} de ${fichas.length}`);
    console.log(`Fuente                : ${usarGoogle ? 'Google Places (New)' : 'OpenStreetMap'}`);
  }

  await mongoose.disconnect();
}

sembrar().catch((error) => {
  console.error('❌  Error sembrando los lugares:', error);
  process.exit(1);
});
