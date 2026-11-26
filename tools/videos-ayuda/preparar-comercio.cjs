/**
 * Deja listo, en la base LOCAL de los vídeos, el comercio que se registró por
 * la interfaz (hola@peludos-salon.demo.test): aprobado y con su peluquería
 * publicada, para grabar el panel con reservas de verdad.
 *
 * Uso: node tools/videos-ayuda/preparar-comercio.cjs
 */
const path = require('path');
const RAIZ = path.resolve(__dirname, '../..');
const mongoose = require(path.join(RAIZ, 'apps/api/node_modules/mongoose'));

const DESTINO = 'mongodb://127.0.0.1:27017/doogking-videos';
const EMAIL = 'hola@peludos-salon.demo.test';
const VALENCIA = { ciudad: 'Valencia', provincia: 'Valencia', pais: 'España', geo: { type: 'Point', coordinates: [-0.3727, 39.4719] } };

async function main() {
  const conexion = await mongoose.createConnection(DESTINO).asPromise();
  const db = conexion.db;
  const usuario = await db.collection('usuarios').findOne({ email: EMAIL });
  if (!usuario?.comercioId) throw new Error(`Primero registra ${EMAIL} desde la web local`);
  const comercioId = usuario.comercioId;

  await db.collection('comercios').updateOne({ _id: comercioId }, {
    $set: {
      nombreComercial: 'Peludos Salón Canino', razonSocial: 'Peludos Salón Canino S.L.', vatNumber: 'B12345674',
      estado: 'activo', altaCompletada: true, verticales: ['peluqueria'],
    },
  });

  const modelo = await db.collection('servicios').findOne({ titulo: 'Peluquería Guau Salamanca' });
  const { _id, ...base } = modelo;
  await db.collection('servicios').deleteMany({ comercioId });
  await db.collection('servicios').insertOne({
    ...base,
    comercioId,
    titulo: 'Peludos Salón Canino',
    slug: 'peludos-salon-canino-valencia',
    descripcion: 'Peluquería canina en el centro de Valencia: baño, corte de raza y spa con productos naturales y mucha paciencia.',
    ubicacion: VALENCIA,
    direccion: 'Calle de Colón, 20, 46004 Valencia',
    ratingPromedio: 4.9,
    'totalReseñas': 27,
    destacado: false,
    comercioActivo: true,
    estado: 'publicado',
    createdAt: new Date(),
    updatedAt: new Date(),
  });
  console.log(`comercio ${comercioId} activo con su peluquería publicada`);
  await conexion.close();
}

main().catch((error) => { console.error(error); process.exit(1); });
