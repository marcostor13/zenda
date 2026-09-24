import { nombreTamanoPerro } from '../catalogos/tamanos-perro';
import { SolicitudTransporte } from './cotizar-transporte';
import {
  COMPORTAMIENTO_VIAJE_LABELS, ComportamientoViaje, EQUIPAJE_TRANSPORTE_LABELS, ESPECIE_MASCOTA_LABELS,
  FRANJA_TRANSPORTE_LABELS, MODALIDAD_TRANSPORTE_LABELS, ModoHorarioTransporte, NECESIDAD_TRANSPORTE_LABELS,
  PATRON_RECURRENCIA_TRANSPORTE_LABELS, PREFERENCIA_TRANSPORTE_LABELS, TIPO_SERVICIO_TRANSPORTE_LABELS,
  VUELTA_TRANSPORTE_LABELS, VueltaTransporte, normalizarEspecie,
} from './transporte.catalogo';

/**
 * Resumen de la solicitud en filas «etiqueta → valor», en español. Lo pintan la
 * revisión antes de pagar, la bandeja de presupuestos del comercio y los
 * correos: así el transportista lee exactamente lo mismo que escribió el
 * cliente, sin que cada pantalla lo cuente a su manera.
 */
export function resumenSolicitudTransporte(s: SolicitudTransporte): Array<[string, string]> {
  const filas: Array<[string, string]> = [
    ['Servicio', TIPO_SERVICIO_TRANSPORTE_LABELS[s.tipoServicio] ?? s.tipoServicio],
    ['Recogida', s.origen?.texto ?? ''],
    ['Entrega', s.destino?.texto ?? ''],
    ['Fecha', s.fecha],
    ['Hora', horaLegible(s)],
  ];
  const vuelta = vueltaLegible(s);
  if (vuelta) filas.push(['Vuelta', vuelta]);
  if (s.recurrencia) {
    filas.push(['Repetición', `${PATRON_RECURRENCIA_TRANSPORTE_LABELS[s.recurrencia.patron]} · hasta ${s.recurrencia.hasta}`]);
  }
  filas.push(['Mascotas', mascotasLegibles(s)]);
  filas.push(['Modalidad', MODALIDAD_TRANSPORTE_LABELS[s.modalidad] ?? s.modalidad]);
  if (s.personas) filas.push(['Acompañantes', String(s.personas)]);
  if (s.equipaje) filas.push(['Equipaje', EQUIPAJE_TRANSPORTE_LABELS[s.equipaje] ?? s.equipaje]);
  if (s.necesidades?.length) {
    const necesidades = s.necesidades.map((n) => NECESIDAD_TRANSPORTE_LABELS[n] ?? n);
    if (s.necesidadOtra) necesidades.push(s.necesidadOtra);
    filas.push(['Necesidades', necesidades.join(', ')]);
  }
  if (s.comportamiento) {
    filas.push(['Comportamiento', COMPORTAMIENTO_VIAJE_LABELS[s.comportamiento as ComportamientoViaje] ?? s.comportamiento]);
  }
  if (s.preferencias?.length) {
    filas.push(['Preferencias', s.preferencias.map((p) => PREFERENCIA_TRANSPORTE_LABELS[p] ?? p).join(', ')]);
  }
  if (s.notaTransportista) filas.push(['Información para el transportista', s.notaTransportista]);
  return filas.filter(([, valor]) => !!valor);
}

function horaLegible(s: SolicitudTransporte): string {
  if (s.modoHorario === ModoHorarioTransporte.LO_ANTES_POSIBLE) return 'Lo antes posible';
  if (s.modoHorario === ModoHorarioTransporte.FLEXIBLE) {
    return `Flexible · ${s.franja ? FRANJA_TRANSPORTE_LABELS[s.franja] : 'Cualquier horario'}`;
  }
  return s.hora ?? '';
}

function vueltaLegible(s: SolicitudTransporte): string {
  if (!s.vuelta) return '';
  const base = VUELTA_TRANSPORTE_LABELS[s.vuelta.modo] ?? s.vuelta.modo;
  if (s.vuelta.modo === VueltaTransporte.HORA && s.vuelta.hora) return `${base} · ${s.vuelta.hora}`;
  if (s.vuelta.modo === VueltaTransporte.TRAS_HORAS && s.vuelta.horas) return `Tras ${s.vuelta.horas} h`;
  if (s.vuelta.modo === VueltaTransporte.OTRO_DIA) return `${s.vuelta.fecha ?? ''} ${s.vuelta.hora ?? ''}`.trim();
  return base;
}

function mascotasLegibles(s: SolicitudTransporte): string {
  return (s.mascotas ?? [])
    .map((m) => {
      const especie = ESPECIE_MASCOTA_LABELS[normalizarEspecie(m.especie)];
      const tamano = nombreTamanoPerro(m.tamano);
      return m.nombre ? `${m.nombre} (${especie}, ${tamano})` : `${especie}, ${tamano}`;
    })
    .join(' · ');
}
