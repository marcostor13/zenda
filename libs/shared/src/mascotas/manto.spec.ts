import { TipoPelo } from '../enums/perro.enum';
import {
  ESTADO_MANTO_LABELS, EstadoManto, TIPO_MANTO_LABELS, esEstadoMantoConocido, nombreEstadoManto, nombreTipoManto,
} from './manto';

describe('manto del perro', () => {
  it('debería tener etiqueta para cada tipo de manto', () => {
    for (const tipo of Object.values(TipoPelo)) {
      expect(TIPO_MANTO_LABELS[tipo]).toBeTruthy();
    }
  });

  it('debería tener etiqueta para cada estado del manto', () => {
    for (const estado of Object.values(EstadoManto)) {
      expect(ESTADO_MANTO_LABELS[estado]).toBeTruthy();
    }
  });

  it('debería traducir las claves a su etiqueta', () => {
    expect(nombreTipoManto('doble_capa')).toBe('Doble capa');
    expect(nombreEstadoManto('muda')).toBe('En muda (suelta mucho pelo)');
  });

  it('debería devolver tal cual un valor desconocido (texto libre de fichas antiguas)', () => {
    expect(nombreTipoManto('lanoso')).toBe('lanoso');
    expect(nombreEstadoManto('nudos en las orejas')).toBe('nudos en las orejas');
    expect(esEstadoMantoConocido('nudos en las orejas')).toBe(false);
    expect(esEstadoMantoConocido('normal')).toBe(true);
  });
});
