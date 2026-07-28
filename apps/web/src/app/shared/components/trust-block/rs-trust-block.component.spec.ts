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

  it('muestra el mensaje de Protección Doogking en la variante "proteccion"', () => {
    fixture.componentRef.setInput('variant', 'proteccion');
    fixture.detectChanges();
    expect((fixture.nativeElement as HTMLElement).textContent).toContain('Protección Doogking');
  });

  it('añade items extra propios de la pantalla', () => {
    fixture.componentRef.setInput('items', [{ icon: '🦴', label: 'Paseos diarios incluidos' }]);
    fixture.detectChanges();
    expect((fixture.nativeElement as HTMLElement).textContent).toContain('Paseos diarios incluidos');
  });
});
