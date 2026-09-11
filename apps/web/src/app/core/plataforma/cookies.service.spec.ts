import { TestBed } from '@angular/core/testing';
import { CookiesService, leerDeCabecera } from './cookies.service';

describe('leerDeCabecera', () => {
  it('debería encontrar la cookie entre varias', () => {
    expect(leerDeCabecera('a=1; dk_acceso=si; z=9', 'dk_acceso')).toBe('si');
  });

  it('debería devolver null si la cookie no está', () => {
    expect(leerDeCabecera('a=1; z=9', 'dk_acceso')).toBeNull();
  });

  it('debería devolver null con la cabecera vacía', () => {
    expect(leerDeCabecera('', 'dk_acceso')).toBeNull();
  });

  /** `dk_acceso` y `otro_dk_acceso` son cookies distintas. */
  it('debería exigir que el nombre coincida entero', () => {
    expect(leerDeCabecera('otro_dk_acceso=si', 'dk_acceso')).toBeNull();
  });

  it('debería descodificar el valor', () => {
    expect(leerDeCabecera('dk_idioma=espa%C3%B1ol', 'dk_idioma')).toBe('español');
  });
});

describe('CookiesService', () => {
  let service: CookiesService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(CookiesService);
    document.cookie = 'dk_prueba=; Path=/; Max-Age=0';
  });

  it('debería escribir y leer una cookie en el navegador', () => {
    service.escribir('dk_prueba', 'valor', 30);

    expect(service.leer('dk_prueba')).toBe('valor');
  });

  it('debería borrar la cookie', () => {
    service.escribir('dk_prueba', 'valor', 30);
    service.borrar('dk_prueba');

    expect(service.leer('dk_prueba')).toBeNull();
  });

  it('debería devolver null cuando la cookie no existe', () => {
    expect(service.leer('dk_inexistente')).toBeNull();
  });
});
