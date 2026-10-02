import { TestBed } from '@angular/core/testing';
import { RsAsistenteDisparadorComponent } from './rs-asistente-disparador.component';
import { AsistenteUiService } from './asistente-ui.service';

describe('RsAsistenteDisparadorComponent', () => {
  let ui: AsistenteUiService;

  const crear = () => {
    const fixture = TestBed.createComponent(RsAsistenteDisparadorComponent);
    fixture.detectChanges();
    return fixture;
  };
  const boton = (el: HTMLElement) => el.querySelector<HTMLButtonElement>('[data-testid="disparador-asistente"]')!;

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [RsAsistenteDisparadorComponent] }).compileComponents();
    ui = TestBed.inject(AsistenteUiService);
  });

  it('debería enseñar «¿Te ayudo?»', () => {
    expect(boton(crear().nativeElement).textContent).toContain('¿Te ayudo?');
  });

  /* Mientras haya botón en la cabecera, el panel no pinta su flotante. */
  it('debería registrarse mientras existe y retirarse al destruirse', () => {
    const fixture = crear();
    expect(ui.hayDisparadorEnCabecera()).toBe(true);

    fixture.destroy();
    expect(ui.hayDisparadorEnCabecera()).toBe(false);
  });

  it('debería abrir el asistente anclado a sí mismo y cerrarlo al volver a pulsar', () => {
    const fixture = crear();
    const el = boton(fixture.nativeElement);

    el.click();
    fixture.detectChanges();
    expect(ui.abierto()).toBe(true);
    expect(ui.origen()).toBe(el);
    expect(el.getAttribute('aria-expanded')).toBe('true');

    el.click();
    expect(ui.abierto()).toBe(false);
  });
});
