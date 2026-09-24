import { construirIcs, descargarIcs } from './descargar-ics';

describe('descargar-ics', () => {
  const inicio = new Date('2026-09-25T08:30:00.000Z');

  describe('construirIcs', () => {
    it('debería escribir las horas en UTC y durar una hora si no hay fin', () => {
      const ics = construirIcs({ uid: 'R1', titulo: 'Viaje', inicio });

      expect(ics).toContain('DTSTART:20260925T083000Z');
      expect(ics).toContain('DTEND:20260925T093000Z');
      expect(ics).toContain('UID:R1@doogking.com');
      expect(ics).toMatch(/DTSTAMP:\d{8}T\d{6}Z/);
    });

    it('debería respetar el fin indicado', () => {
      const ics = construirIcs({ uid: 'R1', titulo: 'Viaje', inicio, fin: new Date('2026-09-25T12:00:00Z') });
      expect(ics).toContain('DTEND:20260925T120000Z');
    });

    it('debería separar las líneas con CRLF y envolver el evento', () => {
      const lineas = construirIcs({ uid: 'R1', titulo: 'Viaje', inicio }).split('\r\n');
      expect(lineas[0]).toBe('BEGIN:VCALENDAR');
      expect(lineas).toContain('BEGIN:VEVENT');
      expect(lineas[lineas.length - 1]).toBe('END:VCALENDAR');
    });

    it('debería escapar comas, puntos y coma, barras y saltos de línea', () => {
      const ics = construirIcs({
        uid: 'R1', titulo: 'Madrid, centro; ida', inicio,
        lugar: 'C\\ Mayor, 1', descripcion: 'Línea 1\nLínea 2',
      });

      expect(ics).toContain('SUMMARY:Madrid\\, centro\\; ida');
      expect(ics).toContain('LOCATION:C\\\\ Mayor\\, 1');
      expect(ics).toContain('DESCRIPTION:Línea 1\\nLínea 2');
    });

    it('no debería incluir lugar ni descripción si no los hay', () => {
      const ics = construirIcs({ uid: 'R1', titulo: 'Viaje', inicio });
      expect(ics).not.toContain('LOCATION:');
      expect(ics).not.toContain('DESCRIPTION:');
    });
  });

  describe('descargarIcs', () => {
    const urlOriginal = { crear: URL.createObjectURL, revocar: URL.revokeObjectURL };

    afterEach(() => {
      URL.createObjectURL = urlOriginal.crear;
      URL.revokeObjectURL = urlOriginal.revocar;
      jest.restoreAllMocks();
    });

    it('debería descargar el fichero con el uid en el nombre y liberar la URL', () => {
      URL.createObjectURL = jest.fn().mockReturnValue('blob:ics');
      URL.revokeObjectURL = jest.fn();
      const click = jest.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => undefined);
      const crear = jest.spyOn(document, 'createElement');

      descargarIcs({ uid: 'R9', titulo: 'Viaje', inicio });

      const enlace = crear.mock.results[0].value as HTMLAnchorElement;
      expect(enlace.download).toBe('doogking-R9.ics');
      expect(enlace.href).toBe('blob:ics');
      expect(click).toHaveBeenCalled();
      expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:ics');
    });
  });
});
