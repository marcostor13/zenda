/**
 * Limpia todos los datos de seed (usuarios, comercios, servicios, reservas, cupones).
 * Después de ejecutar este script, reinicia la API para que los seeders vuelvan
 * a insertar datos demo automáticamente, o corre seed:all para un seed completo.
 *
 * Uso:
 *   npm run clear:seed --workspace=api
 */
import * as dotenv from 'dotenv';
import * as dns from 'dns';
import mongoose, { Types } from 'mongoose';

dotenv.config({ path: 'apps/api/.env' });
dns.setDefaultResultOrder('ipv4first');

// IDs usados por seed-all.ts
const SEED_USER_IDS = [
  'a00000000000000000000001', 'a00000000000000000000002', 'a00000000000000000000003',
  'a00000000000000000000004', 'a00000000000000000000005', 'a00000000000000000000006',
  'a00000000000000000000007', 'a00000000000000000000008', 'a00000000000000000000009',
].map((id) => new Types.ObjectId(id));

// IDs usados por seed-all.ts Y por los seeders automáticos de verticales
const SEED_COMERCIO_IDS = [
  'b00000000000000000000001', 'b00000000000000000000002', 'b00000000000000000000003',
  'b00000000000000000000004', 'b00000000000000000000005', 'b00000000000000000000006',
  'b00000000000000000000007',
  // IDs legacy de los seeders automáticos (por si acaso)
  '000000000000000000000001', '000000000000000000000002', '000000000000000000000003',
  '000000000000000000000004', '000000000000000000000005',
].map((id) => new Types.ObjectId(id));

const SEED_CUPONES = ['BIENVENIDO10', 'LIMA15', 'CUSCO20'];

async function main(): Promise<void> {
  const uri = process.env['MONGODB_URI'];
  if (!uri) { console.error('❌  MONGODB_URI no definida en .env'); process.exit(1); }

  await mongoose.connect(uri);
  console.log('✅  Conectado a MongoDB.');
  const db = mongoose.connection.db;
  if (!db) throw new Error('No se pudo obtener la conexión a la base de datos.');

  // Usuarios de seed
  const rUsers = await db.collection('usuarios').deleteMany({ _id: { $in: SEED_USER_IDS } });
  if (rUsers.deletedCount > 0) console.log(`  usuarios:  eliminados ${rUsers.deletedCount}`);

  // Comercios de seed
  const rComercio = await db.collection('comercios').deleteMany({ _id: { $in: SEED_COMERCIO_IDS } });
  if (rComercio.deletedCount > 0) console.log(`  comercios: eliminados ${rComercio.deletedCount}`);

  // Servicios de todos los verticales
  for (const col of ['servicios', 'hoteles', 'taxis', 'vuelos', 'transportes', 'guarderias']) {
    try {
      const r = await db.collection(col).deleteMany({ comercioId: { $in: SEED_COMERCIO_IDS } });
      if (r.deletedCount > 0) console.log(`  ${col}: eliminados ${r.deletedCount}`);
    } catch { /* colección puede no existir */ }
  }

  // Reservas de seed
  const rReservas = await db.collection('reservas').deleteMany({ comercioId: { $in: SEED_COMERCIO_IDS } });
  if (rReservas.deletedCount > 0) console.log(`  reservas:  eliminados ${rReservas.deletedCount}`);

  // Cupones de seed
  const rCupones = await db.collection('cupones').deleteMany({ codigo: { $in: SEED_CUPONES } });
  if (rCupones.deletedCount > 0) console.log(`  cupones:   eliminados ${rCupones.deletedCount}`);

  await mongoose.disconnect();
  console.log('\n✅  Limpieza completada. Reinicia la API o corre "seed:all" para repoblar.');
}

main().catch((err: unknown) => {
  console.error('❌  Error en limpieza:', err);
  process.exit(1);
});
