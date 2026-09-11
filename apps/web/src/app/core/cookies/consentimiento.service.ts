import { Injectable, computed, inject, signal } from '@angular/core';
import { CookiesService } from '../plataforma/cookies.service';

/**
 * Familias de cookies, según las distingue la normativa europea.
 *
 * `necesarias` no está en la lista a propósito: mantener la sesión y recordar el
 * idioma es lo que el usuario pide al usar la web, y la ley no exige
 * consentimiento para eso. Lo que sí lo exige es todo lo demás.
 */
export type CategoriaCookies = 'preferencias' | 'analitica' | 'marketing';

export const CATEGORIAS_COOKIES: readonly CategoriaCookies[] = [
  'preferencias', 'analitica', 'marketing',
];

export interface Consentimiento {
  readonly preferencias: boolean;
  readonly analitica: boolean;
  readonly marketing: boolean;
  /** Cuándo se decidió, en ISO. Sirve para saber cuándo hay que volver a preguntar. */
  readonly fecha: string;
  /** Versión del texto aceptado: si cambia la política, hay que volver a preguntar. */
  readonly version: number;
}

const COOKIE = 'dk_consentimiento';

/**
 * Versión del texto de la política. **Subirla vuelve a preguntar a todo el
 * mundo**, y es lo que hay que hacer cuando se añade una herramienta nueva: el
 * consentimiento se dio para lo que había, no para lo que venga después.
 */
export const VERSION_CONSENTIMIENTO = 1;

/**
 * La AEPD considera que un consentimiento caduca a los 24 meses. Se usan 12
 * para ir por delante de la norma y porque en un año es probable que hayan
 * cambiado las herramientas.
 */
const DIAS_DE_VIGENCIA = 365;

const TODO_NO: Omit<Consentimiento, 'fecha' | 'version'> = {
  preferencias: false, analitica: false, marketing: false,
};

/**
 * Quién puede cargarse y quién no, mientras el visitante no decida.
 *
 * Antes de esto la web no preguntaba nada: cargaba Google Maps en las fichas y
 * los SDK de Google y Meta en las pantallas de acceso, que ponen cookies de
 * terceros en cuanto se ejecutan. Había política de cookies, pero ningún
 * mecanismo para aceptar, rechazar o configurar, que es justo lo que la
 * normativa exige **antes** de usarlas.
 *
 * Se guarda en cookie y no en `localStorage` porque el render de servidor
 * también tiene que saberlo: si no, el HTML saldría siempre como si nadie
 * hubiera consentido y la decisión del visitante sólo se aplicaría al hidratar.
 */
@Injectable({ providedIn: 'root' })
export class ConsentimientoService {
  private readonly cookies = inject(CookiesService);

  private readonly estado = signal<Consentimiento | null>(this.leer());

  /** `true` mientras el visitante no haya decidido: es cuando se enseña el banner. */
  readonly pendiente = computed(() => this.estado() === null);

  /** La decisión actual, o todo a `false` si aún no hay ninguna. */
  readonly decision = computed<Omit<Consentimiento, 'fecha' | 'version'>>(() => {
    const guardado = this.estado();
    if (!guardado) return TODO_NO;

    const { preferencias, analitica, marketing } = guardado;
    return { preferencias, analitica, marketing };
  });

  /** `true` si el visitante ha aceptado esa familia de cookies. */
  permite(categoria: CategoriaCookies): boolean {
    return this.decision()[categoria];
  }

  /** Acepta todo. Es una de las tres salidas del banner. */
  aceptarTodo(): void {
    this.guardar({ preferencias: true, analitica: true, marketing: true });
  }

  /**
   * Rechaza todo lo que no es imprescindible.
   *
   * Tiene que costar exactamente lo mismo que aceptar —un clic, en el mismo
   * sitio y con el mismo peso visual—: la AEPD considera que un "rechazar"
   * escondido detrás de un menú invalida el consentimiento de los que aceptan.
   */
  rechazarTodo(): void {
    this.guardar(TODO_NO);
  }

  /** Guarda una elección a medida desde el panel de configuración. */
  guardar(eleccion: Omit<Consentimiento, 'fecha' | 'version'>): void {
    const decision: Consentimiento = {
      ...eleccion,
      fecha: new Date().toISOString(),
      version: VERSION_CONSENTIMIENTO,
    };

    this.estado.set(decision);
    this.cookies.escribir(COOKIE, JSON.stringify(decision), DIAS_DE_VIGENCIA);
  }

  /**
   * Olvida la decisión y vuelve a preguntar.
   *
   * Retirar el consentimiento tiene que ser tan fácil como darlo, así que el pie
   * de página enlaza aquí.
   */
  reabrir(): void {
    this.estado.set(null);
    this.cookies.borrar(COOKIE);
  }

  private leer(): Consentimiento | null {
    const guardado = this.cookies.leer(COOKIE);
    if (!guardado) return null;

    try {
      const decision = JSON.parse(guardado) as Partial<Consentimiento>;

      // Un consentimiento dado sobre un texto anterior no vale para el nuevo:
      // se dio para las herramientas que había entonces.
      if (decision.version !== VERSION_CONSENTIMIENTO) return null;

      return {
        preferencias: decision.preferencias === true,
        analitica: decision.analitica === true,
        marketing: decision.marketing === true,
        fecha: decision.fecha ?? new Date().toISOString(),
        version: VERSION_CONSENTIMIENTO,
      };
    } catch {
      // Cookie manipulada o de un formato viejo: se vuelve a preguntar, que es
      // lo seguro. Dar por hecho que aceptó sería justo lo contrario.
      return null;
    }
  }
}
