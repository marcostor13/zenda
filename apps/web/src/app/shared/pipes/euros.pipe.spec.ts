import { EurosPipe, euros } from './euros.pipe';

/** El pipe separa cifra y símbolo con un espacio duro, no con uno normal. */
const NBSP = ' ';

describe('EurosPipe', () => {
  let pipe: EurosPipe;

  beforeEach(() => {
    pipe = new EurosPipe();
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
});
