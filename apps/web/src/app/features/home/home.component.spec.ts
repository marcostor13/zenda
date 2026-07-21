import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { RouterTestingModule } from '@angular/router/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { VerticalKey } from 'shared';
import { HomeComponent } from './home.component';

describe('HomeComponent', () => {
  let fixture: ComponentFixture<HomeComponent>;
  let component: HomeComponent;
  let router: Router;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [HomeComponent, RouterTestingModule],
      providers: [provideHttpClient(), provideHttpClientTesting()],
    }).compileComponents();

    fixture = TestBed.createComponent(HomeComponent);
    component = fixture.componentInstance;
    router = TestBed.inject(Router);
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

  it('debería navegar a /buscador con los parámetros del formulario', () => {
    const navigateSpy = jest.spyOn(router, 'navigate').mockResolvedValue(true);

    component.searchForm.patchValue({
      vertical: VerticalKey.VETERINARIA,
      ciudad: 'Madrid',
      fechaInicio: '2026-08-01',
      fechaFin: '',
      perros: 2,
    });
    component.onBuscar();

    expect(navigateSpy).toHaveBeenCalledWith(['/buscador'], {
      queryParams: {
        vertical: VerticalKey.VETERINARIA,
        ciudad: 'Madrid',
        desde: '2026-08-01',
        hasta: null,
        perros: 2,
      },
    });
  });

  it('debería usar alojamiento como servicio por defecto en la búsqueda', () => {
    const navigateSpy = jest.spyOn(router, 'navigate').mockResolvedValue(true);

    component.onBuscar();

    const [, opciones] = navigateSpy.mock.calls[0];
    expect((opciones as { queryParams: { vertical: string } }).queryParams.vertical)
      .toBe(VerticalKey.ALOJAMIENTO);
  });

  it('debería devolver el icono de la categoría seleccionada', () => {
    component.searchForm.patchValue({ vertical: VerticalKey.PELUQUERIA });
    expect(component.verticalIcon()).toBe('scissors');
  });

  it('debería renderizar los alojamientos recomendados con precio en euros', () => {
    fixture.detectChanges();
    const el: HTMLElement = fixture.nativeElement;
    const cards = el.querySelectorAll('.stay-card');
    expect(cards.length).toBe(component.alojamientosRecomendados.length);
    expect(el.querySelector('.stay-card__amount')?.textContent).toContain('€');
  });

  it('debería formatear las estrellas doradas', () => {
    expect(component.estrellas(4)).toBe('★★★★☆');
  });
});
