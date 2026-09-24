import { Component, input } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ReservaEstado, VerticalKey } from 'shared';
import { PuntoMapa, RsMapaComponent } from '../../../../shared/components/mapa/rs-mapa.component';
import { ReservaApi } from '../../../reservas/services/reservas.service';
import { TransporteViajeApi } from '../transporte-viaje.api';
import { SeguimientoViajeComponent } from './seguimiento-viaje.component';

/** Leaflet no sobrevive en jsdom: el mapa real se prueba en su propio spec. */
@Component({ selector: 'rs-mapa', standalone: true, template: '' })
class RsMapaStubComponent {
  readonly puntos = input<PuntoMapa[]>([]);
  readonly ruta = input<ReadonlyArray<{ lat: number; lng: number }>>([]);
  readonly ariaLabel = input('');
}

const reserva = (extra: Partial<ReservaApi> = {}): ReservaApi => ({
  _id: 'r1', codigo: 'RES-T1', vertical: VerticalKey.TRANSPORTE, servicioId: 's1', comercioId: 'c1',
  montoSubtotal: 66, comisionMonto: 10, descuentoMonto: 0, montoTotal: 80, moneda: 'EUR',
  fechaInicio: '2026-10-01T08:00:00.000Z', cantidad: 1, estado: ReservaEstado.CONFIRMADA,
  createdAt: '2026-09-20T00:00:00.000Z',
  ...extra,
});

describe('SeguimientoViajeComponent', () => {
  let fixture: ComponentFixture<SeguimientoViajeComponent>;
  let componente: SeguimientoViajeComponent;
  let api: jest.Mocked<Pick<TransporteViajeApi, 'contacto' | 'ubicacion'>>;

  const crear = async (datos: ReservaApi = reserva()): Promise<void> => {
    await TestBed.configureTestingModule({
      imports: [SeguimientoViajeComponent],
      providers: [{ provide: TransporteViajeApi, useValue: api }],
    })
      .overrideComponent(SeguimientoViajeComponent, {
        remove: { imports: [RsMapaComponent] },
        add: { imports: [RsMapaStubComponent] },
      })
      .compileComponents();
    fixture = TestBed.createComponent(SeguimientoViajeComponent);
    componente = fixture.componentInstance;
    fixture.componentRef.setInput('reserva', datos);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  };

  beforeEach(() => {
    api = {
      contacto: jest.fn().mockResolvedValue({ nombre: 'Ana', telefono: '+34 600 11 22 33', whatsapp: '+34 600112233' }),
      ubicacion: jest.fn().mockResolvedValue({
        compartiendo: true, rastro: [{ lat: 40, lng: -3 }],
        posicion: { lat: 40.1, lng: -3.1, at: '2026-10-01T08:10:00.000Z' },
        origen: { lat: 40, lng: -3 }, destino: { lat: 39, lng: -4 },
      }),
    };
  });

  afterEach(() => {
    fixture?.destroy();
    jest.useRealTimers();
  });

  describe('pasos del viaje', () => {
    it('debería marcar la reserva confirmada y el primer hito sin marcar como actual', async () => {
      await crear();

      const pasos = componente.pasos();
      expect(pasos.map((p) => p.clave)).toEqual(['confirmada', 'asignado', 'de_camino', 'recogida', 'en_trayecto', 'entregada']);
      expect(pasos[0].estado).toBe('hecho');
      expect(pasos[1].estado).toBe('actual');
      expect(pasos.slice(2).every((p) => p.estado === 'pendiente')).toBe(true);
    });

    it('debería dar por hechos los hitos marcados, con su hora, nota y foto, entendiendo en_ruta', async () => {
      await crear(reserva({
        estado: ReservaEstado.EN_CURSO,
        seguimiento: [
          { hito: 'asignado', at: '2026-10-01T07:00:00.000Z' },
          { hito: 'de_camino', at: '2026-10-01T07:30:00.000Z' },
          { hito: 'recogida', at: '2026-10-01T08:00:00.000Z', nota: 'Tranquilo', fotoUrl: 'https://f/r.jpg' },
          { hito: 'en_ruta', at: '2026-10-01T08:05:00.000Z' },
        ],
      } as Partial<ReservaApi>));

      const pasos = componente.pasos();
      expect(pasos.find((p) => p.clave === 'recogida')).toEqual(expect.objectContaining({
        estado: 'hecho', nota: 'Tranquilo', fotoUrl: 'https://f/r.jpg',
      }));
      expect(pasos.find((p) => p.clave === 'en_trayecto')?.estado).toBe('hecho');
      expect(pasos.find((p) => p.clave === 'entregada')?.estado).toBe('actual');
    });

    it('debería dejar la confirmación en curso mientras la reserva está pendiente de pago', async () => {
      await crear(reserva({ estado: ReservaEstado.PENDIENTE }));

      expect(componente.pasos()[0].estado).toBe('actual');
      expect(componente.pasos().slice(1).every((p) => p.estado === 'pendiente')).toBe(true);
      expect(api.contacto).not.toHaveBeenCalled();
    });
  });

  describe('aceptación pendiente', () => {
    it('debería avisar de que el transportista aún no acepta y no ofrecer el mapa', async () => {
      await crear(reserva({
        aceptacion: { requerida: true, estado: 'pendiente', plazoMin: 30, venceEn: '2026-10-01T07:30:00.000Z' },
      } as Partial<ReservaApi>));

      expect(fixture.nativeElement.querySelector('.sv__aceptacion')).not.toBeNull();
      expect(componente.puedeSeguir()).toBe(false);
      expect(fixture.nativeElement.querySelector('.rs-btn--primary')).toBeNull();
    });
  });

  describe('contacto', () => {
    it('debería cargar el contacto y ofrecer llamar y WhatsApp sólo con dígitos', async () => {
      await crear();

      expect(api.contacto).toHaveBeenCalledWith('r1');
      const enlaces = Array.from(fixture.nativeElement.querySelectorAll('.sv__contacto a')) as HTMLAnchorElement[];
      expect(enlaces.map((a) => a.getAttribute('href'))).toEqual(['tel:34600112233', 'https://wa.me/34600112233']);
    });

    it('debería cargar el contacto también de un viaje completado', async () => {
      await crear(reserva({ estado: ReservaEstado.COMPLETADA }));
      expect(api.contacto).toHaveBeenCalled();
      expect(componente.puedeSeguir()).toBe(false);
    });

    it('no debería romper si el contacto no se puede cargar', async () => {
      api.contacto.mockRejectedValue(new Error('403'));
      await crear();
      expect(componente.contacto()).toBeNull();
    });

    it('no debería pedir contacto sin id de reserva', async () => {
      await crear(reserva({ _id: undefined, id: undefined }));
      expect(api.contacto).not.toHaveBeenCalled();
    });
  });

  describe('mapa en vivo', () => {
    it('debería consultar la ubicación al abrir el mapa y cada 10 segundos', async () => {
      await crear();
      jest.useFakeTimers();

      componente.abrirMapa();
      await Promise.resolve();
      expect(api.ubicacion).toHaveBeenCalledTimes(1);

      await jest.advanceTimersByTimeAsync(10_000);
      expect(api.ubicacion).toHaveBeenCalledTimes(2);

      fixture.detectChanges();
      expect(componente.puntosMapa().map((p) => p.id)).toEqual(['origen', 'destino', 'vehiculo']);
      expect(fixture.nativeElement.querySelector('.sv__vivo')).not.toBeNull();
    });

    it('debería dejar de consultar al destruir la pantalla', async () => {
      await crear();
      jest.useFakeTimers();
      componente.abrirMapa();
      await Promise.resolve();

      fixture.destroy();
      await jest.advanceTimersByTimeAsync(30_000);

      expect(api.ubicacion).toHaveBeenCalledTimes(1);
    });

    it('debería dejar de consultar si la consulta falla', async () => {
      api.ubicacion.mockRejectedValue(new Error('500'));
      await crear();
      jest.useFakeTimers();

      componente.abrirMapa();
      await jest.advanceTimersByTimeAsync(30_000);

      expect(api.ubicacion).toHaveBeenCalledTimes(1);
    });

    it('debería dejar de consultar cuando ya no se puede seguir el viaje', async () => {
      await crear();
      jest.useFakeTimers();
      componente.abrirMapa();
      await Promise.resolve();

      fixture.componentRef.setInput('reserva', reserva({ seguimiento: [{ hito: 'entregada', at: 'x' }] } as Partial<ReservaApi>));
      await jest.advanceTimersByTimeAsync(10_000);
      await jest.advanceTimersByTimeAsync(30_000);

      expect(api.ubicacion).toHaveBeenCalledTimes(2);
    });

    it('debería avisar si el transportista aún no comparte la ubicación', async () => {
      api.ubicacion.mockResolvedValue({ compartiendo: false, rastro: [] });
      await crear();

      componente.abrirMapa();
      await fixture.whenStable();
      fixture.detectChanges();

      expect(componente.puntosMapa()).toEqual([]);
      expect(fixture.nativeElement.querySelector('.sv__estado-mapa').textContent).toContain('todavía no comparte');
    });
  });
});
