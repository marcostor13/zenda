import { VERTICAL_LABELS, VerticalKey } from 'shared';
import {
  FUENTE_EMAIL, MARCA, boton, escaparHtml, euros, fechaLarga, horaCorta, layoutEmail, tablaDatos, tituloBloque,
} from './html-email';

/** Todo lo que el correo de confirmación necesita, ya resuelto y sin documentos de Mongo. */
export interface DatosReservaConfirmada {
  readonly urlBase: string;
  readonly cliente: { readonly nombre: string };
  readonly codigo: string;
  readonly vertical: string;
  readonly servicio: {
    readonly titulo: string;
    readonly imagen?: string;
    readonly direccion?: string;
    readonly ciudad?: string;
    readonly politicaCancelacion?: string;
    readonly checkIn?: string;
    readonly checkOut?: string;
  };
  readonly comercio: {
    readonly nombre: string;
    readonly telefono?: string;
    readonly email?: string;
  };
  readonly inicio: Date;
  readonly fin?: Date;
  /** La reserva tiene hora (cita, trayecto); si no, es por días (estancia). */
  readonly conHora: boolean;
  readonly perro?: string;
  readonly cantidad: number;
  /** Detalles propios del servicio ya legibles: "Servicio" → "Vacunación". */
  readonly detalles: ReadonlyArray<readonly [string, string]>;
  readonly importes: {
    readonly total: number;
    readonly baseImponible: number;
    readonly iva: number;
    readonly descuento: number;
    readonly cupon?: string;
  };
}

/**
 * Qué tener a mano antes del servicio. No es relleno: son las preguntas que los
 * comercios reciben por teléfono la víspera, y lo que hace que un perro se
 * quede en la puerta (una residencia sin la cartilla de vacunas, un transporte
 * sin transportín).
 */
const ANTES_DEL_SERVICIO: Partial<Record<VerticalKey, readonly string[]>> = {
  [VerticalKey.ALOJAMIENTO]: [
    'Cartilla o pasaporte con las vacunas al día.',
    'Su comida habitual y, si toma, la medicación con las dosis anotadas.',
    'Algo con tu olor (una manta o un juguete) le ayuda a adaptarse.',
  ],
  [VerticalKey.HOTELES]: [
    'Cartilla o pasaporte con las vacunas al día.',
    'Correa, cama o manta y su comida habitual.',
  ],
  [VerticalKey.VETERINARIA]: [
    'Llega 10 minutos antes con la cartilla sanitaria o el pasaporte.',
    'Anota los síntomas, desde cuándo y la medicación que toma.',
    'Si es para análisis o cirugía, pregunta si debe venir en ayunas.',
  ],
  [VerticalKey.PELUQUERIA]: [
    'Un paseo corto antes de la cita le ayuda a estar tranquilo.',
    'Avisa al llegar de alergias, zonas sensibles o heridas.',
  ],
  [VerticalKey.ADIESTRAMIENTO]: [
    'Trae premios pequeños que le gusten mucho y su correa habitual.',
    'Mejor que no haya comido justo antes de la sesión.',
  ],
  [VerticalKey.TRANSPORTE]: [
    'Ten a mano la documentación del animal y su transportín si lo usa.',
    'Mejor sin comida abundante en las dos horas previas al viaje.',
  ],
};

export function asuntoReservaConfirmada(datos: DatosReservaConfirmada): string {
  const cuando = datos.conHora
    ? `${fechaCortaAsunto(datos.inicio)} a las ${horaCorta(datos.inicio)}`
    : fechaCortaAsunto(datos.inicio);
  // El código va al final: es lo que el cliente busca en su bandeja cuando llama al comercio.
  return `✔ Reserva confirmada: ${datos.servicio.titulo} · ${cuando} (${datos.codigo})`;
}

export function plantillaReservaConfirmada(datos: DatosReservaConfirmada): string {
  const contenido = [
    cabecera(datos),
    tarjetaServicio(datos),
    bloqueCuando(datos),
    bloqueDetalles(datos),
    bloqueImporte(datos),
    bloqueAntes(datos),
    bloqueCancelacion(datos),
    bloqueContacto(datos),
  ].join('');

  return layoutEmail({
    urlBase: datos.urlBase,
    preheader: `${datos.servicio.titulo} · ${fechaLarga(datos.inicio)}${datos.conHora ? ` a las ${horaCorta(datos.inicio)}` : ''} · Código ${datos.codigo}`,
    contenido,
  });
}

// ── Bloques ──────────────────────────────────────────────────────────────────

function cabecera(d: DatosReservaConfirmada): string {
  const enlaceReserva = `${d.urlBase}/reservas/${encodeURIComponent(d.codigo)}`;
  return `
<table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr>
  <td bgcolor="${MARCA.verdeSuave}" style="background:${MARCA.verdeSuave};border-radius:999px;padding:6px 14px;font:700 13px ${FUENTE_EMAIL};color:${MARCA.verde};">&#10003; Reserva confirmada y pagada</td>
</tr></table>
<h1 style="margin:18px 0 8px;font:800 26px/1.25 ${FUENTE_EMAIL};color:${MARCA.azulHondo};">¡Todo listo, ${escaparHtml(d.cliente.nombre)}!</h1>
<p style="margin:0 0 20px;font:16px/1.6 ${FUENTE_EMAIL};color:${MARCA.tintaSuave};">
  ${escaparHtml(d.comercio.nombre)} ya tiene tu reserva${d.perro ? ` para <strong style="color:${MARCA.tinta};">${escaparHtml(d.perro)}</strong>` : ''}.
  Guarda este correo: es tu comprobante.
</p>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 8px;">
<tr><td bgcolor="${MARCA.oroSuave}" style="background:${MARCA.oroSuave};border:1px dashed ${MARCA.oro};border-radius:12px;padding:14px 18px;">
  <span style="font:600 12px ${FUENTE_EMAIL};letter-spacing:1.2px;text-transform:uppercase;color:${MARCA.tintaSuave};">Código de reserva</span><br>
  <span style="font:800 24px/1.4 'Courier New',monospace;letter-spacing:2px;color:${MARCA.azulHondo};">${escaparHtml(d.codigo)}</span>
</td></tr></table>
<div style="text-align:center;margin:20px 0 4px;">
  ${boton('Ver mi reserva', enlaceReserva)}
</div>`;
}

function tarjetaServicio(d: DatosReservaConfirmada): string {
  const categoria = VERTICAL_LABELS[d.vertical as VerticalKey] ?? d.vertical;
  const imagen = d.servicio.imagen && /^https:\/\//.test(d.servicio.imagen)
    ? `<td width="96" valign="top" style="padding-right:16px;"><img src="${escaparHtml(d.servicio.imagen)}" width="96" height="96" alt="" style="display:block;width:96px;height:96px;object-fit:cover;border-radius:12px;border:0;"></td>`
    : '';
  return `
${tituloBloque('Tu servicio')}
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border:1px solid ${MARCA.borde};border-radius:12px;">
<tr><td style="padding:16px;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr>
    ${imagen}
    <td valign="top">
      <span style="font:700 11px ${FUENTE_EMAIL};letter-spacing:1px;text-transform:uppercase;color:${MARCA.gris};">${escaparHtml(categoria)}</span>
      <p style="margin:4px 0 2px;font:700 18px/1.3 ${FUENTE_EMAIL};color:${MARCA.tinta};">${escaparHtml(d.servicio.titulo)}</p>
      <p style="margin:0;font:14px/1.5 ${FUENTE_EMAIL};color:${MARCA.tintaSuave};">${escaparHtml(d.comercio.nombre)}</p>
    </td>
  </tr></table>
</td></tr></table>`;
}

function bloqueCuando(d: DatosReservaConfirmada): string {
  const filas: Array<[string, string]> = d.conHora
    ? [
        ['Día', escaparHtml(capitalizar(fechaLarga(d.inicio)))],
        ['Hora', `${horaCorta(d.inicio)}${d.fin ? ` – ${horaCorta(d.fin)}` : ''} <span style="font-weight:400;color:${MARCA.gris};">(hora de España)</span>`],
      ]
    : [
        ['Entrada', `${escaparHtml(capitalizar(fechaLarga(d.inicio)))}${d.servicio.checkIn ? ` · desde las ${escaparHtml(d.servicio.checkIn)}` : ''}`],
        ...(d.fin
          ? [['Salida', `${escaparHtml(capitalizar(fechaLarga(d.fin)))}${d.servicio.checkOut ? ` · hasta las ${escaparHtml(d.servicio.checkOut)}` : ''}`] as [string, string]]
          : []),
        ...(d.fin ? [['Duración', noches(d.inicio, d.fin)] as [string, string]] : []),
      ];

  const direccion = [d.servicio.direccion, d.servicio.ciudad].filter(Boolean).join(', ');
  if (direccion) {
    const mapa = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${d.comercio.nombre}, ${direccion}`)}`;
    filas.push(['Dirección', `${escaparHtml(direccion)}<br><a href="${mapa}" style="font-weight:600;color:${MARCA.azul};">Cómo llegar &rarr;</a>`]);
  }

  return `${tituloBloque(d.conHora ? 'Cuándo y dónde' : 'Fechas y lugar')}${tablaDatos(filas)}
<p style="margin:10px 0 0;font:13px/1.5 ${FUENTE_EMAIL};color:${MARCA.gris};">Te adjuntamos el evento para añadirlo a tu calendario.</p>`;
}

function bloqueDetalles(d: DatosReservaConfirmada): string {
  const filas: Array<[string, string]> = [];
  if (d.perro) filas.push(['Mascota', escaparHtml(d.perro)]);
  if (d.cantidad > 1) filas.push(['Cantidad', String(d.cantidad)]);
  for (const [etiqueta, valor] of d.detalles) filas.push([etiqueta, escaparHtml(valor)]);
  return filas.length ? `${tituloBloque('Detalles')}${tablaDatos(filas)}` : '';
}

function bloqueImporte(d: DatosReservaConfirmada): string {
  const { importes } = d;
  const filas: Array<[string, string]> = [
    ['Base imponible', euros(importes.baseImponible)],
    ['IVA (21 %)', euros(importes.iva)],
  ];
  if (importes.descuento > 0) {
    filas.push([
      `Descuento${importes.cupon ? ` (${importes.cupon})` : ''}`,
      `<span style="color:${MARCA.verde};">&minus;${euros(importes.descuento)}</span>`,
    ]);
  }
  return `${tituloBloque('Importe')}${tablaDatos(filas)}
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-top:6px;">
<tr><td bgcolor="${MARCA.papel}" style="background:${MARCA.papel};border-radius:10px;padding:14px 16px;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr>
    <td style="font:700 15px ${FUENTE_EMAIL};color:${MARCA.tinta};">Total pagado</td>
    <td align="right" style="font:800 22px ${FUENTE_EMAIL};color:${MARCA.azulHondo};">${euros(importes.total)}</td>
  </tr></table>
</td></tr></table>
<p style="margin:8px 0 0;font:12px/1.5 ${FUENTE_EMAIL};color:${MARCA.gris};">Pago con tarjeta procesado de forma segura por Stripe. Precios con IVA incluido.</p>`;
}

function bloqueAntes(d: DatosReservaConfirmada): string {
  const consejos = ANTES_DEL_SERVICIO[d.vertical as VerticalKey];
  if (!consejos?.length) return '';
  const lista = consejos
    .map((c) => `<tr><td valign="top" width="22" style="font:700 14px ${FUENTE_EMAIL};color:${MARCA.oro};padding:4px 0;">&#9679;</td><td style="font:14px/1.55 ${FUENTE_EMAIL};color:${MARCA.tinta};padding:4px 0;">${escaparHtml(c)}</td></tr>`)
    .join('');
  return `${tituloBloque('Antes de ir')}<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">${lista}</table>`;
}

function bloqueCancelacion(d: DatosReservaConfirmada): string {
  const politica = d.servicio.politicaCancelacion?.trim()
    ? escaparHtml(d.servicio.politicaCancelacion.trim())
    : 'Puedes cancelar desde «Mis reservas». El reembolso depende de la política del comercio y de la antelación con la que canceles.';
  return `${tituloBloque('Cambios y cancelación')}
<p style="margin:0;font:14px/1.6 ${FUENTE_EMAIL};color:${MARCA.tinta};">${politica}</p>`;
}

function bloqueContacto(d: DatosReservaConfirmada): string {
  const lineas = [
    d.comercio.telefono ? `<a href="tel:${escaparHtml(d.comercio.telefono.replace(/\s+/g, ''))}" style="color:${MARCA.azul};font-weight:600;text-decoration:none;">${escaparHtml(d.comercio.telefono)}</a>` : '',
    d.comercio.email ? `<a href="mailto:${escaparHtml(d.comercio.email)}" style="color:${MARCA.azul};font-weight:600;text-decoration:none;">${escaparHtml(d.comercio.email)}</a>` : '',
  ].filter(Boolean).join('<br>');

  return `${tituloBloque('¿Necesitas algo?')}
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
<tr><td style="font:14px/1.6 ${FUENTE_EMAIL};color:${MARCA.tinta};">
  <strong>${escaparHtml(d.comercio.nombre)}</strong>${lineas ? `<br>${lineas}` : ''}
  <p style="margin:12px 0 0;color:${MARCA.tintaSuave};">Si algo no va bien con tu reserva, escríbenos desde el
  <a href="${d.urlBase}/ayuda" style="color:${MARCA.azul};">centro de ayuda</a> indicando el código <strong>${escaparHtml(d.codigo)}</strong>.</p>
</td></tr></table>`;
}

// ── Utilidades ───────────────────────────────────────────────────────────────

function capitalizar(texto: string): string {
  return texto ? texto[0].toUpperCase() + texto.slice(1) : texto;
}

function noches(inicio: Date, fin: Date): string {
  const n = Math.max(1, Math.round((fin.getTime() - inicio.getTime()) / 86_400_000));
  return n === 1 ? '1 noche' : `${n} noches`;
}

function fechaCortaAsunto(fecha: Date): string {
  // "lun 21 sept": corto para que el asunto no se corte en el móvil.
  const [dia, resto] = fechaLarga(fecha).split(', ');
  const [num, , mes] = resto.split(' ');
  return `${dia.slice(0, 3)} ${num} ${mes.slice(0, 4).replace(/^sept?$/, 'sept')}`;
}
