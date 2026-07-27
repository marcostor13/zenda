import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { RouterTestingModule } from '@angular/router/testing';
import { VerticalKey } from 'shared';
import { PlanificadorComponent } from './planificador.component';
import { CarritoService } from '../carrito/carrito.service';
import { PerrosService } from '../perros/perros.service';

const parada = (extra: Record<string, unknown> = {}) => ({
  servicioId: 's1', titulo: 'Residencia Royal', vertical: VerticalKey.ALOJAMIENTO,
  descripcion: 'Con jardín', tipo: 'servicio', precioEstimado: 45, ...extra,
});

const itinerario = () => ({
  provincia: 'Madrid', esFallback: false,
  opciones: [{
    nombre: 'Fin de semana', resumen: 'Dos días', presupuestoEstimado: 200,
    dias: [{ dia: 1, titulo: 'Llegada', paradas: [parada()] }],
  }],
});

describe('PlanificadorComponent', () => {
  let fixture: ComponentFixture<PlanificadorComponent>;
  let componente: PlanificadorComponent;
  let httpMock: HttpTestingController;
  let carrito: Record<string, jest.Mock>;
  let perros: Record<string, jest.Mock>;

  const crear = async (ajustes: { perros?: Record<string, jest.Mock> } = {}): Promise<void> => {
    carrito = { anadir: jest.fn().mockResolvedValue(undefined) };
    perros = ajustes.perros ?? { misPerros: jest.fn().mockResolvedValue([{ _id: 'p1', nombre: 'Maya' }]) };

    await TestBed.configureTestingModule({
      imports: [PlanificadorComponent, RouterTestingModule],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: CarritoService, useValue: carrito },
        { provide: PerrosService, useValue: perros },
      ],
    }).compileComponents();

    httpMock = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(PlanificadorComponent);
    componente = fixture.componentInstance;
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  };

  afterEach(() => {
    fixture?.destroy();
    httpMock.verify();
    jest.clearAllMocks();
  });

  describe('arranque', () => {
    it('debería ofrecer los perros del usuario para personalizar', async () => {
      await crear();

      expect(componente.perros()).toHaveLength(1);
    });

    it('debería funcionar sin sesión iniciada', async () => {
      await crear({ perros: { misPerros: jest.fn(() => { throw new Error('401'); }) } });

      // El planificador es una herramienta de captación: no puede exigir cuenta.
      expect(componente.perros()).toEqual([]);
    });
  });

  describe('elección de destino', () => {
    it('debería fijar la provincia y limpiar lo anterior', async () => {
      await crear();
      componente.error.set('algo');

      componente.elegir('Madrid');

      expect(componente.provincia()).toBe('Madrid');
      expect(componente.itinerario()).toBeNull();
      expect(componente.error()).toBe('');
    });

    it('debería volver al selector de provincias', async () => {
      await crear();
      componente.elegir('Madrid');

      componente.volver();

      expect(componente.provincia()).toBe('');
      expect(componente.itinerario()).toBeNull();
    });
  });

  describe('generación del itinerario', () => {
    it('debería enviar destino, fechas, presupuesto y perro', async () => {
      await crear();
      componente.elegir('Madrid');
      componente.desde = '2026-09-01';
      componente.hasta = '2026-09-04';
      componente.presupuesto = 400;
      componente.perroId = 'p1';

      const promesa = componente.generar();
      const req = httpMock.expectOne((r) => r.url.includes('/planificador/itinerario'));
      expect(req.request.body).toEqual({
        provincia: 'Madrid', desde: '2026-09-01', hasta: '2026-09-04',
        presupuestoMax: 400, perroId: 'p1',
      });
      req.flush(itinerario());
      await promesa;

      expect(componente.itinerario()?.opciones).toHaveLength(1);
      expect(componente.generando()).toBe(false);
    });

    it('debería omitir los campos opcionales no rellenados', async () => {
      await crear();
      componente.elegir('Madrid');

      const promesa = componente.generar();
      const req = httpMock.expectOne((r) => r.url.includes('/planificador/itinerario'));
      expect(req.request.body).toEqual({
        provincia: 'Madrid', desde: undefined, hasta: undefined,
        presupuestoMax: undefined, perroId: undefined,
      });
      req.flush({ provincia: 'Madrid', esFallback: false, opciones: [] });
      await promesa;
    });

    it('debería mostrar el motivo que devuelve el servidor', async () => {
      await crear();
      componente.elegir('Madrid');

      const promesa = componente.generar();
      httpMock.expectOne((r) => r.url.includes('/planificador/itinerario'))
        .flush({ message: 'Has alcanzado el límite diario' }, { status: 429, statusText: 'Too Many Requests' });
      await promesa;

      expect(componente.error()).toBe('Has alcanzado el límite diario');
      expect(componente.generando()).toBe(false);
    });

    it('debería dar un mensaje genérico si el servidor no explica el fallo', async () => {
      await crear();
      componente.elegir('Madrid');

      const promesa = componente.generar();
      httpMock.expectOne((r) => r.url.includes('/planificador/itinerario'))
        .flush(null, { status: 500, statusText: 'Server Error' });
      await promesa;

      expect(componente.error()).toContain('No hemos podido preparar el itinerario');
    });
  });

  describe('paso del plan al carrito', () => {
    it('debería añadir la parada con las fechas del plan', async () => {
      await crear();
      componente.desde = '2026-09-01';
      componente.hasta = '2026-09-04';

      await componente.anadir(parada() as never);

      expect(carrito['anadir']).toHaveBeenCalledWith({
        servicioId: 's1', vertical: VerticalKey.ALOJAMIENTO,
        fechaInicio: '2026-09-01', fechaFin: '2026-09-04',
      });
      expect(componente.anadidos()).toContain('s1');
      expect(componente.anadiendo()).toBeNull();
    });

    it('debería usar la fecha de hoy si el plan no fijó fechas', async () => {
      await crear();

      await componente.anadir(parada() as never);

      const enviado = carrito['anadir'].mock.calls[0][0];
      expect(enviado.fechaInicio).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(enviado.fechaFin).toBeUndefined();
    });

    it('no debería intentar reservar una parada inventada por la IA', async () => {
      await crear();

      await componente.anadir(parada({ servicioId: undefined }) as never);

      // Las paradas sin servicio real no existen en el catálogo: reservarlas fallaría.
      expect(carrito['anadir']).not.toHaveBeenCalled();
    });

    it('debería nombrar la parada que no se pudo añadir', async () => {
      await crear();
      carrito['anadir'].mockRejectedValue({});

      await componente.anadir(parada() as never);

      expect(componente.error()).toContain('Residencia Royal');
      expect(componente.anadidos()).toEqual([]);
    });

    it('debería mostrar el motivo del servidor si lo hay', async () => {
      await crear();
      carrito['anadir'].mockRejectedValue({ error: { message: 'Sin disponibilidad esas fechas' } });

      await componente.anadir(parada() as never);

      expect(componente.error()).toBe('Sin disponibilidad esas fechas');
    });
  });
});
