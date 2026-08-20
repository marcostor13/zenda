import { VerticalKey } from 'shared';
import { faqDeConfirmacion } from './faq-confirmacion.catalogo';

describe('faq-confirmacion.catalogo', () => {
  it('debería poner primero lo propio de la categoría', () => {
    // Las comunes ya se las sabe a la tercera reserva; lo específico, no.
    const preguntas = faqDeConfirmacion(VerticalKey.ALOJAMIENTO).map((p) => p.pregunta);

    expect(preguntas[0]).toContain('el día de la entrada');
  });

  it('debería añadir las comunes a cualquier categoría', () => {
    for (const vertical of Object.values(VerticalKey)) {
      const preguntas = faqDeConfirmacion(vertical).map((p) => p.pregunta);
      expect(preguntas.some((p) => p.includes('cobra el importe'))).toBe(true);
      expect(preguntas.some((p) => p.includes('cancelo'))).toBe(true);
    }
  });

  it('debería responder con algo útil, no con una línea suelta', () => {
    for (const vertical of Object.values(VerticalKey)) {
      for (const { respuesta } of faqDeConfirmacion(vertical)) {
        expect(respuesta.length).toBeGreaterThan(60);
      }
    }
  });

  it('debería sostenerse con una categoría desconocida', () => {
    // Un vertical nuevo sin preguntas propias todavía no puede quedarse sin FAQ.
    const preguntas = faqDeConfirmacion('inventado');

    expect(preguntas.length).toBeGreaterThan(0);
    expect(preguntas.every((p) => p.pregunta && p.respuesta)).toBe(true);
  });
});
