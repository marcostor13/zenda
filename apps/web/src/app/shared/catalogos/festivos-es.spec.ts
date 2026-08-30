import { domingoDePascua, festivosNacionales, festivosNacionalesProximos } from './festivos-es';

describe('festivos nacionales de España', () => {
  const iso = (d: Date): string =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

  describe('domingoDePascua', () => {
    /**
     * El Viernes Santo es el único festivo nacional móvil y sale de aquí. Se
     * contrasta contra fechas publicadas: un fallo en el algoritmo cerraría el
     * negocio un día que abre, y al revés.
     */
    it.each([
      [2024, '2024-03-31'],
      [2025, '2025-04-20'],
      [2026, '2026-04-05'],
      [2027, '2027-03-28'],
      [2028, '2028-04-16'],
    ])('debería situar la Pascua de %i', (anio, esperado) => {
      expect(iso(domingoDePascua(anio))).toBe(esperado);
    });
  });

  describe('festivosNacionales', () => {
    it('debería dar los diez festivos de ámbito estatal', async () => {
      expect(festivosNacionales(2026)).toHaveLength(10);
    });

    it('debería incluir los fijos del calendario laboral', () => {
      const fechas = festivosNacionales(2026).map((f) => f.fecha);

      expect(fechas).toEqual(expect.arrayContaining([
        '2026-01-01', '2026-01-06', '2026-05-01', '2026-08-15',
        '2026-10-12', '2026-11-01', '2026-12-06', '2026-12-08', '2026-12-25',
      ]));
    });

    it('debería calcular el Viernes Santo, que cambia cada año', () => {
      const viernes = festivosNacionales(2026).find((f) => f.motivo === 'Viernes Santo');

      expect(viernes?.fecha).toBe('2026-04-03');
    });

    it('debería venir ordenado por fecha', () => {
      const fechas = festivosNacionales(2027).map((f) => f.fecha);

      expect(fechas).toEqual([...fechas].sort());
    });

    it('debería nombrar cada festivo, no sólo fecharlo', () => {
      // El motivo se guarda en la excepción y es lo que lee el cliente.
      const reyes = festivosNacionales(2026).find((f) => f.fecha === '2026-01-06');

      expect(reyes?.motivo).toBe('Epifanía del Señor');
    });

    /**
     * Los autonómicos y los locales cambian por comunidad, por municipio y por
     * año: darlos por buenos aquí cerraría negocios en días que sí abren.
     */
    it('NO debería incluir festivos autonómicos ni locales', () => {
      const fechas = festivosNacionales(2026).map((f) => f.fecha);

      // San José (19 mar) y Santiago (25 jul) son sustituibles por las CCAA.
      expect(fechas).not.toContain('2026-03-19');
      expect(fechas).not.toContain('2026-07-25');
    });
  });

  describe('festivosNacionalesProximos', () => {
    it('debería mirar los doce meses siguientes, no el año natural', () => {
      // En noviembre lo útil no es "lo que queda de este año" —dos días— sino
      // la temporada que viene.
      const proximos = festivosNacionalesProximos(new Date(2026, 10, 15));

      expect(proximos.map((f) => f.fecha)).toEqual(expect.arrayContaining([
        '2026-12-25', '2027-01-01', '2027-10-12',
      ]));
    });

    it('debería dejar fuera los que ya pasaron', () => {
      const proximos = festivosNacionalesProximos(new Date(2026, 10, 15));

      expect(proximos.map((f) => f.fecha)).not.toContain('2026-10-12');
    });

    it('debería incluir el día de hoy si es festivo', () => {
      // Todavía se puede declarar cerrado hoy: la reserva es para después.
      const proximos = festivosNacionalesProximos(new Date(2026, 11, 25));

      expect(proximos.map((f) => f.fecha)).toContain('2026-12-25');
    });

    it('no debería pasarse de los doce meses', () => {
      const proximos = festivosNacionalesProximos(new Date(2026, 0, 15));

      expect(proximos.map((f) => f.fecha)).not.toContain('2027-05-01');
    });
  });
});
