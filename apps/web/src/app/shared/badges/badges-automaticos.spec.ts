import { calcularBadgesAutomaticos } from './badges-automaticos';

describe('calcularBadgesAutomaticos', () => {
  it('no devuelve ningún badge para un servicio sin méritos', () => {
    expect(calcularBadgesAutomaticos({})).toEqual([]);
  });

  it('añade "Recomendado" solo si el servicio está destacado', () => {
    const badges = calcularBadgesAutomaticos({ destacado: true });
    expect(badges).toContainEqual({ icon: 'sparkles', label: 'Recomendado', variant: 'accent' });
  });

  it('añade "Más reservado" al superar el umbral de reservas del último mes', () => {
    expect(calcularBadgesAutomaticos({ reservasUltimoMes: 14 })).toEqual([]);
    const badges = calcularBadgesAutomaticos({ reservasUltimoMes: 15 });
    expect(badges).toContainEqual({ icon: 'trending-up', label: 'Más reservado', variant: 'success' });
  });

  it('añade "Mejor valorado" solo si la nota y el nº de reseñas superan el umbral', () => {
    expect(calcularBadgesAutomaticos({ score: 4.9, numResenas: 5 })).toEqual([]);
    expect(calcularBadgesAutomaticos({ score: 4.5, numResenas: 50 })).toEqual([]);
    const badges = calcularBadgesAutomaticos({ score: 4.8, numResenas: 30 });
    expect(badges).toContainEqual({ icon: 'trophy', label: 'Mejor valorado', variant: 'warning' });
  });

  it('añade "Responde en < 1 h" cuando el tiempo de respuesta cabe en el umbral', () => {
    const badges = calcularBadgesAutomaticos({ respuestaRapidaMin: 45 });
    expect(badges).toContainEqual({ icon: 'zap', label: 'Responde en < 1 h', variant: 'neutral' });
  });

  it('añade "Últimas plazas" solo cuando quedan pocas y no cero', () => {
    expect(calcularBadgesAutomaticos({ plazasRestantes: 0 })).toEqual([]);
    expect(calcularBadgesAutomaticos({ plazasRestantes: 4 })).toEqual([]);
    const badges = calcularBadgesAutomaticos({ plazasRestantes: 2 });
    expect(badges).toContainEqual({ icon: 'hourglass', label: 'Últimas plazas', variant: 'error' });
  });

  it('usa nombres de icono Lucide, nunca emojis (TCK-8010)', () => {
    const badges = calcularBadgesAutomaticos({ destacado: true, reservasUltimoMes: 20, plazasRestantes: 2 });
    for (const b of badges) {
      expect(b.icon).toMatch(/^[a-z-]+$/);
    }
  });

  it('puede combinar varios badges a la vez', () => {
    const badges = calcularBadgesAutomaticos({
      destacado: true,
      reservasUltimoMes: 20,
      score: 4.9,
      numResenas: 40,
    });
    expect(badges).toHaveLength(3);
  });
});
