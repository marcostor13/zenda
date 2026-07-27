import { Injectable, computed, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { AnadirItemCarritoDto, ValidacionCarritoDto } from 'shared';
import { environment } from '../../../environments/environment';

export interface ItemCarritoApi {
  itemId: string;
  servicioId: string;
  comercioId: string;
  vertical: string;
  titulo: string;
  fechaInicio: string;
  fechaFin?: string;
  cantidad: number;
  perroIds: string[];
  precioEstimado: number;
  esReservaMadre: boolean;
}

export interface CarritoApi {
  _id: string;
  estado: 'abierto' | 'procesando' | 'confirmado' | 'abandonado';
  items: ItemCarritoApi[];
  reservaIds: string[];
}

export interface PaymentIntentApi {
  clientSecret: string;
  pagoId: string;
  montoTotal: number;
  moneda: string;
}

/**
 * Estado del viaje en curso. Se mantiene en una señal para que el indicador de
 * la cabecera y el panel lateral no tengan que volver a pedirlo al API cada vez.
 */
@Injectable({ providedIn: 'root' })
export class CarritoService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiUrl}/carrito`;

  readonly carrito = signal<CarritoApi | null>(null);

  readonly items = computed(() => this.carrito()?.items ?? []);
  readonly numItems = computed(() => this.items().length);
  readonly totalEstimado = computed(() =>
    Math.round(this.items().reduce((suma, i) => suma + i.precioEstimado, 0) * 100) / 100,
  );

  async cargar(): Promise<CarritoApi | null> {
    try {
      const carrito = await firstValueFrom(this.http.get<CarritoApi>(this.base));
      this.carrito.set(carrito);
      return carrito;
    } catch {
      // Sin sesión el viaje simplemente no existe todavía; no es un error visible.
      this.carrito.set(null);
      return null;
    }
  }

  async anadir(dto: AnadirItemCarritoDto): Promise<CarritoApi> {
    const carrito = await firstValueFrom(this.http.post<CarritoApi>(`${this.base}/items`, dto));
    this.carrito.set(carrito);
    return carrito;
  }

  async quitar(itemId: string): Promise<CarritoApi> {
    const carrito = await firstValueFrom(
      this.http.delete<CarritoApi>(`${this.base}/items/${itemId}`),
    );
    this.carrito.set(carrito);
    return carrito;
  }

  validar(): Promise<ValidacionCarritoDto> {
    return firstValueFrom(this.http.post<ValidacionCarritoDto>(`${this.base}/validar`, {}));
  }

  /** Crea las reservas y devuelve el pago único del viaje. */
  checkout(): Promise<PaymentIntentApi> {
    return firstValueFrom(this.http.post<PaymentIntentApi>(`${this.base}/checkout`, {}));
  }
}
