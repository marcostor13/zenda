import { campoContador, plazasDeclaradas, sinPlazas } from './disponibilidad';

/**
 * El contador de plazas decide si un listado se ve en el buscador: publicado
 * con el contador a cero, la ficha es invisible aunque el panel diga lo
 * contrario. Por eso se deduce de la capacidad que el comercio sí declara.
 */
describe('disponibilidad', () => {
  describe('campoContador', () => {
    it('debería nombrar el contador de cada vertical que lo deduce', () => {
      expect(campoContador('alojamiento')).toBe('espaciosDisponibles');
      expect(campoContador('hoteles')).toBe('unidadesDisponibles');
      expect(campoContador('veterinaria')).toBe('citasDisponibles');
    });

    it('no debería inventar contador para un vertical que pide el suyo a mano', () => {
      expect(campoContador('transporte')).toBeUndefined();
    });
  });

  describe('plazasDeclaradas', () => {
    it('debería sumar las cantidades de los espacios de una residencia', () => {
      const plazas = plazasDeclaradas('alojamiento', {
        espacios: [{ cantidad: 3 }, { cantidad: 2 }],
      });

      expect(plazas).toBe(5);
    });

    /**
     * El hotel declara sus tipos de habitación pet-friendly, cada uno con su
     * cantidad; contarlas otra vez a mano sólo daba ocasión de que las dos
     * cifras discreparan.
     */
    it('debería sumar las habitaciones declaradas por un hotel', () => {
      const plazas = plazasDeclaradas('hoteles', {
        espacios: [{ cantidad: 4 }, { cantidad: 6 }],
      });

      expect(plazas).toBe(10);
    });

    it('debería tomar tal cual la capacidad que no viene troceada', () => {
      expect(plazasDeclaradas('veterinaria', { citasPorDia: 16 })).toBe(16);
    });

    /**
     * Sin capacidad no se inventa nada: devolver 0 dejaría el listado oculto
     * igualmente, y devolver un número inventado pondría en el buscador plazas
     * que no existen.
     */
    it('no debería deducir nada sin capacidad declarada', () => {
      expect(plazasDeclaradas('hoteles', {})).toBeUndefined();
      expect(plazasDeclaradas('hoteles', { espacios: [] })).toBeUndefined();
      expect(plazasDeclaradas('alojamiento', { espacios: [{ cantidad: 0 }] })).toBeUndefined();
    });

    it('no debería deducir nada para un vertical sin regla', () => {
      expect(plazasDeclaradas('transporte', { unidadesDisponibles: 3 })).toBeUndefined();
    });
  });

  describe('sinPlazas', () => {
    it('debería tratar como sin plazas el cero, lo ausente y lo que no es número', () => {
      expect(sinPlazas(0)).toBe(true);
      expect(sinPlazas(undefined)).toBe(true);
      expect(sinPlazas('muchas')).toBe(true);
    });

    it('debería dar por buenas las plazas positivas', () => {
      expect(sinPlazas(1)).toBe(false);
    });
  });
});
