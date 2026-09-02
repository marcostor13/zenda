import { Injectable, computed, signal } from '@angular/core';
import {
  IDIOMAS_SOPORTADOS, IDIOMA_DEFAULT, IdiomaSoportado, idiomaUi, normalizarIdioma,
} from 'shared';
import type { Diccionario, ParametrosTraduccion } from './diccionario';

const CLAVE_IDIOMA = 'doogking_idioma';

/**
 * Diccionarios de los idiomas de destino. El español no tiene diccionario: es
 * el idioma fuente y su texto **es** la clave, así que se devuelve tal cual.
 *
 * Cada uno se descarga como chunk aparte y sólo el que el usuario use.
 */
const CARGADORES: Record<Exclude<IdiomaSoportado, 'es'>, () => Promise<{ default: Diccionario }>> = {
  en: () => import('./traducciones/en'),
  de: () => import('./traducciones/de'),
  fr: () => import('./traducciones/fr'),
  it: () => import('./traducciones/it'),
  pt: () => import('./traducciones/pt'),
  pl: () => import('./traducciones/pl'),
  nl: () => import('./traducciones/nl'),
};

/**
 * Idioma de la interfaz. Traducción **en tiempo de ejecución**: cambiar de
 * idioma no recarga la página ni pierde el estado del wizard de reserva, del
 * carrito o de los filtros, que es justo lo que pasaría con un bundle por
 * idioma (`@angular/localize`).
 *
 * **La clave es el propio texto español.** Con más de dos mil cadenas en la
 * plataforma, inventar y mantener un identificador para cada una costaba más
 * que traducirlas, y cualquier renombrado dejaba la pantalla escribiendo
 * `panel.comercio.tituloX`. Así la plantilla se lee igual que antes, la
 * extracción es mecánica y **lo que aún no está traducido sale en español**:
 * añadir idiomas no puede romper una pantalla que ya funcionaba.
 */
@Injectable({ providedIn: 'root' })
export class I18nService {
  readonly idiomas = IDIOMAS_SOPORTADOS;

  readonly idioma = signal<IdiomaSoportado>(this.leerIdioma());

  /** Ficha del idioma activo (nombre nativo, locale, bandera) para la cabecera. */
  readonly ficha = computed(() => idiomaUi(this.idioma()));

  /**
   * Diccionarios ya descargados. Es una signal porque `t()` la lee: cuando
   * termina la descarga de un idioma, todo lo que esté traducido en pantalla se
   * repinta solo sin que nadie tenga que suscribirse a nada.
   */
  private readonly cargados = signal<Partial<Record<IdiomaSoportado, Diccionario>>>({});

  /**
   * Arranque: deja listo el diccionario guardado antes de pintar nada, para que
   * un usuario en alemán no vea un fogonazo de español. Si la descarga falla la
   * aplicación arranca igual, en español — nunca se queda bloqueada por esto.
   */
  async iniciar(): Promise<void> {
    this.aplicarLangDelDocumento(this.idioma());
    await this.cargar(this.idioma());
  }

  /**
   * Traduce el texto español recibido. Si el idioma activo no lo tiene
   * traducido —o es el propio español— devuelve el original.
   *
   * Lee la signal `idioma()`, así que cualquier plantilla que llame aquí queda
   * suscrita al cambio de idioma sin necesidad de `ChangeDetectorRef`.
   */
  t(textoEs: string, params?: ParametrosTraduccion | null): string {
    const texto = this.cargados()[this.idioma()]?.[textoEs] ?? textoEs;
    return params ? interpolar(texto, params) : texto;
  }

  /** Cambia el idioma de la interfaz y lo recuerda para la próxima visita. */
  async elegirIdioma(codigo: IdiomaSoportado): Promise<void> {
    // La segunda condición importa: el idioma puede venir ya fijado desde
    // `localStorage` con su diccionario aún sin descargar (o con la descarga
    // fallida). Salir sin más dejaría la interfaz en español para siempre.
    if (codigo === this.idioma() && this.tieneDiccionario(codigo)) return;

    // El diccionario primero: cambiar la signal antes de tenerlo dejaría la
    // pantalla en español un instante, que es peor que tardar 50 ms más.
    await this.cargar(codigo);
    if (codigo === this.idioma()) return;

    this.idioma.set(codigo);
    this.aplicarLangDelDocumento(codigo);
    try {
      localStorage.setItem(CLAVE_IDIOMA, codigo);
    } catch {
      // Navegación privada o almacenamiento lleno: el idioma vale para esta
      // sesión aunque no se pueda recordar para la siguiente.
    }
  }

  /** El español no necesita diccionario: su texto ya es la clave. */
  private tieneDiccionario(codigo: IdiomaSoportado): boolean {
    return codigo === IDIOMA_DEFAULT || !!this.cargados()[codigo];
  }

  private async cargar(codigo: IdiomaSoportado): Promise<void> {
    if (this.tieneDiccionario(codigo)) return;

    try {
      const modulo = await CARGADORES[codigo as Exclude<IdiomaSoportado, 'es'>]();
      this.cargados.update((actuales) => ({ ...actuales, [codigo]: modulo.default }));
    } catch {
      // Sin diccionario se sigue viendo el español: un fallo de red al
      // descargar un chunk no puede dejar la aplicación en blanco.
    }
  }

  /**
   * `<html lang>` es lo que usan lectores de pantalla, el traductor del
   * navegador y los buscadores para saber en qué idioma está la página.
   */
  private aplicarLangDelDocumento(codigo: IdiomaSoportado): void {
    document.documentElement.setAttribute('lang', codigo);
  }

  /**
   * Elección guardada → idioma del navegador → español. El navegador sólo se
   * consulta la primera vez: una vez que el usuario elige, manda su elección
   * aunque viaje a otro país con otro dispositivo.
   */
  private leerIdioma(): IdiomaSoportado {
    let guardado: string | null = null;
    try {
      guardado = localStorage.getItem(CLAVE_IDIOMA);
    } catch {
      guardado = null;
    }

    return normalizarIdioma(guardado)
      ?? normalizarIdioma(navigator.language)
      ?? IDIOMA_DEFAULT;
  }
}

/** Sustituye `{nombre}` por el valor correspondiente. */
function interpolar(texto: string, params: ParametrosTraduccion): string {
  return texto.replace(/\{(\w+)\}/g, (coincidencia, nombre: string) =>
    nombre in params ? String(params[nombre]) : coincidencia,
  );
}
