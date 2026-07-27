import { ComponentFixture, TestBed } from '@angular/core/testing';
import { HttpClient, provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { RouterTestingModule } from '@angular/router/testing';
import { AdminCampanasComponent } from './admin-campanas.component';

const campana = (extra: Record<string, unknown> = {}) => ({
  _id: 'k1', nombre: 'Vuelta al cole', descripcion: '',
  desde: '2026-09-01T00:00:00.000Z', hasta: '2026-09-30T00:00:00.000Z',
  activa: true, ...extra,
});

const metrica = (extra: Record<string, unknown> = {}) => ({
  campanaId: 'k1', nombre: 'Vuelta al cole', usos: 10,
  costePlataforma: 100.005, costeComercios: 50.004, ...extra,
});

describe('AdminCampanasComponent', () => {
  let fixture: ComponentFixture<AdminCampanasComponent>;
  let componente: AdminCampanasComponent;
  let httpMock: HttpTestingController;

  /** Resuelve las dos peticiones de arranque (campañas y métricas). */
  const responderCarga = (campanas: unknown[], metricas: unknown[]) => {
    httpMock.expectOne((r) => r.url.endsWith('/campanas') && r.method === 'GET').flush(campanas);
    httpMock.expectOne((r) => r.url.endsWith('/campanas/metricas')).flush(metricas);
  };

  const crear = async (campanas: unknown[] = [campana()], metricas: unknown[] = [metrica()]): Promise<void> => {
    await TestBed.configureTestingModule({
      imports: [AdminCampanasComponent, RouterTestingModule],
      providers: [provideHttpClient(), provideHttpClientTesting()],
    }).compileComponents();

    httpMock = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(AdminCampanasComponent);
    componente = fixture.componentInstance;
    fixture.detectChanges();

    responderCarga(campanas, metricas);
    await fixture.whenStable();
    fixture.detectChanges();
  };

  afterEach(() => {
    fixture?.destroy();
    httpMock.verify();
  });

  describe('carga', () => {
    it('debería traer campañas y métricas a la vez', async () => {
      await crear();

      expect(componente.campanas()).toHaveLength(1);
      expect(componente.metricas()).toHaveLength(1);
      expect(componente.cargando()).toBe(false);
    });

    it('debería avisar si la carga falla', async () => {
      // El fallo se simula en el propio HttpClient: una respuesta de error
      // flusheada deja un rechazo que zone.js reporta luego como error global.
      await TestBed.configureTestingModule({
        imports: [AdminCampanasComponent, RouterTestingModule],
        providers: [
          provideHttpClient(), provideHttpClientTesting(),
          { provide: HttpClient, useValue: { get: jest.fn(() => { throw new Error('500'); }) } },
        ],
      }).compileComponents();

      httpMock = TestBed.inject(HttpTestingController);
      fixture = TestBed.createComponent(AdminCampanasComponent);
      componente = fixture.componentInstance;
      fixture.detectChanges();
      await fixture.whenStable();

      expect(componente.error()).toContain('No se pudieron cargar');
      expect(componente.cargando()).toBe(false);
    });
  });

  describe('totales', () => {
    it('debería sumar el coste asumido por cada parte', async () => {
      await crear([campana()], [metrica(), metrica({ campanaId: 'k2', costePlataforma: 10, costeComercios: 5, usos: 2 })]);

      // Los importes se redondean a céntimos: sumar en crudo arrastra decimales.
      expect(componente.totalPlataforma()).toBe(110.01);
      expect(componente.totalComercios()).toBe(55);
      expect(componente.totalUsos()).toBe(12);
    });

    it('debería mostrar ceros sin campañas activas', async () => {
      await crear([], []);

      expect(componente.totalPlataforma()).toBe(0);
      expect(componente.totalUsos()).toBe(0);
    });
  });

  describe('vigencia', () => {
    it('debería mostrar el rango de fechas de la campaña', async () => {
      await crear();

      expect(componente.vigenciaDe('k1')).toContain('–');
    });

    it('debería devolver vacío para una campaña desconocida', async () => {
      await crear();

      expect(componente.vigenciaDe('inexistente')).toBe('');
    });
  });

  describe('alta de campaña', () => {
    it('debería exigir nombre y vigencia', async () => {
      await crear();
      componente.nombre = '   ';

      await componente.crear();

      expect(componente.error()).toContain('obligatorios');
    });

    it('debería crear la campaña y recargar', async () => {
      await crear();
      componente.nombre = '  Navidad ';
      componente.descripcion = ' Promo ';
      componente.desde = '2026-12-01';
      componente.hasta = '2026-12-31';

      const promesa = componente.crear();
      const req = httpMock.expectOne((r) => r.url.endsWith('/campanas') && r.method === 'POST');
      expect(req.request.body).toEqual({
        nombre: 'Navidad', descripcion: 'Promo', desde: '2026-12-01', hasta: '2026-12-31',
      });
      req.flush({ _id: 'k2' });
      await fixture.whenStable();
      responderCarga([campana()], [metrica()]);
      await promesa;

      expect(componente.nombre).toBe('');
      expect(componente.formularioAbierto()).toBe(false);
    });

    it('debería mostrar el motivo que devuelve el servidor', async () => {
      await crear();
      componente.nombre = 'Navidad';
      componente.desde = '2026-12-01';
      componente.hasta = '2026-11-01';

      const promesa = componente.crear();
      httpMock.expectOne((r) => r.method === 'POST')
        .flush({ message: 'La fecha de fin es anterior al inicio' }, { status: 400, statusText: 'Bad Request' });
      await promesa;

      expect(componente.error()).toBe('La fecha de fin es anterior al inicio');
      expect(componente.guardando()).toBe(false);
    });

    it('debería abrir y cerrar el formulario', async () => {
      await crear();

      componente.alternarFormulario();
      expect(componente.formularioAbierto()).toBe(true);

      componente.alternarFormulario();
      expect(componente.formularioAbierto()).toBe(false);
    });
  });

  describe('activar y desactivar', () => {
    it('debería invertir el estado conservando el resto de la campaña', async () => {
      await crear();

      const promesa = componente.alternarActiva(metrica() as never);
      const req = httpMock.expectOne((r) => r.method === 'PATCH');
      expect(req.request.body).toMatchObject({ nombre: 'Vuelta al cole', activa: false });
      req.flush({});
      await fixture.whenStable();
      responderCarga([campana({ activa: false })], [metrica()]);
      await promesa;

      expect(componente.campanas()[0].activa).toBe(false);
    });

    it('no debería tocar nada si la métrica no tiene campaña', async () => {
      await crear();

      await componente.alternarActiva(metrica({ campanaId: 'inexistente' }) as never);

      expect(componente.guardando()).toBe(false);
    });

    it('debería avisar si el cambio falla', async () => {
      await crear();

      const promesa = componente.alternarActiva(metrica() as never);
      httpMock.expectOne((r) => r.method === 'PATCH')
        .flush({ message: 'error' }, { status: 500, statusText: 'Server Error' });
      await promesa;

      expect(componente.error()).toContain('No se pudo actualizar');
      expect(componente.guardando()).toBe(false);
    });
  });
});
