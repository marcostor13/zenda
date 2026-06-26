/**
 * seed-europe.ts — Datos de prueba para la plataforma Zenda (mercado europeo)
 *
 * Uso: npm run seed:europe --workspace=api
 *
 * Inserta datos coherentes con imágenes reales de Unsplash:
 * - 1 admin + 8 usuarios clientes
 * - 6 comercios activos (hoteles, taxis, vuelos, transporte, guarderías)
 * - 12 servicios (3 hoteles, 2 vuelos, 2 taxis, 2 transportes, 3 guarderías)
 * - 4 reservas de ejemplo en distintos estados
 * - 4 cupones
 * - Comisiones por vertical
 *
 * IDs fijos con prefijo e0* para poder ejecutar clear-seed-europe.ts
 */

import mongoose, { Types } from 'mongoose';
import * as bcrypt from 'bcrypt';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const MONGO_URI = process.env['MONGODB_URI'] ?? 'mongodb://localhost:27017/zenda';

// ─── Fixed IDs ────────────────────────────────────────────────────────────────
const ids = {
  // Users
  adminId:     new Types.ObjectId('e00000000000000000000001'),
  clienteAna:  new Types.ObjectId('e00000000000000000000002'),
  clienteLuca: new Types.ObjectId('e00000000000000000000003'),
  clienteSoph: new Types.ObjectId('e00000000000000000000004'),
  clienteJavi: new Types.ObjectId('e00000000000000000000005'),
  // Comercio admins
  comAdmH:     new Types.ObjectId('e00000000000000000000006'), // hoteles
  comAdmT:     new Types.ObjectId('e00000000000000000000007'), // taxis
  comAdmV:     new Types.ObjectId('e00000000000000000000008'), // vuelos
  comAdmTr:    new Types.ObjectId('e00000000000000000000009'), // transporte
  comAdmG:     new Types.ObjectId('e00000000000000000000010'), // guarderia
  // Comercios
  comHoteles:  new Types.ObjectId('e00000000000000000000020'),
  comTaxis:    new Types.ObjectId('e00000000000000000000021'),
  comVuelos:   new Types.ObjectId('e00000000000000000000022'),
  comTransp:   new Types.ObjectId('e00000000000000000000023'),
  comGuard:    new Types.ObjectId('e00000000000000000000024'),
  comHoteles2: new Types.ObjectId('e00000000000000000000025'),
  // Servicios
  svcH1:  new Types.ObjectId('e00000000000000000000030'), // Hotel Paris
  svcH2:  new Types.ObjectId('e00000000000000000000031'), // Hotel Barcelona
  svcH3:  new Types.ObjectId('e00000000000000000000032'), // Hotel Roma
  svcV1:  new Types.ObjectId('e00000000000000000000033'), // Vuelo MAD-CDG
  svcV2:  new Types.ObjectId('e00000000000000000000034'), // Vuelo BCN-FCO
  svcT1:  new Types.ObjectId('e00000000000000000000035'), // Taxi Paris
  svcT2:  new Types.ObjectId('e00000000000000000000036'), // Taxi Madrid
  svcTr1: new Types.ObjectId('e00000000000000000000037'), // Transporte Madrid
  svcTr2: new Types.ObjectId('e00000000000000000000038'), // Transporte Barcelona
  svcG1:  new Types.ObjectId('e00000000000000000000039'), // Guardería Madrid
  svcG2:  new Types.ObjectId('e00000000000000000000040'), // Guardería París
  svcG3:  new Types.ObjectId('e00000000000000000000041'), // Guardería Roma
};

// ─── Images (Unsplash CDN) ────────────────────────────────────────────────────
const img = {
  hotels: {
    paris:  ['https://images.unsplash.com/photo-1502602898657-3e91760cbb34?auto=format&fit=crop&w=800&q=80',
             'https://images.unsplash.com/photo-1520209759809-a9bcb6cb3241?auto=format&fit=crop&w=800&q=80'],
    bcn:    ['https://images.unsplash.com/photo-1583422409516-2895a77efded?auto=format&fit=crop&w=800&q=80',
             'https://images.unsplash.com/photo-1523531294919-4bcd7c65e216?auto=format&fit=crop&w=800&q=80'],
    rome:   ['https://images.unsplash.com/photo-1552832230-c0197dd311b5?auto=format&fit=crop&w=800&q=80',
             'https://images.unsplash.com/photo-1525874684015-58379d421a52?auto=format&fit=crop&w=800&q=80'],
  },
  taxi:    'https://images.unsplash.com/photo-1568605117036-5fe5e7bab0b7?auto=format&fit=crop&w=800&q=80',
  flight:  'https://images.unsplash.com/photo-1436491865332-7a61a109cc05?auto=format&fit=crop&w=800&q=80',
  truck:   'https://images.unsplash.com/photo-1601584115197-04ecc0da31d7?auto=format&fit=crop&w=800&q=80',
  daycare: 'https://images.unsplash.com/photo-1587616211892-e93df0b3b1e9?auto=format&fit=crop&w=800&q=80',
};

async function seed(): Promise<void> {
  await mongoose.connect(MONGO_URI);
  console.log('✅ Connected to MongoDB');

  const db = mongoose.connection.db!;

  // ── Clear previous europe seed data ───────────────────────────────────────
  const ePrefix = /^e0/;
  const clearById = async (col: string, field = '_id') => {
    const docs = await db.collection(col).find({}).toArray();
    const toDelete = docs.filter(d => ePrefix.test(String(d[field])));
    if (toDelete.length) {
      await db.collection(col).deleteMany({ [field]: { $in: toDelete.map(d => d[field]) } });
    }
  };
  await Promise.all(['usuarios', 'comercios', 'servicios', 'reservas', 'cupones', 'comision_configs'].map(c => clearById(c)));
  console.log('🧹 Previous Europe seed cleared');

  const SALT = 10;
  const PASS = await bcrypt.hash('Zenda2026!', SALT);
  const now = new Date();

  // ── 1. USUARIOS ────────────────────────────────────────────────────────────
  await db.collection('usuarios').insertMany([
    { _id: ids.adminId,     nombre: 'Admin Zenda',     email: 'admin@zenda.eu',     passwordHash: PASS, rol: 'admin',          verificado: true,  createdAt: now, updatedAt: now },
    { _id: ids.clienteAna,  nombre: 'Ana Martínez',    email: 'ana@example.com',    passwordHash: PASS, rol: 'cliente',         verificado: true,  createdAt: now, updatedAt: now },
    { _id: ids.clienteLuca, nombre: 'Luca Bianchi',    email: 'luca@example.com',   passwordHash: PASS, rol: 'cliente',         verificado: true,  createdAt: now, updatedAt: now },
    { _id: ids.clienteSoph, nombre: 'Sophie Martin',   email: 'sophie@example.com', passwordHash: PASS, rol: 'cliente',         verificado: false, createdAt: now, updatedAt: now },
    { _id: ids.clienteJavi, nombre: 'Javier García',   email: 'javier@example.com', passwordHash: PASS, rol: 'cliente',         verificado: true,  createdAt: now, updatedAt: now },
    { _id: ids.comAdmH,     nombre: 'María Hoteles',   email: 'maria@luxhotel.eu',  passwordHash: PASS, rol: 'comercio_admin',  verificado: true,  comercioId: ids.comHoteles, createdAt: now, updatedAt: now },
    { _id: ids.comAdmT,     nombre: 'Pedro Taxis',     email: 'pedro@eurotaxi.eu',  passwordHash: PASS, rol: 'comercio_admin',  verificado: true,  comercioId: ids.comTaxis,   createdAt: now, updatedAt: now },
    { _id: ids.comAdmV,     nombre: 'Laura Vuelos',    email: 'laura@skyeurope.eu', passwordHash: PASS, rol: 'comercio_admin',  verificado: true,  comercioId: ids.comVuelos,  createdAt: now, updatedAt: now },
    { _id: ids.comAdmTr,    nombre: 'Carlos Cargo',    email: 'carlos@eurocargo.eu',passwordHash: PASS, rol: 'comercio_admin',  verificado: true,  comercioId: ids.comTransp,  createdAt: now, updatedAt: now },
    { _id: ids.comAdmG,     nombre: 'Elena Kids',      email: 'elena@petits.eu',    passwordHash: PASS, rol: 'comercio_admin',  verificado: true,  comercioId: ids.comGuard,   createdAt: now, updatedAt: now },
  ]);
  console.log('👥 Usuarios insertados');

  // ── 2. COMERCIOS ───────────────────────────────────────────────────────────
  await db.collection('comercios').insertMany([
    {
      _id: ids.comHoteles, razonSocial: 'Lux Hotel Group S.L.', vatNumber: 'ES-B12345678',
      nombreComercial: 'Lux Hotels Europe', logoUrl: 'https://images.unsplash.com/photo-1566073771259-6a8506099945?auto=format&fit=crop&w=200&q=80',
      verticales: ['hoteles'], modoLiquidacion: 'merchant', plan: 'premium',
      estado: 'activo', comisionPctOverride: null, createdAt: now, updatedAt: now,
    },
    {
      _id: ids.comHoteles2, razonSocial: 'Boutique Stays S.R.L.', vatNumber: 'IT-12345678901',
      nombreComercial: 'Boutique Stays Italia', logoUrl: null,
      verticales: ['hoteles'], modoLiquidacion: 'merchant', plan: 'pro',
      estado: 'activo', comisionPctOverride: null, createdAt: now, updatedAt: now,
    },
    {
      _id: ids.comTaxis, razonSocial: 'EuroTaxi Network S.A.', vatNumber: 'FR-12345678901',
      nombreComercial: 'EuroTaxi', logoUrl: null,
      verticales: ['taxis'], modoLiquidacion: 'merchant', plan: 'pro',
      estado: 'activo', comisionPctOverride: 0.18, createdAt: now, updatedAt: now,
    },
    {
      _id: ids.comVuelos, razonSocial: 'Sky Europe Airlines GmbH', vatNumber: 'DE-123456789',
      nombreComercial: 'SkyEurope', logoUrl: null,
      verticales: ['vuelos'], modoLiquidacion: 'merchant', plan: 'premium',
      estado: 'activo', comisionPctOverride: 0.07, createdAt: now, updatedAt: now,
    },
    {
      _id: ids.comTransp, razonSocial: 'EuroCargo Logistics S.L.', vatNumber: 'ES-B87654321',
      nombreComercial: 'EuroCargo', logoUrl: null,
      verticales: ['transporte'], modoLiquidacion: 'merchant', plan: 'basico',
      estado: 'activo', comisionPctOverride: null, createdAt: now, updatedAt: now,
    },
    {
      _id: ids.comGuard, razonSocial: 'Petits Europa S.L.', vatNumber: 'ES-B11223344',
      nombreComercial: 'Petits Europa', logoUrl: null,
      verticales: ['guarderia'], modoLiquidacion: 'merchant', plan: 'pro',
      estado: 'activo', comisionPctOverride: null, createdAt: now, updatedAt: now,
    },
  ]);
  console.log('🏢 Comercios insertados');

  // ── 3. SERVICIOS (discriminator: vertical field) ────────────────────────────
  const baseServicio = (overrides: Record<string, unknown>) => ({
    createdAt: now, updatedAt: now, moneda: 'EUR',
    destacado: false, prioridadRanking: 0, estado: 'publicado',
    ratingPromedio: 0, totalReseñas: 0, imagenes: [],
    ...overrides,
  });

  // HOTELES
  await db.collection('servicios').insertMany([
    baseServicio({
      _id: ids.svcH1, vertical: 'hoteles', comercioId: ids.comHoteles,
      titulo: 'Le Marais Boutique Hotel', precioBase: 189,
      descripcion: 'Elegante hotel boutique en el histórico barrio de Le Marais, a 5 minutos del Centro Pompidou. Desayuno incluido y terraza con vista a los tejados de París.',
      imagenes: img.hotels.paris,
      ubicacion: { ciudad: 'París', geo: { type: 'Point', coordinates: [2.3522, 48.8566] } },
      destacado: true, prioridadRanking: 10, ratingPromedio: 4.8, totalReseñas: 312,
      // Hotel-specific fields
      estrellas: 4, barrio: 'Le Marais', direccion: 'Rue de Bretagne 42, 75003 Paris',
      checkIn: '15:00', checkOut: '12:00', desayunoIncluido: true,
      cancelacionGratis: true, politicaCancelacion: 'Cancelación gratuita hasta 48h antes.',
      habitacionesDisponibles: 8, amenities: ['WiFi gratis', 'Desayuno incluido', 'Terraza', 'Conserjería 24h', 'Caja fuerte'],
      habitaciones: [
        { id: 'h1r1', tipo: 'Habitación Clásica', descripcion: 'Doble con vistas al patio', capacidad: 2, camas: '1 cama doble', tamano: 20, precio: 189, amenities: ['WiFi', 'TV', 'Baño privado'], imagenes: img.hotels.paris, cantidad: 5, disponible: true, cancelacionGratis: true },
        { id: 'h1r2', tipo: 'Suite Junior', descripcion: 'Suite con salón y vistas a la calle', capacidad: 2, camas: '1 cama king', tamano: 35, precio: 289, amenities: ['WiFi', 'TV 55"', 'Minibar', 'Bañera'], imagenes: img.hotels.paris, cantidad: 3, disponible: true, cancelacionGratis: true },
      ],
    }),
    baseServicio({
      _id: ids.svcH2, vertical: 'hoteles', comercioId: ids.comHoteles,
      titulo: 'NH Collection Barcelona Gran Via', precioBase: 145,
      descripcion: 'Hotel urbano en pleno centro de Barcelona, a 200m del Paseo de Gracia y la Pedrera. Rooftop con piscina y vistas a la ciudad.',
      imagenes: img.hotels.bcn,
      ubicacion: { ciudad: 'Barcelona', geo: { type: 'Point', coordinates: [2.1734, 41.3851] } },
      destacado: true, prioridadRanking: 9, ratingPromedio: 4.6, totalReseñas: 487,
      estrellas: 4, barrio: 'Eixample', direccion: 'Gran Via de les Corts Catalanes 647, 08010',
      checkIn: '14:00', checkOut: '12:00', desayunoIncluido: false,
      cancelacionGratis: true, politicaCancelacion: 'Cancelación gratuita hasta 24h antes.',
      habitacionesDisponibles: 14, amenities: ['Piscina rooftop', 'WiFi gratis', 'Gimnasio', 'Bar', 'Parking'],
      habitaciones: [
        { id: 'h2r1', tipo: 'Superior Doble', descripcion: 'Vista ciudad', capacidad: 2, camas: '1 cama queen', tamano: 25, precio: 145, amenities: ['WiFi', 'TV', 'AC'], imagenes: img.hotels.bcn, cantidad: 10, disponible: true, cancelacionGratis: true },
        { id: 'h2r2', tipo: 'Deluxe con terraza', descripcion: 'Terraza privada con vistas', capacidad: 2, camas: '1 cama king', tamano: 32, precio: 220, amenities: ['WiFi', 'TV 4K', 'Terraza privada', 'Minibar'], imagenes: img.hotels.bcn, cantidad: 4, disponible: true, cancelacionGratis: false },
      ],
    }),
    baseServicio({
      _id: ids.svcH3, vertical: 'hoteles', comercioId: ids.comHoteles2,
      titulo: 'Palazzo Venezia Heritage', precioBase: 210,
      descripcion: 'Palazzo del siglo XVI restaurado a orillas del Gran Canal. Cada habitación conserva frescos originales y mármoles venecianos.',
      imagenes: img.hotels.rome,
      ubicacion: { ciudad: 'Roma', geo: { type: 'Point', coordinates: [12.4964, 41.9028] } },
      destacado: false, prioridadRanking: 7, ratingPromedio: 4.9, totalReseñas: 189,
      estrellas: 5, barrio: 'Centro Storico', direccion: 'Via del Corso 303, 00186 Roma',
      checkIn: '15:00', checkOut: '11:00', desayunoIncluido: true,
      cancelacionGratis: false, politicaCancelacion: 'No reembolsable.',
      habitacionesDisponibles: 3, amenities: ['Desayuno buffet', 'Spa', 'Concierge VIP', 'Transfer aeropuerto', 'Bicicletas gratis'],
      habitaciones: [
        { id: 'h3r1', tipo: 'Habitación Heritage', descripcion: 'Frescos originales del s.XVI', capacidad: 2, camas: '2 camas individuales', tamano: 28, precio: 210, amenities: ['WiFi', 'AC', 'Baño mármol'], imagenes: img.hotels.rome, cantidad: 3, disponible: true, cancelacionGratis: false },
      ],
    }),
  ]);

  // VUELOS
  const fechaSalida1 = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
  const fechaSalida2 = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000);
  await db.collection('servicios').insertMany([
    baseServicio({
      _id: ids.svcV1, vertical: 'vuelos', comercioId: ids.comVuelos,
      titulo: 'Madrid (MAD) → París (CDG)',
      descripcion: 'Vuelo directo Madrid-París con Iberia. Tarifa Flex con equipaje de mano y facturado incluidos.',
      imagenes: [img.flight],
      ubicacion: { ciudad: 'Madrid' },
      precioBase: 89, prioridadRanking: 8, ratingPromedio: 4.3, totalReseñas: 892,
      // Vuelo-specific
      origen: 'Madrid (MAD)', destino: 'París (CDG)',
      fechaSalida: fechaSalida1, fechaLlegada: new Date(fechaSalida1.getTime() + 2.5 * 60 * 60 * 1000),
      aerolinea: 'Iberia', asientosTotales: 180, asientosDisponibles: 48, precioAsiento: 89,
    }),
    baseServicio({
      _id: ids.svcV2, vertical: 'vuelos', comercioId: ids.comVuelos,
      titulo: 'Barcelona (BCN) → Roma (FCO)',
      descripcion: 'Vuelo low-cost Barcelona-Roma con Vueling. Solo carry-on. Puntualidad 96%.',
      imagenes: [img.flight],
      ubicacion: { ciudad: 'Barcelona' },
      precioBase: 59, prioridadRanking: 7, ratingPromedio: 4.1, totalReseñas: 634,
      origen: 'Barcelona (BCN)', destino: 'Roma (FCO)',
      fechaSalida: fechaSalida2, fechaLlegada: new Date(fechaSalida2.getTime() + 2.1 * 60 * 60 * 1000),
      aerolinea: 'Vueling', asientosTotales: 200, asientosDisponibles: 122, precioAsiento: 59,
    }),
  ]);

  // TAXIS
  await db.collection('servicios').insertMany([
    baseServicio({
      _id: ids.svcT1, vertical: 'taxis', comercioId: ids.comTaxis,
      titulo: 'Transfer CDG → Centro París',
      descripcion: 'Traslado privado del Aeropuerto Charles de Gaulle al centro de París en vehículo premium. Conductor con cartel de bienvenida.',
      imagenes: [img.taxi],
      ubicacion: { ciudad: 'París', geo: { type: 'Point', coordinates: [2.3488, 48.8534] } },
      precioBase: 75, prioridadRanking: 6, ratingPromedio: 4.7, totalReseñas: 1204,
      tipoVehiculo: 'premium', capacidad: 4, zonaCobertura: ['CDG', 'ORY', 'París centro'],
      tarifaBase: 75, tarifaKm: 2.5, unidadesDisponibles: 12,
    }),
    baseServicio({
      _id: ids.svcT2, vertical: 'taxis', comercioId: ids.comTaxis,
      titulo: 'Taxi Madrid Barajas ↔ Centro',
      descripcion: 'Taxi oficial certificado desde/hacia el Aeropuerto de Madrid-Barajas (T1-T4). Tarifa fija sin sorpresas.',
      imagenes: [img.taxi],
      ubicacion: { ciudad: 'Madrid', geo: { type: 'Point', coordinates: [-3.7038, 40.4168] } },
      precioBase: 30, prioridadRanking: 5, ratingPromedio: 4.5, totalReseñas: 2180,
      tipoVehiculo: 'sedan', capacidad: 4, zonaCobertura: ['MAD T1', 'MAD T2', 'MAD T4', 'Madrid centro'],
      tarifaBase: 30, tarifaKm: 1.2, unidadesDisponibles: 28,
    }),
  ]);

  // TRANSPORTE
  await db.collection('servicios').insertMany([
    baseServicio({
      _id: ids.svcTr1, vertical: 'transporte', comercioId: ids.comTransp,
      titulo: 'Mudanzas Express Madrid–Barcelona',
      descripcion: 'Transporte de mudanzas en camión cerrado con GPS y seguro a todo riesgo. Cuadrilla de carga y descarga incluida.',
      imagenes: [img.truck],
      ubicacion: { ciudad: 'Madrid' },
      precioBase: 650, prioridadRanking: 5, ratingPromedio: 4.4, totalReseñas: 87,
      tipoCarga: 'Mudanzas / Muebles', capacidadKg: 3000, capacidadM3: 30,
      rutasCubiertas: ['Madrid', 'Barcelona', 'Valencia', 'Bilbao'],
      tarifaBase: 650, tarifaKg: 0.15,
    }),
    baseServicio({
      _id: ids.svcTr2, vertical: 'transporte', comercioId: ids.comTransp,
      titulo: 'Carga Refrigerada Europa',
      descripcion: 'Transporte de mercancías refrigeradas entre principales ciudades europeas. Certificación ATP y trazabilidad en tiempo real.',
      imagenes: [img.truck],
      ubicacion: { ciudad: 'Barcelona' },
      precioBase: 900, prioridadRanking: 4, ratingPromedio: 4.6, totalReseñas: 43,
      tipoCarga: 'Refrigerado / Alimentación', capacidadKg: 5000, capacidadM3: 45,
      rutasCubiertas: ['Barcelona', 'Lyon', 'París', 'Bruselas', 'Ámsterdam'],
      tarifaBase: 900, tarifaKg: 0.20,
    }),
  ]);

  // GUARDERÍAS
  await db.collection('servicios').insertMany([
    baseServicio({
      _id: ids.svcG1, vertical: 'guarderia', comercioId: ids.comGuard,
      titulo: 'Escuela Infantil Sol y Luna Madrid',
      descripcion: 'Escuela infantil bilingüe (español–inglés) con ratio 1:4. Jardín propio, comedor ecológico y actividades psicomotrices. Plazas limitadas.',
      imagenes: [img.daycare],
      ubicacion: { ciudad: 'Madrid', geo: { type: 'Point', coordinates: [-3.6918, 40.4195] } },
      precioBase: 520, prioridadRanking: 8, ratingPromedio: 4.9, totalReseñas: 94,
      destacado: true,
      rangoEdadMin: 0, rangoEdadMax: 3, cuposTotales: 30, cuposDisponibles: 5,
      modalidad: 'mes', precioHora: 8, precioDia: 45, precioMes: 520,
      horario: 'L–V 07:30–18:00',
    }),
    baseServicio({
      _id: ids.svcG2, vertical: 'guarderia', comercioId: ids.comGuard,
      titulo: 'Petits Paris – Crèche Bilingüe',
      descripcion: 'Crèche privada en el 16ème arrondissement. Equipo bilingüe francés–español, proyectos pedagógicos Montessori y cocina casera.',
      imagenes: [img.daycare],
      ubicacion: { ciudad: 'París', geo: { type: 'Point', coordinates: [2.2765, 48.8545] } },
      precioBase: 980, prioridadRanking: 7, ratingPromedio: 4.8, totalReseñas: 67,
      rangoEdadMin: 3, rangoEdadMax: 6, cuposTotales: 20, cuposDisponibles: 2,
      modalidad: 'mes', precioHora: 12, precioDia: 80, precioMes: 980,
      horario: 'L–V 08:00–18:30',
    }),
    baseServicio({
      _id: ids.svcG3, vertical: 'guarderia', comercioId: ids.comGuard,
      titulo: 'Nido Romano – Asilo Nido Privato',
      descripcion: 'Asilo nido en Parioli (Roma) con metodología Reggio Emilia. Personal educativo cualificado, actividades de arte y música desde los 3 meses.',
      imagenes: [img.daycare],
      ubicacion: { ciudad: 'Roma', geo: { type: 'Point', coordinates: [12.5148, 41.9175] } },
      precioBase: 750, prioridadRanking: 6, ratingPromedio: 4.7, totalReseñas: 38,
      rangoEdadMin: 0, rangoEdadMax: 3, cuposTotales: 15, cuposDisponibles: 1,
      modalidad: 'mes', precioHora: 10, precioDia: 60, precioMes: 750,
      horario: 'L–V 07:00–17:00',
    }),
  ]);
  console.log('🏨✈️🚗📦👶 Servicios insertados');

  // ── 4. RESERVAS ────────────────────────────────────────────────────────────
  const resId1 = new Types.ObjectId('e00000000000000000000050');
  const resId2 = new Types.ObjectId('e00000000000000000000051');
  const resId3 = new Types.ObjectId('e00000000000000000000052');
  const resId4 = new Types.ObjectId('e00000000000000000000053');

  await db.collection('reservas').insertMany([
    {
      _id: resId1, codigo: 'ZND-EU-0001',
      usuarioId: ids.clienteAna, comercioId: ids.comHoteles, servicioId: ids.svcH1,
      vertical: 'hoteles',
      detalle: { titulo: 'Le Marais Boutique Hotel', habitacionTipo: 'Suite Junior', noches: 3, checkIn: '2026-07-15', checkOut: '2026-07-18' },
      fechaInicio: new Date('2026-07-15'), fechaFin: new Date('2026-07-18'),
      cantidad: 1, montoSubtotal: 867, comisionMonto: 130.05, montoTotal: 1021.06,
      descuentoMonto: 0, cuponCodigo: null, moneda: 'EUR',
      estado: 'confirmada', createdAt: now, updatedAt: now,
    },
    {
      _id: resId2, codigo: 'ZND-EU-0002',
      usuarioId: ids.clienteLuca, comercioId: ids.comVuelos, servicioId: ids.svcV1,
      vertical: 'vuelos',
      detalle: { titulo: 'Madrid → París (Iberia)', asientos: 2, clase: 'turista' },
      fechaInicio: fechaSalida1, fechaFin: null,
      cantidad: 2, montoSubtotal: 178, comisionMonto: 12.46, montoTotal: 209.54,
      descuentoMonto: 0, cuponCodigo: null, moneda: 'EUR',
      estado: 'pendiente', createdAt: now, updatedAt: now,
    },
    {
      _id: resId3, codigo: 'ZND-EU-0003',
      usuarioId: ids.clienteSoph, comercioId: ids.comTaxis, servicioId: ids.svcT1,
      vertical: 'taxis',
      detalle: { titulo: 'Transfer CDG → París centro', vehiculo: 'premium' },
      fechaInicio: new Date('2026-07-10T18:30:00'), fechaFin: null,
      cantidad: 1, montoSubtotal: 75, comisionMonto: 13.5, montoTotal: 88.5,
      descuentoMonto: 0, cuponCodigo: 'EUROPA10', moneda: 'EUR',
      estado: 'completada', createdAt: now, updatedAt: now,
    },
    {
      _id: resId4, codigo: 'ZND-EU-0004',
      usuarioId: ids.clienteJavi, comercioId: ids.comGuard, servicioId: ids.svcG1,
      vertical: 'guarderia',
      detalle: { titulo: 'Escuela Infantil Sol y Luna', modalidad: 'mes', nombreNino: 'Carlos García', edadMeses: 18 },
      fechaInicio: new Date('2026-09-01'), fechaFin: new Date('2026-09-30'),
      cantidad: 1, montoSubtotal: 520, comisionMonto: 52, montoTotal: 623.6,
      descuentoMonto: 0, cuponCodigo: null, moneda: 'EUR',
      estado: 'confirmada', createdAt: now, updatedAt: now,
    },
  ]);
  console.log('📋 Reservas insertadas');

  // ── 5. CUPONES ─────────────────────────────────────────────────────────────
  await db.collection('cupones').insertMany([
    { _id: new Types.ObjectId('e00000000000000000000060'), codigo: 'EUROPA10',    tipo: 'porcentaje', valor: 0.10, vertical: 'global',  montoMinimo: 50,  topeDescuento: 30, usoMaximo: 200, usados: 47, activo: true, descripcion: '10% de descuento en toda Europa', createdAt: now, updatedAt: now },
    { _id: new Types.ObjectId('e00000000000000000000061'), codigo: 'PARIS20',     tipo: 'porcentaje', valor: 0.20, vertical: 'hoteles', montoMinimo: 150, topeDescuento: 60, usoMaximo: 50,  usados: 12, activo: true, descripcion: '20% en hoteles de París',         createdAt: now, updatedAt: now },
    { _id: new Types.ObjectId('e00000000000000000000062'), codigo: 'VUELO15',     tipo: 'fijo',       valor: 15,   vertical: 'vuelos',  montoMinimo: 80,  topeDescuento: 0,  usoMaximo: 100, usados: 8,  activo: true, descripcion: '€15 de descuento en vuelos',     createdAt: now, updatedAt: now },
    { _id: new Types.ObjectId('e00000000000000000000063'), codigo: 'BIENVENIDOEU',tipo: 'porcentaje', valor: 0.15, vertical: 'global',  montoMinimo: 0,   topeDescuento: 25, usoMaximo: 500, usados: 0,  activo: true, descripcion: 'Cupón de bienvenida 15%',       createdAt: now, updatedAt: now, validoHasta: new Date('2026-12-31') },
  ]);
  console.log('🎫 Cupones insertados');

  // ── 6. COMISIONES POR VERTICAL ─────────────────────────────────────────────
  await db.collection('comision_configs').insertMany([
    { _id: new Types.ObjectId('e00000000000000000000070'), vertical: 'global',     comisionPct: 0.15, stripePct: 0.029, stripeFijoEur: 0.25, activo: true, createdAt: now, updatedAt: now },
    { _id: new Types.ObjectId('e00000000000000000000071'), vertical: 'hoteles',    comisionPct: 0.15, stripePct: 0.029, stripeFijoEur: 0.25, activo: true, createdAt: now, updatedAt: now },
    { _id: new Types.ObjectId('e00000000000000000000072'), vertical: 'vuelos',     comisionPct: 0.08, stripePct: 0.029, stripeFijoEur: 0.25, activo: true, createdAt: now, updatedAt: now },
    { _id: new Types.ObjectId('e00000000000000000000073'), vertical: 'taxis',      comisionPct: 0.20, stripePct: 0.029, stripeFijoEur: 0.25, activo: true, createdAt: now, updatedAt: now },
    { _id: new Types.ObjectId('e00000000000000000000074'), vertical: 'transporte', comisionPct: 0.12, stripePct: 0.029, stripeFijoEur: 0.25, activo: true, createdAt: now, updatedAt: now },
    { _id: new Types.ObjectId('e00000000000000000000075'), vertical: 'guarderia',  comisionPct: 0.10, stripePct: 0.029, stripeFijoEur: 0.25, activo: true, createdAt: now, updatedAt: now },
  ]);
  console.log('💰 Comisiones insertadas');

  await mongoose.disconnect();

  console.log('\n✅ Seed Europe completado:');
  console.log('   · 10 usuarios (1 admin, 4 clientes, 5 comercio_admin)');
  console.log('   · 6 comercios activos');
  console.log('   · 12 servicios en 5 verticales');
  console.log('   · 4 reservas de ejemplo');
  console.log('   · 4 cupones de descuento');
  console.log('   · 6 configuraciones de comisión');
  console.log('\n   Credenciales: cualquier usuario → contraseña "Zenda2026!"');
  console.log('   Admin: admin@zenda.eu | Zenda2026!');
}

seed().catch(err => {
  console.error('❌ Error en seed-europe:', err);
  process.exit(1);
});
