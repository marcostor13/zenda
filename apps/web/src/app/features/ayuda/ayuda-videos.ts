/**
 * Vídeos del centro de ayuda. Los genera `tools/videos-ayuda` (grabaciones
 * reales de la plataforma + locución) y se sirven desde el bucket público de
 * subidas: pesan unos 5 MB cada uno y no deben viajar en el bundle ni en git.
 * Para publicar una versión nueva se sube a otra carpeta (`v2`) y se cambia la
 * base, porque los ficheros llevan caché inmutable de un año.
 */
export const BASE_VIDEOS_AYUDA = 'https://aws-marcostorresalarcon-bucket.s3.us-east-2.amazonaws.com/uploads/ayuda/v1';

export type GrupoVideo = 'cliente' | 'comercio' | 'categoria';

export interface VideoAyuda {
  readonly slug: string;
  readonly titulo: string;
  readonly duracion: string;
  readonly grupo: GrupoVideo;
}

export const VIDEOS_AYUDA: readonly VideoAyuda[] = [
  { slug: '01-registrarte-en-doogking', titulo: 'Registrarte en Doogking', duracion: '0:56', grupo: 'cliente' },
  { slug: '02-crear-la-ficha-de-tu-mascota', titulo: 'Crear la ficha de tu mascota', duracion: '1:11', grupo: 'cliente' },
  { slug: '03-buscar-un-servicio', titulo: 'Buscar un servicio', duracion: '0:59', grupo: 'cliente' },
  { slug: '04-consultar-y-elegir-un-profesional', titulo: 'Consultar y elegir un profesional', duracion: '0:54', grupo: 'cliente' },
  { slug: '05-hacer-una-reserva', titulo: 'Hacer una reserva', duracion: '0:58', grupo: 'cliente' },
  { slug: '06-consultar-el-estado-de-una-reserva', titulo: 'Consultar el estado de una reserva', duracion: '0:52', grupo: 'cliente' },
  { slug: '07-registrar-tu-negocio', titulo: 'Registrar tu negocio', duracion: '1:00', grupo: 'comercio' },
  { slug: '08-completar-la-ficha-de-tu-negocio', titulo: 'Completar la ficha de tu negocio', duracion: '1:00', grupo: 'comercio' },
  { slug: '09-publicar-tu-primer-servicio', titulo: 'Publicar tu primer servicio', duracion: '1:00', grupo: 'comercio' },
  { slug: '10-recibir-y-gestionar-una-reserva', titulo: 'Recibir y gestionar una reserva', duracion: '0:55', grupo: 'comercio' },
  { slug: '11-peluqueria', titulo: 'Peluquería canina', duracion: '0:28', grupo: 'categoria' },
  { slug: '12-residencia-y-guarderia', titulo: 'Residencia y guardería', duracion: '0:27', grupo: 'categoria' },
  { slug: '13-adiestramiento', titulo: 'Adiestramiento canino', duracion: '0:23', grupo: 'categoria' },
  { slug: '14-transporte', titulo: 'Transporte de mascotas', duracion: '0:26', grupo: 'categoria' },
  { slug: '15-veterinaria', titulo: 'Veterinaria', duracion: '0:21', grupo: 'categoria' },
  { slug: '16-hoteles-pet-friendly', titulo: 'Hoteles pet-friendly', duracion: '0:18', grupo: 'categoria' },
  { slug: '17-seguros-para-mascotas', titulo: 'Seguros para mascotas', duracion: '0:24', grupo: 'categoria' },
  { slug: '18-explora', titulo: 'Explora con tu mascota', duracion: '0:26', grupo: 'categoria' },
];

export const urlVideo = (video: VideoAyuda): string => `${BASE_VIDEOS_AYUDA}/${video.slug}.mp4`;
export const urlPortada = (video: VideoAyuda): string => `${BASE_VIDEOS_AYUDA}/${video.slug}.jpg`;
