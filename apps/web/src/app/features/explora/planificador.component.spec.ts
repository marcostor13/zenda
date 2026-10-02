import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { RouterTestingModule } from '@angular/router/testing';
import { AlojamientoViaje, DesplazamientoViaje, RitmoViaje, TipoLugar, VerticalKey } from 'shared';
import { PlanificadorComponent } from './planificador.component';
import { enlaceAServicio } from '../../shared/verticales/verticales.config';
import { CarritoService } from '../carrito/carrito.service';
import { PerrosService } from '../perros/perros.service';

const parada = (extra: Record<string, unknown> = {}) => ({
  servicioId: 's1', titulo: 'Hotel Royal', vertical: VerticalKey.HOTELES,
  descripcion: 'Con jardín', tipo: 'servicio', precioEstimado: 45, ...extra,
});

/** Fechas futuras: obligatorias para generar desde octubre. */
const FECHAS = { desde: '2030-09-01', hasta: '2030-09-04' };

const itinerario = () => ({
  provincia: 'Madrid', esFallback: false,
  opciones: [{
    nombre: 'Fin de semana', resumen: 'Dos días', presupuestoEstimado: 200, noches: 3,
    dias: [{ dia: 1, titulo: 'Llegada', paradas: [parada()] }],
  }],
});

describe('PlanificadorComponent', () => {
  let fixture: ComponentFixture<PlanificadorComponent>;
  let componente: PlanificadorComponent;
  let httpMock: HttpTestingController;
  let carrito: Record<string, jest.Mock>;
  let perros: Record<string, jest.Mock>;

  const crear = async (
    ajustes: { perros?: Record<string, jest.Mock>; destinos?: unknown[] } = {},
  ): Promise<void> => {
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
    httpMock.expectOne((r) => r.url.includes('/planificador/destinos')).flush(ajustes.destinos ?? [
      { provincia: 'Alicante', lugares: 60, servicios: 3 },
      { provincia: 'Castellón', lugares: 21, servicios: 0 },
    ]);
    await fixture.whenStable();
    fixture.detectChanges();
  };

  /** Valores por defecto que viajan siempre: el API los necesita para armar el plan. */
  const PREGUNTAS_POR_DEFECTO = {
    ritmo: RitmoViaje.EQUILIBRADO,
    alojamiento: AlojamientoViaje.NECESITO,
    desplazamiento: DesplazamientoViaje.COCHE_PROPIO,
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

  /*
   * Observación del cliente 28-09: la lista eran seis provincias fijas y sólo
   * una tenía contenido. Ahora salen las que de verdad tienen algo.
   */
  describe('destinos', () => {
    it('debería ofrecer las provincias con contenido que devuelve el API', async () => {
      await crear();

      expect(componente.destinos().map((d) => d.nombre)).toEqual(['Alicante', 'Castellón']);
      expect(componente.destinos()[0].lugares).toBe(60);
    });

    it('debería quedarse con las provincias de Explora si el API no devuelve nada', async () => {
      await crear({ destinos: [] });

      expect(componente.destinos().map((d) => d.nombre)).toEqual(['Valencia', 'Alicante', 'Castellón']);
    });
  });

  describe('elección de destino', () => {
    it('debería fijar el destino y limpiar lo anterior', async () => {
      await crear();
      componente.error.set('algo');

      componente.elegir('Madrid');

      expect(componente.destino()).toBe('Madrid');
      expect(componente.itinerario()).toBeNull();
      expect(componente.error()).toBe('');
    });

    it('debería volver al selector de destinos', async () => {
      await crear();
      componente.elegir('Madrid');

      componente.volver();

      expect(componente.destino()).toBe('');
      expect(componente.form.controls.destino.value).toBe('');
      expect(componente.itinerario()).toBeNull();
    });
  });

  /* Bloqueo del cliente (octubre): «no te permite poner el lugar». */
  describe('destino libre', () => {
    it('debería ofrecer un campo para escribir el destino', async () => {
      await crear();

      const campo = (fixture.nativeElement as HTMLElement).querySelector('#pl-destino-inicio');
      expect(campo).not.toBeNull();
      expect(componente.sugerencias).toContain('Gandía (Valencia)');
    });

    it('debería aceptar cualquier población escrita', async () => {
      await crear();
      componente.form.controls.destino.setValue('gandia');

      expect(componente.continuar()).toBe(true);
      expect(componente.destino()).toBe('Gandía (Valencia)');
    });

    it('debería pedir un destino si el campo está vacío', async () => {
      await crear();

      expect(componente.continuar()).toBe(false);
      expect(componente.errorDestino()).toBeTruthy();
      expect(componente.destino()).toBe('');
    });
  });

  /* Bloqueo del cliente (octubre): se generaba un viaje sin fechas. */
  describe('fechas del viaje', () => {
    it('no debería pedir el itinerario sin fechas', async () => {
      await crear();
      componente.elegir('Madrid');

      await componente.generar();

      httpMock.expectNone((r) => r.url.includes('/planificador/itinerario'));
      expect(componente.error()).toContain('fechas');
    });

    it('no debería pedir el itinerario con la vuelta antes de la ida', async () => {
      await crear();
      componente.elegir('Madrid');
      componente.form.patchValue({ desde: '2030-09-05', hasta: '2030-09-01' });

      await componente.generar();

      httpMock.expectNone((r) => r.url.includes('/planificador/itinerario'));
      expect(componente.errorFechas()).toContain('vuelta');
    });

    it('no debería aceptar un viaje que empieza en el pasado', async () => {
      await crear();
      componente.elegir('Madrid');
      componente.form.patchValue({ desde: '2020-09-01', hasta: '2020-09-03' });

      await componente.generar();

      httpMock.expectNone((r) => r.url.includes('/planificador/itinerario'));
      expect(componente.errorFechas()).toContain('anterior a hoy');
    });
  });

  describe('importes', () => {
    it('debería rotular el precio del hotel por noche y como orientativo', async () => {
      await crear();

      expect(componente.precioOrientativo(parada() as never)).toContain('la noche');
      expect(componente.precioOrientativo(parada({ vertical: VerticalKey.PELUQUERIA }) as never))
        .toContain('orientativo');
    });

    it('debería presentar el total como estimación y avisar si falta hotel', async () => {
      await crear();
      componente.elegir('Alicante');
      componente.itinerario.set({ ...itinerario(), avisoAlojamiento: 'Todavía no hay hoteles pet friendly' } as never);
      fixture.detectChanges();

      const texto = (fixture.nativeElement as HTMLElement).textContent ?? '';
      expect(texto).toContain('Estimación orientativa');
      expect(texto).toContain('Todavía no hay hoteles pet friendly');
      expect(texto).not.toMatch(/Desde\s+200/);
    });
  });

  describe('generación del itinerario', () => {
    it('debería enviar destino, fechas, presupuesto y perro', async () => {
      await crear();
      componente.elegir('Madrid');
      componente.form.patchValue({ ...FECHAS, presupuesto: 400, perroId: 'p1' });

      const promesa = componente.generar();
      const req = httpMock.expectOne((r) => r.url.includes('/planificador/itinerario'));
      expect(req.request.body).toMatchObject({
        destino: 'Madrid', desde: '2030-09-01', hasta: '2030-09-04',
        presupuestoMax: 400, perroId: 'p1', ...PREGUNTAS_POR_DEFECTO,
      });
      req.flush(itinerario());
      await promesa;

      expect(componente.itinerario()?.opciones).toHaveLength(1);
      expect(componente.generando()).toBe(false);
    });

    it('debería omitir los campos opcionales no rellenados', async () => {
      await crear();
      componente.elegir('Madrid');
      componente.form.patchValue(FECHAS);

      const promesa = componente.generar();
      const req = httpMock.expectOne((r) => r.url.includes('/planificador/itinerario'));
      expect(req.request.body).toEqual({ destino: 'Madrid', ...FECHAS, ...PREGUNTAS_POR_DEFECTO });
      req.flush({ provincia: 'Madrid', esFallback: false, opciones: [] });
      await promesa;
    });

    it('debería enviar las respuestas a las preguntas nuevas del viaje', async () => {
      await crear();
      componente.elegir(' denia ');
      componente.form.patchValue({
        ...FECHAS, ritmo: RitmoViaje.TRANQUILO,
        alojamiento: AlojamientoViaje.YA_LO_TENGO, desplazamiento: DesplazamientoViaje.TRANSPORTE_MASCOTA,
      });
      componente.alternarInteres(TipoLugar.PLAYA);
      componente.alternarInteres(TipoLugar.RESTAURANTE);
      componente.alternarInteres(TipoLugar.PLAYA);
      componente.alternarExtra(VerticalKey.PELUQUERIA);

      const promesa = componente.generar();
      const req = httpMock.expectOne((r) => r.url.includes('/planificador/itinerario'));
      expect(req.request.body).toMatchObject({
        destino: 'Dénia (Alicante)', ritmo: RitmoViaje.TRANQUILO,
        alojamiento: AlojamientoViaje.YA_LO_TENGO, desplazamiento: DesplazamientoViaje.TRANSPORTE_MASCOTA,
        intereses: [TipoLugar.RESTAURANTE], serviciosExtra: [VerticalKey.PELUQUERIA],
      });
      req.flush({ provincia: 'Alicante', esFallback: true, opciones: [] });
      await promesa;
    });

    it('debería mostrar el motivo que devuelve el servidor', async () => {
      await crear();
      componente.elegir('Madrid');
      componente.form.patchValue(FECHAS);

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
      componente.form.patchValue(FECHAS);

      const promesa = componente.generar();
      httpMock.expectOne((r) => r.url.includes('/planificador/itinerario'))
        .flush(null, { status: 500, statusText: 'Server Error' });
      await promesa;

      expect(componente.error()).toContain('No hemos podido preparar el itinerario');
    });
  });

  describe('paso del plan al carrito', () => {
    it('debería añadir el hotel con las fechas de ida y vuelta', async () => {
      await crear();
      componente.form.patchValue(FECHAS);

      await componente.anadir(parada() as never);

      expect(carrito['anadir']).toHaveBeenCalledWith({
        servicioId: 's1', vertical: VerticalKey.HOTELES,
        fechaInicio: '2030-09-01', fechaFin: '2030-09-04',
      });
      expect(componente.anadidos()).toContain('s1');
      expect(componente.anadiendo()).toBeNull();
    });

    it('debería añadir un servicio que no es hotel sólo con el día de ida', async () => {
      await crear();
      componente.form.patchValue(FECHAS);

      await componente.anadir(parada({ vertical: VerticalKey.PELUQUERIA }) as never);

      expect(carrito['anadir'].mock.calls[0][0]).toEqual({
        servicioId: 's1', vertical: VerticalKey.PELUQUERIA, fechaInicio: '2030-09-01', fechaFin: undefined,
      });
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

      expect(componente.error()).toContain('Hotel Royal');
      expect(componente.anadidos()).toEqual([]);
    });

    it('debería mostrar el motivo del servidor si lo hay', async () => {
      await crear();
      carrito['anadir'].mockRejectedValue({ error: { message: 'Sin disponibilidad esas fechas' } });

      await componente.anadir(parada() as never);

      expect(componente.error()).toBe('Sin disponibilidad esas fechas');
    });
  });

  /* Observación del cliente 28-09: el plan termina en un servicio de la plataforma. */
  describe('reserva del viaje', () => {
    it('debería enlazar cada servicio a su ficha para reservarlo', async () => {
      await crear();

      expect(componente.enlace(parada() as never)).toEqual(enlaceAServicio(VerticalKey.HOTELES, 's1'));
    });

    it('debería pintar el bloque «Reserva tu viaje» con lo reservable del plan', async () => {
      await crear();
      componente.elegir('Alicante');
      componente.itinerario.set({ ...itinerario(), serviciosSugeridos: [parada()] } as never);
      fixture.detectChanges();

      const bloque = (fixture.nativeElement as HTMLElement).querySelector('.pl-reserva');
      expect(bloque?.textContent).toContain('Reserva tu viaje');
      expect(bloque?.textContent).toContain('Hotel Royal');
    });

    it('debería añadir todo lo reservable al carrito de una vez', async () => {
      await crear();

      await componente.anadirTodo([parada(), parada({ servicioId: 's2', titulo: 'Peluquería' })] as never);

      expect(carrito['anadir']).toHaveBeenCalledTimes(2);
      expect(componente.todoAnadido([parada(), parada({ servicioId: 's2' })] as never)).toBe(true);
    });

    it('debería parar en el primero que falle y decir cuál', async () => {
      await crear();
      carrito['anadir'].mockRejectedValueOnce({});

      await componente.anadirTodo([parada(), parada({ servicioId: 's2' })] as never);

      expect(carrito['anadir']).toHaveBeenCalledTimes(1);
      expect(componente.error()).toContain('Hotel Royal');
    });
  });
});
