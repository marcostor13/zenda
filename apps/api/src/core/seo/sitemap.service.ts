import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { EstadoModeracion, VerticalKey } from 'shared';
import { Servicio, ServicioDocument } from '../catalog/servicio.schema';
import { Lugar, LugarDocument } from '../lugares/lugar.schema';

/** Una URL del sitemap. `lastmod` en ISO, como exige el protocolo. */
export interface EntradaSitemap {
  readonly ruta: string;
  readonly lastmod?: string;
  /** Pista de importancia relativa dentro del sitio, de 0.0 a 1.0. */
  readonly prioridad: number;
  readonly frecuencia: 'daily' | 'weekly' | 'monthly';
}

/**
 * Rutas fijas de la web. Se declaran aquí y no se deducen del router de Angular
 * a propósito: el sitemap es un contrato con Google y tiene que ser una lista
 * deliberada, no el reflejo automático de lo que haya en el enrutador —que
 * incluye paneles, pasos de reserva y pantallas de sesión que no deben salir—.
 *
 * Las rutas de categoría comparten prefijo con `verticales.config.ts` del
 * frontend; si se añade un vertical nuevo hay que añadirlo también aquí.
 */
const RUTAS_FIJAS: readonly EntradaSitemap[] = [
  { ruta: '/', prioridad: 1.0, frecuencia: 'daily' },
  { ruta: '/alojamiento', prioridad: 0.9, frecuencia: 'daily' },
  { ruta: '/veterinaria', prioridad: 0.9, frecuencia: 'daily' },
  { ruta: '/peluqueria', prioridad: 0.9, frecuencia: 'daily' },
  { ruta: '/transporte', prioridad: 0.9, frecuencia: 'daily' },
  { ruta: '/adiestramiento', prioridad: 0.9, frecuencia: 'daily' },
  { ruta: '/hoteles', prioridad: 0.9, frecuencia: 'daily' },
  { ruta: '/seguros', prioridad: 0.9, frecuencia: 'daily' },
  { ruta: '/funerarios', prioridad: 0.9, frecuencia: 'daily' },
  { ruta: '/explora', prioridad: 0.8, frecuencia: 'daily' },
  { ruta: '/para-comercios', prioridad: 0.7, frecuencia: 'monthly' },
  { ruta: '/ayuda', prioridad: 0.5, frecuencia: 'monthly' },
  { ruta: '/contacto', prioridad: 0.4, frecuencia: 'monthly' },
  { ruta: '/privacidad', prioridad: 0.2, frecuencia: 'monthly' },
  { ruta: '/terminos', prioridad: 0.2, frecuencia: 'monthly' },
  { ruta: '/cookies', prioridad: 0.2, frecuencia: 'monthly' },
  { ruta: '/condiciones', prioridad: 0.2, frecuencia: 'monthly' },
];

/** Ruta pública de cada vertical. Debe coincidir con `app.routes.ts` del front. */
const RUTA_DE_VERTICAL: Record<string, string> = {
  [VerticalKey.ALOJAMIENTO]: '/alojamiento',
  [VerticalKey.TRANSPORTE]: '/transporte',
  [VerticalKey.VETERINARIA]: '/veterinaria',
  [VerticalKey.PELUQUERIA]: '/peluqueria',
  [VerticalKey.ADIESTRAMIENTO]: '/adiestramiento',
  [VerticalKey.HOTELES]: '/hoteles',
  [VerticalKey.SEGUROS]: '/seguros',
  [VerticalKey.FUNERARIOS]: '/funerarios',
};

/**
 * Tope de URL por sitemap. El protocolo permite 50.000, pero por debajo de eso
 * Google procesa el fichero de una sentada y es más fácil de revisar a mano.
 */
const MAXIMO_URLS = 20_000;

/*
 * Lo que de verdad se lee de cada documento. Se declara a mano porque
 * `updatedAt` lo añade Mongoose con `timestamps: true` y no está en la clase del
 * schema, así que el tipo generado no lo conoce. Y `slug` es opcional a
 * propósito: mientras la migración no haya pasado por todas las fichas, hay
 * lugares que todavía no lo tienen.
 */
interface DocumentoServicio {
  readonly _id: unknown;
  readonly vertical?: unknown;
  readonly updatedAt?: Date;
}

interface DocumentoLugar {
  readonly _id: unknown;
  readonly slug?: string;
  readonly updatedAt?: Date;
}

/**
 * Genera el `sitemap.xml` a partir de lo que está realmente publicado.
 *
 * Vive en el API y no en el frontend porque es el único que sabe qué fichas
 * están publicadas y cuándo se tocaron por última vez. La web lo sirve bajo su
 * propio dominio (`server.ts` hace de puente): un sitemap alojado en otro
 * dominio sólo puede declarar URL de ese otro dominio, así que uno servido
 * desde el API no valdría para indexar doogking.com.
 */
@Injectable()
export class SitemapService {
  constructor(
    @InjectModel(Servicio.name) private readonly servicios: Model<ServicioDocument>,
    @InjectModel(Lugar.name) private readonly lugares: Model<LugarDocument>,
  ) {}

  /** Todas las URL públicas: rutas fijas, fichas de servicio y lugares. */
  async entradas(): Promise<EntradaSitemap[]> {
    const [deServicios, deLugares] = await Promise.all([
      this.entradasDeServicios(),
      this.entradasDeLugares(),
    ]);

    return [...RUTAS_FIJAS, ...deServicios, ...deLugares].slice(0, MAXIMO_URLS);
  }

  /** El XML listo para servir. */
  async xml(origen: string): Promise<string> {
    const entradas = await this.entradas();
    const base = origen.replace(/\/+$/, '');

    const urls = entradas.map((entrada) => [
      '  <url>',
      `    <loc>${escapar(`${base}${entrada.ruta}`)}</loc>`,
      entrada.lastmod ? `    <lastmod>${entrada.lastmod}</lastmod>` : '',
      `    <changefreq>${entrada.frecuencia}</changefreq>`,
      `    <priority>${entrada.prioridad.toFixed(1)}</priority>`,
      '  </url>',
    ].filter(Boolean).join('\n')).join('\n');

    return [
      '<?xml version="1.0" encoding="UTF-8"?>',
      '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
      urls,
      '</urlset>',
      '',
    ].join('\n');
  }

  /**
   * Sólo fichas publicadas **y** de comercios activos: `comercioActivo` es la
   * copia que el catálogo mantiene en cada servicio, y es la misma condición
   * que aplica el buscador. Sin ella, el sitemap ofrecería a Google fichas que
   * al abrirlas no aparecen.
   */
  private async entradasDeServicios(): Promise<EntradaSitemap[]> {
    const documentos = await this.servicios
      .find({ estado: 'publicado', comercioActivo: true })
      .select('_id vertical updatedAt')
      .sort({ updatedAt: -1 })
      .limit(MAXIMO_URLS)
      .lean<DocumentoServicio[]>();

    return documentos.flatMap((documento) => {
      const ruta = RUTA_DE_VERTICAL[String(documento.vertical)];
      if (!ruta) return [];

      return [{
        ruta: `${ruta}/${String(documento._id)}`,
        lastmod: fecha(documento.updatedAt),
        prioridad: 0.7,
        frecuencia: 'weekly' as const,
      }];
    });
  }

  /** Sólo lugares publicados tras la moderación: los pendientes no son públicos. */
  private async entradasDeLugares(): Promise<EntradaSitemap[]> {
    const documentos = await this.lugares
      .find({ estado: EstadoModeracion.PUBLICADO })
      .select('_id slug updatedAt')
      .sort({ updatedAt: -1 })
      .limit(MAXIMO_URLS)
      .lean<DocumentoLugar[]>();

    return documentos.map((documento) => ({
      // El slug si lo tiene; el id mientras la migración no haya pasado por él.
      ruta: `/explora/${documento.slug || String(documento._id)}`,
      lastmod: fecha(documento.updatedAt),
      prioridad: 0.6,
      frecuencia: 'monthly' as const,
    }));
  }
}

function fecha(valor: unknown): string | undefined {
  if (!(valor instanceof Date)) return undefined;
  return valor.toISOString();
}

/** `&` y `<` en una URL romperían el XML; el protocolo exige escaparlos. */
function escapar(texto: string): string {
  return texto
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}
