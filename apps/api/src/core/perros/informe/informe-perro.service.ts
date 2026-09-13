import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import {
  HISTORIAL_ORIGEN, TIPO_HISTORIAL_LABELS, TipoHistorial, VACUNA_LABELS, Vacuna,
  nombreTamanoPerro,
} from 'shared';
import { Comercio, ComercioDocument } from '../../comercios/comercio.schema';
import { PerroDocument } from '../perro.schema';
import { PerroHistorialDocument } from '../perro-historial.schema';
import { PerrosService } from '../perros.service';
import { construirInformePdf } from './informe-perro.pdf';
import { DatoIdentidad, EntradaHistorial, InformePerro, SeccionSalud } from './informe-perro.tipos';

/** El informe listo para entregar: el PDF y el nombre con el que se guarda. */
export interface InformeDescargable {
  readonly nombreFichero: string;
  readonly pdf: Buffer;
}

/**
 * Reúne el informe de salud que el propietario se descarga en PDF.
 *
 * Traduce la ficha y el historial a textos legibles —enums, fechas, nombres de
 * los profesionales— y se los pasa al dibujante. El permiso no se comprueba
 * aquí: se reutiliza el de `PerrosService`, que es el único sitio donde se
 * decide de quién es una ficha.
 */
@Injectable()
export class InformePerroService {
  constructor(
    private readonly perrosService: PerrosService,
    @InjectModel(Comercio.name) private readonly comercioModel: Model<ComercioDocument>,
  ) {}

  async generar(perroId: string, propietarioId: string): Promise<InformeDescargable> {
    const perro = await this.perrosService.obtenerPropio(perroId, propietarioId);
    const historial = await this.perrosService.listarHistorial(perroId, propietarioId);
    const nombres = await this.nombresDeComercios(historial);

    const datos: InformePerro = {
      nombrePerro: perro.nombre,
      subtitulo: subtitulo(perro),
      emitidoEl: fechaLarga(new Date()),
      identidad: identidad(perro),
      salud: salud(perro),
      historial: historial.map((entrada) => entradaDeHistorial(entrada, nombres)),
    };

    return {
      nombreFichero: `doogking-informe-${sanear(perro.nombre)}-${enIso(new Date())}.pdf`,
      pdf: await construirInformePdf(datos),
    };
  }

  /** Nombre comercial de cada profesional que anotó algo, en una sola consulta. */
  private async nombresDeComercios(
    historial: ReadonlyArray<PerroHistorialDocument>,
  ): Promise<Map<string, string>> {
    const ids = [...new Set(historial.map((entrada) => entrada.comercioId?.toString()).filter(Boolean))];
    if (!ids.length) return new Map();

    const comercios = await this.comercioModel
      .find({ _id: { $in: ids.map((id) => new Types.ObjectId(id)) } })
      .select('nombreComercial')
      .lean()
      .exec();

    return new Map(comercios.map((c) => [c._id.toString(), c.nombreComercial]));
  }
}

// ── Traducción de la ficha a textos del informe ──────────────────────────────

/** Línea de identificación bajo el nombre: raza, sexo y edad. */
function subtitulo(perro: PerroDocument): string {
  const raza = perro.esMestizo && perro.raza ? `Mestizo de ${perro.raza}` : perro.raza;
  const partes = [raza, perro.sexo === 'hembra' ? 'Hembra' : perro.sexo ? 'Macho' : null, edad(perro)];

  return partes.filter(Boolean).join(' · ') || capitalizar(perro.especie);
}

/** «4 años y 2 meses». Sin fecha de nacimiento no se inventa una edad. */
function edad(perro: PerroDocument): string | null {
  if (!perro.fechaNacimiento) return null;

  const meses = mesesCumplidos(perro.fechaNacimiento, new Date());
  const anos = Math.floor(meses / 12);
  const resto = meses % 12;

  if (!anos) return `${meses} ${meses === 1 ? 'mes' : 'meses'}`;
  const enAnos = `${anos} ${anos === 1 ? 'año' : 'años'}`;
  return resto ? `${enAnos} y ${resto} ${resto === 1 ? 'mes' : 'meses'}` : enAnos;
}

/**
 * Meses enteros entre dos fechas, contados por calendario.
 *
 * Dividir por una duración media de mes se queda corto: un perro nacido hace
 * justo un año daba 11,99 meses y el informe decía «11 meses» el día de su
 * cumpleaños.
 */
function mesesCumplidos(desde: Date, hasta: Date): number {
  const meses = (hasta.getFullYear() - desde.getFullYear()) * 12
    + (hasta.getMonth() - desde.getMonth());

  return Math.max(0, hasta.getDate() < desde.getDate() ? meses - 1 : meses);
}

function identidad(perro: PerroDocument): DatoIdentidad[] {
  const hembra = perro.sexo === 'hembra';
  const posibles: Array<[string, string | null]> = [
    ['Especie', capitalizar(perro.especie)],
    ['Raza', perro.raza ?? (perro.esMestizo ? 'Mestizo' : null)],
    ['Sexo', perro.sexo ? capitalizar(perro.sexo) : null],
    ['Fecha de nacimiento', perro.fechaNacimiento ? fechaCorta(perro.fechaNacimiento) : null],
    ['Peso', perro.peso ? `${formatearNumero(perro.peso)} kg` : null],
    ['Tamaño', perro.tamano ? nombreTamanoPerro(perro.tamano) : null],
    ['Microchip', perro.microchip ?? null],
    [hembra ? 'Esterilizada' : 'Esterilizado', perro.esterilizado ? 'Sí' : 'No'],
    ['Perro de raza potencialmente peligrosa', perro.esPPP ? 'Sí' : null],
  ];

  return posibles
    .filter((par): par is [string, string] => par[1] !== null)
    .map(([etiqueta, valor]) => ({ etiqueta, valor }));
}

/**
 * Bloques de salud, en el orden en que hacen falta.
 *
 * Alergias y medicación van primero y marcadas: son lo que hay que leer antes
 * de tocar al animal si llega de urgencia a una clínica que no lo conoce.
 */
function salud(perro: PerroDocument): SeccionSalud[] {
  const posibles: SeccionSalud[] = [
    { titulo: 'Alergias', items: perro.alergias, acento: 'alerta' },
    { titulo: 'Medicación actual', items: perro.medicacion, acento: 'alerta' },
    { titulo: 'Enfermedades', items: perro.enfermedades, acento: 'aviso' },
    { titulo: 'Vacunas', items: vacunas(perro), acento: 'neutro' },
    { titulo: 'Dieta', items: perro.dieta ? [perro.dieta] : [], acento: 'neutro' },
  ];

  return posibles.filter((seccion) => seccion.items.length > 0);
}

/**
 * Vacunas con su fecha. `vacunasDetalle` es la fuente de verdad; el texto libre
 * antiguo se añade detrás para no perder lo que se registró antes de la lista
 * cerrada, sin repetir lo que ya está en la lista.
 */
function vacunas(perro: PerroDocument): string[] {
  const deLaLista = perro.vacunasDetalle.map((v) => {
    const nombre = VACUNA_LABELS[v.tipo as Vacuna] ?? v.tipo;
    return v.fecha ? `${nombre} (${fechaCorta(v.fecha)})` : nombre;
  });
  const yaEstan = new Set(deLaLista.map((texto) => texto.toLowerCase()));

  return [...deLaLista, ...perro.vacunas.filter((texto) => !yaEstan.has(texto.toLowerCase()))];
}

// ── Traducción del historial ─────────────────────────────────────────────────

function entradaDeHistorial(
  entrada: PerroHistorialDocument,
  nombres: ReadonlyMap<string, string>,
): EntradaHistorial {
  const tipo = entrada.tipoHistorial ?? tipoPorVertical(entrada.vertical);

  return {
    fecha: fechaCorta(entrada.get('createdAt') as Date | undefined),
    categoria: tipo ? TIPO_HISTORIAL_LABELS[tipo] : capitalizar(entrada.vertical),
    vertical: entrada.vertical,
    profesional: profesional(entrada, nombres),
    nota: entrada.nota,
    detalles: detalles(entrada.datosEstructurados),
  };
}

/** Quién lo escribió. Lo que anotó el propietario se marca como suyo. */
function profesional(
  entrada: PerroHistorialDocument,
  nombres: ReadonlyMap<string, string>,
): string {
  if (entrada.origen === 'propietario') return 'Anotación del propietario';

  const nombre = nombres.get(entrada.comercioId?.toString() ?? '');
  const editada = entrada.editadaAt ? ' · editada por el propietario' : '';

  return `${nombre ?? 'Profesional dado de baja'}${editada}`;
}

/** Categoría de una entrada antigua, anterior a que se guardase `tipoHistorial`. */
function tipoPorVertical(vertical: string): TipoHistorial | undefined {
  return (Object.keys(HISTORIAL_ORIGEN) as TipoHistorial[])
    .find((tipo) => HISTORIAL_ORIGEN[tipo] === vertical);
}

/**
 * Los datos estructurados que dejó el profesional (objetivos de la sesión,
 * evolución, tareas). Se descartan los vacíos y los que no son texto plano: el
 * campo es libre y no hay forma de pintar un objeto anidado en una línea.
 */
function detalles(datos: Record<string, unknown>): DatoIdentidad[] {
  return Object.entries(datos ?? {})
    .filter(([, valor]) => typeof valor === 'string' || typeof valor === 'number')
    .filter(([, valor]) => String(valor).trim())
    .map(([clave, valor]) => ({ etiqueta: etiquetaDeClave(clave), valor: String(valor).trim() }));
}

/** `tareasCasa` → `Tareas casa`. Nombres de campo pensados para código, leídos por una persona. */
function etiquetaDeClave(clave: string): string {
  return capitalizar(clave.replace(/([a-z])([A-Z])/g, '$1 $2').toLowerCase());
}

// ── Formato ──────────────────────────────────────────────────────────────────

const MESES = [
  'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
  'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre',
];

/** `12 mar 2026`. Se formatea a mano: el contenedor no lleva datos de locale. */
function fechaCorta(fecha?: Date | null): string {
  if (!fecha) return '—';
  return `${fecha.getDate()} ${MESES[fecha.getMonth()].slice(0, 3)} ${fecha.getFullYear()}`;
}

function fechaLarga(fecha: Date): string {
  return `${fecha.getDate()} de ${MESES[fecha.getMonth()]} de ${fecha.getFullYear()}`;
}

function enIso(fecha: Date): string {
  return fecha.toISOString().slice(0, 10);
}

/** Coma decimal, que es como se escribe un peso en España. */
function formatearNumero(valor: number): string {
  return String(valor).replace('.', ',');
}

function capitalizar(texto: string): string {
  return texto ? texto[0].toUpperCase() + texto.slice(1) : texto;
}

/**
 * Nombre de fichero seguro. Sin esto, un perro llamado «Lúa / Sol» rompería la
 * cabecera `Content-Disposition` y el navegador guardaría un fichero sin nombre.
 */
function sanear(texto: string): string {
  return texto
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .toLowerCase() || 'mascota';
}
