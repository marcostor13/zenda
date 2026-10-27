import { comisionDesdePorcentaje, porcentajeDesdeComision } from './comision-comercio';

describe('comision-comercio', () => {
  it('debería convertir el porcentaje escrito en la fracción que se guarda', () => {
    expect(comisionDesdePorcentaje(12)).toBe(0.12);
    expect(comisionDesdePorcentaje('7.5')).toBe(0.075);
  });

  it('debería devolver null cuando el campo está vacío, para volver a la del vertical', () => {
    expect(comisionDesdePorcentaje('')).toBeNull();
    expect(comisionDesdePorcentaje(null)).toBeNull();
    expect(comisionDesdePorcentaje(undefined)).toBeNull();
    expect(comisionDesdePorcentaje('abc')).toBeNull();
  });

  it('debería enseñar la fracción guardada como porcentaje', () => {
    expect(porcentajeDesdeComision(0.12)).toBe(12);
    expect(porcentajeDesdeComision(0.075)).toBe(7.5);
    expect(porcentajeDesdeComision(null)).toBeNull();
  });
});
