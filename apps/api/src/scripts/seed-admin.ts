import * as dns from 'dns';
import * as mongoose from 'mongoose';
import * as bcrypt from 'bcrypt';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

// DNS custom para resolver SRV de MongoDB Atlas (igual que en producción)
const dnsServers = (process.env['NODE_DNS_SERVERS'] ?? '8.8.8.8,1.1.1.1').split(',');
dns.setServers(dnsServers);

const MONGODB_URI = process.env['MONGODB_URI'];
if (!MONGODB_URI) {
  console.error('❌  MONGODB_URI no definida en .env');
  process.exit(1);
}

const UsuarioSchema = new mongoose.Schema(
  {
    nombre:       String,
    email:        { type: String, unique: true, lowercase: true, trim: true },
    passwordHash: String,
    rol:          { type: String, default: 'cliente' },
    verificado:   { type: Boolean, default: false },
  },
  { timestamps: true, collection: 'usuarios' },
);

const Usuario = mongoose.model('Usuario', UsuarioSchema);

async function seedAdmin(): Promise<void> {
  const email    = process.argv[2] ?? 'admin@zenda.com';
  const password = process.argv[3] ?? 'Admin@2026!';
  const nombre   = process.argv[4] ?? 'Administrador';

  await mongoose.connect(MONGODB_URI!);
  console.log('✅  Conectado a MongoDB');

  const existente = await Usuario.findOne({ email }).lean();
  if (existente) {
    console.log(`⚠️   Ya existe un usuario con email "${email}". No se creó nada.`);
    await mongoose.disconnect();
    return;
  }

  const passwordHash = await bcrypt.hash(password, 10);
  await Usuario.create({ nombre, email, passwordHash, rol: 'admin', verificado: true });

  console.log('');
  console.log('✅  Usuario admin creado correctamente');
  console.log(`    Email:    ${email}`);
  console.log(`    Password: ${password}`);
  console.log(`    Rol:      admin`);
  console.log('');

  await mongoose.disconnect();
}

seedAdmin().catch((err: unknown) => {
  console.error('❌  Error al crear admin:', err);
  process.exit(1);
});
