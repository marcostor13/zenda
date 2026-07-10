import { ComponentFixture, TestBed } from '@angular/core/testing';
import { HttpClientTestingModule } from '@angular/common/http/testing';
import { RouterTestingModule } from '@angular/router/testing';
import { AlojamientoListaComponent } from './alojamiento-lista.component';
import { AlojamientoService, AlojamientoCard, PaginatedResult } from '../services/alojamiento.service';

describe('AlojamientoListaComponent', () => {
  let fixture: ComponentFixture<AlojamientoListaComponent>;
  let component: AlojamientoListaComponent;
  let alojamientoService: jest.Mocked<AlojamientoService>;

  const cardMock: AlojamientoCard = {
    id: 'a1',
    nombre: 'Royal Paws Retreat',
    ciudad: 'Madrid',
    barrio: 'Pozuelo',
    direccion: 'Camino de la Dehesa 12',
    score: 5.0,
    scoreLabel: 'Excepcional',
    numResenas: 128,
    precioPorNoche: 45,
    imagenes: ['img.jpg'],
    amenities: ['Piscina'],
    cancelacionGratis: true,
    paseosIncluidos: true,
    espaciosDisponibles: 4,
    destacado: true,
  };

  const resultadoMock: PaginatedResult<AlojamientoCard> = {
    items: [cardMock],
    total: 1,
    page: 1,
    totalPages: 1,
  };

  beforeEach(async () => {
    alojamientoService = { buscar: jest.fn(), obtener: jest.fn() } as any;
    alojamientoService.buscar.mockResolvedValue(resultadoMock);

    await TestBed.configureTestingModule({
      imports: [AlojamientoListaComponent, RouterTestingModule, HttpClientTestingModule],
      providers: [{ provide: AlojamientoService, useValue: alojamientoService }],
    }).compileComponents();

    fixture = TestBed.createComponent(AlojamientoListaComponent);
    component = fixture.componentInstance;
  });

  it('debería crear el componente', () => {
    expect(component).toBeTruthy();
  });

  it('debería cargar alojamientos con vertical alojamiento al iniciar', async () => {
    fixture.detectChanges();
    await fixture.whenStable();

    expect(alojamientoService.buscar).toHaveBeenCalled();
    expect(component.alojamientos()).toEqual([cardMock]);
    expect(component.totalItems()).toBe(1);
  });

  it('debería mostrar el total como espacios encontrados', async () => {
    fixture.detectChanges();
    await fixture.whenStable();

    expect(component.totalLabel()).toBe('1 espacios encontrados');
  });

  it('debería mostrar estado de error (sin listados falsos) si la API falla', async () => {
    alojamientoService.buscar.mockRejectedValue(new Error('offline'));
    fixture.detectChanges();
    await fixture.whenStable();

    expect(component.alojamientos().length).toBe(0);
    expect(component.error()).toBe(true);
    expect(component.cargando()).toBe(false);
  });

  it('debería renderizar el precio por noche y el badge Premium', async () => {
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    const html: string = fixture.nativeElement.innerHTML;
    expect(html).toContain('€45');
    expect(html).toContain('/ noche');
    expect(html).toContain('Premium');
  });

  it('debería generar estrellas doradas a partir del score', () => {
    expect(component.estrellas(5)).toBe('★★★★★');
    expect(component.estrellas(4.6)).toBe('★★★★★');
    expect(component.estrellas(4.2)).toBe('★★★★☆');
  });

  it('debería resetear la página al aplicar filtros', async () => {
    fixture.detectChanges();
    await fixture.whenStable();

    component.paginaActual.set(3);
    component.aplicarFiltros();

    expect(component.paginaActual()).toBe(1);
  });

  it('debería alternar amenities seleccionadas', () => {
    component.toggleAmenity('Piscina');
    expect(component.amenitiesSelec()).toContain('Piscina');

    component.toggleAmenity('Piscina');
    expect(component.amenitiesSelec()).not.toContain('Piscina');
  });
});
