import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { RouterTestingModule } from '@angular/router/testing';
import { of, throwError } from 'rxjs';
import { MotivoBajaComercio, VerticalKey } from 'shared';
import { AdminComerciosComponent } from './admin-comercios.component';
import { AdminApiService, ComercioAdmin } from './admin-api.service';

const comercio = (extra: Partial<ComercioAdmin> = {}): ComercioAdmin => ({
  _id: 'c1', nombreComercial: 'Canes', razonSocial: 'Canes SL', vatNumber: 'ESB12345678',
  verticales: [VerticalKey.ALOJAMIENTO], plan: 'basico', estado: 'activo',
  createdAt: '2026-01-01T00:00:00.000Z',
  ...extra,
} as ComercioAdmin);

describe('AdminComerciosComponent', () => {
  let fixture: ComponentFixture<AdminComerciosComponent>;
  let componente: AdminComerciosComponent;
  let api: Record<string, jest.Mock>;

  const crear = async (items: ComercioAdmin[] = [comercio()], total = items.length): Promise<void> => {
    api = {
      getComercios: jest.fn().mockReturnValue(of({ items, total, page: 1, totalPages: 1 })),
      aprobarComercio: jest.fn().mockReturnValue(of(comercio())),
      rechazarComercio: jest.fn().mockReturnValue(of(comercio())),
      cambiarVerificacionComercio: jest.fn().mockReturnValue(of(comercio())),
      crearComercio: jest.fn().mockReturnValue(of(comercio())),
      actualizarComercio: jest.fn().mockReturnValue(of(comercio())),
      eliminarComercio: jest.fn().mockReturnValue(of({ comercioId: 'c1', purgado: false })),
      getImpactoBaja: jest.fn().mockReturnValue(of({
        servicios: 3, serviciosPublicados: 2, usuarios: 1, reservas: 8, reservasActivas: 0,
        resenas: 4, puedeDarseDeBaja: true,
      })),
      restaurarComercio: jest.fn().mockReturnValue(of(comercio())),
    };

    await TestBed.configureTestingModule({
      imports: [AdminComerciosComponent, RouterTestingModule],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: AdminApiService, useValue: api },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(AdminComerciosComponent);
    componente = fixture.componentInstance;
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  };

  const ultimaConsulta = () => api['getComercios'].mock.calls.at(-1)![0];

  afterEach(() => jest.clearAllMocks());

  describe('listado', () => {
    it('debería cargar los comercios al entrar', async () => {
      await crear([comercio(), comercio({ _id: 'c2', nombreComercial: 'DogVan' })], 2);

      expect(componente.comercios()).toHaveLength(2);
      expect(componente.total()).toBe(2);
      expect(componente.cargando()).toBe(false);
    });

    it('debería avisar si la API no responde', async () => {
      api = {
        getComercios: jest.fn().mockReturnValue(throwError(() => new Error('caída'))),
      };
      await TestBed.configureTestingModule({
        imports: [AdminComerciosComponent, RouterTestingModule],
        providers: [
          provideHttpClient(), provideHttpClientTesting(),
          { provide: AdminApiService, useValue: api },
        ],
      }).compileComponents();

      fixture = TestBed.createComponent(AdminComerciosComponent);
      componente = fixture.componentInstance;
      fixture.detectChanges();
      await fixture.whenStable();

      expect(componente.errorMsg()).toContain('Error cargando');
      expect(componente.cargando()).toBe(false);
    });

    it('debería calcular las páginas a partir del total', async () => {
      await crear([comercio()], 45);

      expect(componente.totalPaginas()).toBeGreaterThan(1);
    });

    it('debería mostrar una página aunque no haya resultados', async () => {
      await crear([], 0);

      expect(componente.totalPaginas()).toBe(1);
    });
  });

  describe('filtros y paginación', () => {
    it('debería filtrar por estado y volver a la primera página', async () => {
      await crear();
      await componente.cambiarPagina(3);

      await componente.setFiltro('pendiente');

      expect(componente.paginaActual()).toBe(1);
      expect(ultimaConsulta()).toMatchObject({ estado: 'pendiente', page: 1 });
    });

    it('debería omitir el filtro cuando se elige "todos"', async () => {
      await crear();

      await componente.setFiltro('');

      expect(ultimaConsulta().estado).toBeUndefined();
    });

    it('debería pedir la página solicitada', async () => {
      await crear();

      await componente.cambiarPagina(2);

      expect(ultimaConsulta().page).toBe(2);
    });
  });

  describe('acciones sobre el comercio', () => {
    it('debería aprobar y recargar el listado', async () => {
      await crear();

      await componente.aprobar('c1');

      expect(api['aprobarComercio']).toHaveBeenCalledWith('c1');
      expect(api['getComercios']).toHaveBeenCalledTimes(2);
      expect(componente.accionando()).toBeNull();
    });

    it('debería suspender el comercio con el motivo escrito', async () => {
      await crear();
      componente.motivoSuspension.set('documentación caducada');

      await componente.suspender('c1');

      expect(api['rechazarComercio']).toHaveBeenCalledWith('c1', 'documentación caducada');
    });

    it('no debería suspender sin motivo desde el diálogo', async () => {
      await crear();
      componente.abrirSuspender({ _id: 'c1', nombreComercial: 'VilaCan', estado: 'activo' } as never);
      componente.motivoSuspension.set('   ');

      await componente.confirmarSuspender();

      expect(api['rechazarComercio']).not.toHaveBeenCalled();
    });

    it('debería informar si la aprobación falla', async () => {
      await crear();
      api['aprobarComercio'].mockReturnValue(throwError(() => new Error('500')));

      await componente.aprobar('c1');

      expect(componente.errorMsg()).toContain('Error al aprobar');
      expect(componente.accionando()).toBeNull();
    });

  });

  describe('alta y edición', () => {
    it('debería abrir el alta en blanco con el IVA editable', async () => {
      await crear();

      componente.abrirCrear();

      expect(componente.modalVisible()).toBe(true);
      expect(componente.editandoId()).toBeNull();
      expect(componente.form.get('vatNumber')!.enabled).toBe(true);
      expect(componente.verticalesSeleccionadas()).toEqual([]);
    });

    it('debería cargar el comercio y bloquear su número de IVA al editar', async () => {
      await crear();

      componente.abrirEditar(comercio({ comisionPctOverride: 0.12 }));

      // El VAT identifica fiscalmente al comercio: cambiarlo sería otro contribuyente.
      expect(componente.form.get('vatNumber')!.disabled).toBe(true);
      expect(componente.form.getRawValue()).toMatchObject({
        nombreComercial: 'Canes', comisionPctOverride: 0.12,
      });
      expect(componente.verticalesSeleccionadas()).toEqual([VerticalKey.ALOJAMIENTO]);
    });

    it('debería alternar los verticales del comercio', async () => {
      await crear();
      componente.abrirCrear();

      componente.toggleVertical(VerticalKey.PELUQUERIA);
      expect(componente.verticalesSeleccionadas()).toEqual([VerticalKey.PELUQUERIA]);

      componente.toggleVertical(VerticalKey.PELUQUERIA);
      expect(componente.verticalesSeleccionadas()).toEqual([]);
    });

    it('no debería guardar con el formulario incompleto', async () => {
      await crear();
      componente.abrirCrear();

      await componente.guardar();

      expect(api['crearComercio']).not.toHaveBeenCalled();
    });

    it('debería crear el comercio con el número de IVA', async () => {
      await crear();
      componente.abrirCrear();
      componente.form.patchValue({
        nombreComercial: 'DogVan', razonSocial: 'DogVan SL', vatNumber: 'ESB99999999',
      });
      componente.toggleVertical(VerticalKey.TRANSPORTE);

      await componente.guardar();

      expect(api['crearComercio']).toHaveBeenCalledWith(expect.objectContaining({
        vatNumber: 'ESB99999999', verticales: [VerticalKey.TRANSPORTE],
      }));
      expect(componente.modalVisible()).toBe(false);
    });

    it('debería actualizar sin reenviar el número de IVA', async () => {
      await crear();
      componente.abrirEditar(comercio());
      componente.form.patchValue({ nombreComercial: 'Canes Premium' });

      await componente.guardar();

      const [id, dto] = api['actualizarComercio'].mock.calls[0];
      expect(id).toBe('c1');
      expect(dto.nombreComercial).toBe('Canes Premium');
      expect(dto).not.toHaveProperty('vatNumber');
    });

    it('debería mantener el modal abierto si el guardado falla', async () => {
      await crear();
      api['crearComercio'].mockReturnValue(throwError(() => new Error('409')));
      componente.abrirCrear();
      componente.form.patchValue({
        nombreComercial: 'DogVan', razonSocial: 'DogVan SL', vatNumber: 'ESB99999999',
      });

      await componente.guardar();

      // Cerrar el modal perdería lo escrito por el administrador.
      expect(componente.modalVisible()).toBe(true);
      expect(componente.modalError()).toContain('Error guardando');
      expect(componente.guardando()).toBe(false);
    });

    it('debería cerrar el modal y olvidar la edición en curso', async () => {
      await crear();
      componente.abrirEditar(comercio());

      componente.cerrarModal();

      expect(componente.modalVisible()).toBe(false);
      expect(componente.editandoId()).toBeNull();
    });
  });

  describe('eliminación', () => {
    it('debería pedir confirmación y enseñar el impacto antes de borrar', async () => {
      await crear();

      await componente.confirmarEliminar(comercio());

      expect(componente.eliminarComercio()?._id).toBe('c1');
      expect(componente.impacto()?.servicios).toBe(3);
      expect(api['eliminarComercio']).not.toHaveBeenCalled();
    });

    it('debería cancelar sin borrar nada', async () => {
      await crear();
      await componente.confirmarEliminar(comercio());

      componente.cancelarEliminar();

      expect(componente.eliminarComercio()).toBeNull();
      expect(api['eliminarComercio']).not.toHaveBeenCalled();
    });

    it('debería dar de baja con motivo y recargar tras confirmar', async () => {
      await crear();
      await componente.confirmarEliminar(comercio());

      await componente.ejecutarEliminar();

      expect(api['eliminarComercio']).toHaveBeenCalledWith('c1', {
        motivo: MotivoBajaComercio.OTRO, comentario: undefined, purgar: false,
      });
      expect(componente.eliminarComercio()).toBeNull();
      expect(api['getComercios']).toHaveBeenCalledTimes(2);
    });

    it('debería exigir teclear el nombre del negocio para purgar', async () => {
      await crear();
      await componente.confirmarEliminar(comercio());
      componente.purgar.set(true);

      expect(componente.puedeConfirmarBaja()).toBe(false);
      await componente.ejecutarEliminar();
      expect(api['eliminarComercio']).not.toHaveBeenCalled();

      componente.confirmacionBaja.set(comercio().nombreComercial);
      await componente.ejecutarEliminar();
      expect(api['eliminarComercio']).toHaveBeenCalledWith('c1', expect.objectContaining({ purgar: true }));
    });

    it('no debería dejar dar de baja un comercio con reservas vivas', async () => {
      await crear();
      api['getImpactoBaja'].mockReturnValue(of({
        servicios: 1, serviciosPublicados: 1, usuarios: 1, reservas: 4, reservasActivas: 2,
        resenas: 0, puedeDarseDeBaja: false,
      }));

      await componente.confirmarEliminar(comercio());

      expect(componente.puedeConfirmarBaja()).toBe(false);
    });

    it('debería restaurar un comercio dado de baja', async () => {
      await crear();

      await componente.restaurar(comercio({ estado: 'eliminado' }));

      expect(api['restaurarComercio']).toHaveBeenCalledWith('c1');
      expect(api['getComercios']).toHaveBeenCalledTimes(2);
    });

    it('no debería hacer nada si no hay comercio confirmado', async () => {
      await crear();

      await componente.ejecutarEliminar();

      expect(api['eliminarComercio']).not.toHaveBeenCalled();
    });

    it('debería enseñar el motivo real que devuelve el API al fallar la baja', async () => {
      await crear();
      api['eliminarComercio'].mockReturnValue(
        throwError(() => ({ error: { message: 'No se puede dar de baja: hay 2 reserva(s) en curso.' } })),
      );
      await componente.confirmarEliminar(comercio());

      await componente.ejecutarEliminar();

      expect(componente.modalError()).toContain('2 reserva(s) en curso');
      expect(componente.eliminarComercio()).not.toBeNull();
    });
  });

  describe('etiquetas', () => {
    it('debería dar un icono Lucide por vertical y uno genérico si no lo conoce (TCK-8010)', async () => {
      await crear();

      expect(componente.iconVertical(VerticalKey.ALOJAMIENTO)).toBe('home');
      expect(componente.iconVertical('inexistente')).toBe('paw');
    });
  });
  describe('menú de acciones de cada fila', () => {
    it('no debería quedar recortado por la tarjeta de la tabla', async () => {
      // La tarjeta llevaba overflow:hidden y escondía el desplegable dentro del div.
      await crear();

      const tarjeta: HTMLElement = fixture.nativeElement.querySelector('.tbl-card');

      expect(tarjeta).not.toBeNull();
      expect(tarjeta.getAttribute('style') ?? '').not.toContain('overflow:hidden');
    });

    it('debería abrirse y cerrarse al pulsar el mismo botón', async () => {
      await crear();

      componente.menuAbiertoId.set('c1');
      expect(componente.menuAbiertoId()).toBe('c1');

      componente.cerrarMenu();
      expect(componente.menuAbiertoId()).toBeNull();
    });
  });
});
