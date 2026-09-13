import { VerticalKey } from '../enums/vertical.enum';
import {
  CAMPOS_REGISTRO_SERVICIO, VERTICALES_CON_HISTORIAL, camposDeRegistro, limpiarDatosRegistro, tieneHistorialDeServicio,
} from './registro-servicio';

describe('registro de servicio', () => {
  it('debería definir campos para cada categoría con historial, sin claves repetidas', () => {
    for (const vertical of VERTICALES_CON_HISTORIAL) {
      const claves = (CAMPOS_REGISTRO_SERVICIO[vertical] ?? []).map((c) => c.clave);
      expect(claves.length).toBeGreaterThan(0);
      expect(new Set(claves).size).toBe(claves.length);
    }
  });

  it('debería saber qué categorías llevan historial', () => {
    expect(tieneHistorialDeServicio(VerticalKey.PELUQUERIA)).toBe(true);
    expect(tieneHistorialDeServicio(VerticalKey.ALOJAMIENTO)).toBe(false);
    expect(camposDeRegistro('inventada')).toEqual([]);
  });

  it('debería limpiar los datos: claves conocidas, texto recortado y números con coma', () => {
    const limpio = limpiarDatosRegistro(VerticalKey.VETERINARIA, {
      diagnostico: '  Otitis  ', tratamiento: '   ', pesoKg: '12,5', temperaturaC: 38.6, inventado: 'x', motivo: 3,
    });
    expect(limpio).toEqual({ diagnostico: 'Otitis', pesoKg: 12.5, temperaturaC: 38.6 });
  });

  it('debería descartar números vacíos o no válidos', () => {
    expect(limpiarDatosRegistro(VerticalKey.VETERINARIA, { pesoKg: '', temperaturaC: 'abc' })).toEqual({});
    expect(limpiarDatosRegistro(VerticalKey.VETERINARIA, undefined)).toEqual({});
  });
});
