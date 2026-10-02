import { TestBed } from '@angular/core/testing';
import { NavigationEnd, Router } from '@angular/router';
import { Subject } from 'rxjs';
import { SeoRutasService, seoDeRuta } from './seo-rutas';
import { SeoService } from './seo.service';

describe('seoDeRuta', () => {
  it('debería dar título y descripción propios a las páginas fijas', () => {
    const seo = seoDeRuta('/privacidad');
    expect(seo?.titulo).toBe('Política de privacidad · Doogking');
    expect(seo?.descripcion.length).toBeGreaterThan(60);
    expect(seo?.canonica).toBe('/privacidad');
    expect(seo?.indexable).toBeUndefined();
  });

  it('debería ignorar la consulta y la barra final', () => {
    expect(seoDeRuta('/ayuda/?q=pago')?.canonica).toBe('/ayuda');
  });

  it('debería marcar como no indexables las zonas privadas', () => {
    const seo = seoDeRuta('/comercio/listados');
    expect(seo?.indexable).toBe(false);
    expect(seo?.titulo).toBe('Panel de comercio · Doogking');
  });

  it('debería dejar a cada componente las páginas con datos propios', () => {
    expect(seoDeRuta('/')).toBeNull();
    expect(seoDeRuta('/alojamiento/reino-canino-valencia')).toBeNull();
    expect(seoDeRuta('/explora')).toBeNull();
  });

  it('no debería repetir títulos entre páginas fijas', () => {
    const rutas = ['/ayuda', '/contacto', '/para-comercios', '/transporte', '/privacidad',
      '/terminos', '/cookies', '/condiciones', '/eliminar-datos'];
    const titulos = rutas.map((ruta) => seoDeRuta(ruta)?.titulo);
    expect(new Set(titulos).size).toBe(rutas.length);
  });
});

describe('SeoRutasService', () => {
  it('debería aplicar los metadatos de la ruta al terminar cada navegación', () => {
    const eventos = new Subject<unknown>();
    const seo = { aplicar: jest.fn() };
    TestBed.configureTestingModule({
      providers: [
        { provide: Router, useValue: { events: eventos.asObservable() } },
        { provide: SeoService, useValue: seo },
      ],
    });
    TestBed.inject(SeoRutasService);

    eventos.next(new NavigationEnd(1, '/perfil', '/perfil'));
    eventos.next(new NavigationEnd(2, '/alojamiento', '/alojamiento'));

    expect(seo.aplicar).toHaveBeenCalledTimes(1);
    expect(seo.aplicar).toHaveBeenCalledWith(expect.objectContaining({ indexable: false }));
  });
});
