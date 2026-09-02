import type { RedSocialKey } from '../components/social-icon/rs-social-icon.component';

/**
 * Perfil social de la marca: el nombre que se lee, el logo que se pinta y la
 * URL a la que se va.
 */
export interface RedSocial {
  readonly nombre: string;
  readonly icono: RedSocialKey;
  readonly url: string;
}

/**
 * Perfiles sociales de Doogking. Única fuente de verdad.
 *
 * La portada y la pantalla de «próximamente» mantenían cada una su propia
 * lista, y habían dejado de coincidir: el Instagram de la portada apuntaba a
 * `doogkingcom` y el de «próximamente» a `doogking`, así que la misma marca
 * enseñaba dos perfiles distintos según la pantalla. Con una sola lista,
 * cambiar un perfil se hace en un sitio y llega a los dos.
 *
 * El orden es el de aparición en el pie.
 */
export const REDES_SOCIALES: readonly RedSocial[] = [
  { nombre: 'Instagram', icono: 'instagram', url: 'https://www.instagram.com/doogkingcom' },
  { nombre: 'Facebook', icono: 'facebook', url: 'https://facebook.com/doogking' },
  /*
   * La cuenta es `@doogking.com` —con el punto—, no `@doogking`: son dos
   * usuarios distintos en TikTok y el segundo no es de la marca.
   */
  { nombre: 'TikTok', icono: 'tiktok', url: 'https://www.tiktok.com/@doogking.com' },
  { nombre: 'LinkedIn', icono: 'linkedin', url: 'https://linkedin.com/company/doogking' },
  { nombre: 'YouTube', icono: 'youtube', url: 'https://youtube.com/@doogking' },
];

/**
 * Perfiles que se anuncian en la pantalla de «próximamente», donde el pie es
 * más corto y sólo caben los tres canales con contenido publicado.
 */
export const REDES_SOCIALES_DESTACADAS: readonly RedSocial[] = REDES_SOCIALES.filter(
  (red) => red.icono === 'instagram' || red.icono === 'facebook' || red.icono === 'tiktok',
);
