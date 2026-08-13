import { Injectable, inject } from '@angular/core';
import { VerticalKey } from 'shared';
import {
  CatalogBrowseService, type OpcionesBusqueda,
} from '../../verticales/catalog-browse.service';

export interface ServicioCard {
  id: string;
  nombre: string;
  ciudad: string;
  comercioId?: string;
  precioPorNoche: number;
  score: number;
  scoreLabel: string;
  numResenas: number;
  imagenes: string[];
  destacado: boolean;
  alphaAdherido?: boolean;
  vertical?: string;
  extra?: Record<string, unknown>;
}

export interface PaginatedResult<T> {
  items: T[];
  total: number;
  page: number;
  totalPages: number;
}

export type TipoVehiculoTransporte = 'van_acondicionada' | 'coche' | 'furgon_climatizado';

export interface TransporteCard {
  id: string;
  nombre: string;
  ciudad: string;
  imagen: string;
  comercioId: string;
  tipoVehiculo: TipoVehiculoTransporte;
  capacidadPerros: number;
  zonaCobertura: string[];
  tarifaBase: number;
  tarifaKm: number;
  jaulasIncluidas: boolean;
  acompananteHumano: boolean;
  destacado: boolean;
  /** El comercio ofrece ventajas del programa Doogking Alpha (HU-13.3). */
  alphaAdherido?: boolean;
  score: number;
  scoreLabel: string;
  numResenas: number;
}

@Injectable({ providedIn: 'root' })
export class TransporteService {
  private readonly browse = inject(CatalogBrowseService);

  /**
   * Delega la construcción de parámetros en `CatalogBrowseService`, que es el
   * que conoce los filtros comunes y los del mapa, y solo se queda con la
   * traducción a `TransporteCard`. Así el listado de transporte filtra
   * exactamente igual que el resto de verticales.
   */
  async buscar(opciones: OpcionesBusqueda = {}): Promise<TransporteCard[]> {
    const items = await this.browse.buscar(VerticalKey.TRANSPORTE, opciones);
    return items.map((s) => this.toTransporte(s as ServicioCard));
  }

  private toTransporte(s: ServicioCard): TransporteCard {
    const e = s.extra ?? {};
    return {
      id: s.id,
      nombre: s.nombre,
      ciudad: s.ciudad,
      imagen: s.imagenes?.[0] ?? '',
      comercioId: s.comercioId ?? '',
      tipoVehiculo: (e['tipoVehiculo'] as TipoVehiculoTransporte) ?? 'coche',
      capacidadPerros: (e['capacidadPerros'] as number) ?? 1,
      zonaCobertura: (e['zonaCobertura'] as string[]) ?? [],
      tarifaBase: (e['tarifaBase'] as number) ?? s.precioPorNoche,
      tarifaKm: (e['tarifaKm'] as number) ?? 0,
      jaulasIncluidas: (e['jaulasIncluidas'] as boolean) ?? false,
      acompananteHumano: (e['acompananteHumano'] as boolean) ?? false,
      destacado: s.destacado,
      alphaAdherido: s.alphaAdherido,
      score: s.score,
      scoreLabel: s.scoreLabel,
      numResenas: s.numResenas,
    };
  }
}
