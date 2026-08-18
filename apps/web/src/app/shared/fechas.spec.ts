import { celdasDelMes, claveDia, desdeClaveDia, hoyLocal } from './fechas';

describe('fechas', () => {
  describe('claveDia y desdeClaveDia', () => {
    it('debería usar las partes locales de la fecha, no las UTC', () => {
      // Con `toISOString()` esto devolvía el día anterior o el siguiente según la
      // zona horaria, y la celda del calendario acababa filtrando otro día.
      expect(claveDia(new Date(2026, 7, 3))).toBe('2026-08-03');
      expect(claveDia(new Date(2026, 0, 1))).toBe('2026-01-01');
      expect(claveDia(new Date(2026, 11, 31))).toBe('2026-12-31');
    });

    it('debería rellenar mes y día a dos cifras', () => {
      expect(claveDia(new Date(2026, 4, 7))).toBe('2026-05-07');
    });

    it('debería devolver la medianoche local al leer la clave', () => {
      const fecha = desdeClaveDia('2026-08-03');

      expect(fecha.getFullYear()).toBe(2026);
      expect(fecha.getMonth()).toBe(7);
      expect(fecha.getDate()).toBe(3);
      expect(fecha.getHours()).toBe(0);
    });

    it('debería dar la vuelta completa sin desviarse de día', () => {
      // Es la propiedad que importa: lo que se pinta y lo que se filtra al
      // pulsarlo tienen que ser el mismo día, en cualquier zona horaria.
      for (const original of [new Date(2026, 0, 1), new Date(2026, 7, 3), new Date(2026, 11, 31)]) {
        expect(desdeClaveDia(claveDia(original)).getTime()).toBe(original.getTime());
      }
    });
  });

  describe('hoyLocal', () => {
    it('debería devolver hoy sin hora', () => {
      const hoy = hoyLocal();

      expect(hoy.getHours()).toBe(0);
      expect(hoy.getMinutes()).toBe(0);
      expect(claveDia(hoy)).toBe(claveDia(new Date()));
    });
  });

  describe('celdasDelMes', () => {
    it('debería devolver siempre seis semanas completas', () => {
      // Alto fijo: si no, la rejilla pega un salto al cambiar de mes.
      expect(celdasDelMes(new Date(2026, 1, 1))).toHaveLength(42);
      expect(celdasDelMes(new Date(2026, 7, 1))).toHaveLength(42);
    });

    it('debería empezar en lunes', () => {
      for (const mes of [0, 3, 7, 11]) {
        expect(celdasDelMes(new Date(2026, mes, 1)).at(0)!.getDay()).toBe(1);
      }
    });

    it('debería incluir todos los días del mes pedido', () => {
      const agosto = celdasDelMes(new Date(2026, 7, 1)).filter((d) => d.getMonth() === 7);

      expect(agosto).toHaveLength(31);
    });

    it('debería rellenar con días de los meses vecinos', () => {
      const celdas = celdasDelMes(new Date(2026, 7, 1));

      expect(celdas.some((d) => d.getMonth() !== 7)).toBe(true);
    });

    it('debería dar días consecutivos', () => {
      const celdas = celdasDelMes(new Date(2026, 9, 1));

      for (let i = 1; i < celdas.length; i++) {
        const diferencia = celdas[i].getTime() - celdas[i - 1].getTime();
        // 25 h de margen: en octubre el cambio de hora hace días de 25 horas.
        expect(diferencia).toBeGreaterThan(0);
        expect(diferencia).toBeLessThanOrEqual(25 * 3600 * 1000);
      }
    });
  });
});
