/**
 * cerrar-altas-existentes.ts
 *
 * Uso:
 *   bun run --cwd apps/api cerrar:altas-existentes            (simulación)
 *   bun run --cwd apps/api cerrar:altas-existentes -- --aplicar
 *
 * El alta guiada (`/comercio/alta`) marca `altaCompletada` al terminar, y
 * publicar un servicio ahora exige tenerla cerrada. Los comercios que ya
 * estaban dados de alta antes de existir ese recorrido no tienen el flag, así
 * que **dejarían de poder publicar** de un día para otro sin haber hecho nada
 * mal: este script les da por cerrada el alta que en su momento completaron por
 * el camino antiguo.
 *
 * Se cierran los que ya demostraron estar operativos: los que tienen algún
 * servicio creado o unos datos de contacto puestos. A un comercio registrado
 * pero que nunca llegó a nada se le deja pendiente, que es justo su estado real
 * y ahora tiene un recorrido para resolverlo.
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
  const servicios = db.collection('servicios');

  const conServicio = await servicios.distinct('comercioId', {});
  const filtro = {
    altaCompletada: { $ne: true },
    $or: [{ _id: { $in: conServicio } }, { 'contacto.email': { $exists: true, $ne: '' } }],
  };

  const aCerrar = await comercios.countDocuments(filtro);
  const pendientes = await comercios.countDocuments({ altaCompletada: { $ne: true } });

  if (APLICAR && aCerrar) {
    await comercios.updateMany(filtro, { $set: { altaCompletada: true } });
  }

  console.log('');
  console.log('── Resumen ────────────────────────────────');
  console.log(`Comercios sin alta cerrada       : ${pendientes}`);
  console.log(`Se dan por cerrados (ya operan)  : ${aCerrar}`);
  console.log(`Siguen pendientes (nunca operaron): ${pendientes - aCerrar}`);

  if (!APLICAR) {
    console.log('');
    console.log('ℹ️  Simulación. Vuelve a ejecutarlo con --aplicar para guardar los cambios.');
    console.log('⚠️  Hasta que se aplique, esos comercios no podrán publicar servicios.');
  }

  await mongoose.disconnect();
}

migrar().catch((error) => {
  console.error('❌  Error en la migración:', error);
  process.exit(1);
});
