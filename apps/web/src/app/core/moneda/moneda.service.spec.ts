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

});
