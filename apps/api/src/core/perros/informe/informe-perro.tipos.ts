/**
 * El informe ya resuelto: textos listos para pintar, sin documentos de Mongo ni
 * enums que traducir. Separa el "qué dice el informe" del "cómo se dibuja", que
 * son las dos mitades del módulo (`informe-perro.service` y `informe-perro.pdf`).
 */

/** Un dato de la ficha, tal y como aparece en la rejilla de identificación. */
export interface DatoIdentidad {
  readonly etiqueta: string;
  readonly valor: string;
}

/**
 * Tono de una sección de salud. No es decoración: el veterinario de urgencias
 * que abre el PDF tiene que encontrar las alergias antes que la dieta.
 */
export type AcentoSalud = 'alerta' | 'aviso' | 'neutro';

export interface SeccionSalud {
  readonly titulo: string;
  readonly items: readonly string[];
  readonly acento: AcentoSalud;
}

/** Una anotación del historial, con su autor y su fecha ya formateados. */
export interface EntradaHistorial {
  readonly fecha: string;
  readonly categoria: string;
  readonly vertical: string;
  /** Qué se hizo ("Vacunación"). Vacío en las notas antiguas, que sólo tenían texto. */
  readonly titulo?: string;
  readonly profesional: string;
  readonly nota: string;
  readonly detalles: ReadonlyArray<DatoIdentidad>;
}

export interface InformePerro {
  readonly nombrePerro: string;
  /** Línea bajo el nombre: raza, sexo y edad, lo que identifica al animal de un vistazo. */
  readonly subtitulo: string;
  readonly emitidoEl: string;
  /** Negocio que emite el informe desde su panel; sin él, lo emite Doogking para el dueño. */
  readonly emisor?: string;
  readonly identidad: ReadonlyArray<DatoIdentidad>;
  /** Contacto del dueño: sólo en el informe que saca el comercio. */
  readonly propietario: ReadonlyArray<DatoIdentidad>;
  readonly salud: ReadonlyArray<SeccionSalud>;
  readonly historial: ReadonlyArray<EntradaHistorial>;
}
