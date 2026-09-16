import { Component } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { PanelLateralDirective } from './panel-lateral.directive';

@Component({
  standalone: true,
  imports: [PanelLateralDirective],
  template: `<div class="panel rs-sticky-panel" rsPanelLateral></div>`,
})
class AnfitrionComponent {}

/**
 * La regla del panel lateral: pegado sólo si cabe entero. Un panel pegado más
 * alto que el hueco visible esconde su propio botón de reservar, y la página se
 * desplaza por detrás sin arrastrarlo.
 */
describe('PanelLateralDirective', () => {
  let fixture: ComponentFixture<AnfitrionComponent>;
  const altoReal = window.innerHeight;

  const panel = () => (fixture.nativeElement as HTMLElement).querySelector('.panel')!;

  /** `offsetHeight` es 0 en jsdom: se declara el alto del panel a mano. */
  const conAlto = (alto: number) => {
    Object.defineProperty(panel(), 'offsetHeight', { value: alto, configurable: true });
  };

  const ventanaDe = (alto: number) => {
    Object.defineProperty(window, 'innerHeight', { value: alto, configurable: true });
    window.dispatchEvent(new Event('resize'));
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [AnfitrionComponent] }).compileComponents();
    fixture = TestBed.createComponent(AnfitrionComponent);
  });

  afterEach(() => {
    Object.defineProperty(window, 'innerHeight', { value: altoReal, configurable: true });
  });

  it('debería dejarlo pegado cuando cabe en la pantalla', () => {
    Object.defineProperty(window, 'innerHeight', { value: 1000, configurable: true });
    fixture.detectChanges();
    conAlto(500);
    ventanaDe(1000);

    expect(panel().classList.contains('rs-sticky-panel')).toBe(true);
  });

  /* El caso del portátil de pantalla corta: 730 px de panel en 768 de alto. */
  it('debería soltarlo cuando no cabe, para que se lea entero bajando', () => {
    fixture.detectChanges();
    conAlto(730);
    ventanaDe(768);

    expect(panel().classList.contains('rs-sticky-panel')).toBe(false);
  });

  it('debería volver a pegarlo si la ventana crece', () => {
    fixture.detectChanges();
    conAlto(730);
    ventanaDe(768);
    expect(panel().classList.contains('rs-sticky-panel')).toBe(false);

    ventanaDe(1200);

    expect(panel().classList.contains('rs-sticky-panel')).toBe(true);
  });

  /* Justo en el límite no vale «casi»: por eso se exige la holgura. */
  it('no debería pegarlo cuando su última línea roza el borde', () => {
    fixture.detectChanges();
    // 900 de ventana − 84 de cabecera = 816 de hueco; con 810 sobran 6 px.
    conAlto(810);
    ventanaDe(900);

    expect(panel().classList.contains('rs-sticky-panel')).toBe(false);
  });

  it('debería dejar de escuchar la ventana al destruirse', () => {
    fixture.detectChanges();
    conAlto(500);
    ventanaDe(1000);

    fixture.destroy();
    ventanaDe(200);

    // Sin la baja, este resize habría vuelto a medir y le habría quitado la clase.
    expect(panel().classList.contains('rs-sticky-panel')).toBe(true);
  });
});
