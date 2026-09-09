import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { CookiesComponent } from './cookies.component';

describe('CookiesComponent', () => {
  let fixture: ComponentFixture<CookiesComponent>;
  let elemento: HTMLElement;
  let texto: string;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [CookiesComponent],
      providers: [provideRouter([])],
    }).compileComponents();

    fixture = TestBed.createComponent(CookiesComponent);
    fixture.detectChanges();
    elemento = fixture.nativeElement as HTMLElement;
    texto = elemento.textContent ?? '';
  });

  it('debería titularse "Política de cookies"', () => {
    expect(elemento.querySelector('h1')?.textContent).toContain('Política de cookies');
  });

  /**
   * La tabla es el documento: describe lo que la aplicación guarda de verdad.
   * Si alguien añade o retira una clave en el código y no la refleja aquí, la
   * política deja de ser cierta.
   */
  it('debería listar cada clave que la aplicación guarda en el navegador', () => {
    const claves = Array.from(elemento.querySelectorAll('.lg-tabla tbody code'))
      .map((c) => c.textContent?.trim());

    expect(claves).toEqual(expect.arrayContaining([
      'zenda_token', 'zenda_usuario', 'doogking_idioma', 'doogking_moneda',
      'zenda-theme', 'dk_login_email', 'dk_registro_comercio_borrador', 'zenda_notif_prefs',
    ]));
  });

  it('debería explicar para qué sirve y cuánto dura cada clave', () => {
    const filas = elemento.querySelectorAll('.lg-tabla tbody tr');

    expect(filas.length).toBeGreaterThan(0);
    filas.forEach((fila) => {
      expect(fila.querySelectorAll('td').length).toBe(3);
      Array.from(fila.querySelectorAll('td')).forEach((celda) => {
        expect(celda.textContent?.trim()).not.toBe('');
      });
    });
  });

  it('debería afirmar que no hay cookies de publicidad ni de seguimiento', () => {
    expect(texto).toMatch(/no usa cookies de publicidad ni de seguimiento/i);
  });

  /** Sin cookies de análisis no hay nada que consentir: no se pinta un banner falso. */
  it('debería justificar por qué no pide consentimiento', () => {
    expect(texto).toMatch(/no exige consentimiento previo/i);
  });

  it('debería declarar los terceros que sí ponen cookies', () => {
    expect(texto).toContain('Stripe');
    expect(texto).toContain('Google');
  });

  it('debería decir cómo borrarlo', () => {
    expect(texto).toMatch(/modo privado/i);
    expect(texto).toMatch(/ajustes de tu navegador/i);
  });
});
