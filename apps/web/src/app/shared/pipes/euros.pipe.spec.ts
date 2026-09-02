import { TestBed } from '@angular/core/testing';
import { EurosFijosPipe, EurosPipe, euros } from './euros.pipe';
import { MonedaService } from '../../core/moneda/moneda.service';
import { CONVERSION_DE_MONEDA } from '../../core/moneda/conversion-de-moneda.token';
import { ConversionImporte } from '../../core/moneda/importe';

/** El pipe separa cifra y símbolo con un espacio duro, no con uno normal. */
const NBSP = ' ';

describe('EurosPipe', () => {
  let pipe: EurosPipe;
  let conversion: ConversionImporte;

  /**
   * El pipe inyecta la divisa elegida, así que se construye dentro de un
   * contexto de inyección con un `MonedaService` de mentira: lo que se prueba
   * aquí es el formato, no de dónde salen las tasas.
   */
  const crear = (conversionActiva = true): EurosPipe => {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        { provide: CONVERSION_DE_MONEDA, useValue: conversionActiva },
        { provide: MonedaService, useValue: { conversion: () => conversion } },
      ],
    });
    return TestBed.runInInjectionContext(() => new EurosPipe());
  };

  beforeEach(() => {
    conversion = { moneda: 'EUR', tasa: 1 };
    pipe = crear();
  });

  it('debería poner el símbolo detrás de la cifra', () => {
    // El motivo de existir del pipe: el cliente pidió "24 €", no "€24".
    expect(pipe.transform(24)).toBe(`24${NBSP}€`);
  });

  it('debería separar la cifra del símbolo con un espacio duro', () => {
    // Con un espacio normal el «€» se queda solo al partir la línea.
    expect(pipe.transform(24)).not.toContain(' €');
    expect(pipe.transform(24).charCodeAt(2)).toBe(0xa0);
  });

  it('debería usar la coma como separador decimal', () => {
    expect(pipe.transform(24.5)).toBe(`24,5${NBSP}€`);
  });

  it('debería usar el punto como separador de miles', () => {
    expect(pipe.transform(1234.5)).toBe(`1.234,5${NBSP}€`);
    expect(pipe.transform(12345)).toBe(`12.345${NBSP}€`);
  });

  it('debería dejar limpio un importe redondo y conservar los céntimos', () => {
    expect(pipe.transform(24)).toBe(`24${NBSP}€`);
    expect(pipe.transform(24.5)).toBe(`24,5${NBSP}€`);
  });

  it('debería forzar los dos decimales cuando se le pide', () => {
    expect(pipe.transform(24, '1.2-2')).toBe(`24,00${NBSP}€`);
  });

  it('debería aceptar un importe que llega como texto del API', () => {
    expect(pipe.transform('24.5')).toBe(`24,5${NBSP}€`);
  });

  it('debería devolver un guion cuando no hay importe', () => {
    // Un precio que aún no ha llegado no debe pintarse como si fuera gratis.
    expect(pipe.transform(null)).toBe('—');
    expect(pipe.transform(undefined)).toBe('—');
    expect(pipe.transform('')).toBe('—');
    expect(pipe.transform('no es un número')).toBe('—');
    expect(pipe.transform(Number.NaN)).toBe('—');
  });

  it('debería mostrar el cero, que sí es un importe', () => {
    expect(pipe.transform(0)).toBe(`0${NBSP}€`);
  });

  it('debería exponer la misma lógica como función, para el TypeScript', () => {
    // Varios componentes componen la cadena fuera de la plantilla.
    expect(euros(24)).toBe(pipe.transform(24));
  });

  describe('divisa elegida en la cabecera', () => {
    it('debería convertir el importe y usar el símbolo de la divisa', () => {
      conversion = { moneda: 'GBP', tasa: 0.84 };

      expect(pipe.transform(100)).toBe(`84,00${NBSP}£`);
    });

    it('debería escribir el dólar con el símbolo corto, no como «US$»', () => {
      conversion = { moneda: 'USD', tasa: 1.1 };

      expect(pipe.transform(100)).toContain('$');
      expect(pipe.transform(100)).not.toContain('US$');
    });

    it('debería seguir separando con espacio duro en cualquier divisa', () => {
      conversion = { moneda: 'CHF', tasa: 0.95 };

      expect(pipe.transform(100)).not.toContain(' ');
    });

    it('debería repintar el importe al cambiar de divisa, no servir el cacheado', () => {
      // Es justo lo que fallaba: siendo puro, el pipe devolvía el valor
      // memoizado y el selector de la cabecera no cambiaba ni un precio.
      expect(pipe.transform(100)).toBe(`100${NBSP}€`);

      conversion = { moneda: 'GBP', tasa: 0.84 };

      expect(pipe.transform(100)).toBe(`84,00${NBSP}£`);
    });

    it('debería quedarse en euros si la tasa no ha llegado', () => {
      // Un precio correcto en euros es mejor que uno inventado en libras.
      conversion = { moneda: 'GBP', tasa: Number.NaN };

      expect(pipe.transform(100)).toBe(`100${NBSP}€`);
    });

    it('no debería convertir donde la conversión está desactivada', () => {
      // El panel de admin y el del comercio: ahí los importes son contabilidad.
      conversion = { moneda: 'GBP', tasa: 0.84 };
      const contable = crear(false);

      expect(contable.transform(100)).toBe(`100${NBSP}€`);
    });
  });
});

describe('EurosFijosPipe', () => {
  const pipe = new EurosFijosPipe();

  it('debería formatear siempre en euros, aunque haya otra divisa elegida', () => {
    // Es el importe que se carga en la tarjeta, no una orientación.
    expect(pipe.transform(100)).toBe(`100${NBSP}€`);
    expect(pipe.transform(24, '1.2-2')).toBe(`24,00${NBSP}€`);
  });

  it('debería devolver un guion cuando no hay importe', () => {
    expect(pipe.transform(null)).toBe('—');
  });
});
