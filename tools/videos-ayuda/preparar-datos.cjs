/**
 * Prepara la base de datos LOCAL con la que se graban los vídeos de ayuda.
 *
 * 1. Copia de producción, en solo lectura, lo que ya es público: servicios
 *    publicados, comercios (sin datos bancarios ni NIF), lugares de Explora,
 *    centros de población y la configuración de la plataforma.
 * 2. Deja a la vista el catálogo de demostración (servicios con nombres y
 *    precios realistas) y oculta los de prueba que hoy hay en producción.
 * 3. Pone a cada servicio fotos de Pexels de su categoría.
 *
 * Sólo escribe en `mongodb://127.0.0.1:27017/doogking-videos`: se niega a
 * arrancar con cualquier otro destino. No toca nunca producción.
 *
 * Uso: node tools/videos-ayuda/preparar-datos.cjs [--sin-copiar]
 */
const fs = require('fs');
const path = require('path');
const dns = require('dns');

dns.setServers(['8.8.8.8', '1.1.1.1']);
const RAIZ = path.resolve(__dirname, '../..');
const mongoose = require(path.join(RAIZ, 'apps/api/node_modules/mongoose'));

const DESTINO = 'mongodb://127.0.0.1:27017/doogking-videos';

const leerEnv = (fichero) => Object.fromEntries(
  fs.readFileSync(fichero, 'utf8').split(/\r?\n/)
    .filter((l) => /^[A-Z_]+=/.test(l))
    .map((l) => [l.split('=')[0], l.slice(l.indexOf('=') + 1).trim()]),
);

/** Búsquedas de Pexels por categoría: lo que se ve en las fichas y tarjetas. */
const FOTOS_POR_VERTICAL = {
  alojamiento: ['dog daycare playing', 'dog sleeping bed', 'dogs playing garden'],
  hoteles: ['dog hotel room', 'woman dog hotel', 'dog travel suitcase'],
  peluqueria: ['dog grooming', 'dog bath', 'groomer dog'],
  veterinaria: ['veterinarian dog', 'vet clinic dog', 'veterinarian puppy'],
  transporte: ['dog in car', 'dog car window', 'dog travel car'],
  adiestramiento: ['dog training', 'dog obedience', 'puppy training'],
  funerarios: ['dog memorial flowers'],
  seguros: ['happy family dog home', 'dog owner hug', 'veterinarian dog checkup'],
};

/** Los comercios de los servicios de demostración, que en producción ya no existen. */
const COMERCIOS_DEMO = {
  b00000000000000000000001: 'Grupo Can Madrid',
  b00000000000000000000002: 'Royal Paws Clínicas',
  b00000000000000000000003: 'Estilo Canino',
  b00000000000000000000004: 'DogVan Traslados',
  b00000000000000000000005: 'Hoteles con Patas',
  b00000000000000000000006: 'Patas Seguras Correduría',
};

/** Seguros de demostración: en producción aún no hay ninguna aseguradora publicada. */
const SEGUROS_DEMO = [
  {
    titulo: 'Seguro de Responsabilidad Civil Básico', precio: 39, tipos: ['rc_obligatoria', 'defensa_juridica'],
    limites: [{ tipo: 'rc_obligatoria', limiteAnualEur: 150000 }, { tipo: 'defensa_juridica', limiteAnualEur: 3000 }],
    descripcion: 'Cubre los daños que tu perro pueda causar a terceros, con la responsabilidad civil que exige la ley.',
  },
  {
    titulo: 'Seguro Salud Completo para Perros', precio: 189, tipos: ['gastos_vet_accidente', 'gastos_vet_enfermedad', 'rc_ampliada'],
    limites: [{ tipo: 'gastos_vet_accidente', limiteAnualEur: 3000, franquiciaEur: 50 },
      { tipo: 'gastos_vet_enfermedad', limiteAnualEur: 2500, carenciaDias: 30, franquiciaEur: 50 },
      { tipo: 'rc_ampliada', limiteAnualEur: 300000 }],
    descripcion: 'Veterinario por accidente y enfermedad, responsabilidad civil ampliada y asistencia 24 horas.',
  },
  {
    titulo: 'Seguro Accidentes y Asistencia', precio: 89, tipos: ['gastos_vet_accidente', 'asistencia', 'robo_perdida'],
    limites: [{ tipo: 'gastos_vet_accidente', limiteAnualEur: 2000, franquiciaEur: 30 },
      { tipo: 'asistencia', limiteAnualEur: 600 }, { tipo: 'robo_perdida', limiteAnualEur: 400 }],
    descripcion: 'Para los imprevistos del día a día: accidentes, asistencia veterinaria y ayuda si se pierde.',
  },
];

const slugDe = (texto) => texto.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
  .replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');

async function crearSegurosDemo(db) {
  const comercioId = new mongoose.Types.ObjectId('b00000000000000000000006');
  const plantilla = await db.collection('servicios').findOne({ comercioId: new mongoose.Types.ObjectId('b00000000000000000000003') });
  await db.collection('servicios').deleteMany({ comercioId });
  const ahora = new Date();
  await db.collection('servicios').insertMany(SEGUROS_DEMO.map((seguro, i) => ({
    comercioId,
    vertical: 'seguros',
    titulo: seguro.titulo,
    descripcion: seguro.descripcion,
    imagenes: [],
    ubicacion: plantilla.ubicacion,
    direccion: plantilla.direccion,
    precioBase: seguro.precio,
    moneda: 'EUR',
    destacado: i === 1,
    prioridadRanking: 10 - i,
    estado: 'publicado',
    ratingPromedio: [4.6, 4.9, 4.7][i],
    'totalReseñas': [38, 112, 54][i],
    comercioActivo: true,
    slug: `${slugDe(seguro.titulo)}-madrid`,
    tiposSeguro: seguro.tipos,
    limitesCobertura: seguro.limites,
    condicionesAdmision: { edadMinimaMeses: 3, edadMaximaAnios: 10, requiereVacunasAlDia: true },
    primaAnualBase: seguro.precio,
    descuentoPagoAnualPct: 5,
    duracionMeses: 12,
    renovacionAutomatica: true,
    cupoPolizas: 0,
    estadoSolicitud: 'aprobada',
    createdAt: ahora,
    updatedAt: ahora,
  })));
  console.log(`seguros de demostración: ${SEGUROS_DEMO.length}`);
}

async function copiarDeProduccion(origen, destino) {
  const copiar = async (coleccion, filtro = {}, limpiar = (d) => d) => {
    const docs = (await origen.collection(coleccion).find(filtro).toArray()).map(limpiar);
    await destino.collection(coleccion).deleteMany({});
    if (docs.length) await destino.collection(coleccion).insertMany(docs);
    console.log(`copiado ${coleccion}: ${docs.length}`);
  };
  await copiar('servicios', { estado: 'publicado' });
  await copiar('comercios', {}, (d) => { delete d.datosBancarios; d.vatNumber = 'B00000000'; return d; });
  await copiar('lugares');
  await copiar('centros_poblacion');
  await copiar('configuracion_plataforma');
}

async function fotosPexels(clave, consulta, cuantas) {
  const url = `https://api.pexels.com/v1/search?query=${encodeURIComponent(consulta)}&per_page=${cuantas}&orientation=landscape`;
  const respuesta = await fetch(url, { headers: { Authorization: clave } });
  if (!respuesta.ok) throw new Error(`Pexels ${respuesta.status} con «${consulta}»`);
  const { photos } = await respuesta.json();
  return photos.map((p) => p.src.large2x);
}

async function crearComerciosDemo(db) {
  const plantilla = await db.collection('comercios').findOne({ estado: 'activo' });
  for (const [id, nombre] of Object.entries(COMERCIOS_DEMO)) {
    const _id = new mongoose.Types.ObjectId(id);
    const verticales = await db.collection('servicios').distinct('vertical', { comercioId: _id });
    const { _id: _ignorado, ...base } = plantilla;
    await db.collection('comercios').replaceOne(
      { _id },
      { ...base, _id, nombreComercial: nombre, razonSocial: `${nombre} S.L.`, verticales, estado: 'activo' },
      { upsert: true },
    );
  }
  console.log(`comercios de demostración: ${Object.keys(COMERCIOS_DEMO).length}`);
}

async function ponerFotos(db, clave) {
  const servicios = await db.collection('servicios').find({ comercioActivo: true }).toArray();
  const reservas = {};
  for (const [vertical, consultas] of Object.entries(FOTOS_POR_VERTICAL)) {
    const listas = await Promise.all(consultas.map((c) => fotosPexels(clave, c, 8)));
    reservas[vertical] = [...new Set(listas.flat())];
  }
  const usados = {};
  for (const servicio of servicios) {
    const pool = reservas[servicio.vertical] ?? [];
    if (!pool.length) continue;
    const inicio = (usados[servicio.vertical] ?? 0);
    const imagenes = [0, 1, 2, 3].map((i) => pool[(inicio + i * 3) % pool.length]);
    usados[servicio.vertical] = inicio + 1;
    await db.collection('servicios').updateOne({ _id: servicio._id }, { $set: { imagenes } });
  }
  console.log(`fotos puestas a ${servicios.length} servicios`);
}

async function main() {
  const destino = await mongoose.createConnection(DESTINO).asPromise();
  if (destino.db.databaseName !== 'doogking-videos' || !/127\.0\.0\.1|localhost/.test(DESTINO)) {
    throw new Error('El destino tiene que ser la base local doogking-videos');
  }
  const db = destino.db;

  if (!process.argv.includes('--sin-copiar')) {
    const produccion = leerEnv(path.join(RAIZ, 'apps/api/.env')).MONGODB_URI;
    const origen = await mongoose.createConnection(produccion).asPromise();
    await copiarDeProduccion(origen.db, db);
    await origen.close();
  }

  const demo = Object.keys(COMERCIOS_DEMO).map((id) => new mongoose.Types.ObjectId(id));
  // Los de prueba de producción no se enseñan; los de demostración, sí.
  await db.collection('servicios').updateMany({}, { $set: { comercioActivo: false } });
  await db.collection('servicios').updateMany({ comercioId: { $in: demo } }, { $set: { comercioActivo: true } });
  await crearSegurosDemo(db);
  await crearComerciosDemo(db);
  // Los de demostración se sembraron con el horario antiguo en texto
  // («L–V 09:30–19:30»): la agenda de citas espera el horario por días.
  const dia = (nombre, cerrado = false) => ({ dia: nombre, abre: '09:30', cierra: '14:00', abre2: '16:00', cierra2: '20:00', cerrado });
  const horario = ['lunes', 'martes', 'miercoles', 'jueves', 'viernes'].map((d) => dia(d))
    .concat([{ ...dia('sabado'), cierra: '14:00', abre2: '', cierra2: '' }, dia('domingo', true)]);
  await db.collection('servicios').updateMany({ comercioId: { $in: demo }, horario: { $type: 'string' } }, { $set: { horario } });

  const clave = process.env.PEXELS_API_KEY || leerEnv(path.join(RAIZ, '.env.deploy')).PEXELS_API_KEY;
  await ponerFotos(db, clave);
  await destino.close();
}

main().catch((error) => { console.error(error); process.exit(1); });
