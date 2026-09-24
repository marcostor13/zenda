import {
  FUENTE_EMAIL, MARCA, boton, escaparHtml, euros, fechaLarga, horaCorta, layoutEmail, tablaDatos, tituloBloque,
} from './html-email';

/**
 * Correos del seguimiento de una reserva y de los presupuestos a medida
 * (docs/PLAN-TRANSPORTE-FLUJO-CLIENTE.md, F6 y F7). Mismo layout de marca que
 * la confirmación, para que el cliente reconozca de un vistazo que es Doogking.
 */

interface Base {
  readonly urlBase: string;
  readonly nombre: string;
}

function parrafo(texto: string): string {
  return `<p style="margin:0 0 12px;font:15px/1.6 ${FUENTE_EMAIL};color:${MARCA.tintaSuave};">${texto}</p>`;
}

function titulo(texto: string): string {
  return `<h1 style="margin:0 0 8px;font:800 24px/1.3 ${FUENTE_EMAIL};color:${MARCA.azulHondo};">${texto}</h1>`;
}

export interface DatosHitoViaje extends Base {
  readonly codigo: string;
  readonly servicio: string;
  readonly hito: string;
  readonly mensaje: string;
  readonly nota?: string;
  readonly fotoUrl?: string;
}

export function plantillaHitoViaje(d: DatosHitoViaje): string {
  const foto = d.fotoUrl
    ? `<div style="margin:16px 0;text-align:center;"><img src="${escaparHtml(d.fotoUrl)}" alt="" style="max-width:100%;border-radius:12px;"></div>`
    : '';
  const contenido = `
${titulo(escaparHtml(d.hito))}
${parrafo(`Hola ${escaparHtml(d.nombre)}, ${escaparHtml(d.mensaje)}`)}
${d.nota ? parrafo(`<strong>Nota del transportista:</strong> ${escaparHtml(d.nota)}`) : ''}
${foto}
${tablaDatos([['Reserva', escaparHtml(d.codigo)], ['Servicio', escaparHtml(d.servicio)]])}
<div style="text-align:center;margin:26px 0 4px;">${boton('Seguir el viaje', `${d.urlBase}/reservas/${encodeURIComponent(d.codigo)}`)}</div>`;
  return layoutEmail({ urlBase: d.urlBase, preheader: `${d.hito} · ${d.codigo}`, contenido });
}

export interface DatosAceptacion extends Base {
  readonly codigo: string;
  readonly servicio: string;
  readonly aceptada: boolean;
  readonly inicio: Date;
  readonly motivo?: string;
  readonly importeDevuelto?: number;
}

export function plantillaAceptacionCliente(d: DatosAceptacion): string {
  const cuerpo = d.aceptada
    ? parrafo(`El transportista ha aceptado tu viaje. Recogida: <strong>${escaparHtml(fechaLarga(d.inicio))}, ${horaCorta(d.inicio)}</strong>.`)
    : parrafo(`El transportista no puede hacer este viaje${d.motivo ? `: ${escaparHtml(d.motivo)}` : ''}. `
      + `Te hemos devuelto <strong>${euros(d.importeDevuelto ?? 0)}</strong>; lo verás en tu tarjeta en unos días.`);
  const contenido = `
${titulo(d.aceptada ? 'Tu viaje está aceptado' : 'Tu viaje no se puede hacer')}
${parrafo(`Hola ${escaparHtml(d.nombre)},`)}
${cuerpo}
${tablaDatos([['Reserva', escaparHtml(d.codigo)], ['Servicio', escaparHtml(d.servicio)]])}
<div style="text-align:center;margin:26px 0 4px;">${boton(d.aceptada ? 'Ver mi reserva' : 'Buscar otro transporte', d.aceptada ? `${d.urlBase}/reservas/${encodeURIComponent(d.codigo)}` : `${d.urlBase}/transporte`)}</div>`;
  return layoutEmail({ urlBase: d.urlBase, preheader: d.aceptada ? 'Viaje aceptado' : 'Viaje no disponible', contenido });
}

export interface DatosPendienteAceptacion {
  readonly urlBase: string;
  readonly codigo: string;
  readonly servicio: string;
  readonly inicio: Date;
  readonly venceEn: Date;
  readonly detalles: ReadonlyArray<readonly [string, string]>;
}

export function plantillaPendienteAceptacion(d: DatosPendienteAceptacion): string {
  const contenido = `
${titulo('Tienes un viaje por aceptar')}
${parrafo(`El cliente ya ha pagado. Acéptalo o recházalo antes del <strong>${escaparHtml(fechaLarga(d.venceEn))}, ${horaCorta(d.venceEn)}</strong>; si no respondes, se le devolverá el dinero.`)}
${tituloBloque('Viaje')}
${tablaDatos([
    ['Reserva', escaparHtml(d.codigo)],
    ['Servicio', escaparHtml(d.servicio)],
    ['Recogida', `${escaparHtml(fechaLarga(d.inicio))}, ${horaCorta(d.inicio)}`],
    ...d.detalles.map(([e, v]) => [e, escaparHtml(v)] as [string, string]),
  ])}
<div style="text-align:center;margin:26px 0 4px;">${boton('Aceptar o rechazar', `${d.urlBase}/comercio/reservas`)}</div>`;
  return layoutEmail({ urlBase: d.urlBase, preheader: `Viaje ${d.codigo} pendiente de aceptar`, contenido });
}

export interface DatosReembolso extends Base {
  readonly codigo: string;
  readonly servicio: string;
  readonly importe: number;
  readonly porcentaje: number;
  readonly motivo: string;
}

export function plantillaReembolso(d: DatosReembolso): string {
  const devolucion = d.importe > 0
    ? parrafo(`Te devolvemos <strong>${euros(d.importe)}</strong> (${d.porcentaje} %). Lo verás en tu tarjeta en unos días.`)
    : parrafo('Según la política de cancelación de la empresa, esta cancelación no tiene reembolso.');
  const contenido = `
${titulo('Reserva cancelada')}
${parrafo(`Hola ${escaparHtml(d.nombre)}, hemos cancelado tu reserva <strong>${escaparHtml(d.codigo)}</strong> (${escaparHtml(d.servicio)}).`)}
${devolucion}
${parrafo(`<span style="color:${MARCA.gris};font-size:13px;">${escaparHtml(d.motivo)}</span>`)}`;
  return layoutEmail({ urlBase: d.urlBase, preheader: `Reserva ${d.codigo} cancelada`, contenido });
}

export interface DatosSolicitudPresupuesto {
  readonly urlBase: string;
  readonly codigo: string;
  readonly servicio: string;
  readonly fechaServicio: Date;
  readonly resumen: ReadonlyArray<readonly [string, string]>;
  readonly comentario?: string;
}

export function plantillaSolicitudPresupuesto(d: DatosSolicitudPresupuesto): string {
  const contenido = `
${titulo('Te piden un presupuesto')}
${parrafo(`Un cliente quiere contratar <strong>${escaparHtml(d.servicio)}</strong> y necesita un precio a medida.`)}
${tituloBloque('Lo que necesita')}
${tablaDatos([
    ['Solicitud', escaparHtml(d.codigo)],
    ['Fecha', escaparHtml(fechaLarga(d.fechaServicio))],
    ...d.resumen.map(([e, v]) => [e, escaparHtml(v)] as [string, string]),
  ])}
${d.comentario ? parrafo(`<strong>Comentario:</strong> ${escaparHtml(d.comentario)}`) : ''}
<div style="text-align:center;margin:26px 0 4px;">${boton('Responder presupuesto', `${d.urlBase}/comercio/presupuestos`)}</div>`;
  return layoutEmail({ urlBase: d.urlBase, preheader: `Solicitud de presupuesto ${d.codigo}`, contenido });
}

export interface DatosPresupuestoRecibido extends Base {
  readonly codigo: string;
  readonly empresa: string;
  readonly importe: number;
  readonly validoHasta: Date;
  readonly condiciones?: string;
}

export function plantillaPresupuestoRecibido(d: DatosPresupuestoRecibido): string {
  const contenido = `
${titulo(`Presupuesto recibido: ${euros(d.importe)}`)}
${parrafo(`Hola ${escaparHtml(d.nombre)}, <strong>${escaparHtml(d.empresa)}</strong> ha respondido a tu solicitud ${escaparHtml(d.codigo)}.`)}
${tablaDatos([
    ['Precio final', euros(d.importe)],
    ['Válido hasta', escaparHtml(fechaLarga(d.validoHasta))],
    ...(d.condiciones ? [['Condiciones', escaparHtml(d.condiciones)] as [string, string]] : []),
  ])}
<div style="text-align:center;margin:26px 0 4px;">${boton('Ver y aceptar', `${d.urlBase}/presupuestos`)}</div>`;
  return layoutEmail({ urlBase: d.urlBase, preheader: `Presupuesto de ${d.empresa}: ${euros(d.importe)}`, contenido });
}
