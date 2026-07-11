import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export interface SearchParams {
  vertical: 'alojamiento' | 'transporte' | 'veterinaria' | 'peluqueria' | 'adiestramiento' | null;
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
- alojamiento: alojamiento canino / residencias / hoteles para perros (reserva por noches, check-in/check-out)
- transporte: transporte de animales / traslados de mascotas de un punto A a un punto B
- veterinaria: clínicas veterinarias, consultas, vacunas, urgencias (cita con fecha)
- peluqueria: peluquerías caninas, baño, corte, grooming (cita con fecha)
- adiestramiento: adiestramiento y educación canina (sesiones o programas)

Responde SIEMPRE con un objeto JSON válido con esta estructura exacta (sin markdown, sin explicaciones fuera del JSON):
{
  "vertical": "alojamiento" | "transporte" | "veterinaria" | "peluqueria" | "adiestramiento" | null,
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

  async interpretSearch(query: string): Promise<SearchParams> {
    if (!this.apiKey) {
      return this.busquedaNoInterpretada('DEEPSEEK_API_KEY no configurada; usa el formulario.');
    }
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
      return JSON.parse(content) as SearchParams;
    } catch (error) {
      this.logger.error('Error al interpretar búsqueda con IA', error);
      return this.busquedaNoInterpretada(
        'No se pudo interpretar la búsqueda. Usa el formulario manualmente.',
      );
    }
  }

  /** Params vacíos para que el frontend siga mostrando el buscador manual. */
  private busquedaNoInterpretada(explicacion: string): SearchParams {
    return {
      vertical: null, ciudad: null, desde: null, hasta: null,
      presupuestoMax: null, pasajeros: null, extras: {},
      explicacion,
    };
  }
}
