import { ComponentFixture, TestBed } from '@angular/core/testing';
import type { DiaCalendarioApi } from 'shared';
import { RsCalendarioRangoComponent, type RangoFechas } from './rs-calendario-rango.component';

const MS_POR_DIA = 24 * 60 * 60 * 1000;
const clave = (fecha: Date): string => fecha.toISOString().slice(0, 10);

/** Días del mes que viene, para que nunca caigan en el pasado al correr el test. */
const mesProximo = () => {
  const hoy = new Date();
  return { anio: hoy.getUTCFullYear(), mes: hoy.getUTCMonth() + 2 };
};

const diaDelMesProximo = (numero: number): string => {
  const { anio, mes } = mesProximo();
  return clave(new Date(Date.UTC(anio, mes - 1, numero)));
};

describe('RsCalendarioRangoComponent', () => {
  let fixture: ComponentFixture<RsCalendarioRangoComponent>;
  let componente: RsCalendarioRangoComponent;

  /** Un mes entero disponible, salvo las fechas que se pasen como llenas. */
  const mesCompleto = (llenas: string[] = []): DiaCalendarioApi[] => {
    const { anio, mes } = mesProximo();
    const dias = new Date(Date.UTC(anio, mes, 0)).getUTCDate();
    return Array.from({ length: dias }, (_, indice) => {
      const fecha = clave(new Date(Date.UTC(anio, mes - 1, indice + 1)));
      const lleno = llenas.includes(fecha);
      return { fecha, disponible: !lleno, plazasLibres: lleno ? 0 : 3 };
    });
  };

  const montar = async (dias: DiaCalendarioApi[], entrada: string | null = null, salida: string | null = null) => {
    await TestBed.configureTestingModule({ imports: [RsCalendarioRangoComponent] }).compileComponents();
    fixture = TestBed.createComponent(RsCalendarioRangoComponent);
    componente = fixture.componentInstance;
    fixture.componentRef.setInput('dias', dias);
    fixture.componentRef.setInput('entrada', entrada);
    fixture.componentRef.setInput('salida', salida);
    fixture.detectChanges();
    // El calendario abre en el mes actual; los tests trabajan sobre el siguiente.
    componente.mesSiguiente();
    fixture.detectChanges();
  };

  const celdaDe = (fecha: string) => componente.celdas().find((c) => c.fecha === fecha)!;

  it('debería deshabilitar los días sin plaza', async () => {
    const lleno = diaDelMesProximo(10);
    await montar(mesCompleto([lleno]));

    expect(celdaDe(lleno).seleccionable).toBe(false);
    expect(celdaDe(diaDelMesProximo(11)).seleccionable).toBe(true);
  });

  it('debería deshabilitar los días pasados aunque el API los dé por libres', async () => {
    const ayer = clave(new Date(Date.now() - MS_POR_DIA));
    await montar([{ fecha: ayer, disponible: true, plazasLibres: 5 }]);
    componente.mesAnterior();
    fixture.detectChanges();

    const celda = componente.celdas().find((c) => c.fecha === ayer);
    expect(celda?.seleccionable ?? false).toBe(false);
  });

  it('debería emitir la entrada en el primer clic, sin salida', async () => {
    await montar(mesCompleto());
    const emitido: RangoFechas[] = [];
    componente.rangoElegido.subscribe((r) => emitido.push(r));

    componente.elegir(celdaDe(diaDelMesProximo(10)));

    expect(emitido).toEqual([{ entrada: diaDelMesProximo(10), salida: null }]);
  });

  it('debería completar el rango en el segundo clic', async () => {
    await montar(mesCompleto(), diaDelMesProximo(10));
    const emitido: RangoFechas[] = [];
    componente.rangoElegido.subscribe((r) => emitido.push(r));

    componente.elegir(celdaDe(diaDelMesProximo(13)));

    expect(emitido).toEqual([{ entrada: diaDelMesProximo(10), salida: diaDelMesProximo(13) }]);
  });

  it('no debería dejar cerrar un rango que se salta una noche llena', async () => {
    // Elegida la entrada el 10, con el 12 completo, el 13 deja de ser salida
    // válida: esa estancia incluiría una noche que no existe.
    await montar(mesCompleto([diaDelMesProximo(12)]), diaDelMesProximo(10));

    expect(celdaDe(diaDelMesProximo(11)).seleccionable).toBe(true);
    expect(celdaDe(diaDelMesProximo(12)).seleccionable).toBe(true);
    expect(celdaDe(diaDelMesProximo(13)).seleccionable).toBe(false);
  });

  it('debería dejar salir el día que está lleno: esa noche ya no se ocupa', async () => {
    // Entrada el 10 y salida el 12 con el 12 completo: se duermen las noches
    // del 10 y del 11, y el 12 por la mañana se va.
    await montar(mesCompleto([diaDelMesProximo(12)]), diaDelMesProximo(10));

    expect(celdaDe(diaDelMesProximo(12)).seleccionable).toBe(true);
  });

  it('debería reiniciar la selección al pinchar antes de la entrada', async () => {
    await montar(mesCompleto(), diaDelMesProximo(10));
    const emitido: RangoFechas[] = [];
    componente.rangoElegido.subscribe((r) => emitido.push(r));

    componente.elegir(celdaDe(diaDelMesProximo(5)));

    expect(emitido).toEqual([{ entrada: diaDelMesProximo(5), salida: null }]);
  });

  it('debería marcar los días intermedios como parte del rango', async () => {
    await montar(mesCompleto(), diaDelMesProximo(10), diaDelMesProximo(13));

    expect(celdaDe(diaDelMesProximo(10)).esEntrada).toBe(true);
    expect(celdaDe(diaDelMesProximo(11)).enRango).toBe(true);
    expect(celdaDe(diaDelMesProximo(13)).esSalida).toBe(true);
    expect(celdaDe(diaDelMesProximo(13)).enRango).toBe(false);
  });

  it('debería avisar del cambio de mes para que se carguen esos días', async () => {
    await montar(mesCompleto());
    const meses: { anio: number; mes: number }[] = [];
    componente.mesCambiado.subscribe((m) => meses.push(m));

    componente.mesSiguiente();

    expect(meses).toHaveLength(1);
  });

  it('no debería dejar retroceder a meses ya pasados', async () => {
    await montar(mesCompleto());
    componente.mesAnterior();
    fixture.detectChanges();

    // Ya está en el mes actual: no se puede ir más atrás.
    expect(componente.puedeRetroceder()).toBe(false);
  });

  /**
   * No saber si una noche está libre no es saber que está llena. Bloquear lo
   * desconocido dejaba el calendario entero muerto cuando la consulta fallaba
   * o cuando el cliente iba a un mes todavía sin cargar.
   */
  describe('días sin datos', () => {
    it('debería dejar elegir un día que el API no ha contestado', async () => {
      await montar([]);

      expect(celdaDe(diaDelMesProximo(10)).seleccionable).toBe(true);
    });

    it('debería dejar cerrar un rango sobre días sin datos', async () => {
      await montar([], diaDelMesProximo(10));

      expect(celdaDe(diaDelMesProximo(13)).seleccionable).toBe(true);
    });

    it('debería seguir bloqueando el pasado aunque no haya datos', async () => {
      await montar([]);
      componente.mesAnterior();
      fixture.detectChanges();

      const ayer = clave(new Date(Date.now() - MS_POR_DIA));
      expect(componente.celdas().find((c) => c.fecha === ayer)?.seleccionable ?? false).toBe(false);
    });

    it('debería avisar de que no se pudo cargar la disponibilidad', async () => {
      await montar([]);

      expect(componente.pista()).toContain('No hemos podido cargar la disponibilidad');
    });
  });

  it('debería avisar cuando el mes entero está sin plazas, en vez de apagarlo sin más', async () => {
    const { anio, mes } = mesProximo();
    const dias = new Date(Date.UTC(anio, mes, 0)).getUTCDate();
    const todasLlenas = Array.from({ length: dias }, (_, i) =>
      clave(new Date(Date.UTC(anio, mes - 1, i + 1))));
    await montar(mesCompleto(todasLlenas));

    expect(componente.pista()).toContain('Sin plazas libres');
  });
});
