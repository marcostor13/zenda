import { Component, ChangeDetectionStrategy } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { I18nService } from './i18n.service';
import { TraducirPipe } from './traducir.pipe';

@Component({
  standalone: true,
  imports: [TraducirPipe],
  // OnPush a propósito: es el caso que rompe con un pipe puro, porque el
  // componente no se repinta solo al cambiar una signal que no consume.
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<span id="texto">{{ 'Ingresar' | t }}</span>
             <span id="sinTraducir">{{ 'Cadena inventada para la prueba' | t }}</span>
             <span id="params">{{ 'Nivel {nivel}' | t: { nivel: 3 } }}</span>`,
})
class AnfitrionComponent {}

describe('TraducirPipe', () => {
  let fixture: ComponentFixture<AnfitrionComponent>;
  let i18n: I18nService;

  const texto = (id: string): string =>
    (fixture.nativeElement as HTMLElement).querySelector(`#${id}`)!.textContent!.trim();

  beforeEach(async () => {
    localStorage.clear();
    // jsdom se identifica como 'en-US'; se fija el idioma fuente para que la
    // prueba mida la traducción y no la detección del navegador.
    localStorage.setItem('doogking_idioma', 'es');
    await TestBed.configureTestingModule({ imports: [AnfitrionComponent] }).compileComponents();
    i18n = TestBed.inject(I18nService);
    fixture = TestBed.createComponent(AnfitrionComponent);
    fixture.detectChanges();
  });

  it('debería pintar el texto tal cual en español, que es el idioma fuente', () => {
    expect(texto('texto')).toBe('Ingresar');
  });

  it('debería interpolar los parámetros', () => {
    expect(texto('params')).toBe('Nivel 3');
  });

  it('debería repintar un componente OnPush al cambiar de idioma, sin recargar', async () => {
    await i18n.elegirIdioma('en');
    fixture.detectChanges();

    expect(texto('texto')).toBe('Sign in');
  });

  it('debería dejar en español lo que el idioma elegido no traduzca', async () => {
    await i18n.elegirIdioma('en');
    fixture.detectChanges();

    expect(texto('sinTraducir')).toBe('Cadena inventada para la prueba');
  });
});
