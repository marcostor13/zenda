import { Injectable, Logger } from '@nestjs/common';
import {
  ResultadoAsistente, TIPO_LUGAR_LABELS, TipoLugar, VERTICAL_LABELS, VerticalKey, VerTodosAsistente,
} from 'shared';
import { CatalogService, ServicioCardDto } from '../catalog/catalog.service';
import { LugaresService } from '../lugares/lugares.service';
import { LugarDocument } from '../lugares/lugar.schema';
import { interpretarLocalmente, normalizar } from '../ai-search/interpretacion-local';
import { GrupoInventario, InventarioRepository } from './inventario.repository';

/** Tarjetas que caben en el chat sin convertirlo en un listado. */
const MAX_RESULTADOS = 4;

/** El inventario cambia poco: recontarlo en cada pregunta sería tirar consultas. */
const VIGENCIA_INVENTARIO_MS = 10 * 60_000;

/**
 * Palabras con las que alguien pide opciones y no una explicación. Sin ellas,
 * «¿cuánto cobráis a una peluquería?» acababa enseñando peluquerías.
 */
const PIDE_OPCIONES = /\b(busco|buscar|buscando|quiero|necesito|hay|existe|existen|recomienda|recomiendas|recomendais|opciones|donde|encuentra|encontrar|ensename|muestrame|dime|lista|algun|alguna|cerca)\b/;

/** Lo que el asistente encontró en la plataforma para una pregunta. */
export interface BusquedaPlataforma {
  /** Qué se buscó, en palabras: «Peluquería canina en Valencia». */
  descripcion: string;
  resultados: ResultadoAsistente[];
  verTodos: VerTodosAsistente;
}

/**
 * Lo que la plataforma sabe y el modelo no: el catálogo y los sitios de
 * Explora, con datos reales.
 *
 * Reutiliza el intérprete local del buscador con IA para sacar categoría y
 * población de la pregunta, y las mismas búsquedas públicas que la web
 * (`CatalogService.buscarServicios` y `LugaresService.buscar`), así que el chat
 * nunca enseña algo que el buscador escondería —un servicio de un comercio
 * suspendido o un sitio pendiente de moderación—.
 */
@Injectable()
export class BusquedaPlataformaService {
  private readonly logger = new Logger(BusquedaPlataformaService.name);
  private inventarioCache?: { texto: string; caduca: number };

  constructor(
    private readonly catalog: CatalogService,
    private readonly lugares: LugaresService,
    private readonly inventario: InventarioRepository,
  ) {}

  /** null = la pregunta no pide opciones de la plataforma. */
  async buscar(pregunta: string): Promise<BusquedaPlataforma | null> {
    const interpretacion = interpretarLocalmente(pregunta);
    const ciudad = interpretacion.ciudad ?? undefined;
    const pideOpciones = Boolean(ciudad) || PIDE_OPCIONES.test(normalizar(pregunta));

    if (interpretacion.vertical && pideOpciones) {
      return this.buscarServicios(interpretacion.vertical, ciudad);
    }
    if (interpretacion.tipoLugar) return this.buscarLugares(interpretacion.tipoLugar, ciudad);
    return null;
  }

  /** Resumen de lo publicado para el prompt; vacío si la base no contesta. */
  async inventarioComoTexto(): Promise<string> {
    const ahora = Date.now();
    if (this.inventarioCache && this.inventarioCache.caduca > ahora) return this.inventarioCache.texto;

    try {
      const [servicios, lugares] = await Promise.all([this.inventario.servicios(), this.inventario.lugares()]);
      const texto = this.redactarInventario(servicios, lugares);
      this.inventarioCache = { texto, caduca: ahora + VIGENCIA_INVENTARIO_MS };
      return texto;
    } catch (error) {
      this.logger.warn(`No se pudo contar el inventario: ${String(error)}`);
      return '';
    }
  }

  private async buscarServicios(vertical: VerticalKey, ciudad?: string): Promise<BusquedaPlataforma> {
    const base = { vertical, ciudad, limit: MAX_RESULTADOS, orden: 'relevancia' };
    // Primero lo que se puede reservar ya, como el buscador; si no hay nada, el
    // catálogo entero, para no contestar «no hay» con fichas publicadas.
    let pagina = await this.catalog.buscarServicios({ ...base, soloDisponibles: true });
    if (!pagina.items.length) pagina = await this.catalog.buscarServicios({ ...base, soloDisponibles: false });

    const etiqueta = VERTICAL_LABELS[vertical];
    return {
      descripcion: ciudad ? `${etiqueta} en ${ciudad}` : etiqueta,
      resultados: pagina.items.slice(0, MAX_RESULTADOS).map((card) => this.desdeServicio(card, vertical)),
      verTodos: {
        titulo: 'Ver todos los resultados',
        ruta: `/${vertical}`,
        ...(ciudad ? { queryParams: { ciudad } } : {}),
      },
    };
  }

  private async buscarLugares(tipo: TipoLugar, ciudad?: string): Promise<BusquedaPlataforma> {
    let lugares = await this.lugares.buscar({ tipo, ciudad, limit: MAX_RESULTADOS });
    // «Playas en Valencia» suele querer decir la provincia, no el municipio.
    if (!lugares.length && ciudad) lugares = await this.lugares.buscar({ tipo, provincia: ciudad, limit: MAX_RESULTADOS });

    const queryParams: Record<string, string> = { tipo };
    if (ciudad) queryParams['ciudad'] = ciudad;
    const etiqueta = TIPO_LUGAR_LABELS[tipo];
    return {
      descripcion: ciudad ? `${etiqueta} en ${ciudad}` : etiqueta,
      resultados: lugares.slice(0, MAX_RESULTADOS).map((lugar) => this.desdeLugar(lugar)),
      verTodos: { titulo: 'Ver todos en Explora', ruta: '/explora', queryParams },
    };
  }

  private desdeServicio(card: ServicioCardDto, vertical: VerticalKey): ResultadoAsistente {
    const categoria = card.vertical ?? vertical;
    return {
      tipo: 'servicio',
      id: card.id,
      titulo: card.nombre,
      ciudad: card.ciudad,
      categoria,
      ...(card.precioPorNoche > 0 ? { precioDesde: card.precioPorNoche } : {}),
      ...(card.numResenas > 0 ? { nota: card.score, numResenas: card.numResenas } : {}),
      ...(card.imagenes?.[0] ? { imagen: card.imagenes[0] } : {}),
      ruta: `/${categoria}/${card.slug || card.id}`,
    };
  }

  private desdeLugar(lugar: LugarDocument): ResultadoAsistente {
    const id = String(lugar._id);
    return {
      tipo: 'lugar',
      id,
      titulo: lugar.nombre,
      ciudad: lugar.ubicacion?.ciudad ?? '',
      categoria: lugar.tipo,
      ...(lugar.totalReviews > 0 ? { nota: lugar.ratingPromedio, numResenas: lugar.totalReviews } : {}),
      ...(lugar.fotos?.[0] ? { imagen: lugar.fotos[0] } : {}),
      ruta: `/explora/${lugar.slug || id}`,
    };
  }

  private redactarInventario(servicios: GrupoInventario[], lugares: GrupoInventario[]): string {
    const linea = (etiqueta: string, g: GrupoInventario) =>
      `- ${etiqueta}: ${g.total} publicados${g.zonas.length ? ` (sobre todo en ${g.zonas.join(', ')})` : ''}.`;

    const deServicios = servicios
      .filter((g) => g.clave in VERTICAL_LABELS)
      .map((g) => linea(VERTICAL_LABELS[g.clave as VerticalKey], g));
    const deLugares = lugares
      .filter((g) => g.clave in TIPO_LUGAR_LABELS)
      .map((g) => linea(TIPO_LUGAR_LABELS[g.clave as TipoLugar], g));

    return [
      '### Servicios reservables publicados ahora',
      ...(deServicios.length ? deServicios : ['- Ninguno publicado ahora mismo.']),
      '',
      '### Sitios de Explora publicados ahora (agrupados por provincia)',
      ...(deLugares.length ? deLugares : ['- Ninguno publicado ahora mismo.']),
    ].join('\n');
  }
}
