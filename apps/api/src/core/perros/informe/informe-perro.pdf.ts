// `import ... from` a secas no vale: `pdfkit` exporta con `export =` y el API
// compila sin `esModuleInterop`, así que el import por defecto se resolvía a
// `undefined` y `new PDFDocument()` reventaba al generar el primer informe.
import PDFDocument = require('pdfkit');
import { existsSync, readFileSync } from 'fs';
import { join } from 'path';
import { AcentoSalud, DatoIdentidad, EntradaHistorial, InformePerro, SeccionSalud } from './informe-perro.tipos';

/**
 * Dibuja el informe de salud que el cliente se descarga.
 *
 * Es el documento que se lleva a otra clínica, así que se diseña como un
 * documento y no como un volcado: jerarquía clara, las alergias antes que la
 * dieta, y el historial en una línea de tiempo que se lee de arriba abajo.
 *
 * Sólo pinta. Los textos llegan ya resueltos desde `informe-perro.service`:
 * aquí no se traduce ningún enum ni se consulta ninguna colección.
 */

/** Paleta de marca (`apps/web/src/styles.scss`). El PDF es la marca en papel. */
const AZUL = '#08258B';
const AZUL_HONDO = '#00135D';
const ORO = '#FBAE17';
const TINTA = '#16203A';
const TINTA_SUAVE = '#5B6472';
const PAPEL_SUAVE = '#F4F6FA';
const BORDE = '#DDE3EF';
const ROJO = '#C0392B';
const ROJO_SUAVE = '#FDF0EE';

/** A4 en puntos, y el margen lateral del que cuelga todo el documento. */
const ANCHO = 595.28;
const ALTO = 841.89;
const MARGEN = 48;
const ANCHO_UTIL = ANCHO - MARGEN * 2;

/** Alto de la banda azul: completa en la portada, reducida en las siguientes. */
const CABECERA_PORTADA = 132;
const CABECERA_INTERIOR = 56;

/** Zona reservada al pie. Nada de contenido baja de aquí. */
const LIMITE_INFERIOR = ALTO - 64;

/** Color del punto de cada categoría en la línea de tiempo. */
const COLOR_VERTICAL: Record<string, string> = {
  veterinaria: '#0E7C66',
  peluqueria: '#8E44AD',
  adiestramiento: '#C77700',
  alojamiento: AZUL,
  transporte: '#1F6FB2',
};

const COLOR_ACENTO: Record<AcentoSalud, string> = {
  alerta: ROJO,
  aviso: ORO,
  neutro: AZUL,
};

/**
 * Logo de Doogking para fondo oscuro (texto blanco y dorado), el mismo del pie
 * de la web. Vive en `src/assets` y Nest lo copia a `dist/assets` al compilar
 * (`nest-cli.json`). Se lee una sola vez y lo reutilizan todos los informes.
 */
const RUTA_LOGO = join(__dirname, '..', '..', '..', 'assets', 'logo-doogking-oscuro.png');
/** Proporción del PNG (800 × 389): el alto sale del ancho sin deformarlo. */
const PROPORCION_LOGO = 389 / 800;
let logoEnMemoria: Buffer | null | undefined;

function logo(): Buffer | null {
  if (logoEnMemoria === undefined) {
    // Sin el fichero (un despliegue a medias) el informe sale igual, con la marca en texto.
    logoEnMemoria = existsSync(RUTA_LOGO) ? readFileSync(RUTA_LOGO) : null;
  }
  return logoEnMemoria;
}

/** El PDF completo en memoria. Un informe cabe de sobra; no merece un fichero temporal. */
export function construirInformePdf(datos: InformePerro): Promise<Buffer> {
  const doc = new PDFDocument({ size: 'A4', margin: MARGEN, bufferPages: true });
  const trozos: Buffer[] = [];

  doc.on('data', (trozo: Buffer) => trozos.push(trozo));
  const terminado = new Promise<Buffer>((resolver, rechazar) => {
    doc.on('end', () => resolver(Buffer.concat(trozos)));
    doc.on('error', rechazar);
  });

  pintarInforme(doc, datos);
  doc.end();

  return terminado;
}

type Documento = PDFKit.PDFDocument;

function pintarInforme(doc: Documento, datos: InformePerro): void {
  portada(doc, datos);
  doc.y = CABECERA_PORTADA + 28;

  rejillaIdentidad(doc, datos.identidad);
  rejillaIdentidad(doc, datos.propietario, 'Propietario');
  for (const seccion of datos.salud) bloqueSalud(doc, seccion);
  lineaDeTiempo(doc, datos.historial);
  avisoLegal(doc);
  pies(doc, datos);
}

// ── Cabeceras ────────────────────────────────────────────────────────────────

/** Banda azul con el logo, el nombre del animal y su monograma dorado. */
function portada(doc: Documento, datos: InformePerro): void {
  doc.rect(0, 0, ANCHO, CABECERA_PORTADA).fill(AZUL);
  doc.rect(0, CABECERA_PORTADA, ANCHO, 4).fill(ORO);

  const imagen = logo();
  const anchoLogo = 124;
  if (imagen) {
    doc.image(imagen, MARGEN - 8, (CABECERA_PORTADA - anchoLogo * PROPORCION_LOGO) / 2, { width: anchoLogo });
  } else {
    doc.font('Helvetica-Bold').fontSize(9).fillColor(ORO)
      .text('DOOGKING', MARGEN, 26, { characterSpacing: 3 });
  }

  const xTexto = imagen ? MARGEN + anchoLogo + 4 : MARGEN;
  const anchoTexto = ANCHO - MARGEN - 66 - xTexto;
  doc.font('Helvetica').fontSize(8).fillColor('#B9C4E4')
    .text('INFORME DE SALUD DE LA MASCOTA', xTexto, 30, { characterSpacing: 1.2, width: anchoTexto, lineBreak: false });
  if (datos.emisor) {
    doc.font('Helvetica-Bold').fontSize(8).fillColor(ORO)
      .text(`Emitido por ${datos.emisor}`, xTexto, 42, { width: anchoTexto, lineBreak: false, ellipsis: true });
  }

  doc.font('Helvetica-Bold').fontSize(24).fillColor('#FFFFFF')
    .text(datos.nombrePerro, xTexto, 60, { width: anchoTexto, lineBreak: false, ellipsis: true });
  doc.font('Helvetica').fontSize(10).fillColor('#C7D0EA')
    .text(datos.subtitulo, xTexto, 94, { width: anchoTexto, lineBreak: false, ellipsis: true });

  monograma(doc, datos.nombrePerro);
}

/** Inicial del perro en un círculo dorado, a la derecha de la banda. */
function monograma(doc: Documento, nombre: string): void {
  const centroX = ANCHO - MARGEN - 27;
  const centroY = 66;

  doc.circle(centroX, centroY, 27).fill(ORO);
  doc.font('Helvetica-Bold').fontSize(26).fillColor(AZUL_HONDO)
    .text((nombre.trim()[0] ?? '?').toUpperCase(), centroX - 27, centroY - 13, {
      width: 54, align: 'center',
    });
}

/** Banda estrecha de las páginas siguientes: recuerda de quién es el documento. */
function cabeceraInterior(doc: Documento, nombre: string): void {
  doc.rect(0, 0, ANCHO, CABECERA_INTERIOR).fill(AZUL);
  doc.rect(0, CABECERA_INTERIOR, ANCHO, 3).fill(ORO);

  const imagen = logo();
  const anchoLogo = 92;
  if (imagen) {
    doc.image(imagen, ANCHO - MARGEN - anchoLogo + 8, (CABECERA_INTERIOR - anchoLogo * PROPORCION_LOGO) / 2, { width: anchoLogo });
  } else {
    doc.font('Helvetica-Bold').fontSize(8).fillColor(ORO)
      .text('DOOGKING', MARGEN, 20, { characterSpacing: 2.4 });
  }
  doc.font('Helvetica-Bold').fontSize(12).fillColor('#FFFFFF')
    .text(`Informe de salud · ${nombre}`, MARGEN, 22, { width: ANCHO_UTIL - anchoLogo, lineBreak: false, ellipsis: true });
}

// ── Secciones ────────────────────────────────────────────────────────────────

/** Título de sección: versalitas azules sobre una regla fina. */
function tituloSeccion(doc: Documento, texto: string): void {
  asegurarEspacio(doc, 46);
  const y = doc.y;

  doc.font('Helvetica-Bold').fontSize(9).fillColor(AZUL)
    .text(texto.toUpperCase(), MARGEN, y, { characterSpacing: 1.6 });
  doc.moveTo(MARGEN, doc.y + 4).lineTo(ANCHO - MARGEN, doc.y + 4).lineWidth(0.8).stroke(BORDE);
  doc.y += 14;
}

/**
 * Rejilla de identificación en tres columnas sobre fondo suave. Es lo que un
 * tercero necesita para saber de qué animal habla el resto del documento.
 */
function rejillaIdentidad(doc: Documento, datos: ReadonlyArray<DatoIdentidad>, titulo = 'Identificación'): void {
  if (!datos.length) return;
  tituloSeccion(doc, titulo);

  const columnas = 3;
  const anchoCelda = ANCHO_UTIL / columnas;
  const filas = Math.ceil(datos.length / columnas);
  const alto = filas * 34 + 12;

  asegurarEspacio(doc, alto);
  const arriba = doc.y;
  doc.roundedRect(MARGEN, arriba, ANCHO_UTIL, alto, 6).fill(PAPEL_SUAVE);

  datos.forEach((dato, indice) => {
    const x = MARGEN + (indice % columnas) * anchoCelda + 12;
    const y = arriba + Math.floor(indice / columnas) * 34 + 10;
    celdaIdentidad(doc, dato, x, y, anchoCelda - 20);
  });

  doc.y = arriba + alto + 18;
}

function celdaIdentidad(doc: Documento, dato: DatoIdentidad, x: number, y: number, ancho: number): void {
  doc.font('Helvetica').fontSize(7).fillColor(TINTA_SUAVE)
    .text(dato.etiqueta.toUpperCase(), x, y, { width: ancho, characterSpacing: 0.8, lineBreak: false });
  doc.font('Helvetica-Bold').fontSize(10).fillColor(TINTA)
    .text(dato.valor, x, y + 11, { width: ancho, lineBreak: false, ellipsis: true });
}

/**
 * Un apartado de salud. Las alergias y la medicación van en rojo y sobre fondo
 * propio: son lo primero que hay que ver si el animal llega de urgencia.
 */
function bloqueSalud(doc: Documento, seccion: SeccionSalud): void {
  const color = COLOR_ACENTO[seccion.acento];
  const cuerpo = seccion.items.join('   ·   ');
  const altoTexto = doc.font('Helvetica').fontSize(10).heightOfString(cuerpo, { width: ANCHO_UTIL - 32 });

  asegurarEspacio(doc, altoTexto + 46);
  const arriba = doc.y;
  const alto = altoTexto + 34;

  if (seccion.acento === 'alerta') {
    doc.roundedRect(MARGEN, arriba, ANCHO_UTIL, alto, 6).fill(ROJO_SUAVE);
  }
  doc.rect(MARGEN, arriba, 3, alto).fill(color);

  doc.font('Helvetica-Bold').fontSize(9).fillColor(color)
    .text(seccion.titulo.toUpperCase(), MARGEN + 14, arriba + 10, { characterSpacing: 1.2 });
  doc.font('Helvetica').fontSize(10).fillColor(TINTA)
    .text(cuerpo, MARGEN + 14, arriba + 23, { width: ANCHO_UTIL - 32 });

  doc.y = arriba + alto + 10;
}

// ── Línea de tiempo del historial ────────────────────────────────────────────

function lineaDeTiempo(doc: Documento, entradas: ReadonlyArray<EntradaHistorial>): void {
  doc.y += 8;
  // El título no se queda huérfano al pie de una página: baja con la primera anotación.
  if (entradas.length) {
    asegurarEspacio(doc, 46 + altoEntrada(doc, entradas[0], ANCHO - MARGEN * 2 - 92) + 12);
  }
  tituloSeccion(doc, 'Historial de servicios');

  if (!entradas.length) {
    doc.font('Helvetica-Oblique').fontSize(10).fillColor(TINTA_SUAVE)
      .text('Todavía no hay anotaciones de profesionales en la ficha.', MARGEN, doc.y);
    doc.y += 18;
    return;
  }

  entradas.forEach((entrada, indice) =>
    entradaDeHistorial(doc, entrada, indice === entradas.length - 1),
  );
}

/** Columna de fecha a la izquierda, punto de color, y la anotación a la derecha. */
function entradaDeHistorial(doc: Documento, entrada: EntradaHistorial, esUltima: boolean): void {
  const xTexto = MARGEN + 92;
  const anchoTexto = ANCHO - MARGEN - xTexto;
  const alto = altoEntrada(doc, entrada, anchoTexto);

  asegurarEspacio(doc, alto + 12);
  const arriba = doc.y;
  const color = COLOR_VERTICAL[entrada.vertical] ?? AZUL;

  doc.font('Helvetica-Bold').fontSize(9).fillColor(TINTA)
    .text(entrada.fecha, MARGEN, arriba + 1, { width: 66, lineBreak: false });
  doc.circle(MARGEN + 78, arriba + 6, 4).fill(color);
  // El hilo une un punto con el siguiente: bajo el último no une nada y se veía
  // como un cabo suelto colgando del final del historial.
  if (!esUltima) {
    doc.moveTo(MARGEN + 78, arriba + 14).lineTo(MARGEN + 78, arriba + alto + 6)
      .lineWidth(1).stroke(BORDE);
  }

  cuerpoEntrada(doc, entrada, xTexto, arriba, anchoTexto, color);
  doc.y = arriba + alto + 12;
}

function cuerpoEntrada(
  doc: Documento,
  entrada: EntradaHistorial,
  x: number,
  y: number,
  ancho: number,
  color: string,
): void {
  doc.font('Helvetica-Bold').fontSize(9).fillColor(color)
    .text(entrada.categoria, x, y, { width: ancho, lineBreak: false });
  doc.font('Helvetica').fontSize(8).fillColor(TINTA_SUAVE)
    .text(entrada.profesional, x, y + 11, { width: ancho, lineBreak: false, ellipsis: true });
  doc.y = y + 24;
  if (entrada.titulo) {
    doc.font('Helvetica-Bold').fontSize(11).fillColor(TINTA).text(entrada.titulo, x, doc.y, { width: ancho });
  }
  if (entrada.nota) {
    doc.font('Helvetica').fontSize(10).fillColor(TINTA)
      .text(entrada.nota, x, doc.y + (entrada.titulo ? 2 : 0), { width: ancho });
  }

  for (const detalle of entrada.detalles) {
    doc.font('Helvetica-Bold').fontSize(9).fillColor(TINTA_SUAVE)
      .text(`${detalle.etiqueta}: `, x, doc.y + 2, { continued: true })
      .font('Helvetica').fillColor(TINTA).text(detalle.valor, { width: ancho });
  }
}

/** Lo que va a ocupar la entrada, para decidir si cabe antes de empezar a pintarla. */
function altoEntrada(doc: Documento, entrada: EntradaHistorial, ancho: number): number {
  const titulo = entrada.titulo
    ? doc.font('Helvetica-Bold').fontSize(11).heightOfString(entrada.titulo, { width: ancho })
    : 0;
  const nota = titulo + (entrada.nota
    ? doc.font('Helvetica').fontSize(10).heightOfString(entrada.nota, { width: ancho }) + 2
    : 0);
  const detalles = entrada.detalles.reduce(
    (total, detalle) =>
      total + doc.font('Helvetica').fontSize(9)
        .heightOfString(`${detalle.etiqueta}: ${detalle.valor}`, { width: ancho }) + 2,
    0,
  );

  return 24 + nota + detalles;
}

// ── Cierre ───────────────────────────────────────────────────────────────────

/**
 * Lo que este documento no es. Va dentro del PDF y no en la pantalla de
 * descarga porque el papel viaja solo: quien lo lea en otra clínica no ha visto
 * la aplicación.
 */
function avisoLegal(doc: Documento): void {
  asegurarEspacio(doc, 56);
  doc.y += 10;
  const arriba = doc.y;

  doc.roundedRect(MARGEN, arriba, ANCHO_UTIL, 44, 6).fill(PAPEL_SUAVE);
  doc.font('Helvetica').fontSize(8).fillColor(TINTA_SUAVE)
    .text(
      'Documento generado automáticamente con la información registrada en Doogking por su '
      + 'propietario y por los profesionales que han atendido al animal. No sustituye a un '
      + 'informe clínico firmado por un veterinario colegiado.',
      MARGEN + 12, arriba + 11, { width: ANCHO_UTIL - 24, align: 'left' },
    );

  doc.y = arriba + 54;
}

/**
 * Pie y cabecera de continuación, al final y de una vez.
 *
 * Tiene que ser aquí: "página 2 de 5" no se puede escribir hasta saber cuántas
 * páginas hay, y eso sólo se sabe cuando el contenido ya está pintado.
 */
function pies(doc: Documento, datos: InformePerro): void {
  const paginas = doc.bufferedPageRange();

  for (let indice = 0; indice < paginas.count; indice += 1) {
    doc.switchToPage(paginas.start + indice);
    // El pie va por debajo del margen inferior, y PDFKit abre página nueva en
    // cuanto un texto cruza ese margen: sin bajarlo, escribir los pies añadía
    // una página en blanco por cada página del informe.
    doc.page.margins.bottom = 0;
    if (indice > 0) cabeceraInterior(doc, datos.nombrePerro);

    doc.font('Helvetica').fontSize(7.5).fillColor(TINTA_SUAVE)
      .text(`doogking.com  ·  Emitido el ${datos.emitidoEl}`, MARGEN, ALTO - 42, {
        width: ANCHO_UTIL / 2, lineBreak: false,
      });
    doc.font('Helvetica').fontSize(7.5).fillColor(TINTA_SUAVE)
      .text(`Página ${indice + 1} de ${paginas.count}`, ANCHO / 2, ALTO - 42, {
        width: ANCHO_UTIL / 2, align: 'right', lineBreak: false,
      });
  }
}

/**
 * Abre página si lo siguiente no cabe entero.
 *
 * Sin esto PDFKit parte el bloque por la mitad —el título de una sección en una
 * página y su contenido en la siguiente— o pinta encima del pie, porque los
 * rectángulos de fondo no participan del flujo de texto que él gestiona solo.
 */
function asegurarEspacio(doc: Documento, alto: number): void {
  if (doc.y + alto <= LIMITE_INFERIOR) return;

  doc.addPage();
  doc.y = CABECERA_INTERIOR + 24;
}
