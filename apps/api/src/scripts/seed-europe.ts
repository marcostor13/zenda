/**
 * seed-europe.ts — Datos de prueba para la plataforma Doogking (mercado europeo)
 *
 * Uso: npm run seed:europe --workspace=api
 *
 * Marketplace de servicios caninos en Europa (EUR). Inserta datos coherentes:
 * - 1 admin + 4 usuarios clientes
 * - 6 comercios activos en las 5 categorías caninas
 * - 12 servicios (3 alojamiento, 2 transporte, 3 veterinaria, 2 peluquería, 2 adiestramiento)
 * - 3 reservas de ejemplo en distintos estados
 * - 3 cupones
 * - Comisiones por categoría canina
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
  adminId: new Types.ObjectId('e00000000000000000000001'),
  clienteAna: new Types.ObjectId('e00000000000000000000002'),
  clienteLuca: new Types.ObjectId('e00000000000000000000003'),
  clienteSoph: new Types.ObjectId('e00000000000000000000004'),
  clienteJavi: new Types.ObjectId('e00000000000000000000005'),
  // Comercio admins
  comAdmAloj: new Types.ObjectId('e00000000000000000000006'), // alojamiento (Madrid)
  comAdmAloj2: new Types.ObjectId('e00000000000000000000007'), // alojamiento (Lisboa)
  comAdmTr: new Types.ObjectId('e00000000000000000000008'), // transporte
  comAdmVet: new Types.ObjectId('e00000000000000000000009'), // veterinaria
  comAdmPel: new Types.ObjectId('e00000000000000000000010'), // peluquería
  comAdmAdi: new Types.ObjectId('e00000000000000000000011'), // adiestramiento
  // Comercios
  comAloj: new Types.ObjectId('e00000000000000000000020'),
  comAloj2: new Types.ObjectId('e00000000000000000000021'),
  comTransp: new Types.ObjectId('e00000000000000000000022'),
  comVet: new Types.ObjectId('e00000000000000000000023'),
  comPelu: new Types.ObjectId('e00000000000000000000024'),
  comAdies: new Types.ObjectId('e00000000000000000000025'),
  // Servicios — alojamiento
  svcA1: new Types.ObjectId('e00000000000000000000030'), // Royal Dog Resort Madrid
  svcA2: new Types.ObjectId('e00000000000000000000031'), // City Paws Barcelona
  svcA3: new Types.ObjectId('e00000000000000000000032'), // Boutique Barks Lisboa
  // Servicios — transporte
  svcT1: new Types.ObjectId('e00000000000000000000033'), // PetTransfer Barcelona
  svcT2: new Types.ObjectId('e00000000000000000000034'), // Transfer aeropuerto BCN
  // Servicios — veterinaria
  svcV1: new Types.ObjectId('e00000000000000000000035'), // Clínica Chamberí Madrid
  svcV2: new Types.ObjectId('e00000000000000000000036'), // Hôpital Vétérinaire Paris
  svcV3: new Types.ObjectId('e00000000000000000000037'), // Clínica Valencia
  // Servicios — peluquería
  svcP1: new Types.ObjectId('e00000000000000000000038'), // The Royal Groomer Madrid
  svcP2: new Types.ObjectId('e00000000000000000000039'), // Dog Style Lisboa
  // Servicios — adiestramiento
  svcD1: new Types.ObjectId('e00000000000000000000040'), // Escuela Canina AlphaDog Madrid
  svcD2: new Types.ObjectId('e00000000000000000000041'), // École Canine Paris
};

// ─── Images (Unsplash CDN — perros / servicios caninos) ───────────────────────
const img = {
  alojamiento: [
    'https://images.unsplash.com/photo-1601758228041-f3b2795255f1?auto=format&fit=crop&w=800&q=80',
    'https://images.unsplash.com/photo-1568640347023-a616a30bc3bd?auto=format&fit=crop&w=800&q=80',
  ],
  transporte: 'https://images.unsplash.com/photo-1543466835-00a7907e9de1?auto=format&fit=crop&w=800&q=80',
  veterinaria: 'https://images.unsplash.com/photo-1576201836106-db1758fd1c97?auto=format&fit=crop&w=800&q=80',
  peluqueria: 'https://images.unsplash.com/photo-1591946614720-90a587da4a36?auto=format&fit=crop&w=800&q=80',
  adiestramiento: 'https://images.unsplash.com/photo-1558788353-f76d92427f16?auto=format&fit=crop&w=800&q=80',
  logo: 'https://images.unsplash.com/photo-1587300003388-59208cc962cb?auto=format&fit=crop&w=200&q=80',
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
  const PASS = await bcrypt.hash('Doogking2026!', SALT);
  const now = new Date();

  // ── 1. USUARIOS ────────────────────────────────────────────────────────────
  await db.collection('usuarios').insertMany([
    { _id: ids.adminId, nombre: 'Admin Doogking', email: 'admin@doogking.eu', passwordHash: PASS, rol: 'admin', verificado: true, createdAt: now, updatedAt: now },
    { _id: ids.clienteAna, nombre: 'Ana Martínez', email: 'ana@example.com', passwordHash: PASS, rol: 'cliente', verificado: true, createdAt: now, updatedAt: now },
    { _id: ids.clienteLuca, nombre: 'Luca Bianchi', email: 'luca@example.com', passwordHash: PASS, rol: 'cliente', verificado: true, createdAt: now, updatedAt: now },
    { _id: ids.clienteSoph, nombre: 'Sophie Martin', email: 'sophie@example.com', passwordHash: PASS, rol: 'cliente', verificado: false, createdAt: now, updatedAt: now },
    { _id: ids.clienteJavi, nombre: 'Javier García', email: 'javier@example.com', passwordHash: PASS, rol: 'cliente', verificado: true, createdAt: now, updatedAt: now },
    { _id: ids.comAdmAloj, nombre: 'María Alojamiento', email: 'maria@royaldogresort.eu', passwordHash: PASS, rol: 'comercio_admin', verificado: true, comercioId: ids.comAloj, createdAt: now, updatedAt: now },
    { _id: ids.comAdmAloj2, nombre: 'João Silva', email: 'joao@boutiquebarks.eu', passwordHash: PASS, rol: 'comercio_admin', verificado: true, comercioId: ids.comAloj2, createdAt: now, updatedAt: now },
    { _id: ids.comAdmTr, nombre: 'Pedro Transporte', email: 'pedro@pettransfer.eu', passwordHash: PASS, rol: 'comercio_admin', verificado: true, comercioId: ids.comTransp, createdAt: now, updatedAt: now },
    { _id: ids.comAdmVet, nombre: 'Laura Veterinaria', email: 'laura@vetchamberi.eu', passwordHash: PASS, rol: 'comercio_admin', verificado: true, comercioId: ids.comVet, createdAt: now, updatedAt: now },
    { _id: ids.comAdmPel, nombre: 'Elena Groomer', email: 'elena@royalgroomer.eu', passwordHash: PASS, rol: 'comercio_admin', verificado: true, comercioId: ids.comPelu, createdAt: now, updatedAt: now },
    { _id: ids.comAdmAdi, nombre: 'Carlos Adiestrador', email: 'carlos@alphadog.eu', passwordHash: PASS, rol: 'comercio_admin', verificado: true, comercioId: ids.comAdies, createdAt: now, updatedAt: now },
  ]);
  console.log('👥 Usuarios insertados');

  // ── 2. COMERCIOS ───────────────────────────────────────────────────────────
  await db.collection('comercios').insertMany([
    {
      _id: ids.comAloj, razonSocial: 'Royal Dog Resort S.L.', vatNumber: 'ES-B12345678',
      nombreComercial: 'Royal Dog Resort Madrid', logoUrl: img.logo,
      verticales: ['alojamiento'], modoLiquidacion: 'merchant', plan: 'premium',
      estado: 'activo', comisionPctOverride: null, createdAt: now, updatedAt: now,
    },
    {
      _id: ids.comAloj2, razonSocial: 'Boutique Barks Unipessoal Lda.', vatNumber: 'PT-501234567',
      nombreComercial: 'Boutique Barks Lisboa', logoUrl: null,
      verticales: ['alojamiento'], modoLiquidacion: 'merchant', plan: 'pro',
      estado: 'activo', comisionPctOverride: null, createdAt: now, updatedAt: now,
    },
    {
      _id: ids.comTransp, razonSocial: 'PetTransfer Mobility S.L.', vatNumber: 'ES-B87654321',
      nombreComercial: 'PetTransfer Barcelona', logoUrl: null,
      verticales: ['transporte'], modoLiquidacion: 'merchant', plan: 'pro',
      estado: 'activo', comisionPctOverride: 0.18, createdAt: now, updatedAt: now,
    },
    {
      _id: ids.comVet, razonSocial: 'Clínica Veterinaria Chamberí S.L.', vatNumber: 'ES-B11223344',
      nombreComercial: 'Clínica Veterinaria Chamberí', logoUrl: null,
      verticales: ['veterinaria'], modoLiquidacion: 'merchant', plan: 'premium',
      estado: 'activo', comisionPctOverride: null, createdAt: now, updatedAt: now,
    },
    {
      _id: ids.comPelu, razonSocial: 'The Royal Groomer S.L.', vatNumber: 'ES-B55667788',
      nombreComercial: 'The Royal Groomer', logoUrl: null,
      verticales: ['peluqueria'], modoLiquidacion: 'merchant', plan: 'basico',
      estado: 'activo', comisionPctOverride: null, createdAt: now, updatedAt: now,
    },
    {
      _id: ids.comAdies, razonSocial: 'Escuela Canina AlphaDog S.L.', vatNumber: 'ES-B99887766',
      nombreComercial: 'Escuela Canina AlphaDog', logoUrl: null,
      verticales: ['adiestramiento'], modoLiquidacion: 'merchant', plan: 'pro',
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

  // ALOJAMIENTO CANINO (reserva por noches)
  await db.collection('servicios').insertMany([
    baseServicio({
      _id: ids.svcA1, vertical: 'alojamiento', comercioId: ids.comAloj,
      titulo: 'Royal Dog Resort Madrid', precioBase: 45,
      descripcion: 'Royal Dog Resort: suites individuales con piscina canina, cámaras 24/7 y veterinario de guardia. Junto al parque de El Retiro, Madrid.',
      imagenes: img.alojamiento,
      ubicacion: { ciudad: 'Madrid', geo: { type: 'Point', coordinates: [-3.7038, 40.4168] } },
      destacado: true, prioridadRanking: 10, ratingPromedio: 4.9, totalReseñas: 214,
      // Alojamiento-specific
      barrio: 'Retiro', direccion: 'Calle de Alfonso XII 40, 28014 Madrid',
      checkIn: '12:00', checkOut: '11:00',
      politicaCancelacion: 'Cancelación gratuita hasta 48 horas antes del check-in.',
      requisitoVacunas: true, paseosIncluidos: true, camaras24h: true,
      cancelacionGratis: true, espaciosDisponibles: 10,
      precioAnterior: 55, descuentoPct: 18,
      amenities: ['piscina canina', 'cámaras 24/7', 'veterinario de guardia', 'paseos diarios', 'patio privado'],
      espacios: [
        { id: 'a1e1', tipo: 'suite', tamanoMaxPerro: 'grande', descripcion: 'Suite individual con cama ortopédica y salida a patio privado.', precioNoche: 45, precioAnterior: 55, amenities: ['cama ortopédica', 'climatización', 'webcam en directo'], imagenes: img.alojamiento, cantidad: 6, disponible: true, cancelacionGratis: true },
        { id: 'a1e2', tipo: 'estandar', tamanoMaxPerro: 'mediano', descripcion: 'Espacio estándar con acceso a zona común de juegos.', precioNoche: 35, amenities: ['zona de juegos', 'climatización'], imagenes: img.alojamiento, cantidad: 4, disponible: true, cancelacionGratis: true },
      ],
    }),
    baseServicio({
      _id: ids.svcA2, vertical: 'alojamiento', comercioId: ids.comAloj,
      titulo: 'City Paws Hotel Barcelona', precioBase: 38,
      descripcion: 'City Paws Hotel: suites climatizadas en pleno Eixample, con paseos urbanos diarios y seguimiento por app para tu perro.',
      imagenes: img.alojamiento,
      ubicacion: { ciudad: 'Barcelona', geo: { type: 'Point', coordinates: [2.1734, 41.3851] } },
      destacado: true, prioridadRanking: 9, ratingPromedio: 4.7, totalReseñas: 176,
      barrio: 'Eixample', direccion: 'Carrer de Provença 210, 08036 Barcelona',
      checkIn: '13:00', checkOut: '11:00',
      politicaCancelacion: 'Cancelación gratuita hasta 24 horas antes del check-in.',
      requisitoVacunas: true, paseosIncluidos: true, camaras24h: true,
      cancelacionGratis: true, espaciosDisponibles: 8,
      amenities: ['suites climatizadas', 'paseos diarios', 'cámaras 24/7', 'recogida a domicilio'],
      espacios: [
        { id: 'a2e1', tipo: 'suite', tamanoMaxPerro: 'mediano', descripcion: 'Suite climatizada con luz natural y música relajante.', precioNoche: 38, amenities: ['climatización', 'música relajante'], imagenes: img.alojamiento, cantidad: 8, disponible: true, cancelacionGratis: true },
      ],
    }),
    baseServicio({
      _id: ids.svcA3, vertical: 'alojamiento', comercioId: ids.comAloj2,
      titulo: 'Boutique Barks Lisboa', precioBase: 32,
      descripcion: 'Boutique Barks: residencia canina boutique en Lisboa con jardín exterior, socialización supervisada y cuidados personalizados.',
      imagenes: img.alojamiento,
      ubicacion: { ciudad: 'Lisboa', geo: { type: 'Point', coordinates: [-9.1393, 38.7223] } },
      destacado: false, prioridadRanking: 7, ratingPromedio: 4.8, totalReseñas: 88,
      barrio: 'Alvalade', direccion: 'Avenida de Roma 78, 1700-350 Lisboa',
      checkIn: '12:00', checkOut: '11:00',
      politicaCancelacion: 'Cancelación gratuita hasta 72 horas antes del check-in.',
      requisitoVacunas: true, paseosIncluidos: true, camaras24h: false,
      cancelacionGratis: true, espaciosDisponibles: 12,
      amenities: ['jardín exterior', 'socialización supervisada', 'paseos diarios', 'cuidados personalizados'],
      espacios: [
        { id: 'a3e1', tipo: 'compartido', tamanoMaxPerro: 'gigante', descripcion: 'Espacio compartido con jardín de 400 m² y grupos por tamaño.', precioNoche: 32, amenities: ['jardín 400 m²', 'grupos por tamaño'], imagenes: img.alojamiento, cantidad: 12, disponible: true, cancelacionGratis: true },
      ],
    }),
  ]);

  // TRANSPORTE DE ANIMALES (tarifa base + km)
  await db.collection('servicios').insertMany([
    baseServicio({
      _id: ids.svcT1, vertical: 'transporte', comercioId: ids.comTransp,
      titulo: 'PetTransfer Barcelona — Traslados acondicionados', precioBase: 14,
      descripcion: 'Traslados de perros por Barcelona en van acondicionada con jaulas homologadas, climatización y conductor especializado en manejo canino.',
      imagenes: [img.transporte],
      ubicacion: { ciudad: 'Barcelona', geo: { type: 'Point', coordinates: [2.1734, 41.3851] } },
      destacado: true, prioridadRanking: 8, ratingPromedio: 4.7, totalReseñas: 132,
      tipoVehiculo: 'van_acondicionada', capacidadPerros: 4,
      zonaCobertura: ['Barcelona Centro', 'Eixample', 'Gràcia', 'Sant Martí', 'Sarrià'],
      tarifaBase: 14, tarifaKm: 1.2, jaulasIncluidas: true, acompananteHumano: false,
      soloPerros: true, unidadesDisponibles: 6,
    }),
    baseServicio({
      _id: ids.svcT2, vertical: 'transporte', comercioId: ids.comTransp,
      titulo: 'PetTransfer Aeropuerto El Prat', precioBase: 22,
      descripcion: 'Transfer especializado de mascotas hacia y desde el Aeropuerto Josep Tarradellas Barcelona-El Prat. Furgón climatizado y acompañante humano durante todo el trayecto.',
      imagenes: [img.transporte],
      ubicacion: { ciudad: 'Barcelona', geo: { type: 'Point', coordinates: [2.0785, 41.2974] } },
      destacado: false, prioridadRanking: 6, ratingPromedio: 4.8, totalReseñas: 74,
      tipoVehiculo: 'furgon_climatizado', capacidadPerros: 4,
      zonaCobertura: ['Aeropuerto El Prat', 'Barcelona Centro', 'L\'Hospitalet', 'Castelldefels'],
      tarifaBase: 22, tarifaKm: 1.5, jaulasIncluidas: true, acompananteHumano: true,
      soloPerros: true, unidadesDisponibles: 3,
    }),
  ]);

  // VETERINARIA (cita por fecha/hora)
  await db.collection('servicios').insertMany([
    baseServicio({
      _id: ids.svcV1, vertical: 'veterinaria', comercioId: ids.comVet,
      titulo: 'Clínica Veterinaria Chamberí', precioBase: 35,
      descripcion: 'Clínica Veterinaria Chamberí: atención para perros con equipo colegiado, diagnóstico por imagen, odontología y urgencias 24h. Madrid, España.',
      imagenes: [img.veterinaria],
      ubicacion: { ciudad: 'Madrid', geo: { type: 'Point', coordinates: [-3.7038, 40.4300] } },
      destacado: true, prioridadRanking: 8, ratingPromedio: 4.8, totalReseñas: 156,
      especialidades: ['medicina general', 'vacunación', 'odontología', 'radiografía', 'urgencias'],
      serviciosClinicos: [
        { nombre: 'Consulta general', precio: 35, duracionMin: 30 },
        { nombre: 'Vacunación', precio: 25, duracionMin: 15 },
        { nombre: 'Limpieza dental', precio: 250, duracionMin: 60 },
        { nombre: 'Radiografía', precio: 80, duracionMin: 30 },
      ],
      duracionCitaMin: 30, citasPorDia: 16, citasDisponibles: 8,
      atiendeUrgencias: true, horario: 'L–D 24h (urgencias) · Consultas L–V 09:00–20:00',
      precioConsulta: 35,
    }),
    baseServicio({
      _id: ids.svcV2, vertical: 'veterinaria', comercioId: ids.comVet,
      titulo: 'Hôpital Vétérinaire Paris 15', precioBase: 45,
      descripcion: 'Hôpital Vétérinaire Paris 15: hospital canino con cirugía, dermatología y traumatología. Equipo colegiado y quirófano equipado. París, Francia.',
      imagenes: [img.veterinaria],
      ubicacion: { ciudad: 'París', geo: { type: 'Point', coordinates: [2.2950, 48.8420] } },
      destacado: false, prioridadRanking: 6, ratingPromedio: 4.7, totalReseñas: 98,
      especialidades: ['medicina general', 'cirugía', 'dermatología', 'traumatología'],
      serviciosClinicos: [
        { nombre: 'Consulta general', precio: 45, duracionMin: 30 },
        { nombre: 'Consulta dermatología', precio: 60, duracionMin: 30 },
        { nombre: 'Ecografía', precio: 75, duracionMin: 30 },
        { nombre: 'Cirugía menor', precio: 340, duracionMin: 90 },
      ],
      duracionCitaMin: 30, citasPorDia: 24, citasDisponibles: 12,
      atiendeUrgencias: false, horario: 'L–V 09:00–21:00 · S 10:00–14:00',
      precioConsulta: 45,
    }),
    baseServicio({
      _id: ids.svcV3, vertical: 'veterinaria', comercioId: ids.comVet,
      titulo: 'Veterinaria Ruzafa Valencia', precioBase: 28,
      descripcion: 'Veterinaria Ruzafa: atención canina de proximidad con precios asequibles, vacunación y desparasitación. Valencia, España.',
      imagenes: [img.veterinaria],
      ubicacion: { ciudad: 'Valencia', geo: { type: 'Point', coordinates: [-0.3763, 39.4699] } },
      destacado: false, prioridadRanking: 5, ratingPromedio: 4.6, totalReseñas: 61,
      especialidades: ['medicina general', 'vacunación'],
      serviciosClinicos: [
        { nombre: 'Consulta general', precio: 28, duracionMin: 20 },
        { nombre: 'Vacunación', precio: 20, duracionMin: 15 },
        { nombre: 'Desparasitación', precio: 16, duracionMin: 15 },
      ],
      duracionCitaMin: 20, citasPorDia: 20, citasDisponibles: 10,
      atiendeUrgencias: false, horario: 'L–S 10:00–20:00',
      precioConsulta: 28,
    }),
  ]);

  // PELUQUERÍA CANINA (cita por slots)
  await db.collection('servicios').insertMany([
    baseServicio({
      _id: ids.svcP1, vertical: 'peluqueria', comercioId: ids.comPelu,
      titulo: 'The Royal Groomer Madrid', precioBase: 25,
      descripcion: 'The Royal Groomer: grooming profesional para perros con productos hipoalergénicos, corte de raza y spa premium. Salamanca, Madrid.',
      imagenes: [img.peluqueria],
      ubicacion: { ciudad: 'Madrid', geo: { type: 'Point', coordinates: [-3.6795, 40.4270] } },
      destacado: true, prioridadRanking: 7, ratingPromedio: 4.8, totalReseñas: 143,
      serviciosGrooming: [
        { nombre: 'Baño completo', precio: 25, duracionMin: 45 },
        { nombre: 'Corte de raza', precio: 40, duracionMin: 60 },
        { nombre: 'Deslanado', precio: 35, duracionMin: 60 },
        { nombre: 'Spa premium', precio: 55, duracionMin: 90 },
      ],
      duracionSlotMin: 60, capacidadSimultanea: 3, cuposDisponibles: 12,
      aDomicilio: false, horario: 'L–S 10:00–20:00',
    }),
    baseServicio({
      _id: ids.svcP2, vertical: 'peluqueria', comercioId: ids.comPelu,
      titulo: 'Dog Style Lisboa', precioBase: 22,
      descripcion: 'Dog Style: peluquería canina con servicio a domicilio en Lisboa, corte de uñas, higiene dental y baños relajantes.',
      imagenes: [img.peluqueria],
      ubicacion: { ciudad: 'Lisboa', geo: { type: 'Point', coordinates: [-9.1493, 38.7169] } },
      destacado: false, prioridadRanking: 5, ratingPromedio: 4.7, totalReseñas: 69,
      serviciosGrooming: [
        { nombre: 'Baño completo', precio: 22, duracionMin: 40 },
        { nombre: 'Corte de raza', precio: 38, duracionMin: 60, tamanoPerro: 'mediano' },
        { nombre: 'Corte de uñas', precio: 12, duracionMin: 15 },
        { nombre: 'Higiene dental y oídos', precio: 18, duracionMin: 20 },
      ],
      duracionSlotMin: 60, capacidadSimultanea: 2, cuposDisponibles: 8,
      aDomicilio: true, horario: 'L–V 09:30–19:30 · S 10:00–14:00',
    }),
  ]);

  // ADIESTRAMIENTO CANINO (sesiones o programas)
  await db.collection('servicios').insertMany([
    baseServicio({
      _id: ids.svcD1, vertical: 'adiestramiento', comercioId: ids.comAdies,
      titulo: 'Escuela Canina AlphaDog Madrid', precioBase: 40,
      descripcion: 'Escuela Canina AlphaDog: adiestramiento en positivo con educadores certificados, obediencia básica y modificación de conducta. Casa de Campo, Madrid.',
      imagenes: [img.adiestramiento],
      ubicacion: { ciudad: 'Madrid', geo: { type: 'Point', coordinates: [-3.7492, 40.4192] } },
      destacado: true, prioridadRanking: 8, ratingPromedio: 4.9, totalReseñas: 118,
      tiposAdiestramiento: ['obediencia básica', 'modificación de conducta', 'socialización'],
      modalidad: 'programa', precioSesion: 40, precioPrograma: 320, sesionesPorPrograma: 10,
      edadMinimaMeses: 4, aDomicilio: false, capacidadPorSesion: 6, cuposDisponibles: 18,
      horario: 'L–V 10:00–19:00 · S 10:00–14:00',
    }),
    baseServicio({
      _id: ids.svcD2, vertical: 'adiestramiento', comercioId: ids.comAdies,
      titulo: 'École Canine Positive Paris', precioBase: 45,
      descripcion: 'École Canine Positive: adiestramiento a domicilio para cachorros y socialización con métodos positivos. París, Francia.',
      imagenes: [img.adiestramiento],
      ubicacion: { ciudad: 'París', geo: { type: 'Point', coordinates: [2.3600, 48.8700] } },
      destacado: false, prioridadRanking: 6, ratingPromedio: 4.8, totalReseñas: 57,
      tiposAdiestramiento: ['cachorros', 'socialización', 'obediencia básica'],
      modalidad: 'sesion', precioSesion: 45, precioPrograma: 340, sesionesPorPrograma: 8,
      edadMinimaMeses: 3, aDomicilio: true, capacidadPorSesion: 8, cuposDisponibles: 24,
      horario: 'L–S 09:00–20:00',
    }),
  ]);
  console.log('🏠🚐🩺✂️🎓 Servicios insertados');

  // ── 4. RESERVAS ────────────────────────────────────────────────────────────
  const resId1 = new Types.ObjectId('e00000000000000000000050');
  const resId2 = new Types.ObjectId('e00000000000000000000051');
  const resId3 = new Types.ObjectId('e00000000000000000000052');

  await db.collection('reservas').insertMany([
    {
      _id: resId1, codigo: 'ZND-EU-0001',
      usuarioId: ids.clienteAna, comercioId: ids.comAloj, servicioId: ids.svcA1,
      vertical: 'alojamiento',
      detalle: { titulo: 'Royal Dog Resort Madrid', espacioTipo: 'suite', nombrePerro: 'Toby', noches: 3, checkIn: '2026-07-15', checkOut: '2026-07-18' },
      fechaInicio: new Date('2026-07-15'), fechaFin: new Date('2026-07-18'),
      cantidad: 1, montoSubtotal: 135, comisionMonto: 20.25, montoTotal: 159.05,
      descuentoMonto: 0, cuponCodigo: null, moneda: 'EUR',
      estado: 'confirmada', createdAt: now, updatedAt: now,
    },
    {
      _id: resId2, codigo: 'ZND-EU-0002',
      usuarioId: ids.clienteLuca, comercioId: ids.comVet, servicioId: ids.svcV1,
      vertical: 'veterinaria',
      detalle: { titulo: 'Clínica Veterinaria Chamberí', servicio: 'Consulta general', nombrePerro: 'Luna', fecha: '2026-07-12', hora: '10:30' },
      fechaInicio: new Date('2026-07-12T10:30:00'), fechaFin: null,
      cantidad: 1, montoSubtotal: 35, comisionMonto: 3.5, montoTotal: 41.30,
      descuentoMonto: 0, cuponCodigo: null, moneda: 'EUR',
      estado: 'pendiente', createdAt: now, updatedAt: now,
    },
    {
      _id: resId3, codigo: 'ZND-EU-0003',
      usuarioId: ids.clienteSoph, comercioId: ids.comPelu, servicioId: ids.svcP1,
      vertical: 'peluqueria',
      detalle: { titulo: 'The Royal Groomer Madrid', servicio: 'Corte de raza', nombrePerro: 'Max', fecha: '2026-07-10', hora: '17:00' },
      fechaInicio: new Date('2026-07-10T17:00:00'), fechaFin: null,
      cantidad: 1, montoSubtotal: 40, comisionMonto: 6, montoTotal: 47.20,
      descuentoMonto: 4, cuponCodigo: 'DOGGY10', moneda: 'EUR',
      estado: 'completada', createdAt: now, updatedAt: now,
    },
  ]);
  console.log('📋 Reservas insertadas');

  // ── 5. CUPONES ─────────────────────────────────────────────────────────────
  await db.collection('cupones').insertMany([
    { _id: new Types.ObjectId('e00000000000000000000060'), codigo: 'DOGGY10', tipo: 'porcentaje', valor: 0.10, vertical: 'global', montoMinimo: 30, topeDescuento: 25, usoMaximo: 300, usados: 42, activo: true, descripcion: '10% de descuento en toda Europa', createdAt: now, updatedAt: now },
    { _id: new Types.ObjectId('e00000000000000000000061'), codigo: 'HOTELCAN20', tipo: 'porcentaje', valor: 0.20, vertical: 'alojamiento', montoMinimo: 90, topeDescuento: 50, usoMaximo: 60, usados: 14, activo: true, descripcion: '20% en alojamiento canino', createdAt: now, updatedAt: now },
    { _id: new Types.ObjectId('e00000000000000000000062'), codigo: 'GROOM5', tipo: 'fijo', valor: 5, vertical: 'peluqueria', montoMinimo: 20, topeDescuento: 0, usoMaximo: 150, usados: 9, activo: true, descripcion: '€5 de descuento en peluquería canina', createdAt: now, updatedAt: now },
  ]);
  console.log('🎫 Cupones insertados');

  // ── 6. COMISIONES POR CATEGORÍA CANINA ─────────────────────────────────────
  await db.collection('comision_configs').insertMany([
    { _id: new Types.ObjectId('e00000000000000000000070'), vertical: 'global', comisionPct: 0.15, stripePct: 0.029, stripeFijoEur: 0.25, activo: true, createdAt: now, updatedAt: now },
    { _id: new Types.ObjectId('e00000000000000000000071'), vertical: 'alojamiento', comisionPct: 0.15, stripePct: 0.029, stripeFijoEur: 0.25, activo: true, createdAt: now, updatedAt: now },
    { _id: new Types.ObjectId('e00000000000000000000072'), vertical: 'transporte', comisionPct: 0.18, stripePct: 0.029, stripeFijoEur: 0.25, activo: true, createdAt: now, updatedAt: now },
    { _id: new Types.ObjectId('e00000000000000000000073'), vertical: 'veterinaria', comisionPct: 0.10, stripePct: 0.029, stripeFijoEur: 0.25, activo: true, createdAt: now, updatedAt: now },
    { _id: new Types.ObjectId('e00000000000000000000074'), vertical: 'peluqueria', comisionPct: 0.15, stripePct: 0.029, stripeFijoEur: 0.25, activo: true, createdAt: now, updatedAt: now },
    { _id: new Types.ObjectId('e00000000000000000000075'), vertical: 'adiestramiento', comisionPct: 0.12, stripePct: 0.029, stripeFijoEur: 0.25, activo: true, createdAt: now, updatedAt: now },
  ]);
  console.log('💰 Comisiones insertadas');

  await mongoose.disconnect();

  console.log('\n✅ Seed Europe (Doogking) completado:');
  console.log('   · 11 usuarios (1 admin, 4 clientes, 6 comercio_admin)');
  console.log('   · 6 comercios activos en 5 categorías caninas');
  console.log('   · 12 servicios (3 alojamiento, 2 transporte, 3 veterinaria, 2 peluquería, 2 adiestramiento)');
  console.log('   · 3 reservas de ejemplo');
  console.log('   · 3 cupones de descuento');
  console.log('   · 6 configuraciones de comisión');
  console.log('\n   Credenciales: cualquier usuario → contraseña "Doogking2026!"');
  console.log('   Admin: admin@doogking.eu | Doogking2026!');
}

seed().catch(err => {
  console.error('❌ Error en seed-europe:', err);
  process.exit(1);
});
