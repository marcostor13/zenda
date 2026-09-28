import { ComponentFixture, TestBed } from '@angular/core/testing';
import { RouterTestingModule } from '@angular/router/testing';
import { RsCardComponent } from './rs-card.component';

describe('RsCardComponent', () => {
  let fixture: ComponentFixture<RsCardComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [RsCardComponent, RouterTestingModule] }).compileComponents();
    fixture = TestBed.createComponent(RsCardComponent);
  });

  it('sin imageUrl se comporta como antes: título/subtítulo + contenido proyectado', () => {
    fixture.componentRef.setInput('title', 'Título');
    fixture.componentRef.setInput('subtitle', 'Subtítulo');
    fixture.detectChanges();

    const texto = (fixture.nativeElement as HTMLElement).textContent ?? '';
    expect(texto).toContain('Título');
    expect(texto).toContain('Subtítulo');
    expect(fixture.nativeElement.querySelector('.rs-hotel-card')).toBeNull();
  });

  it('con imageUrl renderiza la tarjeta de resultado con imagen, rating, precio y badges', () => {
    fixture.componentRef.setInput('imageUrl', 'foto.jpg');
    fixture.componentRef.setInput('title', 'Hotel Canino Luna');
    fixture.componentRef.setInput('subtitle', 'Madrid');
    fixture.componentRef.setInput('badges', [{ label: 'Recomendado', variant: 'accent', icon: '⭐' }]);
    fixture.componentRef.setInput('rating', { score: 4.8, label: 'Muy bueno', count: 120 });
    fixture.componentRef.setInput('price', { amount: '35 €', period: '/ noche' });
    fixture.detectChanges();

    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('.rs-hotel-card')).not.toBeNull();
    expect(el.querySelector('img')?.getAttribute('src')).toBe('foto.jpg');
    expect(el.textContent).toContain('Hotel Canino Luna');
    expect(el.textContent).toContain('Recomendado');
    expect(el.textContent).toContain('35 €');
  });

  it('emite cardClick al pulsar cuando clickable=true', () => {
    fixture.componentRef.setInput('imageUrl', 'foto.jpg');
    fixture.detectChanges();
    let emitido = false;
    fixture.componentInstance.cardClick.subscribe(() => (emitido = true));

    (fixture.nativeElement.querySelector('.rs-hotel-card') as HTMLElement).click();

    expect(emitido).toBe(true);
  });

  it('no emite cardClick cuando clickable=false', () => {
    fixture.componentRef.setInput('imageUrl', 'foto.jpg');
    fixture.componentRef.setInput('clickable', false);
    fixture.detectChanges();
    let emitido = false;
    fixture.componentInstance.cardClick.subscribe(() => (emitido = true));

    (fixture.nativeElement.querySelector('.rs-hotel-card') as HTMLElement).click();

    expect(emitido).toBe(false);
  });

  it('con routerLink se renderiza como <a> real (SEO/ctrl+click) en vez de <article>', () => {
    fixture.componentRef.setInput('imageUrl', 'foto.jpg');
    fixture.componentRef.setInput('title', 'Royal Dog Resort');
    fixture.componentRef.setInput('routerLink', ['/alojamiento', 'a1']);
    fixture.componentRef.setInput('queryParams', { ciudad: 'Madrid' });
    fixture.detectChanges();

    const el = fixture.nativeElement as HTMLElement;
    const link = el.querySelector('a.rs-hotel-card');
    expect(link).not.toBeNull();
    expect(link?.getAttribute('href')).toBe('/alojamiento/a1?ciudad=Madrid');
    expect(el.querySelector('article.rs-hotel-card')).toBeNull();
  });
  /**
   * Tarjeta apaisada, la de los listados de resultados. El precio cerraba una
   * columna a la derecha; en los bocetos cierra el cuerpo, alineado con el
   * nombre.
   */
  describe('tarjeta apaisada', () => {
    const apaisada = () => {
      fixture.componentRef.setInput('imageUrl', 'foto.jpg');
      fixture.componentRef.setInput('title', 'Villa Canina El Bosque');
      fixture.componentRef.setInput('horizontal', true);
      fixture.componentRef.setInput('price', { amount: '24 €', period: '/ noche' });
      fixture.detectChanges();
    };

    it('deberia cerrar el cuerpo con el precio', () => {
      apaisada();

      const el: HTMLElement = fixture.nativeElement;
      const pie = el.querySelector('.rs-hotel-card__body .rs-hotel-card__pie');
      expect(pie).not.toBeNull();
      expect(pie?.textContent).toContain('24 €');
    });

    it('no deberia quedar la columna lateral', () => {
      apaisada();

      expect(fixture.nativeElement.querySelector('.rs-hotel-card__aside')).toBeNull();
    });

    it('deberia mantener el precio y la accion en la misma linea', () => {
      // Precio a la izquierda, accion a la derecha: es lo que muestran los
      // bocetos y lo que deja comparar de un vistazo.
      fixture.componentRef.setInput('ctaLabel', 'Ver ficha');
      apaisada();

      const pie: HTMLElement | null = fixture.nativeElement.querySelector('.rs-hotel-card__pie');
      expect(pie?.querySelector('.rs-price')).not.toBeNull();
      expect(pie?.querySelector('.rs-hotel-card__cta')).not.toBeNull();
    });

    /* Observación del cliente 28-09: la nota como en Booking («Fabuloso 4,6»). */
    it('deberia pintar la nota con su etiqueta y sus reseñas junto al nombre', () => {
      fixture.componentRef.setInput('rating', { score: 4.6, label: 'Fabuloso', count: 953 });
      apaisada();

      const bloque: HTMLElement | null = fixture.nativeElement.querySelector('.rs-hotel-card__cabecera .rs-hotel-card__puntuacion');
      expect(bloque?.querySelector('.rs-hotel-card__puntuacion-nota')?.textContent?.trim()).toBe('4,6');
      expect(bloque?.textContent).toContain('Fabuloso');
      expect(bloque?.textContent).toContain('953 reseñas');
    });

    it('no deberia pintar la nota de un servicio sin reseñas', () => {
      fixture.componentRef.setInput('rating', { score: 0, label: 'Correcto', count: 0 });
      apaisada();

      const el: HTMLElement = fixture.nativeElement;
      expect(el.querySelector('.rs-hotel-card__puntuacion')).toBeNull();
      expect(el.textContent).toContain('Aún sin valoraciones');
    });
  });
});
