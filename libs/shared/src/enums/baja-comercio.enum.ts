/**
 * Motivos por los que un comercio se pausa o se da de baja de la plataforma.
 *
 * Se piden **siempre**: una baja sin motivo es una métrica perdida. Los motivos
 * cerrados alimentan el reporte de churn del admin; `OTRO` obliga a escribir el
 * detalle a mano (ver `BajaComercioDto.comentario`).
 */
export enum MotivoBajaComercio {
  POCAS_RESERVAS = 'pocas_reservas',
  COMISION_ALTA = 'comision_alta',
  CIERRE_NEGOCIO = 'cierre_negocio',
  PAUSA_TEMPORADA = 'pausa_temporada',
  FALTA_TIEMPO = 'falta_tiempo',
  PLATAFORMA_COMPLEJA = 'plataforma_compleja',
  OTRA_PLATAFORMA = 'otra_plataforma',
  FALTAN_FUNCIONES = 'faltan_funciones',
  PROBLEMAS_PAGOS = 'problemas_pagos',
  OTRO = 'otro',
}

export interface OpcionMotivoBaja {
  readonly valor: MotivoBajaComercio;
  readonly label: string;
  /** Si es true, el comentario libre pasa a ser obligatorio. */
  readonly requiereDetalle?: boolean;
}

/** Catálogo que pintan tanto el panel del comercio como el del admin. */
export const MOTIVOS_BAJA_COMERCIO: ReadonlyArray<OpcionMotivoBaja> = [
  { valor: MotivoBajaComercio.POCAS_RESERVAS, label: 'No recibo suficientes reservas' },
  { valor: MotivoBajaComercio.COMISION_ALTA, label: 'La comisión me parece alta' },
  { valor: MotivoBajaComercio.CIERRE_NEGOCIO, label: 'Cierro o traspaso el negocio' },
  { valor: MotivoBajaComercio.PAUSA_TEMPORADA, label: 'Es una pausa de temporada' },
  { valor: MotivoBajaComercio.FALTA_TIEMPO, label: 'No tengo tiempo de gestionarlo' },
  { valor: MotivoBajaComercio.PLATAFORMA_COMPLEJA, label: 'La plataforma me resulta complicada' },
  { valor: MotivoBajaComercio.OTRA_PLATAFORMA, label: 'Me voy a otra plataforma' },
  { valor: MotivoBajaComercio.FALTAN_FUNCIONES, label: 'Faltan funciones que necesito', requiereDetalle: true },
  { valor: MotivoBajaComercio.PROBLEMAS_PAGOS, label: 'He tenido problemas con los cobros', requiereDetalle: true },
  { valor: MotivoBajaComercio.OTRO, label: 'Otro motivo', requiereDetalle: true },
];

export const MOTIVOS_BAJA_CON_DETALLE: ReadonlyArray<MotivoBajaComercio> = MOTIVOS_BAJA_COMERCIO
  .filter((m) => m.requiereDetalle)
  .map((m) => m.valor);

export function etiquetaMotivoBaja(motivo: MotivoBajaComercio | string): string {
  return MOTIVOS_BAJA_COMERCIO.find((m) => m.valor === motivo)?.label ?? 'Motivo no indicado';
}

/** Quién ejecutó la baja: el propio comercio o el equipo de la plataforma. */
export type OrigenBajaComercio = 'comercio' | 'admin';
