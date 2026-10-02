/**
 * migrar-slugs-servicios.ts — URLs amigables de las fichas de servicio (oct. 2026)
 *
 * Uso:
 *   bun run --cwd apps/api migrar:slugs-servicios            (simulación)
 *   bun run --cwd apps/api migrar:slugs-servicios -- --aplicar
 *
 * Las fichas vivían en `/alojamiento/6aa45f57779263b987ae2409`. Con este campo
 * pasan a `/alojamiento/reino-canino-valencia`: título + ciudad, sin tildes, con
 * sufijo `-2`, `-3`… si dos fichas del mismo vertical coinciden.
 *
 * **Los enlaces antiguos siguen funcionando**: el API acepta id o slug, y la web
 * responde con un 301 a la dirección legible. Este script sólo rellena el campo
 * que falta y crea el índice único `{ vertical, slug }` si no existe.
 *
 * Es idempotente: un servicio que ya tiene slug no se toca nunca, porque
 * cambiarlo rompería los enlaces que ya circulan.
 */
// Antes que 'shared': sus DTOs usan decoradores que leen metadatos al cargarse.
import 'reflect-metadata';
import mongoose from 'mongoose';
import { slugDeFicha, slugLibre } from 'shared';
import { prepararEntorno } from './entorno';

// Carga el .env y fija los DNS antes de conectar (ver `entorno.ts`).
const MONGODB_URI = prepararEntorno();

const APLICAR = process.argv.includes('--aplicar');

const NOMBRE_INDICE = 'vertical_1_slug_1';

interface ServicioSinSlug {
  _id: unknown;
  vertical?: string;
  titulo?: string;
  estado?: string;
  ubicacion?: { ciudad?: string };
}

interface Cambio {
  readonly id: unknown;
  readonly vertical: string;
  readonly titulo: string;
  readonly slug: string;
}

/**
 * Slugs ya usados, por vertical. Se guardan en memoria además de leerse de la
 * base: dentro de una misma ejecución dos fichas homónimas se numerarían igual
 * porque ninguna de las dos está escrita todavía.
 */
async function slugsExistentes(servicios: mongoose.mongo.Collection): Promise<Map<string, Set<string>>> {
  const usados = new Map<string, Set<string>>();
  const existentes = await servicios
    .find({ slug: { $type: 'string' } })
    .project({ vertical: 1, slug: 1 })
    .toArray();

  for (const doc of existentes) {
    const vertical = String(doc['vertical'] ?? '');
    if (!usados.has(vertical)) usados.set(vertical, new Set());
    usados.get(vertical)?.add(String(doc['slug']));
  }
  return usados;
}

async function calcularCambios(
  pendientes: ServicioSinSlug[],
  usados: Map<string, Set<string>>,
): Promise<Cambio[]> {
  const cambios: Cambio[] = [];
  for (const servicio of pendientes) {
    const vertical = servicio.vertical ?? '';
    if (!usados.has(vertical)) usados.set(vertical, new Set());
    const delVertical = usados.get(vertical) as Set<string>;

    const base = slugDeFicha(servicio.titulo ?? '', servicio.ubicacion?.ciudad, 'servicio');
    const slug = await slugLibre(base, async (candidato) => delVertical.has(candidato));

    delVertical.add(slug);
    cambios.push({ id: servicio._id, vertical, titulo: servicio.titulo ?? '(sin título)', slug });
  }
  return cambios;
}

/**
 * El índice lo declara el schema, pero en producción Mongoose puede arrancar con
 * `autoIndex` apagado; el script lo garantiza. Va **después** de rellenar los
 * slugs para que no falle por los duplicados que la propia migración resuelve.
 */
async function asegurarIndice(servicios: mongoose.mongo.Collection): Promise<void> {
  const indices = await servicios.indexes();
  if (indices.some((indice) => indice.name === NOMBRE_INDICE)) return;

  await servicios.createIndex(
    { vertical: 1, slug: 1 },
    { name: NOMBRE_INDICE, unique: true, partialFilterExpression: { slug: { $type: 'string' } } },
  );
  console.log(`Índice ${NOMBRE_INDICE} creado.`);
}

function imprimirResumen(total: number, cambios: Cambio[]): void {
  console.log('');
  console.log('── Resumen ────────────────────────────────');
  console.log(`Servicios totales       : ${total}`);
  console.log(`Ya tenían dirección     : ${total - cambios.length}`);
  console.log(`Direcciones a asignar   : ${cambios.length}`);

  if (cambios.length) {
    console.log('');
    console.log('── Primeras direcciones ───────────────────');
    for (const cambio of cambios.slice(0, 20)) {
      console.log(`  ${cambio.titulo.padEnd(38).slice(0, 38)} → /${cambio.vertical}/${cambio.slug}`);
    }
    if (cambios.length > 20) console.log(`  … y ${cambios.length - 20} más`);
  }

  if (!APLICAR) {
    console.log('');
    console.log('ℹ️  Simulación. Vuelve a ejecutarlo con --aplicar para guardar los cambios.');
  }
}

async function migrar(): Promise<void> {
  await mongoose.connect(MONGODB_URI);
  const db = mongoose.connection.db;
  if (!db) throw new Error('Sin conexión a la base de datos');

  const servicios = db.collection('servicios');
  const total = await servicios.countDocuments({});
  const pendientes = await servicios
    .find({ $or: [{ slug: { $exists: false } }, { slug: null }, { slug: '' }] })
    .project({ _id: 1, vertical: 1, titulo: 1, estado: 1, 'ubicacion.ciudad': 1 })
    .toArray() as ServicioSinSlug[];

  const cambios = await calcularCambios(pendientes, await slugsExistentes(servicios));

  if (APLICAR) {
    for (const cambio of cambios) {
      // Sin tocar `updatedAt`: no es una edición de la ficha y alteraría el
      // `lastmod` del sitemap de todas las fichas a la vez.
      await servicios.updateOne({ _id: cambio.id as never }, { $set: { slug: cambio.slug } });
    }
    await asegurarIndice(servicios);
  }

  imprimirResumen(total, cambios);
  await mongoose.disconnect();
}

migrar().catch((error) => {
  console.error('❌  Error en la migración:', error);
  process.exit(1);
});
