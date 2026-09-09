import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { TerminosComponent } from './terminos.component';
import { RESPONSABLE } from './legal.datos';

describe('TerminosComponent', () => {
  let fixture: ComponentFixture<TerminosComponent>;
  let texto: string;
  let elemento: HTMLElement;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [TerminosComponent],
      providers: [provideRouter([])],
    }).compileComponents();

    fixture = TestBed.createComponent(TerminosComponent);
    fixture.detectChanges();
    elemento = fixture.nativeElement as HTMLElement;
    texto = elemento.textContent ?? '';
  });

  it('debería titularse "Términos y condiciones"', () => {
    expect(elemento.querySelector('h1')?.textContent).toContain('Términos y condiciones');
  });

  it('debería identificar al responsable con los datos de legal.datos.ts', () => {
    expect(texto).toContain(RESPONSABLE.razonSocial);
    expect(texto).toContain(RESPONSABLE.identificacionFiscal);
  });

  /**
   * Es la afirmación jurídicamente decisiva de la página: Doogking intermedia,
   * el servicio lo presta el comercio. Sin eso, el documento no protege a nadie.
   */
  it('debería dejar claro que el servicio lo presta el comercio, no la plataforma', () => {
    expect(texto).toContain('intermediario');
    expect(texto).toMatch(/lo presta el comercio/i);
  });

  it('debería explicar que el precio se muestra con el IVA incluido', () => {
    expect(texto).toMatch(/IVA incluido/i);
  });

  it('debería remitir a la política de cancelación del comercio', () => {
    expect(texto).toMatch(/política de cancelación/i);
  });

  /** El desistimiento de 14 días no aplica a un servicio con fecha reservada. */
  it('debería recoger la excepción europea al derecho de desistimiento', () => {
    expect(texto).toContain('2011/83/UE');
  });

  it('debería enlazar el resto de documentos legales', () => {
    const destinos = Array.from(elemento.querySelectorAll('a'))
      .map((a) => a.getAttribute('href'));

    expect(destinos).toEqual(expect.arrayContaining(['/privacidad', '/cookies', '/condiciones', '/contacto']));
  });
});
