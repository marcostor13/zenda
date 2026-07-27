/**
 * Catálogo local de poblaciones y provincias españolas.
 *
 * Existe para que el selector de ciudad **funcione siempre**: Google Places es
 * un extra que afina la búsqueda y aporta coordenadas, pero si no hay clave
 * configurada —o el proxy falla— el usuario debe seguir viendo una lista real
 * en lugar de un campo de texto vacío.
 *
 * No pretende ser el callejero completo (España tiene más de 8.000 municipios):
 * son las capitales de provincia y los municipios de mayor población, que
 * cubren la inmensa mayoría de las búsquedas. Lo que no esté se puede escribir.
 */

export const PROVINCIAS_ES: readonly string[] = [
  'A Coruña', 'Álava', 'Albacete', 'Alicante', 'Almería', 'Asturias', 'Ávila',
  'Badajoz', 'Baleares', 'Barcelona', 'Burgos', 'Cáceres', 'Cádiz', 'Cantabria',
  'Castellón', 'Ceuta', 'Ciudad Real', 'Córdoba', 'Cuenca', 'Girona', 'Granada',
  'Guadalajara', 'Gipuzkoa', 'Huelva', 'Huesca', 'Jaén', 'La Rioja', 'Las Palmas',
  'León', 'Lleida', 'Lugo', 'Madrid', 'Málaga', 'Melilla', 'Murcia', 'Navarra',
  'Ourense', 'Palencia', 'Pontevedra', 'Salamanca', 'Santa Cruz de Tenerife',
  'Segovia', 'Sevilla', 'Soria', 'Tarragona', 'Teruel', 'Toledo', 'Valencia',
  'Valladolid', 'Bizkaia', 'Zamora', 'Zaragoza',
];

export const CIUDADES_ES: readonly string[] = [
  // Capitales de provincia y grandes ciudades
  'Madrid', 'Barcelona', 'Valencia', 'Sevilla', 'Zaragoza', 'Málaga', 'Murcia',
  'Palma de Mallorca', 'Las Palmas de Gran Canaria', 'Bilbao', 'Alicante',
  'Córdoba', 'Valladolid', 'Vigo', 'Gijón', 'Vitoria-Gasteiz', 'A Coruña',
  'Granada', 'Elche', 'Oviedo', 'Badalona', 'Cartagena', 'Terrassa', 'Jerez de la Frontera',
  'Sabadell', 'Santa Cruz de Tenerife', 'Móstoles', 'Alcalá de Henares', 'Pamplona',
  'Fuenlabrada', 'Almería', 'Leganés', 'San Sebastián', 'Santander', 'Castellón de la Plana',
  'Burgos', 'Albacete', 'Getafe', 'Alcorcón', 'Logroño', 'Salamanca', 'Huelva',
  'Marbella', 'Lleida', 'Tarragona', 'León', 'Cádiz', 'Jaén', 'Ourense', 'Girona',
  'Lugo', 'Cáceres', 'Melilla', 'Ceuta', 'Guadalajara', 'Toledo', 'Pontevedra',
  'Palencia', 'Ciudad Real', 'Zamora', 'Ávila', 'Cuenca', 'Huesca', 'Segovia',
  'Soria', 'Teruel', 'Badajoz', 'Mérida',

  // Área metropolitana de Madrid
  'Alcobendas', 'Torrejón de Ardoz', 'Parla', 'Las Rozas de Madrid', 'San Sebastián de los Reyes',
  'Pozuelo de Alarcón', 'Coslada', 'Rivas-Vaciamadrid', 'Valdemoro', 'Majadahonda',
  'Collado Villalba', 'Aranjuez', 'Arganda del Rey', 'Boadilla del Monte', 'Pinto',
  'Colmenar Viejo', 'Tres Cantos', 'San Fernando de Henares', 'Galapagar', 'Villaviciosa de Odón',

  // Cataluña
  'Hospitalet de Llobregat', 'Mataró', 'Santa Coloma de Gramenet', 'Reus', 'Sant Cugat del Vallès',
  'Cornellà de Llobregat', 'Sant Boi de Llobregat', 'Manresa', 'Rubí', 'Vilanova i la Geltrú',
  'Viladecans', 'Castelldefels', 'Granollers', 'Cerdanyola del Vallès', 'Mollet del Vallès',
  'Figueres', 'Blanes', 'Lloret de Mar', 'Salou', 'Sitges', 'Vic', 'Igualada',

  // Comunidad Valenciana y Murcia
  'Torrevieja', 'Orihuela', 'Torrent', 'Gandía', 'Benidorm', 'Paterna', 'Sagunto',
  'Alcoy', 'Elda', 'San Vicente del Raspeig', 'Denia', 'Villarreal', 'Alzira',
  'Lorca', 'Molina de Segura', 'Alcantarilla', 'Águilas', 'San Javier', 'Yecla',

  // Andalucía
  'Dos Hermanas', 'Algeciras', 'Mijas', 'Fuengirola', 'Vélez-Málaga', 'Estepona',
  'Torremolinos', 'Benalmádena', 'Roquetas de Mar', 'El Ejido', 'Chiclana de la Frontera',
  'San Fernando', 'El Puerto de Santa María', 'Sanlúcar de Barrameda', 'Utrera',
  'Alcalá de Guadaíra', 'Motril', 'Linares', 'Écija', 'Antequera', 'Ronda', 'Úbeda',
  'Puerto Real', 'La Línea de la Concepción', 'Rincón de la Victoria', 'Nerja',

  // Norte y resto
  'Baracaldo', 'Getxo', 'Irún', 'Portugalete', 'Santurtzi', 'Basauri', 'Errenteria',
  'Torrelavega', 'Avilés', 'Siero', 'Langreo', 'Mieres', 'Ponferrada', 'Miranda de Ebro',
  'Aranda de Duero', 'Santiago de Compostela', 'Ferrol', 'Narón', 'Vilagarcía de Arousa',
  'Sanxenxo', 'Tudela', 'Calahorra', 'Barbastro', 'Jaca', 'Benavente', 'Medina del Campo',
  'Talavera de la Reina', 'Puertollano', 'Tomelloso', 'Alcázar de San Juan', 'Valdepeñas',
  'Plasencia', 'Don Benito', 'Almendralejo', 'Villanueva de la Serena',

  // Islas
  'Ibiza', 'Santa Eulalia del Río', 'Calvià', 'Manacor', 'Inca', 'Mahón', 'Ciudadela',
  'Telde', 'Arrecife', 'Puerto del Rosario', 'San Bartolomé de Tirajana', 'Arona',
  'Adeje', 'La Laguna', 'Los Cristianos', 'Puerto de la Cruz', 'Santa Lucía de Tirajana',
];
