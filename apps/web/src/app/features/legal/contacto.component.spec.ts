import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { ContactoComponent } from './contacto.component';
import { RESPONSABLE } from './legal.datos';
import { REDES_SOCIALES } from '../../shared/catalogos/redes-sociales.catalogo';

describe('ContactoComponent', () => {
  let fixture: ComponentFixture<ContactoComponent>;
  let elemento: HTMLElement;
  let texto: string;

  const enlaces = (): string[] =>
    Array.from(elemento.querySelectorAll('a')).map((a) => a.getAttribute('href') ?? '');

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ContactoComponent],
      providers: [provideRouter([])],
    }).compileComponents();

    fixture = TestBed.createComponent(ContactoComponent);
    fixture.detectChanges();
    elemento = fixture.nativeElement as HTMLElement;
    texto = elemento.textContent ?? '';
  });

  it('debería titularse "Contacto"', () => {
    expect(elemento.querySelector('h1')?.textContent).toContain('Contacto');
  });

  /**
   * La página no lleva formulario a propósito: uno sin buzón atendido detrás
   * deja al usuario esperando una respuesta que no llega.
   */
  it('no debería ofrecer un formulario sin buzón detrás', () => {
    expect(elemento.querySelector('form')).toBeNull();
    expect(elemento.querySelector('textarea')).toBeNull();
  });

  it('debería dar los dos buzones reales de la plataforma', () => {
    expect(enlaces()).toEqual(expect.arrayContaining([
      `mailto:${RESPONSABLE.emailSoporte}`,
      `mailto:${RESPONSABLE.emailPrivacidad}`,
    ]));
  });

  it('debería mandar primero al circuito de incidencias de la reserva', () => {
    expect(enlaces()).toContain('/reservas');
    expect(texto).toMatch(/Tengo una incidencia/i);
  });

  it('debería enlazar la ayuda, la privacidad y el alta de comercios', () => {
    expect(enlaces()).toEqual(expect.arrayContaining([
      '/ayuda', '/privacidad', '/eliminar-datos', '/para-comercios',
    ]));
  });

  it('debería identificar al titular de la plataforma', () => {
    expect(texto).toContain(RESPONSABLE.razonSocial);
    expect(texto).toContain(RESPONSABLE.identificacionFiscal);
  });

  /** Los perfiles salen del catálogo único: aquí no se escribe ninguna URL a mano. */
  it('debería listar los perfiles sociales del catálogo compartido', () => {
    const urls = enlaces();

    for (const red of REDES_SOCIALES) expect(urls).toContain(red.url);
  });
});
