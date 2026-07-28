import { ComponentFixture, TestBed } from '@angular/core/testing';
import { RsRatingComponent } from './rs-rating.component';

describe('RsRatingComponent', () => {
  let fixture: ComponentFixture<RsRatingComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [RsRatingComponent] }).compileComponents();
    fixture = TestBed.createComponent(RsRatingComponent);
  });

  it('muestra la nota, la etiqueta cualitativa y el nº de reseñas', () => {
    fixture.componentRef.setInput('score', 4.8);
    fixture.componentRef.setInput('label', 'Muy bueno');
    fixture.componentRef.setInput('count', 325);
    fixture.detectChanges();

    const texto = (fixture.nativeElement as HTMLElement).textContent ?? '';
    expect(texto).toContain('4.8');
    expect(texto).toContain('Muy bueno');
    expect(texto).toContain('325');
  });

  it('no muestra el conteo de reseñas si no se pasa', () => {
    fixture.componentRef.setInput('score', 4.8);
    fixture.detectChanges();

    expect((fixture.nativeElement as HTMLElement).textContent).not.toContain('reseñas');
  });
});
