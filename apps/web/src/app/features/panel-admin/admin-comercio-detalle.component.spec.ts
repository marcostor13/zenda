import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { ActivatedRoute, Router } from '@angular/router';
import { RouterTestingModule } from '@angular/router/testing';
import { of, throwError } from 'rxjs';
import { DetalleComercioDto, ReservaEstado, VerticalKey } from 'shared';
import { AdminComercioDetalleComponent } from './admin-comercio-detalle.component';
import { AdminApiService, ReservaAdmin } from './admin-api.service';

const MESES = [
  '2025-04', '2025-05', '2025-06', '2025-07', '2025-08', '2025-09',
  '2025-10', '2025-11', '2025-12', '2026-01', '2026-02', '2026-03',
];

const detalle = (extra: Partial<DetalleComercioDto> = {}): DetalleComercioDto => ({
  comercio: {
    _id: 'c1', nombreComercial: 'Canina Real', razonSocial: 'Canina Real SL', vatNumber: 'ESB12345678',
    verticales: [VerticalKey.ALOJAMIENTO], plan: 'pro', estado: 'activo', modoLiquidacion: 'merchant',
    socioFundador: false, alphaAdherido: false, altaCompletada: true,
    datosBancarios: { titular: 'Canina Real SL', iban: 'ES91••••••••••••••••1332' },
    createdAt: '2026-01-01T00:00:00.000Z',
  },
  comisiones: [
    { vertical: VerticalKey.ALOJAMIENTO, comisionPct: 0.15, origen: 'vertical', stripePct: 0.015, stripeFijoEur: 0.25 },
  ],
  metricas: {
    servicios: { total: 2, publicados: 1, borradores: 1, pausados: 0, destacados: 1 },
    reservas: { total: 5, porEstado: { confirmada: 3, cancelada: 2 }, activas: 3, ultimos30Dias: 4, proximas: 1 },
    economia: { gmv: 1000, comision: 150, stripeFee: 30, liquidacion: 820, ticketMedio: 250, pagosAprobados: 4, reembolsado: 0 },
    resenas: { media: 4.5, total: 4, distribucion: { '5': 3, '4': 1 }, sinResponder: 1 },
    incidencias: { total: 2, abiertas: 1 },
    equipo: { total: 2, porRol: { comercio_admin: 1, comercio_staff: 1 } },
    porVertical: [{ vertical: VerticalKey.ALOJAMIENTO, servicios: 2, reservas: 5, gmv: 1000, comision: 150 }],
    mensual: MESES.map((mes) => ({ mes, reservas: mes === '2026-03' ? 5 : 0, gmv: mes === '2026-03' ? 1000 : 0, comision: 0 })),
  },
  servicios: [
    {
      _id: 'srv-1', titulo: 'Suite Royal', vertical: VerticalKey.ALOJAMIENTO, estado: 'publicado',
      destacado: true, precioBase: 42, moneda: 'EUR', ciudad: 'Valencia', ratingPromedio: 4.5,
      totalResenas: 4, reservas: 5, gmv: 1000,
    },
  ],
  reservas: [],
  equipo: [{ _id: 'u1', nombre: 'Ana', email: 'ana@canina.es', rol: 'comercio_admin', verificado: true }],
  resenas: [],
  incidencias: [],
  ...extra,
});

const reserva = (extra: Partial<ReservaAdmin> = {}): ReservaAdmin => ({
  _id: 'r1', codigo: 'RES-AAAA1111', vertical: VerticalKey.ALOJAMIENTO, estado: ReservaEstado.CONFIRMADA,
  montoTotal: 121, comisionMonto: 15, cliente: 'Ana', comercio: 'Canina Real',
  createdAt: '2026-03-01T00:00:00.000Z',
  ...extra,
} as ReservaAdmin);

describe('AdminComercioDetalleComponent', () => {
  let fixture: ComponentFixture<AdminComercioDetalleComponent>;
  let componente: AdminComercioDetalleComponent;
  let api: Record<string, jest.Mock>;

  const crear = async (ajustes: Record<string, jest.Mock> = {}): Promise<void> => {
    api = {
      getDetalleComercio: jest.fn().mockReturnValue(of(detalle())),
      getReservas: jest.fn().mockReturnValue(of({ items: [reserva()], total: 1 })),
      aprobarComercio: jest.fn().mockReturnValue(of({})),
      rechazarComercio: jest.fn().mockReturnValue(of({})),
      restaurarComercio: jest.fn().mockReturnValue(of({})),
      fijarAlphaAdherido: jest.fn().mockReturnValue(of({})),
      ...ajustes,
    };

    await TestBed.configureTestingModule({
      imports: [AdminComercioDetalleComponent, RouterTestingModule],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: AdminApiService, useValue: api },
        {
          provide: ActivatedRoute,
          useValue: {
            snapshot: {
              paramMap: { get: () => 'c1' },
              queryParamMap: { get: () => null },
            },
          },
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(AdminComercioDetalleComponent);
    componente = fixture.componentInstance;
    // La navegación de las pestañas sólo reescribe la URL: en la prueba estorba.
    jest.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  };

  afterEach(() => {
    fixture?.destroy();
    jest.clearAllMocks();
  });

  describe('carga', () => {
    it('debería pedir la ficha del comercio de la ruta', async () => {
      await crear();

      expect(api['getDetalleComercio']).toHaveBeenCalledWith('c1');
      expect(componente.detalle()?.comercio.nombreComercial).toBe('Canina Real');
      expect(componente.cargando()).toBe(false);
    });

    it('debería pintar el nombre, el estado y los KPIs', async () => {
      await crear();
      const texto = fixture.nativeElement.textContent as string;

      expect(texto).toContain('Canina Real');
      expect(texto).toContain('Activo');
      expect(texto).toContain('Comisión Doogking');
    });

    it('debería decir que el comercio no existe ante un 404', async () => {
      await crear({
        getDetalleComercio: jest.fn().mockReturnValue(throwError(() => ({ status: 404 }))),
      });

      expect(componente.errorMsg()).toContain('ya no existe');
    });

    it('debería distinguir un API inalcanzable de un fallo del servidor', async () => {
      await crear({
        getDetalleComercio: jest.fn().mockReturnValue(throwError(() => ({ status: 0 }))),
      });

      expect(componente.errorMsg()).toContain('API');
    });
  });

  describe('pestañas', () => {
    it('debería empezar en el resumen y contar lo que tiene cada pestaña', async () => {
      await crear();

      expect(componente.pestana()).toBe('resumen');
      expect(componente.contador('servicios')).toBe(2);
      expect(componente.contador('reservas')).toBe(5);
      expect(componente.contador('equipo')).toBe(2);
      expect(componente.contador('resumen')).toBeNull();
    });

    it('debería pedir las reservas del comercio al abrir su pestaña', async () => {
      await crear();

      await componente.irA('reservas');

      expect(api['getReservas']).toHaveBeenCalledWith(1, expect.objectContaining({ comercioId: 'c1' }), 10);
      expect(componente.reservas()).toHaveLength(1);
    });

    it('no debería volver a pedir las reservas al regresar a la pestaña', async () => {
      await crear();
      await componente.irA('reservas');
      await componente.irA('resumen');

      await componente.irA('reservas');

      expect(api['getReservas']).toHaveBeenCalledTimes(1);
    });
  });

  describe('reservas', () => {
    it('debería filtrar por estado volviendo a la primera página', async () => {
      await crear();
      await componente.irA('reservas');
      await componente.cambiarPagina(2);

      await componente.filtrarPorEstado('cancelada');

      expect(componente.pagina()).toBe(1);
      expect(api['getReservas']).toHaveBeenLastCalledWith(1, expect.objectContaining({ estado: 'cancelada' }), 10);
    });

    it('debería enseñar sólo las reservas del servicio elegido en el catálogo', async () => {
      await crear();

      await componente.verReservasDe(componente.detalle()!.servicios[0]);

      expect(componente.pestana()).toBe('reservas');
      expect(componente.servicioFiltrado()?.titulo).toBe('Suite Royal');
      expect(api['getReservas']).toHaveBeenLastCalledWith(1, expect.objectContaining({ servicioId: 'srv-1' }), 10);
    });

    it('debería quitar el filtro de servicio sin salir de la pestaña', async () => {
      await crear();
      await componente.verReservasDe(componente.detalle()!.servicios[0]);

      await componente.quitarFiltroServicio();

      expect(componente.servicioFiltrado()).toBeNull();
      expect(api['getReservas']).toHaveBeenLastCalledWith(1, expect.objectContaining({ servicioId: undefined }), 10);
    });

    it('debería calcular las páginas a partir del total', async () => {
      await crear({ getReservas: jest.fn().mockReturnValue(of({ items: [reserva()], total: 34 })) });

      await componente.irA('reservas');

      expect(componente.totalPaginas()).toBe(4);
    });
  });

  describe('gráfico y desgloses', () => {
    it('debería dibujar una barra por mes escalada contra el máximo', async () => {
      await crear();

      const barras = componente.barrasMes();

      expect(barras).toHaveLength(12);
      expect(barras[11].alto).toBe(140);
      expect(barras[0].alto).toBe(0);
      expect(componente.hayActividadMensual()).toBe(true);
    });

    it('debería ordenar los estados de reserva del más frecuente al menos', async () => {
      await crear();

      expect(componente.estadosOrdenados().map((e) => e.estado)).toEqual(['confirmada', 'cancelada']);
      expect(componente.estadosOrdenados()[0].porcentaje).toBe(100);
    });

    it('debería repartir las reseñas de cinco a una estrella', async () => {
      await crear();

      const reparto = componente.repartoResenas();

      expect(reparto.map((p) => p.estrellas)).toEqual([5, 4, 3, 2, 1]);
      expect(reparto[0].total).toBe(3);
      expect(reparto[4].total).toBe(0);
    });

    it('debería explicar de dónde sale la comisión aplicada', async () => {
      await crear();

      expect(componente.origenComision(componente.detalle()!.comisiones[0])).toBe('Tarifa de la categoría');
    });
  });

  describe('acciones', () => {
    it('debería activar el comercio y recargar la ficha', async () => {
      await crear();

      await componente.aprobar();

      expect(api['aprobarComercio']).toHaveBeenCalledWith('c1');
      expect(api['getDetalleComercio']).toHaveBeenCalledTimes(2);
      expect(componente.avisoAccion()).toContain('activado');
    });

    it('no debería suspender sin motivo escrito', async () => {
      await crear();
      componente.abrirSuspender();

      await componente.confirmarSuspender();

      expect(api['rechazarComercio']).not.toHaveBeenCalled();
      expect(componente.suspendiendo()).toBe(true);
    });

    it('debería suspender con el motivo que se escribió', async () => {
      await crear();
      componente.abrirSuspender();
      componente.motivoSuspension.set('Documentación caducada');

      await componente.confirmarSuspender();

      expect(api['rechazarComercio']).toHaveBeenCalledWith('c1', 'Documentación caducada');
      expect(componente.suspendiendo()).toBe(false);
    });

    it('debería alternar la adhesión al programa Alpha', async () => {
      await crear();

      await componente.alternarAlpha();

      expect(api['fijarAlphaAdherido']).toHaveBeenCalledWith('c1', true);
    });

    it('debería enseñar el motivo que devuelve el API si la acción falla', async () => {
      await crear({
        aprobarComercio: jest.fn().mockReturnValue(
          throwError(() => ({ status: 409, error: { message: 'Faltan los datos fiscales.' } })),
        ),
      });

      await componente.aprobar();

      expect(componente.errorAccion()).toBe('Faltan los datos fiscales.');
    });
  });

  describe('datos del negocio', () => {
    it('debería componer la dirección con lo que haya', async () => {
      await crear();
      const conDireccion = detalle();
      conDireccion.comercio.direccion = { calle: 'Gran Vía', numero: '3', ciudad: 'Valencia', pais: 'España' };

      expect(componente.direccion(conDireccion)).toBe('Gran Vía 3, Valencia, España');
      expect(componente.direccion(detalle())).toBe('—');
    });

    it('debería enseñar el IBAN tal como llega, ya enmascarado', async () => {
      await crear();

      expect(componente.detalle()?.comercio.datosBancarios?.iban).toBe('ES91••••••••••••••••1332');
    });

    it('debería traducir los consentimientos y los avisos a rótulos legibles', async () => {
      const conConsentimientos = detalle();
      conConsentimientos.comercio.consentimientos = {
        operaLegalmente: { aceptado: true, fecha: '2026-01-01T00:00:00.000Z', version: '1' },
      };
      conConsentimientos.comercio.preferenciasNotificacion = { nuevaReserva: true, pagos: false };
      await crear({ getDetalleComercio: jest.fn().mockReturnValue(of(conConsentimientos)) });

      expect(componente.consentimientos()).toEqual([
        expect.objectContaining({ label: 'Declara operar legalmente', aceptado: true }),
      ]);
      expect(componente.notificaciones()).toEqual([
        { clave: 'nuevaReserva', label: 'Aviso de nueva reserva', activa: true },
        { clave: 'pagos', label: 'Aviso de pagos', activa: false },
      ]);
    });

    it('debería llevar cada servicio a su ficha pública', async () => {
      await crear();

      expect(componente.rutaPublica(componente.detalle()!.servicios[0]))
        .toEqual(['/', VerticalKey.ALOJAMIENTO, 'srv-1']);
    });
  });
});
