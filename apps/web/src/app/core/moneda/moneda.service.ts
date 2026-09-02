import { Injectable, Injector, computed, inject, signal } from '@angular/core';
import { MONEDAS_SOPORTADAS, MONEDA_DEFAULT, MONEDA_SIMBOLOS, MonedaSoportada } from 'shared';
import { GeoService, TiposDeCambio } from '../geo/geo.service';
import { ConversionImporte, convertirImporte, formatearImporte } from './importe';

const CLAVE_MONEDA = 'doogking_moneda';

const SIN_CAMBIO: TiposDeCambio = { base: 'EUR', fecha: '', tasas: { EUR: 1 } };

/**
 * Moneda y país de **visualización**. El cobro sigue siendo siempre en EUR
 * (§9 de CLAUDE.md): esto solo traduce los importes para que el usuario se haga
 * una idea, y toda cifra convertida se etiqueta como aproximada.
 */
@Injectable({ providedIn: 'root' })
export class MonedaService {
  /*
   * `GeoService` se resuelve al pedir las tasas, no al construir el servicio.
   * Inyectarlo aquí arrastraba `HttpClient` detrás, y como el pipe de importes
   * depende de este servicio, cualquier test de un componente con un precio en
   * pantalla tenía que proveer `HttpClient` para pintar «24 €». Al ser perezoso
   * el camino por defecto —euros, sin conversión— no toca la red ni la pide.
   */
  private readonly injector = inject(Injector);

  readonly monedas = MONEDAS_SOPORTADAS;

  readonly moneda = signal<MonedaSoportada>(this.leerMoneda());

  /**
   * Tipos de cambio bajo demanda: la inmensa mayoría de usuarios paga en euros
   * y nunca toca el selector, así que no se pide nada al cargar la cabecera.
   */
  private readonly cambio = signal<TiposDeCambio>(SIN_CAMBIO);
  private cambioPedido = false;

  /**
   * Divisa de visualización y su tasa, en una sola señal.
   *
   * Es lo que leen `EurosPipe` y las pantallas que formatean importes por su
   * cuenta: al ir junto, un componente no puede quedarse con la divisa nueva y
   * la tasa vieja, que pintaría libras a la tasa del euro.
   */
  readonly conversion = computed<ConversionImporte>(() => ({
    moneda: this.moneda(),
    /*
     * `NaN` —no 1— cuando el cambio todavía no ha llegado o no trae esa
     * divisa. Con 1 se pintarían los euros con el símbolo del franco, que es
     * peor que no convertir: el precio saldría igual pero diciendo otra cosa.
     */
    tasa: this.cambio().tasas[this.moneda()] ?? Number.NaN,
  }));

  /**
   * true cuando los importes se muestran en una divisa distinta a la de cobro
   * **y además hay tasa para hacerlo**. Sin tasa se siguen pintando euros, así
   * que avisar de una conversión que no ha ocurrido confundiría más que callar.
   */
  readonly esConvertida = computed(() => {
    const { moneda, tasa } = this.conversion();
    return moneda !== MONEDA_DEFAULT && Number.isFinite(tasa) && tasa > 0;
  });

  constructor() {
    if (this.moneda() !== MONEDA_DEFAULT) this.cargarCambio();
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
    return convertirImporte(importeEur, this.conversion());
  }

  /**
   * Importe formateado en la moneda elegida, ya convertido.
   *
   * Lo usan las pantallas que componen textos con precios dentro —«50 € × 3
   * noches», los chips de filtro— y que por tanto no pueden pasar por el pipe.
   * Al leer `conversion()`, cualquier `computed` o plantilla que lo llame se
   * recalcula sola cuando el usuario cambia de divisa.
   */
  formatear(importeEur: number | string | null | undefined, digitos = '1.0-2'): string {
    return formatearImporte(importeEur, digitos, this.conversion());
  }

  private cargarCambio(): void {
    if (this.cambioPedido) return;
    this.cambioPedido = true;
    this.injector.get(GeoService).tiposDeCambio().subscribe((tasas) => this.cambio.set(tasas));
  }

  private leerMoneda(): MonedaSoportada {
    const guardada = localStorage.getItem(CLAVE_MONEDA) as MonedaSoportada | null;
    return guardada && MONEDAS_SOPORTADAS.includes(guardada) ? guardada : MONEDA_DEFAULT;
  }
}
