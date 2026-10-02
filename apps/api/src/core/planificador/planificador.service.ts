import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { FilterQuery, Model } from 'mongoose';
import { ConfigService } from '@nestjs/config';
import {
  AlojamientoViaje, DesplazamientoViaje, DestinoViaje, EstadoModeracion, RitmoViaje, TipoLugar,
  VERTICAL_ALOJAMIENTO_VIAJE, claveDiaEnZona, claveUbicacion, errorFechasViaje, nochesDelViaje,
  regexSinTildes, resolverDestinoViaje,
} from 'shared';
import { Servicio, ServicioDocument } from '../catalog/servicio.schema';
import { Lugar, LugarDocument } from '../lugares/lugar.schema';
import { PerrosService } from '../perros/perros.service';
import { CentrosPoblacionService } from '../geo/centros-poblacion.service';
import { DomainException } from '../../shared/exceptions/domain.exception';
import {
  LugarContexto, OpcionItinerario, ParadaItinerario, PreferenciasViaje, ServicioContexto, alojamientoDe,
  armarDias, asegurarAlojamiento, conEstimacion, diasDelViaje, garantizarServicio, necesitaAlojamiento,
  paradaDeLugar, paradaDeServicio, serviciosDelContexto, serviciosSugeridos, verticalesBuscadas,
  verticalesExcluidas,
} from './armar-itinerario';

export type { DiaItinerario, OpcionItinerario, ParadaItinerario } from './armar-itinerario';

export interface PeticionItinerario {
  /**
   * Destino tal como lo escribe el usuario: una provincia o cualquier
   * población («Dénia», «Gandía (Valencia)»). Antes sólo se podía elegir una
   * provincia de una lista cerrada (bloqueo del cliente, octubre).
   */
  destino?: string;
  /** Compatibilidad: provincia elegida en una tarjeta de destino. */
  provincia?: string;
  /** Compatibilidad: población concreta dentro de la provincia. */
  municipio?: string;
  /** Obligatorias: sin fechas no hay noches ni coste que estimar. */
  desde?: string;
  hasta?: string;
  perroId?: string;
  presupuestoMax?: number;
  /** Tipos de sitio que interesan (`TipoLugar`): playa, ruta, restaurante… */
  intereses?: string[];
  ritmo?: RitmoViaje;
  alojamiento?: AlojamientoViaje;
  desplazamiento?: DesplazamientoViaje;
  /** Verticales que se querrán reservar durante el viaje (peluquería, veterinaria…). */
  serviciosExtra?: string[];
}

export interface RespuestaItinerario {
  /** Provincia del destino, o el destino si no se conoce su provincia. */
  provincia: string;
  /** Cómo se enseña el destino: «Dénia (Alicante)». */
  destino: string;
  /** Noches reales del viaje según sus fechas. */
  noches: number;
  opciones: OpcionItinerario[];
  /**
   * Lo reservable del plan, sin repetir: cierra la pantalla con «Reserva tu
   * viaje». Nunca vacío si la zona tiene servicios.
   */
  serviciosSugeridos: ParadaItinerario[];
  /** true cuando el itinerario se armó sin IA, solo con datos propios. */
  esFallback: boolean;
  aviso?: string;
  /**
   * Si hacía falta dónde dormir y no hay hoteles pet friendly en la zona. No
   * se rellena con residencias caninas: son para dejar al perro, no para
   * dormir con él.
   */
  avisoAlojamiento?: string;
}

/** Provincia con contenido para planificar: lo que ofrece la pantalla de inicio. */
export interface DestinoPlanificador {
  provincia: string;
  lugares: number;
  servicios: number;
}

const API_URL = 'https://api.deepseek.com/chat/completions';
const TTL_CACHE_MS = 7 * 24 * 60 * 60 * 1000;
const TTL_DESTINOS_MS = 60 * 60 * 1000;
const MAX_POR_USUARIO_DIA = 10;
const MAX_LUGARES_CONTEXTO = 25;
const MAX_SERVICIOS_CONTEXTO = 25;
/** Radio para buscar servicios cerca cuando la provincia no tiene ninguno. */
const RADIO_SERVICIOS_CERCANOS_M = 80_000;

const TIPOS_LUGAR = new Set<string>(Object.values(TipoLugar));

interface EntradaCache {
  valor: RespuestaItinerario;
  expiraEn: number;
}

/** Todo lo que el modelo necesita para redactar el plan. */
interface ContextoIA {
  peticion: PeticionItinerario;
  destino: DestinoViaje;
  preferencias: PreferenciasViaje;
  lugares: LugarDocument[];
  servicios: ServicioDocument[];
  perfilPerro: string;
}

/** Los documentos `lean` tienen la forma que el armado de itinerarios espera. */
const comoLugares = (lugares: LugarDocument[]): LugarContexto[] => lugares as unknown as LugarContexto[];
const comoServicios = (servicios: ServicioDocument[]): ServicioContexto[] =>
  servicios as unknown as ServicioContexto[];

/**
 * Planificador de viajes con mascota (DK-C06 / O2).
 *
 * Decisiones tomadas al no haber criterio cerrado del cliente, documentadas en
 * §6.0 del plan unificado:
 *
 * 1. **Proveedor**: se reutiliza el de `core/ai-search` (DeepSeek). No añade
 *    ninguna dependencia ni clave nueva.
 * 2. **Fuente de datos**: **solo datos propios** — lugares moderados y
 *    servicios publicados de la provincia. El modelo redacta y ordena, no
 *    inventa sitios: así el itinerario no puede recomendar algo que no existe
 *    ni que no se pueda reservar aquí.
 * 3. **Personalización**: provincia y municipio, fechas, presupuesto,
 *    intereses, ritmo, alojamiento, desplazamiento y servicios que se
 *    necesitarán, más el perfil del perro si se indica (observación 28-09).
 * 5. **Siempre acaba en un servicio**: toda opción lleva al menos una parada
 *    reservable, y la respuesta cierra con `serviciosSugeridos`.
 * 4. **Coste**: caché de 7 días por (provincia, mes, perfil) y tope diario por
 *    usuario. Sin clave configurada **degrada a un itinerario armado con los
 *    datos propios**, no a un error.
 */
@Injectable()
export class PlanificadorService {
  private readonly logger = new Logger(PlanificadorService.name);
  private readonly apiKey?: string;

  private readonly cache = new Map<string, EntradaCache>();
  private readonly usosPorUsuario = new Map<string, { dia: string; n: number }>();
  private destinosCache?: { valor: DestinoPlanificador[]; expiraEn: number };

  constructor(
    @InjectModel(Servicio.name) private readonly servicioModel: Model<ServicioDocument>,
    @InjectModel(Lugar.name) private readonly lugarModel: Model<LugarDocument>,
    private readonly perrosService: PerrosService,
    private readonly centrosPoblacion: CentrosPoblacionService,
    config: ConfigService,
  ) {
    this.apiKey = config.get<string>('DEEPSEEK_API_KEY');
  }

  async generar(peticion: PeticionItinerario, usuarioId?: string): Promise<RespuestaItinerario> {
    const destino = this.destinoDe(peticion);
    const errorFechas = errorFechasViaje(peticion.desde, peticion.hasta);
    if (errorFechas) throw new DomainException(errorFechas, 400);

    const clave = this.clave(peticion, destino);
    const cacheado = this.leerCache(clave);
    if (cacheado) return cacheado;

    this.comprobarCupo(usuarioId);

    const preferencias = this.preferenciasDe(peticion);
    const [lugares, servicios] = await Promise.all([
      this.lugaresDe(destino, peticion.intereses),
      this.serviciosDe(destino, peticion, preferencias),
    ]);

    if (!lugares.length && !servicios.length) {
      throw new DomainException(
        `Todavía no tenemos suficiente contenido en ${destino.etiqueta} para armar un viaje.`,
        404,
      );
    }

    const perfilPerro = await this.perfilPerro(peticion.perroId, usuarioId);
    const contexto: ContextoIA = { peticion, destino, preferencias, lugares, servicios, perfilPerro };
    const respuesta = await this.generarConIA(contexto) ?? this.generarSinIA(contexto);

    this.escribirCache(clave, respuesta);
    return respuesta;
  }

  /**
   * Destino de la petición: lo escrito en `destino` y, por compatibilidad, la
   * provincia de una tarjeta con su municipio opcional.
   */
  private destinoDe(peticion: PeticionItinerario): DestinoViaje {
    const municipio = peticion.municipio?.trim();
    const provincia = peticion.provincia?.trim();
    const texto = peticion.destino?.trim()
      || (municipio && provincia ? `${municipio} (${provincia})` : municipio || provincia || '');
    const destino = resolverDestinoViaje(texto);
    if (!destino) throw new DomainException('Indica a dónde quieres viajar', 400);
    return destino;
  }

  // ── Destinos ──

  /**
   * Provincias con algo publicado, para la pantalla de inicio del planificador.
   *
   * Antes eran seis fijas (Madrid, Barcelona, Cádiz…) y sólo Valencia tenía
   * contenido, mientras Alicante y Castellón —con todo el censo de Explora— no
   * salían. Se calcula con los datos y se guarda una hora: cambia poco.
   */
  async destinos(): Promise<DestinoPlanificador[]> {
    if (this.destinosCache && this.destinosCache.expiraEn > Date.now()) return this.destinosCache.valor;

    const [lugares, servicios] = await Promise.all([
      this.contarPorProvincia(this.lugarModel as unknown as Model<unknown>, { estado: EstadoModeracion.PUBLICADO }),
      this.contarPorProvincia(this.servicioModel as unknown as Model<unknown>, { estado: 'publicado', comercioActivo: true }),
    ]);
    const valor = this.unirDestinos(lugares, servicios);
    this.destinosCache = { valor, expiraEn: Date.now() + TTL_DESTINOS_MS };
    return valor;
  }

  private async contarPorProvincia(
    modelo: Model<unknown>, filtro: Record<string, unknown>,
  ): Promise<Map<string, [string, number]>> {
    const grupos = await modelo.aggregate<{ _id: string; n: number }>([
      { $match: { ...filtro, 'ubicacion.provincia': { $nin: [null, ''] } } },
      { $group: { _id: '$ubicacion.provincia', n: { $sum: 1 } } },
    ]).exec();
    // Por clave y no por texto: «Castellón» y «castellon» son la misma provincia.
    return new Map(grupos.map((g) => [claveUbicacion(g._id), [g._id, g.n] as [string, number]]));
  }

  private unirDestinos(
    lugares: Map<string, [string, number]>, servicios: Map<string, [string, number]>,
  ): DestinoPlanificador[] {
    const claves = new Set([...lugares.keys(), ...servicios.keys()]);
    return [...claves]
      .map((clave) => ({
        // Una de las dos existe siempre: la clave sale de alguna de ellas.
        provincia: (lugares.get(clave) ?? servicios.get(clave))![0],
        lugares: lugares.get(clave)?.[1] ?? 0,
        servicios: servicios.get(clave)?.[1] ?? 0,
      }))
      .sort((a, b) => (b.lugares + b.servicios) - (a.lugares + a.servicios));
  }

  // ── Contexto: solo datos propios ──

  /** Respuestas del formulario con sus valores por defecto. */
  private preferenciasDe(peticion: PeticionItinerario): PreferenciasViaje {
    return {
      ritmo: peticion.ritmo ?? RitmoViaje.EQUILIBRADO,
      alojamiento: peticion.alojamiento ?? AlojamientoViaje.NECESITO,
      desplazamiento: peticion.desplazamiento ?? DesplazamientoViaje.COCHE_PROPIO,
      serviciosExtra: peticion.serviciosExtra ?? [],
      dias: diasDelViaje(peticion.desde, peticion.hasta),
      noches: peticion.desde && peticion.hasta ? nochesDelViaje(peticion.desde, peticion.hasta) : 0,
    };
  }

  /**
   * Zonas donde buscar, de la más precisa a la más amplia: la población
   * escrita y después su provincia (y la capital que se llama igual).
   */
  private zonasDe(destino: DestinoViaje): Array<Array<Record<string, RegExp>>> {
    return [
      ...(destino.municipio ? [[{ 'ubicacion.ciudad': regexSinTildes(destino.municipio) }]] : []),
      ...(destino.provincia ? [[
        { 'ubicacion.provincia': regexSinTildes(destino.provincia) },
        { 'ubicacion.ciudad': regexSinTildes(destino.provincia) },
      ]] : []),
    ];
  }

  /** Lugares de la zona; con intereses, sólo de esos tipos si los hay. */
  private async lugaresDe(destino: DestinoViaje, intereses?: string[]): Promise<LugarDocument[]> {
    const tipos = (intereses ?? []).filter((tipo) => TIPOS_LUGAR.has(tipo));
    if (tipos.length) {
      const deInteres = await this.lugaresPorZonas(destino, { tipo: { $in: tipos } });
      if (deInteres.length) return deInteres;
    }
    return this.lugaresPorZonas(destino, {});
  }

  /**
   * Primero los sitios de la población y, si no llenan el plan, los del resto
   * de la provincia. Antes municipio y provincia iban en el mismo `$or`, así
   * que escribir «Dénia» daba lo mismo que no escribir nada.
   */
  private async lugaresPorZonas(
    destino: DestinoViaje, extra: FilterQuery<LugarDocument>,
  ): Promise<LugarDocument[]> {
    const encontrados: LugarDocument[] = [];
    for (const zona of this.zonasDe(destino)) {
      const faltan = MAX_LUGARES_CONTEXTO - encontrados.length;
      if (faltan <= 0) break;
      const vistos = encontrados.map((l) => l._id);
      const filtro: FilterQuery<LugarDocument> = { estado: EstadoModeracion.PUBLICADO, ...extra, $or: zona };
      if (vistos.length) filtro['_id'] = { $nin: vistos };
      encontrados.push(...await this.buscarLugares(filtro, faltan));
    }
    return encontrados;
  }

  private buscarLugares(filtro: FilterQuery<LugarDocument>, limite = MAX_LUGARES_CONTEXTO): Promise<LugarDocument[]> {
    return this.lugarModel
      .find(filtro)
      .sort({ ratingPromedio: -1 })
      .limit(limite)
      .select('nombre tipo descripcion ubicacion ratingPromedio')
      .lean()
      .exec() as unknown as Promise<LugarDocument[]>;
  }

  /**
   * Servicios reservables para el viaje, de más a menos preciso: los de las
   * categorías que el viaje necesita en la zona; cualquiera de la zona; y, si
   * no hay ninguno, los que hay alrededor. Nunca residencias caninas ni
   * funerarios: se viaja **con** el perro. Si hace falta dónde dormir y no ha
   * salido un hotel, se busca aparte, también alrededor.
   */
  private async serviciosDe(
    destino: DestinoViaje, peticion: PeticionItinerario, preferencias: PreferenciasViaje,
  ): Promise<ServicioDocument[]> {
    const base: FilterQuery<ServicioDocument> = {
      estado: 'publicado', comercioActivo: true, vertical: { $nin: verticalesExcluidas(preferencias) },
    };
    if (peticion.presupuestoMax) base['precioBase'] = { $lte: peticion.presupuestoMax };
    const enZona: FilterQuery<ServicioDocument> = { ...base, $or: this.zonasDe(destino).flat() };

    const servicios = await this.serviciosDeLaZona(destino, enZona, base, preferencias);
    if (!necesitaAlojamiento(preferencias) || alojamientoDe(comoServicios(servicios))) return servicios;

    const soloHoteles = { vertical: VERTICAL_ALOJAMIENTO_VIAJE };
    const hoteles = await this.buscarServicios({ ...enZona, ...soloHoteles });
    const cercanos = hoteles.length ? hoteles : await this.serviciosCercanos(destino, { ...base, ...soloHoteles });
    return [...cercanos.slice(0, 3), ...servicios];
  }

  private async serviciosDeLaZona(
    destino: DestinoViaje,
    enZona: FilterQuery<ServicioDocument>,
    base: FilterQuery<ServicioDocument>,
    preferencias: PreferenciasViaje,
  ): Promise<ServicioDocument[]> {
    const verticales = verticalesBuscadas(preferencias);
    if (verticales.length) {
      const buscados = await this.buscarServicios({ ...enZona, vertical: { $in: verticales } });
      if (buscados.length) return buscados;
    }
    const deLaZona = await this.buscarServicios(enZona);
    return deLaZona.length ? deLaZona : this.serviciosCercanos(destino, base);
  }

  private async serviciosCercanos(
    destino: DestinoViaje, base: FilterQuery<ServicioDocument>,
  ): Promise<ServicioDocument[]> {
    const lugar = destino.municipio ?? destino.provincia ?? destino.etiqueta;
    const centro = await this.centrosPoblacion.centroDe(lugar, destino.provincia).catch(() => null);
    if (!centro) return [];
    return this.buscarServicios({
      ...base,
      'ubicacion.geo': {
        $nearSphere: {
          $geometry: { type: 'Point', coordinates: [centro.lng, centro.lat] },
          $maxDistance: RADIO_SERVICIOS_CERCANOS_M,
        },
      },
    }, false);
  }

  /** `$nearSphere` ya ordena por distancia: con él no se puede añadir otro orden. */
  private buscarServicios(filtro: FilterQuery<ServicioDocument>, ordenar = true): Promise<ServicioDocument[]> {
    const consulta = this.servicioModel.find(filtro);
    if (ordenar) consulta.sort({ destacado: -1, ratingPromedio: -1 });
    return consulta
      .limit(MAX_SERVICIOS_CONTEXTO)
      .select('titulo descripcion vertical precioBase ubicacion')
      .lean()
      .exec() as unknown as Promise<ServicioDocument[]>;
  }

  private async perfilPerro(perroId?: string, usuarioId?: string): Promise<string> {
    if (!perroId || !usuarioId) return '';

    try {
      const perro = await this.perrosService.obtenerPropio(perroId, usuarioId);
      const rasgos = [
        perro.raza && `raza ${perro.raza}`,
        perro.peso && `${perro.peso} kg`,
        perro.esPPP && 'es PPP (requiere bozal y correa en espacios públicos)',
        perro.toleraTrayectosLargos === false && 'no tolera trayectos largos',
        perro.seMarea && 'se marea en el coche',
        perro.sociabilidadPerros && `sociabilidad con otros perros: ${perro.sociabilidadPerros}`,
      ].filter(Boolean);

      return rasgos.length ? `El perro: ${rasgos.join(', ')}.` : '';
    } catch {
      // Un perro inaccesible no debe impedir planificar el viaje.
      return '';
    }
  }

  // ── Generación ──

  private async generarConIA(contexto: ContextoIA): Promise<RespuestaItinerario | null> {
    if (!this.apiKey) return null;

    try {
      const opciones = await this.pedirOpciones(contexto);
      if (!opciones?.length) return null;

      // El modelo redacta, pero el catálogo manda: las paradas con un id que no
      // existe se quedan sin botón, toda opción acaba en algo reservable y el
      // coste lo calcula el API, no el modelo.
      return this.respuesta(contexto, opciones.map((o) => this.depurarOpcion(o, contexto)), false);
    } catch (error) {
      this.logger.warn(`Itinerario con IA no disponible: ${this.mensaje(error)}`);
      return null;
    }
  }

  private async pedirOpciones(contexto: ContextoIA): Promise<OpcionItinerario[] | undefined> {
    const respuesta = await fetch(API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${this.apiKey}` },
      body: JSON.stringify({
        model: 'deepseek-chat',
        messages: [
          { role: 'system', content: this.promptSistema() },
          { role: 'user', content: this.promptUsuario(contexto) },
        ],
        temperature: 0.4,
        max_tokens: 2000,
        response_format: { type: 'json_object' },
      }),
    });
    if (!respuesta.ok) throw new Error(`DeepSeek: ${respuesta.status}`);

    const datos = (await respuesta.json()) as { choices?: Array<{ message?: { content?: string } }> };
    const contenido = datos.choices?.[0]?.message?.content;
    return contenido ? (JSON.parse(contenido) as { opciones?: OpcionItinerario[] }).opciones : undefined;
  }

  /**
   * Itinerario armado solo con datos propios, sin modelo.
   *
   * Este es el camino normal, no una avería: la clave del modelo es opcional y
   * en la mayoría de los despliegues no está puesta. El aviso cuenta lo que de
   * verdad ha pasado: el plan está hecho con los sitios y servicios verificados
   * de la zona.
   */
  private generarSinIA(contexto: ContextoIA): RespuestaItinerario {
    const { destino, preferencias, lugares, servicios } = contexto;
    const zona = destino.municipio ?? destino.provincia ?? destino.etiqueta;
    const dias = armarDias(zona, comoLugares(lugares), comoServicios(servicios), preferencias);
    const opcion: OpcionItinerario = {
      nombre: `Escapada por ${zona}`,
      resumen: this.resumenSinIA(dias.length, lugares.length),
      presupuestoEstimado: 0,
      dias,
    };
    return {
      ...this.respuesta(contexto, [opcion], true),
      aviso: `Plan hecho con los sitios y servicios verificados de ${destino.etiqueta}.`,
    };
  }

  /** Lo común a los dos caminos: estimación propia, sugeridos y aviso de hotel. */
  private respuesta(
    contexto: ContextoIA, opciones: OpcionItinerario[], esFallback: boolean,
  ): RespuestaItinerario {
    const { destino, preferencias, peticion } = contexto;
    const servicios = serviciosDelContexto(comoServicios(contexto.servicios), preferencias);
    const conCoste = opciones.map((o) => conEstimacion(o, preferencias, peticion.presupuestoMax));
    const faltaHotel = necesitaAlojamiento(preferencias) && !alojamientoDe(servicios);
    return {
      provincia: destino.provincia ?? destino.etiqueta,
      destino: destino.etiqueta,
      noches: preferencias.noches,
      opciones: conCoste,
      serviciosSugeridos: serviciosSugeridos(conCoste, servicios),
      esFallback,
      ...(faltaHotel ? { avisoAlojamiento: this.avisoSinHotel(destino, peticion.presupuestoMax) } : {}),
    };
  }

  private avisoSinHotel(destino: DestinoViaje, presupuestoMax?: number): string {
    const tope = presupuestoMax ? ` por menos de ${presupuestoMax} € la noche` : '';
    return `Todavía no hay hoteles pet friendly${tope} en ${destino.etiqueta} ni alrededores en Doogking: `
      + 'el plan no incluye dónde dormir.';
  }

  private resumenSinIA(dias: number, totalLugares: number): string {
    const jornadas = dias === 1 ? 'una jornada' : `${dias} días`;
    return `Ruta de ${jornadas} con ${totalLugares} ${totalLugares === 1 ? 'sitio' : 'sitios'} `
      + 'mejor valorados por la comunidad y los servicios que se pueden reservar en la zona.';
  }

  /** Solo sobreviven las paradas que apuntan a algo real del catálogo. */
  private depurarOpcion(opcion: OpcionItinerario, contexto: ContextoIA): OpcionItinerario {
    const lugaresPorId = new Map(comoLugares(contexto.lugares).map((l) => [String(l._id), l]));
    const utiles = serviciosDelContexto(comoServicios(contexto.servicios), contexto.preferencias);
    const serviciosPorId = new Map(utiles.map((s) => [String(s._id), s]));

    const dias = (opcion.dias ?? []).map((dia) => ({
      ...dia,
      paradas: (dia.paradas ?? []).map((parada): ParadaItinerario => {
        const servicio = parada.servicioId ? serviciosPorId.get(parada.servicioId) : undefined;
        if (servicio) return { ...parada, ...paradaDeServicio(servicio) };
        const lugar = parada.lugarId ? lugaresPorId.get(parada.lugarId) : undefined;
        if (lugar) return { ...parada, ...paradaDeLugar(lugar) };
        // Sin id reconocible se conserva como texto, sin botón ni precio.
        return { ...parada, tipo: 'lugar', servicioId: undefined, lugarId: undefined, precioEstimado: undefined };
      }),
    }));

    const conHotel = asegurarAlojamiento(dias, utiles, contexto.preferencias);
    return { ...opcion, dias: garantizarServicio(conHotel, utiles, contexto.preferencias) };
  }

  private promptSistema(): string {
    return `Eres el planificador de viajes con mascota de Doogking.

REGLA ABSOLUTA: solo puedes usar los lugares y servicios que te doy en el contexto.
NUNCA inventes sitios, negocios ni precios. Si algo no está en la lista, no existe.

Devuelve SIEMPRE un JSON válido con esta forma exacta:
{
  "opciones": [
    {
      "nombre": "Nombre corto del plan",
      "resumen": "Una frase sobre para quién es este plan",
      "dias": [
        {
          "dia": 1,
          "titulo": "Título del día",
          "paradas": [
            { "titulo": "...", "descripcion": "...", "tipo": "lugar", "lugarId": "id_del_contexto" },
            { "titulo": "...", "descripcion": "...", "tipo": "servicio", "servicioId": "id_del_contexto" }
          ]
        }
      ]
    }
  ]
}

Reglas:
- Devuelve entre 2 y 3 opciones con enfoques distintos (tranquila, activa, económica).
- Cada opción DEBE incluir al menos un servicio reservable del contexto si hay alguno: el plan termina en una reserva.
- Si se necesita alojamiento, ponlo el día 1 y usa SOLO un servicio de la categoría "hoteles": el perro viaja y duerme con su familia.
- Si se necesita transporte para la mascota, ponlo también el día 1.
- No calcules ni menciones precios ni costes totales: los pone la plataforma.
- Respeta el ritmo: tranquilo = 2 sitios al día, equilibrado = 3, intenso = 4.
- Si se indican intereses, prioriza esos tipos de sitio.
- Copia los identificadores tal cual aparecen en el contexto.
- Escribe en español, en segunda persona y sin florituras.
- Ten en cuenta el perfil del perro si se indica: un perro que se marea no hace rutas largas en coche.`;
  }

  private promptUsuario({ peticion, destino, preferencias, lugares, servicios, perfilPerro }: ContextoIA): string {
    const listaLugares = lugares
      .map((l) => `- id:${String(l._id)} | ${l.nombre} (${l.tipo}, ${l.ubicacion.ciudad})`)
      .join('\n');
    const listaServicios = servicios
      .map((s) => `- id:${String(s._id)} | ${s.titulo} (${s.vertical}, desde ${s.precioBase} €`
        + `${s.vertical === VERTICAL_ALOJAMIENTO_VIAJE ? ' la noche' : ''})`)
      .join('\n');

    return [
      `Destino: ${destino.etiqueta}`,
      `Fechas: del ${peticion.desde} al ${peticion.hasta} (${preferencias.noches} noches)`,
      preferencias.dias && `Días del itinerario: ${preferencias.dias}`,
      peticion.presupuestoMax && `Presupuesto máximo: ${peticion.presupuestoMax} €`,
      peticion.intereses?.length && `Intereses: ${peticion.intereses.join(', ')}`,
      `Ritmo: ${preferencias.ritmo}`,
      `Alojamiento: ${necesitaAlojamiento(preferencias) ? 'necesita hotel pet friendly' : 'no lo necesita'}`,
      `Desplazamiento: ${preferencias.desplazamiento === DesplazamientoViaje.TRANSPORTE_MASCOTA
        ? 'necesita transporte para la mascota' : 'coche propio'}`,
      preferencias.serviciosExtra.length && `Servicios que necesitará: ${preferencias.serviciosExtra.join(', ')}`,
      perfilPerro,
      '',
      'LUGARES DISPONIBLES:',
      listaLugares || '(ninguno)',
      '',
      'SERVICIOS RESERVABLES:',
      listaServicios || '(ninguno)',
    ].filter(Boolean).join('\n');
  }

  // ── Coste: caché y cupo ──

  private clave(peticion: PeticionItinerario, destino: DestinoViaje): string {
    // Por mes, no por día exacto: dos viajes en la misma quincena comparten
    // itinerario y no tiene sentido pagar dos generaciones.
    // Cada respuesta del formulario cambia el plan, así que todas entran en la
    // clave: si no, dos viajes con ritmos distintos compartirían itinerario.
    // Las noches también: con ellas se calcula la estimación.
    const mes = peticion.desde?.slice(0, 7) ?? 'sin-fecha';
    const lista = (valores?: string[]): string => [...(valores ?? [])].sort().join(',');
    const p = this.preferenciasDe(peticion);
    return [
      claveUbicacion(destino.etiqueta), mes, p.dias ?? 0, p.noches,
      peticion.presupuestoMax ?? 0, lista(peticion.intereses), p.ritmo, p.alojamiento, p.desplazamiento,
      lista(peticion.serviciosExtra),
    ].join('|');
  }

  private leerCache(clave: string): RespuestaItinerario | null {
    const entrada = this.cache.get(clave);
    if (!entrada) return null;
    if (entrada.expiraEn <= Date.now()) {
      this.cache.delete(clave);
      return null;
    }
    return entrada.valor;
  }

  private escribirCache(clave: string, valor: RespuestaItinerario): void {
    this.cache.set(clave, { valor, expiraEn: Date.now() + TTL_CACHE_MS });
  }

  /** Tope diario por usuario: cada generación cuesta dinero real. */
  private comprobarCupo(usuarioId?: string): void {
    if (!usuarioId) return;

    const hoy = claveDiaEnZona(new Date());
    const uso = this.usosPorUsuario.get(usuarioId);

    if (!uso || uso.dia !== hoy) {
      this.usosPorUsuario.set(usuarioId, { dia: hoy, n: 1 });
      return;
    }

    if (uso.n >= MAX_POR_USUARIO_DIA) {
      throw new DomainException(
        'Has generado muchos itinerarios hoy. Vuelve a intentarlo mañana.',
        429,
      );
    }
    uso.n++;
  }

  private mensaje(error: unknown): string {
    return error instanceof Error ? error.message : 'error desconocido';
  }
}
