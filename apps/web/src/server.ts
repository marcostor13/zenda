import 'reflect-metadata';

// Va antes que Angular a propósito: deja la configuración del contenedor en
// `globalThis.__env` antes de que se cargue nada de la aplicación.
import './entorno-servidor';

import {
  AngularNodeAppEngine,
  createNodeRequestHandler,
  isMainModule,
  writeResponseToNodeResponse,
} from '@angular/ssr/node';
import express from 'express';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { environment } from './environments/environment';

const raizServidor = dirname(fileURLToPath(import.meta.url));
const raizNavegador = resolve(raizServidor, '../browser');

const app = express();

/*
 * Detrás del proxy de Coolify, Express ve la conexión interna: sin esto,
 * `peticion.protocol` dice «http» aunque el visitante haya entrado por HTTPS, y
 * el sitemap salía declarando `http://doogking.com/…`. Para Google `http` y
 * `https` son dos sitios distintos, así que un sitemap con el esquema
 * equivocado le está señalando páginas que no son las que quiere indexar.
 */
app.set('trust proxy', true);

/**
 * Dominios desde los que se acepta servir la web.
 *
 * Angular rechaza por defecto cualquier `Host` que no reconozca: es la defensa
 * contra el envenenamiento de cabecera, donde un atacante pide la página con un
 * `Host` suyo y consigue que los enlaces absolutos del HTML —el canonical, las
 * etiquetas `og:`— apunten a su dominio. Como aquí se generan justamente esas
 * etiquetas, la protección importa más que en una web sin SEO.
 *
 * Se declaran en `WEB_HOSTS_PERMITIDOS`, separados por comas. Los de local van
 * siempre para poder levantar el contenedor y probarlo sin configurar nada.
 */
const hostsPermitidos = [
  ...(process.env['WEB_HOSTS_PERMITIDOS'] ?? '')
    .split(',')
    .map((host) => host.trim())
    .filter(Boolean),
  'localhost',
  '127.0.0.1',
];

/*
 * Coolify pone Traefik por delante, así que el `Host` real del visitante llega
 * en `X-Forwarded-Host`. Sin confiar en esas cabeceras, todas las URL absolutas
 * saldrían con el nombre interno del contenedor. Es seguro porque el proxy las
 * reescribe siempre: nada de lo que mande el cliente llega intacto.
 */
const motorAngular = new AngularNodeAppEngine({
  allowedHosts: hostsPermitidos,
  trustProxyHeaders: true,
});

/*
 * Las cabeceras de caché replican lo que hacía `nginx.conf`, que este servidor
 * sustituye. El reparto no es caprichoso:
 *
 * - `env.js` lo reescribe el contenedor en cada arranque. Si se cacheara,
 *   cambiar una variable en Coolify no surtiría efecto hasta que caducase el
 *   navegador del visitante.
 * - Los bundles llevan el hash del contenido en el nombre (`outputHashing:
 *   all`), así que su URL cambia en cuanto cambia el contenido: se pueden
 *   guardar para siempre.
 * - Lo de `public/` (la marca, los iconos de categoría, el favicon) se copia
 *   con su nombre tal cual y su URL no cambia nunca. Con una caché larga,
 *   retocar el logotipo no lo veía nadie durante semanas.
 */
app.get('/env.js', (_peticion, respuesta, siguiente) => {
  respuesta.setHeader('Cache-Control', 'no-store');
  respuesta.sendFile(join(raizNavegador, 'env.js'), (error) => {
    if (error) siguiente();
  });
});

/**
 * `/sitemap.xml` lo genera el API, que es quien sabe qué servicios y qué lugares
 * están publicados. Se sirve desde el dominio de la web a propósito: un sitemap
 * alojado en otro dominio sólo puede declarar URLs de ese otro dominio, así que
 * uno servido desde el API no valdría para indexar doogking.com.
 */
app.get('/sitemap.xml', async (peticion, respuesta, siguiente) => {
  try {
    // El origen se le pasa al API: es lo único que el API no puede saber, y sin
    // él el sitemap declararía URL del dominio equivocado, que para Google
    // equivale a no tener sitemap.
    const origen = `${peticion.protocol}://${peticion.get('host') ?? ''}`;
    const destino = `${environment.apiUrl}/seo/sitemap.xml?origen=${encodeURIComponent(origen)}`;
    const respuestaApi = await fetch(destino, { headers: { accept: 'application/xml' } });

    if (!respuestaApi.ok) return siguiente();

    respuesta.setHeader('Content-Type', 'application/xml; charset=utf-8');
    respuesta.setHeader('Cache-Control', 'public, max-age=3600');
    respuesta.send(await respuestaApi.text());
  } catch {
    // Si el API no responde, mejor un 404 del sitemap que una web caída.
    siguiente();
  }
});

app.use(
  express.static(raizNavegador, {
    maxAge: '1y',
    index: false,
    redirect: false,
    setHeaders: (respuesta, ruta) => {
      if (/\.(svg|png|jpe?g|gif|ico|webp|avif)$/i.test(ruta)) {
        respuesta.setHeader('Cache-Control', 'public, no-cache');
      } else if (/\/media\/|-[A-Z0-9]{8}\./i.test(ruta)) {
        respuesta.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
      }
    },
  }),
);

/**
 * Todo lo demás lo renderiza Angular.
 *
 * Si el motor devuelve `null` la ruta no existe para Angular tampoco, así que se
 * responde un 404 de verdad en vez del `index.html` con estado 200 que servía
 * nginx: era justo el hallazgo SEO-3 de la auditoría.
 */
app.use((peticion, respuesta, siguiente) => {
  motorAngular
    .handle(peticion, { peticionOriginal: peticion.originalUrl })
    .then((respuestaAngular) =>
      respuestaAngular ? writeResponseToNodeResponse(respuestaAngular, respuesta) : siguiente(),
    )
    .catch(siguiente);
});

if (isMainModule(import.meta.url)) {
  const puerto = Number(process.env['PORT'] ?? 4000);
  app.listen(puerto, () => {
    console.log(`Doogking web (SSR) escuchando en http://localhost:${puerto}`);
    /*
     * Se escribe al arrancar porque el síntoma de tenerlo mal es silencioso y
     * desconcierta: Angular no falla, responde 200 con el HTML de arranque y la
     * web «funciona», sólo que sin renderizar en servidor —sin título propio,
     * sin etiquetas sociales y sin 404 real—, que es justo lo que se quería
     * arreglar. Con esta línea en el log se ve en dos segundos.
     */
    console.log(`Hosts permitidos: ${hostsPermitidos.join(', ')}`);
    if (!process.env['WEB_HOSTS_PERMITIDOS']) {
      console.warn(
        'AVISO: falta WEB_HOSTS_PERMITIDOS. Sin el dominio público en esa variable, '
        + 'Angular rechaza el Host y sirve la web sin renderizar en el servidor.',
      );
    }
  });
}

/** Lo usa el motor de Angular cuando el servidor lo arranca otro proceso. */
export const reqHandler = createNodeRequestHandler(app);
