import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import {
  HISTORIAL_ORIGEN, TIPO_HISTORIAL_LABELS, TipoHistorial, VACUNA_LABELS, Vacuna,
  camposDeRegistro, nombreTamanoPerro,
} from 'shared';
import { Comercio, ComercioDocument } from '../../comercios/comercio.schema';
import { Perro } from '../perro.schema';
import { PerrosService } from '../perros.service';
import { construirInformePdf } from './informe-perro.pdf';
import { DatoIdentidad, EntradaHistorial, InformePerro, SeccionSalud } from './informe-perro.tipos';

/** El informe listo para entregar: el PDF y el nombre con el que se guarda. */
export interface InformeDescargable {
  readonly nombreFichero: string;
  readonly pdf: Buffer;
}

/**
 * Una anotación del historial tal y como llega a este servicio. Vale igual un
 * documento de Mongoose que un objeto plano del expediente del comercio: sólo
 * se leen propiedades.
 */
export interface EntradaFuente {
  readonly vertical: string;
  readonly tipoHistorial?: TipoHistorial;
  readonly origen?: 'comercio' | 'propietario';
  readonly titulo?: string;
  readonly nota: string;
  readonly datosEstructurados?: Record<string, unknown>;
  readonly fechaServicio?: Date;
  readonly createdAt?: Date;
  readonly profesional?: string;
  readonly proximaCita?: Date;
  readonly comercioNombre?: string;
  readonly editadaAt?: Date;
}

/** Todo lo necesario para componer un informe, venga del dueño o del comercio. */
export interface OrigenInforme {
  readonly perro: Perro;
  readonly entradas: ReadonlyArray<EntradaFuente>;
  /** Negocio que lo descarga desde su panel. */
  readonly emisor?: string;
  readonly propietario?: { readonly nombre?: string; readonly email?: string; readonly telefono?: string };
}

/**
 * Reúne el informe de salud de la mascota en PDF.
 *
 * Traduce la ficha y el historial a textos legibles —enums, fechas, nombres de
 * los profesionales— y se los pasa al dibujante. Hay un solo informe para los
 * dos públicos: el dueño lo descarga desde su ficha y el comercio desde el
 * expediente de la mascota; cambian el emisor y el contacto del dueño, no el
 * documento. Los permisos se deciden fuera (`PerrosService` para el dueño,
 * `ExpedientesService` para el comercio).
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
    const nombres = await this.nombresDeComercios(historial.map((e) => e.comercioId?.toString()));

    const entradas: EntradaFuente[] = historial.map((entrada) => ({
      vertical: entrada.vertical,
      tipoHistorial: entrada.tipoHistorial,
      origen: entrada.origen,
      titulo: entrada.titulo,
      nota: entrada.nota,
      datosEstructurados: entrada.datosEstructurados,
      fechaServicio: entrada.fechaServicio,
      createdAt: entrada.get('createdAt') as Date | undefined,
      profesional: entrada.profesional,
      proximaCita: entrada.proximaCita,
      editadaAt: entrada.editadaAt,
      comercioNombre: nombres.get(entrada.comercioId?.toString() ?? ''),
    }));

    return this.componer({ perro, entradas });
  }

  /** Compone el PDF a partir de datos ya autorizados. */
  async componer(origen: OrigenInforme): Promise<InformeDescargable> {
    const { perro } = origen;
    const datos: InformePerro = {
      nombrePerro: perro.nombre,
      subtitulo: subtitulo(perro),
      emitidoEl: fechaLarga(new Date()),
      emisor: origen.emisor,
      identidad: identidad(perro),
      propietario: contactoPropietario(origen.propietario),
      salud: salud(perro),
      historial: [...origen.entradas]
        .sort((a, b) => fechaDe(b).getTime() - fechaDe(a).getTime())
        .map(entradaDeHistorial),
    };

    return {
      nombreFichero: `doogking-informe-${sanear(perro.nombre)}-${enIso(new Date())}.pdf`,
      pdf: await construirInformePdf(datos),
    };
  }

  /** Nombre comercial de cada profesional que anotó algo, en una sola consulta. */
  private async nombresDeComercios(ids: ReadonlyArray<string | undefined>): Promise<Map<string, string>> {
    const unicos = [...new Set(ids.filter((id): id is string => !!id))];
    if (!unicos.length) return new Map();

    const comercios = await this.comercioModel
      .find({ _id: { $in: unicos.map((id) => new Types.ObjectId(id)) } })
      .select('nombreComercial')
      .lean()
      .exec();

    return new Map(comercios.map((c) => [c._id.toString(), c.nombreComercial]));
  }
}

// ── Traducción de la ficha a textos del informe ──────────────────────────────

/** Línea de identificación bajo el nombre: raza, sexo y edad. */
function subtitulo(perro: Perro): string {
  const raza = perro.esMestizo && perro.raza ? `Mestizo de ${perro.raza}` : perro.raza;
  const partes = [raza, perro.sexo === 'hembra' ? 'Hembra' : perro.sexo ? 'Macho' : null, edad(perro)];

  return partes.filter(Boolean).join(' · ') || capitalizar(perro.especie);
}

/** «4 años y 2 meses». Sin fecha de nacimiento no se inventa una edad. */
function edad(perro: Perro): string | null {
  if (!perro.fechaNacimiento) return null;

  const meses = mesesCumplidos(new Date(perro.fechaNacimiento), new Date());
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

function identidad(perro: Perro): DatoIdentidad[] {
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

  return conValor(posibles);
}

function contactoPropietario(propietario: OrigenInforme['propietario']): DatoIdentidad[] {
  if (!propietario) return [];
  return conValor([
    ['Nombre', propietario.nombre ?? null],
    ['Teléfono', propietario.telefono ?? null],
    ['Email', propietario.email ?? null],
  ]);
}

function conValor(pares: Array<[string, string | null]>): DatoIdentidad[] {
  return pares
    .filter((par): par is [string, string] => par[1] !== null)
    .map(([etiqueta, valor]) => ({ etiqueta, valor }));
}

/**
 * Bloques de salud, en el orden en que hacen falta.
 *
 * Alergias y medicación van primero y marcadas: son lo que hay que leer antes
 * de tocar al animal si llega de urgencia a una clínica que no lo conoce.
 */
function salud(perro: Perro): SeccionSalud[] {
  const posibles: SeccionSalud[] = [
    { titulo: 'Alergias', items: perro.alergias ?? [], acento: 'alerta' },
    { titulo: 'Medicación actual', items: perro.medicacion ?? [], acento: 'alerta' },
    { titulo: 'Enfermedades', items: perro.enfermedades ?? [], acento: 'aviso' },
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
function vacunas(perro: Perro): string[] {
  const deLaLista = (perro.vacunasDetalle ?? []).map((v) => {
    const nombre = VACUNA_LABELS[v.tipo as Vacuna] ?? v.tipo;
    return v.fecha ? `${nombre} (${fechaCorta(v.fecha)})` : nombre;
  });
  const yaEstan = new Set(deLaLista.map((texto) => texto.toLowerCase()));

  return [...deLaLista, ...(perro.vacunas ?? []).filter((texto) => !yaEstan.has(texto.toLowerCase()))];
}

// ── Traducción del historial ─────────────────────────────────────────────────

function entradaDeHistorial(entrada: EntradaFuente): EntradaHistorial {
  const tipo = entrada.tipoHistorial ?? tipoPorVertical(entrada.vertical);
  const titulo = entrada.titulo?.trim();

  return {
    fecha: fechaCorta(entrada.fechaServicio ?? entrada.createdAt),
    categoria: tipo ? TIPO_HISTORIAL_LABELS[tipo] : capitalizar(entrada.vertical),
    vertical: entrada.vertical,
    titulo,
    profesional: profesional(entrada),
    // La nota hereda el título cuando el profesional no escribió observaciones:
    // repetirla debajo del título sólo duplica la línea.
    nota: entrada.nota === titulo ? '' : entrada.nota,
    detalles: [
      ...detalles(entrada.vertical, entrada.datosEstructurados ?? {}),
      ...(entrada.proximaCita ? [{ etiqueta: 'Próxima cita', valor: fechaCorta(entrada.proximaCita) }] : []),
    ],
  };
}

/** Cuándo se prestó el servicio; si no se indicó, cuándo se anotó. */
function fechaDe(entrada: EntradaFuente): Date {
  return new Date(entrada.fechaServicio ?? entrada.createdAt ?? 0);
}

/** Quién lo escribió. Lo que anotó el propietario se marca como suyo. */
function profesional(entrada: EntradaFuente): string {
  if (entrada.origen === 'propietario') return 'Anotación del propietario';

  const firma = [entrada.comercioNombre ?? 'Profesional dado de baja', entrada.profesional]
    .filter(Boolean)
    .join(' · ');
  const editada = entrada.editadaAt ? ' · editada por el propietario' : '';

  return `${firma}${editada}`;
}

/** Categoría de una entrada antigua, anterior a que se guardase `tipoHistorial`. */
function tipoPorVertical(vertical: string): TipoHistorial | undefined {
  return (Object.keys(HISTORIAL_ORIGEN) as TipoHistorial[])
    .find((tipo) => HISTORIAL_ORIGEN[tipo] === vertical);
}

/**
 * Los datos estructurados que dejó el profesional. Los campos conocidos de la
 * categoría salen con su etiqueta y unidad (las mismas del formulario del
 * panel) y en su orden; el resto, con el nombre del campo hecho legible. Se
 * descartan los vacíos y los que no son texto plano: no hay forma de pintar un
 * objeto anidado en una línea.
 */
function detalles(vertical: string, datos: Record<string, unknown>): DatoIdentidad[] {
  const campos = camposDeRegistro(vertical);
  const conocidos = new Set(campos.map((c) => c.clave));
  const legible = (valor: unknown) => (typeof valor === 'number' ? formatearNumero(valor) : String(valor).trim());
  const utiles = ([, valor]: [string, unknown]) =>
    (typeof valor === 'string' || typeof valor === 'number') && String(valor).trim() !== '';

  const deLaCategoria = campos
    .map((campo) => [campo, datos[campo.clave]] as const)
    .filter(([campo, valor]) => utiles([campo.clave, valor]))
    .map(([campo, valor]) => ({
      etiqueta: campo.etiqueta,
      valor: campo.unidad ? `${legible(valor)} ${campo.unidad}` : legible(valor),
    }));

  const otros = Object.entries(datos)
    .filter(([clave]) => !conocidos.has(clave))
    .filter(utiles)
    .map(([clave, valor]) => ({ etiqueta: etiquetaDeClave(clave), valor: legible(valor) }));

  return [...deLaCategoria, ...otros];
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

/**
 * Día, mes y año del calendario de España.
 *
 * Con `getDate()` salía el día de la zona horaria del servidor: una vacuna
 * guardada el 12 de marzo a las 00:00 UTC se imprimía "11 mar" en cualquier
 * máquina al oeste de Greenwich, y una cita a las 23:30 de Madrid, con el día
 * siguiente en UTC. Los nombres de los meses se ponen a mano porque la imagen
 * del contenedor no garantiza los textos del locale, pero sí la zona horaria.
 */
const PARTES_MADRID = new Intl.DateTimeFormat('en-US', {
  timeZone: 'Europe/Madrid', day: 'numeric', month: 'numeric', year: 'numeric',
});

function enMadrid(fecha: Date): { dia: number; mes: number; ano: number } {
  const partes = Object.fromEntries(PARTES_MADRID.formatToParts(fecha).map((p) => [p.type, p.value]));
  return { dia: Number(partes['day']), mes: Number(partes['month']) - 1, ano: Number(partes['year']) };
}

/** `12 mar 2026`. */
function fechaCorta(valor?: Date | string | null): string {
  if (!valor) return '—';
  const fecha = new Date(valor);
  if (Number.isNaN(fecha.getTime())) return '—';
  const { dia, mes, ano } = enMadrid(fecha);
  return `${dia} ${MESES[mes].slice(0, 3)} ${ano}`;
}

function fechaLarga(fecha: Date): string {
  const { dia, mes, ano } = enMadrid(fecha);
  return `${dia} de ${MESES[mes]} de ${ano}`;
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
    .replace(/\p{M}/gu, '')
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .toLowerCase() || 'mascota';
}
