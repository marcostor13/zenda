import { nombreTamanoPerro } from '../catalogos/tamanos-perro';
import { SolicitudViaje } from './solicitud-viaje';
import {
  COMPORTAMIENTOS_MASCOTA, EQUIPAJE_TRANSPORTE, NECESIDADES_MASCOTA, PREFERENCIAS_VIAJE, etiquetaDe,
} from './transporte.catalogos';
import { NECESIDAD_TRANSPORTE_LABELS } from './transporte.enums';
import {
  ESPECIE_MASCOTA_LABELS, FRANJA_TRANSPORTE_LABELS, MODALIDAD_TRANSPORTE_LABELS, ModoHorarioTransporte,
  NECESIDAD_OTRA, PATRON_RECURRENCIA_TRANSPORTE_LABELS, VUELTA_TRANSPORTE_LABELS, VueltaTransporte, especieMascotaDe,
} from './viaje.catalogo';

/**
 * Resumen de la solicitud en filas «etiqueta → valor», en español. Lo pintan la
 * revisión antes de pagar, la bandeja de presupuestos del comercio y los
 * correos: así el transportista lee exactamente lo mismo que escribió el
 * cliente, sin que cada pantalla lo cuente a su manera.
 */
export function resumenSolicitudViaje(s: SolicitudViaje): Array<[string, string]> {
  const filas: Array<[string, string]> = [
    ['Servicio', NECESIDAD_TRANSPORTE_LABELS[s.tipoServicio] ?? s.tipoServicio],
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
  if (s.equipaje) filas.push(['Equipaje', etiquetaDe(EQUIPAJE_TRANSPORTE, s.equipaje)]);
  if (s.necesidades?.length) {
    const necesidades = s.necesidades.filter((n) => n !== NECESIDAD_OTRA).map((n) => etiquetaDe(NECESIDADES_MASCOTA, n));
    if (s.necesidadOtra) necesidades.push(s.necesidadOtra);
    if (necesidades.length) filas.push(['Necesidades', necesidades.join(', ')]);
  }
  if (s.comportamiento) filas.push(['Comportamiento', etiquetaDe(COMPORTAMIENTOS_MASCOTA, s.comportamiento)]);
  if (s.preferencias?.length) {
    filas.push(['Preferencias', s.preferencias.map((p) => etiquetaDe(PREFERENCIAS_VIAJE, p)).join(', ')]);
  }
  if (s.notaTransportista) filas.push(['Información para el transportista', s.notaTransportista]);
  return filas.filter(([, valor]) => !!valor);
}

function horaLegible(s: SolicitudViaje): string {
  if (s.modoHorario === ModoHorarioTransporte.LO_ANTES_POSIBLE) return 'Lo antes posible';
  if (s.modoHorario === ModoHorarioTransporte.FLEXIBLE) {
    return `Flexible · ${s.franja ? FRANJA_TRANSPORTE_LABELS[s.franja] : 'Cualquier horario'}`;
  }
  return s.hora ?? '';
}

function vueltaLegible(s: SolicitudViaje): string {
  if (!s.vuelta) return '';
  const base = VUELTA_TRANSPORTE_LABELS[s.vuelta.modo] ?? s.vuelta.modo;
  if (s.vuelta.modo === VueltaTransporte.HORA && s.vuelta.hora) return `${base} · ${s.vuelta.hora}`;
  if (s.vuelta.modo === VueltaTransporte.TRAS_HORAS && s.vuelta.horas) return `Tras ${s.vuelta.horas} h`;
  if (s.vuelta.modo === VueltaTransporte.OTRO_DIA) return `${s.vuelta.fecha ?? ''} ${s.vuelta.hora ?? ''}`.trim();
  return base;
}

function mascotasLegibles(s: SolicitudViaje): string {
  return (s.mascotas ?? [])
    .map((m) => {
      const especie = ESPECIE_MASCOTA_LABELS[especieMascotaDe(m.especie)];
      const tamano = nombreTamanoPerro(m.tamano);
      return m.nombre ? `${m.nombre} (${especie}, ${tamano})` : `${especie}, ${tamano}`;
    })
    .join(' · ');
}
