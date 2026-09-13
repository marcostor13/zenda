import { Injectable } from '@nestjs/common';
import PDFDocument = require('pdfkit');
import {
  VACUNA_LABELS, VERTICAL_LABELS, Vacuna, VerticalKey, camposDeRegistro, nombreTamanoPerro,
} from 'shared';
import { DatosInforme, RegistroExpediente, ServicioExpediente } from './expediente.types';

type Documento = PDFKit.PDFDocument;

/*
 * Colores de marca Doogking. El PDF no pasa por la hoja de estilos de la web,
 * así que los tokens se repiten aquí: son los de `--dk-blue`, `--dk-gold`…
 */
const AZUL = '#08258B';
const AZUL_OSCURO = '#00135D';
const DORADO = '#FBAE17';
const TEXTO = '#1F2937';
const GRIS = '#6B7280';
const LINEA = '#E5E7EB';
const FONDO_SUAVE = '#F3F5FB';

const MARGEN = 48;
const ANCHO_ETIQUETA = 150;

const ESTADOS_RESERVA: Record<string, string> = {
  confirmada: 'Confirmada', en_curso: 'En curso', completada: 'Completada', no_show: 'No presentado',
  ajuste_solicitado: 'Ajuste solicitado', pago_retenido: 'Completada', pago_liberado: 'Completada',
  en_disputa: 'En disputa', cancelada: 'Cancelada', pendiente: 'Pendiente', reembolsada: 'Reembolsada',
};

/**
 * Informe PDF del expediente de una mascota: ficha, salud, comportamiento y el
 * historial de servicios con lo que anotó cada profesional.
 *
 * Se genera en el servidor con pdfkit (sin navegador) para que el archivo sea
 * idéntico en la web y en la app móvil, donde imprimir la página no es opción.
 * Las fuentes estándar de PDF cubren el castellano; por eso el texto evita
 * símbolos fuera de Latin-1 (flechas, emojis).
 */
@Injectable()
export class InformePdfService {
  generar(datos: DatosInforme): Promise<Buffer> {
    const doc = new PDFDocument({ size: 'A4', margin: MARGEN, bufferPages: true, info: this.metadatos(datos) });
    const trozos: Buffer[] = [];
    const terminado = new Promise<Buffer>((resolver, rechazar) => {
      doc.on('data', (trozo: Buffer) => trozos.push(trozo));
      doc.on('end', () => resolver(Buffer.concat(trozos)));
      doc.on('error', rechazar);
    });

    this.componer(doc, datos);
    this.numerarPaginas(doc);
    doc.end();
    return terminado;
  }

  private metadatos(datos: DatosInforme) {
    const nombre = String(datos.expediente.perro['nombre'] ?? '');
    return { Title: `Historial de ${nombre}`, Author: datos.emisor, Creator: 'Doogking' };
  }

  private componer(doc: Documento, datos: DatosInforme): void {
    const { expediente } = datos;
    this.cabecera(doc, datos);
    this.seccionMascota(doc, expediente.perro);
    if (datos.destinatario === 'comercio' && expediente.propietario) {
      this.seccion(doc, 'Propietario');
      this.filas(doc, [
        ['Nombre', expediente.propietario.nombre],
        ['Email', expediente.propietario.email],
        ['Teléfono', expediente.propietario.telefono],
      ]);
    }
    this.seccionSalud(doc, expediente.perro);
    this.seccionComportamiento(doc, expediente.perro);
    this.seccionRegistros(doc, expediente.registros);
    this.seccionServicios(doc, expediente.servicios);
  }

  // ── Bloques ────────────────────────────────────────────────────────────────

  private cabecera(doc: Documento, datos: DatosInforme): void {
    const ancho = doc.page.width;
    doc.rect(0, 0, ancho, 96).fill(AZUL);
    doc.rect(0, 96, ancho, 4).fill(DORADO);
    doc.fillColor('#FFFFFF').font('Helvetica-Bold').fontSize(20).text('DOOGKING', MARGEN, 30);
    doc.font('Helvetica').fontSize(9).fillColor('#DCE3FF').text('TODO PARA SU REY, EN UN SOLO LUGAR', MARGEN, 56);
    doc.font('Helvetica').fontSize(9).fillColor('#FFFFFF')
      .text(`Emitido por ${datos.emisor}`, MARGEN, 34, { align: 'right', width: ancho - MARGEN * 2 })
      .text(`Fecha: ${fecha(new Date())}`, MARGEN, 50, { align: 'right', width: ancho - MARGEN * 2 });

    const nombre = String(datos.expediente.perro['nombre'] ?? 'Mascota');
    doc.fillColor(AZUL_OSCURO).font('Helvetica-Bold').fontSize(18).text(`Historial de ${nombre}`, MARGEN, 124);
    doc.fillColor(GRIS).font('Helvetica').fontSize(9)
      .text('Ficha de la mascota e historial de servicios registrados en Doogking.');
    doc.moveDown(0.5);
  }

  private seccionMascota(doc: Documento, perro: Record<string, unknown>): void {
    this.seccion(doc, 'Datos de la mascota');
    this.filas(doc, [
      ['Raza', perro['raza'] ? String(perro['raza']) : perro['esMestizo'] ? 'Mestizo' : undefined],
      ['Sexo', perro['sexo'] === 'macho' ? 'Macho' : perro['sexo'] === 'hembra' ? 'Hembra' : undefined],
      ['Fecha de nacimiento', perro['fechaNacimiento'] ? `${fecha(perro['fechaNacimiento'])} (${edad(perro['fechaNacimiento'])})` : undefined],
      ['Peso', perro['peso'] != null ? `${numero(perro['peso'])} kg` : undefined],
      ['Tamaño', perro['tamano'] ? nombreTamanoPerro(String(perro['tamano'])) : undefined],
      ['Esterilizado', siNo(perro['esterilizado'])],
      ['Microchip', texto(perro['microchip'])],
      ['Ciudad', texto(perro['ciudad'])],
    ]);
  }

  private seccionSalud(doc: Documento, perro: Record<string, unknown>): void {
    this.seccion(doc, 'Salud');
    this.filas(doc, [
      ['Vacunas', vacunas(perro)],
      ['Alergias', lista(perro['alergias'])],
      ['Enfermedades', lista(perro['enfermedades'])],
      ['Medicación', lista(perro['medicacion'])],
      ['Dieta', texto(perro['dieta'])],
    ], 'Sin datos de salud registrados por el propietario.');
  }

  private seccionComportamiento(doc: Documento, perro: Record<string, unknown>): void {
    const rasgos = [
      perro['ansiedadSeparacion'] && 'Ansiedad por separación',
      perro['reactividadCorrea'] && 'Reactivo con correa',
      perro['protectorRecursos'] && 'Protector de recursos',
      perro['tendenciaEscapar'] && 'Tiende a escaparse',
      perro['seMarea'] && 'Se marea en viajes',
    ].filter(Boolean).join(', ');

    this.seccion(doc, 'Comportamiento');
    this.filas(doc, [
      ['Temperamento', texto(perro['temperamento'])],
      ['Con otros perros', texto(perro['sociabilidadPerros'])],
      ['Con personas', texto(perro['sociabilidadPersonas'])],
      ['Miedos', lista(perro['miedos'])],
      ['A tener en cuenta', rasgos || undefined],
    ], 'Sin datos de comportamiento registrados.');
  }

  private seccionRegistros(doc: Documento, registros: RegistroExpediente[]): void {
    this.seccion(doc, `Historial de servicios (${registros.length})`);
    if (!registros.length) {
      this.vacio(doc, 'Todavía no hay registros de profesionales.');
      return;
    }
    registros.forEach((registro) => this.registro(doc, registro));
  }

  private registro(doc: Documento, r: RegistroExpediente): void {
    this.asegurarEspacio(doc, 90);
    const y = doc.y;
    doc.rect(MARGEN, y, 3, 14).fill(DORADO);
    doc.fillColor(AZUL_OSCURO).font('Helvetica-Bold').fontSize(11)
      .text(r.titulo || r.nota, MARGEN + 10, y, { width: this.anchoUtil(doc) - 10 });
    const meta = [fecha(r.fechaServicio ?? r.createdAt), etiquetaVertical(r.vertical), r.comercioNombre, r.profesional]
      .filter(Boolean).join('  |  ');
    doc.fillColor(GRIS).font('Helvetica').fontSize(8.5).text(meta, MARGEN + 10);
    doc.moveDown(0.3);

    const filas: Array<[string, string | undefined]> = camposDeRegistro(r.vertical).map((campo) => {
      const valor = r.datosEstructurados[campo.clave];
      return [campo.etiqueta, valor == null || valor === '' ? undefined : `${numero(valor)}${campo.unidad ? ` ${campo.unidad}` : ''}`];
    });
    if (r.nota && r.nota !== r.titulo) filas.push(['Observaciones', r.nota]);
    if (r.proximaCita) filas.push(['Próxima cita', fecha(r.proximaCita)]);
    this.filas(doc, filas);
    doc.moveTo(MARGEN, doc.y).lineTo(doc.page.width - MARGEN, doc.y).strokeColor(LINEA).lineWidth(0.5).stroke();
    doc.moveDown(0.6);
  }

  private seccionServicios(doc: Documento, servicios: ServicioExpediente[]): void {
    this.seccion(doc, `Reservas (${servicios.length})`);
    if (!servicios.length) {
      this.vacio(doc, 'Sin reservas registradas.');
      return;
    }
    for (const s of servicios) {
      this.asegurarEspacio(doc, 30);
      const titulo = [s.servicioTitulo ?? etiquetaVertical(s.vertical), s.comercioNombre].filter(Boolean).join(' - ');
      doc.fillColor(TEXTO).font('Helvetica-Bold').fontSize(9.5).text(titulo, MARGEN, doc.y, { width: this.anchoUtil(doc) });
      doc.fillColor(GRIS).font('Helvetica').fontSize(8.5)
        .text(`${fecha(s.fechaInicio)}  |  ${ESTADOS_RESERVA[s.estado] ?? s.estado}  |  ${s.codigo}`);
      doc.moveDown(0.4);
    }
  }

  // ── Primitivas ─────────────────────────────────────────────────────────────

  private seccion(doc: Documento, titulo: string): void {
    this.asegurarEspacio(doc, 60);
    doc.moveDown(0.6);
    const y = doc.y;
    doc.rect(MARGEN, y, this.anchoUtil(doc), 22).fill(FONDO_SUAVE);
    doc.fillColor(AZUL).font('Helvetica-Bold').fontSize(10.5).text(titulo.toUpperCase(), MARGEN + 10, y + 6);
    doc.y = y + 30;
  }

  /** Pares etiqueta/valor en dos columnas; las filas sin valor no se pintan. */
  private filas(doc: Documento, filas: Array<[string, string | undefined]>, siVacio?: string): void {
    const conValor = filas.filter(([, valor]) => valor);
    if (!conValor.length) {
      if (siVacio) this.vacio(doc, siVacio);
      return;
    }
    const anchoValor = this.anchoUtil(doc) - ANCHO_ETIQUETA - 10;
    for (const [etiqueta, valor] of conValor) {
      doc.font('Helvetica').fontSize(9.5);
      const alto = Math.max(doc.heightOfString(valor!, { width: anchoValor }), 12);
      this.asegurarEspacio(doc, alto + 6);
      const y = doc.y;
      doc.fillColor(GRIS).text(etiqueta, MARGEN + 10, y, { width: ANCHO_ETIQUETA });
      doc.fillColor(TEXTO).text(valor!, MARGEN + 10 + ANCHO_ETIQUETA, y, { width: anchoValor });
      doc.y = y + alto + 4;
    }
  }

  private vacio(doc: Documento, mensaje: string): void {
    doc.fillColor(GRIS).font('Helvetica-Oblique').fontSize(9).text(mensaje, MARGEN + 10, doc.y);
    doc.moveDown(0.4);
  }

  private asegurarEspacio(doc: Documento, alto: number): void {
    if (doc.y + alto > doc.page.height - MARGEN - 20) doc.addPage();
  }

  private anchoUtil(doc: Documento): number {
    return doc.page.width - MARGEN * 2;
  }

  private numerarPaginas(doc: Documento): void {
    const { start, count } = doc.bufferedPageRange();
    for (let i = start; i < start + count; i++) {
      doc.switchToPage(i);
      const y = doc.page.height - MARGEN + 10;
      // Sin margen inferior mientras se escribe el pie: si no, pdfkit crea una página nueva.
      const margenInferior = doc.page.margins.bottom;
      doc.page.margins.bottom = 0;
      doc.fillColor(GRIS).font('Helvetica').fontSize(8)
        .text(`doogking.com  |  Página ${i + 1} de ${count}`, MARGEN, y, { align: 'center', width: this.anchoUtil(doc) });
      doc.page.margins.bottom = margenInferior;
    }
  }
}

// ── Formato ──────────────────────────────────────────────────────────────────

function fecha(valor: unknown): string {
  if (!valor) return '';
  const d = new Date(valor as string);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'Europe/Madrid' });
}

function edad(valor: unknown): string {
  const meses = (Date.now() - new Date(valor as string).getTime()) / (30.44 * 24 * 3600 * 1000);
  if (!Number.isFinite(meses) || meses < 0) return '';
  return meses < 12 ? `${Math.max(1, Math.round(meses))} meses` : `${Math.floor(meses / 12)} años`;
}

/** Los decimales con coma, como se escriben en un informe en castellano. */
function numero(valor: unknown): string {
  return typeof valor === 'number' ? valor.toLocaleString('es-ES', { maximumFractionDigits: 2 }) : String(valor);
}

function texto(valor: unknown): string | undefined {
  return typeof valor === 'string' && valor.trim() ? valor.trim() : undefined;
}

function lista(valor: unknown): string | undefined {
  return Array.isArray(valor) && valor.length ? valor.join(', ') : undefined;
}

function siNo(valor: unknown): string | undefined {
  return typeof valor === 'boolean' ? (valor ? 'Sí' : 'No') : undefined;
}

function vacunas(perro: Record<string, unknown>): string | undefined {
  const detalle = (perro['vacunasDetalle'] as Array<{ tipo: Vacuna; fecha?: Date }> | undefined) ?? [];
  const nombres = detalle.map((v) => `${VACUNA_LABELS[v.tipo] ?? v.tipo}${v.fecha ? ` (${fecha(v.fecha)})` : ''}`);
  const libres = (perro['vacunas'] as string[] | undefined) ?? [];
  return lista([...nombres, ...libres]);
}

function etiquetaVertical(vertical: string): string {
  return VERTICAL_LABELS[vertical as VerticalKey] ?? vertical;
}
