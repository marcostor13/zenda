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

  it('debería tener las 6 categorías caninas de Doogking', () => {
    const keys = component.verticales.map((v) => v.key);
    expect(keys).toEqual([
      VerticalKey.VETERINARIA,
      VerticalKey.PELUQUERIA,
      VerticalKey.ALOJAMIENTO,
      VerticalKey.TRANSPORTE,
      VerticalKey.ADIESTRAMIENTO,
      VerticalKey.HOTELES,
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
    ]);
  });

  it('debería mostrar el eslogan "TODO PARA SU REY" en el hero', () => {
    const el: HTMLElement = fixture.nativeElement;
    const titulo = el.querySelector('.hero__title')?.textContent ?? '';
    expect(titulo.toLowerCase()).toContain('todo para su rey');
    expect(titulo.toLowerCase()).toContain('en un solo lugar');
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
