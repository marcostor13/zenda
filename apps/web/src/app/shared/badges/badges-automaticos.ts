import type { BadgeVariant } from '../components/badge/rs-badge.component';

export interface BadgeAutomatico {
  /** Nombre de icono de `rs-icon` (Lucide). Nunca un emoji: TCK-8010. */
  icon: string;
  label: string;
  variant: BadgeVariant;
}

/** Datos mínimos que necesita un servicio/listado para calcular sus badges. */
export interface ServicioParaBadges {
  destacado?: boolean;
  score?: number;
  numResenas?: number;
  reservasUltimoMes?: number;
  respuestaRapidaMin?: number;
  plazasRestantes?: number | null;
  /** El comercio está adherido al programa Doogking Alpha (HU-13.3). */
  alphaAdherido?: boolean;
}

const UMBRAL_MEJOR_VALORADO = 4.7;
const UMBRAL_MIN_RESENAS = 20;
const UMBRAL_MAS_RESERVADO = 15;
const UMBRAL_RESPUESTA_RAPIDA_MIN = 60;
const UMBRAL_ULTIMAS_PLAZAS = 3;

/**
 * Calcula los badges "automáticos" de HU-0.9 a partir de datos reales del
 * servicio. Nunca a partir de texto manual — si el servicio no cumple el
 * umbral, el badge no aparece.
 */
export function calcularBadgesAutomaticos(s: ServicioParaBadges): BadgeAutomatico[] {
  const badges: BadgeAutomatico[] = [];

  if (s.destacado) {
    badges.push({ icon: 'sparkles', label: 'Recomendado', variant: 'accent' });
  }
  if ((s.reservasUltimoMes ?? 0) >= UMBRAL_MAS_RESERVADO) {
    badges.push({ icon: 'trending-up', label: 'Más reservado', variant: 'success' });
  }
  if ((s.score ?? 0) >= UMBRAL_MEJOR_VALORADO && (s.numResenas ?? 0) >= UMBRAL_MIN_RESENAS) {
    badges.push({ icon: 'trophy', label: 'Mejor valorado', variant: 'warning' });
  }
  if (s.respuestaRapidaMin != null && s.respuestaRapidaMin <= UMBRAL_RESPUESTA_RAPIDA_MIN) {
    badges.push({ icon: 'zap', label: 'Responde en < 1 h', variant: 'neutral' });
  }
  if (s.plazasRestantes != null && s.plazasRestantes > 0 && s.plazasRestantes <= UMBRAL_ULTIMAS_PLAZAS) {
    badges.push({ icon: 'hourglass', label: 'Últimas plazas', variant: 'error' });
  }
  if (s.alphaAdherido) {
    badges.push({ icon: 'crown', label: 'Ventajas Alpha', variant: 'accent' });
  }

  return badges;
}
