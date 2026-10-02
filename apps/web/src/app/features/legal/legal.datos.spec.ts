import { RESPONSABLE, ULTIMA_ACTUALIZACION } from './legal.datos';

describe('datos del responsable legal', () => {
  it('no debería dejar ningún dato de identidad como marcador sin rellenar', () => {
    // Estos valores se publican tal cual en las páginas legales.
    const publicado = JSON.stringify(RESPONSABLE);
    expect(publicado).not.toMatch(/\[PENDIENTE|TODO|XXX/);
  });

  it('debería identificar al titular con razón social y domicilio social', () => {
    expect(RESPONSABLE.razonSocial).toContain('DOOGKING, S.L.');
    expect(RESPONSABLE.domicilio).toContain('Castellón de la Plana');
  });

  it('debería tener un contacto de privacidad utilizable', () => {
    expect(RESPONSABLE.emailPrivacidad).toMatch(/^[^@\s]+@[^@\s]+\.[^@\s]+$/);
  });

  it('debería fechar la última revisión de los documentos', () => {
    expect(ULTIMA_ACTUALIZACION).toBe('2 de octubre de 2026');
  });
});
