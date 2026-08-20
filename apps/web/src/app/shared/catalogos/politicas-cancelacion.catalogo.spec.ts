import { POLITICAS_CANCELACION, describirPolitica, descripcionPolitica } from './politicas-cancelacion.catalogo';

describe('politicas-cancelacion.catalogo', () => {
  it('debería ofrecer las tres políticas que acepta la API', () => {
    expect(POLITICAS_CANCELACION.map((p) => p.valor)).toEqual([
      'flexible', 'moderada', 'estricta',
    ]);
  });

  it('debería explicar cada política, no sólo nombrarla', () => {
    // Es el motivo de existir del catálogo: elegir entre "flexible" y
    // "estricta" sin saber qué implican lleva a marcar la primera.
    for (const politica of POLITICAS_CANCELACION) {
      expect(politica.descripcion.length).toBeGreaterThan(40);
      expect(politica.resumen).toBeTruthy();
    }
  });

  it('debería describir la política en una línea', () => {
    expect(describirPolitica('flexible')).toBe('Flexible · cancelación gratuita hasta 24 h antes');
  });

  it('debería devolver un guion cuando no hay política', () => {
    expect(describirPolitica(undefined)).toBe('—');
    expect(describirPolitica('')).toBe('—');
  });

  it('debería respetar el texto libre de un comercio antiguo', () => {
    // Antes de cerrar el catálogo se guardaban frases sueltas; se muestran tal
    // cual en vez de desaparecer de la ficha.
    expect(describirPolitica('Se avisa con una semana')).toBe('Se avisa con una semana');
  });

  describe('descripcionPolitica', () => {
    it('debería devolver la condición completa, no el rótulo corto', () => {
      expect(descripcionPolitica('flexible')).toBe(POLITICAS_CANCELACION[0].descripcion);
    });

    it('debería remitir al alojamiento cuando el servicio no declara política', () => {
      // Un guion aquí dejaría al cliente sin saber qué pasa si cancela.
      expect(descripcionPolitica(undefined)).toContain('Consulta las condiciones');
      expect(descripcionPolitica('')).toContain('Consulta las condiciones');
    });

    it('debería respetar el texto libre de un comercio antiguo', () => {
      expect(descripcionPolitica('Se avisa con una semana')).toBe('Se avisa con una semana');
    });
  });
});
