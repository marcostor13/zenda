import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { of } from 'rxjs';
import { AdminAlphaComponent } from './admin-alpha.component';
import { AdminApiService } from './admin-api.service';

const nivel = (extra: Record<string, unknown> = {}) => ({
  nivel: 1, nombre: 'Alpha 1', reservasRequeridas: 0, descuentoPct: 0, beneficios: ['Promos'], ...extra,
});

const comercio = (extra: Record<string, unknown> = {}) => ({
  _id: 'c1', nombreComercial: 'VilaCan', vatNumber: 'B12345678', alphaAdherido: true, ...extra,
});

/** Fallo síncrono: una promesa rechazada la reporta zone.js como error global. */
const fallo = (mensaje: string) => jest.fn(() => { throw new Error(mensaje); });

describe('AdminAlphaComponent', () => {
  let fixture: ComponentFixture<AdminAlphaComponent>;
  let componente: AdminAlphaComponent;
  let api: Record<string, jest.Mock>;

  const crear = async (ajustes: Record<string, jest.Mock> = {}): Promise<void> => {
    api = {
      getAlphaNiveles: jest.fn().mockReturnValue(of([nivel()])),
      updateAlphaNivel: jest.fn().mockReturnValue(of({})),
      getComercios: jest.fn().mockReturnValue(of({ items: [comercio()], total: 1 })),
      fijarAlphaAdherido: jest.fn().mockReturnValue(of({})),
      ...ajustes,
    };

    await TestBed.configureTestingModule({
      imports: [AdminAlphaComponent],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: AdminApiService, useValue: api },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(AdminAlphaComponent);
    componente = fixture.componentInstance;
    fixture.detectChanges();
    await fixture.whenStable();
    // ngOnInit encadena niveles → adheridos: hace falta un macrotask real.
    await new Promise((resolve) => setTimeout(resolve, 0));
    fixture.detectChanges();
  };

  afterEach(() => {
    fixture?.destroy();
    jest.clearAllMocks();
  });

  describe('escalera de niveles', () => {
    it('debería cargar los niveles al iniciar', async () => {
      await crear();

      expect(componente.niveles()).toHaveLength(1);
      expect(componente.niveles()[0].nombre).toBe('Alpha 1');
    });

    it('debería presentar el escalón en romanos aunque la BD guarde el formato antiguo', async () => {
      await crear();

      expect(componente.etiquetaNivel(2)).toBe('ALPHA II');
    });

    it('debería guardar todos los niveles de una vez', async () => {
      await crear({ getAlphaNiveles: jest.fn().mockReturnValue(of([nivel(), nivel({ nivel: 2 })])) });

      await componente.guardarNiveles();

      expect(api['updateAlphaNivel']).toHaveBeenCalledTimes(2);
      expect(componente.guardadoMsg()).toBe(true);
    });

    it('no debería guardar beneficios vacíos a medio escribir', async () => {
      await crear();
      componente.anadirBeneficio(componente.niveles()[0]);

      await componente.guardarNiveles();

      expect(api['updateAlphaNivel']).toHaveBeenCalledWith(
        expect.objectContaining({ beneficios: ['Promos'] }),
      );
    });

    it('debería avisar si el guardado falla', async () => {
      await crear({ updateAlphaNivel: fallo('500') });

      await componente.guardarNiveles();

      expect(componente.errorMsg()).toContain('Error al guardar el programa Alpha');
    });
  });

  describe('beneficios', () => {
    it('debería añadir, editar y quitar beneficios uno a uno', async () => {
      await crear();
      const n = componente.niveles()[0];

      componente.anadirBeneficio(n);
      componente.editarBeneficio(n, 1, 'Prioridad en campañas');

      expect(n.beneficios).toEqual(['Promos', 'Prioridad en campañas']);

      componente.quitarBeneficio(n, 0);

      expect(n.beneficios).toEqual(['Prioridad en campañas']);
    });
  });

  describe('empresas adheridas', () => {
    it('debería listar las adheridas al entrar, sin buscar nada', async () => {
      await crear();

      expect(api['getComercios']).toHaveBeenCalledWith({ limite: 50, alphaAdherido: true });
      expect(componente.resultados()).toHaveLength(1);
      expect(componente.buscado()).toBe(false);
    });

    it('debería buscar por término y marcar que hay búsqueda activa', async () => {
      await crear();
      componente.busqueda.set('vila');

      await componente.buscarComercios();

      expect(api['getComercios']).toHaveBeenLastCalledWith({ limite: 20, buscar: 'vila' });
      expect(componente.buscado()).toBe(true);
    });

    it('debería volver a las adheridas si se busca en vacío', async () => {
      await crear();
      componente.busqueda.set('   ');

      await componente.buscarComercios();

      expect(api['getComercios']).toHaveBeenLastCalledWith({ limite: 50, alphaAdherido: true });
    });

    it('debería alternar la adhesión del comercio', async () => {
      await crear();

      await componente.alternarAdhesion(comercio() as never);

      expect(api['fijarAlphaAdherido']).toHaveBeenCalledWith('c1', false);
    });

    it('debería avisar si no se puede cambiar la adhesión', async () => {
      await crear({ fijarAlphaAdherido: fallo('500') });

      await componente.alternarAdhesion(comercio() as never);

      expect(componente.adhesionError()).toContain('No se pudo cambiar la adhesión');
    });
  });
});
