import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { RouterTestingModule } from '@angular/router/testing';
import { signal } from '@angular/core';
import { of, throwError } from 'rxjs';
import { ReservaEstado, VerticalKey } from 'shared';
import { PanelComercioDashboardComponent } from './panel-comercio-dashboard.component';
import { ComercioApiService, MiComercio, MiReserva, MiServicio } from './comercio-api.service';
import { AuthService } from '../../core/auth/auth.service';

const miReserva = (extra: Partial<MiReserva> = {}): MiReserva => ({
  _id: 'r1', codigo: 'RES-AAAA1111', vertical: VerticalKey.ALOJAMIENTO,
  estado: ReservaEstado.CONFIRMADA, montoTotal: 100, moneda: 'EUR',
  fechaInicio: '2026-09-01T00:00:00.000Z',
  ...extra,
} as MiReserva);

const miServicio = (extra: Partial<MiServicio> = {}): MiServicio => ({
  _id: 's1', titulo: 'Residencia Royal', vertical: VerticalKey.ALOJAMIENTO,
  estado: 'publicado', precioBase: 45,
  ...extra,
} as MiServicio);

/** Fallo síncrono: una promesa rechazada la reporta zone.js como error global. */
const fallo = (mensaje: string) => jest.fn(() => { throw new Error(mensaje); });

describe('PanelComercioDashboardComponent', () => {
  let fixture: ComponentFixture<PanelComercioDashboardComponent>;
  let componente: PanelComercioDashboardComponent;
  let api: Record<string, jest.Mock>;

  const crear = async (
    datos: { reservas?: MiReserva[]; servicios?: MiServicio[]; comercio?: MiComercio | null } = {},
    ajustes: Record<string, jest.Mock> = {},
  ): Promise<void> => {
    api = {
      getMisReservas: jest.fn().mockReturnValue(of(datos.reservas ?? [])),
      getMisServicios: jest.fn().mockReturnValue(of(datos.servicios ?? [])),
      getMiComercio: jest.fn().mockReturnValue(of(datos.comercio ?? null)),
      cambiarEstadoServicio: jest.fn().mockReturnValue(of(miServicio({ estado: 'pausado' }))),
      ...ajustes,
    };

    await TestBed.configureTestingModule({
      imports: [PanelComercioDashboardComponent, RouterTestingModule],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: ComercioApiService, useValue: api },
        { provide: AuthService, useValue: { usuario: signal({ nombre: 'Canes' }) } },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(PanelComercioDashboardComponent);
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
    it('debería traer reservas, servicios y el comercio', async () => {
      await crear({ reservas: [miReserva()], servicios: [miServicio()], comercio: { vatNumber: 'ESB1' } as MiComercio });

      expect(componente.reservas()).toHaveLength(1);
      expect(componente.servicios()).toHaveLength(1);
      expect(componente.comercio()).not.toBeNull();
      expect(componente.cargando()).toBe(false);
    });

    it('debería seguir mostrando el panel aunque falte la ficha del comercio', async () => {
      await crear({ reservas: [miReserva()] }, {
        getMiComercio: jest.fn().mockReturnValue(throwError(() => new Error('403'))),
      });

      // El perfil es secundario: sin él el comercio debe seguir viendo sus reservas.
      expect(componente.reservas()).toHaveLength(1);
      expect(componente.comercio()).toBeNull();
      expect(componente.errorMsg()).toBe('');
    });

    it('debería avisar si no puede cargar lo esencial', async () => {
      await crear({}, { getMisReservas: fallo('500') });

      expect(componente.errorMsg()).toContain('Error al cargar');
      expect(componente.cargando()).toBe(false);
    });

    it('debería saludar con el nombre del comercio', async () => {
      await crear();

      expect(componente.nombreComercio()).toBe('Canes');
    });
  });

  describe('métricas', () => {
    it('debería contar solo las reservas confirmadas', async () => {
      await crear({
        reservas: [
          miReserva(),
          miReserva({ _id: 'r2', estado: ReservaEstado.CANCELADA }),
          miReserva({ _id: 'r3', estado: ReservaEstado.CONFIRMADA }),
        ],
      });

      expect(componente.reservasConfirmadas()).toBe(2);
    });

    it('debería sumar los ingresos de todas las reservas', async () => {
      await crear({ reservas: [miReserva({ montoTotal: 100 }), miReserva({ _id: 'r2', montoTotal: 50 })] });

      expect(componente.totalIngresos()).toBe(150);
    });

    it('debería mostrar solo las cinco reservas más recientes', async () => {
      const muchas = Array.from({ length: 8 }, (_, i) => miReserva({ _id: `r${i}` }));
      await crear({ reservas: muchas });

      expect(componente.reservasRecientes()).toHaveLength(5);
    });

    it('debería contar los servicios publicados', async () => {
      await crear({
        servicios: [miServicio(), miServicio({ _id: 's2', estado: 'pausado' }), miServicio({ _id: 's3' })],
      });

      expect(componente.serviciosActivos()).toBe(2);
    });

    it('debería promediar la valoración de los servicios puntuados', async () => {
      await crear({
        servicios: [
          miServicio({ ratingPromedio: 4 }),
          miServicio({ _id: 's2', ratingPromedio: 5 }),
          miServicio({ _id: 's3' }),
        ],
      });

      expect(componente.ratingPromedio()).toBe('4.5');
    });

    it('no debería inventar una valoración sin reseñas', async () => {
      await crear({ servicios: [miServicio()] });

      expect(componente.ratingPromedio()).toBeNull();
    });
  });

  describe('liquidación estimada', () => {
    it('debería descontar comisión y comisión de Stripe', async () => {
      await crear({ reservas: [miReserva({ montoTotal: 1000 })] });

      expect(componente.comisionEstimada()).toBe(150);
      expect(componente.feeStripe()).toBeCloseTo(15.25, 2);
      expect(componente.liquidacion()).toBeCloseTo(834.75, 2);
    });

    it('no debería cobrar el fijo de Stripe sin facturación', async () => {
      await crear();

      // Con cero reservas el fijo dejaría la liquidación en -0,25 €.
      expect(componente.feeStripe()).toBe(0);
      expect(componente.liquidacion()).toBe(0);
    });
  });

  describe('checklist de alta', () => {
    it('debería marcar como pendiente todo lo que falta', async () => {
      await crear();

      expect(componente.pasosHechos()).toBe(0);
      expect(componente.pasosPendientes()).toBe(3);
      expect(componente.progresoPct()).toBe(0);
    });

    it('debería reconocer los datos ya completados', async () => {
      await crear({
        servicios: [miServicio()],
        comercio: {
          vatNumber: 'ESB12345678',
          datosBancarios: { iban: 'ES76' },
        } as MiComercio,
      });

      expect(componente.pasosHechos()).toBe(3);
      expect(componente.progresoPct()).toBe(100);
    });

    it('no debería dar por publicado un listado en borrador', async () => {
      await crear({ servicios: [miServicio({ estado: 'borrador' })] });

      const listado = componente.pasosOnboarding().find((p) => p.clave === 'listado')!;
      expect(listado.hecho).toBe(false);
    });
  });

  describe('publicar y pausar', () => {
    it('debería pausar un servicio publicado', async () => {
      await crear({ servicios: [miServicio({ estado: 'publicado' })] });

      await componente.toggleServicio(miServicio({ estado: 'publicado' }));

      expect(api['cambiarEstadoServicio']).toHaveBeenCalledWith('s1', 'pausado');
      expect(componente.servicios()[0].estado).toBe('pausado');
    });

    it('debería publicar un servicio pausado', async () => {
      await crear({ servicios: [miServicio({ estado: 'pausado' })] });
      api['cambiarEstadoServicio'].mockReturnValue(of(miServicio({ estado: 'publicado' })));

      await componente.toggleServicio(miServicio({ estado: 'pausado' }));

      expect(api['cambiarEstadoServicio']).toHaveBeenCalledWith('s1', 'publicado');
    });

    it('debería avisar si el cambio de estado falla', async () => {
      await crear({ servicios: [miServicio()] });
      api['cambiarEstadoServicio'] = fallo('500');

      await componente.toggleServicio(miServicio());

      expect(componente.errorMsg()).toContain('Error al cambiar el estado');
    });
  });

  describe('etiquetas', () => {
    it('debería distinguir los estados del servicio', async () => {
      await crear();

      expect(componente.estadoServicioBadge('publicado')).toContain('success');
      expect(componente.estadoServicioBadge('pausado')).toContain('warning');
      expect(componente.estadoServicioBadge('borrador')).toContain('neutral');
    });

    it('debería dar un badge por estado de reserva', async () => {
      await crear();

      expect(componente.badgeEstado(ReservaEstado.CONFIRMADA)).toContain('rs-badge--');
      expect(componente.badgeEstado('inventado')).toContain('neutral');
    });

    it('debería dar un icono por vertical', async () => {
      await crear();

      expect(componente.iconVertical(VerticalKey.ALOJAMIENTO)).toBeTruthy();
    });
  });
});
