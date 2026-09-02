import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { GeoService, TiposDeCambio } from '../geo/geo.service';
import { MonedaService } from './moneda.service';

const cambio: TiposDeCambio = {
  base: 'EUR',
  fecha: '2026-07-24',
  tasas: { EUR: 1, GBP: 0.84, USD: 1.09 },
};

describe('MonedaService', () => {
  const crear = (tasas: TiposDeCambio = cambio): MonedaService => {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        MonedaService,
        { provide: GeoService, useValue: { tiposDeCambio: () => of(tasas) } },
      ],
    });
    return TestBed.inject(MonedaService);
  };

  beforeEach(() => localStorage.clear());

  it('debería arrancar en euros, la moneda de cobro', () => {
    const service = crear();

    expect(service.moneda()).toBe('EUR');
    expect(service.esConvertida()).toBe(false);
    expect(service.convertir(100)).toBe(100);
  });

  it('debería convertir a la moneda elegida y marcarla como conversión', () => {
    const service = crear();

    service.elegirMoneda('GBP');

    expect(service.convertir(100)).toBe(84);
    expect(service.simbolo()).toBe('£');
    expect(service.esConvertida()).toBe(true);
  });

  it('debería recordar la moneda entre sesiones', () => {
    crear().elegirMoneda('USD');

    expect(crear().moneda()).toBe('USD');
  });

  it('debería ignorar una moneda guardada que ya no se soporta', () => {
    localStorage.setItem('doogking_moneda', 'JPY');

    expect(crear().moneda()).toBe('EUR');
  });

  it('debería devolver el importe en euros si falta la tasa, en vez de inventarla', () => {
    const service = crear({ base: 'EUR', fecha: '', tasas: { EUR: 1 } });

    service.elegirMoneda('CHF');

    expect(service.convertir(100)).toBe(100);
  });

  it('no debería anunciar una conversión que no ha podido hacer', () => {
    // Sin tasa se siguen pintando euros: avisar de una conversión que no ha
    // ocurrido confunde más que callar.
    const service = crear({ base: 'EUR', fecha: '', tasas: { EUR: 1 } });

    service.elegirMoneda('CHF');

    expect(service.esConvertida()).toBe(false);
  });

  describe('conversion()', () => {
    it('debería llevar divisa y tasa juntas, para que no se descuadren', () => {
      const service = crear();

      service.elegirMoneda('GBP');

      expect(service.conversion()).toEqual({ moneda: 'GBP', tasa: 0.84 });
    });

    it('debería marcar la tasa como desconocida si el cambio no trae la divisa', () => {
      // No vale caer a 1: pintaría los euros con el símbolo del franco.
      const service = crear();

      service.elegirMoneda('CHF');

      expect(service.conversion().moneda).toBe('CHF');
      expect(Number.isNaN(service.conversion().tasa)).toBe(true);
    });
  });

  describe('formatear()', () => {
    it('debería formatear en euros mientras no se cambie de divisa', () => {
      expect(crear().formatear(1234.5)).toBe('1.234,5\u00a0€');
    });

    it('debería formatear ya convertido en la divisa elegida', () => {
      const service = crear();

      service.elegirMoneda('GBP');

      expect(service.formatear(100)).toBe('84,00\u00a0£');
    });

    it('debería devolver un guion cuando no hay importe', () => {
      expect(crear().formatear(null)).toBe('—');
    });
  });

});
