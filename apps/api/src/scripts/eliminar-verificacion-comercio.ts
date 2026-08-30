/**
 * eliminar-verificacion-comercio.ts
 *
 * Uso:
 *   bun run --cwd apps/api eliminar:verificacion            (simulación)
 *   bun run --cwd apps/api eliminar:verificacion -- --aplicar
 *
 * La verificación documental desaparece: el comercio ya no sube DNI ni licencia
 * y el administrador ya no tiene que dar el visto bueno a ningún negocio. Lo que
 * habilita a publicar es terminar el alta guiada, que es donde el comercio
 * declara que opera legalmente y acepta las condiciones.
 *
 * El campo salió del schema, pero Mongo no borra por su cuenta lo que ya está
 * escrito: sin esto los documentos antiguos seguirían arrastrando un bloque
 * `verificacion` que nadie lee ni puede cambiar.
 *
 * Los ficheros subidos a GridFS no se tocan: su ciclo de vida lo gobierna
 * `limpiar:huerfanos`, no este script.
 */
import mongoose from 'mongoose';
import { prepararEntorno } from './entorno';

// Carga el .env y fija los DNS antes de conectar (ver `entorno.ts`).
const MONGODB_URI = prepararEntorno();

const APLICAR = process.argv.includes('--aplicar');

async function migrar(): Promise<void> {
  await mongoose.connect(MONGODB_URI as string);
  const db = mongoose.connection.db;
  if (!db) throw new Error('Sin conexión a la base de datos');

  const comercios = db.collection('comercios');
  const filtro = { verificacion: { $exists: true } };
  const afectados = await comercios.countDocuments(filtro);

  if (APLICAR && afectados) {
    await comercios.updateMany(filtro, { $unset: { verificacion: '' } });
  }

  console.log('');
  console.log('── Resumen ────────────────────────────────');
  console.log(`Comercios con bloque de verificación: ${afectados}`);

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
