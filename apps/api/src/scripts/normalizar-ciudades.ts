/**
 * normalizar-ciudades.ts — estandariza la población de los listados
 *
 * Uso:
 *   bun run --cwd apps/api normalizar:ciudades              (simulación: no escribe)
 *   bun run --cwd apps/api normalizar:ciudades -- --aplicar
 *
 * La población de cada listado se guardaba tal y como la tecleó el comercio, así
 * que la misma ciudad convivía escrita de varias formas —«villa-real»,
 * «Villarreal», «VILA REAL»— y el buscador sólo encontraba a quien la hubiera
 * escrito igual que quien busca. Desde ahora el alta y la edición la guardan
 * canonizada (ver `canonizarUbicacion`); este script hace lo mismo con lo que ya
 * estaba escrito:
 *
 *   - `ubicacion.ciudad`            → nombre canónico del catálogo, si se reconoce
 *   - `ubicacion.ciudadNormalizada` → sin tildes ni puntuación   («vila real»)
 *   - `ubicacion.ciudadClave`       → además, sin espacios       («vilareal»)
 *   - `ubicacion.provincia`         → la del catálogo, sólo si estaba vacía
 *
 * Una población que no está en el catálogo **no se renombra**: se le calculan
 * sus claves y se deja el texto del comercio. Adivinar el nombre de un pueblo
 * pequeño sería peor que respetarlo.
 *
 * Es idempotente: volver a pasarlo sobre datos ya normalizados no cambia nada.
 */
import mongoose, { mongo } from 'mongoose';
import { canonizarUbicacion, resolverMunicipio } from 'shared';
import { prepararEntorno } from './entorno';

type Collection = mongo.Collection<mongo.BSON.Document>;

const MONGODB_URI = prepararEntorno();
const APLICAR = process.argv.includes('--aplicar');

interface ServicioConUbicacion {
  _id: unknown;
  titulo?: string;
  ubicacion?: {
    ciudad?: string;
    ciudadNormalizada?: string;
    ciudadClave?: string;
    provincia?: string;
  };
}

/** Qué hay que escribir en un documento, o `null` si ya está como debe. */
function cambiosDe(servicio: ServicioConUbicacion): Record<string, string> | null {
  const ciudad = servicio.ubicacion?.ciudad?.trim();
  if (!ciudad) return null;

  const canonica = canonizarUbicacion(ciudad);
  const cambios: Record<string, string> = {};

  if (canonica.ciudad !== servicio.ubicacion?.ciudad) cambios['ubicacion.ciudad'] = canonica.ciudad;
  if (canonica.ciudadNormalizada !== servicio.ubicacion?.ciudadNormalizada) {
    cambios['ubicacion.ciudadNormalizada'] = canonica.ciudadNormalizada;
  }
  if (canonica.ciudadClave !== servicio.ubicacion?.ciudadClave) {
    cambios['ubicacion.ciudadClave'] = canonica.ciudadClave;
  }
  // La provincia sólo se rellena si falta: la que escribió el comercio manda.
  if (canonica.provincia && !servicio.ubicacion?.provincia?.trim()) {
    cambios['ubicacion.provincia'] = canonica.provincia;
  }

  return Object.keys(cambios).length ? cambios : null;
}

/**
 * Qué poblaciones distintas hay escritas y en cuántos listados. Es el mapa que
 * explica por qué una búsqueda no encontraba nada: dos formas de escribir la
 * misma ciudad aparecen aquí como dos filas que acaban en el mismo municipio.
 */
function resumirPoblaciones(documentos: ServicioConUbicacion[]): void {
  const cuenta = new Map<string, number>();
  for (const servicio of documentos) {
    const ciudad = servicio.ubicacion?.ciudad?.trim();
    if (ciudad) cuenta.set(ciudad, (cuenta.get(ciudad) ?? 0) + 1);
  }

  console.log('');
  console.log('── Poblaciones escritas ───────────────────────────────');
  [...cuenta.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .forEach(([ciudad, total]) => {
      const resuelto = resolverMunicipio(ciudad);
      const destino = resuelto
        ? `→ ${resuelto.municipio.nombre} (${resuelto.municipio.provincia}, ${resuelto.origen})`
        : '→ fuera del catálogo: se respeta tal cual';
      console.log(`  ${String(total).padStart(4)} × «${ciudad}»  ${destino}`);
    });
}

/**
 * La dirección fiscal del comercio, con el mismo criterio: nombre canónico y
 * provincia si faltaba. No lleva claves porque nadie busca comercios por ella
 * —el buscador va contra los listados—, pero sí se enseña en el panel y en los
 * comprobantes, y ahí también tiene que decir «Vila-real» y no «villa-real».
 */
async function normalizarComercios(coleccion: Collection): Promise<number> {
  const documentos = await coleccion
    .find({ 'direccion.ciudad': { $exists: true, $ne: '' } })
    .project({ nombreComercial: 1, direccion: 1 })
    .toArray() as unknown as Array<{ _id: unknown; nombreComercial?: string; direccion?: Record<string, string> }>;

  let tocados = 0;
  for (const comercio of documentos) {
    const ciudad = comercio.direccion?.ciudad?.trim();
    if (!ciudad) continue;

    const canonica = canonizarUbicacion(ciudad);
    const cambios: Record<string, string> = {};
    if (canonica.ciudad !== comercio.direccion?.ciudad) cambios['direccion.ciudad'] = canonica.ciudad;
    if (canonica.provincia && !comercio.direccion?.provincia?.trim()) {
      cambios['direccion.provincia'] = canonica.provincia;
    }
    if (!Object.keys(cambios).length) continue;

    tocados += 1;
    console.log(`  «${ciudad}» → «${canonica.ciudad}»  · ${comercio.nombreComercial ?? ''}`);
    if (APLICAR) await coleccion.updateOne({ _id: comercio._id as never }, { $set: cambios });
  }

  console.log('');
  console.log(`Comercios con dirección: ${documentos.length}`);
  console.log(`Comercios actualizados : ${tocados}`);
  return tocados;
}

async function normalizar(): Promise<void> {
  await mongoose.connect(MONGODB_URI as string);
  const db = mongoose.connection.db;
  if (!db) throw new Error('Sin conexión a la base de datos');

  const servicios = db.collection('servicios');
  const documentos = await servicios
    .find({ 'ubicacion.ciudad': { $exists: true, $ne: '' } })
    .project({ titulo: 1, ubicacion: 1 })
    .toArray() as unknown as ServicioConUbicacion[];

  console.log(`Listados con población: ${documentos.length}`);
  resumirPoblaciones(documentos);
  console.log('');
  console.log(APLICAR ? '── APLICANDO ──────────────────' : '── SIMULACIÓN (sin escribir) ──');

  const renombrados: string[] = [];
  let tocados = 0;

  for (const servicio of documentos) {
    const cambios = cambiosDe(servicio);
    if (!cambios) continue;
    tocados += 1;

    const nuevaCiudad = cambios['ubicacion.ciudad'];
    if (nuevaCiudad) {
      const resuelto = resolverMunicipio(servicio.ubicacion?.ciudad ?? '');
      renombrados.push(
        `  «${servicio.ubicacion?.ciudad}» → «${nuevaCiudad}» (${resuelto?.origen ?? 'limpieza'})  · ${servicio.titulo ?? ''}`,
      );
    }

    if (APLICAR) await servicios.updateOne({ _id: servicio._id as never }, { $set: cambios });
  }

  if (renombrados.length) {
    console.log('');
    console.log('Poblaciones reescritas:');
    renombrados.forEach((linea) => console.log(linea));
  }

  console.log('');
  console.log(`Listados actualizados: ${tocados}`);
  console.log(`Ya estaban bien      : ${documentos.length - tocados}`);

  const comercios = await normalizarComercios(db.collection('comercios'));

  if (!APLICAR && (tocados || comercios)) console.log('\nNada se ha escrito. Repite con  -- --aplicar');

  await mongoose.disconnect();
}

normalizar().catch((error) => {
  console.error(error);
  process.exit(1);
});
