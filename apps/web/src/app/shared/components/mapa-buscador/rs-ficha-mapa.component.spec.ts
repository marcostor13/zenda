import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { RsFichaMapaComponent } from './rs-ficha-mapa.component';
import { IMG_FALLBACK } from '../../media/images';
import type { PuntoMapa } from '../mapa/rs-mapa.component';

describe('RsFichaMapaComponent', () => {
  let fixture: ComponentFixture<RsFichaMapaComponent>;
  let componente: RsFichaMapaComponent;

  const punto: PuntoMapa = {
    id: 'a1',
    lat: 40.4168,
    lng: -3.7038,
    titulo: 'Residencia Las Rozas',
    subtitulo: 'Las Rozas',
    etiqueta: '24 €',
    rating: 4.62,
    totalResenas: 18,
    imagenes: ['fachada.jpg', 'patio.jpg', 'suite.jpg'],
    enlace: ['/alojamiento', 'residencia-las-rozas'],
  };

  const pintar = (datos: PuntoMapa): HTMLElement => {
    fixture.componentRef.setInput('punto', datos);
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [RsFichaMapaComponent],
      providers: [provideRouter([])],
    }).compileComponents();

    fixture = TestBed.createComponent(RsFichaMapaComponent);
    componente = fixture.componentInstance;
  });

  it('debería enseñar el nombre, el sitio, la nota y el precio del comercio', () => {
    const ficha = pintar(punto);

    expect(ficha.querySelector('.fm__titulo')?.textContent).toContain('Residencia Las Rozas');
    expect(ficha.querySelector('.fm__lugar')?.textContent).toContain('Las Rozas');
    expect(ficha.querySelector('.fm__nota')?.textContent).toBe('4.6');
    expect(ficha.querySelector('.fm__resenas')?.textContent).toContain('18 reseñas');
    expect(ficha.querySelector('.fm__precio strong')?.textContent).toBe('24 €');
  });

  it('debería enlazar a la ficha completa del servicio', () => {
    const ficha = pintar(punto);

    const cta = ficha.querySelector('.fm__cta') as HTMLAnchorElement;
    expect(cta.getAttribute('href')).toBe('/alojamiento/residencia-las-rozas');
  });

  it('no debería ofrecer un enlace que no lleva a ninguna parte', () => {
    const ficha = pintar({ ...punto, enlace: undefined });

    expect(ficha.querySelector('.fm__cta')).toBeNull();
    expect(ficha.querySelector('.fm__titulo a')).toBeNull();
  });

  describe('carrusel de fotos', () => {
    it('debería empezar por la primera foto y decir cuántas hay', () => {
      const ficha = pintar(punto);

      expect(ficha.querySelector('.fm__foto')?.getAttribute('src')).toBe('fachada.jpg');
      expect(ficha.querySelector('.fm__cuenta')?.textContent).toBe('1 / 3');
    });

    it('debería pasar de foto con las flechas', () => {
      const ficha = pintar(punto);

      (ficha.querySelector('.fm__flecha--sig') as HTMLButtonElement).click();
      fixture.detectChanges();

      expect(ficha.querySelector('.fm__foto')?.getAttribute('src')).toBe('patio.jpg');
    });

    it('debería dar la vuelta al llegar a los extremos', () => {
      pintar(punto);

      componente.mover(-1);
      expect(componente.fotoActual()).toBe('suite.jpg');

      componente.mover(1);
      expect(componente.fotoActual()).toBe('fachada.jpg');
    });

    it('debería volver a la primera foto al cambiar de pin', () => {
      pintar(punto);
      componente.mover(1);

      pintar({ ...punto, id: 'a2', imagenes: ['otra.jpg', 'mas.jpg'] });

      expect(componente.fotoActual()).toBe('otra.jpg');
    });

    it('no debería enseñar flechas con una sola foto', () => {
      const ficha = pintar({ ...punto, imagenes: undefined, imagen: 'unica.jpg' });

      expect(ficha.querySelector('.fm__flecha')).toBeNull();
      expect(ficha.querySelector('.fm__foto')?.getAttribute('src')).toBe('unica.jpg');

      componente.mover(1);
      expect(componente.fotoActual()).toBe('unica.jpg');
    });

    it('debería poner la foto de respaldo cuando el comercio no tiene ninguna', () => {
      pintar({ ...punto, imagenes: [], imagen: undefined });

      expect(componente.fotoActual()).toBe(IMG_FALLBACK);
    });
  });

  it('debería presentar como nuevo al comercio que aún no tiene reseñas', () => {
    const ficha = pintar({ ...punto, rating: 0, totalResenas: 0 });

    expect(ficha.querySelector('.fm__nota')).toBeNull();
    expect(ficha.querySelector('.rs-badge')?.textContent).toContain('Nuevo');
  });

  it('debería usar el singular con una sola reseña', () => {
    const ficha = pintar({ ...punto, totalResenas: 1 });

    expect(ficha.querySelector('.fm__resenas')?.textContent).toContain('1 reseña');
    expect(ficha.querySelector('.fm__resenas')?.textContent).not.toContain('reseñas');
  });

  it('no debería inventar un precio cuando el servicio no lo declara', () => {
    // Transporte: el precio depende del viaje y se calcula aparte.
    const ficha = pintar({ ...punto, etiqueta: undefined });

    expect(ficha.querySelector('.fm__precio')).toBeNull();
  });

  it('debería avisar al cerrar', () => {
    const ficha = pintar(punto);
    const cerrada = jest.fn();
    componente.cerrar.subscribe(cerrada);

    (ficha.querySelector('.fm__cerrar') as HTMLButtonElement).click();

    expect(cerrada).toHaveBeenCalled();
  });
});
