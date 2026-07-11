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
});
