import { FormGroup, NonNullableFormBuilder, Validators } from '@angular/forms';
import { EspecieMascota, ModalidadTransporte, PreferenciaTransporte } from 'shared';

/** Cómo se llamaban en las fichas antiguas las características que ahora son «incluidos». */
const CARACTERISTICA_A_INCLUIDO: Record<string, PreferenciaTransporte> = {
  climatizacion: PreferenciaTransporte.CLIMATIZACION,
  gps: PreferenciaTransporte.SEGUIMIENTO,
  seguimiento_gps: PreferenciaTransporte.SEGUIMIENTO,
  puerta_a_puerta: PreferenciaTransporte.PUERTA_A_PUERTA,
};

/**
 * Tarifario de una ficha guardada antes del flujo nuevo: modalidades, especies
 * e incluidos se deducen de lo que ya tenía, igual que hace el API
 * (`verticals/transporte/transporte.tarifario.ts`). Así el formulario abre con
 * lo que el cliente ya ve, en vez de con valores por defecto que no coinciden.
 *
 * Sólo rellena lo que falta: lo que el comercio ya guardó con el formulario
 * nuevo se respeta tal cual.
 */
export function tarifarioDeFichaAntigua(d: Record<string, unknown>): Record<string, unknown> {
  const cambios: Record<string, unknown> = {};
  const tipos = (d['tiposTransporteOfrecidos'] as string[] | undefined) ?? [];

  if (!(d['modalidades'] as string[] | undefined)?.length) {
    const soloExclusivo = tipos.includes('exclusivo') && !tipos.includes('compartido');
    const modalidades: string[] = soloExclusivo ? [] : [ModalidadTransporte.COMPARTIDO];
    if (tipos.includes('exclusivo') || d['precioExclusivo'] != null) modalidades.push(ModalidadTransporte.EXCLUSIVO);
    cambios['modalidades'] = modalidades;
  }
  if (!(d['especiesAceptadas'] as string[] | undefined)?.length) {
    cambios['especiesAceptadas'] = d['soloPerros'] === false
      ? [EspecieMascota.PERRO, EspecieMascota.GATO]
      : [EspecieMascota.PERRO];
  }
  if (!(d['incluidos'] as string[] | undefined)?.length) {
    const incluidos = new Set<string>();
    for (const c of (d['caracteristicasVehiculo'] as string[] | undefined) ?? []) {
      if (CARACTERISTICA_A_INCLUIDO[c]) incluidos.add(CARACTERISTICA_A_INCLUIDO[c]);
    }
    if (d['tipoVehiculo'] === 'furgon_climatizado') incluidos.add(PreferenciaTransporte.CLIMATIZACION);
    if (d['jaulasIncluidas']) incluidos.add(PreferenciaTransporte.TRANSPORTIN_INCLUIDO);
    cambios['incluidos'] = [...incluidos];
  }
  return cambios;
}

/** Una fila «provincia → provincia: precio» del modo por zonas. */
export function zonaPrecioGrupo(fb: NonNullableFormBuilder, z: Record<string, unknown> = {}): FormGroup {
  return fb.group({
    origen: [(z['origen'] as string | undefined) ?? '', Validators.required],
    destino: [(z['destino'] as string | undefined) ?? '', Validators.required],
    precio: [(z['precio'] as number | undefined) ?? (null as number | null), [Validators.required, Validators.min(0)]],
  });
}
