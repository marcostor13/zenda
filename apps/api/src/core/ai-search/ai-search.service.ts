import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { VERTICAL_LABELS, VerticalKey } from 'shared';
import { InterpretacionLocal, interpretarLocalmente } from './interpretacion-local';

export interface SearchParams {
  vertical: VerticalKey | null;
  ciudad: string | null;
  desde: string | null;
  hasta: string | null;
  presupuestoMax: number | null;
  pasajeros: number | null;
  extras: Record<string, string>;
  explicacion: string;
}

const SYSTEM_PROMPT = `Eres el asistente de búsqueda de Doogking, un marketplace europeo de reservas de servicios caninos ("Todo para su rey, en un solo lugar").
Tu tarea es interpretar consultas en lenguaje natural y extraer parámetros de búsqueda estructurados.

Verticales disponibles:
- alojamiento: alojamiento canino / residencias / guarderías / hoteles PARA perros (reserva por noches, ingreso/salida)
- transporte: transporte de animales / traslados de mascotas de un punto A a un punto B
- veterinaria: clínicas veterinarias, consultas, vacunas, castración, analíticas, urgencias (cita con fecha)
- peluqueria: peluquerías caninas, baño, corte, deslanado, grooming (cita con fecha)
- adiestramiento: adiestramiento y educación canina (sesiones o programas)
- hoteles: hoteles y apartamentos pet-friendly PARA PERSONAS que viajan con su perro
- seguros: seguros para mascotas, pólizas, responsabilidad civil
- funerarios: servicios funerarios, cremación, entierro y despedida

Responde SIEMPRE con un objeto JSON válido con esta estructura exacta (sin markdown, sin explicaciones fuera del JSON):
{
  "vertical": "alojamiento" | "transporte" | "veterinaria" | "peluqueria" | "adiestramiento" | "hoteles" | "seguros" | "funerarios" | null,
  "ciudad": "nombre de ciudad" | null,
  "desde": "YYYY-MM-DD" | null,
  "hasta": "YYYY-MM-DD" | null,
  "presupuestoMax": número_en_euros | null,
  "pasajeros": número_de_perros | null,
  "extras": { "clave": "valor" },
  "explicacion": "Resumen de lo que el usuario busca, en español, máx 1 frase"
}

Reglas:
- Si el usuario dice "este fin de semana", "próximo mes", etc., calcula fechas relativas al ${new Date().toISOString().split('T')[0]}.
- "pasajeros" es el número de perros/mascotas.
- Para transporte, extrae origen y destino en extras: { "origen": "...", "destino": "..." }.
- Para adiestramiento, extrae edad del perro si se menciona: { "edadMeses": "..." }.
- Para alojamiento, extrae tamaño del perro si se menciona: { "tamanoPerro": "pequeno|mediano|grande|gigante" }.
- Para veterinaria/peluqueria, extrae el servicio pedido si se menciona: { "servicio": "..." }.
- Distingue "hotel para perros" (alojamiento: el perro se queda) de "hotel pet-friendly" (hoteles: viaja la persona con el perro).
- Si la ciudad no es clara, pon null.
- Si el vertical no es claro, pon null.
- La explicacion debe estar en español.`;

@Injectable()
export class AiSearchService {
  private readonly logger = new Logger(AiSearchService.name);
  private readonly apiKey?: string;
  private readonly apiUrl = 'https://api.deepseek.com/chat/completions';

  constructor(config: ConfigService) {
    // Lectura no-eager: la búsqueda con IA es opcional; el API arranca sin la key
    // y `interpretSearch` degrada al formulario manual si no está configurada.
    this.apiKey = config.get<string>('DEEPSEEK_API_KEY');
  }

  /**
   * Interpreta la frase del buscador.
   *
   * El intérprete local se ejecuta **siempre** y es el suelo del resultado: el
   * modelo es un servicio externo y opcional, y cuando no está —o falla— antes
   * se devolvía todo a `null`. Con eso «Peluquería canina en Valencia» llegaba
   * al frontend sin categoría ni ciudad, y el buscador acababa enseñando
   * residencias caninas de cualquier sitio. Ahora el modelo sólo puede afinar
   * lo que el intérprete no supo deducir, nunca vaciarlo.
   */
  async interpretSearch(query: string): Promise<SearchParams> {
    const local = interpretarLocalmente(query);

    if (!this.apiKey) return this.desdeLocal(local);

    try {
      const response = await fetch(this.apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify({
          model: 'deepseek-chat',
          messages: [
            { role: 'system', content: SYSTEM_PROMPT },
            { role: 'user', content: query },
          ],
          temperature: 0.1,
          max_tokens: 512,
          response_format: { type: 'json_object' },
        }),
      });

      if (!response.ok) {
        throw new Error(`DeepSeek API error: ${response.status}`);
      }

      const data = await response.json() as { choices: Array<{ message: { content: string } }> };
      const content = data.choices[0]?.message?.content ?? '{}';
      return this.combinar(this.sanear(JSON.parse(content) as Record<string, unknown>), local);
    } catch (error) {
      this.logger.error('Error al interpretar búsqueda con IA', error);
      return this.desdeLocal(local);
    }
  }

  /** Resultado con lo único que hay: lo deducido de la propia frase. */
  private desdeLocal(local: InterpretacionLocal): SearchParams {
    return { ...local, explicacion: this.explicar(local) };
  }

  /**
   * El modelo manda donde dice algo; el intérprete local rellena sus huecos.
   *
   * Nunca al revés: si el modelo acierta una fecha concreta que el intérprete no
   * sabe leer, esa fecha se conserva. Y si el modelo se deja la ciudad, la
   * ciudad que estaba escrita en la frase no se pierde.
   */
  private combinar(modelo: SearchParams, local: InterpretacionLocal): SearchParams {
    const combinado: SearchParams = {
      vertical: modelo.vertical ?? local.vertical,
      ciudad: modelo.ciudad ?? local.ciudad,
      desde: modelo.desde ?? local.desde,
      hasta: modelo.hasta ?? local.hasta,
      presupuestoMax: modelo.presupuestoMax ?? local.presupuestoMax,
      pasajeros: modelo.pasajeros ?? local.pasajeros,
      extras: { ...local.extras, ...modelo.extras },
      explicacion: modelo.explicacion,
    };
    if (!combinado.explicacion) combinado.explicacion = this.explicar(combinado);
    return combinado;
  }

  /** Frase corta de confirmación cuando no hay modelo que la redacte. */
  private explicar(datos: Pick<SearchParams, 'vertical' | 'ciudad' | 'desde'>): string {
    if (!datos.vertical && !datos.ciudad) {
      return 'No hemos sabido concretar la búsqueda; ajusta los filtros.';
    }

    const categoria = datos.vertical ? VERTICAL_LABELS[datos.vertical] : 'Servicios';
    const donde = datos.ciudad ? ` en ${datos.ciudad}` : '';
    const cuando = datos.desde ? ` a partir del ${datos.desde}` : '';
    return `${categoria}${donde}${cuando}.`;
  }

  /**
   * Normaliza lo que devuelve el modelo.
   *
   * Antes se hacía `JSON.parse(content) as SearchParams`, y un aserto de tipo no
   * comprueba nada: si el modelo devolvía `ciudad` como objeto o
   * `presupuestoMax` como texto, ese valor viajaba al frontend y de ahí al
   * filtro del catálogo. Todo lo que no encaja se descarta a `null`, que es lo
   * que el buscador ya sabe tratar.
   */
  private sanear(crudo: Record<string, unknown>): SearchParams {
    return {
      vertical: this.comoVertical(crudo['vertical']),
      ciudad: this.comoTexto(crudo['ciudad']),
      desde: this.comoFecha(crudo['desde']),
      hasta: this.comoFecha(crudo['hasta']),
      presupuestoMax: this.comoNumero(crudo['presupuestoMax']),
      pasajeros: this.comoNumero(crudo['pasajeros']),
      extras: this.comoExtras(crudo['extras']),
      explicacion: this.comoTexto(crudo['explicacion']) ?? '',
    };
  }

  private comoVertical(valor: unknown): VerticalKey | null {
    const validos = Object.values(VerticalKey) as string[];
    return typeof valor === 'string' && validos.includes(valor) ? (valor as VerticalKey) : null;
  }

  private comoTexto(valor: unknown): string | null {
    return typeof valor === 'string' && valor.trim() ? valor.trim() : null;
  }

  /** Sólo `YYYY-MM-DD`: es el formato que consume el buscador. */
  private comoFecha(valor: unknown): string | null {
    const texto = this.comoTexto(valor);
    return texto && /^\d{4}-\d{2}-\d{2}$/.test(texto) ? texto : null;
  }

  private comoNumero(valor: unknown): number | null {
    return typeof valor === 'number' && Number.isFinite(valor) && valor >= 0 ? valor : null;
  }

  /** `extras` es un diccionario de texto a texto; lo demás se descarta. */
  private comoExtras(valor: unknown): Record<string, string> {
    if (!valor || typeof valor !== 'object' || Array.isArray(valor)) return {};

    return Object.fromEntries(
      Object.entries(valor as Record<string, unknown>)
        .filter(([, v]) => typeof v === 'string' && v.trim())
        .map(([k, v]) => [k, (v as string).trim()]),
    );
  }

}
