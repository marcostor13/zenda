import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { PrivacidadComponent } from './privacidad.component';
import { RESPONSABLE } from './legal.datos';

describe('PrivacidadComponent', () => {
  let fixture: ComponentFixture<PrivacidadComponent>;
  let texto: string;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [PrivacidadComponent],
      providers: [provideRouter([])],
    }).compileComponents();

    fixture = TestBed.createComponent(PrivacidadComponent);
    fixture.detectChanges();
    texto = fixture.nativeElement.textContent as string;
  });

  /*
   * Meta y Google rechazan la política de privacidad si no identifica al
   * responsable del tratamiento, y el RGPD lo exige igual.
   */
  it('debería identificar al responsable del tratamiento', () => {
    expect(texto).toContain(RESPONSABLE.razonSocial);
    expect(texto).toContain(RESPONSABLE.identificacionFiscal);
    expect(texto).toContain(RESPONSABLE.domicilio);
  });

  it('debería dar un contacto de privacidad', () => {
    const enlace = fixture.nativeElement.querySelector(`a[href="mailto:${RESPONSABLE.emailPrivacidad}"]`);

    expect(enlace).not.toBeNull();
  });

  it('debería enlazar la página de eliminación de datos', () => {
    const enlaces: HTMLAnchorElement[] = Array.from(fixture.nativeElement.querySelectorAll('a'));

    expect(enlaces.some((a) => a.getAttribute('href') === '/eliminar-datos')).toBe(true);
  });

  /* Cada apartado responde a una exigencia del RGPD; quitar uno invalida el documento. */
  it.each([
    ['quién trata los datos', 'Quién trata tus datos'],
    ['qué datos se tratan', 'Qué datos tratamos'],
    ['finalidad y base legal', 'base legal'],
    ['destinatarios', 'Quién más ve tus datos'],
    ['plazos de conservación', 'Cuánto tiempo los guardamos'],
    ['derechos del interesado', 'Tus derechos'],
  ])('debería cubrir %s', (_caso, esperado) => {
    expect(texto).toContain(esperado);
  });

  it('debería nombrar la autoridad de control ante la que reclamar', () => {
    expect(texto).toContain('Agencia Española de Protección de Datos');
  });

  /*
   * Los datos de la tarjeta no pasan por nuestros servidores y el documento lo
   * afirma: si algún día eso cambiara, este test tiene que caer.
   */
  it('debería declarar que la tarjeta no pasa por nuestros servidores', () => {
    expect(texto).toContain('nunca pasan por nuestros servidores');
  });

  it('debería declarar el tratamiento de los datos sanitarios de la mascota', () => {
    expect(texto).toContain('vacunas');
    expect(texto).toContain('alergias');
  });
});
