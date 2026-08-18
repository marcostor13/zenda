import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { RouterTestingModule } from '@angular/router/testing';
import { of, throwError } from 'rxjs';
import { VerticalKey } from 'shared';
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
      eliminarComercio: jest.fn().mockReturnValue(of(undefined)),
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

    it('debería marcar la documentación como verificada', async () => {
      await crear();

      await componente.verificar('c1');

      expect(api['cambiarVerificacionComercio']).toHaveBeenCalledWith('c1', 'verificado');
    });

    it('debería enviar el motivo al rechazar la documentación', async () => {
      await crear();
      jest.spyOn(window, 'prompt').mockReturnValue('Documento ilegible');

      await componente.rechazarVerif('c1');

      expect(api['cambiarVerificacionComercio']).toHaveBeenCalledWith('c1', 'rechazado', 'Documento ilegible');
    });

    it('debería permitir rechazar sin motivo', async () => {
      await crear();
      jest.spyOn(window, 'prompt').mockReturnValue(null);

      await componente.rechazarVerif('c1');

      expect(api['cambiarVerificacionComercio']).toHaveBeenCalledWith('c1', 'rechazado', undefined);
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
    it('debería pedir confirmación antes de borrar', async () => {
      await crear();

      componente.confirmarEliminar(comercio());

      expect(componente.eliminarComercio()?._id).toBe('c1');
      expect(api['eliminarComercio']).not.toHaveBeenCalled();
    });

    it('debería cancelar sin borrar nada', async () => {
      await crear();
      componente.confirmarEliminar(comercio());

      componente.cancelarEliminar();

      expect(componente.eliminarComercio()).toBeNull();
      expect(api['eliminarComercio']).not.toHaveBeenCalled();
    });

    it('debería borrar y recargar tras confirmar', async () => {
      await crear();
      componente.confirmarEliminar(comercio());

      await componente.ejecutarEliminar();

      expect(api['eliminarComercio']).toHaveBeenCalledWith('c1');
      expect(componente.eliminarComercio()).toBeNull();
      expect(api['getComercios']).toHaveBeenCalledTimes(2);
    });

    it('no debería hacer nada si no hay comercio confirmado', async () => {
      await crear();

      await componente.ejecutarEliminar();

      expect(api['eliminarComercio']).not.toHaveBeenCalled();
    });

    it('debería informar del fallo al eliminar', async () => {
      await crear();
      api['eliminarComercio'].mockReturnValue(throwError(() => new Error('500')));
      componente.confirmarEliminar(comercio());

      await componente.ejecutarEliminar();

      expect(componente.modalError()).toContain('Error eliminando');
      expect(componente.eliminarComercio()).not.toBeNull();
    });
  });

  describe('etiquetas', () => {
    it('debería distinguir visualmente cada estado de verificación', async () => {
      await crear();

      expect(componente.badgeVerif('verificado')).toContain('success');
      expect(componente.badgeVerif('pendiente')).toContain('warning');
      expect(componente.badgeVerif('caducado')).toContain('error');
      expect(componente.badgeVerif('desconocido')).toContain('neutral');
    });

    it('debería etiquetar los estados de documentación', async () => {
      await crear();

      expect(componente.verifLabel('verificado')).toContain('Verificado');
      expect(componente.verifLabel('otro')).toBe('otro');
    });

    it('debería dar un icono Lucide por vertical y uno genérico si no lo conoce (TCK-8010)', async () => {
      await crear();

      expect(componente.iconVertical(VerticalKey.ALOJAMIENTO)).toBe('hotel');
      expect(componente.iconVertical('inexistente')).toBe('paw');
    });
  });
  /**
   * El admin no podía ver los papeles que subía el comercio: la ficha sólo
   * pintaba un contador. Verificar así es firmar a ciegas.
   */
  describe('documentación en la ficha', () => {
    const verificacion = {
      estado: 'pendiente',
      documentoIdentidadUrl: 'https://cdn.doogking.com/dni.pdf',
      licenciaNegocioUrl: 'https://cdn.doogking.com/licencia.jpg',
      documentos: [
        { tipo: 'seguro_rc', nombre: 'Póliza 2026', url: 'https://cdn.doogking.com/rc.pdf', fechaCaducidad: '2027-01-31', estado: 'pendiente' },
        { tipo: 'inventado', url: 'https://cdn.doogking.com/otro.pdf', estado: 'verificado' },
      ],
    };

    it('debería listar los documentos fijos junto a los adicionales', async () => {
      await crear();

      const documentos = componente.documentosDe(verificacion as never);

      expect(documentos).toHaveLength(4);
      expect(documentos[0].titulo).toBe('Documento de identidad');
      expect(documentos[1].titulo).toBe('Licencia de actividad');
    });

    it('debería traducir el tipo de los documentos adicionales', async () => {
      await crear();

      const documentos = componente.documentosDe(verificacion as never);

      expect(documentos[2].titulo).toBe('Seguro de responsabilidad civil');
      expect(documentos[2].nombre).toBe('Póliza 2026');
    });

    it('debería dejar en crudo un tipo que no está en el catálogo', async () => {
      await crear();

      expect(componente.documentosDe(verificacion as never)[3].titulo).toBe('inventado');
    });

    it('no debería listar nada si el comercio no ha subido documentación', async () => {
      await crear();

      expect(componente.documentosDe(undefined)).toEqual([]);
      expect(componente.documentosDe({ estado: 'sin_verificar' } as never)).toEqual([]);
    });

    it('debería descartar los documentos sin URL, que no se pueden abrir', async () => {
      await crear();

      const documentos = componente.documentosDe({
        estado: 'pendiente', documentos: [{ tipo: 'otro', url: '', estado: 'pendiente' }],
      } as never);

      expect(documentos).toEqual([]);
    });

    it('debería distinguir un PDF de una imagen por el icono', async () => {
      // No se revisan igual; el icono lo adelanta antes de abrirlo.
      await crear();

      expect(componente.iconoDoc('https://cdn.doogking.com/dni.pdf')).toBe('file-text');
      expect(componente.iconoDoc('https://cdn.doogking.com/DNI.PDF')).toBe('file-text');
      expect(componente.iconoDoc('https://cdn.doogking.com/doc.pdf?v=2')).toBe('file-text');
      expect(componente.iconoDoc('https://cdn.doogking.com/licencia.jpg')).toBe('image');
    });

    it('debería marcar como caducado un documento cuya fecha ya pasó', async () => {
      // Un seguro vencido no sirve para verificar aunque esté subido.
      await crear();

      expect(componente.estaCaducado('2020-01-01')).toBe(true);
      expect(componente.estaCaducado('2099-01-01')).toBe(false);
      expect(componente.estaCaducado(undefined)).toBe(false);
    });

    it('debería colorear el estado de cada documento', async () => {
      await crear();

      expect(componente.badgeDoc('verificado')).toContain('success');
      expect(componente.badgeDoc('pendiente')).toContain('warning');
      expect(componente.badgeDoc('rechazado')).toContain('error');
      expect(componente.badgeDoc('desconocido')).toContain('neutral');
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
