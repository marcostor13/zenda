import { ComponentFixture, TestBed } from '@angular/core/testing';
import { HttpClientTestingModule } from '@angular/common/http/testing';
import { RouterTestingModule } from '@angular/router/testing';
import { ActivatedRoute, Params, convertToParamMap } from '@angular/router';
import { of } from 'rxjs';
import type { CardAmenity } from '../../../shared/components/card/rs-card.component';
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

  it('debería exponer el total de resultados para el recuento común', async () => {
    fixture.detectChanges();
    await fixture.whenStable();

    expect(component.totalItems()).toBe(1);
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

    // Sobre textContent y no sobre innerHTML: el espacio duro del importe se
    // serializa como &nbsp; y la comparación literal fallaría.
    const html: string = fixture.nativeElement.innerHTML;
    expect(fixture.nativeElement.textContent).toContain('45'+String.fromCharCode(160)+'€');
    expect(html).toContain('noche desde');
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
        {
          id: 'a1', titulo: 'Royal Paws Retreat', precio: 24, lat: 40.4, lng: -3.7, rating: 4.8,
          imagen: 'img.jpg', imagenes: ['img.jpg', 'patio.jpg'], totalResenas: 12,
          ciudad: 'Madrid', slug: 'royal-paws-retreat',
        },
      ]);

      await component.cargarPuntosMapa({});

      expect(component.puntosMapa()).toEqual([
        {
          id: 'a1', lat: 40.4, lng: -3.7, etiqueta: '24 €', vertical: 'alojamiento',
          titulo: 'Royal Paws Retreat', imagen: 'img.jpg', rating: 4.8,
          // Lo que necesita la ficha del mapa: fotos, sitio, reseñas y enlace.
          subtitulo: 'Madrid', imagenes: ['img.jpg', 'patio.jpg'], totalResenas: 12,
          enlace: ['/alojamiento', 'royal-paws-retreat'],
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
  /**
   * En la pagina de resultados el buscador se ve siempre. Antes, en movil, los
   * campos se plegaban tras una pastilla que habia que tocar para buscar otra
   * cosa.
   */
  describe('buscador de la pagina de resultados', () => {
    it('deberia mostrar los campos sin tener que desplegar nada', async () => {
      fixture.detectChanges();
      await fixture.whenStable();
      fixture.detectChanges();

      const el: HTMLElement = fixture.nativeElement;
      expect(el.querySelector('.ls__buscador-campos')).not.toBeNull();
    });

    it('no deberia quedar ni rastro del plegado', async () => {
      fixture.detectChanges();
      await fixture.whenStable();
      fixture.detectChanges();

      const el: HTMLElement = fixture.nativeElement;
      expect(el.querySelector('.ls__buscador-pill')).toBeNull();
      expect(el.querySelector('.ls__buscador.is-plegado')).toBeNull();
    });

    it('deberia destacar en dorado el criterio de orden', async () => {
      // Es con lo que se esta mirando la lista: los bocetos lo pintan con la
      // estrella rellena y borde dorado, y los otros dos controles en gris.
      fixture.detectChanges();
      await fixture.whenStable();
      fixture.detectChanges();

      const el: HTMLElement = fixture.nativeElement;
      const orden = el.querySelector('.ls__orden');
      expect(orden?.querySelector('.ls__orden-estrella')).not.toBeNull();
      expect(orden?.querySelector('select')).not.toBeNull();
    });

    it('deberia encabezar los resultados con el reclamo y su ilustracion', async () => {
      fixture.detectChanges();
      await fixture.whenStable();
      fixture.detectChanges();

      const el: HTMLElement = fixture.nativeElement;
      expect(el.querySelector('.ls__reclamo-txt h1')?.textContent?.trim())
        .toBe('Un lugar seguro mientras tú no estás');
      expect(el.querySelector('.ls__reclamo-art img')).not.toBeNull();
    });
  });

  describe('detalles de la tarjeta', () => {
    it('debería añadir el badge de descuento cuando lo hay', () => {
      const badges = component.badgesDe({ ...cardMock, destacado: false, descuentoPct: 20 });
      expect(badges.map((b) => b.label)).toContain('-20%');
      expect(badges.map((b) => b.label)).not.toContain('Premium');
    });

    it('debería describir el alojamiento con las plazas libres si no tiene amenities', () => {
      const etiqueta = (s: CardAmenity): string => (typeof s === 'string' ? s : s.label);
      expect(component.serviciosDe({ ...cardMock, amenities: [], espaciosDisponibles: 1 })
        .map(etiqueta)).toEqual(['1 plaza libre', 'Estancia con pernocta']);
      expect(component.serviciosDe({ ...cardMock, amenities: [], espaciosDisponibles: 3 })
        .map(etiqueta)).toEqual(['3 plazas libres', 'Estancia con pernocta']);
      expect(component.serviciosDe({ ...cardMock, amenities: [], espaciosDisponibles: 0 })
        .map(etiqueta)).toEqual(['Estancia con pernocta']);
    });

    it('debería listar la guardería de día y omitir lo que no incluye', () => {
      const items = component.incluyeDe({
        ...cardMock, cancelacionGratis: false, paseosIncluidos: false,
        extra: { modalidades: ['guarderia'] },
      });
      expect(items).toEqual(['Guardería de día']);
    });

    it('debería mostrar «desde» a secas en un centro que sólo hace guardería', () => {
      expect(component.periodoDe({ ...cardMock, extra: { modalidades: ['guarderia'] } })).toBe('desde');
      expect(component.periodoDe(cardMock)).toBe('noche desde');
    });

    it('debería enlazar al más cercano por slug o, si falta, por id', () => {
      expect(component.enlaceMasCercano()).toBeNull();
      const masCercano = { id: 'x1', nombre: 'Vila', ciudad: 'Vila-real', distanciaKm: 8 };
      component.cercanos.set({ ciudadBuscada: 'Castellón', radioKm: 60, masCercano });
      expect(component.enlaceMasCercano()).toEqual(['/alojamiento', 'x1']);
      component.cercanos.set({ ciudadBuscada: 'Castellón', radioKm: 60, masCercano: { ...masCercano, slug: 'vila' } });
      expect(component.enlaceMasCercano()).toEqual(['/alojamiento', 'vila']);
    });
  });

  describe('orden por distancia', () => {
    const geolocalizacionOriginal = navigator.geolocation;

    function ponerGeolocalizacion(valor: Geolocation | undefined): void {
      Object.defineProperty(navigator, 'geolocation', { value: valor, configurable: true });
    }

    afterEach(() => ponerGeolocalizacion(geolocalizacionOriginal));

    it('debería limpiar el aviso al ordenar por otro criterio', async () => {
      component.avisoUbicacion.set('algo');
      await component.cambiarOrden('precio_asc');
      expect(component.avisoUbicacion()).toBe('');
      expect(component.ordenamiento()).toBe('precio_asc');
    });

    it('debería avisar si el navegador no comparte la ubicación', async () => {
      ponerGeolocalizacion(undefined);
      await component.cambiarOrden('distancia');
      expect(component.avisoUbicacion()).toContain('no comparte la ubicación');
    });

    it('debería ordenar desde la ubicación del dispositivo y reutilizarla después', async () => {
      const posicion = { coords: { latitude: 40.4, longitude: -3.7 } } as GeolocationPosition;
      const geo: jest.Mocked<Pick<Geolocation, 'getCurrentPosition'>> = {
        getCurrentPosition: jest.fn((ok: PositionCallback) => ok(posicion)),
      };
      ponerGeolocalizacion(geo as unknown as Geolocation);

      await component.cambiarOrden('distancia');
      expect(component.avisoUbicacion()).toBe('Ordenado desde tu ubicación actual.');
      expect(alojamientoService.buscar).toHaveBeenLastCalledWith(
        expect.objectContaining({ orden: 'distancia', lat: 40.4, lng: -3.7 }),
      );

      // Con coordenadas del dispositivo no se vuelve a pedir permiso ni se cambia el aviso.
      component.avisoUbicacion.set('');
      await component.cambiarOrden('distancia');
      expect(geo.getCurrentPosition).toHaveBeenCalledTimes(1);
      expect(component.avisoUbicacion()).toBe('');
    });

    it('debería avisar si el usuario deniega la ubicación', async () => {
      const geo: jest.Mocked<Pick<Geolocation, 'getCurrentPosition'>> = {
        getCurrentPosition: jest.fn((_ok: PositionCallback, ko?: PositionErrorCallback | null) =>
          ko?.({ code: 1 } as GeolocationPositionError)),
      };
      ponerGeolocalizacion(geo as unknown as Geolocation);

      await component.cambiarOrden('distancia');
      expect(component.avisoUbicacion()).toContain('Sin acceso a tu ubicación');
    });
  });

  describe('ver más', () => {
    it('no debería pedir más cuando ya está todo cargado', async () => {
      fixture.detectChanges();
      await fixture.whenStable();
      alojamientoService.buscar.mockClear();

      await component.verMas();
      expect(alojamientoService.buscar).not.toHaveBeenCalled();
    });

    it('debería añadir la página siguiente sin repetir tarjetas', async () => {
      alojamientoService.buscar.mockResolvedValue({ ...resultadoMock, total: 3, totalPages: 2 });
      fixture.detectChanges();
      await fixture.whenStable();
      alojamientoService.buscar.mockResolvedValue({
        items: [cardMock, { ...cardMock, id: 'a2' }], total: 3, page: 2, totalPages: 2,
      });

      await component.verMas();

      expect(component.alojamientos().map((a) => a.id)).toEqual(['a1', 'a2']);
      expect(component.paginaActual()).toBe(2);
      expect(component.cargandoMas()).toBe(false);
    });

    it('debería conservar lo cargado si falla la ampliación', async () => {
      alojamientoService.buscar.mockResolvedValue({ ...resultadoMock, total: 3, totalPages: 2 });
      fixture.detectChanges();
      await fixture.whenStable();
      alojamientoService.buscar.mockImplementation(() => Promise.reject(new Error('offline')));

      await component.verMas();

      expect(component.alojamientos()).toEqual([cardMock]);
      expect(component.paginaActual()).toBe(1);
    });
  });
});

describe('AlojamientoListaComponent con búsqueda en la URL', () => {
  let alojamientoService: jest.Mocked<Pick<AlojamientoService, 'buscar' | 'facetas' | 'puntosMapa'>>;

  async function crear(params: Params): Promise<AlojamientoListaComponent> {
    alojamientoService = {
      buscar: jest.fn().mockResolvedValue({ items: [], total: 0, page: 1, totalPages: 1 }),
      facetas: jest.fn().mockResolvedValue({ precios: [], amenities: [], valoracion: [] }),
      puntosMapa: jest.fn().mockResolvedValue([]),
    };
    await TestBed.configureTestingModule({
      imports: [AlojamientoListaComponent, RouterTestingModule, HttpClientTestingModule],
      providers: [
        { provide: AlojamientoService, useValue: alojamientoService },
        {
          provide: ActivatedRoute,
          useValue: {
            queryParams: of(params),
            queryParamMap: of(convertToParamMap(params)),
            snapshot: { queryParams: params, queryParamMap: convertToParamMap(params), paramMap: convertToParamMap({}) },
          },
        },
      ],
    }).compileComponents();
    const fixture = TestBed.createComponent(AlojamientoListaComponent);
    fixture.componentInstance.ngOnInit();
    await fixture.whenStable();
    return fixture.componentInstance;
  }

  it('debería buscar con la ciudad, fechas, perro y coordenadas de la URL', async () => {
    const component = await crear({
      ciudad: 'Madrid', desde: '2026-10-10', hasta: '2026-10-12', perros: '2',
      perroIds: 'p1,p2', lat: '40.4', lng: '-3.7',
    });

    expect(alojamientoService.buscar).toHaveBeenCalledWith(expect.objectContaining({
      ciudad: 'Madrid', desde: '2026-10-10', perroId: 'p1',
    }));
    expect(component.sufijoCiudad()).toBe(' en Madrid');
    expect(component.queryParamsDetalle()).toEqual({
      desde: '2026-10-10', hasta: '2026-10-12', perros: '2', perroId: 'p1',
    });

    // Las coordenadas de la población evitan pedir permiso al navegador.
    await component.cambiarOrden('distancia');
    expect(component.avisoUbicacion()).toBe('Ordenado desde la población que buscaste.');
    expect(alojamientoService.buscar).toHaveBeenLastCalledWith(
      expect.objectContaining({ lat: 40.4, lng: -3.7 }),
    );
  });

  it('no debería propagar nada al detalle sin búsqueda', async () => {
    const component = await crear({});
    expect(component.sufijoCiudad()).toBe('');
    expect(component.queryParamsDetalle()).toEqual({});
    expect(component.perroId()).toBe('');
  });
});
