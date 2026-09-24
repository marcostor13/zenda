import {
  ESPECIE_MASCOTA_LABELS, FRANJA_TRANSPORTE_LABELS, MascotaViaje, ModoHorarioTransporte, nombreTamanoPerro,
  especieMascotaDe,
} from 'shared';
import type { I18nService } from '../../../core/i18n/i18n.service';
import type { BorradorViaje } from './transporte-viaje.store';

/** «Av. del Cid 120, 46014 Valencia, España» → «Av. del Cid 120». Para cabeceras estrechas. */
export function lugarCorto(texto?: string | null): string {
  return (texto ?? '').split(',')[0].trim();
}

/** «1 h 05 min» o «45 min». */
export function textoDuracion(minutos: number): string {
  const horas = Math.floor(minutos / 60);
  const resto = Math.round(minutos % 60);
  return horas ? `${horas} h ${String(resto).padStart(2, '0')} min` : `${resto} min`;
}

/** `2026-09-25` → `25/09/2026`. Es un día de calendario: no pasa por zonas horarias. */
export function fechaCorta(dia: string): string {
  const [anio, mes, d] = dia.split('-');
  return anio && mes && d ? `${d}/${mes}/${anio}` : dia;
}

/** Cuándo es la recogida, tal como la eligió el cliente. */
export function horaLegible(b: Pick<BorradorViaje, 'modoHorario' | 'hora' | 'franja'>, i18n: I18nService): string {
  if (b.modoHorario === ModoHorarioTransporte.LO_ANTES_POSIBLE) return i18n.t('Lo antes posible');
  if (b.modoHorario === ModoHorarioTransporte.FLEXIBLE) return i18n.t(FRANJA_TRANSPORTE_LABELS[b.franja]);
  return b.hora;
}

/** «Hachi, Luna» o «2 perros · Mediano». */
export function mascotasLegibles(mascotas: readonly MascotaViaje[], i18n: I18nService): string {
  const conNombre = mascotas.filter((m) => m.nombre).map((m) => m.nombre);
  if (conNombre.length === mascotas.length && conNombre.length) return conNombre.join(', ');
  const primera = mascotas[0];
  if (!primera) return '';
  const especie = i18n.t(ESPECIE_MASCOTA_LABELS[especieMascotaDe(primera.especie)]);
  return `${mascotas.length} × ${especie} · ${i18n.t(nombreTamanoPerro(primera.tamano))}`;
}

/** Fecha, hora y mascotas: lo que acompaña a «origen → destino» en la cabecera. */
export function detallesDelViaje(b: BorradorViaje, mascotas: readonly MascotaViaje[], i18n: I18nService): string[] {
  return [fechaCorta(b.fecha), horaLegible(b, i18n), mascotasLegibles(mascotas, i18n)].filter(Boolean);
}
