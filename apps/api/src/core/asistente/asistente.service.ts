import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ConsultaAsistenteDto, RespuestaAsistenteApi } from 'shared';
import { CONOCIMIENTO_DOOGKING } from './conocimiento';
import { BusquedaPlataforma, BusquedaPlataformaService } from './busqueda-plataforma.service';

/** Turnos que se le mandan al modelo: los últimos, no la conversación entera. */
const TURNOS_DE_CONTEXTO = 6;

/** Un mensaje en el formato de chat compartido por DeepSeek y OpenAI. */
interface MensajeModelo {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

/** Proveedor de IA resuelto al arrancar. */
interface Proveedor {
  readonly nombre: 'deepseek' | 'openai';
  readonly url: string;
  readonly modelo: string;
  readonly apiKey: string;
}

const INSTRUCCIONES = `Eres el asistente de Doogking. Ayudas a dueños de perros y
a los negocios de la plataforma a entender la web y a hacer lo que quieren hacer.

Reglas, en orden de importancia:
1. Responde SOLO con lo que diga la base de conocimiento de abajo. Si algo no
   está ahí, dilo con naturalidad y ofrece el centro de ayuda (/ayuda) o
   escribir a soporte. Nunca inventes precios, plazos, comisiones ni pasos de
   pantallas que no se describan.
2. Si preguntan cómo se hace algo, contesta con los pasos, en orden y numerados.
3. Sé breve: dos o tres frases, o los pasos justos. Nada de introducciones.
4. Español de España, de tú, cercano y sin tecnicismos.
5. No pidas ni repitas datos personales, ni números de tarjeta.
6. Si la pregunta no tiene nada que ver con Doogking ni con el cuidado de un
   perro, dilo en una frase y reconduce a lo que sí puedes resolver.

Cuando venga a cuento, termina proponiendo hasta dos enlaces de la propia web en
una última línea con este formato exacto, y nada más después:
ENLACES: Texto del enlace|/ruta ; Otro texto|/otra-ruta

Rutas que existen: / (portada), /alojamiento, /hoteles, /veterinaria,
/peluqueria, /adiestramiento, /transporte, /seguros, /funerarios, /explora
(playas, parques, restaurantes, tiendas, rutas y ríos para ir con el perro),
/explora/planificador, /perros (mis perros), /reservas (mis reservas),
/favoritos, /perfil, /ayuda, /para-comercios, /comercio (panel del negocio).

Cuando la base de conocimiento incluya "RESULTADOS DE LA PLATAFORMA", esas son
opciones reales que el usuario ya ve como tarjetas debajo de tu respuesta:
preséntalas en una o dos frases (puedes nombrar las dos primeras), no copies la
lista entera ni inventes datos que no estén ahí, y no añadas línea ENLACES. Si
la búsqueda no encontró nada, dilo y propone otra población o la categoría
entera. Nunca digas que Doogking no tiene algo que aparezca en el inventario.`;

/**
 * El asistente de la web: responde dudas sobre Doogking y guía por sus
 * procedimientos.
 *
 * Usa el proveedor de IA que esté configurado —DeepSeek u OpenAI—, con
 * preferencia por DeepSeek, que es el que ya usan el buscador con IA y el
 * planificador. Sin ninguno de los dos no finge una avería: contesta que el
 * asistente no está disponible y manda al centro de ayuda, que sigue teniendo
 * las preguntas frecuentes.
 */
@Injectable()
export class AsistenteService {
  private readonly logger = new Logger(AsistenteService.name);
  private readonly proveedor?: Proveedor;

  constructor(
    config: ConfigService,
    private readonly plataforma: BusquedaPlataformaService,
  ) {
    const deepseek = config.get<string>('DEEPSEEK_API_KEY');
    const openai = config.get<string>('OPENAI_API_KEY');

    // Lectura no-eager, como en `ai-search`: el API arranca sin claves y el
    // asistente degrada solo.
    if (deepseek) {
      this.proveedor = {
        nombre: 'deepseek', apiKey: deepseek,
        url: 'https://api.deepseek.com/chat/completions', modelo: 'deepseek-chat',
      };
    } else if (openai) {
      this.proveedor = {
        nombre: 'openai', apiKey: openai,
        url: 'https://api.openai.com/v1/chat/completions', modelo: 'gpt-4o-mini',
      };
    }
  }

  async responder(consulta: ConsultaAsistenteDto): Promise<RespuestaAsistenteApi> {
    const busqueda = await this.buscarEnPlataforma(consulta.pregunta);
    if (!this.proveedor) return this.sinProveedor(busqueda);

    try {
      const inventario = await this.plataforma.inventarioComoTexto();
      const texto = await this.preguntarAlModelo(
        this.conversacion(consulta, this.contextoPlataforma(inventario, busqueda)),
        this.proveedor,
      );
      return { disponible: true, ...this.separarEnlaces(texto), ...this.tarjetas(busqueda) };
    } catch (error) {
      this.logger.error('El asistente no pudo responder', error);
      if (busqueda) return { disponible: true, respuesta: this.textoDeBusqueda(busqueda), ...this.tarjetas(busqueda) };
      return {
        disponible: true,
        respuesta: 'Ahora mismo no puedo contestarte. Vuelve a intentarlo en un momento '
          + 'o mira el centro de ayuda, que tiene las preguntas más frecuentes.',
        enlaces: [{ titulo: 'Centro de ayuda', ruta: '/ayuda' }],
      };
    }
  }

  /** Una caída de la base no debe dejar al asistente sin contestar. */
  private async buscarEnPlataforma(pregunta: string): Promise<BusquedaPlataforma | null> {
    try {
      return await this.plataforma.buscar(pregunta);
    } catch (error) {
      this.logger.warn(`Búsqueda del asistente fallida: ${String(error)}`);
      return null;
    }
  }

  private tarjetas(busqueda: BusquedaPlataforma | null): Partial<RespuestaAsistenteApi> {
    if (!busqueda) return {};
    return {
      ...(busqueda.resultados.length ? { resultados: busqueda.resultados } : {}),
      verTodos: busqueda.verTodos,
    };
  }

  /**
   * Sin modelo, las opciones se presentan con una frase fija: las tarjetas
   * son la respuesta y no necesitan a nadie que las redacte.
   */
  private textoDeBusqueda(busqueda: BusquedaPlataforma): string {
    return busqueda.resultados.length
      ? `Esto es lo que hay en Doogking (${busqueda.descripcion}):`
      : `Ahora mismo no hay resultados de ${busqueda.descripcion} en Doogking. `
        + 'Prueba con otra población o mira la categoría entera.';
  }

  private sinProveedor(busqueda: BusquedaPlataforma | null): RespuestaAsistenteApi {
    if (busqueda) {
      return { disponible: true, respuesta: this.textoDeBusqueda(busqueda), ...this.tarjetas(busqueda) };
    }
    return {
      disponible: false,
      respuesta: 'El asistente no está disponible en este momento. En el centro de ayuda '
        + 'tienes las preguntas más frecuentes, y desde ahí puedes escribirnos.',
      enlaces: [{ titulo: 'Centro de ayuda', ruta: '/ayuda' }],
    };
  }

  /** Datos vivos de la plataforma que se añaden a la base de conocimiento. */
  private contextoPlataforma(inventario: string, busqueda: BusquedaPlataforma | null): string {
    const partes: string[] = [];
    if (inventario) partes.push(`## Lo que hay publicado en Doogking\n${inventario}`);
    if (busqueda) partes.push(this.resultadosComoTexto(busqueda));
    return partes.join('\n\n');
  }

  private resultadosComoTexto(busqueda: BusquedaPlataforma): string {
    const lineas = busqueda.resultados.map((r) => {
      const precio = r.precioDesde != null ? `, desde ${r.precioDesde} €` : '';
      const nota = r.nota != null ? `, nota ${r.nota}/5 (${r.numResenas} reseñas)` : '';
      return `- ${r.titulo} (${r.ciudad}${precio}${nota})`;
    });
    return [
      `## RESULTADOS DE LA PLATAFORMA para "${busqueda.descripcion}"`,
      ...(lineas.length ? lineas : ['- Ninguno.']),
    ].join('\n');
  }

  private async preguntarAlModelo(mensajes: MensajeModelo[], proveedor: Proveedor): Promise<string> {
    const respuesta = await fetch(proveedor.url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${proveedor.apiKey}` },
      body: JSON.stringify({
        model: proveedor.modelo,
        messages: mensajes,
        temperature: 0.2,
        max_tokens: 500,
      }),
    });

    if (!respuesta.ok) throw new Error(`${proveedor.nombre}: ${respuesta.status}`);

    const datos = await respuesta.json() as { choices?: Array<{ message?: { content?: string } }> };
    const texto = datos.choices?.[0]?.message?.content?.trim();
    if (!texto) throw new Error(`${proveedor.nombre}: respuesta vacía`);
    return texto;
  }

  private conversacion(consulta: ConsultaAsistenteDto, contexto: string): MensajeModelo[] {
    const ruta = consulta.ruta
      ? `\n\nEl usuario está ahora en la página ${consulta.ruta}.`
      : '';
    const vivo = contexto ? `\n\n${contexto}` : '';

    return [
      {
        role: 'system',
        content: `${INSTRUCCIONES}\n\n--- BASE DE CONOCIMIENTO ---\n${CONOCIMIENTO_DOOGKING}${vivo}${ruta}`,
      },
      ...(consulta.historial ?? []).slice(-TURNOS_DE_CONTEXTO).map((m): MensajeModelo => ({
        role: m.autor === 'cliente' ? 'user' : 'assistant',
        content: m.texto,
      })),
      { role: 'user', content: consulta.pregunta },
    ];
  }

  /**
   * Separa la última línea "ENLACES: ..." del cuerpo de la respuesta.
   *
   * El modelo devuelve texto plano, así que los enlaces vienen en una línea con
   * formato acordado; si no la manda, o la manda mal, la respuesta se queda tal
   * cual y no se pierde nada. Sólo se aceptan rutas internas: una respuesta
   * generada no puede mandar a nadie fuera de la web.
   */
  private separarEnlaces(texto: string): { respuesta: string; enlaces?: RespuestaAsistenteApi['enlaces'] } {
    const marca = texto.lastIndexOf('ENLACES:');
    if (marca === -1) return { respuesta: texto };

    const enlaces = texto
      .slice(marca + 'ENLACES:'.length)
      .split(';')
      .map((trozo) => {
        const [titulo, ruta] = trozo.split('|').map((p) => p.trim());
        return { titulo, ruta };
      })
      .filter((e) => e.titulo && e.ruta?.startsWith('/') && !e.ruta.startsWith('//'))
      .slice(0, 2);

    const respuesta = texto.slice(0, marca).trim();
    return respuesta
      ? { respuesta, ...(enlaces.length ? { enlaces } : {}) }
      : { respuesta: texto };
  }
}
