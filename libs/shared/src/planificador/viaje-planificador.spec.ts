import { VerticalKey } from '../enums/vertical.enum';
import {
  VERTICALES_FUERA_DEL_VIAJE, errorFechasViaje, nochesDelViaje, resolverDestinoViaje,
} from './viaje-planificador';

describe('resolverDestinoViaje', () => {
  it('debería reconocer una provincia escrita sin tilde', () => {
    expect(resolverDestinoViaje('castellon')).toEqual({ provincia: 'Castellón', etiqueta: 'Castellón' });
  });

  it('debería deducir la provincia de una población conocida', () => {
    expect(resolverDestinoViaje('gandia')).toEqual({
      municipio: 'Gandía', provincia: 'Valencia', etiqueta: 'Gandía (Valencia)',
    });
  });

  it('debería aceptar la etiqueta del desplegable «Población (Provincia)»', () => {
    expect(resolverDestinoViaje('Gandía (Valencia)')?.municipio).toBe('Gandía');
  });

  it('debería aceptar una población que no está en el catálogo', () => {
    expect(resolverDestinoViaje('Villanueva del Fresno')).toEqual({
      municipio: 'Villanueva del Fresno', provincia: undefined, etiqueta: 'Villanueva del Fresno',
    });
    expect(resolverDestinoViaje('Pego (Alicante)')).toEqual({
      municipio: 'Pego', provincia: 'Alicante', etiqueta: 'Pego (Alicante)',
    });
  });

  it('debería devolver null si no hay destino', () => {
    expect(resolverDestinoViaje('  ')).toBeNull();
  });
});

describe('errorFechasViaje', () => {
  const ahora = new Date('2026-10-02T10:00:00Z');

  it('debería exigir ambas fechas', () => {
    expect(errorFechasViaje(undefined, '2026-10-05', ahora)).toMatch(/Indica las fechas/);
    expect(errorFechasViaje('2026-10-05', '', ahora)).toMatch(/Indica las fechas/);
  });

  it('debería rechazar fechas mal formadas, pasadas o al revés', () => {
    expect(errorFechasViaje('05/10/2026', '2026-10-06', ahora)).toMatch(/no son válidas/);
    expect(errorFechasViaje('2026-10-01', '2026-10-06', ahora)).toMatch(/anterior a hoy/);
    expect(errorFechasViaje('2026-10-06', '2026-10-05', ahora)).toMatch(/vuelta/);
  });

  it('debería aceptar un viaje que empieza hoy en Madrid aunque en UTC sea ayer', () => {
    expect(errorFechasViaje('2026-10-03', '2026-10-03', new Date('2026-10-02T22:30:00Z'))).toBeNull();
  });
});

describe('nochesDelViaje', () => {
  it('debería contar noches, 0 si se vuelve el mismo día', () => {
    expect(nochesDelViaje('2026-10-03', '2026-10-03')).toBe(0);
    expect(nochesDelViaje('2026-10-03', '2026-10-10')).toBe(7);
  });
});

it('debería dejar las residencias caninas fuera del viaje', () => {
  expect(VERTICALES_FUERA_DEL_VIAJE).toContain(VerticalKey.ALOJAMIENTO);
});
