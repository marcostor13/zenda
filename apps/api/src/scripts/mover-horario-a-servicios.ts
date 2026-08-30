/**
 * mover-horario-a-servicios.ts
 *
 * Uso:
 *   bun run --cwd apps/api mover:horario-servicios            (simulación)
 *   bun run --cwd apps/api mover:horario-servicios -- --aplicar
 *
 * El horario de atención y la dirección exacta pasan a colgar de cada servicio:
 * un negocio puede tener la peluquería en el centro abriendo de tarde y la
 * residencia canina a las afueras con entradas sólo por la mañana, y con un
 * único horario de empresa la ficha enseñaba al cliente un dato que no era el
 * del servicio que estaba reservando.
 *
 * Qué hace, por comercio:
 *   1. Copia su horario semanal y sus días especiales a los servicios que aún no
 *      tengan horario propio. Los que ya lo tengan no se tocan.
 *   2. Copia la calle/número/provincia/CP/país de la dirección del negocio a la
 *      ubicación de esos servicios, **sin** pisar la que ya tuvieran.
 *   3. Retira `horario` y `excepcionesHorario` del documento del comercio.
 *
 * La dirección del comercio se conserva: sigue siendo la población que se
 * captura en el alta y la que sale en el comprobante de reserva.
 */
import mongoose from 'mongoose';
import { prepararEntorno } from './entorno';

// Carga el .env y fija los DNS antes de conectar (ver `entorno.ts`).
const MONGODB_URI = prepararEntorno();

const APLICAR = process.argv.includes('--aplicar');

interface ComercioConHorario {
  _id: unknown;
  horario?: unknown[];
  excepcionesHorario?: unknown[];
  direccion?: Record<string, unknown>;
}

/** Campos de la dirección que se heredan; la ciudad ya la tiene cada servicio. */
const CAMPOS_DIRECCION = ['calle', 'numero', 'provincia', 'codigoPostal', 'pais'] as const;

async function migrar(): Promise<void> {
  await mongoose.connect(MONGODB_URI as string);
  const db = mongoose.connection.db;
  if (!db) throw new Error('Sin conexión a la base de datos');

  const comercios = db.collection('comercios');
  const servicios = db.collection('servicios');

  const conHorario = (await comercios
    .find({ $or: [{ horario: { $exists: true } }, { excepcionesHorario: { $exists: true } }] })
    .toArray()) as unknown as ComercioConHorario[];

  let serviciosTocados = 0;

  for (const comercio of conHorario) {
    const heredado: Record<string, unknown> = {};
    if (comercio.horario?.length) heredado.horario = comercio.horario;
    if (comercio.excepcionesHorario?.length) heredado.excepcionesHorario = comercio.excepcionesHorario;

    for (const campo of CAMPOS_DIRECCION) {
      const valor = comercio.direccion?.[campo];
      if (valor) heredado[`ubicacion.${campo}`] = valor;
    }

    if (!Object.keys(heredado).length) continue;

    // Sólo los servicios sin horario propio: si el comercio ya afinó el de uno
    // de sus listados, heredar el del negocio se lo borraría.
    const destino = { comercioId: comercio._id, horario: { $in: [null, []] } };
    serviciosTocados += await servicios.countDocuments(destino);
    if (APLICAR) await servicios.updateMany(destino, { $set: heredado });
  }

  if (APLICAR && conHorario.length) {
    await comercios.updateMany(
      { $or: [{ horario: { $exists: true } }, { excepcionesHorario: { $exists: true } }] },
      { $unset: { horario: '', excepcionesHorario: '' } },
    );
  }

  console.log('');
  console.log('── Resumen ────────────────────────────────');
  console.log(`Comercios con horario propio : ${conHorario.length}`);
  console.log(`Servicios que lo heredan     : ${serviciosTocados}`);

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
