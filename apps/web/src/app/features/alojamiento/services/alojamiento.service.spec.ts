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

    it('debería enviar las cuatro esquinas del mapa como params', async () => {
      const promesa = service.buscar({
        zona: { swLat: 40.3, swLng: -3.8, neLat: 40.5, neLng: -3.6 },
      });

      const req = httpMock.expectOne((r) => r.url.includes('/catalog/servicios'));
      expect(req.request.params.get('swLat')).toBe('40.3');
      expect(req.request.params.get('swLng')).toBe('-3.8');
      expect(req.request.params.get('neLat')).toBe('40.5');
      expect(req.request.params.get('neLng')).toBe('-3.6');
      req.flush(resultadoMock);

      await promesa;
    });
  });

  describe('buscar con todos los filtros', () => {
    it('debería enviar fechas, perro, orden, coordenadas y filtros del panel', async () => {
      const promesa = service.buscar({
        desde: '2026-10-10',
        hasta: '2026-10-12',
        perroId: 'p1',
        orden: 'precio_asc',
        lat: 0,
        lng: -3.7,
        ratingMin: 4,
        amenities: ['jardin', 'piscina'],
        filtrosVertical: { tipoEspacio: ['suite', 'estandar'], camaras24h: true },
      });

      const req = httpMock.expectOne((r) => r.url.includes('/catalog/servicios'));
      const p = req.request.params;
      expect(p.get('desde')).toBe('2026-10-10');
      expect(p.get('hasta')).toBe('2026-10-12');
      expect(p.get('perroId')).toBe('p1');
      expect(p.get('orden')).toBe('precio_asc');
      expect(p.get('lat')).toBe('0');
      expect(p.get('lng')).toBe('-3.7');
      expect(p.get('ratingMin')).toBe('4');
      expect(p.get('amenities')).toBe('jardin,piscina');
      expect(p.get('tipoEspacio')).toBe('suite,estandar');
      expect(p.get('camaras24h')).toBe('true');
      req.flush({ total: 0, page: 1, totalPages: 0 });

      const resultado = await promesa;
      expect(resultado.items).toEqual([]);
    });
  });

  describe('facetas', () => {
    it('debería pedir las facetas de la ciudad y la zona', async () => {
      const promesa = service.facetas('Madrid', { swLat: 1, swLng: 2, neLat: 3, neLng: 4 });

      const req = httpMock.expectOne((r) => r.url.endsWith('/catalog/servicios/facetas'));
      expect(req.request.params.get('ciudad')).toBe('Madrid');
      expect(req.request.params.get('swLat')).toBe('1');
      req.flush({});

      await promesa;
    });

    it('no debería enviar ciudad cuando no se indica', async () => {
      const promesa = service.facetas();

      const req = httpMock.expectOne((r) => r.url.endsWith('/catalog/servicios/facetas'));
      expect(req.request.params.get('ciudad')).toBeNull();
      expect(req.request.params.get('swLat')).toBeNull();
      req.flush({});

      await promesa;
    });
  });

  describe('puntosMapa', () => {
    it('debería enviar el precio máximo y el perro elegido', async () => {
      const promesa = service.puntosMapa({ precioMax: 90, perroId: 'p9' });

      const req = httpMock.expectOne((r) => r.url.endsWith('/catalog/servicios/mapa'));
      expect(req.request.params.get('precioMax')).toBe('90');
      expect(req.request.params.get('perroId')).toBe('p9');
      req.flush([]);

      await promesa;
    });

    it('debería pedir los pines al endpoint de mapa acotados a la zona', async () => {
      const promesa = service.puntosMapa({
        precioMin: 20,
        zona: { swLat: 40.3, swLng: -3.8, neLat: 40.5, neLng: -3.6 },
      });

      const req = httpMock.expectOne((r) => r.url.endsWith('/catalog/servicios/mapa'));
      expect(req.request.params.get('vertical')).toBe('alojamiento');
      expect(req.request.params.get('precioMin')).toBe('20');
      expect(req.request.params.get('neLng')).toBe('-3.6');
      req.flush([{ id: 'a1', titulo: 'Las Rozas', precio: 24, lat: 40.4, lng: -3.7, rating: 4.8 }]);

      expect(await promesa).toHaveLength(1);
    });

    it('no debería enviar esquinas sueltas cuando no hay zona', async () => {
      const promesa = service.puntosMapa({ ciudad: 'Madrid' });

      const req = httpMock.expectOne((r) => r.url.endsWith('/catalog/servicios/mapa'));
      expect(req.request.params.get('swLat')).toBeNull();
      expect(req.request.params.get('ciudad')).toBe('Madrid');
      req.flush([]);

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
