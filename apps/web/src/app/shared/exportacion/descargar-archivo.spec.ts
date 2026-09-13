import { descargarBlob, nombreInforme } from './descargar-archivo';

describe('descargarBlob', () => {
  it('debería crear un enlace temporal, pulsarlo y retirarlo', () => {
    jest.useFakeTimers();
    const crearUrl = jest.fn().mockReturnValue('blob:x');
    const revocar = jest.fn();
    Object.assign(URL, { createObjectURL: crearUrl, revokeObjectURL: revocar });
    const pulsar = jest.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => undefined);

    descargarBlob(new Blob(['a']), 'informe.pdf');

    expect(pulsar).toHaveBeenCalled();
    expect(document.querySelector('a[download]')).toBeNull();
    jest.runAllTimers();
    expect(revocar).toHaveBeenCalledWith('blob:x');
    jest.useRealTimers();
  });
});

describe('nombreInforme', () => {
  it('debería quitar tildes y espacios del nombre de la mascota', () => {
    expect(nombreInforme('Toby Ñandú', new Date('2026-09-13T10:00:00Z'))).toBe('doogking-informe-toby-nandu-2026-09-13.pdf');
  });

  it('debería usar un nombre genérico si no queda nada', () => {
    expect(nombreInforme('***', new Date('2026-09-13T10:00:00Z'))).toBe('doogking-informe-mascota-2026-09-13.pdf');
  });
});
