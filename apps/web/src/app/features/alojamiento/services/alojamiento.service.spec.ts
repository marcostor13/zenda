import { TestBed } from '@angular/core/testing';
import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { AlojamientoService, PaginatedResult, AlojamientoCard } from './alojamiento.service';

describe('AlojamientoService', () => {
  let service: AlojamientoService;
  let httpMock: HttpTestingController;

  const resultadoMock: PaginatedResult<AlojamientoCard> = {
    items: [
      {
        id: 'a1',
        nombre: 'Royal Paws Retreat',
        ciudad: 'Madrid',
        barrio: 'Pozuelo',
        direccion: 'Camino de la Dehesa 12',
        score: 5.0,
        scoreLabel: 'Excepcional',
        numResenas: 128,
        precioPorNoche: 45,
        imagenes: [],
        amenities: [],
        cancelacionGratis: true,
        paseosIncluidos: true,
        espaciosDisponibles: 4,
        destacado: true,
      },
    ],
    total: 1,
    page: 1,
    totalPages: 1,
  };

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
      providers: [AlojamientoService],
    });

    service = TestBed.inject(AlojamientoService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  describe('buscar', () => {
    it('debería consultar el catálogo con vertical=alojamiento', async () => {
      const promesa = service.buscar({ ciudad: 'Madrid' });

      const req = httpMock.expectOne(
        (r) => r.url.includes('/catalog/servicios') && r.params.get('vertical') === 'alojamiento',
      );
      expect(req.request.params.get('ciudad')).toBe('Madrid');
      req.flush(resultadoMock);

      const resultado = await promesa;
      expect(resultado.items).toHaveLength(1);
      expect(resultado.items[0].nombre).toBe('Royal Paws Retreat');
    });

    it('debería enviar los filtros de precio y paginación como params', async () => {
      const promesa = service.buscar({ precioMin: 20, precioMax: 80, page: 2, limit: 10 });

      const req = httpMock.expectOne((r) => r.url.includes('/catalog/servicios'));
      expect(req.request.params.get('precioMin')).toBe('20');
      expect(req.request.params.get('precioMax')).toBe('80');
      expect(req.request.params.get('page')).toBe('2');
      expect(req.request.params.get('limit')).toBe('10');
      req.flush(resultadoMock);

      await promesa;
    });
  });

  describe('obtener', () => {
    it('debería pedir el detalle por id', async () => {
      const detalleMock = {
        ...resultadoMock.items[0],
        descripcion: 'Alojamiento canino de lujo',
        politicaCancelacion: 'Gratis hasta 24h antes',
        checkIn: '10:00',
        checkOut: '19:00',
        requisitoVacunas: true,
        camaras24h: true,
        espacios: [],
        resenas: [],
        scoreDesglose: { limpieza: 5, ubicacion: 5, cuidado: 5, valorPrecio: 5, instalaciones: 5, personal: 5 },
        reglas: [],
        comercioId: 'c1',
      };
      const promesa = service.obtener('a1');

      const req = httpMock.expectOne((r) => r.url.endsWith('/catalog/servicios/a1'));
      req.flush(detalleMock);

      const detalle = await promesa;
      expect(detalle.requisitoVacunas).toBe(true);
      expect(detalle.camaras24h).toBe(true);
    });

    it('debería rellenar arrays ausentes para que la plantilla no rompa con datos parciales', async () => {
      // El API devuelve un servicio mínimo (sin imagenes/amenities/espacios).
      const parcial = {
        id: 'a2',
        nombre: 'Nuevo alojamiento',
        ciudad: 'Valencia',
        descripcion: 'Recién publicado',
        comercioId: 'c2',
      };
      const promesa = service.obtener('a2');
      httpMock.expectOne((r) => r.url.endsWith('/catalog/servicios/a2')).flush(parcial);

      const detalle = await promesa;
      expect(detalle.imagenes).toEqual([]);
      expect(detalle.amenities).toEqual([]);
      expect(detalle.espacios).toEqual([]);
      expect(detalle.resenas).toEqual([]);
      expect(detalle.serviciosAdicionales).toEqual([]);
    });

    it('debería normalizar los arrays anidados de cada espacio', async () => {
      const conEspacioParcial = {
        ...resultadoMock.items[0],
        espacios: [{ id: 'e1', tipo: 'suite', precioNoche: 40, cantidad: 2, disponible: true }],
      };
      const promesa = service.obtener('a3');
      httpMock.expectOne((r) => r.url.endsWith('/catalog/servicios/a3')).flush(conEspacioParcial);

      const detalle = await promesa;
      expect(detalle.espacios[0].imagenes).toEqual([]);
      expect(detalle.espacios[0].amenities).toEqual([]);
    });
  });
});
