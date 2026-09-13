import { ExpedienteApi } from '../expediente.service';

/**
 * Próxima cita de la mascota: la reserva futura más cercana o, si no hay, la
 * próxima cita que recomendó un profesional en su último registro.
 */
export function proximaCitaDe(expediente: ExpedienteApi | null, ahora = new Date()): string | null {
  if (!expediente) return null;
  const futuras = [
    ...expediente.servicios
      .filter((s) => !['cancelada', 'completada', 'no_show', 'reembolsada'].includes(s.estado))
      .map((s) => s.fechaInicio),
    ...expediente.registros.map((r) => r.proximaCita).filter((f): f is string => !!f),
  ].filter((fecha) => new Date(fecha).getTime() >= ahora.getTime());

  if (!futuras.length) return null;
  return futuras.sort((a, b) => new Date(a).getTime() - new Date(b).getTime())[0];
}
