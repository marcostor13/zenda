import { admiteEspecie, normalizarEspecie } from './especie';

/**
 * Regresión: toda clínica veterinaria rechazaba a todos los perros.
 *
 * La ficha del animal guarda `especie: 'perro'` (minúscula, por defecto del
 * esquema) y el alta del comercio elige `'Perro'` de un catálogo capitalizado y
 * cerrado. `['Perro'].includes('perro')` es `false`, así que el mensaje "Esta
 * clínica no atiende la especie de tu mascota" saltaba siempre.
 */
describe('Especie de la mascota', () => {
  it('debería aceptar al perro aunque el comercio lo escriba con mayúscula', () => {
    expect(admiteEspecie(['Perro'], 'perro')).toBe(true);
  });

  it('debería ignorar acentos y plural, que el catálogo y la ficha no comparten', () => {
    expect(admiteEspecie(['Hurón'], 'huron')).toBe(true);
    expect(admiteEspecie(['Perros'], 'perro')).toBe(true);
    expect(admiteEspecie(['  GATO  '], 'gato')).toBe(true);
  });

  it('debería seguir bloqueando una especie que el comercio no atiende', () => {
    expect(admiteEspecie(['Perro', 'Gato'], 'reptil')).toBe(false);
  });

  /* Sin lista no es "no admito nada": es un dato que el comercio no ha puesto. */
  it('debería admitir cualquiera cuando el comercio no ha declarado especies', () => {
    expect(admiteEspecie([], 'reptil')).toBe(true);
    expect(admiteEspecie(undefined, 'reptil')).toBe(true);
  });

  /* Sin especie en la ficha tampoco se bloquea: no se sabe, no se prohíbe. */
  it('no debería bloquear si la ficha del animal no dice la especie', () => {
    expect(admiteEspecie(['Perro'], undefined)).toBe(true);
    expect(admiteEspecie(['Perro'], '')).toBe(true);
  });

  it('debería normalizar a la forma con la que se compara', () => {
    expect(normalizarEspecie('  Équidos ')).toBe('equido');
  });
});
