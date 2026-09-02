import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { EntidadAuditada } from 'shared';
import { AdminAuditoriaComponent } from './admin-auditoria.component';
import { AdminApiService, RegistroAuditoria } from './admin-api.service';

describe('AdminAuditoriaComponent', () => {
  let fixture: ComponentFixture<AdminAuditoriaComponent>;
  let componente: AdminAuditoriaComponent;
  let adminApi: { getAuditoria: jest.Mock };

  const registro = (extra: Partial<RegistroAuditoria> = {}): RegistroAuditoria => ({
    _id: 'a1',
    actorNombre: 'Ana Admin',
    entidad: EntidadAuditada.COMERCIO,
    entidadId: 'c1',
    descripcion: 'Suspendió el comercio Canes Felices',
    createdAt: '2026-08-20T10:00:00.000Z',
    ...extra,
  });

  const montar = async (
    respuesta: { items: RegistroAuditoria[]; total: number } = { items: [registro()], total: 1 },
  ): Promise<void> => {
    adminApi = { getAuditoria: jest.fn().mockReturnValue(of(respuesta)) };

    TestBed.resetTestingModule();
    await TestBed.configureTestingModule({
      imports: [AdminAuditoriaComponent],
      providers: [{ provide: AdminApiService, useValue: adminApi }],
    }).compileComponents();

    fixture = TestBed.createComponent(AdminAuditoriaComponent);
    componente = fixture.componentInstance;
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  };

  const ultimaConsulta = (): Record<string, unknown> =>
    adminApi.getAuditoria.mock.calls.at(-1)![0];

  beforeEach(async () => await montar());

  describe('carga inicial', () => {
    it('debería pedir la primera página del historial', () => {
      expect(ultimaConsulta()).toMatchObject({ page: 1, limite: 30 });
      expect(componente.registros()).toHaveLength(1);
      expect(componente.total()).toBe(1);
      expect(componente.cargando()).toBe(false);
    });

    it('no debería mandar filtros vacíos al API', () => {
      // Una cadena vacía es "sin filtro", no "entidad llamada cadena vacía".
      expect(ultimaConsulta()['entidad']).toBeUndefined();
      expect(ultimaConsulta()['buscar']).toBeUndefined();
    });

    it('debería explicar el fallo en vez de dejar la pantalla en blanco', async () => {
      adminApi.getAuditoria = jest.fn().mockReturnValue(throwError(() => new Error('502')));

      await componente.cambiarPagina(1);

      expect(componente.errorMsg()).toContain('Error cargando el historial');
      expect(componente.cargando()).toBe(false);
    });

    it('debería limpiar el error al recargar con éxito', async () => {
      adminApi.getAuditoria = jest.fn().mockReturnValue(throwError(() => new Error('502')));
      await componente.cambiarPagina(1);

      adminApi.getAuditoria = jest.fn().mockReturnValue(of({ items: [registro()], total: 1 }));
      await componente.cambiarPagina(1);

      expect(componente.errorMsg()).toBe('');
    });
  });

  describe('filtros', () => {
    it('debería filtrar por entidad y volver a la primera página', async () => {
      await componente.cambiarPagina(3);

      await componente.cambiarEntidad(EntidadAuditada.USUARIO);

      expect(componente.pagina()).toBe(1);
      expect(ultimaConsulta()).toMatchObject({ page: 1, entidad: EntidadAuditada.USUARIO });
    });

    it('debería volver a "todas" quitando el filtro', async () => {
      await componente.cambiarEntidad(EntidadAuditada.USUARIO);

      await componente.cambiarEntidad('');

      expect(ultimaConsulta()['entidad']).toBeUndefined();
    });

    it('debería buscar sin los espacios que sobran', async () => {
      await componente.aplicarBusqueda('  Canes Felices  ');

      expect(componente.buscar()).toBe('Canes Felices');
      expect(ultimaConsulta()['buscar']).toBe('Canes Felices');
    });

    it('no debería buscar por una cadena de espacios', async () => {
      await componente.aplicarBusqueda('   ');

      expect(ultimaConsulta()['buscar']).toBeUndefined();
    });

    it('debería volver a la primera página al buscar', async () => {
      await componente.cambiarPagina(2);

      await componente.aplicarBusqueda('Canes');

      expect(componente.pagina()).toBe(1);
    });
  });

  describe('paginación', () => {
    it('debería contar las páginas por el total del API', async () => {
      await montar({ items: [registro()], total: 61 });

      expect(componente.totalPaginas()).toBe(3);
    });

    it('debería enseñar una página aunque no haya ningún registro', async () => {
      // «Página 1 de 0» no es una página: sería un contador roto en pantalla.
      await montar({ items: [], total: 0 });

      expect(componente.totalPaginas()).toBe(1);
    });

    it('debería pedir la página a la que se navega', async () => {
      await componente.cambiarPagina(2);

      expect(componente.pagina()).toBe(2);
      expect(ultimaConsulta()['page']).toBe(2);
    });
  });

  describe('etiquetas', () => {
    it('debería dar a cada entidad conocida su icono', () => {
      expect(componente.icono(EntidadAuditada.COMERCIO)).toBe('building');
      expect(componente.icono(EntidadAuditada.USUARIO)).toBe('users');
    });

    it('no debería disfrazar una entidad desconocida con el icono de otra', () => {
      expect(componente.icono('lo-que-sea')).toBe('circle');
    });

    it('debería traducir la entidad a su etiqueta', () => {
      expect(componente.etiquetaEntidad(EntidadAuditada.COMERCIO)).toBeTruthy();
      expect(componente.etiquetaEntidad(EntidadAuditada.COMERCIO))
        .not.toBe(EntidadAuditada.COMERCIO);
    });

    it('debería enseñar tal cual una entidad que no tenga etiqueta', () => {
      expect(componente.etiquetaEntidad('lo-que-sea')).toBe('lo-que-sea');
    });

    it('debería ofrecer todas las entidades auditables como filtro', () => {
      expect(componente.entidades.map((e) => e.valor)).toEqual(Object.values(EntidadAuditada));
      expect(componente.entidades.every((e) => !!e.label)).toBe(true);
    });
  });

  describe('lo que se ve en pantalla', () => {
    it('debería mostrar quién hizo qué', () => {
      const texto = (fixture.nativeElement as HTMLElement).textContent ?? '';

      expect(texto).toContain('Suspendió el comercio Canes Felices');
      expect(texto).toContain('Ana Admin');
    });

    it('debería mostrar el motivo cuando la acción lo lleva', async () => {
      await montar({
        items: [registro({ motivo: 'Reiteradas quejas de clientes' })],
        total: 1,
      });

      expect((fixture.nativeElement as HTMLElement).textContent)
        .toContain('Reiteradas quejas de clientes');
    });
  });
});
