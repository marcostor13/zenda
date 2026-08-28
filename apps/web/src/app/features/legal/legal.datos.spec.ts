import { RESPONSABLE, ULTIMA_ACTUALIZACION, hayDatosPendientes } from './legal.datos';

describe('datos del responsable legal', () => {
  it('debería avisar de que la identidad del responsable sigue sin rellenar', () => {
    // Mientras esto sea `true`, los documentos salen marcados como borrador: es
    // el recordatorio de que el RGPD exige identificar al responsable.
    expect(hayDatosPendientes()).toBe(true);
  });

  it('debería tener un contacto de privacidad utilizable', () => {
    expect(RESPONSABLE.emailPrivacidad).toMatch(/^[^@\s]+@[^@\s]+\.[^@\s]+$/);
  });

  it('debería fechar la última revisión de los documentos', () => {
    expect(ULTIMA_ACTUALIZACION).toBeTruthy();
  });
});
