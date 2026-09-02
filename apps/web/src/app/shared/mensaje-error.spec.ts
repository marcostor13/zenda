import { HttpErrorResponse } from '@angular/common/http';
import { mensajeDeError } from './mensaje-error';

const POR_DEFECTO = 'No se pudo completar la operación.';

describe('mensajeDeError', () => {
  it('debería devolver el motivo que manda el API', () => {
    // Es el motivo de existir: "hay 3 reservas en curso" le dice al operador
    // qué hacer; el texto genérico no.
    const error = new HttpErrorResponse({ error: { message: 'Hay 3 reservas en curso' } });

    expect(mensajeDeError(error, POR_DEFECTO)).toBe('Hay 3 reservas en curso');
  });

  it('debería juntar los motivos cuando el API manda varios', () => {
    // `class-validator` devuelve un array con un motivo por campo.
    const error = new HttpErrorResponse({
      error: { message: ['El email no es válido', 'El teléfono es obligatorio'] },
    });

    expect(mensajeDeError(error, POR_DEFECTO))
      .toBe('El email no es válido. El teléfono es obligatorio');
  });

  it('debería caer al texto por defecto con un array vacío', () => {
    const error = new HttpErrorResponse({ error: { message: [] } });

    expect(mensajeDeError(error, POR_DEFECTO)).toBe(POR_DEFECTO);
  });

  it('debería caer al texto por defecto si el motivo viene en blanco', () => {
    // Un mensaje de espacios no explica nada; deja la pantalla sin decir nada.
    const error = new HttpErrorResponse({ error: { message: '   ' } });

    expect(mensajeDeError(error, POR_DEFECTO)).toBe(POR_DEFECTO);
  });

  it('debería caer al texto por defecto sin cuerpo de error', () => {
    expect(mensajeDeError(new HttpErrorResponse({ status: 500 }), POR_DEFECTO)).toBe(POR_DEFECTO);
  });

  it('debería caer al texto por defecto ante cualquier cosa que no sea un error del API', () => {
    expect(mensajeDeError(new Error('sin red'), POR_DEFECTO)).toBe(POR_DEFECTO);
    expect(mensajeDeError(null, POR_DEFECTO)).toBe(POR_DEFECTO);
    expect(mensajeDeError(undefined, POR_DEFECTO)).toBe(POR_DEFECTO);
    expect(mensajeDeError('vaya', POR_DEFECTO)).toBe(POR_DEFECTO);
  });

  it('debería ignorar un mensaje que no es texto ni lista de textos', () => {
    expect(mensajeDeError({ error: { message: 42 } }, POR_DEFECTO)).toBe(POR_DEFECTO);
  });
});
