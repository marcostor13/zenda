import { ComponentFixture, TestBed } from '@angular/core/testing';
import { RsBrandIconComponent, type MarcaPagoKey } from './rs-brand-icon.component';

describe('RsBrandIconComponent', () => {
  let fixture: ComponentFixture<RsBrandIconComponent>;

  const pintar = (name: MarcaPagoKey, size?: number): SVGElement => {
    fixture = TestBed.createComponent(RsBrandIconComponent);
    fixture.componentInstance.name = name;
    if (size) fixture.componentInstance.size = size;
    fixture.detectChanges();
    return (fixture.nativeElement as HTMLElement).querySelector('svg') as SVGElement;
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [RsBrandIconComponent] }).compileComponents();
  });

  it('debería etiquetar la marca para lectores de pantalla (TCK-8008)', () => {
    const svg = pintar('amex');

    expect(svg.getAttribute('role')).toBe('img');
    expect(svg.getAttribute('aria-label')).toBe('American Express');
  });

  it('debería dibujar Mastercard con sus dos círculos', () => {
    const svg = pintar('mastercard');

    expect(svg.querySelectorAll('circle')).toHaveLength(2);
  });

  it('debería mantener la proporción de tarjeta al cambiar el tamaño', () => {
    const svg = pintar('visa', 20);

    expect(svg.getAttribute('height')).toBe('20');
    expect(svg.getAttribute('width')).toBe('30');
  });

  it('debería usar el fondo corporativo de cada marca', () => {
    expect(pintar('stripe').querySelector('rect')?.getAttribute('fill')).toBe('#635BFF');
    expect(pintar('visa').querySelector('rect')?.getAttribute('fill')).toBe('#1A1F71');
  });

  it('no debería escribir el nombre de la marca en las que llevan símbolo', () => {
    expect(pintar('mastercard').textContent?.trim()).toBe('');
  });
});
