import { ComponentFixture, TestBed } from '@angular/core/testing';
import { RsHorarioComponent, semanaVacia } from './rs-horario.component';

describe('RsHorarioComponent', () => {
  let fixture: ComponentFixture<RsHorarioComponent>;
  let componente: RsHorarioComponent;

  const crear = async (): Promise<void> => {
    await TestBed.configureTestingModule({ imports: [RsHorarioComponent] }).compileComponents();
    fixture = TestBed.createComponent(RsHorarioComponent);
    componente = fixture.componentInstance;
    fixture.detectChanges();
  };

  /** Primer día del calendario que se puede marcar; el mes en curso trae días pasados. */
  const primerDisponible = () => {
    componente.cambiarMes(1);
    return componente.celdas().find((c) => c.delMes && !c.pasado && !c.yaEsExcepcion)!;
  };

  describe('semana', () => {
    it('debería arrancar con los siete días', async () => {
      // Un día ausente y un día cerrado no significan lo mismo en la ficha.
      await crear();

      expect(componente.horario()).toHaveLength(7);
      expect(componente.horario().map((d) => d.dia)).toContain('domingo');
    });

    it('debería alternar el cierre de un día', async () => {
      await crear();

      componente.alternarCerrado(0);

      expect(componente.horario()[0].cerrado).toBe(true);
    });

    it('debería guardar la hora que se teclea en su día y su tramo', async () => {
      await crear();

      componente.fijarHora(2, 'abre2', { target: { value: '17:00' } } as unknown as Event);

      expect(componente.horario()[2].abre2).toBe('17:00');
      // No debe tocar los demás días.
      expect(componente.horario()[1].abre2).toBe('');
    });

    it('debería copiar el lunes al resto de días', async () => {
      await crear();
      componente.fijarHora(0, 'abre', { target: { value: '08:00' } } as unknown as Event);
      componente.fijarHora(0, 'cierra', { target: { value: '15:00' } } as unknown as Event);

      componente.copiarLunesATodos();

      expect(componente.horario().every((d) => d.abre === '08:00' && d.cierra === '15:00')).toBe(true);
    });

    it('debería devolver un hueco si el horario llega incompleto', async () => {
      // Los servicios creados antes de que el horario colgara del listado
      // pueden llegar con menos de siete días.
      await crear();
      componente.horario.set([{ dia: 'lunes', cerrado: false }]);

      expect(componente.diaDe(5)).toMatchObject({ dia: 'sabado', cerrado: false });
    });
  });

  describe('días especiales', () => {
    it('debería empezar sin ningún día marcado', async () => {
      await crear();

      expect(componente.totalSeleccionados()).toBe(0);
    });

    it('debería pintar seis semanas empezando en lunes', async () => {
      await crear();

      expect(componente.celdas()).toHaveLength(42);
    });

    it('debería marcar y desmarcar un día al pulsarlo', async () => {
      await crear();
      const celda = primerDisponible();

      componente.alternarDia(celda);
      expect(componente.totalSeleccionados()).toBe(1);

      componente.alternarDia(celda);
      expect(componente.totalSeleccionados()).toBe(0);
    });

    it('no debería dejar marcar un día que ya pasó', async () => {
      // Marcar un festivo pasado no cambia nada; invitar a hacerlo confunde.
      await crear();

      componente.alternarDia({ clave: '2020-01-01', pasado: true, yaEsExcepcion: false });

      expect(componente.totalSeleccionados()).toBe(0);
    });

    it('debería aplicar el mismo motivo y horario a todos los días marcados', async () => {
      await crear();
      componente.alternarDia(primerDisponible());
      componente.motivo.set('Vacaciones');

      componente.anadirSeleccionados();

      expect(componente.excepciones()).toHaveLength(1);
      expect(componente.excepciones()[0]).toMatchObject({ motivo: 'Vacaciones', cerrado: true });
    });

    it('debería guardar el horario reducido cuando el día no se cierra del todo', async () => {
      await crear();
      componente.alternarDia(primerDisponible());
      componente.cerradoTodoElDia.set(false);
      componente.abre.set('10:00');
      componente.cierra.set('14:00');

      componente.anadirSeleccionados();

      expect(componente.excepciones()[0]).toMatchObject({ cerrado: false, abre: '10:00', cierra: '14:00' });
    });

    it('debería limpiar la selección y el motivo tras aplicarlos', async () => {
      await crear();
      componente.alternarDia(primerDisponible());
      componente.motivo.set('Puente');

      componente.anadirSeleccionados();

      expect(componente.totalSeleccionados()).toBe(0);
      expect(componente.motivo()).toBe('');
    });

    it('no debería hacer nada sin días marcados', async () => {
      await crear();

      componente.anadirSeleccionados();

      expect(componente.excepciones()).toEqual([]);
    });

    it('debería marcar de golpe todo el mes visible', async () => {
      await crear();
      componente.cambiarMes(1);

      componente.marcarMesEntero();

      expect(componente.totalSeleccionados()).toBeGreaterThan(27);
    });

    it('debería poder quitar toda la selección', async () => {
      await crear();
      componente.cambiarMes(1);
      componente.marcarMesEntero();

      componente.limpiarSeleccion();

      expect(componente.totalSeleccionados()).toBe(0);
    });

    it('debería reemplazar el día si ya existía, no duplicarlo', async () => {
      // El calendario deshabilita los días ya puestos, pero uno guardado antes
      // puede volver a entrar en la selección al recargar la ficha; entonces
      // manda lo último, no se apilan dos entradas para la misma fecha.
      await crear();
      const celda = primerDisponible();
      componente.alternarDia(celda);
      componente.excepciones.set([{ fecha: celda.clave, cerrado: false, motivo: 'Antigua' }]);
      componente.motivo.set('Nueva');

      componente.anadirSeleccionados();

      const delDia = componente.excepciones().filter((e) => e.fecha === celda.clave);
      expect(delDia).toHaveLength(1);
      expect(delDia[0].motivo).toBe('Nueva');
    });

    it('debería quitar un día especial de la lista', async () => {
      await crear();
      componente.excepciones.set([{ fecha: '2026-12-25', cerrado: true }]);

      componente.quitar('2026-12-25');

      expect(componente.excepciones()).toEqual([]);
    });

    it('debería marcar en el calendario los días ya guardados', async () => {
      await crear();
      componente.cambiarMes(1);
      const celda = componente.celdas().find((c) => c.delMes && !c.pasado)!;
      componente.excepciones.set([{ fecha: celda.clave, cerrado: true }]);

      expect(componente.celdas().find((c) => c.clave === celda.clave)!.yaEsExcepcion).toBe(true);
    });

    it('debería moverse de mes hacia delante y hacia atrás', async () => {
      await crear();
      const inicial = componente.nombreMes();

      componente.cambiarMes(1);
      expect(componente.nombreMes()).not.toBe(inicial);

      componente.cambiarMes(-1);
      expect(componente.nombreMes()).toBe(inicial);
    });

    it('debería mostrar la fecha en formato legible, no en ISO', async () => {
      await crear();

      const texto = componente.fechaLarga('2026-08-03');

      expect(texto).not.toBe('2026-08-03');
      expect(texto).toContain('2026');
    });
  });

  describe('festivos nacionales', () => {
    it('debería marcarlos todos como cerrados de una vez', async () => {
      await crear();

      componente.anadirFestivosNacionales();

      expect(componente.excepciones().length).toBeGreaterThan(5);
      expect(componente.excepciones().every((e) => e.cerrado)).toBe(true);
    });

    it('debería nombrar cada festivo, no dejarlo sin motivo', async () => {
      // El motivo es lo que el cliente lee en la ficha.
      await crear();

      componente.anadirFestivosNacionales();

      expect(componente.excepciones().every((e) => !!e.motivo)).toBe(true);
    });

    it('no debería duplicar los que ya estén puestos', async () => {
      await crear();
      componente.anadirFestivosNacionales();
      const total = componente.excepciones().length;

      componente.anadirFestivosNacionales();

      expect(componente.excepciones()).toHaveLength(total);
    });

    it('no debería pisar un festivo que el comercio dejó abierto a propósito', async () => {
      // Cerrárselo de nuevo sería deshacerle una decisión suya.
      await crear();
      const festivo = componente.festivosPorAnadir()[0];
      componente.excepciones.set([{ fecha: festivo.fecha, cerrado: false, abre: '10:00', cierra: '14:00' }]);

      componente.anadirFestivosNacionales();

      const guardado = componente.excepciones().filter((e) => e.fecha === festivo.fecha);
      expect(guardado).toHaveLength(1);
      expect(guardado[0].cerrado).toBe(false);
    });

    it('debería quedarse sin nada que añadir tras marcarlos', async () => {
      await crear();

      componente.anadirFestivosNacionales();

      expect(componente.festivosPorAnadir()).toEqual([]);
    });

    it('no debería hacer nada si no queda ninguno por marcar', async () => {
      await crear();
      componente.anadirFestivosNacionales();
      const antes = componente.excepciones();

      componente.anadirFestivosNacionales();

      expect(componente.excepciones()).toBe(antes);
    });

    it('debería dejarlos ordenados por fecha', async () => {
      await crear();

      componente.anadirFestivosNacionales();

      const fechas = componente.excepciones().map((e) => e.fecha);
      expect(fechas).toEqual([...fechas].sort());
    });
  });

  describe('semanaVacia', () => {
    it('debería dar los siete días abiertos y sin horas', () => {
      const semana = semanaVacia();

      expect(semana).toHaveLength(7);
      expect(semana.every((d) => !d.cerrado && d.abre === '')).toBe(true);
    });
  });
});
