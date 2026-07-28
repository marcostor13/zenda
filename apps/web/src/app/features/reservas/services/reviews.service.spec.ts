import { TestBed } from '@angular/core/testing';
import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { ReviewsService, ResenaApi } from './reviews.service';
import { environment } from '../../../../environments/environment';

describe('ReviewsService', () => {
  let service: ReviewsService;
  let httpMock: HttpTestingController;

  const resenaMock: ResenaApi = {
    _id: 'r1',
    reservaId: 'res-1',
    servicioTitulo: 'Suite Canina Madrid',
    vertical: 'alojamiento',
    puntuacion: 5,
    comentario: 'Genial',
    createdAt: '2026-07-01T00:00:00.000Z',
  };

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
      providers: [ReviewsService],
    });
    service = TestBed.inject(ReviewsService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  it('debería crear una reseña con POST /reviews', async () => {
    const promesa = service.crear({ reservaId: 'res-1', puntuacion: 5, comentario: 'Genial' });

    const req = httpMock.expectOne(`${environment.apiUrl}/reviews`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ reservaId: 'res-1', puntuacion: 5, comentario: 'Genial' });
    req.flush(resenaMock);

    expect(await promesa).toEqual(resenaMock);
  });

  it('debería listar mis reseñas con GET /reviews?usuarioId=...', async () => {
    const promesa = service.misResenas('user-1');

    const req = httpMock.expectOne(`${environment.apiUrl}/reviews?usuarioId=user-1`);
    expect(req.request.method).toBe('GET');
    req.flush([resenaMock]);

    expect(await promesa).toEqual([resenaMock]);
  });

  it('debería editar una reseña con PATCH /reviews/:id', async () => {
    const promesa = service.actualizar('r1', { puntuacion: 4 });

    const req = httpMock.expectOne(`${environment.apiUrl}/reviews/r1`);
    expect(req.request.method).toBe('PATCH');
    expect(req.request.body).toEqual({ puntuacion: 4 });
    req.flush({ ...resenaMock, puntuacion: 4 });

    expect((await promesa).puntuacion).toBe(4);
  });

  it('debería eliminar una reseña con DELETE /reviews/:id', async () => {
    const promesa = service.eliminar('r1');

    const req = httpMock.expectOne(`${environment.apiUrl}/reviews/r1`);
    expect(req.request.method).toBe('DELETE');
    req.flush(null);

    await promesa;
  });

  it('debería listar las reservas pendientes de valorar con GET /reviews/pendientes', async () => {
    const pendiente = { reservaId: 'res-2', servicioId: 's1', servicioTitulo: 'Hotel', vertical: 'alojamiento', imagen: null, fechaInicio: '2026-01-01T00:00:00.000Z' };
    const promesa = service.pendientesDeValorar();

    const req = httpMock.expectOne(`${environment.apiUrl}/reviews/pendientes`);
    expect(req.request.method).toBe('GET');
    req.flush([pendiente]);

    expect(await promesa).toEqual([pendiente]);
  });
});
