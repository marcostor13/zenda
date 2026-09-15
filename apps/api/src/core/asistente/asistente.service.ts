import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ConsultaAsistenteDto, RespuestaAsistenteApi } from 'shared';
import { CONOCIMIENTO_DOOGKING } from './conocimiento';

/** Turnos que se le mandan al modelo: los últimos, no la conversación entera. */
const TURNOS_DE_CONTEXTO = 6;

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
/peluqueria, /adiestramiento, /transporte, /seguros, /funerarios, /perros
(mis perros), /reservas/mis (mis reservas), /favoritos, /perfil, /ayuda,
/para-comercios, /panel-comercio (panel del negocio).`;

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

  constructor(config: ConfigService) {
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
    if (!this.proveedor) return this.sinProveedor();

    try {
      const texto = await this.preguntarAlModelo(consulta, this.proveedor);
      return { disponible: true, ...this.separarEnlaces(texto) };
    } catch (error) {
      this.logger.error('El asistente no pudo responder', error);
      return {
        disponible: true,
        respuesta: 'Ahora mismo no puedo contestarte. Vuelve a intentarlo en un momento '
          + 'o mira el centro de ayuda, que tiene las preguntas más frecuentes.',
        enlaces: [{ titulo: 'Centro de ayuda', ruta: '/ayuda' }],
      };
    }
  }

  private sinProveedor(): RespuestaAsistenteApi {
    return {
      disponible: false,
      respuesta: 'El asistente no está disponible en este momento. En el centro de ayuda '
        + 'tienes las preguntas más frecuentes, y desde ahí puedes escribirnos.',
      enlaces: [{ titulo: 'Centro de ayuda', ruta: '/ayuda' }],
    };
  }

  private async preguntarAlModelo(consulta: ConsultaAsistenteDto, proveedor: Proveedor): Promise<string> {
    const respuesta = await fetch(proveedor.url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${proveedor.apiKey}` },
      body: JSON.stringify({
        model: proveedor.modelo,
        messages: this.conversacion(consulta),
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

  private conversacion(consulta: ConsultaAsistenteDto) {
    const ruta = consulta.ruta
      ? `\n\nEl usuario está ahora en la página ${consulta.ruta}.`
      : '';

    return [
      { role: 'system', content: `${INSTRUCCIONES}\n\n--- BASE DE CONOCIMIENTO ---\n${CONOCIMIENTO_DOOGKING}${ruta}` },
      ...(consulta.historial ?? []).slice(-TURNOS_DE_CONTEXTO).map((m) => ({
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
