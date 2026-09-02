import { Injectable, inject, signal } from '@angular/core';
import { MONEDAS_SOPORTADAS, MONEDA_DEFAULT, MONEDA_SIMBOLOS, MonedaSoportada } from 'shared';
import { GeoService, TiposDeCambio } from '../geo/geo.service';

const CLAVE_MONEDA = 'doogking_moneda';

const SIN_CAMBIO: TiposDeCambio = { base: 'EUR', fecha: '', tasas: { EUR: 1 } };

/**
 * Moneda y país de **visualización**. El cobro sigue siendo siempre en EUR
 * (§9 de CLAUDE.md): esto solo traduce los importes para que el usuario se haga
 * una idea, y toda cifra convertida se etiqueta como aproximada.
 */
@Injectable({ providedIn: 'root' })
export class MonedaService {
  private readonly geoService = inject(GeoService);

  readonly monedas = MONEDAS_SOPORTADAS;

  readonly moneda = signal<MonedaSoportada>(this.leerMoneda());

  /**
   * Tipos de cambio bajo demanda: la inmensa mayoría de usuarios paga en euros
   * y nunca toca el selector, así que no se pide nada al cargar la cabecera.
   */
  private readonly cambio = signal<TiposDeCambio>(SIN_CAMBIO);
  private cambioPedido = false;

  constructor() {
    if (this.moneda() !== MONEDA_DEFAULT) this.cargarCambio();
  }

  /** true cuando los importes se muestran en una divisa distinta a la de cobro. */
  esConvertida(): boolean {
    return this.moneda() !== MONEDA_DEFAULT;
  }

  elegirMoneda(moneda: MonedaSoportada): void {
    this.moneda.set(moneda);
    localStorage.setItem(CLAVE_MONEDA, moneda);
    if (moneda !== MONEDA_DEFAULT) this.cargarCambio();
  }

  simbolo(): string {
    return MONEDA_SIMBOLOS[this.moneda()];
  }

  /**
   * Convierte un importe en euros a la moneda elegida. Si no hay tasa
   * disponible devuelve el importe original: mejor un precio correcto en euros
   * que uno inventado en otra divisa.
   */
  convertir(importeEur: number): number {
    const tasa = this.cambio().tasas[this.moneda()];
    if (!tasa || !Number.isFinite(tasa)) return importeEur;
    return Math.round(importeEur * tasa * 100) / 100;
  }

  /** Importe formateado en la moneda elegida, ya convertido. */
  formatear(importeEur: number): string {
    const valor = this.convertir(importeEur);
    return new Intl.NumberFormat('es-ES', {
      style: 'currency',
      currency: this.moneda(),
      maximumFractionDigits: 2,
    }).format(valor);
  }

  private cargarCambio(): void {
    if (this.cambioPedido) return;
    this.cambioPedido = true;
    this.geoService.tiposDeCambio().subscribe((tasas) => this.cambio.set(tasas));
  }

  private leerMoneda(): MonedaSoportada {
    const guardada = localStorage.getItem(CLAVE_MONEDA) as MonedaSoportada | null;
    return guardada && MONEDAS_SOPORTADAS.includes(guardada) ? guardada : MONEDA_DEFAULT;
  }
}
