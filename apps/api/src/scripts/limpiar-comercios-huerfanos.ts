/**
 * limpiar-comercios-huerfanos.ts
 *
 * Uso:
 *   bun run --cwd apps/api limpiar:huerfanos                        (simulación)
 *   bun run --cwd apps/api limpiar:huerfanos -- --aplicar
 *   bun run --cwd apps/api limpiar:huerfanos -- --aplicar --conservar-reservas
 *
 * Repara los datos que dejó el borrado de comercios anterior a la cascada.
 *
 * Hasta ahora `DELETE /admin/comercios/:id` borraba el documento del comercio y
 * nada más. Sus listados seguían en `servicios` con `comercioActivo: true` —el
 * flag denormalizado por el que filtra el buscador—, así que un comercio
 * "eliminado" seguía apareciendo en la web con sus servicios reservables, y las
 * cuentas de su equipo seguían entrando al panel apuntando a un comercio que ya
 * no existe.
 *
 * Este script busca todo documento cuyo `comercioId` apunta a un comercio que ya
 * no está en la colección y lo limpia, replicando la cascada de la purga:
 *   - servicios y lo que cuelga de ellos (favoritos, lista de espera, bloqueos)
 *   - reservas y sus pagos e incidencias
 *   - reseñas, cupones, liquidaciones, agendas, suplementos
 *   - usuarios → se desactivan y pierden el vínculo; **no se borran**, porque
 *     pueden tener historial propio como clientes
 *
 * Un comercio dado de baja (`estado: 'eliminado'`) SÍ existe: sus datos no son
 * huérfanos y este script no los toca.
 */
import mongoose, { Types } from 'mongoose';
import { prepararEntorno } from './entorno';

const MONGODB_URI = prepararEntorno();

const APLICAR = process.argv.includes('--aplicar');
const CONSERVAR_RESERVAS = process.argv.includes('--conservar-reservas');

/** Colecciones que cuelgan de un comercio y no tienen sentido sin él. */
const COLECCIONES_DEL_COMERCIO = [
  'servicios',
  'resenas',
  'cupones',
  'liquidaciones',
  'agendas',
  'suplemento_configs',
  'solicitudes_valoracion',
  'incidencias',
];

/**
 * Filtro de huérfano. El `null` del `$nin` es imprescindible: `comercioId` es
 * opcional en `cupones` e `incidencias`, y sin él un `$nin` también casa con los
 * documentos que no tienen el campo — se habrían borrado los cupones globales.
 */
function filtroHuerfano(idsVivos: Types.ObjectId[]): Record<string, unknown> {
  return { comercioId: { $nin: [...idsVivos, null] } };
}

async function limpiar(): Promise<void> {
  await mongoose.connect(MONGODB_URI as string);
  const db = mongoose.connection.db;
  if (!db) throw new Error('Sin conexión a la base de datos');

  const comercios = await db.collection('comercios').find({}, { projection: { _id: 1 } }).toArray();
  const idsVivos = comercios.map((c) => c._id as Types.ObjectId);
  const huerfano = filtroHuerfano(idsVivos);

  // Ids de los documentos huérfanos que arrastran a otras colecciones.
  const idsDe = async (coleccion: string): Promise<Types.ObjectId[]> => {
    const docs = await db.collection(coleccion).find(huerfano, { projection: { _id: 1 } }).toArray();
    return docs.map((d) => d._id as Types.ObjectId);
  };

  const servicioIds = await idsDe('servicios');
  const reservaIds = CONSERVAR_RESERVAS ? [] : await idsDe('reservas');

  const colecciones = CONSERVAR_RESERVAS
    ? COLECCIONES_DEL_COMERCIO
    : [...COLECCIONES_DEL_COMERCIO, 'reservas'];

  // Recuento previo: es lo que se enseña en la simulación y lo que se borra.
  const porColeccion: Array<{ nombre: string; total: number }> = [];
  for (const nombre of colecciones) {
    porColeccion.push({ nombre, total: await db.collection(nombre).countDocuments(huerfano) });
  }

  const porReserva = reservaIds.length ? { reservaId: { $in: reservaIds } } : null;
  const porServicio = servicioIds.length ? { servicioId: { $in: servicioIds } } : null;

  const dependientes: Array<{ nombre: string; total: number; filtro: Record<string, unknown> }> = [];
  if (porReserva) {
    for (const nombre of ['pagos', 'incidencias']) {
      dependientes.push({
        nombre: `${nombre} (de reservas huérfanas)`,
        total: await db.collection(nombre).countDocuments(porReserva),
        filtro: porReserva,
      });
    }
  }
  if (porServicio) {
    for (const nombre of ['favoritos', 'lista_espera', 'bloqueos']) {
      dependientes.push({
        nombre: `${nombre} (de listados huérfanos)`,
        total: await db.collection(nombre).countDocuments(porServicio),
        filtro: porServicio,
      });
    }
  }

  const usuariosHuerfanos = await db.collection('usuarios').countDocuments(huerfano);

  // Listados visibles de comercios que ya no existen: la causa exacta de que los
  // comercios eliminados siguieran saliendo en el buscador.
  const visiblesHuerfanos = await db
    .collection('servicios')
    .countDocuments({ ...huerfano, comercioActivo: true });

  if (APLICAR) {
    // Primero lo que depende de reservas y servicios: si se borran esos antes,
    // ya no hay forma de saber qué pagos ni qué favoritos quedaron sueltos.
    if (porReserva) {
      await db.collection('pagos').deleteMany(porReserva);
      await db.collection('incidencias').deleteMany(porReserva);
    }
    if (porServicio) {
      await db.collection('favoritos').deleteMany(porServicio);
      await db.collection('lista_espera').deleteMany(porServicio);
      await db.collection('bloqueos').deleteMany(porServicio);
      await db.collection('carritos').updateMany(
        { 'items.servicioId': { $in: servicioIds } },
        { $pull: { items: { servicioId: { $in: servicioIds } } } } as never,
      );
    }

    for (const nombre of colecciones) {
      await db.collection(nombre).deleteMany(huerfano);
    }

    // Las cuentas se conservan: pueden tener reservas propias como clientes.
    await db.collection('usuarios').updateMany(huerfano, {
      $set: { activo: false },
      $unset: { comercioId: '' },
    });
  }

  const etiqueta = (nombre: string): string => nombre.padEnd(34);

  console.log('');
  console.log('── Datos huérfanos (comercios que ya no existen) ────────────');
  console.log(`${etiqueta('Comercios en la colección')}: ${idsVivos.length}`);
  console.log(`${etiqueta('Listados visibles huérfanos')}: ${visiblesHuerfanos}  ← los que seguían en la web`);
  console.log('');
  for (const { nombre, total } of porColeccion) {
    console.log(`${etiqueta(nombre)}: ${total}`);
  }
  for (const { nombre, total } of dependientes) {
    console.log(`${etiqueta(nombre)}: ${total}`);
  }
  console.log(`${etiqueta('usuarios (se desactivan, no se borran)')}: ${usuariosHuerfanos}`);
  if (CONSERVAR_RESERVAS) {
    console.log(`${etiqueta('reservas')}: intactas (--conservar-reservas)`);
  }

  console.log('');
  if (APLICAR) {
    console.log('✅  Limpieza aplicada.');
  } else {
    console.log('ℹ️  Simulación: no se ha tocado nada.');
    console.log('    Ejecuta con --aplicar para borrar de verdad.');
  }

  await mongoose.disconnect();
}

limpiar().catch((error) => {
  console.error('❌  Error en la limpieza:', error);
  process.exit(1);
});
