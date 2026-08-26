import { TamanoPerro } from '../enums/perro.enum';
import {
  TAMANOS_PERRO, ORDEN_TAMANOS_PERRO, cabeEnTamano, etiquetaTamanoPerro, nombreTamanoPerro,
} from './tamanos-perro';

describe('TAMANOS_PERRO', () => {
  it('debería cubrir el enum entero: un tamaño sin opción no se puede elegir al reservar', () => {
    expect(ORDEN_TAMANOS_PERRO).toEqual(Object.values(TamanoPerro));
  });

  it('debería ir de menor a mayor: el orden decide si un perro cabe', () => {
    expect(ORDEN_TAMANOS_PERRO).toEqual(['mini', 'pequeno', 'mediano', 'grande', 'gigante']);
  });

  it('debería traer nombre y tramo de peso para cada tamaño', () => {
    expect(TAMANOS_PERRO.every((t) => t.nombre && t.etiqueta.includes('kg'))).toBe(true);
  });
});

describe('nombreTamanoPerro / etiquetaTamanoPerro', () => {
  it('debería devolver texto legible, no la clave', () => {
    expect(nombreTamanoPerro('mini')).toBe('Mini');
    expect(etiquetaTamanoPerro('mini')).toBe('Mini (0-5 kg)');
  });

  it('debería devolver el valor tal cual si no lo reconoce', () => {
    // Un dato antiguo se sigue leyendo en vez de desaparecer del mensaje.
    expect(nombreTamanoPerro('enorme')).toBe('enorme');
  });
});

describe('cabeEnTamano', () => {
  it('debería aceptar un perro más pequeño que el máximo', () => {
    expect(cabeEnTamano('pequeno', 'grande')).toBe(true);
  });

  it('debería aceptar un perro exactamente del tamaño máximo', () => {
    expect(cabeEnTamano('grande', 'grande')).toBe(true);
  });

  it('debería rechazar un perro mayor que el máximo', () => {
    expect(cabeEnTamano('grande', 'mini')).toBe(false);
  });

  it('no debería bloquear si el espacio no declara máximo', () => {
    expect(cabeEnTamano('gigante', undefined)).toBe(true);
  });

  it('no debería bloquear si no se conoce el tamaño del perro', () => {
    // Rechazar por un dato que el cliente quizá ni ha declarado sería peor:
    // el comercio lo comprueba a la llegada.
    expect(cabeEnTamano(undefined, 'mini')).toBe(true);
    expect(cabeEnTamano('desconocido', 'mini')).toBe(true);
  });
});
