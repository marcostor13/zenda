import { VERTICAL_LABELS, VerticalKey } from 'shared';
import { DatosReservaConfirmada } from './reserva-confirmada.plantilla';
import {
  FUENTE_EMAIL, MARCA, boton, escaparHtml, euros, fechaLarga, horaCorta, layoutEmail, tablaDatos, tituloBloque,
} from './html-email';

export type DatosNuevaReservaComercio = DatosReservaConfirmada & { readonly clienteNombre?: string };

/**
 * Aviso de nueva reserva para el equipo del comercio: lo justo para organizarse
 * sin abrir el panel (quién, cuándo, qué perro, qué servicio) y el enlace a la
 * reserva. Sin contacto del cliente: eso lo ven en el panel, con sesión.
 */
export function plantillaNuevaReservaComercio(d: DatosNuevaReservaComercio): string {
  const cuando = d.conHora
    ? `${escaparHtml(fechaLarga(d.inicio))}, ${horaCorta(d.inicio)}${d.fin ? `–${horaCorta(d.fin)}` : ''}`
    : `${escaparHtml(fechaLarga(d.inicio))}${d.fin ? ` → ${escaparHtml(fechaLarga(d.fin))}` : ''}`;

  const filas: Array<[string, string]> = [
    ['Servicio', escaparHtml(d.servicio.titulo)],
    ['Categoría', escaparHtml(VERTICAL_LABELS[d.vertical as VerticalKey] ?? d.vertical)],
    [d.conHora ? 'Cita' : 'Fechas', cuando],
    ['Cliente', escaparHtml(d.clienteNombre ?? 'Cliente')],
    ...(d.perro ? [['Mascota', escaparHtml(d.perro)] as [string, string]] : []),
    ...d.detalles.map(([e, v]) => [e, escaparHtml(v)] as [string, string]),
    ['Importe', euros(d.importes.total)],
  ];

  const contenido = `
<h1 style="margin:0 0 8px;font:800 24px/1.3 ${FUENTE_EMAIL};color:${MARCA.azulHondo};">Tienes una nueva reserva</h1>
<p style="margin:0 0 4px;font:15px/1.6 ${FUENTE_EMAIL};color:${MARCA.tintaSuave};">
  Código <strong style="color:${MARCA.tinta};">${escaparHtml(d.codigo)}</strong> · pagada y confirmada.
</p>
${tituloBloque('Resumen')}
${tablaDatos(filas)}
<div style="text-align:center;margin:26px 0 4px;">
  ${boton('Ver en mi panel', `${d.urlBase}/comercio/reservas`)}
</div>
<p style="margin:16px 0 0;font:13px/1.5 ${FUENTE_EMAIL};color:${MARCA.gris};">
  La reserva ya aparece en tu agenda. Si no puedes atenderla, gestiónala desde el panel cuanto antes.
</p>`;

  return layoutEmail({
    urlBase: d.urlBase,
    preheader: `${d.servicio.titulo} · ${d.conHora ? `${fechaLarga(d.inicio)} ${horaCorta(d.inicio)}` : fechaLarga(d.inicio)}`,
    contenido,
  });
}
