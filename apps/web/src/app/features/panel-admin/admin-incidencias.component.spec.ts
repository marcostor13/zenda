import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { EstadoIncidencia, TipoIncidencia } from 'shared';
import { AdminIncidenciasComponent } from './admin-incidencias.component';

const incidencia = (extra: Record<string, unknown> = {}) => ({
  _id: 'i1', codigoReserva: 'RES-AAAA1111', abiertaPorNombre: 'Ana', origen: 'cliente',
  tipo: TipoIncidencia.RECLAMACION, asunto: 'El perro volvió sucio',
  descripcion: 'Recogí a Toby lleno de barro.', estado: EstadoIncidencia.ABIERTA,
  historial: [{ estado: EstadoIncidencia.ABIERTA, por: 'Ana', at: '2026-08-01T10:00:00.000Z' }],
  createdAt: '2026-08-01T10:00:00.000Z', ...extra,
});

describe('AdminIncidenciasComponent', () => {
  let fixture: ComponentFixture<AdminIncidenciasComponent>;
  let componente: AdminIncidenciasComponent;
  let httpMock: HttpTestingController;

  /**
   * Responde a la pareja listado + resumen que dispara cada carga. El resumen se
   * pide después de resolver el listado, así que hay que dejar correr el
   * microtask antes de esperarlo.
   */
  const responderCarga = async (items: unknown[] = [incidencia()], total = 1): Promise<void> => {
    httpMock.expectOne((r) => r.url.endsWith('/incidencias')).flush({ items, total });
    await fixture.whenStable();
    httpMock.expectOne((r) => r.url.endsWith('/incidencias/resumen'))
      .flush({ abierta: 1, en_revision: 0, resuelta: 0 });
    await fixture.whenStable();
  };

  /** Igual que el anterior pero para el resumen que sigue a una acción. */
  const responderResumen = async (): Promise<void> => {
    await fixture.whenStable();
    httpMock.expectOne((r) => r.url.endsWith('/incidencias/resumen')).flush({});
    await fixture.whenStable();
  };

  const crear = async (): Promise<void> => {
    await TestBed.configureTestingModule({
      imports: [AdminIncidenciasComponent],
      providers: [provideHttpClient(), provideHttpClientTesting()],
    }).compileComponents();

    httpMock = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(AdminIncidenciasComponent);
    componente = fixture.componentInstance;
    fixture.detectChanges();

    await responderCarga();
    fixture.detectChanges();
  };

  afterEach(() => {
    fixture?.destroy();
    httpMock.verify();
  });

  it('debería cargar incidencias y contadores al iniciar', async () => {
    await crear();

    expect(componente.incidencias()).toHaveLength(1);
    expect(componente.conteo(EstadoIncidencia.ABIERTA)).toBe(1);
    // "Todas" suma los tres estados.
    expect(componente.conteo('')).toBe(1);
    expect(componente.cargando()).toBe(false);
  });

  it('debería filtrar por estado volviendo a la primera página', async () => {
    await crear();
    componente.pagina.set(3);

    const promesa = componente.cambiarEstado(EstadoIncidencia.RESUELTA);
    const req = httpMock.expectOne((r) => r.url.endsWith('/incidencias'));

    expect(req.request.params.get('estado')).toBe('resuelta');
    expect(req.request.params.get('page')).toBe('1');
    req.flush({ items: [], total: 0 });
    await responderResumen();
    await promesa;
  });

  it('debería pasar la incidencia a revisión sin pedir resolución', async () => {
    await crear();

    const promesa = componente.tomar(incidencia() as never);
    const req = httpMock.expectOne((r) => r.url.endsWith('/incidencias/i1/estado'));

    expect(req.request.body).toEqual({ estado: EstadoIncidencia.EN_REVISION });
    req.flush(incidencia({ estado: EstadoIncidencia.EN_REVISION }));
    await responderResumen();
    await promesa;

    expect(componente.incidencias()[0].estado).toBe(EstadoIncidencia.EN_REVISION);
  });

  it('no debería resolver sin escribir cómo se resolvió', async () => {
    await crear();
    componente.abrirResolver('i1');
    componente.resolucion.set('   ');

    await componente.resolver(incidencia() as never);

    // Ninguna petición: el formulario ni siquiera llega a enviarse.
    httpMock.verify();
  });

  it('debería resolver enviando la explicación', async () => {
    await crear();
    componente.abrirResolver('i1');
    componente.resolucion.set('Reembolso emitido');

    const promesa = componente.resolver(incidencia() as never);
    const req = httpMock.expectOne((r) => r.url.endsWith('/incidencias/i1/estado'));

    expect(req.request.body).toEqual({ estado: EstadoIncidencia.RESUELTA, resolucion: 'Reembolso emitido' });
    req.flush(incidencia({ estado: EstadoIncidencia.RESUELTA, resolucion: 'Reembolso emitido' }));
    await responderResumen();
    await promesa;

    expect(componente.resolviendoId()).toBeNull();
  });
});
