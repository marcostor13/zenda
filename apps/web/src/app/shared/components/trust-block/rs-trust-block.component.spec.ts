import { ComponentFixture, TestBed } from '@angular/core/testing';
import { RsTrustBlockComponent } from './rs-trust-block.component';

describe('RsTrustBlockComponent', () => {
  let fixture: ComponentFixture<RsTrustBlockComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [RsTrustBlockComponent] }).compileComponents();
    fixture = TestBed.createComponent(RsTrustBlockComponent);
  });

  it('muestra los checks por defecto de la variante "reserva"', () => {
    fixture.detectChanges();
    const texto = (fixture.nativeElement as HTMLElement).textContent ?? '';
    expect(texto).toContain('Pago seguro con Stripe');
    expect(texto).toContain('Confirmación inmediata');
  });

  it('ordena los checks poniendo la confianza antes que las condiciones (TCK-8009)', () => {
    fixture.detectChanges();
    const etiquetas = Array.from(
      (fixture.nativeElement as HTMLElement).querySelectorAll('.rs-trust-block__item'),
    ).map((li) => li.textContent?.trim());

    expect(etiquetas).toEqual([
      'Empresa verificada',
      'Pago seguro con Stripe',
      'Confirmación inmediata',
      'Reseñas verificadas',
      'Sin cargos ocultos',
      'Cancelación según política',
      'Atención al cliente',
      'Soporte antes, durante y después de la estancia',
    ]);
  });

  it('renderiza iconos vectoriales, no emojis (TCK-8010)', () => {
    fixture.detectChanges();
    const host = fixture.nativeElement as HTMLElement;
    expect(host.querySelectorAll('rs-icon svg').length).toBe(8);
    expect(host.textContent ?? '').not.toMatch(/[\u{1F300}-\u{1FAFF}]/u);
  });

  it('muestra el mensaje de Protección Doogking en la variante "proteccion"', () => {
    fixture.componentRef.setInput('variant', 'proteccion');
    fixture.detectChanges();
    expect((fixture.nativeElement as HTMLElement).textContent).toContain('Protección Doogking');
  });

  it('añade items extra propios de la pantalla', () => {
    fixture.componentRef.setInput('items', [{ icon: 'bone', label: 'Paseos diarios incluidos' }]);
    fixture.detectChanges();
    expect((fixture.nativeElement as HTMLElement).textContent).toContain('Paseos diarios incluidos');
  });
});
