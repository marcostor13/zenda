import { Component } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { AltoBuscadorDirective, VAR_ALTO_BUSCADOR } from './alto-buscador.directive';

@Component({
  standalone: true,
  imports: [AltoBuscadorDirective],
  template: '<div rsAltoBuscador class="barra">buscador</div>',
})
class AnfitrionComponent {}

describe('AltoBuscadorDirective', () => {
  let fixture: ComponentFixture<AnfitrionComponent>;
  /** jsdom no implementa ResizeObserver; se sustituye para poder dispararlo. */
  let disparar: (() => void) | null;

  beforeEach(async () => {
    disparar = null;
    (globalThis as unknown as { ResizeObserver: unknown }).ResizeObserver = class {
      constructor(cb: () => void) { disparar = cb; }
      observe(): void { /* el test dispara la llamada a mano */ }
      disconnect(): void { /* nada que soltar */ }
    };

    await TestBed.configureTestingModule({ imports: [AnfitrionComponent] }).compileComponents();
    fixture = TestBed.createComponent(AnfitrionComponent);
    fixture.detectChanges();
  });

  afterEach(() => {
    document.documentElement.style.removeProperty(VAR_ALTO_BUSCADOR);
    delete (globalThis as unknown as { ResizeObserver?: unknown }).ResizeObserver;
  });

  it('debería publicar el alto de la barra en la variable CSS', () => {
    const barra: HTMLElement = fixture.nativeElement.querySelector('.barra');
    Object.defineProperty(barra, 'offsetHeight', { value: 192, configurable: true });

    disparar?.();

    expect(document.documentElement.style.getPropertyValue(VAR_ALTO_BUSCADOR)).toBe('192px');
  });

  it('debería publicar cero cuando la barra se oculta', () => {
    const barra: HTMLElement = fixture.nativeElement.querySelector('.barra');
    // Con el mapa a pantalla completa la barra desaparece: el mapa tiene que
    // poder subir hasta arriba en vez de dejar un hueco reservado.
    Object.defineProperty(barra, 'offsetHeight', { value: 0, configurable: true });

    disparar?.();

    expect(document.documentElement.style.getPropertyValue(VAR_ALTO_BUSCADOR)).toBe('0px');
  });

  it('debería limpiar la variable al destruirse', () => {
    const barra: HTMLElement = fixture.nativeElement.querySelector('.barra');
    Object.defineProperty(barra, 'offsetHeight', { value: 120, configurable: true });
    disparar?.();

    fixture.destroy();

    expect(document.documentElement.style.getPropertyValue(VAR_ALTO_BUSCADOR)).toBe('');
  });
});
