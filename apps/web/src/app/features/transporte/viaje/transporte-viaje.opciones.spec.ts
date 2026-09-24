import { ModalidadTransporte, NECESIDAD_OTRA, NecesidadTransporte, PREFERENCIAS_VIAJE } from 'shared';
import {
  ICONO_INCLUIDO, OPCIONES_DIAS_SEMANA, OPCIONES_EQUIPAJE, OPCIONES_INCLUIDOS, OPCIONES_MODALIDAD, OPCIONES_NECESIDADES,
  OPCIONES_PREFERENCIAS, OPCIONES_RECOGIDA, OPCIONES_TIPO_SERVICIO, etiquetaIncluido,
} from './transporte-viaje.opciones';

describe('transporte-viaje.opciones', () => {
  it('debería ofrecer los seis tipos de servicio con etiqueta corta e icono', () => {
    expect(OPCIONES_TIPO_SERVICIO).toHaveLength(6);
    const urgente = OPCIONES_TIPO_SERVICIO.find((o) => o.valor === NecesidadTransporte.URGENTE);
    expect(urgente).toEqual({ valor: 'urgente', etiqueta: 'Urgente', icono: 'siren' });
    expect(OPCIONES_TIPO_SERVICIO.find((o) => o.valor === 'viajo_con_mi_mascota')?.icono).toBe('users');
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

  it('debería poner icono a las necesidades conocidas, dejar las demás sin él y acabar en «Otra»', () => {
    expect(OPCIONES_NECESIDADES.find((o) => o.valor === 'medicacion')?.icono).toBe('pill');
    expect(OPCIONES_NECESIDADES.find((o) => o.valor === 'jaula')?.icono).toBeUndefined();
    expect(OPCIONES_NECESIDADES.at(-1)).toEqual({ valor: NECESIDAD_OTRA, etiqueta: 'Otra' });
  });

  it('debería ofrecer las preferencias del catálogo salvo «viaje exclusivo», cada una con su icono', () => {
    OPCIONES_PREFERENCIAS.forEach((o) => expect(o.icono).toBe(ICONO_INCLUIDO[o.valor]));
    expect(OPCIONES_PREFERENCIAS.map((o) => o.valor)).not.toContain('servicio_exclusivo');
    expect(OPCIONES_PREFERENCIAS).toHaveLength(PREFERENCIAS_VIAJE.length - 1);
  });

  it('debería añadir «puerta a puerta» a los incluidos filtrables', () => {
    expect(OPCIONES_INCLUIDOS.at(-1)).toEqual({ valor: 'puerta_a_puerta', etiqueta: 'Puerta a puerta', icono: 'home' });
  });

  it('debería dar la etiqueta de un incluido y devolver el valor si no lo conoce', () => {
    expect(etiquetaIncluido('gps')).toBe('Seguimiento del viaje');
    expect(etiquetaIncluido('desconocido')).toBe('desconocido');
  });

  it('debería sacar el equipaje del catálogo del comercio', () => {
    expect(OPCIONES_EQUIPAJE[0]).toEqual({ valor: 'sin_equipaje', etiqueta: 'Sin equipaje', icono: undefined });
  });

  it('no debería ofrecer «empresa» como quien entrega en la recogida', () => {
    expect(OPCIONES_RECOGIDA.map((o) => o.valor)).toEqual(['yo', 'otra']);
  });
});
