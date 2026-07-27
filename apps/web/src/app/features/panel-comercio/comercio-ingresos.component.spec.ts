import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { RouterTestingModule } from '@angular/router/testing';
import { of, throwError } from 'rxjs';
import { ReservaEstado, VerticalKey } from 'shared';
import { ComercioIngresosComponent } from './comercio-ingresos.component';
import { ComercioApiService, FinanzasComercio, MiReserva } from './comercio-api.service';

const miReserva = (extra: Partial<MiReserva> = {}): MiReserva => ({
  _id: 'r1', codigo: 'RES-AAAA1111', vertical: VerticalKey.ALOJAMIENTO,
  estado: ReservaEstado.CONFIRMADA, montoTotal: 100, moneda: 'EUR',
  fechaInicio: '2026-09-01T00:00:00.000Z', createdAt: '2026-07-01T00:00:00.000Z',
  ...extra,
} as MiReserva);

/** Fallo síncrono: una promesa rechazada la reporta zone.js como error global. */
const fallo = (mensaje: string) => jest.fn(() => { throw new Error(mensaje); });

describe('ComercioIngresosComponent', () => {
  let fixture: ComponentFixture<ComercioIngresosComponent>;
  let componente: ComercioIngresosComponent;
  let api: Record<string, jest.Mock>;

  const crear = async (
    reservas: MiReserva[] = [],
    finanzas: FinanzasComercio | null = null,
    ajustes: Record<string, jest.Mock> = {},
  ): Promise<void> => {
    api = {
      getMisReservas: jest.fn().mockReturnValue(of(reservas)),
      getMisFinanzas: jest.fn().mockReturnValue(finanzas ? of(finanzas) : throwError(() => new Error('404'))),
      ...ajustes,
    };

    await TestBed.configureTestingModule({
      imports: [ComercioIngresosComponent, RouterTestingModule],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: ComercioApiService, useValue: api },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(ComercioIngresosComponent);
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
    it('debería traer reservas y finanzas', async () => {
      await crear([miReserva()], { facturacionBruta: 100 } as FinanzasComercio);

      expect(componente.reservas()).toHaveLength(1);
      expect(componente.finanzas()).not.toBeNull();
      expect(componente.cargando()).toBe(false);
    });

    it('debería seguir funcionando sin el resumen financiero del backend', async () => {
      await crear([miReserva()]);

      expect(componente.finanzas()).toBeNull();
      expect(componente.reservas()).toHaveLength(1);
      expect(componente.errorMsg()).toBe('');
    });

    it('debería avisar si no puede cargar las reservas', async () => {
      await crear([], null, { getMisReservas: fallo('500') });

      expect(componente.errorMsg()).toContain('Error al cargar los datos financieros');
      expect(componente.cargando()).toBe(false);
    });

    it('debería mostrar como mucho diez reservas recientes', async () => {
      await crear(Array.from({ length: 14 }, (_, i) => miReserva({ _id: `r${i}` })));

      expect(componente.reservasRecientes()).toHaveLength(10);
    });

    it('debería contar las reservas completadas', async () => {
      await crear([miReserva(), miReserva({ _id: 'r2', estado: ReservaEstado.COMPLETADA })]);

      expect(componente.reservasCompletadas()).toBe(1);
    });
  });

  describe('cifras del backend', () => {
    it('debería preferir siempre las cifras reales', async () => {
      await crear([miReserva({ montoTotal: 1000 })], {
        facturacionBruta: 900, comisionPlataforma: 120, stripeFee: 20,
        reembolsos: 50, proximaLiquidacion: 700, liquidacion: 710,
      } as FinanzasComercio);

      // El front estima solo mientras el backend no responde: sus números mandan.
      expect(componente.totalIngresos()).toBe(900);
      expect(componente.comisionEstimada()).toBe(120);
      expect(componente.feeStripeTotal()).toBe(20);
      expect(componente.reembolsos()).toBe(50);
      expect(componente.proximaLiquidacion()).toBe(700);
      expect(componente.liquidacionEstimada()).toBe(710);
    });
  });

  describe('estimación propia', () => {
    it('debería estimar sobre las reservas cuando no hay finanzas', async () => {
      await crear([miReserva({ montoTotal: 100 }), miReserva({ _id: 'r2', montoTotal: 100 })]);

      expect(componente.totalIngresos()).toBe(200);
      expect(componente.comisionEstimada()).toBeCloseTo(30, 2);
      // 1,5% del bruto + 0,25 € por cada una de las dos reservas.
      expect(componente.feeStripeTotal()).toBeCloseTo(3.5, 2);
      expect(componente.liquidacionEstimada()).toBeCloseTo(166.5, 2);
    });

    it('no debería cobrar comisiones fijas sin ninguna reserva', async () => {
      await crear([]);

      expect(componente.feeStripeTotal()).toBe(0);
      expect(componente.liquidacionEstimada()).toBe(0);
      expect(componente.reembolsos()).toBe(0);
    });

    it('debería desglosar cada reserva por separado', async () => {
      await crear();
      const r = miReserva({ montoTotal: 100 });

      expect(componente.comisionReserva(r)).toBeCloseTo(15, 2);
      expect(componente.feeStripeReserva(r)).toBeCloseTo(1.75, 2);
      expect(componente.liquidacionReserva(r)).toBeCloseTo(83.25, 2);
    });
  });

  describe('etiquetas', () => {
    it('debería dar un badge por estado con respaldo neutro', async () => {
      await crear();

      expect(componente.badgeEstado(ReservaEstado.CONFIRMADA)).toContain('rs-badge--');
      expect(componente.badgeEstado('inventado')).toContain('neutral');
    });
  });
});
