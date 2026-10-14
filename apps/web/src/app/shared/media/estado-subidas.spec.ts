import { FormArray, FormControl, FormGroup } from '@angular/forms';
import { motivoBloqueoPorFotos } from './estado-subidas';

/** Control de fotos con el error que pone `rs-image-upload`. */
function fotosCon(error: 'subidaFallida' | 'subidaEnCurso' | null): FormControl<string[]> {
  return new FormControl<string[]>([], { nonNullable: true, validators: () => (error ? { [error]: true } : null) });
}

describe('motivoBloqueoPorFotos', () => {
  it('debería devolver null si ninguna foto está subiendo ni ha fallado', () => {
    expect(motivoBloqueoPorFotos(fotosCon(null))).toBeNull();
  });

  it('debería pedir reintentar o quitar la foto cuando una subida falló', () => {
    expect(motivoBloqueoPorFotos(fotosCon('subidaFallida'))).toContain('Reintentar');
  });

  it('debería pedir esperar cuando una foto sigue subiendo', () => {
    expect(motivoBloqueoPorFotos(fotosCon('subidaEnCurso'))).toContain('Espera');
  });

  it('debería encontrar la foto fallida dentro de una unidad de un FormArray anidado', () => {
    const grupo = new FormGroup({
      nombre: new FormControl(''),
      espacios: new FormArray([
        new FormGroup({ imagenes: fotosCon(null) }),
        new FormGroup({ imagenes: fotosCon('subidaFallida') }),
      ]),
    });

    expect(motivoBloqueoPorFotos(grupo)).toContain('no se ha subido');
  });

  it('debería dar prioridad a la foto fallida sobre la que sigue subiendo', () => {
    const grupo = new FormArray([fotosCon('subidaEnCurso'), fotosCon('subidaFallida')]);

    expect(motivoBloqueoPorFotos(grupo)).toContain('no se ha subido');
  });
});
