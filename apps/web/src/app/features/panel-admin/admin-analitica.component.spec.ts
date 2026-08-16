import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { of } from 'rxjs';
import { VerticalKey } from 'shared';
import { AdminAnaliticaComponent } from './admin-analitica.component';
import { AdminApiService, AnaliticaAdmin } from './admin-api.service';

const analitica = (extra: Partial<AnaliticaAdmin> = {}): AnaliticaAdmin => ({
  kpis: {
    usuariosNuevosMes: 12, reservas: 40, conversionPct: 8.5,
    facturacion: 5200, comision: 780, ticketMedio: 130,
  },
  porVertical: [
    { vertical: VerticalKey.ALOJAMIENTO, reservas: 30, porcentaje: 75, facturacion: 4000, comision: 600, comercios: 2 },
    { vertical: VerticalKey.PELUQUERIA, reservas: 10, porcentaje: 25, facturacion: 1200, comision: 180, comercios: 5 },
  ],
  porCiudad: [
    { ciudad: 'Madrid', reservas: 30, comercios: 4, facturacion: 4000 },
    { ciudad: 'Lisboa', reservas: 10, comercios: 1, facturacion: 1200 },
  ],
  topComercios: [
    { comercio: 'Royal Dog', reservas: 12, facturacion: 3000, valoracion: 4.2 },
    { comercio: 'City Paws', reservas: 20, facturacion: 2200, valoracion: 4.9 },
  ],
  embudo: { registrados: 100, busquedas: 60, visitasFicha: 30, conReserva: 10, pagaron: 8, completaron: 6 },
  ...extra,
} as AnaliticaAdmin);

const evolucion = [
  { fecha: '2026-08-01', reservas: 2, facturacion: 200 },
  { fecha: '2026-08-02', reservas: 4, facturacion: 100 },
];

describe('AdminAnaliticaComponent', () => {
  let fixture: ComponentFixture<AdminAnaliticaComponent>;
  let componente: AdminAnaliticaComponent;
  let api: Record<string, jest.Mock>;

  const crear = async (ajustes: Record<string, jest.Mock> = {}): Promise<void> => {
    api = {
      getAnalitica: jest.fn().mockReturnValue(of(analitica())),
      getEvolucion: jest.fn().mockReturnValue(of(evolucion)),
      ...ajustes,
    };

    await TestBed.configureTestingModule({
      imports: [AdminAnaliticaComponent],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: AdminApiService, useValue: api },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(AdminAnaliticaComponent);
    componente = fixture.componentInstance;
    fixture.detectChanges();
    // `ngOnInit` encadena dos peticiones: una sola espera deja la segunda a medias.
    await fixture.whenStable();
    await fixture.whenStable();
    fixture.detectChanges();
  };

  afterEach(() => jest.clearAllMocks());

  describe('carga', () => {
    it('debería pedir la analítica y la serie de evolución', async () => {
      await crear();

      expect(api['getAnalitica']).toHaveBeenCalled();
      expect(api['getEvolucion']).toHaveBeenCalledWith(30);
      expect(componente.cargando()).toBe(false);
      expect(componente.errorMsg()).toBe('');
    });

    it('debería avisar si la analítica no carga', async () => {
      await crear({ getAnalitica: jest.fn(() => { throw new Error('500'); }) });

      expect(componente.errorMsg()).toContain('Error cargando la analítica');
      expect(componente.cargando()).toBe(false);
    });

    it('debería seguir mostrando la analítica aunque falle la serie de evolución', async () => {
      await crear({ getEvolucion: jest.fn(() => { throw new Error('500'); }) });

      expect(componente.errorMsg()).toBe('');
      expect(componente.analitica()).not.toBeNull();
      expect(componente.evolucion()).toEqual([]);
    });
  });

  describe('embudo de conversión (TCK-8031 §3)', () => {
    it('debería recorrer los seis peldaños en el orden del recorrido real', async () => {
      await crear();

      expect(componente.embudoPasos().map((p) => p.label)).toEqual([
        'Usuarios registrados',
        'Búsquedas realizadas',
        'Ficha de comercio visitada',
        'Reserva iniciada',
        'Pago realizado',
        'Reserva completada',
      ]);
    });

    it('debería medir cada peldaño contra el primero y mostrar la caída entre pasos', async () => {
      await crear();
      const [registrados, busquedas, fichas] = componente.embudoPasos();

      expect(registrados.pct).toBe(100);
      expect(registrados.caidaPct).toBeNull(); // no hay paso anterior
      expect(busquedas.pct).toBe(60);
      expect(busquedas.caidaPct).toBe(40); // 100 → 60
      expect(fichas.caidaPct).toBe(50); // 60 → 30
    });

    it('debería tratar como cero los pasos que el API todavía no envía', async () => {
      await crear({
        getAnalitica: jest.fn().mockReturnValue(of(analitica({
          embudo: { registrados: 100, conReserva: 10, pagaron: 8 },
        } as Partial<AnaliticaAdmin>))),
      });

      const pasos = componente.embudoPasos();
      expect(pasos[1].valor).toBe(0);
      expect(pasos.at(-1)!.valor).toBe(0);
    });

    it('no debería pintar nada mientras no haya datos', async () => {
      await crear({ getAnalitica: jest.fn(() => { throw new Error('500'); }) });

      expect(componente.embudoPasos()).toEqual([]);
    });
  });

  describe('distribución por categoría', () => {
    it('debería reordenar al cambiar la métrica', async () => {
      await crear();
      expect(componente.verticalesOrdenados()[0].vertical).toBe(VerticalKey.ALOJAMIENTO);

      // Peluquería tiene menos reservas pero más comercios.
      componente.metricaVertical.set('comercios');
      expect(componente.verticalesOrdenados()[0].vertical).toBe(VerticalKey.PELUQUERIA);
    });

    it('debería medir la barra contra el mayor de la métrica elegida', async () => {
      await crear();
      const [alojamiento, peluqueria] = componente.verticalesOrdenados();

      expect(componente.pctVertical(alojamiento)).toBe(100);
      expect(componente.pctVertical(peluqueria)).toBe(33); // 10 de 30
    });

    it('debería rotular el valor según la métrica', async () => {
      await crear();
      const alojamiento = componente.verticalesOrdenados()[0];

      expect(componente.valorVertical(alojamiento)).toBe('75% · 30');

      componente.metricaVertical.set('facturacion');
      expect(componente.valorVertical(alojamiento)).toBe('4000 €');

      componente.metricaVertical.set('comercios');
      expect(componente.valorVertical(alojamiento)).toBe('2 comercios');
    });

    it('debería usar el singular con un solo comercio', async () => {
      await crear();
      componente.metricaVertical.set('comercios');
      const peluqueria = componente.verticalesOrdenados().find((v) => v.comercios === 5);

      expect(componente.valorVertical({ ...peluqueria!, comercios: 1 })).toBe('1 comercio');
    });
  });

  describe('top de comercios y ciudades', () => {
    it('debería ordenar el top por la clave elegida', async () => {
      await crear();
      expect(componente.topOrdenado()[0].comercio).toBe('Royal Dog'); // por facturación

      componente.ordenTop.set('reservas');
      expect(componente.topOrdenado()[0].comercio).toBe('City Paws');

      componente.ordenTop.set('valoracion');
      expect(componente.topOrdenado()[0].comercio).toBe('City Paws');
    });

    it('debería medir cada ciudad contra la que más reservas tiene', async () => {
      await crear();

      expect(componente.pctCiudad(30)).toBe(100);
      expect(componente.pctCiudad(10)).toBe(33);
    });
  });

  describe('gráfico de evolución', () => {
    it('debería convertir la serie en barras dentro del lienzo', async () => {
      await crear();
      const barras = componente.barras();

      expect(barras).toHaveLength(2);
      // La barra más alta ocupa el máximo; el eje se apoya en y = 150.
      expect(barras[1].alto).toBe(140);
      expect(barras[1].y).toBe(10);
      expect(barras[0].alto).toBe(70); // 2 de 4
    });

    it('debería reescalar al cambiar de métrica', async () => {
      await crear();
      componente.metricaEvolucion.set('facturacion');

      // Con facturación manda el primer día (200 €), no el segundo.
      expect(componente.maximoEvolucion()).toBe(200);
      expect(componente.barras()[0].alto).toBe(140);
    });

    it('debería devolver una polilínea vacía sin serie', async () => {
      await crear({ getEvolucion: jest.fn().mockReturnValue(of([])) });

      expect(componente.barras()).toEqual([]);
      expect(componente.puntosLinea()).toBe('');
    });

    it('debería componer los puntos de la línea en el centro de cada barra', async () => {
      await crear();

      expect(componente.puntosLinea().split(' ')).toHaveLength(2);
    });
  });
});
