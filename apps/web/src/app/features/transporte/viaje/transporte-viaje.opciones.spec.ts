import { ModalidadTransporte, PreferenciaTransporte, TipoServicioTransporte } from 'shared';
import {
  ICONO_INCLUIDO, OPCIONES_DIAS_SEMANA, OPCIONES_MODALIDAD, OPCIONES_NECESIDADES, OPCIONES_PREFERENCIAS,
  OPCIONES_RECOGIDA, OPCIONES_TIPO_SERVICIO,
} from './transporte-viaje.opciones';

describe('transporte-viaje.opciones', () => {
  it('debería ofrecer los seis tipos de servicio con etiqueta corta e icono', () => {
    expect(OPCIONES_TIPO_SERVICIO).toHaveLength(6);
    const urgente = OPCIONES_TIPO_SERVICIO.find((o) => o.valor === TipoServicioTransporte.URGENTE);
    expect(urgente).toEqual({ valor: 'urgente', etiqueta: 'Urgente', icono: 'siren' });
  });

  it('debería empezar la semana en lunes y acabar en domingo (0)', () => {
    expect(OPCIONES_DIAS_SEMANA[0].valor).toBe('1');
    expect(OPCIONES_DIAS_SEMANA[6].valor).toBe('0');
  });

  it('debería acortar la etiqueta de modalidad y capitalizarla', () => {
    const exclusivo = OPCIONES_MODALIDAD.find((o) => o.valor === ModalidadTransporte.EXCLUSIVO);
    expect(exclusivo?.etiqueta).toBe('Exclusivo');
    expect(exclusivo?.icono).toBe('truck');
    expect(exclusivo?.descripcion).toBeTruthy();
  });

  it('debería poner icono a las necesidades conocidas y dejar las demás sin él', () => {
    expect(OPCIONES_NECESIDADES.find((o) => o.valor === 'medicacion')?.icono).toBe('pill');
    expect(OPCIONES_NECESIDADES.find((o) => o.valor === 'jaula')?.icono).toBeUndefined();
  });

  it('debería tener un icono de incluido para cada preferencia', () => {
    OPCIONES_PREFERENCIAS.forEach((o) => expect(o.icono).toBe(ICONO_INCLUIDO[o.valor]));
    expect(OPCIONES_PREFERENCIAS).toHaveLength(Object.values(PreferenciaTransporte).length);
  });

  it('no debería ofrecer «empresa» como quien entrega en la recogida', () => {
    expect(OPCIONES_RECOGIDA.map((o) => o.valor)).toEqual(['yo', 'otra']);
  });
});
