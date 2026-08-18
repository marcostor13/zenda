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
  /**
   * Todos estos metodos construyen los query params a mano con `if`. Cada `if`
   * es una rama, y un parametro que se cuela o se pierde cambia lo que ve el
   * administrador sin dar ningun error.
   */
  describe('construccion de query params', () => {
    it('no deberia enviar rango de fechas al dashboard si no se indica', () => {
      service.getDashboard().subscribe();

      expect(peticion('/admin/dashboard').params.keys()).toHaveLength(0);
    });

    it('deberia enviar desde y hasta cuando hay rango', () => {
      service.getDashboard({ desde: '2026-08-01', hasta: '2026-08-31' }).subscribe();

      const params = peticion('/admin/dashboard').params;
      expect(params.get('desde')).toBe('2026-08-01');
      expect(params.get('hasta')).toBe('2026-08-31');
    });

    it('deberia omitir los filtros vacios de auditoria', () => {
      service.getAuditoria().subscribe();

      expect(peticion('/auditoria').params.keys()).toHaveLength(0);
    });

    it('deberia enviar todos los filtros de auditoria cuando llegan', () => {
      service.getAuditoria({ page: 2, limite: 50, entidad: 'comercio', entidadId: 'c1', buscar: 'x' }).subscribe();

      const params = peticion('/auditoria').params;
      expect(params.get('page')).toBe('2');
      expect(params.get('limite')).toBe('50');
      expect(params.get('entidad')).toBe('comercio');
      expect(params.get('entidadId')).toBe('c1');
      expect(params.get('buscar')).toBe('x');
    });

    it('deberia enviar alphaAdherido=false, que no es lo mismo que no filtrar', () => {
      // Con un `if (params.alphaAdherido)` se perderia el false y el admin veria
      // todos los comercios en vez de solo los no adheridos.
      service.getComercios({ alphaAdherido: false }).subscribe();

      expect(peticion('/admin/comercios').params.get('alphaAdherido')).toBe('false');
    });

    it('deberia enviar verificado=false por el mismo motivo', () => {
      service.getUsuarios({ verificado: false }).subscribe();

      expect(peticion('/admin/usuarios').params.get('verificado')).toBe('false');
    });

    it('deberia enviar los filtros de usuarios cuando llegan', () => {
      service.getUsuarios({ page: 3, limite: 10, rol: 'cliente', buscar: 'ana' }).subscribe();

      const params = peticion('/admin/usuarios').params;
      expect(params.get('rol')).toBe('cliente');
      expect(params.get('buscar')).toBe('ana');
    });

    it('deberia enviar importeMin=0, que es un filtro valido', () => {
      // `if (importeMin)` lo descartaria por falsy: "gratis" es un filtro real.
      service.getReservas(1, { importeMin: 0, importeMax: 0 }).subscribe();

      const params = peticion('/admin/reservas').params;
      expect(params.get('importeMin')).toBe('0');
      expect(params.get('importeMax')).toBe('0');
    });

    it('deberia enviar todos los filtros de reservas', () => {
      service.getReservas(2, {
        estado: 'confirmada', comercioId: 'c1', buscar: 'RES', fechaDesde: '2026-01-01',
        fechaHasta: '2026-12-31', vertical: 'alojamiento', ciudad: 'Valencia', estadoPago: 'aprobado',
      }, 50).subscribe();

      const params = peticion('/admin/reservas').params;
      expect(params.get('page')).toBe('2');
      expect(params.get('limite')).toBe('50');
      expect(params.get('vertical')).toBe('alojamiento');
      expect(params.get('ciudad')).toBe('Valencia');
      expect(params.get('estadoPago')).toBe('aprobado');
    });

    it('deberia enviar solo las fechas obligatorias del reporte financiero', () => {
      service.getReporteFinanciero('2026-08-01', '2026-08-31').subscribe();

      const params = peticion('/reportes/financiero').params;
      expect(params.get('fechaDesde')).toBe('2026-08-01');
      expect(params.has('vertical')).toBe(false);
    });

    it('deberia acotar el reporte por vertical y comercio cuando se indican', () => {
      service.getReporteFinanciero('2026-08-01', '2026-08-31', 'alojamiento', 'c1').subscribe();

      const params = peticion('/reportes/financiero').params;
      expect(params.get('vertical')).toBe('alojamiento');
      expect(params.get('comercioId')).toBe('c1');
    });

    it('deberia usar 30 dias por defecto en la evolucion', () => {
      service.getEvolucion().subscribe();

      expect(peticion('/analitica/evolucion').params.get('dias')).toBe('30');
    });
  });

  describe('acciones sobre comercios y usuarios', () => {
    it('deberia aprobar poniendo el estado activo', () => {
      service.aprobarComercio('c1').subscribe();

      expect(peticion('/comercios/c1/estado').body).toEqual({ estado: 'activo' });
    });

    it('deberia exigir motivo al rechazar', () => {
      // El backend lo valida; enviarlo vacio devolveria 400 (TCK-8034).
      service.rechazarComercio('c1', 'documentacion falsa').subscribe();

      expect(peticion('/comercios/c1/estado').body).toEqual({
        estado: 'suspendido', motivo: 'documentacion falsa',
      });
    });

    it('deberia enviar la adhesion a Alpha como booleano', () => {
      service.fijarAlphaAdherido('c1', true).subscribe();

      expect(peticion('/alpha-adherido').body).toEqual({ alphaAdherido: true });
    });

    it('deberia permitir verificar sin motivo y rechazar con el', () => {
      service.cambiarVerificacionComercio('c1', 'verificado').subscribe();
      expect(peticion('/verificacion').body).toEqual({ estado: 'verificado', motivo: undefined });

      service.cambiarVerificacionComercio('c1', 'rechazado', 'licencia caducada').subscribe();
      expect(peticion('/verificacion').body).toEqual({
        estado: 'rechazado', motivo: 'licencia caducada',
      });
    });

    it('deberia crear, actualizar y eliminar comercios por su verbo HTTP', () => {
      service.crearComercio({ nombreComercial: 'X' } as never).subscribe();
      expect(peticion('/admin/comercios').method).toBe('POST');

      service.actualizarComercio('c1', { plan: 'pro' } as never).subscribe();
      expect(peticion('/admin/comercios/c1').method).toBe('PATCH');

      service.eliminarComercio('c1').subscribe();
      expect(peticion('/admin/comercios/c1').method).toBe('DELETE');
    });

    it('deberia crear, actualizar y eliminar usuarios por su verbo HTTP', () => {
      service.crearUsuario({ email: 'a@a.com' } as never).subscribe();
      expect(peticion('/admin/usuarios').method).toBe('POST');

      service.actualizarUsuario('u1', { rol: 'admin' } as never).subscribe();
      expect(peticion('/admin/usuarios/u1').method).toBe('PATCH');

      service.eliminarUsuario('u1').subscribe();
      expect(peticion('/admin/usuarios/u1').method).toBe('DELETE');
    });

    it('deberia cambiar el estado de una reserva con motivo opcional', () => {
      service.cambiarEstadoReserva('r1', 'cancelada', 'fraude').subscribe();

      expect(peticion('/admin/reservas/r1/estado').body).toEqual({
        estado: 'cancelada', motivo: 'fraude',
      });
    });

    it('deberia actualizar y eliminar cupones', () => {
      service.actualizarCupon('cup1', { activo: false }).subscribe();
      expect(peticion('/cupones/cup1').method).toBe('PATCH');

      service.eliminarCupon('cup1').subscribe();
      expect(peticion('/cupones/cup1').method).toBe('DELETE');
    });
  });

  describe('lecturas simples', () => {
    it('deberia pedir los resumenes y fichas por GET', () => {
      service.getResumenPagos().subscribe();
      expect(peticion('/pagos/resumen').method).toBe('GET');

      service.getResumenReservas().subscribe();
      expect(peticion('/reservas/resumen').method).toBe('GET');

      service.getResumenComercios().subscribe();
      expect(peticion('/comercios/resumen').method).toBe('GET');

      service.getResumenUsuarios().subscribe();
      expect(peticion('/usuarios/resumen').method).toBe('GET');

      service.getFichaUsuario('u1').subscribe();
      expect(peticion('/usuarios/u1/ficha').method).toBe('GET');

      service.getFichaComercio('c1').subscribe();
      expect(peticion('/comercios/c1/ficha').method).toBe('GET');

      service.getAnalitica().subscribe();
      expect(peticion('/admin/analitica').method).toBe('GET');
    });

    it('deberia gestionar liquidaciones', () => {
      service.getLiquidaciones({ page: 1, comercioId: 'c1', estado: 'pendiente' }).subscribe();
      const params = peticion('/liquidaciones').params;
      expect(params.get('comercioId')).toBe('c1');
      expect(params.get('estado')).toBe('pendiente');

      service.generarLiquidacion({ comercioId: 'c1', desde: 'a', hasta: 'b' }).subscribe();
      expect(peticion('/liquidaciones').method).toBe('POST');

      service.marcarLiquidacionPagada('l1', 'TRF-1').subscribe();
      expect(peticion('/liquidaciones/l1/pagada').body).toEqual({ referencia: 'TRF-1' });
    });

    it('deberia filtrar los pagos por estado, comercio y busqueda', () => {
      service.getPagos({ page: 1, limite: 20, estado: 'aprobado', comercioId: 'c1', buscar: 'RES' }).subscribe();

      const params = peticion('/admin/pagos').params;
      expect(params.get('estado')).toBe('aprobado');
      expect(params.get('comercioId')).toBe('c1');
      expect(params.get('buscar')).toBe('RES');
    });
  });
});
