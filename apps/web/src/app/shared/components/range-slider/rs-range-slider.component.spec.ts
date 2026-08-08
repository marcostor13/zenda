import { ComponentFixture, TestBed } from '@angular/core/testing';
import { RsRangeSliderComponent, RangoSeleccionado } from './rs-range-slider.component';

describe('RsRangeSliderComponent', () => {
  let fixture: ComponentFixture<RsRangeSliderComponent>;
  let componente: RsRangeSliderComponent;

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [RsRangeSliderComponent] }).compileComponents();
    fixture = TestBed.createComponent(RsRangeSliderComponent);
    componente = fixture.componentInstance;
    fixture.componentRef.setInput('min', 0);
    fixture.componentRef.setInput('max', 500);
    componente.valorMin.set(0);
    componente.valorMax.set(500);
    fixture.detectChanges();
  });

  const asas = (): HTMLInputElement[] =>
    Array.from(fixture.nativeElement.querySelectorAll('input[type="range"]'));

  it('debería mostrar la etiqueta "€ min – € max+" como en Booking (WA0009)', () => {
    componente.valorMin.set(10);
    fixture.detectChanges();

    const etiqueta = fixture.nativeElement.querySelector('.rrs__etiqueta')?.textContent ?? '';
    expect(etiqueta).toContain('€10');
    // El techo del rango lleva "+" porque significa "o más".
    expect(etiqueta).toContain('€500+');
  });

  it('no debería dejar que el asa mínima cruce a la máxima', () => {
    componente.valorMax.set(100);
    const [asaMin] = asas();
    asaMin.value = '300';
    asaMin.dispatchEvent(new Event('input'));

    expect(componente.valorMin()).toBe(100);
  });

  it('no debería dejar que el asa máxima cruce a la mínima', () => {
    componente.valorMin.set(200);
    const [, asaMax] = asas();
    asaMax.value = '50';
    asaMax.dispatchEvent(new Event('input'));

    expect(componente.valorMax()).toBe(200);
  });

  it('debería emitir el rango solo al soltar el asa (change), no en cada pixel', () => {
    const emitido: RangoSeleccionado[] = [];
    componente.cambio.subscribe((r) => emitido.push(r));

    const [asaMin] = asas();
    asaMin.value = '50';
    asaMin.dispatchEvent(new Event('input'));
    expect(emitido).toHaveLength(0);

    asaMin.dispatchEvent(new Event('change'));
    expect(emitido).toEqual([{ min: 50, max: 500 }]);
  });

  it('debería normalizar el histograma a la barra más alta y marcar las del rango', () => {
    fixture.componentRef.setInput('histograma', [
      { desde: 0, hasta: 100, n: 5 },
      { desde: 100, hasta: 200, n: 10 },
      { desde: 200, hasta: 300, n: 0 },
    ]);
    componente.valorMin.set(0);
    componente.valorMax.set(150);
    fixture.detectChanges();

    const barras = componente.barrasVista();
    expect(barras[1].altura).toBe(100);
    expect(barras[0].altura).toBe(50);
    // La barra vacía conserva una altura mínima visible.
    expect(barras[2].altura).toBe(6);
    expect(barras.map((b) => b.enRango)).toEqual([true, true, false]);
  });

  it('no debería pintar histograma cuando no hay datos', () => {
    expect(fixture.nativeElement.querySelector('.rrs__histograma')).toBeNull();
  });
});
