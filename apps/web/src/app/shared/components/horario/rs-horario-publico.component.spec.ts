import { ComponentFixture, TestBed } from '@angular/core/testing';
import type { HorarioDiaDto } from 'shared';
import { RsHorarioPublicoComponent } from './rs-horario-publico.component';

describe('RsHorarioPublicoComponent', () => {
  let fixture: ComponentFixture<RsHorarioPublicoComponent>;
  let componente: RsHorarioPublicoComponent;

  const crear = async (): Promise<void> => {
    await TestBed.configureTestingModule({ imports: [RsHorarioPublicoComponent] }).compileComponents();
    fixture = TestBed.createComponent(RsHorarioPublicoComponent);
    componente = fixture.componentInstance;
    fixture.detectChanges();
  };

  const semana = (extra: Partial<HorarioDiaDto> = {}): HorarioDiaDto[] => ([
    { dia: 'lunes', abre: '09:00', cierra: '20:00', cerrado: false, ...extra },
    { dia: 'domingo', cerrado: true },
  ]);

  /** Fecha ISO a N días de hoy, para no atarse a un año concreto. */
  const enDias = (dias: number): string => {
    const d = new Date();
    d.setDate(d.getDate() + dias);
    return d.toISOString().slice(0, 10);
  };

  describe('cuándo se pinta', () => {
    it('no debería pintar nada sin horario', async () => {
      // Una tabla vacía estorba más de lo que informa.
      await crear();

      expect(componente.hayHorario()).toBe(false);
    });

    it('no debería pintar nada si todos los días llegan en blanco', async () => {
      await crear();
      fixture.componentRef.setInput('horario', [{ dia: 'lunes', cerrado: false }]);

      expect(componente.hayHorario()).toBe(false);
    });

    it('debería pintar si algún día tiene horas', async () => {
      await crear();
      fixture.componentRef.setInput('horario', semana());

      expect(componente.hayHorario()).toBe(true);
    });

    it('debería pintar si algún día está cerrado a propósito', async () => {
      await crear();
      fixture.componentRef.setInput('horario', [{ dia: 'domingo', cerrado: true }]);

      expect(componente.hayHorario()).toBe(true);
    });
  });

  describe('semana', () => {
    it('debería leer «Cerrado» en vez de un guion', async () => {
      await crear();
      fixture.componentRef.setInput('horario', semana());

      expect(componente.semana().find((d) => d.dia === 'domingo')!.horas).toBe('Cerrado');
    });

    it('debería juntar los dos tramos de la jornada partida', async () => {
      await crear();
      fixture.componentRef.setInput('horario', semana({ abre2: '17:00', cierra2: '20:30' }));

      expect(componente.semana()[0].horas).toBe('09:00 – 20:00 · 17:00 – 20:30');
    });

    it('debería decir «Consultar» si el día está abierto pero sin horas', async () => {
      await crear();
      fixture.componentRef.setInput('horario', [{ dia: 'lunes', cerrado: false }]);

      expect(componente.semana()[0].horas).toBe('Consultar');
    });

    it('debería señalar el día de hoy, que es el que se busca al abrir la ficha', async () => {
      await crear();
      const dias = ['domingo', 'lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado'];
      const hoy = dias[new Date().getDay()];
      fixture.componentRef.setInput('horario', dias.map((dia) => ({ dia, cerrado: true })));

      expect(componente.semana().filter((d) => d.esHoy).map((d) => d.dia)).toEqual([hoy]);
    });
  });

  describe('días especiales', () => {
    it('debería esconder los que ya pasaron', async () => {
      // Un festivo del año pasado no cambia la decisión de nadie.
      await crear();
      fixture.componentRef.setInput('excepciones', [
        { fecha: enDias(-30), cerrado: true, motivo: 'Pasado' },
        { fecha: enDias(30), cerrado: true, motivo: 'Futuro' },
      ]);

      expect(componente.especialesProximos().map((e) => e.motivo)).toEqual(['Futuro']);
    });

    it('debería ordenarlos por fecha', async () => {
      await crear();
      fixture.componentRef.setInput('excepciones', [
        { fecha: enDias(20), cerrado: true, motivo: 'Después' },
        { fecha: enDias(5), cerrado: true, motivo: 'Antes' },
      ]);

      expect(componente.especialesProximos().map((e) => e.motivo)).toEqual(['Antes', 'Después']);
    });

    it('debería quedarse en seis, para que la lista se lea de un vistazo', async () => {
      await crear();
      fixture.componentRef.setInput('excepciones',
        Array.from({ length: 10 }, (_, i) => ({ fecha: enDias(i + 1), cerrado: true })));

      expect(componente.especialesProximos()).toHaveLength(6);
    });

    it('debería enseñar el horario reducido de un día que no cierra del todo', async () => {
      await crear();
      fixture.componentRef.setInput('excepciones',
        [{ fecha: enDias(3), cerrado: false, abre: '10:00', cierra: '14:00' }]);

      expect(componente.especialesProximos()[0].horas).toBe('10:00 – 14:00');
    });

    it('debería mostrar la fecha en formato legible, no en ISO', async () => {
      await crear();
      const fecha = enDias(3);
      fixture.componentRef.setInput('excepciones', [{ fecha, cerrado: true }]);

      expect(componente.especialesProximos()[0].fechaLegible).not.toBe(fecha);
    });
  });
});
