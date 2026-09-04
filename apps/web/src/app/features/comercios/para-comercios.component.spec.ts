import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { ParaComerciosComponent } from './para-comercios.component';
import { PLANES } from '../../shared/catalogos/planes.catalogo';
import { VERTICALES_PUBLICOS } from '../../shared/verticales/verticales.config';
import { RESPONSABLE } from '../legal/legal.datos';

describe('ParaComerciosComponent', () => {
  let fixture: ComponentFixture<ParaComerciosComponent>;
  let componente: ParaComerciosComponent;
  let raiz: HTMLElement;

  const enlaces = (): string[] =>
    Array.from(raiz.querySelectorAll('a')).map((a) => a.getAttribute('href') ?? '');

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ParaComerciosComponent],
      providers: [provideRouter([])],
    }).compileComponents();

    fixture = TestBed.createComponent(ParaComerciosComponent);
    componente = fixture.componentInstance;
    raiz = fixture.nativeElement as HTMLElement;
    fixture.detectChanges();
  });

  /*
   * La landing existe para una sola cosa. Si algún día deja de enlazar el
   * alta, deja de servir para nada por bonita que sea.
   */
  it('debería llevar al alta de comercio desde varios puntos de la página', () => {
    const alAlta = enlaces().filter((href) => href === '/auth/registro-comercio');

    expect(alAlta.length).toBeGreaterThanOrEqual(3);
  });

  it('debería anunciar exactamente las categorías que el buscador publica', () => {
    const titulos = Array.from(raiz.querySelectorAll('.pc-cat h3')).map((h) => h.textContent?.trim());

    expect(titulos).toEqual(VERTICALES_PUBLICOS.map((v) => v.labelCorto));
  });

  /*
   * Los planes se pintan desde el catálogo compartido, no a mano: un cambio de
   * precio en el panel del comercio tiene que llegar aquí solo.
   */
  it('debería pintar los planes del catálogo con su precio', () => {
    const tarjetas = raiz.querySelectorAll('.pc-plan');
    const texto = raiz.textContent ?? '';

    expect(tarjetas.length).toBe(PLANES.length);
    PLANES.forEach((plan) => {
      expect(texto).toContain(plan.nombre);
    });
    expect(texto).toContain('29 €');
  });

  it('debería presentar el plan gratuito sin importe', () => {
    const precios = Array.from(raiz.querySelectorAll('.pc-plan__precio strong')).map((e) => e.textContent?.trim());

    expect(precios[0]).toBe('Gratis');
  });

  /*
   * Prometer comisión sin enlazar el texto que el comercio firma es
   * justamente lo que genera desconfianza en un alta.
   */
  it('debería enlazar las condiciones generales del servicio', () => {
    expect(enlaces()).toContain('/condiciones');
  });

  it('debería ofrecer un contacto de soporte', () => {
    expect(enlaces()).toContain(`mailto:${RESPONSABLE.emailSoporte}`);
  });

  describe('acordeón de preguntas frecuentes', () => {
    const boton = (indice: number): HTMLButtonElement =>
      raiz.querySelectorAll<HTMLButtonElement>('.pc-faq__boton')[indice];

    it('debería abrir la primera pregunta al entrar, para que se vea que hay respuestas', () => {
      expect(componente.abierta()).toBe(0);
      expect(raiz.querySelectorAll('.pc-faq__respuesta').length).toBe(1);
    });

    it('debería abrir la pregunta pulsada y cerrar la anterior', () => {
      boton(2).click();
      fixture.detectChanges();

      expect(componente.abierta()).toBe(2);
      expect(boton(2).getAttribute('aria-expanded')).toBe('true');
      expect(boton(0).getAttribute('aria-expanded')).toBe('false');
      expect(raiz.querySelectorAll('.pc-faq__respuesta').length).toBe(1);
    });

    it('debería cerrar la pregunta abierta al volver a pulsarla', () => {
      boton(0).click();
      fixture.detectChanges();

      expect(componente.abierta()).toBeNull();
      expect(raiz.querySelectorAll('.pc-faq__respuesta').length).toBe(0);
    });
  });
});
