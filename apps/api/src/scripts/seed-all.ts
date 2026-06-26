/**
 * Script maestro de seed — crea usuarios, comercios, servicios, cupones y reservas
 * de muestra con datos peruanos reales para desarrollo y demos.
 *
 * Uso:
 *   npm run seed:all --workspace=api
 *
 * Cuentas creadas:
 *   👑 admin@reservalo.pe / Admin@2026!
 *   🏢 hotel@miraflores.pe / Comercio@2026!
 *   🏢 taxis@lima.pe       / Comercio@2026!
 *   🏢 vuelos@peru.pe      / Comercio@2026!
 *   🏢 transporte@peru.pe  / Comercio@2026!
 *   🏢 guarderia@lima.pe   / Comercio@2026!
 *   👤 juan.garcia@gmail.com / Cliente@2026!
 *   👤 maria.lopez@gmail.com / Cliente@2026!
 *   👤 carlos.mendoza@gmail.com / Cliente@2026!
 */

import * as dotenv from 'dotenv';
import * as dns from 'dns';
import * as bcrypt from 'bcrypt';
import * as path from 'path';
import mongoose, { Types } from 'mongoose';

dotenv.config({ path: path.resolve(__dirname, '../../.env') });
dns.setDefaultResultOrder('ipv4first');

const URI = process.env['MONGODB_URI'];
if (!URI) { console.error('❌  MONGODB_URI no definida en .env'); process.exit(1); }

// ── FIXED IDs para poder limpiar sin afectar datos reales ─────────────────────
const ID_ADMIN          = new Types.ObjectId('a00000000000000000000001');
const ID_ADM_HOTELES    = new Types.ObjectId('a00000000000000000000002');
const ID_ADM_TAXIS      = new Types.ObjectId('a00000000000000000000003');
const ID_ADM_VUELOS     = new Types.ObjectId('a00000000000000000000004');
const ID_ADM_TRANSPORTE = new Types.ObjectId('a00000000000000000000005');
const ID_ADM_GUARDERIA  = new Types.ObjectId('a00000000000000000000006');
const ID_CLI_1          = new Types.ObjectId('a00000000000000000000007');
const ID_CLI_2          = new Types.ObjectId('a00000000000000000000008');
const ID_CLI_3          = new Types.ObjectId('a00000000000000000000009');

const ID_COM_HOTELES    = new Types.ObjectId('b00000000000000000000001');
const ID_COM_TAXIS      = new Types.ObjectId('b00000000000000000000002');
const ID_COM_VUELOS     = new Types.ObjectId('b00000000000000000000003');
const ID_COM_TRANSPORTE = new Types.ObjectId('b00000000000000000000004');
const ID_COM_GUARDERIA  = new Types.ObjectId('b00000000000000000000005');
const ID_COM_PEND1      = new Types.ObjectId('b00000000000000000000006');
const ID_COM_PEND2      = new Types.ObjectId('b00000000000000000000007');

const SEED_USER_IDS = [
  ID_ADMIN, ID_ADM_HOTELES, ID_ADM_TAXIS, ID_ADM_VUELOS,
  ID_ADM_TRANSPORTE, ID_ADM_GUARDERIA, ID_CLI_1, ID_CLI_2, ID_CLI_3,
];
const SEED_COMERCIO_IDS = [
  ID_COM_HOTELES, ID_COM_TAXIS, ID_COM_VUELOS,
  ID_COM_TRANSPORTE, ID_COM_GUARDERIA, ID_COM_PEND1, ID_COM_PEND2,
];
const SEED_CUPONES = ['BIENVENIDO10', 'LIMA15', 'CUSCO20'];

// ── HELPERS ───────────────────────────────────────────────────────────────────
const px = (id: number, w = 800): string =>
  `https://images.pexels.com/photos/${id}/pexels-photo-${id}.jpeg?auto=compress&cs=tinysrgb&w=${w}`;

const GEO: Record<string, [number, number]> = {
  Lima:     [-77.0428, -12.0464],
  Cusco:    [-71.9675, -13.5319],
  Arequipa: [-71.5376, -16.4090],
  Trujillo: [-79.0274,  -8.1091],
  Piura:    [-80.6282,  -5.1945],
};

const geo = (ciudad: string) => ({
  type: 'Point' as const,
  coordinates: GEO[ciudad] ?? GEO['Lima'],
});

const ts = () => ({ createdAt: new Date(), updatedAt: new Date() });

// ── MAIN ──────────────────────────────────────────────────────────────────────
async function main(): Promise<void> {
  await mongoose.connect(URI!);
  console.log('✅  Conectado a MongoDB');
  const db = mongoose.connection.db!;

  // ── LIMPIEZA ──────────────────────────────────────────────────────────────
  console.log('\n🗑️   Limpiando datos de seed anteriores...');
  await db.collection('usuarios').deleteMany({ _id: { $in: SEED_USER_IDS } });
  await db.collection('comercios').deleteMany({ _id: { $in: SEED_COMERCIO_IDS } });
  await db.collection('servicios').deleteMany({ comercioId: { $in: SEED_COMERCIO_IDS } });
  await db.collection('reservas').deleteMany({ comercioId: { $in: SEED_COMERCIO_IDS } });
  await db.collection('cupones').deleteMany({ codigo: { $in: SEED_CUPONES } });
  console.log('  ✓ Limpieza completada');

  // ── USUARIOS ──────────────────────────────────────────────────────────────
  console.log('\n👤  Creando usuarios...');
  const hAdmin    = await bcrypt.hash('Admin@2026!', 10);
  const hComercio = await bcrypt.hash('Comercio@2026!', 10);
  const hCliente  = await bcrypt.hash('Cliente@2026!', 10);

  await db.collection('usuarios').insertMany([
    { _id: ID_ADMIN,          nombre: 'Admin Reservalo',         email: 'admin@reservalo.pe',     passwordHash: hAdmin,    rol: 'admin',          verificado: true, ...ts() },
    { _id: ID_ADM_HOTELES,   nombre: 'Ana Torres',              email: 'hotel@miraflores.pe',   passwordHash: hComercio, rol: 'comercio_admin', comercioId: ID_COM_HOTELES,    verificado: true, ...ts() },
    { _id: ID_ADM_TAXIS,     nombre: 'Pedro Lima',              email: 'taxis@lima.pe',          passwordHash: hComercio, rol: 'comercio_admin', comercioId: ID_COM_TAXIS,      verificado: true, ...ts() },
    { _id: ID_ADM_VUELOS,    nombre: 'Rosa Vidal',              email: 'vuelos@peru.pe',         passwordHash: hComercio, rol: 'comercio_admin', comercioId: ID_COM_VUELOS,     verificado: true, ...ts() },
    { _id: ID_ADM_TRANSPORTE,nombre: 'Luis Cárdenas',           email: 'transporte@peru.pe',     passwordHash: hComercio, rol: 'comercio_admin', comercioId: ID_COM_TRANSPORTE, verificado: true, ...ts() },
    { _id: ID_ADM_GUARDERIA, nombre: 'Carmen Díaz',             email: 'guarderia@lima.pe',      passwordHash: hComercio, rol: 'comercio_admin', comercioId: ID_COM_GUARDERIA,  verificado: true, ...ts() },
    { _id: ID_CLI_1,          nombre: 'Juan García',             email: 'juan.garcia@gmail.com',  passwordHash: hCliente,  rol: 'cliente', telefono: '987654321', verificado: true, ...ts() },
    { _id: ID_CLI_2,          nombre: 'María López',             email: 'maria.lopez@gmail.com',  passwordHash: hCliente,  rol: 'cliente', telefono: '976543210', verificado: true, ...ts() },
    { _id: ID_CLI_3,          nombre: 'Carlos Mendoza',          email: 'carlos.mendoza@gmail.com',passwordHash: hCliente, rol: 'cliente', telefono: '965432109', verificado: true, ...ts() },
  ]);
  console.log('  ✓ 9 usuarios creados');

  // ── COMERCIOS ─────────────────────────────────────────────────────────────
  console.log('\n🏢  Creando comercios...');
  await db.collection('comercios').insertMany([
    { _id: ID_COM_HOTELES,    razonSocial: 'Hoteles Miraflores SAC',       vatNumber: '20601234001', nombreComercial: 'Hotel Miraflores Palace', logoUrl: px(271624, 100), verticales: ['hoteles'],    modoLiquidacion: 'merchant', plan: 'pro',    estado: 'activo',    ...ts() },
    { _id: ID_COM_TAXIS,      razonSocial: 'Servicios de Taxi Lima EIRL',  vatNumber: '20601234002', nombreComercial: 'Taxis Lima Express',       logoUrl: px(170811, 100), verticales: ['taxis'],      modoLiquidacion: 'merchant', plan: 'basico', estado: 'activo',    ...ts() },
    { _id: ID_COM_VUELOS,     razonSocial: 'Vuelos Peru SAC',              vatNumber: '20601234003', nombreComercial: 'Vuelos Peru',              logoUrl: px(358319, 100), verticales: ['vuelos'],     modoLiquidacion: 'merchant', plan: 'pro',    estado: 'activo',    ...ts() },
    { _id: ID_COM_TRANSPORTE, razonSocial: 'Carga y Mudanzas Peru SAC',    vatNumber: '20601234004', nombreComercial: 'TransportePeru',           logoUrl: px(4246120, 100),verticales: ['transporte'], modoLiquidacion: 'merchant', plan: 'basico', estado: 'activo',    ...ts() },
    { _id: ID_COM_GUARDERIA,  razonSocial: 'Centro Infantil Arcoiris SAC', vatNumber: '20601234005', nombreComercial: 'Guardería Arcoiris',       logoUrl: px(1148998, 100),verticales: ['guarderia'],  modoLiquidacion: 'merchant', plan: 'basico', estado: 'activo',    ...ts() },
    { _id: ID_COM_PEND1,      razonSocial: 'Hotel Cusco Dreams SAC',       vatNumber: '20601234006', nombreComercial: 'Hotel Cusco Dreams',                                 verticales: ['hoteles'],    plan: 'basico', estado: 'pendiente', ...ts() },
    { _id: ID_COM_PEND2,      razonSocial: 'Taxi Seguro Arequipa EIRL',    vatNumber: '20601234007', nombreComercial: 'TaxiSeguro Arequipa',                                verticales: ['taxis'],      plan: 'basico', estado: 'pendiente', ...ts() },
  ]);
  console.log('  ✓ 7 comercios (5 activos, 2 pendientes)');

  // ── HOTELES ───────────────────────────────────────────────────────────────
  console.log('\n🏨  Insertando hoteles en Lima, Cusco y Arequipa...');
  await db.collection('servicios').insertMany([
    {
      comercioId: ID_COM_HOTELES, vertical: 'hoteles',
      titulo: 'Hotel Miraflores Palace Lima',
      descripcion: 'Hotel de lujo en el exclusivo distrito de Miraflores con vista al océano Pacífico. Spa, piscina infinity y restaurante de autor.',
      imagenes: [px(271624), px(258154), px(261102)],
      ubicacion: { ciudad: 'Lima', geo: geo('Lima') },
      precioBase: 480, precioAnterior: 620, descuentoPct: 23, moneda: 'PEN',
      destacado: true, prioridadRanking: 10, estado: 'publicado',
      ratingPromedio: 9.2, totalReseñas: 1840,
      estrellas: 5, barrio: 'Miraflores', direccion: 'Av. Malecón de la Reserva 1035, Miraflores',
      desayunoIncluido: true, cancelacionGratis: true, habitacionesDisponibles: 6,
      amenities: ['🌊 Vista al Pacífico', '🏊 Piscina infinity', '💆 Spa', '🍳 Desayuno buffet', '🅿️ Valet parking', '🏋️ Gimnasio 24h'],
      checkIn: '15:00', checkOut: '12:00',
      politicaCancelacion: 'Cancelación gratuita hasta 48 h antes del check-in.',
      habitaciones: [
        { id: 'r1', tipo: 'Habitación Deluxe Vista al Mar', descripcion: 'Vista panorámica al Pacífico con terraza privada.', capacidad: 2, camas: '1 cama king', tamano: 42, precio: 480, amenities: ['📶 WiFi', '❄️ A/C', '📺 Smart TV', '🛁 Bañera'], imagenes: [px(258154, 600)], cantidad: 4, disponible: true, cancelacionGratis: true },
        { id: 'r2', tipo: 'Suite Premium Oceanfront',        descripcion: 'Suite de lujo con jacuzzi y sala de estar.',          capacidad: 3, camas: '1 cama king + sofá', tamano: 75, precio: 890, amenities: ['📶 WiFi', '❄️ A/C', '♨️ Jacuzzi', '🍸 Minibar'], imagenes: [px(271624, 600)], cantidad: 2, disponible: true, cancelacionGratis: true },
      ],
      ...ts()
    },
    {
      comercioId: ID_COM_HOTELES, vertical: 'hoteles',
      titulo: 'Casa Andina Premium San Isidro',
      descripcion: 'Hotel boutique premium en el corazón financiero de Lima. A pasos del Parque El Olivar y los mejores restaurantes.',
      imagenes: [px(164595), px(279746), px(258154)],
      ubicacion: { ciudad: 'Lima', geo: geo('Lima') },
      precioBase: 320, moneda: 'PEN',
      destacado: false, prioridadRanking: 5, estado: 'publicado',
      ratingPromedio: 8.8, totalReseñas: 2340,
      estrellas: 5, barrio: 'San Isidro', direccion: 'Calle Los Libertadores 490, San Isidro',
      desayunoIncluido: false, cancelacionGratis: true, habitacionesDisponibles: 10,
      amenities: ['🍽️ Restaurante Perú Mío', '🏋️ Gimnasio', '📶 WiFi Premium', '🛎️ Concierge 24h'],
      checkIn: '15:00', checkOut: '12:00',
      politicaCancelacion: 'Cancelación gratuita hasta 24 h antes del check-in.',
      habitaciones: [
        { id: 'r1', tipo: 'Habitación Superior', descripcion: 'Confort moderno con estilo peruano contemporáneo.', capacidad: 2, camas: '2 camas twin o 1 queen', tamano: 35, precio: 320, amenities: ['📶 WiFi', '❄️ A/C', '📺 Smart TV'], imagenes: [px(164595, 600)], cantidad: 8, disponible: true, cancelacionGratis: true },
        { id: 'r2', tipo: 'Suite San Isidro',    descripcion: 'Sala de estar separada y vista al parque.',           capacidad: 2, camas: '1 cama king', tamano: 55, precio: 580, amenities: ['📶 WiFi', '❄️ A/C', '♨️ Jacuzzi'], imagenes: [px(279746, 600)], cantidad: 2, disponible: true, cancelacionGratis: false },
      ],
      ...ts()
    },
    {
      comercioId: ID_COM_HOTELES, vertical: 'hoteles',
      titulo: 'Palacio del Inka Cusco',
      descripcion: 'Hotel de lujo en el corazón histórico de Cusco, frente al Convento de Santo Domingo. Ambientado en la tradición incaica con muros coloniales originales.',
      imagenes: [px(1457842), px(1571460), px(1660995)],
      ubicacion: { ciudad: 'Cusco', geo: geo('Cusco') },
      precioBase: 550, moneda: 'PEN',
      destacado: true, prioridadRanking: 9, estado: 'publicado',
      ratingPromedio: 9.5, totalReseñas: 3120,
      estrellas: 5, barrio: 'Centro Histórico', direccion: 'Plazoleta Santo Domingo 259, Cusco',
      desayunoIncluido: true, cancelacionGratis: true, habitacionesDisponibles: 4,
      amenities: ['🏛️ Patrimonio UNESCO', '🍽️ Restaurante gourmet', '💆 Spa inca', '🔥 Calefacción andina', '🛎️ Mayordomo'],
      checkIn: '15:00', checkOut: '11:00',
      politicaCancelacion: 'Cancelación gratuita hasta 72 h antes del check-in.',
      habitaciones: [
        { id: 'r1', tipo: 'Habitación Inca Deluxe', descripcion: 'Ambientada en tradición incaica con vista al patio.', capacidad: 2, camas: '1 cama queen', tamano: 38, precio: 550, amenities: ['📶 WiFi', '🔥 Calefacción', '📺 Smart TV'], imagenes: [px(1457842, 600)], cantidad: 3, disponible: true, cancelacionGratis: true },
        { id: 'r2', tipo: 'Suite Imperial',           descripcion: 'Sala de estar y vista directa al Koricancha.',     capacidad: 3, camas: '1 cama king + sofá', tamano: 70, precio: 980, amenities: ['📶 WiFi', '🔥 Calefacción', '♨️ Jacuzzi'], imagenes: [px(1571460, 600)], cantidad: 1, disponible: true, cancelacionGratis: false },
      ],
      ...ts()
    },
    {
      comercioId: ID_COM_HOTELES, vertical: 'hoteles',
      titulo: 'Hotel Libertador Arequipa',
      descripcion: 'Ubicado en el distinguido barrio de Selva Alegre con vista al volcán Misti. Arquitectura colonial con jardines tropicales.',
      imagenes: [px(1134176), px(164595), px(271624)],
      ubicacion: { ciudad: 'Arequipa', geo: geo('Arequipa') },
      precioBase: 280, moneda: 'PEN',
      destacado: false, prioridadRanking: 3, estado: 'publicado',
      ratingPromedio: 8.6, totalReseñas: 980,
      estrellas: 5, barrio: 'Selva Alegre', direccion: 'Calle Selva Alegre 100, Yanahuara, Arequipa',
      desayunoIncluido: false, cancelacionGratis: true, habitacionesDisponibles: 8,
      amenities: ['🌋 Vista al Misti', '🏊 Piscina temperada', '🍽️ Restaurante Cevichería', '💆 Spa'],
      checkIn: '14:00', checkOut: '12:00',
      politicaCancelacion: 'Cancelación gratuita hasta 24 h antes del check-in.',
      habitaciones: [
        { id: 'r1', tipo: 'Habitación Jardín Vista al Misti', descripcion: 'Vista al jardín y al volcán Misti.', capacidad: 2, camas: '2 camas twin', tamano: 30, precio: 280, amenities: ['📶 WiFi', '❄️ A/C', '📺 TV'], imagenes: [px(1134176, 600)], cantidad: 6, disponible: true, cancelacionGratis: true },
        { id: 'r2', tipo: 'Suite Misti',                      descripcion: 'Terraza privada con vista panorámica.',  capacidad: 2, camas: '1 cama king', tamano: 50, precio: 480, amenities: ['📶 WiFi', '❄️ A/C', '🛁 Bañera'], imagenes: [px(164595, 600)], cantidad: 2, disponible: true, cancelacionGratis: false },
      ],
      ...ts()
    },
  ]);
  console.log('  ✓ 4 hoteles (Lima x2, Cusco, Arequipa)');

  // ── TAXIS ─────────────────────────────────────────────────────────────────
  console.log('\n🚗  Creando servicios de taxi en Lima...');
  await db.collection('servicios').insertMany([
    {
      comercioId: ID_COM_TAXIS, vertical: 'taxis',
      titulo: 'Transfer Aeropuerto Jorge Chávez',
      descripcion: 'Traslado seguro del Aeropuerto Jorge Chávez a cualquier distrito de Lima. Conductor puntual, vehículo con A/C y WiFi.',
      imagenes: [px(170811)],
      ubicacion: { ciudad: 'Lima', geo: geo('Lima') },
      precioBase: 45, moneda: 'PEN',
      estado: 'publicado', destacado: true, prioridadRanking: 8,
      ratingPromedio: 4.8, totalReseñas: 1240,
      tipoVehiculo: 'sedan', capacidad: 4,
      zonaCobertura: ['Miraflores', 'San Isidro', 'Barranco', 'Callao', 'San Borja', 'La Molina'],
      tarifaBase: 45, tarifaKm: 2.5, unidadesDisponibles: 20,
      ...ts()
    },
    {
      comercioId: ID_COM_TAXIS, vertical: 'taxis',
      titulo: 'Lima Business VIP Transfer',
      descripcion: 'Servicio ejecutivo con vehículos premium para reuniones de negocios y turismo VIP. Conductor bilingüe.',
      imagenes: [px(116675)],
      ubicacion: { ciudad: 'Lima', geo: geo('Lima') },
      precioBase: 80, moneda: 'PEN',
      estado: 'publicado', destacado: false, prioridadRanking: 5,
      ratingPromedio: 4.9, totalReseñas: 620,
      tipoVehiculo: 'premium', capacidad: 4,
      zonaCobertura: ['Miraflores', 'San Isidro', 'La Molina', 'Surco', 'Lince'],
      tarifaBase: 80, tarifaKm: 4.0, unidadesDisponibles: 8,
      ...ts()
    },
    {
      comercioId: ID_COM_TAXIS, vertical: 'taxis',
      titulo: 'Van Grupal Lima (hasta 8 personas)',
      descripcion: 'Transporte grupal para familias, grupos de amigos, tours privados y traslados de hotel.',
      imagenes: [px(3158562)],
      ubicacion: { ciudad: 'Lima', geo: geo('Lima') },
      precioBase: 120, moneda: 'PEN',
      estado: 'publicado', destacado: false, prioridadRanking: 3,
      ratingPromedio: 4.7, totalReseñas: 380,
      tipoVehiculo: 'van', capacidad: 8,
      zonaCobertura: ['Lima Centro', 'Miraflores', 'Barranco', 'Callao', 'La Molina'],
      tarifaBase: 120, tarifaKm: 3.5, unidadesDisponibles: 5,
      ...ts()
    },
  ]);
  console.log('  ✓ 3 taxis (Lima)');

  // ── VUELOS ────────────────────────────────────────────────────────────────
  console.log('\n✈️   Creando vuelos domésticos Peru...');
  await db.collection('servicios').insertMany([
    {
      comercioId: ID_COM_VUELOS, vertical: 'vuelos',
      titulo: 'Lima (LIM) → Cusco (CUZ)',
      descripcion: 'Vuelo directo Lima-Cusco operado por Latam Peru. 1 maleta de mano incluida.',
      imagenes: [px(358319)],
      ubicacion: { ciudad: 'Lima (LIM)', geo: geo('Lima') },
      precioBase: 189, moneda: 'PEN',
      estado: 'publicado', destacado: true, prioridadRanking: 10,
      ratingPromedio: 4.5, totalReseñas: 2840,
      origen: 'Lima (LIM)', destino: 'Cusco (CUZ)', aerolinea: 'Latam Peru',
      fechaSalida: new Date('2026-09-01T06:00:00Z'),
      fechaLlegada: new Date('2026-09-01T07:20:00Z'),
      asientosTotales: 120, asientosDisponibles: 45, precioAsiento: 189,
      ...ts()
    },
    {
      comercioId: ID_COM_VUELOS, vertical: 'vuelos',
      titulo: 'Lima (LIM) → Arequipa (AQP)',
      descripcion: 'Vuelo directo Lima-Arequipa con Sky Airline. Horario matutino, llega a tiempo para disfrutar el día.',
      imagenes: [px(62623)],
      ubicacion: { ciudad: 'Lima (LIM)', geo: geo('Lima') },
      precioBase: 149, moneda: 'PEN',
      estado: 'publicado', destacado: false, prioridadRanking: 7,
      ratingPromedio: 4.3, totalReseñas: 1560,
      origen: 'Lima (LIM)', destino: 'Arequipa (AQP)', aerolinea: 'Sky Airline',
      fechaSalida: new Date('2026-09-05T07:30:00Z'),
      fechaLlegada: new Date('2026-09-05T09:00:00Z'),
      asientosTotales: 90, asientosDisponibles: 30, precioAsiento: 149,
      ...ts()
    },
    {
      comercioId: ID_COM_VUELOS, vertical: 'vuelos',
      titulo: 'Lima (LIM) → Piura (PIU)',
      descripcion: 'Conexión Lima-Piura con Latam. Ideal para turismo de playa y negocios en el norte.',
      imagenes: [px(723240)],
      ubicacion: { ciudad: 'Lima (LIM)', geo: geo('Lima') },
      precioBase: 169, moneda: 'PEN',
      estado: 'publicado', destacado: false, prioridadRanking: 4,
      ratingPromedio: 4.4, totalReseñas: 890,
      origen: 'Lima (LIM)', destino: 'Piura (PIU)', aerolinea: 'Latam Peru',
      fechaSalida: new Date('2026-09-10T09:00:00Z'),
      fechaLlegada: new Date('2026-09-10T10:30:00Z'),
      asientosTotales: 80, asientosDisponibles: 50, precioAsiento: 169,
      ...ts()
    },
  ]);
  console.log('  ✓ 3 vuelos (Lima→Cusco, Lima→Arequipa, Lima→Piura)');

  // ── TRANSPORTE ────────────────────────────────────────────────────────────
  console.log('\n🚛  Creando servicios de transporte de carga...');
  await db.collection('servicios').insertMany([
    {
      comercioId: ID_COM_TRANSPORTE, vertical: 'transporte',
      titulo: 'Mudanzas Express Lima',
      descripcion: 'Servicio profesional de mudanzas en Lima Metropolitana. Personal capacitado, embalaje incluido y seguro de carga.',
      imagenes: [px(4246120)],
      ubicacion: { ciudad: 'Lima', geo: geo('Lima') },
      precioBase: 350, moneda: 'PEN',
      estado: 'publicado', destacado: false, prioridadRanking: 5,
      ratingPromedio: 4.6, totalReseñas: 420,
      tipoCarga: 'Mudanzas', capacidadKg: 2000, capacidadM3: 25,
      rutasCubiertas: ['Lima Norte', 'Lima Sur', 'Lima Este', 'Lima Centro', 'Callao'],
      tarifaBase: 350, tarifaKg: 0.15,
      ...ts()
    },
    {
      comercioId: ID_COM_TRANSPORTE, vertical: 'transporte',
      titulo: 'Carga Lima–Arequipa (interprovincial)',
      descripcion: 'Transporte interprovincial de carga con GPS en tiempo real, seguro incluido y entrega door-to-door.',
      imagenes: [px(906494)],
      ubicacion: { ciudad: 'Lima', geo: geo('Lima') },
      precioBase: 800, moneda: 'PEN',
      estado: 'publicado', destacado: true, prioridadRanking: 8,
      ratingPromedio: 4.7, totalReseñas: 280,
      tipoCarga: 'Carga General', capacidadKg: 5000, capacidadM3: 40,
      rutasCubiertas: ['Lima', 'Ica', 'Arequipa', 'Cusco'],
      tarifaBase: 800, tarifaKg: 0.12,
      ...ts()
    },
  ]);
  console.log('  ✓ 2 servicios de transporte');

  // ── GUARDERÍAS ────────────────────────────────────────────────────────────
  console.log('\n👶  Creando guarderías en Lima...');
  await db.collection('servicios').insertMany([
    {
      comercioId: ID_COM_GUARDERIA, vertical: 'guarderia',
      titulo: 'Nido Arcoiris Miraflores',
      descripcion: 'Centro de estimulación temprana y cuidado infantil con metodología Montessori. Personal titulado, actividades lúdicas y nutrición saludable.',
      imagenes: [px(1148998), px(296301)],
      ubicacion: { ciudad: 'Lima', geo: geo('Lima') },
      precioBase: 1200, moneda: 'PEN',
      estado: 'publicado', destacado: true, prioridadRanking: 9,
      ratingPromedio: 4.9, totalReseñas: 340,
      rangoEdadMin: 0, rangoEdadMax: 3, cuposTotales: 30, cuposDisponibles: 5,
      modalidad: 'mes', precioHora: 25, precioDia: 80, precioMes: 1200,
      horario: 'L–V 07:00–18:00',
      ...ts()
    },
    {
      comercioId: ID_COM_GUARDERIA, vertical: 'guarderia',
      titulo: 'Wawa House San Isidro (bilingüe)',
      descripcion: 'Guardería bilingüe español-inglés con espacios amplios, nutricionista y psicóloga a tiempo completo. Cámaras 24h para padres.',
      imagenes: [px(296301), px(1148998)],
      ubicacion: { ciudad: 'Lima', geo: geo('Lima') },
      precioBase: 1500, moneda: 'PEN',
      estado: 'publicado', destacado: false, prioridadRanking: 7,
      ratingPromedio: 4.8, totalReseñas: 210,
      rangoEdadMin: 1, rangoEdadMax: 5, cuposTotales: 24, cuposDisponibles: 3,
      modalidad: 'mes', precioHora: 30, precioDia: 95, precioMes: 1500,
      horario: 'L–V 07:30–18:30',
      ...ts()
    },
  ]);
  console.log('  ✓ 2 guarderías (Lima)');

  // ── CUPONES ───────────────────────────────────────────────────────────────
  console.log('\n🎟️   Creando cupones de prueba...');
  await db.collection('cupones').insertMany([
    {
      codigo: 'BIENVENIDO10', tipo: 'porcentaje', valor: 10,
      montoMinimo: 100, topeDescuento: 50, usoMaximo: 100, usados: 0,
      validoHasta: new Date('2026-12-31'), activo: true,
      descripcion: '10% de descuento en tu primera reserva (máx. S/50)',
      ...ts()
    },
    {
      codigo: 'LIMA15', tipo: 'porcentaje', valor: 15, vertical: 'hoteles',
      montoMinimo: 200, topeDescuento: 100, usoMaximo: 50, usados: 12,
      validoHasta: new Date('2026-09-30'), activo: true,
      descripcion: '15% en hoteles de Lima',
      ...ts()
    },
    {
      codigo: 'CUSCO20', tipo: 'fijo', valor: 50, vertical: 'hoteles',
      montoMinimo: 300, usoMaximo: 30, usados: 5,
      validoHasta: new Date('2026-08-31'), activo: true,
      descripcion: 'S/50 de descuento en hoteles en Cusco',
      ...ts()
    },
  ]);
  console.log('  ✓ 3 cupones (BIENVENIDO10, LIMA15, CUSCO20)');

  // ── RESUMEN ───────────────────────────────────────────────────────────────
  console.log('\n');
  console.log('╔═══════════════════════════════════════════════════════════╗');
  console.log('║            ✅  SEED COMPLETADO EXITOSAMENTE              ║');
  console.log('╠═══════════════════════════════════════════════════════════╣');
  console.log('║  👑 ADMIN                                                 ║');
  console.log('║     admin@reservalo.pe / Admin@2026!                      ║');
  console.log('║                                                            ║');
  console.log('║  🏢 COMERCIOS (password: Comercio@2026!)                  ║');
  console.log('║     hotel@miraflores.pe   → Hotel Miraflores Palace (pro) ║');
  console.log('║     taxis@lima.pe         → Taxis Lima Express            ║');
  console.log('║     vuelos@peru.pe        → Vuelos Peru (pro)             ║');
  console.log('║     transporte@peru.pe    → TransportePeru                ║');
  console.log('║     guarderia@lima.pe     → Guardería Arcoiris            ║');
  console.log('║                                                            ║');
  console.log('║  👤 CLIENTES (password: Cliente@2026!)                    ║');
  console.log('║     juan.garcia@gmail.com                                  ║');
  console.log('║     maria.lopez@gmail.com                                  ║');
  console.log('║     carlos.mendoza@gmail.com                               ║');
  console.log('║                                                            ║');
  console.log('║  🎟️  CUPONES: BIENVENIDO10 | LIMA15 | CUSCO20             ║');
  console.log('╚═══════════════════════════════════════════════════════════╝\n');

  await mongoose.disconnect();
}

main().catch((err: unknown) => {
  console.error('❌  Error en seed:', err);
  process.exit(1);
});
