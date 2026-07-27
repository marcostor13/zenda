import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { VerticalKey } from 'shared';
import { CarritoApi, CarritoService, ItemCarritoApi } from './carrito.service';

const item = (extra: Partial<ItemCarritoApi> = {}): ItemCarritoApi => ({
  itemId: 'i1', servicioId: 's1', comercioId: 'c1', vertical: VerticalKey.ALOJAMIENTO,
  titulo: 'Residencia Royal', fechaInicio: '2026-09-01', cantidad: 1,
  perroIds: [], precioEstimado: 200, esReservaMadre: true, ...extra,
});

const carrito = (items: ItemCarritoApi[]): CarritoApi => ({
  _id: 'car-1', estado: 'abierto', items, reservaIds: [],
});

describe('CarritoService', () => {
  let service: CarritoService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(CarritoService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  it('debería empezar vacío, sin viaje en curso', () => {
    expect(service.numItems()).toBe(0);
    expect(service.totalEstimado()).toBe(0);
  });

  it('debería sumar el total estimado de todos los servicios', async () => {
    const promesa = service.cargar();

    httpMock.expectOne((r) => r.url.includes('/carrito'))
      .flush(carrito([item(), item({ itemId: 'i2', precioEstimado: 45.5 })]));
    await promesa;

    expect(service.numItems()).toBe(2);
    expect(service.totalEstimado()).toBe(245.5);
  });

  it('no debería tratar como error la falta de sesión al cargar', async () => {
    const promesa = service.cargar();

    httpMock.expectOne((r) => r.url.includes('/carrito'))
      .flush({ message: 'No autorizado' }, { status: 401, statusText: 'Unauthorized' });

    await expect(promesa).resolves.toBeNull();
    expect(service.numItems()).toBe(0);
  });

  it('debería refrescar el viaje al quitar un servicio', async () => {
    const promesa = service.quitar('i1');

    const req = httpMock.expectOne((r) => r.url.includes('/carrito/items/i1'));
    expect(req.request.method).toBe('DELETE');
    req.flush(carrito([]));
    await promesa;

    expect(service.numItems()).toBe(0);
  });

  it('debería pedir la revalidación antes de cobrar', async () => {
    const promesa = service.validar();

    const req = httpMock.expectOne((r) => r.url.includes('/carrito/validar'));
    expect(req.request.method).toBe('POST');
    req.flush({ todoDisponible: false, items: [{ itemId: 'i1', titulo: 'X', disponible: false }] });

    await expect(promesa).resolves.toMatchObject({ todoDisponible: false });
  });

  it('debería devolver el pago único del viaje en el checkout', async () => {
    const promesa = service.checkout();

    httpMock.expectOne((r) => r.url.includes('/carrito/checkout'))
      .flush({ clientSecret: 'cs_1', pagoId: 'p1', montoTotal: 245.5, moneda: 'EUR' });

    await expect(promesa).resolves.toMatchObject({ clientSecret: 'cs_1', montoTotal: 245.5 });
  });
});
