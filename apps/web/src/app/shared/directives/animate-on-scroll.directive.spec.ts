import { Component } from '@angular/core';
import { ComponentFixture, TestBed, fakeAsync, tick } from '@angular/core/testing';
import { AnimateOnScrollDirective } from './animate-on-scroll.directive';

@Component({
  standalone: true,
  imports: [AnimateOnScrollDirective],
  template: `<div rsAnim data-testid="caja">contenido</div>`,
})
class AnfitrionComponent {}

type Callback = (entradas: Array<{ isIntersecting: boolean }>) => void;

describe('AnimateOnScrollDirective', () => {
  const originalObserver = window.IntersectionObserver;
  let fixture: ComponentFixture<AnfitrionComponent>;
  let ultimoCallback: Callback | undefined;
  let desconectar: jest.Mock;

  const caja = (): HTMLElement =>
    fixture.nativeElement.querySelector('[data-testid="caja"]');

  const montar = (): void => {
    fixture = TestBed.createComponent(AnfitrionComponent);
    fixture.detectChanges();
  };

  beforeEach(async () => {
    ultimoCallback = undefined;
    desconectar = jest.fn();
    window.IntersectionObserver = jest.fn((cb: Callback) => {
      ultimoCallback = cb;
      return { observe: jest.fn(), unobserve: jest.fn(), disconnect: desconectar };
    }) as unknown as typeof IntersectionObserver;

    await TestBed.configureTestingModule({ imports: [AnfitrionComponent] }).compileComponents();
  });

  afterEach(() => { window.IntersectionObserver = originalObserver; });

  it('debería dejar el elemento tapado hasta que entra en pantalla', () => {
    montar();
    expect(caja().classList).toContain('rs-anim');
    expect(caja().classList).not.toContain('visible');
  });

  it('debería destaparlo cuando el observador avisa de que ya se ve', () => {
    montar();
    ultimoCallback!([{ isIntersecting: true }]);
    expect(caja().classList).toContain('visible');
    expect(desconectar).toHaveBeenCalled();
  });

  it('debería vigilar con umbral cero: uno mayor deja tapado lo más alto que la pantalla', () => {
    montar();
    const opciones = (window.IntersectionObserver as unknown as jest.Mock).mock.calls[0][1];
    expect(opciones.threshold).toBe(0);
  });

  /*
   * El observador sólo recalcula al desplazar o al redimensionar. Si el
   * elemento aparece fuera de pantalla y algo lo trae a la vista sin mediar
   * desplazamiento, el aviso no llega nunca: así se quedaban invisibles las
   * tarjetas de resultado en el iPhone.
   */
  it('debería destaparlo igualmente si el aviso no llega nunca', fakeAsync(() => {
    montar();
    expect(caja().classList).not.toContain('visible');
    tick(1200);
    expect(caja().classList).toContain('visible');
  }));

  it('debería mostrar el contenido tal cual si el navegador no trae observador', () => {
    window.IntersectionObserver = undefined as unknown as typeof IntersectionObserver;
    montar();
    expect(caja().classList).not.toContain('rs-anim');
  });

  it('debería soltar el temporizador al destruirse', fakeAsync(() => {
    montar();
    fixture.destroy();
    expect(desconectar).toHaveBeenCalled();
    tick(1200); // sin pendientes: `fakeAsync` reventaría si quedara alguno
  }));
});
