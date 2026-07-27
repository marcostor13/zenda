import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { RouterTestingModule } from '@angular/router/testing';
import { of } from 'rxjs';
import { ComercioSuplementosComponent } from './comercio-suplementos.component';
import { ComercioApiService, SuplementoConfig } from './comercio-api.service';

const suplemento = (extra: Partial<SuplementoConfig> = {}): SuplementoConfig => ({
  _id: 'sup1', concepto: 'Paseo extra', monto: 10, unidad: 'fijo', activo: true,
  ...extra,
} as SuplementoConfig);

/** Fallo síncrono: una promesa rechazada la reporta zone.js como error global. */
const fallo = (mensaje: string) => jest.fn(() => { throw new Error(mensaje); });

describe('ComercioSuplementosComponent', () => {
  let fixture: ComponentFixture<ComercioSuplementosComponent>;
  let componente: ComercioSuplementosComponent;
  let api: Record<string, jest.Mock>;

  const crear = async (lista: SuplementoConfig[] = [suplemento()], ajustes: Record<string, jest.Mock> = {}): Promise<void> => {
    api = {
      getMisSuplementos: jest.fn().mockReturnValue(of(lista)),
      crearSuplemento: jest.fn().mockReturnValue(of(suplemento({ _id: 'sup2', concepto: 'Baño' }))),
      actualizarSuplemento: jest.fn().mockReturnValue(of(suplemento({ activo: false }))),
      eliminarSuplemento: jest.fn().mockReturnValue(of(undefined)),
      ...ajustes,
    };

    await TestBed.configureTestingModule({
      imports: [ComercioSuplementosComponent, RouterTestingModule],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: ComercioApiService, useValue: api },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(ComercioSuplementosComponent);
    componente = fixture.componentInstance;
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  };

  afterEach(() => {
    fixture?.destroy();
    jest.clearAllMocks();
  });

  describe('carga', () => {
    it('debería listar los suplementos del comercio', async () => {
      await crear([suplemento(), suplemento({ _id: 'sup2' })]);

      expect(componente.suplementos()).toHaveLength(2);
      expect(componente.cargando()).toBe(false);
    });

    it('debería avisar si no se pueden cargar', async () => {
      await crear([], { getMisSuplementos: fallo('500') });

      expect(componente.errorMsg()).toContain('No se pudieron cargar');
      expect(componente.cargando()).toBe(false);
    });
  });

  describe('alta', () => {
    it('debería exigir concepto e importe', async () => {
      await crear();
      componente.nuevoConcepto = '   ';
      componente.nuevoMonto = 10;

      await componente.crear();

      expect(api['crearSuplemento']).not.toHaveBeenCalled();
      expect(componente.errorMsg()).toContain('importe válido');
    });

    it('debería rechazar importes de cero o negativos', async () => {
      await crear();
      componente.nuevoConcepto = 'Baño';
      componente.nuevoMonto = 0;

      await componente.crear();

      // Un suplemento de 0 € solo confundiría al cliente en el desglose.
      expect(api['crearSuplemento']).not.toHaveBeenCalled();
    });

    it('debería crear el suplemento recortando el concepto', async () => {
      await crear();
      componente.nuevoConcepto = '  Baño ';
      componente.nuevoMonto = 25;
      componente.nuevaUnidad = 'por_noche';

      await componente.crear();

      expect(api['crearSuplemento']).toHaveBeenCalledWith({
        concepto: 'Baño', monto: 25, unidad: 'por_noche',
      });
      expect(componente.suplementos()[0].concepto).toBe('Baño');
    });

    it('debería limpiar el formulario tras crear', async () => {
      await crear();
      componente.nuevoConcepto = 'Baño';
      componente.nuevoMonto = 25;
      componente.nuevaUnidad = 'por_dia';

      await componente.crear();

      expect(componente.nuevoConcepto).toBe('');
      expect(componente.nuevoMonto).toBeNull();
      expect(componente.nuevaUnidad).toBe('fijo');
    });

    it('debería avisar si el alta falla', async () => {
      await crear([], { crearSuplemento: fallo('500') });
      componente.nuevoConcepto = 'Baño';
      componente.nuevoMonto = 25;

      await componente.crear();

      expect(componente.errorMsg()).toContain('No se pudo crear');
      expect(componente.creando()).toBe(false);
    });
  });

  describe('activar y desactivar', () => {
    it('debería invertir el estado del suplemento', async () => {
      await crear();

      await componente.toggleActivo(suplemento({ activo: true }));

      expect(api['actualizarSuplemento']).toHaveBeenCalledWith('sup1', { activo: false });
      expect(componente.suplementos()[0].activo).toBe(false);
    });

    it('debería avisar si el cambio falla', async () => {
      await crear([], { actualizarSuplemento: fallo('500') });

      await componente.toggleActivo(suplemento());

      expect(componente.errorMsg()).toContain('No se pudo actualizar');
    });
  });

  describe('eliminación', () => {
    it('debería quitar el suplemento de la lista', async () => {
      await crear();

      await componente.eliminar(suplemento());

      expect(api['eliminarSuplemento']).toHaveBeenCalledWith('sup1');
      expect(componente.suplementos()).toHaveLength(0);
      expect(componente.eliminandoId()).toBeNull();
    });

    it('debería conservarlo si el borrado falla', async () => {
      await crear([suplemento()], { eliminarSuplemento: fallo('500') });

      await componente.eliminar(suplemento());

      expect(componente.errorMsg()).toContain('No se pudo eliminar');
      expect(componente.suplementos()).toHaveLength(1);
    });
  });

  describe('etiquetas', () => {
    it('debería traducir la unidad de cobro', async () => {
      await crear();

      expect(componente.unidadLabel('fijo')).not.toBe('');
      expect(componente.unidadLabel('inventada')).toBe('inventada');
    });
  });
});
