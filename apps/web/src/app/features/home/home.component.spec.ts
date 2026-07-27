import { ComponentFixture, TestBed } from '@angular/core/testing';
import { RouterTestingModule } from '@angular/router/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { VerticalKey } from 'shared';
import { HomeComponent } from './home.component';

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

  it('debería mostrar el eslogan en tuteo "TODO PARA TU REY" en el hero', () => {
    const el: HTMLElement = fixture.nativeElement;
    const titulo = el.querySelector('.hero__title')?.textContent ?? '';
    expect(titulo.toLowerCase()).toContain('todo para tu rey');
    expect(titulo.toLowerCase()).not.toContain('todo para su rey');
    expect(titulo.toLowerCase()).toContain('en un solo lugar');
  });

  it('debería resumir la amplitud de servicios bajo el titular del hero', () => {
    const el: HTMLElement = fixture.nativeElement;
    const sub = el.querySelector('.hero__subtitle')?.textContent ?? '';
    expect(sub).toContain('alojamientos premium');
    expect(sub).toContain('veterinarios de confianza');
    expect(sub).toContain('peluquerías caninas');
  });

  it('debería renderizar los cuatro pilares del bloque "¿Por qué Doogking?"', () => {
    const el: HTMLElement = fixture.nativeElement;
    const cards = el.querySelectorAll('.why-card');
    expect(cards.length).toBe(4);
    expect(component.motivos.map((m) => m.titulo)).toEqual([
      'Reserva en segundos',
      'Profesionales verificados',
      'Miles de servicios en un solo lugar',
      'Atención cuando la necesites',
    ]);
    expect(el.querySelector('#por-que h2')?.textContent).toContain('¿Por qué Doogking.com?');
  });

  it('debería invitar a explorar todos los servicios sobre la rejilla de categorías', () => {
    const el: HTMLElement = fixture.nativeElement;
    const head = el.querySelector('#categorias .sec-head')?.textContent ?? '';
    expect(head).toContain('Explora todos nuestros servicios');
    expect(head).toContain('Reserva en segundos con los mejores profesionales cerca de ti.');
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

  it('debería renderizar los alojamientos recomendados con precio en euros', () => {
    const el: HTMLElement = fixture.nativeElement;
    const cards = el.querySelectorAll('.stay-card');
    expect(cards.length).toBe(component.alojamientosRecomendados.length);
    expect(el.querySelector('.stay-card__amount')?.textContent).toContain('€');
  });

  it('debería formatear las estrellas doradas', () => {
    expect(component.estrellas(4)).toBe('★★★★☆');
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
