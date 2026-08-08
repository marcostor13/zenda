import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { RouterTestingModule } from '@angular/router/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { VerticalKey } from 'shared';
import { HomeComponent } from './home.component';
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
      VerticalKey.VETERINARIA,
      VerticalKey.PELUQUERIA,
      VerticalKey.ALOJAMIENTO,
      VerticalKey.TRANSPORTE,
      VerticalKey.ADIESTRAMIENTO,
      VerticalKey.HOTELES,
      VerticalKey.SEGUROS,
      VerticalKey.CUIDADORES,
    ]);
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
      '/veterinaria',
      '/peluqueria',
      '/alojamiento',
      '/transporte',
      '/adiestramiento',
      '/hoteles',
      '/seguros',
      '/cuidadores',
    ]);
  });

  it('debería mostrar el titular "Todo para tu mascota en un solo lugar" en el hero (HU-1.1.1)', () => {
    const el: HTMLElement = fixture.nativeElement;
    const titulo = el.querySelector('.hero__title')?.textContent ?? '';
    expect(titulo.toLowerCase()).toContain('todo para tu mascota');
    expect(titulo.toLowerCase()).toContain('en un solo lugar');
  });

  it('debería resumir la amplitud de servicios bajo el titular del hero (HU-1.1.1)', () => {
    const el: HTMLElement = fixture.nativeElement;
    const sub = el.querySelector('.hero__subtitle')?.textContent ?? '';
    expect(sub).toContain('Veterinarios');
    expect(sub).toContain('peluquerías');
    expect(sub).toContain('hoteles pet friendly');
  });

  it('debería renderizar los cuatro pilares del bloque "¿Por qué Doogking?"', () => {
    const el: HTMLElement = fixture.nativeElement;
    const cards = el.querySelectorAll('.why-card');
    expect(cards.length).toBe(4);
    // Copy aprobado por el cliente (PDF 27/07 §6, captura WA0010).
    expect(component.motivos.map((m) => m.titulo)).toEqual([
      'Reserva en segundos',
      'Profesionales verificados',
      'Todo para tu mascota en un solo lugar',
      'Atención cuando la necesites',
    ]);
    expect(el.querySelector('#por-que h2')?.textContent).toContain('¿Por qué Doogking.com?');
  });

  it('debería invitar a explorar todos los servicios sobre la rejilla de categorías', () => {
    const el: HTMLElement = fixture.nativeElement;
    const head = el.querySelector('#categorias .sec-head')?.textContent ?? '';
    // Título y subtítulo aprobados por el cliente (PDF 27/07 §5, captura WA0011).
    expect(head).toContain('Todo lo que tu mascota necesita, en un solo lugar.');
    expect(head).toContain('Reserva con profesionales verificados cerca de ti, de forma rápida, segura y sin complicaciones.');
  });

  it('debería mostrar los 3 valores aprobados bajo el buscador (PDF 27/07 §4)', () => {
    expect(component.garantias.map((g) => g.titulo)).toEqual([
      'Reserva en menos de un minuto',
      'Profesionales verificados',
      'Atención 24/7',
    ]);
    // Cada valor lleva su descripción completa, no solo el titular.
    expect(component.garantias.every((g) => g.descripcion.length > 20)).toBe(true);
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

  it('debería renderizar la fila de categorías del buscador con sus iconos', () => {
    const el: HTMLElement = fixture.nativeElement;
    const iconos = el.querySelectorAll('.sb__cat-icon');
    // 6 categorías + el acceso «Más servicios»
    expect(iconos.length).toBe(component.verticales.length + 1);
  });

  it('debería usar un icono SVG propio por categoría', () => {
    const iconos = component.verticales.map((v) => v.icono);
    expect(iconos).toEqual([
      '/icons/veterinaria.svg',
      '/icons/peluqueria.svg',
      '/icons/alojamiento.svg',
      '/icons/transporte.svg',
      '/icons/adiestramiento.svg',
      '/icons/hoteles.svg',
      '/icons/seguros.svg',
      '/icons/cuidadores.svg',
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
});
