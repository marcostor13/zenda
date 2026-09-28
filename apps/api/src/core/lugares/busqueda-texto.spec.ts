import { TipoLugar } from 'shared';
import { condicionTextoLugar, palabrasDeBusqueda } from './busqueda-texto';

type Condicion = { $and: Array<{ $or: Array<Record<string, unknown>> }> };

describe('palabrasDeBusqueda', () => {
  it('debería quitar tildes y palabras vacías', () => {
    expect(palabrasDeBusqueda('Tienda de animales para mi perro en Dénia')).toEqual(['tienda', 'denia']);
  });

  it('debería devolver una lista vacía si no queda nada con significado', () => {
    expect(palabrasDeBusqueda('para mi perro')).toEqual([]);
  });
});

describe('condicionTextoLugar', () => {
  it('debería devolver null sin palabras con significado', () => {
    expect(condicionTextoLugar('con mi perro', 'todas')).toBeNull();
  });

  it('debería exigir cada palabra en modo «todas»', () => {
    const condicion = condicionTextoLugar('cafetería Valencia', 'todas') as Condicion;
    expect(condicion.$and).toHaveLength(2);
  });

  it('debería reconocer los sinónimos de tipo', () => {
    const condicion = condicionTextoLugar('cafetería', 'todas') as Condicion;
    expect(condicion.$and[0].$or).toContainEqual({ tipo: { $in: [TipoLugar.RESTAURANTE] } });
  });

  it('debería reconocer las tiendas por el nombre de la cadena', () => {
    const condicion = condicionTextoLugar('Kiwoko', 'todas') as Condicion;
    expect(condicion.$and[0].$or).toContainEqual({ tipo: { $in: [TipoLugar.TIENDA] } });
  });

  it('debería conformarse con una sola palabra en modo «alguna»', () => {
    const condicion = condicionTextoLugar('playa Xàbia', 'alguna') as Condicion;
    expect(condicion.$and).toHaveLength(1);
    expect(condicion.$and[0].$or.length).toBeGreaterThan(5);
  });

  it('debería buscar sin importar las tildes', () => {
    const condicion = condicionTextoLugar('xabia', 'todas') as Condicion;
    const nombre = condicion.$and[0].$or.find((c) => 'nombre' in c) as { nombre: RegExp };
    expect(nombre.nombre.test('Xàbia')).toBe(true);
  });
});
