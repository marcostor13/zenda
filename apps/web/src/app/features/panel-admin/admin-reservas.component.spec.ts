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
});
