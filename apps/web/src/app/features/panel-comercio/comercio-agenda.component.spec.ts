import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { of, throwError } from 'rxjs';
import { VerticalKey } from 'shared';
import { ComercioAgendaComponent } from './comercio-agenda.component';
import { ComercioApiService, MiServicio } from './comercio-api.service';

const servicio = (extra: Partial<MiServicio> = {}): MiServicio => ({
  _id: 's1', titulo: 'Residencia Royal', vertical: VerticalKey.ALOJAMIENTO,
  precioBase: 40, estado: 'publicado',
  ...extra,
} as MiServicio);

describe('ComercioAgendaComponent', () => {
  let fixture: ComponentFixture<ComercioAgendaComponent>;
  let componente: ComercioAgendaComponent;
  let api: Record<string, jest.Mock>;

  const crear = async (
    servicios: MiServicio[] = [servicio()],
    datos: { bloqueos?: unknown[]; citas?: unknown[] } = {},
  ): Promise<void> => {
    api = {
      getMisServicios: jest.fn().mockReturnValue(of(servicios)),
      getBloqueos: jest.fn().mockReturnValue(of(datos.bloqueos ?? [])),
      getCitasAgenda: jest.fn().mockReturnValue(of(datos.citas ?? [])),
      crearBloqueo: jest.fn().mockReturnValue(of({ _id: 'b9' })),
      eliminarBloqueo: jest.fn().mockReturnValue(of(undefined)),
    };

    await TestBed.configureTestingModule({
      imports: [ComercioAgendaComponent],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: ComercioApiService, useValue: api },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(ComercioAgendaComponent);
    componente = fixture.componentInstance;
    fixture.detectChanges();
    await asentar();
  };

  /**
   * `ngOnInit` encadena dos esperas —los servicios y luego el periodo—, así que
   * con un solo `whenStable` la agenda todavía está vacía.
   */
  const asentar = async (): Promise<void> => {
    await fixture.whenStable();
    await fixture.whenStable();
    fixture.detectChanges();
  };

  /** Fecha ISO a N días de hoy, para no atarse a un año concreto. */
  const enDias = (dias: number): Date => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() + dias);
    return d;
  };

  describe('qué vista toca', () => {
    /**
     * La pregunta que se hace el comercio es distinta según lo que venda, y de
     * ahí sale la vista: «cuántas plazas me quedan» frente a «qué tengo el
     * martes por la tarde».
     */
    it('debería enseñar el inventario en alojamiento', async () => {
      await crear([servicio({ vertical: VerticalKey.ALOJAMIENTO })]);

      expect(componente.esInventario()).toBe(true);
    });

    it('debería enseñar el inventario en hoteles', async () => {
      await crear([servicio({ vertical: VerticalKey.HOTELES })]);

      expect(componente.esInventario()).toBe(true);
    });

    it('debería enseñar la semana por horas en peluquería', async () => {
      await crear([servicio({ vertical: VerticalKey.PELUQUERIA })]);

      expect(componente.esInventario()).toBe(false);
    });

    it('debería cambiar de vista al cambiar de servicio', async () => {
      await crear([
        servicio({ _id: 's1', vertical: VerticalKey.ALOJAMIENTO }),
        servicio({ _id: 's2', vertical: VerticalKey.VETERINARIA }),
      ]);

      componente.elegirServicio('s2');

      expect(componente.esInventario()).toBe(false);
    });
  });

  describe('periodo a la vista', () => {
    it('debería abrir el mes completo en inventario', async () => {
      await crear([servicio({ vertical: VerticalKey.ALOJAMIENTO })]);

      expect(componente.desde().getDate()).toBe(1);
      expect(componente.hasta().getDate()).toBe(1);
    });

    it('debería abrir la semana empezando en lunes', async () => {
      // La semana europea empieza en lunes; `getDay()` pone el domingo en 0.
      await crear([servicio({ vertical: VerticalKey.PELUQUERIA })]);

      expect(componente.desde().getDay()).toBe(1);
    });

    it('debería avanzar de mes en inventario', async () => {
      await crear([servicio({ vertical: VerticalKey.ALOJAMIENTO })]);
      const mesInicial = componente.desde().getMonth();

      componente.mover(1);

      expect(componente.desde().getMonth()).toBe((mesInicial + 1) % 12);
    });

    it('debería avanzar de semana en semana en los verticales de cita', async () => {
      await crear([servicio({ vertical: VerticalKey.PELUQUERIA })]);
      const inicial = componente.desde().getTime();

      componente.mover(1);

      expect(componente.desde().getTime() - inicial).toBe(7 * 24 * 60 * 60 * 1000);
    });

    it('debería volver a hoy', async () => {
      await crear();
      componente.mover(3);

      componente.irAHoy();

      expect(componente.desde().getMonth()).toBe(new Date().getMonth());
    });

    it('debería recargar el periodo al moverse', async () => {
      await crear();

      componente.mover(1);

      expect(api['getBloqueos']).toHaveBeenCalledTimes(2);
    });
  });

  describe('rejilla de inventario', () => {
    it('debería pintar seis semanas', async () => {
      await crear([servicio({ vertical: VerticalKey.ALOJAMIENTO })]);

      expect(componente.diasDelMes()).toHaveLength(42);
    });

    it('debería contar las plazas bloqueadas de cada día', async () => {
      const desde = enDias(1);
      const hasta = enDias(3);
      await crear([servicio({ vertical: VerticalKey.ALOJAMIENTO })], {
        bloqueos: [{
          _id: 'b1', servicioId: 's1', motivo: 'Reservado por teléfono', cantidad: 2,
          desde: desde.toISOString(), hasta: hasta.toISOString(),
        }],
      });

      const dia = componente.diasDelMes().find((d) => d.clave === claveDe(desde))!;
      expect(dia.bloqueadas).toBe(2);
      expect(dia.cerradoDelTodo).toBe(false);
    });

    it('debería marcar como cerrado del todo el bloqueo sin cantidad', async () => {
      const desde = enDias(1);
      await crear([servicio({ vertical: VerticalKey.ALOJAMIENTO })], {
        bloqueos: [{
          _id: 'b1', servicioId: 's1', motivo: 'Vacaciones',
          desde: desde.toISOString(), hasta: enDias(2).toISOString(),
        }],
      });

      const dia = componente.diasDelMes().find((d) => d.clave === claveDe(desde))!;
      expect(dia.cerradoDelTodo).toBe(true);
    });

    /**
     * Se cuentan aparte a propósito: al comercio le importa distinguir lo que le
     * entra por Doogking de lo que ha cerrado él, que es el motivo de la
     * pantalla.
     */
    it('debería contar las reservas aparte de los bloqueos', async () => {
      const desde = enDias(1);
      await crear([servicio({ vertical: VerticalKey.ALOJAMIENTO })], {
        citas: [{
          _id: 'r1', codigo: 'RES-1', servicioId: 's1', estado: 'confirmada', cliente: 'Ana',
          desde: desde.toISOString(), hasta: enDias(2).toISOString(),
        }],
      });

      const dia = componente.diasDelMes().find((d) => d.clave === claveDe(desde))!;
      expect(dia.reservadas).toBe(1);
      expect(dia.bloqueadas).toBe(0);
    });

    it('no debería marcar la noche de salida', async () => {
      // Del 1 al 3 se duerme el 1 y el 2: el día 3 la plaza vuelve a estar libre.
      const salida = enDias(3);
      await crear([servicio({ vertical: VerticalKey.ALOJAMIENTO })], {
        bloqueos: [{
          _id: 'b1', servicioId: 's1', motivo: 'Fuera', cantidad: 1,
          desde: enDias(1).toISOString(), hasta: salida.toISOString(),
        }],
      });

      const dia = componente.diasDelMes().find((d) => d.clave === claveDe(salida))!;
      expect(dia.bloqueadas).toBe(0);
    });
  });

  describe('rejilla semanal', () => {
    it('debería pintar los siete días', async () => {
      await crear([servicio({ vertical: VerticalKey.PELUQUERIA })]);

      expect(componente.diasDeLaSemana()).toHaveLength(7);
    });

    it('debería situar la cita en su franja horaria', async () => {
      await crear([servicio({ vertical: VerticalKey.PELUQUERIA })]);

      const lunes = componente.desde();
      const inicio = new Date(lunes); inicio.setHours(9, 0, 0, 0);
      const fin = new Date(lunes); fin.setHours(10, 0, 0, 0);

      api['getCitasAgenda'].mockReturnValue(of([{
        _id: 'r1', codigo: 'RES-1', servicioId: 's1', estado: 'confirmada',
        cliente: 'Ana', perro: 'Toby',
        desde: inicio.toISOString(), hasta: fin.toISOString(),
      }]));
      componente.elegirServicio('s1');
      await asentar();

      const tarjetas = componente.diasDeLaSemana()[0].tarjetas;
      expect(tarjetas).toHaveLength(1);
      expect(tarjetas[0].titulo).toBe('Ana · Toby');
      // Las 9:00 con la rejilla abriendo a las 7:00 son dos horas de margen.
      expect(tarjetas[0].top).toBe(2 * componente.ALTO_HORA);
    });

    it('debería distinguir el bloqueo de una cita real', async () => {
      await crear([servicio({ vertical: VerticalKey.PELUQUERIA })]);

      const lunes = componente.desde();
      const inicio = new Date(lunes); inicio.setHours(9, 0, 0, 0);
      const fin = new Date(lunes); fin.setHours(11, 0, 0, 0);

      api['getBloqueos'].mockReturnValue(of([{
        _id: 'b1', servicioId: 's1', motivo: 'Formación',
        desde: inicio.toISOString(), hasta: fin.toISOString(),
      }]));
      componente.elegirServicio('s1');
      await asentar();

      const tarjeta = componente.diasDeLaSemana()[0].tarjetas[0];
      expect(tarjeta.esBloqueo).toBe(true);
      expect(tarjeta.subtitulo).toBe('Formación');
    });

    it('debería recortar a la franja visible lo que se sale de ella', async () => {
      // Una estancia de tres noches no puede pintar una barra de 72 horas, pero
      // sí decir que ese día está ocupado.
      await crear([servicio({ vertical: VerticalKey.PELUQUERIA })]);

      const lunes = componente.desde();
      api['getCitasAgenda'].mockReturnValue(of([{
        _id: 'r1', codigo: 'RES-1', servicioId: 's1', estado: 'confirmada', cliente: 'Ana',
        desde: lunes.toISOString(),
        hasta: new Date(lunes.getTime() + 3 * 24 * 60 * 60 * 1000).toISOString(),
      }]));
      componente.elegirServicio('s1');
      await asentar();

      const tarjeta = componente.diasDeLaSemana()[0].tarjetas[0];
      expect(tarjeta.top).toBe(0);
      expect(tarjeta.alto).toBeLessThanOrEqual(15 * componente.ALTO_HORA);
    });
  });

  describe('cerrar un tramo', () => {
    it('debería exigir un motivo', async () => {
      // Dentro de tres semanas nadie recuerda por qué estaba bloqueado el hueco.
      await crear();
      componente.abrirCierre();
      componente.formMotivo = '  ';

      await componente.guardarCierre();

      expect(api['crearBloqueo']).not.toHaveBeenCalled();
      expect(componente.errorModal()).toContain('por qué');
    });

    it('debería exigir que el fin sea posterior al inicio', async () => {
      await crear();
      componente.abrirCierre();
      componente.formMotivo = 'Vacaciones';
      componente.formHasta = componente.formDesde;

      await componente.guardarCierre();

      expect(api['crearBloqueo']).not.toHaveBeenCalled();
    });

    it('debería enviar el tramo con su motivo', async () => {
      await crear();
      componente.abrirCierre();
      componente.formMotivo = 'Reservado por teléfono';

      await componente.guardarCierre();

      expect(api['crearBloqueo']).toHaveBeenCalledWith(
        expect.objectContaining({ servicioId: 's1', motivo: 'Reservado por teléfono' }),
      );
    });

    it('debería mandar la cantidad vacía como cierre total', async () => {
      // Vacío significa «cierro el servicio entero», no «cero plazas».
      await crear();
      componente.abrirCierre();
      componente.formMotivo = 'Obras';
      componente.formCantidad = null;

      await componente.guardarCierre();

      expect(api['crearBloqueo'].mock.calls.at(-1)![0].cantidad).toBeUndefined();
    });

    it('debería mandar la cantidad cuando se cierra sólo una parte', async () => {
      await crear();
      componente.abrirCierre();
      componente.formMotivo = 'Dos suites por teléfono';
      componente.formCantidad = 2;

      await componente.guardarCierre();

      expect(api['crearBloqueo'].mock.calls.at(-1)![0].cantidad).toBe(2);
    });

    it('debería recargar el periodo tras cerrar', async () => {
      await crear();
      componente.abrirCierre();
      componente.formMotivo = 'Vacaciones';

      await componente.guardarCierre();

      expect(componente.cierreAbierto()).toBe(false);
      expect(api['getBloqueos']).toHaveBeenCalledTimes(2);
    });

    it('debería avisar del fallo sin cerrar el diálogo', async () => {
      await crear();
      componente.abrirCierre();
      componente.formMotivo = 'Vacaciones';
      api['crearBloqueo'].mockReturnValue(throwError(() => new Error('500')));

      await componente.guardarCierre();

      expect(componente.errorModal()).toContain('No pudimos guardar');
      expect(componente.cierreAbierto()).toBe(true);
      expect(componente.guardando()).toBe(false);
    });
  });

  describe('reabrir un tramo', () => {
    it('debería borrarlo y recargar', async () => {
      await crear();

      await componente.reabrir({ _id: 'b1', servicioId: 's1', desde: '', hasta: '', motivo: 'X' });

      expect(api['eliminarBloqueo']).toHaveBeenCalledWith('b1');
      expect(componente.borrando()).toBeNull();
    });

    it('debería avisar si no se puede reabrir', async () => {
      await crear();
      api['eliminarBloqueo'].mockReturnValue(throwError(() => new Error('500')));

      await componente.reabrir({ _id: 'b1', servicioId: 's1', desde: '', hasta: '', motivo: 'X' });

      expect(componente.errorMsg()).toContain('No pudimos reabrir');
    });
  });

  describe('estados de carga', () => {
    it('debería avisar si no se puede cargar la agenda', async () => {
      api = {} as never;
      await TestBed.configureTestingModule({
        imports: [ComercioAgendaComponent],
        providers: [
          provideHttpClient(),
          provideHttpClientTesting(),
          {
            provide: ComercioApiService,
            useValue: { getMisServicios: jest.fn().mockReturnValue(throwError(() => new Error('500'))) },
          },
        ],
      }).compileComponents();

      const f = TestBed.createComponent(ComercioAgendaComponent);
      f.detectChanges();
      await f.whenStable();

      expect(f.componentInstance.errorMsg()).toContain('No pudimos cargar');
    });

    it('no debería pedir nada sin servicios', async () => {
      // Sin servicios no hay agenda que cargar: pedirla sería una llamada de más
      // y la pantalla ya dice qué hacer.
      const sinServicios = {
        getMisServicios: jest.fn().mockReturnValue(of([])),
        getBloqueos: jest.fn(),
        getCitasAgenda: jest.fn(),
      };
      await TestBed.configureTestingModule({
        imports: [ComercioAgendaComponent],
        providers: [
          provideHttpClient(),
          provideHttpClientTesting(),
          { provide: ComercioApiService, useValue: sinServicios },
        ],
      }).compileComponents();

      const f = TestBed.createComponent(ComercioAgendaComponent);
      f.detectChanges();
      await f.whenStable();

      expect(sinServicios.getBloqueos).not.toHaveBeenCalled();
      expect(f.componentInstance.servicios()).toEqual([]);
    });
  });
});

/** Clave `YYYY-MM-DD` local, la misma que usa el componente. */
function claveDe(fecha: Date): string {
  const mes = String(fecha.getMonth() + 1).padStart(2, '0');
  const dia = String(fecha.getDate()).padStart(2, '0');
  return `${fecha.getFullYear()}-${mes}-${dia}`;
}
