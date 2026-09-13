import { partesEnZona } from 'shared';

/**
 * Piezas comunes de los correos de Doogking.
 *
 * Los correos no son páginas web: Gmail recorta los `<style>`, Outlook pinta con
 * el motor de Word y no entiende flexbox ni `border-radius` en todo. Por eso aquí
 * se maqueta con tablas y estilos en línea, a 600 px, con fuentes de sistema y
 * colores de marca escritos a mano (el correo no ve los tokens de la web).
 */

export const MARCA = {
  azul: '#08258B',
  azulHondo: '#00135D',
  oro: '#FBAE17',
  oroSuave: '#FFF6E0',
  tinta: '#16203A',
  tintaSuave: '#5B6472',
  gris: '#8B9BBC',
  papel: '#F4F6FA',
  borde: '#E3E8F2',
  blanco: '#FFFFFF',
  verde: '#047857',
  verdeSuave: '#E7F6EF',
} as const;

const FUENTE = "-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif";

/**
 * Escapa lo que viene de un usuario (nombres, títulos, notas) antes de meterlo
 * en el HTML. Sin esto, un comercio llamado `<a href=…>` inyectaba un enlace en
 * el correo de todos sus clientes.
 */
export function escaparHtml(texto: unknown): string {
  return String(texto ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export interface LayoutEmail {
  /** Texto que el cliente de correo enseña junto al asunto en la bandeja. */
  readonly preheader: string;
  readonly contenido: string;
  readonly urlBase: string;
}

/** Marco común: cabecera azul con logo, tarjeta blanca y pie con enlaces. */
export function layoutEmail({ preheader, contenido, urlBase }: LayoutEmail): string {
  const logo = `${urlBase}/images/logo-doogking-footer.png`;
  return `<!doctype html>
<html lang="es" xmlns="http://www.w3.org/1999/xhtml">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="x-apple-disable-message-reformatting">
<meta name="color-scheme" content="light only">
<title>Doogking</title>
</head>
<body style="margin:0;padding:0;background:${MARCA.papel};-webkit-text-size-adjust:100%;">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;">${escaparHtml(preheader)}&#8202;&zwnj;&nbsp;&#8202;&zwnj;&nbsp;</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${MARCA.papel};">
<tr><td align="center" style="padding:24px 12px;">
  <table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="width:100%;max-width:600px;">
    <tr><td align="center" bgcolor="${MARCA.azul}" style="background:${MARCA.azul};border-radius:16px 16px 0 0;padding:22px 24px;">
      <a href="${urlBase}" style="text-decoration:none;">
        <img src="${logo}" width="150" alt="Doogking" style="display:block;width:150px;max-width:150px;height:auto;border:0;color:${MARCA.blanco};font:700 22px ${FUENTE};">
      </a>
    </td></tr>
    <tr><td height="4" bgcolor="${MARCA.oro}" style="background:${MARCA.oro};font-size:0;line-height:0;">&nbsp;</td></tr>
    <tr><td bgcolor="${MARCA.blanco}" style="background:${MARCA.blanco};border-radius:0 0 16px 16px;padding:32px 32px 28px;font-family:${FUENTE};color:${MARCA.tinta};">
      ${contenido}
    </td></tr>
    <tr><td align="center" style="padding:24px 16px 8px;font-family:${FUENTE};font-size:12px;line-height:18px;color:${MARCA.gris};">
      <strong style="color:${MARCA.tintaSuave};">Doogking</strong> · Todo para su rey, en un solo lugar<br>
      <a href="${urlBase}/reservas/mis-reservas" style="color:${MARCA.gris};">Mis reservas</a> ·
      <a href="${urlBase}/ayuda" style="color:${MARCA.gris};">Centro de ayuda</a> ·
      <a href="${urlBase}/contacto" style="color:${MARCA.gris};">Contacto</a><br>
      Recibes este correo porque has hecho una reserva en Doogking.
    </td></tr>
  </table>
</td></tr>
</table>
</body>
</html>`;
}

/** Botón que se ve igual en Outlook (tabla con fondo) y en el resto. */
export function boton(texto: string, url: string): string {
  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="display:inline-table;margin:4px;">
<tr><td align="center" bgcolor="${MARCA.azul}" style="background:${MARCA.azul};border:1px solid ${MARCA.azul};border-radius:999px;">
<a href="${url}" style="display:inline-block;padding:13px 26px;font:700 15px ${FUENTE};color:${MARCA.blanco};text-decoration:none;border-radius:999px;">${escaparHtml(texto)}</a>
</td></tr></table>`;
}

/** Título de bloque: versalitas azules. */
export function tituloBloque(texto: string): string {
  return `<p style="margin:28px 0 10px;font:700 12px ${FUENTE};letter-spacing:1.4px;text-transform:uppercase;color:${MARCA.azul};">${escaparHtml(texto)}</p>`;
}

/** Filas etiqueta / valor. El valor ya viene escapado o es HTML de confianza. */
export function tablaDatos(filas: ReadonlyArray<readonly [string, string]>): string {
  const cuerpo = filas
    .map(([etiqueta, valor], i) => `<tr>
<td valign="top" style="padding:10px 0;${i ? `border-top:1px solid ${MARCA.borde};` : ''}width:38%;font:14px ${FUENTE};color:${MARCA.tintaSuave};">${escaparHtml(etiqueta)}</td>
<td valign="top" style="padding:10px 0;${i ? `border-top:1px solid ${MARCA.borde};` : ''}font:600 14px ${FUENTE};color:${MARCA.tinta};">${valor}</td>
</tr>`)
    .join('');
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">${cuerpo}</table>`;
}

export const FUENTE_EMAIL = FUENTE;

// ── Formato (calendario de España) ───────────────────────────────────────────

const DIAS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];

/**
 * "lunes, 21 de septiembre de 2026". Los nombres se ponen a mano: la imagen del
 * contenedor no garantiza los textos del locale, y el día es el de Madrid, no
 * el del servidor.
 */
export function fechaLarga(fecha: Date): string {
  const p = partesEnZona(fecha);
  return `${DIAS[p.diaSemana]}, ${p.dia} de ${MESES[p.mes - 1]} de ${p.anio}`;
}

export function horaCorta(fecha: Date): string {
  const p = partesEnZona(fecha);
  return `${String(p.hora).padStart(2, '0')}:${String(p.minuto).padStart(2, '0')}`;
}

/** "1.234,50 €": así se escribe un importe en España. */
export function euros(importe: number): string {
  const [entero, decimales] = (Math.round(importe * 100) / 100).toFixed(2).split('.');
  return `${entero.replace(/\B(?=(\d{3})+(?!\d))/g, '.')},${decimales} €`;
}
