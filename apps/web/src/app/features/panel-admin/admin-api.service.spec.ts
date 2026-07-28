import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { AdminApiService } from './admin-api.service';

describe('AdminApiService', () => {
  let service: AdminApiService;
  let httpMock: HttpTestingController;

  /** Captura la petición que coincide con el fragmento de URL y la resuelve. */
  const peticion = (fragmento: string) => {
    const req = httpMock.expectOne((r) => r.url.includes(fragmento));
    req.flush({});
    return req.request;
  };

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(AdminApiService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  describe('comercios', () => {
    it('debería aprobar poniendo el estado en activo', () => {
      service.aprobarComercio('c1').subscribe();

      const req = peticion('/comercios/c1/estado');
      expect(req.method).toBe('PATCH');
      expect(req.body).toEqual({ estado: 'activo' });
    });

    it('debería suspender al rechazar, no borrar', () => {
      service.rechazarComercio('c1').subscribe();

      expect(peticion('/comercios/c1/estado').body).toEqual({ estado: 'suspendido' });
    });

    it('debería enviar el motivo al rechazar la verificación', () => {
      service.cambiarVerificacionComercio('c1', 'rechazado', 'Documentación ilegible').subscribe();

      expect(peticion('/comercios/c1/verificacion').body).toEqual({
        estado: 'rechazado', motivo: 'Documentación ilegible',
      });
    });

    it('no debería enviar filtros vacíos al listar', () => {
      service.getComercios().subscribe();

      expect(peticion('/admin/comercios').params.keys()).toHaveLength(0);
    });

    it('debería propagar paginación y búsqueda', () => {
      service.getComercios({ page: 2, limite: 50, estado: 'activo', buscar: 'royal' }).subscribe();

      const req = peticion('/admin/comercios');
      expect(req.params.get('page')).toBe('2');
      expect(req.params.get('limite')).toBe('50');
      expect(req.params.get('estado')).toBe('activo');
      expect(req.params.get('buscar')).toBe('royal');
    });

    it('debería eliminar con DELETE', () => {
      service.eliminarComercio('c1').subscribe();

      expect(peticion('/admin/comercios/c1').method).toBe('DELETE');
    });
  });

  describe('reservas', () => {
    it('debería pedir siempre la página, aunque no haya filtros', () => {
      service.getReservas().subscribe();

      const req = peticion('/admin/reservas');
      expect(req.params.get('page')).toBe('1');
      expect(req.params.keys()).toHaveLength(1);
    });

    it('debería propagar el rango de fechas del filtro', () => {
      service.getReservas(3, { fechaDesde: '2026-01-01', fechaHasta: '2026-03-31' }).subscribe();

      const req = peticion('/admin/reservas');
      expect(req.params.get('page')).toBe('3');
      expect(req.params.get('fechaDesde')).toBe('2026-01-01');
      expect(req.params.get('fechaHasta')).toBe('2026-03-31');
    });

    it('debería enviar el motivo al cambiar el estado de una reserva', () => {
      service.cambiarEstadoReserva('r1', 'cancelada', 'Petición del cliente').subscribe();

      expect(peticion('/admin/reservas/r1/estado').body).toEqual({
        estado: 'cancelada', motivo: 'Petición del cliente',
      });
    });
  });

  describe('reportes', () => {
    it('debería exigir siempre el rango de fechas', () => {
      service.getReporteFinanciero('2026-01-01', '2026-12-31').subscribe();

      const req = peticion('/reportes/financiero');
      expect(req.params.get('fechaDesde')).toBe('2026-01-01');
      expect(req.params.get('fechaHasta')).toBe('2026-12-31');
      expect(req.params.has('vertical')).toBe(false);
    });

    it('debería acotar por vertical y comercio cuando se indican', () => {
      service.getReporteFinanciero('2026-01-01', '2026-12-31', 'alojamiento', 'c1').subscribe();

      const req = peticion('/reportes/financiero');
      expect(req.params.get('vertical')).toBe('alojamiento');
      expect(req.params.get('comercioId')).toBe('c1');
    });
  });

  describe('usuarios y cupones', () => {
    it('debería crear el usuario con POST', () => {
      service.crearUsuario({ nombre: 'Ana', email: 'a@x.com' } as never).subscribe();

      expect(peticion('/admin/usuarios').method).toBe('POST');
    });

    it('debería actualizar el usuario con PATCH', () => {
      service.actualizarUsuario('u1', { nombre: 'Ana María' } as never).subscribe();

      const req = peticion('/admin/usuarios/u1');
      expect(req.method).toBe('PATCH');
      expect(req.body).toEqual({ nombre: 'Ana María' });
    });

    it('debería actualizar el cupón contra su propio recurso, no contra admin', () => {
      service.actualizarCupon('cup1', { activo: false }).subscribe();

      const req = peticion('/cupones/cup1');
      expect(req.method).toBe('PATCH');
      expect(req.url).not.toContain('/admin/');
    });

    it('debería eliminar el cupón con DELETE', () => {
      service.eliminarCupon('cup1').subscribe();

      expect(peticion('/cupones/cup1').method).toBe('DELETE');
    });
  });

  describe('configuración', () => {
    it('debería guardar la comisión con PUT', () => {
      service.updateComision({ vertical: 'alojamiento', comisionPct: 0.12, activo: true }).subscribe();

      const req = peticion('/admin/comisiones');
      expect(req.method).toBe('PUT');
      expect(req.body).toMatchObject({ comisionPct: 0.12 });
    });

    it('debería pedir el dashboard y la analítica por separado', () => {
      service.getDashboard().subscribe();
      peticion('/admin/dashboard');

      service.getAnalitica().subscribe();
      expect(peticion('/admin/analitica').method).toBe('GET');
    });

    it('debería listar los niveles Alpha con GET', () => {
      service.getAlphaNiveles().subscribe();

      expect(peticion('/admin/alpha').method).toBe('GET');
    });

    it('debería guardar un nivel Alpha con PUT', () => {
      service.updateAlphaNivel({ nivel: 2, nombre: 'Alpha 2', reservasRequeridas: 5, descuentoPct: 0.05, beneficios: ['x'] }).subscribe();

      const req = peticion('/admin/alpha');
      expect(req.method).toBe('PUT');
      expect(req.body).toMatchObject({ nivel: 2, nombre: 'Alpha 2' });
    });
  });
});
