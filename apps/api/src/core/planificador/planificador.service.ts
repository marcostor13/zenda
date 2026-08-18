import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { ConfigService } from '@nestjs/config';
import { EstadoModeracion, VerticalKey, regexLiteral } from 'shared';
import { Servicio, ServicioDocument } from '../catalog/servicio.schema';
import { Lugar, LugarDocument } from '../lugares/lugar.schema';
import { PerrosService } from '../perros/perros.service';
import { DomainException } from '../../shared/exceptions/domain.exception';

export interface PeticionItinerario {
  provincia: string;
  desde?: string;
  hasta?: string;
  perroId?: string;
  presupuestoMax?: number;
  intereses?: string[];
}

/** Una parada del itinerario; si es reservable, trae su `servicioId`. */
export interface ParadaItinerario {
  titulo: string;
  descripcion: string;
  tipo: 'lugar' | 'servicio';
  /** Presente solo en paradas reservables: alimenta "Añadir al viaje". */
  servicioId?: string;
  lugarId?: string;
  vertical?: string;
  precioEstimado?: number;
}

export interface DiaItinerario {
  dia: number;
  titulo: string;
  paradas: ParadaItinerario[];
}

export interface OpcionItinerario {
  nombre: string;
  resumen: string;
  presupuestoEstimado: number;
  dias: DiaItinerario[];
}

export interface RespuestaItinerario {
  provincia: string;
  opciones: OpcionItinerario[];
  /** true cuando el itinerario se armó sin IA, solo con datos propios. */
  esFallback: boolean;
  aviso?: string;
}

const API_URL = 'https://api.deepseek.com/chat/completions';
const TTL_CACHE_MS = 7 * 24 * 60 * 60 * 1000;
const MAX_POR_USUARIO_DIA = 10;
const MAX_LUGARES_CONTEXTO = 25;
const MAX_SERVICIOS_CONTEXTO = 25;

interface EntradaCache {
  valor: RespuestaItinerario;
  expiraEn: number;
}

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
 * 3. **Personalización**: provincia, fechas, presupuesto e intereses, más el
 *    perfil del perro si se indica.
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

  constructor(
    @InjectModel(Servicio.name) private readonly servicioModel: Model<ServicioDocument>,
    @InjectModel(Lugar.name) private readonly lugarModel: Model<LugarDocument>,
    private readonly perrosService: PerrosService,
    config: ConfigService,
  ) {
    this.apiKey = config.get<string>('DEEPSEEK_API_KEY');
  }

  async generar(peticion: PeticionItinerario, usuarioId?: string): Promise<RespuestaItinerario> {
    if (!peticion.provincia?.trim()) {
      throw new DomainException('Indica la provincia a la que quieres viajar', 400);
    }

    const clave = this.clave(peticion);
    const cacheado = this.leerCache(clave);
    if (cacheado) return cacheado;

    this.comprobarCupo(usuarioId);

    const [lugares, servicios] = await Promise.all([
      this.lugaresDe(peticion.provincia),
      this.serviciosDe(peticion.provincia, peticion.presupuestoMax),
    ]);

    if (!lugares.length && !servicios.length) {
      throw new DomainException(
        `Todavía no tenemos suficiente contenido en ${peticion.provincia} para armar un viaje.`,
        404,
      );
    }

    const perfilPerro = await this.perfilPerro(peticion.perroId, usuarioId);
    const respuesta = await this.generarConIA(peticion, lugares, servicios, perfilPerro)
      ?? this.generarSinIA(peticion, lugares, servicios);

    this.escribirCache(clave, respuesta);
    return respuesta;
  }

  // ── Contexto: solo datos propios ──

  private lugaresDe(provincia: string): Promise<LugarDocument[]> {
    return this.lugarModel
      .find({
        estado: EstadoModeracion.PUBLICADO,
        $or: [
          { 'ubicacion.provincia': regexLiteral(provincia) },
          { 'ubicacion.ciudad': regexLiteral(provincia) },
        ],
      })
      .sort({ ratingPromedio: -1 })
      .limit(MAX_LUGARES_CONTEXTO)
      .select('nombre tipo descripcion ubicacion ratingPromedio')
      .lean()
      .exec() as unknown as Promise<LugarDocument[]>;
  }

  private serviciosDe(provincia: string, presupuestoMax?: number): Promise<ServicioDocument[]> {
    const filtro: Record<string, unknown> = {
      estado: 'publicado',
      'ubicacion.ciudad': regexLiteral(provincia),
    };
    if (presupuestoMax) filtro['precioBase'] = { $lte: presupuestoMax };

    return this.servicioModel
      .find(filtro)
      .sort({ destacado: -1, ratingPromedio: -1 })
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

  private async generarConIA(
    peticion: PeticionItinerario,
    lugares: LugarDocument[],
    servicios: ServicioDocument[],
    perfilPerro: string,
  ): Promise<RespuestaItinerario | null> {
    if (!this.apiKey) return null;

    try {
      const respuesta = await fetch(API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify({
          model: 'deepseek-chat',
          messages: [
            { role: 'system', content: this.promptSistema() },
            { role: 'user', content: this.promptUsuario(peticion, lugares, servicios, perfilPerro) },
          ],
          temperature: 0.4,
          max_tokens: 2000,
          response_format: { type: 'json_object' },
        }),
      });

      if (!respuesta.ok) throw new Error(`DeepSeek: ${respuesta.status}`);

      const datos = (await respuesta.json()) as { choices?: Array<{ message?: { content?: string } }> };
      const contenido = datos.choices?.[0]?.message?.content;
      if (!contenido) return null;

      const parseado = JSON.parse(contenido) as { opciones?: OpcionItinerario[] };
      if (!parseado.opciones?.length) return null;

      return {
        provincia: peticion.provincia,
        // Se descartan las paradas cuyo id no exista: el modelo redacta, pero
        // el catálogo manda. Nunca se ofrece algo que no se pueda reservar.
        opciones: parseado.opciones.map((o) => this.depurarOpcion(o, lugares, servicios)),
        esFallback: false,
      };
    } catch (error) {
      this.logger.warn(`Itinerario con IA no disponible: ${this.mensaje(error)}`);
      return null;
    }
  }

  /**
   * Itinerario armado solo con datos propios, sin modelo. No es un mensaje de
   * error: el usuario recibe un plan real aunque la IA no esté disponible.
   */
  private generarSinIA(
    peticion: PeticionItinerario,
    lugares: LugarDocument[],
    servicios: ServicioDocument[],
  ): RespuestaItinerario {
    const alojamiento = servicios.find((s) => s.vertical === VerticalKey.ALOJAMIENTO)
      ?? servicios.find((s) => s.vertical === VerticalKey.HOTELES);
    const porDia = 3;

    const dias: DiaItinerario[] = [];
    for (let i = 0; i < Math.min(3, Math.ceil(lugares.length / porDia)); i++) {
      dias.push({
        dia: i + 1,
        titulo: `Día ${i + 1} en ${peticion.provincia}`,
        paradas: lugares.slice(i * porDia, (i + 1) * porDia).map((l) => this.paradaDeLugar(l)),
      });
    }

    if (alojamiento && dias.length) {
      dias[0].paradas.unshift(this.paradaDeServicio(alojamiento));
    }

    return {
      provincia: peticion.provincia,
      opciones: [{
        nombre: `Escapada por ${peticion.provincia}`,
        resumen: 'Ruta armada con los sitios mejor valorados por la comunidad y los servicios disponibles en la zona.',
        presupuestoEstimado: alojamiento?.precioBase ?? 0,
        dias,
      }],
      esFallback: true,
      aviso: 'Itinerario generado con nuestros propios datos; el asistente con IA no está disponible ahora mismo.',
    };
  }

  /** Solo sobreviven las paradas que apuntan a algo real del catálogo. */
  private depurarOpcion(
    opcion: OpcionItinerario,
    lugares: LugarDocument[],
    servicios: ServicioDocument[],
  ): OpcionItinerario {
    const lugaresPorId = new Map(lugares.map((l) => [String(l._id), l]));
    const serviciosPorId = new Map(servicios.map((s) => [String(s._id), s]));

    return {
      ...opcion,
      dias: (opcion.dias ?? []).map((dia) => ({
        ...dia,
        paradas: (dia.paradas ?? [])
          .map((parada) => {
            if (parada.servicioId && serviciosPorId.has(parada.servicioId)) {
              return { ...parada, ...this.paradaDeServicio(serviciosPorId.get(parada.servicioId)!) };
            }
            if (parada.lugarId && lugaresPorId.has(parada.lugarId)) {
              return { ...parada, ...this.paradaDeLugar(lugaresPorId.get(parada.lugarId)!) };
            }
            // Sin id reconocible se conserva como texto, sin botón de reservar.
            return { ...parada, tipo: 'lugar' as const, servicioId: undefined, lugarId: undefined };
          }),
      })),
    };
  }

  private paradaDeLugar(lugar: LugarDocument): ParadaItinerario {
    return {
      titulo: lugar.nombre,
      descripcion: lugar.descripcion || `${lugar.tipo} en ${lugar.ubicacion.ciudad}`,
      tipo: 'lugar',
      lugarId: String(lugar._id),
    };
  }

  private paradaDeServicio(servicio: ServicioDocument): ParadaItinerario {
    return {
      titulo: servicio.titulo,
      descripcion: servicio.descripcion ?? '',
      tipo: 'servicio',
      servicioId: String(servicio._id),
      vertical: servicio.vertical,
      precioEstimado: servicio.precioBase,
    };
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
      "presupuestoEstimado": número_en_euros,
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
- Copia los identificadores tal cual aparecen en el contexto.
- Escribe en español, en segunda persona y sin florituras.
- Ten en cuenta el perfil del perro si se indica: un perro que se marea no hace rutas largas en coche.`;
  }

  private promptUsuario(
    peticion: PeticionItinerario,
    lugares: LugarDocument[],
    servicios: ServicioDocument[],
    perfilPerro: string,
  ): string {
    const listaLugares = lugares
      .map((l) => `- id:${String(l._id)} | ${l.nombre} (${l.tipo}, ${l.ubicacion.ciudad})`)
      .join('\n');

    const listaServicios = servicios
      .map((s) => `- id:${String(s._id)} | ${s.titulo} (${s.vertical}, ${s.precioBase} €)`)
      .join('\n');

    return [
      `Provincia: ${peticion.provincia}`,
      peticion.desde && `Fechas: del ${peticion.desde} al ${peticion.hasta ?? peticion.desde}`,
      peticion.presupuestoMax && `Presupuesto máximo: ${peticion.presupuestoMax} €`,
      peticion.intereses?.length && `Intereses: ${peticion.intereses.join(', ')}`,
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

  private clave(peticion: PeticionItinerario): string {
    // Por mes, no por día exacto: dos viajes en la misma quincena comparten
    // itinerario y no tiene sentido pagar dos generaciones.
    const mes = peticion.desde?.slice(0, 7) ?? 'sin-fecha';
    const intereses = [...(peticion.intereses ?? [])].sort().join(',');
    return `${peticion.provincia.toLowerCase()}|${mes}|${peticion.presupuestoMax ?? 0}|${intereses}`;
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

    const hoy = new Date().toISOString().slice(0, 10);
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
