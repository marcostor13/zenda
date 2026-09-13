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
import { createHash } from 'node:crypto';
import { readdirSync } from 'node:fs';
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
 * - Todo lo demás —`public/` (la marca, los iconos de categoría, el favicon) y
 *   el HTML renderizado— se sirve con su nombre o su ruta tal cual, así que la
 *   URL no cambia nunca aunque cambie el contenido. Va con `no-cache`: el
 *   navegador puede guardarlo, pero tiene que preguntar antes de reusarlo.
 *
 * `no-cache` no es `no-store`: la copia se conserva y la revalidación se
 * resuelve con un 304 de unos pocos bytes cuando nada ha cambiado. Cuesta un
 * viaje de ida y vuelta, no una descarga.
 */

/** Ficheros cuyo nombre incluye el hash del contenido (`main-5KJ2X9QA.js`). */
const RUTA_INMUTABLE = /(?:-[A-Z0-9]{8}\.[a-z0-9]+|\/media\/)/;

/**
 * Identifica el build que está sirviendo este contenedor.
 *
 * Sale de los nombres de los bundles, que llevan el hash del contenido: si
 * cambia una línea de la aplicación, cambia el nombre del fichero y cambia
 * esto. El navegador lo consulta en `/version.json` para enterarse de que hay
 * un despliegue nuevo sin tener que recargar a ciegas (ver `VersionService`).
 */
function calcularVersionBuild(): string {
  try {
    const ficheros = readdirSync(raizNavegador)
      .filter((nombre) => /\.(js|css)$/.test(nombre))
      .sort();
    return createHash('sha1').update(ficheros.join('|')).digest('hex').slice(0, 12);
  } catch {
    // Sin carpeta de navegador la web no arranca igualmente; no vale la pena
    // tumbar el proceso por el identificador de versión.
    return 'desconocida';
  }
}

const versionBuild = calcularVersionBuild();

/**
 * Versión del build en marcha. La pide el navegador cada pocos minutos para
 * saber si la pestaña que tiene abierta se quedó en un despliegue anterior.
 *
 * En móvil es lo que arregla el caso de "a mí no me salen los cambios": la
 * pestaña o la app llevan días abiertas, el HTML se cargó una vez y nada obliga
 * a volver a pedirlo.
 */
app.get('/version.json', (_peticion, respuesta) => {
  respuesta.setHeader('Cache-Control', 'no-store');
  respuesta.json({ version: versionBuild });
});

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

/**
 * Extensiones de lo que produce el build o vive en `public/`. Lo que acaba así y
 * no está en disco no existe: no hay ninguna ruta de Angular con ese nombre.
 */
const EXTENSION_DE_ESTATICO =
  /\.(?:js|mjs|css|map|json|webmanifest|txt|xml|ico|png|jpe?g|gif|webp|avif|svg|woff2?|ttf|eot|mp4|webm)$/i;

/**
 * Marca del build en el HTML que se entrega.
 *
 * Es lo que permite al navegador saber si la página que tiene delante es del
 * despliegue en marcha o de uno anterior: el HTML guardado en una pestaña vieja
 * lleva la marca vieja, y comparar esa marca con `/version.json` delata la
 * situación en la primera comprobación. Sin ella sólo se detectaban los
 * despliegues ocurridos con la pestaña ya abierta, que es el caso menos común.
 */
const MARCA_BUILD = `<meta name="dk-build" content="${versionBuild}">`;

/** El mismo HTML con la marca del build metida en la cabecera. */
async function conMarcaDeBuild(original: Response): Promise<Response> {
  const html = (await original.text()).replace('</head>', `${MARCA_BUILD}</head>`);
  const cabeceras = new Headers(original.headers);
  // El cuerpo ha cambiado de tamaño: una longitud declarada de antes corta el
  // HTML por donde no es y el navegador se queda con media página.
  cabeceras.delete('content-length');

  return new Response(html, {
    status: original.status,
    statusText: original.statusText,
    headers: cabeceras,
  });
}

app.use(
  express.static(raizNavegador, {
    index: false,
    redirect: false,
    setHeaders: (respuesta, ruta) => {
      // Por defecto `no-cache`: sólo se guarda para siempre lo que lleva el
      // hash del contenido en el nombre. Al revés —cachear largo por defecto y
      // exceptuar— cada fichero nuevo sin hash nace con el fallo puesto.
      respuesta.setHeader(
        'Cache-Control',
        RUTA_INMUTABLE.test(ruta)
          ? 'public, max-age=31536000, immutable'
          : 'public, no-cache',
      );
    },
  }),
);

/**
 * Todo lo demás lo renderiza Angular.
 *
 * Si el motor devuelve `null` la ruta no existe para Angular tampoco, así que se
 * responde un 404 de verdad en vez del `index.html` con estado 200 que servía
 * nginx: era justo el hallazgo SEO-3 de la auditoría.
 *
 * El HTML sale con `no-cache` y es la cabecera más importante de este fichero.
 * Sin ella el documento no declara nada sobre su caducidad, y entonces el
 * navegador se inventa una: la regla heurística del estándar HTTP le permite
 * dar por fresca una respuesta sin `Cache-Control` durante un buen rato. En
 * escritorio casi no se nota; en móvil, donde la pestaña vive días y nadie
 * recarga a mano, el visitante se queda con el HTML antiguo —y por tanto con
 * los `<script>` del despliegue anterior, que siguen existiendo porque llevan
 * hash— y jura que los cambios no están. De ahí que "a algunos sí y a otros
 * no": depende de qué tuviera cada uno guardado.
 */
app.use((peticion, respuesta, siguiente) => {
  /*
   * Un fichero del build que no está en disco se responde 404 y se acaba ahí.
   *
   * Es el fallo que dejaba la pantalla en blanco al buscar desde el móvil. Cada
   * despliegue construye una imagen nueva, así que los bundles del despliegue
   * anterior **dejan de existir** en el contenedor (no como en un servidor que
   * acumula ficheros). Una pestaña con el HTML viejo guardado pide un chunk con
   * el nombre viejo, y aquí caía en el render de Angular: el navegador recibía
   * la página de "no encontrado" —HTML— donde esperaba un módulo JavaScript,
   * fallaba al interpretarlo y la navegación moría sin pintar nada.
   *
   * Con un 404 limpio el fallo es reconocible, y `RecuperacionChunkService` lo
   * convierte en una recarga que trae el despliegue actual.
   */
  if (EXTENSION_DE_ESTATICO.test(peticion.path)) {
    respuesta.setHeader('Cache-Control', 'no-store');
    respuesta.status(404).type('text/plain').send('No encontrado');
    return;
  }

  respuesta.setHeader('Cache-Control', 'no-cache, must-revalidate');

  motorAngular
    .handle(peticion, { peticionOriginal: peticion.originalUrl })
    .then(async (respuestaAngular) => {
      if (!respuestaAngular) return siguiente();

      /*
       * El HTML no es el mismo para todo el mundo: la cookie de acceso
       * anticipado decide si se renderiza la página o la pantalla de "muy
       * pronto". Sin `Vary`, una caché compartida por delante (Cloudflare, un
       * proxy corporativo) podría servirle a un visitante la copia de otro.
       *
       * Se añade a la respuesta de Angular y no con `respuesta.setHeader`
       * porque las cabeceras del motor se escriben después y se llevarían por
       * delante la que pusiéramos aquí: el motor ya manda su propio `Vary`.
       */
      respuestaAngular.headers.append('Vary', 'Cookie');

      const tipo = respuestaAngular.headers.get('content-type') ?? '';
      const final = tipo.includes('text/html')
        ? await conMarcaDeBuild(respuestaAngular)
        : respuestaAngular;

      return writeResponseToNodeResponse(final, respuesta);
    })
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
