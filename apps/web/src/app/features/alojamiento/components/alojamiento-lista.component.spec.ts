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
    alojamientoService = { buscar: jest.fn(), obtener: jest.fn(), facetas: jest.fn() } as any;
    alojamientoService.buscar.mockResolvedValue(resultadoMock);
    alojamientoService.facetas.mockResolvedValue({ precios: [], amenities: [], valoracion: [] });

    await TestBed.configureTestingModule({
      imports: [AlojamientoListaComponent, RouterTestingModule, HttpClientTestingModule],
      providers: [{ provide: AlojamientoService, useValue: alojamientoService }],
    }).compileComponents();

    fixture = TestBed.createComponent(AlojamientoListaComponent);
    component = fixture.componentInstance;
  });

  afterEach(() => {
    // Se devuelve el doble a "responde bien" ANTES de destruir: si al destruir
    // queda alguna carga en vuelo con el mock rechazando, su promesa se queda
    // sin manejar y estalla en el siguiente test, no en este.
    alojamientoService.buscar.mockResolvedValue(resultadoMock);
    alojamientoService.facetas.mockResolvedValue({ precios: [], amenities: [], valoracion: [] });
    fixture.destroy();
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
    // `mockImplementation` y no `mockRejectedValue`: este último construye la
    // promesa rechazada al definir el doble, y si el componente no llega a
    // consumirla queda como unhandled rejection que estalla en otro test.
    alojamientoService.buscar.mockImplementation(() => Promise.reject(new Error('offline')));
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

  describe('mapa y facetas (PDF 27/07 §3)', () => {
    const conGeo = (extra: Partial<AlojamientoCard>): AlojamientoCard => ({ ...cardMock, ...extra });

    it('debería pintar solo los alojamientos con coordenadas y avisar de los que faltan', () => {
      component.alojamientos.set([
        conGeo({ id: 'a1', lat: 40.4, lng: -3.7, precioPorNoche: 24 }),
        conGeo({ id: 'a2' }), // sin lat/lng
      ]);

      expect(component.puntosMapa()).toEqual([
        { id: 'a1', lat: 40.4, lng: -3.7, etiqueta: '€24', titulo: 'Royal Paws Retreat' },
      ]);
      // El que no tiene ubicación no se oculta del listado: solo se avisa.
      expect(component.sinCoordenadas()).toBe(1);
    });

    it('debería abrir y cerrar el mapa, limpiando el pin resaltado al cerrar', () => {
      component.destacarDesdeMapa('a1');
      component.alternarMapa();
      expect(component.mapaAbierto()).toBe(true);
      expect(component.destacadoId()).toBe('a1');

      component.alternarMapa();
      expect(component.mapaAbierto()).toBe(false);
      expect(component.destacadoId()).toBeNull();
    });

    it('debería exponer los contadores por amenity y por valoración', async () => {
      alojamientoService.facetas.mockResolvedValue({
        precios: [{ desde: 10, hasta: 40, n: 6 }],
        amenities: [{ valor: 'Piscina', n: 87 }],
        valoracion: [{ minimo: 4, n: 12 }],
      });

      await component.cargarFacetas('Madrid');

      expect(alojamientoService.facetas).toHaveBeenCalledWith('Madrid');
      expect(component.conteoAmenity('Piscina')).toBe(87);
      expect(component.conteoValoracion(4)).toBe(12);
      expect(component.histogramaPrecios()).toEqual([{ desde: 10, hasta: 40, n: 6 }]);
    });

    it('no debería mostrar contadores si las facetas fallan, pero sí los resultados', async () => {
      fixture.detectChanges();
      await fixture.whenStable();
      alojamientoService.facetas.mockImplementation(() => Promise.reject(new Error('facetas caídas')));

      await component.cargarFacetas('Madrid');

      // Los contadores desaparecen, pero el listado sigue en pie.
      expect(component.conteoAmenity('Piscina')).toBeNull();
      expect(component.histogramaPrecios()).toEqual([]);
      expect(component.alojamientos()).toEqual([cardMock]);
    });
  });
});
