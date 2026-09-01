import {
  ModoPrecioClinico, SERVICIO_CLINICO_CATALOGO, SERVICIO_CLINICO_LABELS,
  SERVICIO_CLINICO_SINONIMOS, ServicioClinicoTipo, esEspecialidadSuelta,
} from './servicio-clinico.enum';

/**
 * Regla de oro del catálogo (`veterinarios.md`): si el veterinario no puede
 * saber cuánto va a pagar el cliente antes de acudir, eso no se publica como
 * servicio de contratación directa.
 */
describe('catálogo de servicios veterinarios', () => {
  it('debería ofrecer todos los servicios con etiqueta, base de precio e icono', () => {
    for (const servicio of SERVICIO_CLINICO_CATALOGO) {
      expect(servicio.label.length).toBeGreaterThan(0);
      expect(servicio.base.length).toBeGreaterThan(0);
      expect(servicio.icono.length).toBeGreaterThan(0);
      expect(servicio.modosPrecio.length).toBeGreaterThan(0);
    }
  });

  it('no debería ofrecer dos veces el mismo servicio', () => {
    const tipos = SERVICIO_CLINICO_CATALOGO.map((s) => s.tipo);
    expect(new Set(tipos).size).toBe(tipos.length);
  });

  it('no debería ofrecer especialidades sueltas como servicio reservable', () => {
    // «Cardiología» no es un acto tarifado: describe a quién ves, no lo que cuesta.
    for (const servicio of SERVICIO_CLINICO_CATALOGO) {
      expect(esEspecialidadSuelta(servicio.label)).toBe(false);
    }
  });

  it('debería cobrar la vacunación por tipo de vacuna, con las habituales propuestas', () => {
    const vacunacion = SERVICIO_CLINICO_CATALOGO
      .find((s) => s.tipo === ServicioClinicoTipo.VACUNACION);

    expect(vacunacion?.modosPrecio[0]).toBe(ModoPrecioClinico.POR_VARIANTE);
    expect(vacunacion?.variantes).toContain('Rabia');
    expect(vacunacion?.variantes).toContain('Tos de las perreras');
  });

  it('debería cobrar las cirugías por tramo de peso y pedir su alcance', () => {
    // Una castración de 8 kg no cuesta lo mismo que una de 35, y el cliente
    // necesita saber si el precio incluye la analítica previa.
    for (const tipo of [ServicioClinicoTipo.CASTRACION, ServicioClinicoTipo.ESTERILIZACION]) {
      const cirugia = SERVICIO_CLINICO_CATALOGO.find((s) => s.tipo === tipo);
      expect(cirugia?.modosPrecio).toEqual([ModoPrecioClinico.POR_PESO]);
      expect(cirugia?.variantes).toContain('Hasta 10 kg');
      expect(cirugia?.detallaAlcance).toBe(true);
    }
  });

  it('debería dejar elegir entre fijo y por peso donde el precio depende del caso', () => {
    for (const tipo of [ServicioClinicoTipo.DESPARASITACION_INTERNA, ServicioClinicoTipo.HIGIENE_DENTAL]) {
      const servicio = SERVICIO_CLINICO_CATALOGO.find((s) => s.tipo === tipo);
      expect(servicio?.modosPrecio).toContain(ModoPrecioClinico.FIJO);
      expect(servicio?.modosPrecio).toContain(ModoPrecioClinico.POR_PESO);
    }
  });

  describe('etiquetas', () => {
    it('debería nombrar todos los tipos, también los heredados', () => {
      for (const tipo of Object.values(ServicioClinicoTipo)) {
        expect(SERVICIO_CLINICO_LABELS[tipo]).toBeTruthy();
      }
    });

    /**
     * Sin los sinónimos, renombrar «Consulta general» a «Consulta veterinaria»
     * dejaría de reconocer lo escrito a mano en los listados antiguos y el
     * comercio los vería desaparecer de su ficha.
     */
    it('debería reconocer los nombres con los que se guardaban antes', () => {
      expect(SERVICIO_CLINICO_SINONIMOS['consulta general'])
        .toBe(ServicioClinicoTipo.CONSULTA_GENERAL);
      expect(SERVICIO_CLINICO_SINONIMOS['higiene dental'])
        .toBe(ServicioClinicoTipo.HIGIENE_DENTAL);
    });
  });

  describe('esEspecialidadSuelta', () => {
    it('debería reconocer las especialidades que no se pueden reservar', () => {
      expect(esEspecialidadSuelta('Cardiología')).toBe(true);
      expect(esEspecialidadSuelta('  dermatologia ')).toBe(true);
      expect(esEspecialidadSuelta('Diagnóstico por imagen')).toBe(true);
    });

    /**
     * El matiz del documento: la especialidad no se vende, pero su consulta sí,
     * porque ahí el cliente sabe lo que paga antes de ir.
     */
    it('debería dejar pasar la consulta de una especialidad', () => {
      expect(esEspecialidadSuelta('Primera consulta de cardiología')).toBe(false);
      expect(esEspecialidadSuelta('Revisión dermatológica de control')).toBe(false);
    });
  });
});
