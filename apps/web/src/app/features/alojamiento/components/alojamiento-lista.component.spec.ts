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
    alojamientoService = {
      buscar: jest.fn(), obtener: jest.fn(), facetas: jest.fn(), puntosMapa: jest.fn(),
    } as any;
    alojamientoService.buscar.mockResolvedValue(resultadoMock);
    alojamientoService.facetas.mockResolvedValue({ precios: [], amenities: [], valoracion: [] });
    alojamientoService.puntosMapa.mockResolvedValue([]);

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
    alojamientoService.puntosMapa.mockResolvedValue([]);
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
    fixture.detectChanges();
    await fixture.whenStable();

    // El fallo se provoca sobre una carga que este test espera de verdad: con
    // el `detectChanges` inicial, la promesa rechazada la consumía el `ngOnInit`
    // fuera del test y quedaba como unhandled rejection que estallaba en otro.
    alojamientoService.buscar.mockImplementation(() => Promise.reject(new Error('offline')));
    await component.cargarAlojamientos();

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

  it('debería llevar al buscador lo marcado en el panel de filtros', async () => {
    // Las amenidades ya no se alternan en el listado: las marca el panel común
    // `rs-filtros-listado` y llegan aquí en un solo evento.
    component.aplicarFiltros({ amenities: ['Piscina'], precioMin: 20, vertical: {} });
    await fixture.whenStable();

    expect(alojamientoService.buscar).toHaveBeenLastCalledWith(
      expect.objectContaining({ amenities: ['Piscina'], precioMin: 20 }),
    );
    // Cambiar el filtro vuelve a la primera página: si no, se pediría la 3 de
    // un resultado que ahora quizá tiene una sola.
    expect(component.paginaActual()).toBe(1);
  });

  describe('mapa y facetas (PDF 27/07 §3)', () => {
    it('debería construir los pines desde el endpoint de mapa, no desde la página actual', async () => {
      alojamientoService.puntosMapa.mockResolvedValue([
        { id: 'a1', titulo: 'Royal Paws Retreat', precio: 24, lat: 40.4, lng: -3.7, rating: 4.8, imagen: 'img.jpg' },
      ]);

      await component.cargarPuntosMapa({});

      expect(component.puntosMapa()).toEqual([
        {
          id: 'a1', lat: 40.4, lng: -3.7, etiqueta: '€24',
          titulo: 'Royal Paws Retreat', imagen: 'img.jpg', rating: 4.8,
        },
      ]);
    });

    it('no debería quedarse sin listado si fallan los pines del mapa', async () => {
      fixture.detectChanges();
      await fixture.whenStable();
      alojamientoService.puntosMapa.mockImplementation(() => Promise.reject(new Error('mapa caído')));

      await component.cargarPuntosMapa({});

      expect(component.puntosMapa()).toEqual([]);
      expect(component.alojamientos()).toEqual([cardMock]);
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

    it('debería buscar acotando a la zona del mapa y descartar la ciudad escrita', async () => {
      fixture.detectChanges();
      await fixture.whenStable();
      alojamientoService.buscar.mockClear();

      await component.buscarEnZona({
        swLat: 40.3, swLng: -3.8, neLat: 40.5, neLng: -3.6,
        centroLat: 40.4, centroLng: -3.7, zoom: 12,
      });

      const filtros = alojamientoService.buscar.mock.calls[0][0];
      expect(filtros.zona).toEqual({ swLat: 40.3, swLng: -3.8, neLat: 40.5, neLng: -3.6 });
      // La zona manda: si el usuario arrastró el mapa, la ciudad tecleada sobra.
      expect(filtros.ciudad).toBeUndefined();
      expect(component.paginaActual()).toBe(1);
    });

    it('debería volver a buscar sin zona al cerrar el mapa', async () => {
      fixture.detectChanges();
      await fixture.whenStable();
      component.alternarMapa();
      await component.buscarEnZona({
        swLat: 40.3, swLng: -3.8, neLat: 40.5, neLng: -3.6,
        centroLat: 40.4, centroLng: -3.7, zoom: 12,
      });
      alojamientoService.buscar.mockClear();

      component.alternarMapa();
      await fixture.whenStable();

      expect(alojamientoService.buscar.mock.calls[0][0].zona).toBeUndefined();
    });

    it('debería exponer los contadores por amenity y por valoración', async () => {
      alojamientoService.facetas.mockResolvedValue({
        precios: [{ desde: 10, hasta: 40, n: 6 }],
        amenities: [{ valor: 'Piscina', n: 87 }],
        valoracion: [{ minimo: 4, n: 12 }],
      });

      await component.cargarFacetas('Madrid');

      expect(alojamientoService.facetas).toHaveBeenCalledWith('Madrid', undefined);
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
