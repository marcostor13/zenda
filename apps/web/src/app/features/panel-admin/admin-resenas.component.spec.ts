import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { AdminResenasComponent } from './admin-resenas.component';

const resena = (extra: Record<string, unknown> = {}) => ({
  _id: 'r1', usuarioNombre: 'Ana', servicioTitulo: 'Royal Dog Resort', vertical: 'alojamiento',
  puntuacion: 5, comentario: 'Genial', eliminada: false,
  createdAt: '2026-07-01T00:00:00.000Z', reservaId: 'res1', comercioId: 'c1', ...extra,
});

describe('AdminResenasComponent', () => {
  let fixture: ComponentFixture<AdminResenasComponent>;
  let componente: AdminResenasComponent;
  let httpMock: HttpTestingController;

  const crear = async (items: unknown[] = [resena()], total = 1): Promise<void> => {
    await TestBed.configureTestingModule({
      imports: [AdminResenasComponent],
      providers: [provideHttpClient(), provideHttpClientTesting()],
    }).compileComponents();

    httpMock = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(AdminResenasComponent);
    componente = fixture.componentInstance;
    fixture.detectChanges();

    httpMock.expectOne((r) => r.url.includes('/reviews/admin')).flush({ items, total });
    await fixture.whenStable();
    fixture.detectChanges();
  };

  afterEach(() => {
    fixture?.destroy();
    httpMock.verify();
  });

  it('debería cargar las reseñas al iniciar', async () => {
    await crear();

    expect(componente.resenas()).toHaveLength(1);
    expect(componente.total()).toBe(1);
    expect(componente.cargando()).toBe(false);
  });

  it('debería pedir sólo las ocultas al filtrar por visibilidad', async () => {
    await crear();

    const promesa = componente.cambiarVisibilidad('true');
    const req = httpMock.expectOne((r) => r.url.includes('/reviews/admin'));

    expect(req.request.params.get('ocultas')).toBe('true');
    req.flush({ items: [], total: 0 });
    await promesa;
  });

  it('debería volver a la primera página al buscar', async () => {
    await crear();
    componente.pagina.set(3);

    const promesa = componente.aplicarBusqueda('  ana  ');
    const req = httpMock.expectOne((r) => r.url.includes('/reviews/admin'));

    expect(req.request.params.get('buscar')).toBe('ana');
    expect(req.request.params.get('page')).toBe('1');
    req.flush({ items: [], total: 0 });
    await promesa;
  });

  it('debería ocultar una reseña sin borrarla de la lista', async () => {
    await crear();

    const promesa = componente.alternarVisibilidad(resena() as never);
    const req = httpMock.expectOne((r) => r.url.includes('/reviews/r1/visibilidad'));

    expect(req.request.body).toEqual({ oculta: true });
    req.flush({});
    await promesa;

    expect(componente.resenas()[0].eliminada).toBe(true);
    expect(componente.resenas()).toHaveLength(1);
  });

  it('debería avisar si no se puede cambiar la visibilidad', async () => {
    await crear();

    const promesa = componente.alternarVisibilidad(resena() as never);
    httpMock.expectOne((r) => r.url.includes('/visibilidad'))
      .flush(null, { status: 500, statusText: 'Error' });
    await promesa;

    expect(componente.errorMsg()).toContain('No se pudo cambiar la visibilidad');
  });
});
