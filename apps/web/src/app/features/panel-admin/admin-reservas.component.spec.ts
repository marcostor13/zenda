import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { RouterTestingModule } from '@angular/router/testing';
import { of } from 'rxjs';
import { ReservaEstado, VerticalKey } from 'shared';
import { AdminReservasComponent } from './admin-reservas.component';
import { AdminApiService, ReservaAdmin } from './admin-api.service';

const reserva = (extra: Partial<ReservaAdmin> = {}): ReservaAdmin => ({
  _id: 'r1', codigo: 'RES-AAAA1111', vertical: VerticalKey.ALOJAMIENTO,
  estado: ReservaEstado.CONFIRMADA, montoTotal: 121, moneda: 'EUR',
  fechaInicio: '2026-09-01T00:00:00.000Z', createdAt: '2026-07-01T00:00:00.000Z',
  ...extra,
} as ReservaAdmin);

/** Fallo del API sin observable: evita rechazos que zone.js reporta como globales. */
const fallo = (mensaje: string) => jest.fn(() => { throw new Error(mensaje); });

describe('AdminReservasComponent', () => {
  let fixture: ComponentFixture<AdminReservasComponent>;
  let componente: AdminReservasComponent;
  let api: Record<string, jest.Mock>;

  const crear = async (
    items: ReservaAdmin[] = [reserva()],
    total = items.length,
    ajustes: Record<string, jest.Mock> = {},
  ): Promise<void> => {
    api = {
      getReservas: jest.fn().mockReturnValue(of({ items, total, page: 1, totalPages: 1 })),
      cambiarEstadoReserva: jest.fn().mockReturnValue(of(reserva({ estado: ReservaEstado.CANCELADA }))),
      ...ajustes,
    };

    await TestBed.configureTestingModule({
      imports: [AdminReservasComponent, RouterTestingModule],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: AdminApiService, useValue: api },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(AdminReservasComponent);
    componente = fixture.componentInstance;
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  };

  const ultimosFiltros = () => api['getReservas'].mock.calls.at(-1)![1];

  afterEach(() => {
    fixture?.destroy();
    jest.clearAllMocks();
  });

  describe('listado', () => {
    it('debería cargar las reservas al entrar', async () => {
      await crear([reserva(), reserva({ _id: 'r2', codigo: 'RES-BBBB2222' })], 2);

      expect(componente.reservas()).toHaveLength(2);
      expect(componente.total()).toBe(2);
      expect(componente.cargando()).toBe(false);
    });

    it('debería avisar si el listado no carga', async () => {
      await crear([], 0, { getReservas: fallo('500') });

      expect(componente.errorMsg()).toContain('Error cargando');
      expect(componente.cargando()).toBe(false);
    });

    it('debería calcular las páginas', async () => {
      await crear([reserva()], 100);

      expect(componente.totalPaginas()).toBeGreaterThan(1);
    });
  });

  describe('filtros y búsqueda', () => {
    it('debería filtrar por estado desde la primera página', async () => {
      await crear();
      await componente.cambiarPagina(3);

      await componente.setFiltro(ReservaEstado.CANCELADA);

      expect(componente.paginaActual()).toBe(1);
      expect(ultimosFiltros()).toMatchObject({ estado: ReservaEstado.CANCELADA });
    });

    it('no debería enviar búsqueda mientras el campo esté vacío', async () => {
      await crear();
      componente.buscarInput = '   ';

      await componente.aplicarBusqueda();

      expect(componente.buscarActivo()).toBe(false);
      expect(ultimosFiltros().buscar).toBeUndefined();
    });

    it('debería buscar por código recortando espacios', async () => {
      await crear();
      componente.buscarInput = '  RES-AAAA1111 ';

      await componente.aplicarBusqueda();

      expect(ultimosFiltros().buscar).toBe('RES-AAAA1111');
    });

    it('debería limpiar la búsqueda y recargar', async () => {
      await crear();
      componente.buscarInput = 'RES-AAAA1111';
      await componente.aplicarBusqueda();

      await componente.limpiarBusqueda();

      expect(componente.buscarInput).toBe('');
      expect(ultimosFiltros().buscar).toBeUndefined();
    });
  });

  describe('detalle desplegable', () => {
    it('debería abrir y cerrar la línea de tiempo de la reserva', async () => {
      await crear();

      componente.toggleTimeline('r1');
      expect(componente.expandidoId()).toBe('r1');

      componente.toggleTimeline('r1');
      expect(componente.expandidoId()).toBe('');
    });

    it('debería cambiar de reserva expandida', async () => {
      await crear();

      componente.toggleTimeline('r1');
      componente.toggleTimeline('r2');

      expect(componente.expandidoId()).toBe('r2');
    });
  });

  describe('cambio de estado', () => {
    it('debería cambiar el estado y reflejarlo en la fila', async () => {
      await crear();

      await componente.cambiar(reserva(), ReservaEstado.CANCELADA);

      expect(api['cambiarEstadoReserva']).toHaveBeenCalledWith('r1', ReservaEstado.CANCELADA, undefined);
      expect(componente.reservas()[0].estado).toBe(ReservaEstado.CANCELADA);
      expect(componente.okMsg()).toContain('RES-AAAA1111');
      expect(componente.accionandoId()).toBe('');
    });

    it('debería registrar el cambio en el historial de la reserva', async () => {
      await crear();

      await componente.cambiar(reserva(), ReservaEstado.CANCELADA, 'Cliente no se presentó');

      const historial = componente.reservas()[0].historialEstados!;
      expect(historial.at(-1)).toMatchObject({
        estado: ReservaEstado.CANCELADA, motivo: 'Cliente no se presentó', por: 'admin',
      });
    });

    it('debería informar si el cambio falla', async () => {
      await crear();
      api['cambiarEstadoReserva'] = fallo('500');

      await componente.cambiar(reserva(), ReservaEstado.CANCELADA);

      expect(componente.errorMsg()).toContain('No se pudo cambiar');
      expect(componente.accionandoId()).toBe('');
    });
  });

  describe('estados que exigen motivo', () => {
    it('debería abrir el modal sin ejecutar nada todavía', async () => {
      await crear();

      componente.pedirMotivo(reserva(), 'disputa');

      expect(componente.modalReserva()?._id).toBe('r1');
      expect(componente.modalEstado()).toBe('disputa');
      expect(api['cambiarEstadoReserva']).not.toHaveBeenCalled();
    });

    it('debería aplicar el estado con el motivo escrito', async () => {
      await crear();
      componente.pedirMotivo(reserva(), 'disputa');
      componente.modalMotivo = '  Cargo duplicado ';

      await componente.confirmarMotivo();

      expect(api['cambiarEstadoReserva']).toHaveBeenCalledWith('r1', 'disputa', 'Cargo duplicado');
      expect(componente.modalReserva()).toBeNull();
    });

    it('debería permitir confirmar sin motivo', async () => {
      await crear();
      componente.pedirMotivo(reserva(), 'disputa');

      await componente.confirmarMotivo();

      expect(api['cambiarEstadoReserva']).toHaveBeenCalledWith('r1', 'disputa', undefined);
    });

    it('debería cancelar el modal sin tocar la reserva', async () => {
      await crear();
      componente.pedirMotivo(reserva(), 'disputa');

      componente.cerrarModal();
      await componente.confirmarMotivo();

      expect(api['cambiarEstadoReserva']).not.toHaveBeenCalled();
    });

    it('debería vaciar el motivo anterior al reabrir', async () => {
      await crear();
      componente.pedirMotivo(reserva(), 'disputa');
      componente.modalMotivo = 'Antiguo';

      componente.pedirMotivo(reserva(), 'reembolso');

      // Arrastrar el motivo anterior lo dejaría escrito en la reserva equivocada.
      expect(componente.modalMotivo).toBe('');
    });
  });

  describe('etiquetas de estado', () => {
    it('debería describir los estados conocidos', async () => {
      await crear();

      expect(componente.meta(ReservaEstado.CONFIRMADA).label).toBeTruthy();
      expect(componente.meta(ReservaEstado.CONFIRMADA).badge).toContain('rs-badge--');
    });

    it('debería mostrar tal cual un estado desconocido', async () => {
      await crear();

      expect(componente.meta('inventado')).toMatchObject({ label: 'inventado', badge: 'rs-badge--neutral' });
    });
  });
  describe('filtros avanzados', () => {
    it('no deberia contar ninguno al arrancar', async () => {
      await crear();

      expect(componente.filtrosAvanzadosActivos()).toBe(0);
    });

    it('deberia enviar solo los filtros que el admin ha rellenado', async () => {
      await crear();
      componente.fDesde = '2026-08-01';
      componente.fCiudad = '  Valencia  ';
      componente.fImporteMin = 50;

      await componente.aplicarFiltrosAvanzados();

      const [, filtros] = api['getReservas'].mock.calls.at(-1)!;
      expect(filtros).toMatchObject({ fechaDesde: '2026-08-01', ciudad: 'Valencia', importeMin: 50 });
      expect(filtros.fechaHasta).toBeUndefined();
      expect(filtros.importeMax).toBeUndefined();
    });

    it('deberia contar cuantos filtros avanzados hay puestos', async () => {
      await crear();
      componente.fDesde = '2026-08-01';
      componente.fVertical = 'alojamiento';

      await componente.aplicarFiltrosAvanzados();

      expect(componente.filtrosAvanzadosActivos()).toBe(2);
    });

    it('deberia volver a la primera pagina al filtrar', async () => {
      // Quedarse en la pagina 5 de un filtro nuevo mostraria una tabla vacia.
      await crear();
      componente.paginaActual.set(5);

      await componente.aplicarFiltrosAvanzados();

      expect(componente.paginaActual()).toBe(1);
    });

    it('deberia dejar los campos en blanco al limpiar', async () => {
      await crear();
      componente.fDesde = '2026-08-01';
      componente.fCiudad = 'Valencia';
      componente.fImporteMin = 50;
      await componente.aplicarFiltrosAvanzados();

      await componente.limpiarFiltrosAvanzados();

      expect(componente.fDesde).toBe('');
      expect(componente.fCiudad).toBe('');
      expect(componente.fImporteMin).toBeNull();
      expect(componente.filtrosAvanzadosActivos()).toBe(0);
    });

    it('deberia admitir importe minimo cero como filtro real', async () => {
      await crear();
      componente.fImporteMin = 0;

      await componente.aplicarFiltrosAvanzados();

      const [, filtros] = api['getReservas'].mock.calls.at(-1)!;
      expect(filtros.importeMin).toBe(0);
    });
  });

  describe('etiquetas de estado de pago', () => {
    it('deberia tratar la ausencia de pago como "sin pago"', async () => {
      await crear();

      expect(componente.badgePago(undefined)).toBeTruthy();
      expect(componente.labelPago(undefined)).not.toBe('—');
    });

    it('deberia caer a neutral y al propio valor si el estado es desconocido', async () => {
      await crear();

      expect(componente.badgePago('inventado')).toContain('neutral');
      expect(componente.labelPago('inventado')).toBe('inventado');
    });
  });

  describe('politica de cancelacion', () => {
    it('deberia avisar cuando el comercio no la declaro', async () => {
      await crear();

      expect(componente.politica(reserva())).toContain('Sin política');
    });

    it('deberia dejar el valor en crudo si no tiene etiqueta conocida', async () => {
      await crear();

      expect(componente.politica(reserva({ politicaCancelacion: 'a-medida' } as never))).toBe('a-medida');
    });
  });

  describe('contadores del resumen', () => {
    it('deberia devolver 0 si el resumen no cargo', async () => {
      await crear();
      componente.resumen.set(null);

      expect(componente.contarEstado('confirmada')).toBe(0);
    });

    it('deberia usar el total para el filtro "todos"', async () => {
      await crear();
      componente.resumen.set({ total: 42, porEstado: { confirmada: 10 } } as never);

      expect(componente.contarEstado('')).toBe(42);
      expect(componente.contarEstado('confirmada')).toBe(10);
      expect(componente.contarEstado('inexistente')).toBe(0);
    });
  });

  it('deberia cerrar el menu de acciones al pulsar fuera', async () => {
    await crear();
    componente.menuAbiertoId.set('r1');

    componente.cerrarMenu();

    expect(componente.menuAbiertoId()).toBeNull();
  });

  describe('exportacion a CSV', () => {
    it('deberia pedir todas las paginas del filtro actual, no solo la visible', async () => {
      // Exportar solo la pagina daria un fichero que no cuadra con los totales.
      await crear();
      componente.filtroEstado.set(ReservaEstado.CONFIRMADA);

      await componente.exportarCsv();

      const [pagina, , limite] = api['getReservas'].mock.calls.at(-1)!;
      expect(pagina).toBe(1);
      expect(limite).toBeGreaterThan(100);
      expect(componente.exportando()).toBe(false);
    });

    it('deberia avisar si la exportacion falla', async () => {
      await crear([reserva()], 1, { getReservas: fallo('500') });

      await componente.exportarCsv();

      expect(componente.errorMsg()).toContain('No se pudo exportar');
      expect(componente.exportando()).toBe(false);
    });
  });
});
