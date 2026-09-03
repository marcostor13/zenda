import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { RouterTestingModule } from '@angular/router/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { VerticalKey } from 'shared';
import { HomeComponent } from './home.component';
import { VERTICALES_PUBLICOS } from '../../shared/verticales/verticales.config';
import { AlojamientoService } from '../alojamiento/services/alojamiento.service';

describe('HomeComponent', () => {
  let fixture: ComponentFixture<HomeComponent>;
  let component: HomeComponent;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [HomeComponent, RouterTestingModule],
      providers: [provideHttpClient(), provideHttpClientTesting()],
    }).compileComponents();

    fixture = TestBed.createComponent(HomeComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('debería crear el componente', () => {
    expect(component).toBeTruthy();
  });

  it('debería tener las categorías de Doogking en su orden de uso', () => {
    const keys = component.verticales.map((v) => v.key);
    expect(keys).toEqual([
      // Alojamiento abre la lista: es con lo que arrancó el marketplace.
      VerticalKey.ALOJAMIENTO,
      VerticalKey.VETERINARIA,
      VerticalKey.PELUQUERIA,
      VerticalKey.TRANSPORTE,
      VerticalKey.ADIESTRAMIENTO,
      VerticalKey.HOTELES,
      VerticalKey.SEGUROS,
      VerticalKey.FUNERARIOS,
    ]);
  });

  describe('tarjeta de Explora', () => {
    const tarjeta = (): HTMLAnchorElement | null =>
      fixture.nativeElement.querySelector('.cat-card--explora');

    it('debería enlazar al catálogo de sitios', () => {
      expect(tarjeta()?.getAttribute('href')).toBe('/explora');
    });

    it('debería explicar qué se encuentra allí', () => {
      const texto = tarjeta()?.textContent ?? '';

      expect(texto).toContain('Explora con tu mascota');
      expect(texto.toLowerCase()).toContain('parques');
    });

    it('debería ir al final de la parrilla, tras las categorías reservables', () => {
      // Explora no se reserva: va con las demás porque se busca en el mismo
      // momento, pero después de lo que sí tiene disponibilidad y precio.
      const tarjetas = Array.from(
        (fixture.nativeElement as HTMLElement).querySelectorAll('.cats-grid .cat-card'),
      );

      expect(tarjetas).toHaveLength(component.verticales.length + 1);
      expect(tarjetas.at(-1)).toBe(tarjeta());
    });
  });

  it('no debería ofrecer las categorías fuera del escaparate', () => {
    // La portada anuncia exactamente el escaparate público, ni una más: las
    // categorías retiradas del catálogo no deben reaparecer aquí.
    expect(component.verticales.map((v) => v.key)).toEqual(VERTICALES_PUBLICOS.map((v) => v.key));
    expect(component.verticales.map((v) => v.route)).not.toContain('/cuidadores');
  });

  it('debería usar las etiquetas caninas en las categorías', () => {
    const labels = component.verticales.map((v) => v.label);
    expect(labels).toContain('Alojamiento canino');
    expect(labels).toContain('Veterinarios');
    expect(labels).toContain('Peluquerías caninas');
  });

  it('debería enrutar cada categoría a su ruta propia', () => {
    const rutas = component.verticales.map((v) => v.route);
    expect(rutas).toEqual([
      '/alojamiento',
      '/veterinaria',
      '/peluqueria',
      '/transporte',
      '/adiestramiento',
      '/hoteles',
      '/seguros',
      '/funerarios',
    ]);
  });

  it('debería mostrar el titular "Todo para tu mascota en un solo lugar" en el hero (HU-1.1.1)', () => {
    const el: HTMLElement = fixture.nativeElement;
    const titulo = el.querySelector('.hero__title')?.textContent ?? '';
    expect(titulo.toLowerCase()).toContain('todo para tu mascota');
    expect(titulo.toLowerCase()).toContain('en un solo lugar');
  });

  it('no debería repetir la lista de servicios bajo el titular del hero', () => {
    // El subtitular "Veterinarios, peluquerías, residencias…" se retiró: la
    // rejilla de categorías ya enumera lo mismo unas pantallas más abajo, y
    // quitarlo sube el buscador, que es lo que convierte.
    const el: HTMLElement = fixture.nativeElement;
    expect(el.querySelector('.hero__subtitle')).toBeNull();
  });

  it('debería renderizar los tres valores del bloque "¿Por qué Doogking.com?"', () => {
    const el: HTMLElement = fixture.nativeElement;
    const cards = el.querySelectorAll('.why-card');
    expect(cards.length).toBe(3);
    // Copy exacto aprobado por el cliente: tres valores, ni uno más. Se lee de
    // la pantalla y no de `motivos`, que desde el multiidioma guarda claves de
    // traducción: lo que hay que garantizar es lo que acaba viendo el usuario.
    expect([...cards].map((c) => c.querySelector('.why-card__title')?.textContent?.trim())).toEqual([
      'Reserva en menos de un minuto',
      'Profesionales verificados',
      'Atención 24/7',
    ]);
    expect(el.querySelector('#por-que h2')?.textContent).toContain('¿Por qué Doogking.com?');
  });

  it('debería servir una foto distinta en escritorio para la banda de "¿Por qué Doogking.com?"', () => {
    const el: HTMLElement = fixture.nativeElement;
    const fuente = el.querySelector<HTMLSourceElement>('.why-banner picture source');

    // En escritorio la banda recorta casi todo el alto del original, así que
    // necesita una foto con el perro centrado; el hero solo vale en móvil.
    expect(fuente?.getAttribute('media')).toBe('(min-width: 641px)');
    expect(fuente?.getAttribute('srcset')).toBe(component.bandaPorQueEscritorio);
    expect(component.bandaPorQueEscritorio).not.toBe(component.bandaPorQue);
    expect(el.querySelector('.why-banner img')?.getAttribute('alt')).toBeTruthy();
  });

  it('debería ilustrar cada valor con una fotografía descrita, no con un icono', () => {
    const el: HTMLElement = fixture.nativeElement;
    const fotos = el.querySelectorAll<HTMLImageElement>('.why-card__art img');

    expect(fotos.length).toBe(3);
    // Cada foto necesita su propio alt: son contenido, no decoración.
    fotos.forEach((foto) => expect(foto.getAttribute('alt')).toBeTruthy());
    // Sin fotos repetidas: tres valores distintos piden tres imágenes distintas.
    expect(new Set(component.motivos.map((m) => m.imagen)).size).toBe(3);
    expect(el.querySelectorAll('.why-card rs-icon').length).toBe(0);
  });

  it('debería invitar a explorar todos los servicios sobre la rejilla de categorías', () => {
    const el: HTMLElement = fixture.nativeElement;
    const head = el.querySelector('#categorias .sec-head')?.textContent ?? '';
    // Título y subtítulo aprobados por el cliente (PDF 27/07 §5, captura WA0011).
    expect(head).toContain('Todo lo que tu mascota necesita, en un solo lugar.');
    expect(head).toContain('Reserva con profesionales verificados cerca de ti, de forma rápida, segura y sin complicaciones.');
  });

  it('debería mostrar los 3 valores aprobados bajo el buscador (PDF 27/07 §4)', () => {
    const el: HTMLElement = fixture.nativeElement;
    const items = el.querySelectorAll('.trust__item');

    expect([...items].map((i) => i.querySelector('.trust__title')?.textContent?.trim())).toEqual([
      'Reserva en menos de un minuto',
      'Profesionales verificados',
      'Atención 24/7',
    ]);
    // Cada valor lleva su descripción completa, no solo el titular.
    expect([...items].every((i) => (i.querySelector('.trust__desc')?.textContent ?? '').length > 20))
      .toBe(true);
  });

  it('debería dejar solo la "D" en la barra porque el logotipo grande ya está en el hero (PDF §1)', () => {
    const el: HTMLElement = fixture.nativeElement;
    expect(el.querySelector('.rs-navbar__mark')).toBeTruthy();
    expect(el.querySelector('.rs-navbar__wordmark')).toBeNull();
  });

  it('debería usar el buscador común en el hero', () => {
    const el: HTMLElement = fixture.nativeElement;
    expect(el.querySelector('rs-search-bar')).toBeTruthy();
  });

  it('debería ofrecer las categorías en el encabezado, no dentro del buscador', () => {
    // Están en la tira del encabezado, en cualquier pantalla: repetirlas en la
    // tarjeta obligaba a elegir dos veces lo mismo y se comía la primera
    // pantalla del móvil.
    const el: HTMLElement = fixture.nativeElement;

    expect(el.querySelector('.sb__cats')).toBeNull();
    expect(el.querySelectorAll('.rs-navbar__cats .rs-navbar__cat').length)
      .toBe(component.verticales.length);
  });

  it('debería colocar el buscador sobre la zona de contraste del hero', () => {
    // La tarjeta era blanca sobre blanco y se perdía: ahora vive en el bloque
    // navy, que es el fondo de más contraste de la página.
    const el: HTMLElement = fixture.nativeElement;
    expect(el.querySelector('.hero__main .searchbox .searchbox__panel')).toBeTruthy();
  });

  it('debería usar un icono SVG propio por categoría', () => {
    const iconos = component.verticales.map((v) => v.icono);
    expect(iconos).toEqual([
      '/icons/alojamiento.svg',
      '/icons/veterinaria.svg',
      '/icons/peluqueria.svg',
      '/icons/transporte.svg',
      '/icons/adiestramiento.svg',
      '/icons/hoteles.svg',
      '/icons/seguros.svg',
      '/icons/funerarios.svg',
    ]);
  });

  it('debería renderizar los alojamientos recomendados con precio en euros (HU-1.7.1, rs-card unificado)', () => {
    const el: HTMLElement = fixture.nativeElement;
    const cards = el.querySelectorAll('.stays-grid rs-card');
    expect(cards.length).toBe(component.alojamientosRecomendados().length);
    expect(el.querySelector('.stays-grid')?.textContent).toContain('€');
  });

  it('debería sustituir el escaparate estático por los mejor valorados reales cuando el catálogo responde (PDF §8)', async () => {
    const alojamientoService = TestBed.inject(AlojamientoService);
    jest.spyOn(alojamientoService, 'buscar').mockResolvedValue({
      items: [{
        id: 'a1', nombre: 'Residencia Real', ciudad: 'Madrid', barrio: '', direccion: '',
        score: 9.8, scoreLabel: 'Excepcional', numResenas: 120, precioPorNoche: 44,
        imagenes: ['foto.jpg'], amenities: ['Patio', 'Cámaras', 'Paseos', 'Spa'],
        cancelacionGratis: true, paseosIncluidos: true, espaciosDisponibles: 3, destacado: false,
      }],
      total: 1, page: 1, totalPages: 1,
    });

    await component.ngOnInit();

    const [primero] = component.alojamientosRecomendados();
    expect(alojamientoService.buscar).toHaveBeenCalledWith({ orden: 'valoracion' });
    expect(primero.id).toBe('a1');
    // Solo con id real la tarjeta lleva corazón de favorito y enlace a la ficha.
    expect(primero.tags).toEqual(['Patio', 'Cámaras', 'Paseos']);
  });

  it('debería conservar el escaparate por defecto (sin favoritos) si el catálogo falla', async () => {
    const alojamientoService = TestBed.inject(AlojamientoService);
    jest.spyOn(alojamientoService, 'buscar').mockRejectedValue(new Error('API caída'));

    await component.ngOnInit();

    const recomendados = component.alojamientosRecomendados();
    expect(recomendados.length).toBe(4);
    expect(recomendados.every((r) => r.id === undefined)).toBe(true);
  });

  it('debería navegar al listado de alojamiento con la ciudad al pulsar la tarjeta', () => {
    const router = TestBed.inject(Router);
    const navigateSpy = jest.spyOn(router, 'navigate').mockResolvedValue(true);
    component.irAAlojamiento('Madrid');
    expect(navigateSpy).toHaveBeenCalledWith([component.rutaAlojamiento], { queryParams: { ciudad: 'Madrid' } });
  });

  it('debería mostrar las tres garantías sobre la franja navy', () => {
    const el: HTMLElement = fixture.nativeElement;
    expect(el.querySelectorAll('.trust__item').length).toBe(3);
  });

  it('debería enlazar las ciudades destacadas al listado de alojamiento', () => {
    const el: HTMLElement = fixture.nativeElement;
    expect(el.querySelectorAll('.city-card').length).toBe(component.ciudades.length);
    expect(component.rutaAlojamiento).toBe('/alojamiento');
    expect(component.ciudades.map((c) => c.nombre)).toContain('Madrid');
  });
  describe('feedback 2026-08-20', () => {
    it('deberia dirigirse a cualquier negocio de mascotas, no solo canino', () => {
      const el: HTMLElement = fixture.nativeElement;
      expect(el.querySelector('.pro-cta__title')?.textContent?.trim())
        .toBe('¿Ofreces servicios para mascotas?');
    });

    it('deberia abrir el footer con el logo y las redes, en bandas', () => {
      const el: HTMLElement = fixture.nativeElement;
      const marca = el.querySelector('.home-footer__marca');

      expect(marca?.querySelector('.home-footer__logo')).not.toBeNull();
      expect(marca?.querySelector('.home-footer__social')).not.toBeNull();
    });

    it('deberia listar los servicios del footer en horizontal', () => {
      const el: HTMLElement = fixture.nativeElement;
      const servicios = el.querySelectorAll('.home-footer__servicios a');

      // Las categorias publicas mas "Explora con tu mascota".
      expect(servicios.length).toBe(component.verticales.length + 1);
    });

    it('deberia anunciar las dos tiendas sin enlazar a fichas que no existen', () => {
      const el: HTMLElement = fixture.nativeElement;
      const badges = el.querySelectorAll('.home-footer__store-badge');

      expect(badges.length).toBe(2);
      expect(el.querySelector('.home-footer__stores a')).toBeNull();
    });
  });
});
