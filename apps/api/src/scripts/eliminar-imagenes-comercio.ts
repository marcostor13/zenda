/**
 * eliminar-imagenes-comercio.ts
 *
 * Uso:
 *   bun run --cwd apps/api eliminar:imagenes-comercio            (simulación)
 *   bun run --cwd apps/api eliminar:imagenes-comercio -- --aplicar
 *
 * La ficha del comercio ya no tiene logo, portada ni galería: la imagen que ve
 * el cliente es la del listado, no la del negocio. Los campos desaparecieron del
 * schema, pero Mongo no borra por su cuenta lo que ya está escrito, así que los
 * documentos antiguos seguirían arrastrándolos para siempre.
 *
 * Sólo se quitan los campos del documento; los ficheros de GridFS que hubieran
 * subido no se tocan, porque `limpiar:huerfanos` y el propio GridFS son quienes
 * gobiernan ese ciclo de vida.
 */
import mongoose from 'mongoose';
import { prepararEntorno } from './entorno';

// Carga el .env y fija los DNS antes de conectar (ver `entorno.ts`).
const MONGODB_URI = prepararEntorno();

const APLICAR = process.argv.includes('--aplicar');

const CAMPOS = ['logoUrl', 'coverUrl', 'galeria'] as const;

async function migrar(): Promise<void> {
  await mongoose.connect(MONGODB_URI as string);
  const db = mongoose.connection.db;
  if (!db) throw new Error('Sin conexión a la base de datos');

  const comercios = db.collection('comercios');
  const filtro = { $or: CAMPOS.map((campo) => ({ [campo]: { $exists: true } })) };
  const afectados = await comercios.countDocuments(filtro);

  if (APLICAR && afectados) {
    await comercios.updateMany(filtro, {
      $unset: Object.fromEntries(CAMPOS.map((campo) => [campo, ''])),
    });
  }

  console.log('');
  console.log('── Resumen ────────────────────────────────');
  console.log(`Comercios con imágenes de ficha: ${afectados}`);
  console.log(`Campos retirados               : ${CAMPOS.join(', ')}`);

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
