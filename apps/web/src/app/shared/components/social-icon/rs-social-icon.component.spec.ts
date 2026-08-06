import { ComponentFixture, TestBed } from '@angular/core/testing';
import { RsSocialIconComponent, type RedSocialKey } from './rs-social-icon.component';

describe('RsSocialIconComponent', () => {
  let fixture: ComponentFixture<RsSocialIconComponent>;

  const crear = (name: RedSocialKey, etiqueta = ''): HTMLElement => {
    fixture = TestBed.createComponent(RsSocialIconComponent);
    fixture.componentRef.setInput('name', name);
    if (etiqueta) fixture.componentRef.setInput('etiqueta', etiqueta);
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [RsSocialIconComponent] }).compileComponents();
  });

  it.each<RedSocialKey>(['instagram', 'facebook', 'tiktok', 'x', 'youtube', 'linkedin'])(
    'debería dibujar la marca oficial de %s',
    (red) => {
      const host = crear(red);
      expect(host.querySelectorAll('svg path, svg circle').length).toBeGreaterThan(0);
    },
  );

  it('debería rellenar el glifo en lugar de trazarlo, como exige un logo de marca', () => {
    const svg = crear('instagram').querySelector('svg');
    expect(svg?.getAttribute('fill')).toBe('currentColor');
  });

  it('debería nombrar el icono para lectores de pantalla, ya que sustituye al texto', () => {
    const svg = crear('tiktok', 'TikTok').querySelector('svg');
    expect(svg?.getAttribute('role')).toBe('img');
    expect(svg?.getAttribute('aria-label')).toBe('TikTok');
  });

  it('debería aplicar el tamaño pedido', () => {
    fixture = TestBed.createComponent(RsSocialIconComponent);
    fixture.componentRef.setInput('name', 'facebook');
    fixture.componentRef.setInput('size', 32);
    fixture.detectChanges();

    const svg = (fixture.nativeElement as HTMLElement).querySelector('svg');
    expect(svg?.getAttribute('width')).toBe('32');
    expect(svg?.getAttribute('height')).toBe('32');
  });
});
