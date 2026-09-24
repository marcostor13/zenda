import { ComponentFixture, TestBed } from '@angular/core/testing';
import { RsIconComponent } from './rs-icon.component';
import { DIBUJOS_ICONO } from './iconos';

describe('RsIconComponent', () => {
  let fixture: ComponentFixture<RsIconComponent>;

  const svg = (): SVGElement | null =>
    (fixture.nativeElement as HTMLElement).querySelector('svg');

  const marcado = (): string => (fixture.nativeElement as HTMLElement).innerHTML;

  const pintar = (name: string) => {
    fixture.componentRef.setInput('name', name);
    fixture.detectChanges();
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [RsIconComponent] }).compileComponents();
    fixture = TestBed.createComponent(RsIconComponent);
  });

  it('debería dibujar el icono pedido', () => {
    pintar('search');

    expect(svg()?.querySelector('circle')).not.toBeNull();
    expect(marcado()).toContain('m21 21-4.35-4.35');
  });

  it('debería cambiar de dibujo al cambiar el nombre', () => {
    pintar('search');
    pintar('heart');

    expect(marcado()).not.toContain('m21 21-4.35-4.35');
    expect(marcado()).toContain('M19 14');
  });

  /** Un nombre mal escrito no puede tumbar la pantalla: se queda sin icono. */
  it('no debería pintar nada ante un nombre desconocido', () => {
    pintar('no-existe-este-icono');

    expect(marcado().trim()).toBe('');
  });

  /**
   * El HTML se inserta saltándose el saneador, así que lo que llegue por `name`
   * no puede acabar nunca en el DOM: sólo se usa para buscar en el mapa.
   */
  it('no debería inyectar el contenido del propio nombre', () => {
    pintar('<script>alert(1)</script>');

    expect(marcado()).not.toContain('script');
  });

  /** `size="14"` y `[size]="14"` conviven en el código: los dos deben valer. */
  it('debería aceptar la medida como texto', () => {
    fixture.componentRef.setInput('name', 'search');
    fixture.componentRef.setInput('size', '18');
    fixture.detectChanges();

    expect(svg()?.getAttribute('width')).toBe('18');
  });

  it('debería caer a la medida por defecto ante un valor sin sentido', () => {
    fixture.componentRef.setInput('name', 'search');
    fixture.componentRef.setInput('size', 'grande');
    fixture.detectChanges();

    expect(svg()?.getAttribute('width')).toBe('24');
  });

  it('debería respetar tamaño y grosor', () => {
    fixture.componentRef.setInput('name', 'search');
    fixture.componentRef.setInput('size', 32);
    fixture.componentRef.setInput('stroke', 3);
    fixture.detectChanges();

    expect(svg()?.getAttribute('width')).toBe('32');
    expect(svg()?.getAttribute('stroke-width')).toBe('3');
  });

  it('debería rellenar el trazo cuando se le pide', () => {
    fixture.componentRef.setInput('name', 'heart');
    fixture.componentRef.setInput('filled', true);
    fixture.detectChanges();

    expect(svg()?.getAttribute('fill')).toBe('currentColor');
  });

  it('debería quedar fuera del árbol de accesibilidad', () => {
    pintar('search');

    expect(svg()?.getAttribute('aria-hidden')).toBe('true');
  });

  /**
   * La razón de existir del refactor: un `@switch` de 105 ramas dejaba casi cien
   * nodos comentario por icono, 5.114 sólo en la portada (hallazgo SEO-13).
   */
  it('no debería dejar nodos comentario en el HTML', () => {
    pintar('search');

    const comentarios = (fixture.nativeElement as HTMLElement).innerHTML.match(/<!--/g) ?? [];
    expect(comentarios.length).toBe(0);
  });
});

describe('DIBUJOS_ICONO', () => {
  it('debería conservar los 115 iconos del catálogo', () => {
    expect(Object.keys(DIBUJOS_ICONO).length).toBe(115);
  });

  it('debería traer sólo marcado de dibujo, sin etiquetas svg anidadas', () => {
    for (const [nombre, dibujo] of Object.entries(DIBUJOS_ICONO)) {
      expect(`${nombre}: ${dibujo}`).not.toContain('<svg');
      expect(`${nombre}: ${dibujo}`).not.toContain('<script');
    }
  });

  it('no debería tener ningún icono vacío', () => {
    for (const [nombre, dibujo] of Object.entries(DIBUJOS_ICONO)) {
      expect(`${nombre} tiene dibujo: ${dibujo.length > 0}`).toBe(`${nombre} tiene dibujo: true`);
    }
  });
});
