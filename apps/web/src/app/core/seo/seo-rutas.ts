import { DestroyRef, Injectable, inject } from '@angular/core';
import { NavigationEnd, Router } from '@angular/router';
import { filter } from 'rxjs';
import { describir, seoPrivada, titular } from './plantillas-seo';
import { esRutaPrivada } from './rutas-servidor';
import { MetadatosSeo, SeoService } from './seo.service';

/**
 * Título y descripción de las páginas que no traen datos propios: legales,
 * ayuda, contacto, la landing de comercios y el buscador de transporte.
 *
 * Antes heredaban lo que hubiera dejado la página anterior —o, al entrar
 * directamente, el título genérico de `index.html`—, así que en Google salían
 * varias páginas con el mismo título. Las que cargan datos (fichas, categorías,
 * Explora, portada) declaran el suyo en el componente y no figuran aquí.
 */
const PAGINAS_FIJAS: Readonly<Record<string, { titulo: string; descripcion: string }>> = {
  '/ayuda': {
    titulo: 'Centro de ayuda',
    descripcion: 'Respuestas sobre reservas, pagos, cancelaciones y cuentas de comercio en Doogking, '
      + 'el marketplace de servicios para perros.',
  },
  '/contacto': {
    titulo: 'Contacto',
    descripcion: 'Escríbenos para cualquier duda sobre Doogking: reservas, comercios adheridos, '
      + 'privacidad o prensa. Te respondemos lo antes posible.',
  },
  '/para-comercios': {
    titulo: 'Doogking para comercios: consigue más clientes',
    descripcion: 'Publica tu residencia canina, clínica, peluquería o servicio para perros en Doogking '
      + 'y recibe reservas con pago online. Alta sin permanencia.',
  },
  '/transporte': {
    titulo: 'Transporte de mascotas con precio cerrado',
    descripcion: 'Calcula el precio del traslado de tu perro, compara empresas de transporte de animales '
      + 'verificadas y reserva online con precio cerrado.',
  },
  '/privacidad': {
    titulo: 'Política de privacidad',
    descripcion: 'Cómo trata Doogking tus datos personales, con qué finalidad, durante cuánto tiempo '
      + 'y cómo ejercer tus derechos de acceso, rectificación y supresión.',
  },
  '/terminos': {
    titulo: 'Términos y condiciones de uso',
    descripcion: 'Condiciones de uso de Doogking para clientes: reservas, pagos, cancelaciones, '
      + 'responsabilidades y resolución de incidencias.',
  },
  '/cookies': {
    titulo: 'Política de cookies',
    descripcion: 'Qué cookies y tecnologías similares usa Doogking, para qué sirven y cómo aceptar, '
      + 'rechazar o configurar tu consentimiento.',
  },
  '/condiciones': {
    titulo: 'Condiciones para comercios',
    descripcion: 'Condiciones que acepta un comercio al publicar sus servicios en Doogking: comisiones, '
      + 'pagos, liquidaciones y obligaciones de las partes.',
  },
  '/eliminar-datos': {
    titulo: 'Eliminar tus datos',
    descripcion: 'Cómo solicitar la eliminación de tu cuenta de Doogking y de los datos personales '
      + 'asociados, también si entraste con Google o Facebook.',
  },
};

/**
 * Título de pestaña de las zonas privadas. No buscan posicionar: sólo evitan
 * que la pestaña siga diciendo el nombre de la ficha que se vio antes.
 */
const TITULOS_PRIVADOS: readonly (readonly [RegExp, string])[] = [
  [/^\/admin/, 'Administración'],
  [/^\/comercio/, 'Panel de comercio'],
  [/^\/perfil/, 'Mi cuenta'],
  [/^\/perros/, 'Mis mascotas'],
  [/^\/reservas/, 'Mis reservas'],
  [/^\/favoritos/, 'Mis favoritos'],
  [/^\/presupuestos/, 'Mis presupuestos'],
  [/^\/auth/, 'Acceso'],
  [/^\/transporte\/viaje/, 'Tu viaje'],
  [/^\/valorar/, 'Valora tu experiencia'],
  [/^\/proximamente/, 'Muy pronto'],
  [/^\/buscador/, 'Buscador'],
  [/^\/carrito/, 'Tu carrito'],
];

/**
 * Metadatos que corresponden a una ruta por sí sola, o `null` si los pone el
 * componente de la página.
 */
export function seoDeRuta(url: string): MetadatosSeo | null {
  const ruta = (url.split(/[?#]/)[0] || '/').replace(/\/+$/, '') || '/';

  const fija = PAGINAS_FIJAS[ruta];
  if (fija) {
    return { titulo: titular(fija.titulo), descripcion: describir(fija.descripcion), canonica: ruta };
  }

  if (esRutaPrivada(ruta)) {
    const titulo = TITULOS_PRIVADOS.find(([patron]) => patron.test(ruta))?.[1] ?? 'Tu espacio';
    return seoPrivada(titulo);
  }

  return null;
}

/**
 * Aplica {@link seoDeRuta} en cada navegación, también en el render de
 * servidor. Las páginas con datos propios lo sobrescriben después, al cargar.
 */
@Injectable({ providedIn: 'root' })
export class SeoRutasService {
  private readonly router = inject(Router);
  private readonly seo = inject(SeoService);

  constructor() {
    const suscripcion = this.router.events
      .pipe(filter((evento): evento is NavigationEnd => evento instanceof NavigationEnd))
      .subscribe((evento) => {
        const metadatos = seoDeRuta(evento.urlAfterRedirects);
        if (metadatos) this.seo.aplicar(metadatos);
      });
    inject(DestroyRef).onDestroy(() => suscripcion.unsubscribe());
  }
}
