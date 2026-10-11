import { VerticalKey } from '../../enums/vertical.enum';

/** Resumen de un servicio favorito, listo para pintar la tarjeta en el front. */
export interface FavoritoResumenDto {
  servicioId: string;
  /** Dirección legible de la ficha, para enlazarla sin el id. */
  servicioSlug?: string;
  titulo: string;
  imagen: string | null;
  ciudad: string;
  /** Km al centro de su población; ausente si el servicio no tiene coordenadas. */
  distanciaCentroKm?: number;
  vertical: VerticalKey;
  precioBase: number;
  moneda: string;
  ratingPromedio: number;
  totalResenas: number;
  createdAt: string;
  /** Presente solo si el precio ha bajado desde que se guardó como favorito (HU-10.4). */
  precioAnterior?: number;
}
