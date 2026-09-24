import { ComponentFixture, TestBed } from '@angular/core/testing';
import { RsBarraCtaComponent } from './rs-barra-cta.component';

describe('RsBarraCtaComponent', () => {
  let fixture: ComponentFixture<RsBarraCtaComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [RsBarraCtaComponent] }).compileComponents();
    fixture = TestBed.createComponent(RsBarraCtaComponent);
  });

  it('no debería pintar precio si no lo hay', () => {
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.bc__precio')).toBeNull();
  });

  it('debería pintar el precio con su etiqueta', () => {
    fixture.componentRef.setInput('precio', 42);
    fixture.componentRef.setInput('etiquetaPrecio', 'Desde');
    fixture.detectChanges();

    const precio = fixture.nativeElement.querySelector('.bc__precio') as HTMLElement;
    expect(precio.textContent).toContain('Desde');
    expect(precio.textContent).toContain('42');
  });
});
