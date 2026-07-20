import { VerticalKey } from '../../enums/vertical.enum';

/** Resumen de un servicio favorito, listo para pintar la tarjeta en el front. */
export interface FavoritoResumenDto {
  servicioId: string;
  titulo: string;
  imagen: string | null;
  ciudad: string;
  vertical: VerticalKey;
  precioBase: number;
  moneda: string;
  ratingPromedio: number;
  totalResenas: number;
  createdAt: string;
}
