import { VerticalKey } from 'shared';

/** Icono rs-icon por vertical canina de Doogking (consistente con home.component.ts). */
export const VERTICAL_ICON: Record<string, string> = {
  [VerticalKey.ALOJAMIENTO]: 'hotel',
  [VerticalKey.TRANSPORTE]: 'truck',
  [VerticalKey.VETERINARIA]: 'stethoscope',
  [VerticalKey.PELUQUERIA]: 'scissors',
  [VerticalKey.ADIESTRAMIENTO]: 'graduation-cap',
  [VerticalKey.HOTELES]: 'building',
};

export function iconoVertical(vertical: string): string {
  return VERTICAL_ICON[vertical] ?? 'paw';
}
