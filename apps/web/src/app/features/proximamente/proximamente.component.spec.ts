import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ProximamenteComponent } from './proximamente.component';

describe('ProximamenteComponent', () => {
  let fixture: ComponentFixture<ProximamenteComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ProximamenteComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(ProximamenteComponent);
    fixture.detectChanges();
  });

  it('debería mostrar el logo de Doogking', () => {
    const img: HTMLImageElement = fixture.nativeElement.querySelector('.proximamente__logo');
    expect(img.getAttribute('alt')).toBe('Doogking');
  });

  it('debería mostrar el mensaje "Muy pronto"', () => {
    const texto: string = fixture.nativeElement.textContent;
    expect(texto).toContain('Muy pronto');
  });

  it('debería mostrar un icono por cada categoría destacada', () => {
    const iconos = fixture.nativeElement.querySelectorAll('.proximamente__categoria img');
    expect(iconos.length).toBe(5);
  });
});
