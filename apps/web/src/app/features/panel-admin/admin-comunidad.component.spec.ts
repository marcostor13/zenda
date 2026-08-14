import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { RouterTestingModule } from '@angular/router/testing';
import { EstadoModeracion, TipoLugar } from 'shared';
import { AdminComunidadComponent } from './admin-comunidad.component';

const lugar = (extra: Record<string, unknown> = {}) => ({
  _id: 'l1', nombre: 'Playa canina', tipo: TipoLugar.PLAYA,
  ubicacion: { ciudad: 'Valencia', provincia: 'Valencia' },
  descripcion: 'Arena y sombra', fotos: [],
  createdAt: '2026-07-01T00:00:00.000Z', ...extra,
});

const review = (extra: Record<string, unknown> = {}) => ({
  _id: 'rev1', lugarId: 'l1', usuarioNombre: 'Ana', puntuacion: 5,
  texto: 'Muy limpia', fotos: [], esIncidencia: false,
  createdAt: '2026-07-01T00:00:00.000Z', ...extra,
});

describe('AdminComunidadComponent', () => {
  let fixture: ComponentFixture<AdminComunidadComponent>;
  let componente: AdminComunidadComponent;
  let httpMock: HttpTestingController;

  const crear = async (
    pendientes: { lugares: unknown[]; reviews: unknown[] } = { lugares: [lugar()], reviews: [review()] },
    estado?: number,
  ): Promise<void> => {
    await TestBed.configureTestingModule({
      imports: [AdminComunidadComponent, RouterTestingModule],
      providers: [provideHttpClient(), provideHttpClientTesting()],
    }).compileComponents();

    httpMock = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(AdminComunidadComponent);
    componente = fixture.componentInstance;
    fixture.detectChanges();

    const req = httpMock.expectOne((r) => r.url.includes('/lugares/moderacion/pendientes'));
    if (estado) req.flush(null, { status: estado, statusText: 'Error' });
    else req.flush(pendientes);

    await fixture.whenStable();

    // Tras la cola llegan los contadores de las pestañas (TCK-8039).
    if (!estado) {
      const resumen = httpMock.expectOne((r) => r.url.includes('/lugares/moderacion/resumen'));
      resumen.flush({ pendiente: 2, publicado: 0, rechazado: 0 });
      await fixture.whenStable();
    }
    fixture.detectChanges();
  };

  afterEach(() => {
    fixture?.destroy();
    httpMock.verify();
  });

  describe('cola de moderación', () => {
    it('debería cargar lugares y aportaciones pendientes', async () => {
      await crear();

      expect(componente.lugares()).toHaveLength(1);
      expect(componente.reviews()).toHaveLength(1);
      expect(componente.totalPendiente()).toBe(2);
      expect(componente.cargando()).toBe(false);
    });

    it('debería avisar si la cola no carga', async () => {
      await crear(undefined, 500);

      expect(componente.error()).toContain('No se pudo cargar la cola');
      expect(componente.cargando()).toBe(false);
    });

    it('debería mostrar cero pendientes con la cola vacía', async () => {
      await crear({ lugares: [], reviews: [] });

      expect(componente.totalPendiente()).toBe(0);
    });
  });

  describe('moderación de lugares', () => {
    it('debería publicar el lugar y sacarlo de la cola', async () => {
      await crear();

      const promesa = componente.moderarLugar(lugar() as never, true);
      const req = httpMock.expectOne((r) => r.url.includes('/lugares/l1/moderar'));
      expect(req.request.method).toBe('PATCH');
      expect(req.request.body).toEqual({ estado: EstadoModeracion.PUBLICADO });
      req.flush({});
      await promesa;

      expect(componente.lugares()).toHaveLength(0);
      expect(componente.procesandoId()).toBeNull();
    });

    it('debería rechazar el lugar con el estado correspondiente', async () => {
      await crear();

      const promesa = componente.moderarLugar(lugar() as never, false);
      const req = httpMock.expectOne((r) => r.url.includes('/lugares/l1/moderar'));
      expect(req.request.body).toEqual({ estado: EstadoModeracion.RECHAZADO });
      req.flush({});
      await promesa;

      expect(componente.lugares()).toHaveLength(0);
    });

    it('debería nombrar el lugar que no se pudo moderar', async () => {
      await crear();

      const promesa = componente.moderarLugar(lugar() as never, true);
      httpMock.expectOne((r) => r.url.includes('/lugares/l1/moderar'))
        .flush(null, { status: 500, statusText: 'Server Error' });
      await promesa;

      expect(componente.error()).toContain('Playa canina');
      // Si falla, el lugar sigue pendiente: no puede desaparecer sin moderar.
      expect(componente.lugares()).toHaveLength(1);
    });
  });

  describe('moderación de aportaciones', () => {
    it('debería publicar la aportación y sacarla de la cola', async () => {
      await crear();

      const promesa = componente.moderarReview(review() as never, true);
      const req = httpMock.expectOne((r) => r.url.includes('/lugares/reviews/rev1/moderar'));
      expect(req.request.body).toEqual({ estado: EstadoModeracion.PUBLICADO });
      req.flush({});
      await promesa;

      expect(componente.reviews()).toHaveLength(0);
    });

    it('debería avisar si la aportación no se puede moderar', async () => {
      await crear();

      const promesa = componente.moderarReview(review() as never, false);
      httpMock.expectOne((r) => r.url.includes('/lugares/reviews/rev1/moderar'))
        .flush(null, { status: 500, statusText: 'Server Error' });
      await promesa;

      expect(componente.error()).toContain('No se pudo moderar la aportación');
      expect(componente.reviews()).toHaveLength(1);
    });
  });

  describe('etiquetas', () => {
    it('debería traducir el tipo de lugar', async () => {
      await crear();

      expect(componente.etiquetaTipo(TipoLugar.PLAYA)).toBeTruthy();
    });
  });
});
