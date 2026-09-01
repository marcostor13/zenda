/**
 * Catálogos de sugerencias de los campos de etiquetas (`rs-tags-input`).
 *
 * No son listas cerradas salvo donde se indica: sirven para que la mayoría de
 * comercios elija lo mismo —y el buscador pueda filtrar por ello— sin impedir
 * que alguien añada algo que no habíamos previsto.
 */

/** Servicios del alojamiento en conjunto. */
export const AMENITIES_ALOJAMIENTO: readonly string[] = [
  'Jardín vallado', 'Patio exterior', 'Piscina canina', 'Zona de juegos',
  'Paseos diarios', 'Cámaras 24 h', 'Veterinario de guardia', 'Aire acondicionado',
  'Calefacción', 'Recogida a domicilio', 'Alimentación incluida', 'Medicación supervisada',
  'Adiestrador en plantilla', 'Zona para cachorros', 'Zona para perros mayores',
  'Espacios individuales', 'Informe diario con fotos',
];

/**
 * Servicios de un espacio o suite concreta.
 *
 * `Otros` va al final y no es un servicio: `rs-tags-input` lo reconoce por
 * `opcionOtros` y abre un campo para escribir el que sí lo es. Sin esa opción a
 * la vista, nadie descubre que el campo admite texto libre.
 */
export const OTROS_SERVICIOS = 'Otros';

export const AMENITIES_ESPACIO: readonly string[] = [
  'Manta propia', 'Cámara individual', 'Aire acondicionado',
  'Calefacción', 'Suelo radiante', 'Salida a jardín privado', 'Ventana exterior',
  'Aislamiento acústico', 'Bebedero automático', 'Juguetes',
  OTROS_SERVICIOS,
];

export const ESPECIALIDADES_VETERINARIAS: readonly string[] = [
  'Medicina general', 'Cirugía', 'Traumatología', 'Dermatología', 'Oftalmología',
  'Odontología', 'Cardiología', 'Neurología', 'Oncología', 'Endocrinología',
  'Reproducción', 'Etología', 'Fisioterapia', 'Rehabilitación', 'Diagnóstico por imagen',
  'Análisis clínicos', 'Urgencias 24 h', 'Animales exóticos', 'Nutrición',
];

/** Catálogo cerrado: el buscador filtra por especie y no admite variantes libres. */
export const ESPECIES_ATENDIDAS: readonly string[] = [
  'Perro', 'Gato', 'Conejo', 'Hurón', 'Roedor', 'Ave', 'Reptil', 'Équido',
];

/** Razas más frecuentes en España; la lista completa sería inmanejable. */
export const RAZAS_FRECUENTES: readonly string[] = [
  'Mestizo', 'Labrador Retriever', 'Golden Retriever', 'Pastor Alemán', 'Pastor Belga',
  'Border Collie', 'Bulldog Francés', 'Bulldog Inglés', 'Yorkshire Terrier', 'Chihuahua',
  'Caniche', 'Bichón Maltés', 'Cocker Spaniel', 'Beagle', 'Boxer', 'Husky Siberiano',
  'Galgo Español', 'Podenco', 'Teckel', 'Shih Tzu', 'Schnauzer', 'Setter Irlandés',
  'Pug', 'Shar Pei', 'Dálmata', 'San Bernardo', 'Gran Danés', 'Mastín Español',
  'American Staffordshire Terrier', 'Pit Bull Terrier', 'Rottweiler', 'Dóberman',
  'Akita Inu', 'Shiba Inu', 'Samoyedo', 'Weimaraner', 'Braco Alemán',
];

/** Catálogo cerrado: se cruza con el temperamento declarado en la ficha del perro. */
export const TEMPERAMENTOS: readonly string[] = [
  'Agresivo con perros', 'Agresivo con personas', 'Muy nervioso', 'Miedoso',
  'Reactivo con la correa', 'Ladrador', 'Destructivo', 'Fugitivo',
  'Ansiedad por separación', 'Protector con la comida',
];

export const TIPOS_ADIESTRAMIENTO: readonly string[] = [
  'Obediencia básica', 'Obediencia avanzada', 'Educación de cachorros',
  'Modificación de conducta', 'Ansiedad por separación', 'Reactividad',
  'Socialización', 'Paseo con correa', 'Llamada', 'Detección de olores',
  'Agility', 'Perro de asistencia', 'Perro de guarda', 'Adiestramiento deportivo',
];

/**
 * Cursos que un centro puede publicar en su catálogo, con el tipo de
 * adiestramiento que declara cada uno. El buscador ordena por ese tipo
 * (PROBLEMAS_ADIESTRAMIENTO en `vertical-browse`), así que el nombre comercial
 * del curso no puede ser el dato que se compara: por eso van emparejados aquí.
 */
export const CURSOS_ADIESTRAMIENTO: ReadonlyArray<{ nombre: string; tipo: string }> = [
  { nombre: 'Curso cachorro',                 tipo: 'Educación de cachorros' },
  { nombre: 'Curso obediencia básica',        tipo: 'Obediencia básica' },
  { nombre: 'Curso obediencia avanzada',      tipo: 'Obediencia avanzada' },
  { nombre: 'Curso modificación de conducta', tipo: 'Modificación de conducta' },
  { nombre: 'Curso de llamada',               tipo: 'Llamada' },
  { nombre: 'Curso de paseo sin tirar',       tipo: 'Paseo con correa' },
  { nombre: 'Curso de sociabilización',       tipo: 'Socialización' },
  { nombre: 'Preparación perro de terapia',   tipo: 'Perro de asistencia' },
  { nombre: 'Preparación perro deportivo',    tipo: 'Adiestramiento deportivo' },
];

/** Lo que suele incluir un servicio funerario; la empresa puede escribir otros. */
export const INCLUYE_FUNERARIO: readonly string[] = [
  'Recogida a domicilio', 'Recogida en clínica veterinaria', 'Traslado', 'Urna básica',
  'Certificado de cremación', 'Huella conmemorativa', 'Mechón de pelo', 'Sala de despedida',
  'Ceremonia de despedida', 'Entrega de cenizas a domicilio', 'Acompañamiento telefónico',
  'Gestión de la documentación', 'Manta o sudario',
];

export const SERVICIOS_PETFRIENDLY: readonly string[] = [
  'Cama para mascota', 'Comedero y bebedero', 'Manta', 'Servicio de paseo',
  'Guardería en el hotel', 'Zona de esparcimiento', 'Menú para mascotas',
  'Kit de bienvenida', 'Veterinario a demanda', 'Servicio de peluquería',
  'Transporte desde el aeropuerto',
];

// ─── Ficha del perro ───

export const MIEDOS_FRECUENTES: readonly string[] = [
  'Tormentas', 'Petardos', 'Fuegos artificiales', 'Ruidos fuertes', 'Aspiradora',
  'Coches', 'Motos', 'Bicicletas', 'Personas desconocidas', 'Niños',
  'Otros perros', 'Veterinario', 'Peluquería', 'Quedarse solo', 'Agua', 'Escaleras',
];

export const ALERGIAS_FRECUENTES: readonly string[] = [
  'Pollo', 'Ternera', 'Cerdo', 'Cordero', 'Pescado', 'Huevo', 'Lácteos',
  'Trigo', 'Maíz', 'Soja', 'Picadura de pulga', 'Ácaros', 'Polen', 'Hierba',
  'Algún medicamento',
];

export const MEDICACION_FRECUENTE: readonly string[] = [
  'Antiinflamatorio', 'Analgésico', 'Antibiótico', 'Antiparasitario interno',
  'Antiparasitario externo', 'Corticoide', 'Antiepiléptico', 'Insulina',
  'Condroprotector', 'Suplemento vitamínico', 'Tratamiento cardíaco',
  'Tratamiento tiroideo', 'Colirio', 'Gotas óticas',
];
