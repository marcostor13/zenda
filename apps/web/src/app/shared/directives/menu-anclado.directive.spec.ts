import { Component, signal } from '@angular/core';
import { TestBed, ComponentFixture } from '@angular/core/testing';
import { MenuAncladoDirective, PosicionMenu } from './menu-anclado.directive';

@Component({
  standalone: true,
  imports: [MenuAncladoDirective],
  template: `
    <button (rsMenuAnclado)="posicion.set($event)" [rsMenuAlto]="200" [rsMenuAncho]="210">
      Acciones
    </button>
  `,
})
class AnfitrionTest {
  readonly posicion = signal<PosicionMenu | null>(null);
}

describe('MenuAncladoDirective', () => {
  let fixture: ComponentFixture<AnfitrionTest>;
  let boton: HTMLButtonElement;

  /** Coloca el botón donde interese, que es de lo único que depende el cálculo. */
  function situarBoton(rect: Partial<DOMRect>): void {
    jest.spyOn(boton, 'getBoundingClientRect').mockReturnValue({
      top: 0, bottom: 0, left: 0, right: 0, width: 32, height: 32, x: 0, y: 0,
      toJSON: () => ({}), ...rect,
    } as DOMRect);
  }

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [AnfitrionTest] }).compileComponents();
    fixture = TestBed.createComponent(AnfitrionTest);
    fixture.detectChanges();
    boton = fixture.nativeElement.querySelector('button');
    Object.defineProperty(window, 'innerHeight', { value: 800, writable: true });
  });

  it('debería abrirse justo debajo del botón cuando hay sitio', () => {
    situarBoton({ top: 100, bottom: 132, right: 500 });

    boton.click();

    expect(fixture.componentInstance.posicion()).toEqual({ top: 136, left: 290 });
  });

  it('debería abrirse hacia arriba si no cabe por debajo', () => {
    // Es el caso de las últimas filas de la tabla, que es donde se recortaba.
    situarBoton({ top: 700, bottom: 732, right: 500 });

    boton.click();

    expect(fixture.componentInstance.posicion()!.top).toBe(496);
  });

  it('no debería salirse por el borde izquierdo con un botón muy a la izquierda', () => {
    situarBoton({ top: 100, bottom: 132, right: 80 });

    boton.click();

    expect(fixture.componentInstance.posicion()!.left).toBe(4);
  });

  it('no debería salirse por arriba en una ventana muy baja', () => {
    Object.defineProperty(window, 'innerHeight', { value: 200, writable: true });
    situarBoton({ top: 150, bottom: 182, right: 500 });

    boton.click();

    expect(fixture.componentInstance.posicion()!.top).toBe(4);
  });
});
