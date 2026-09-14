import { Component, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import type { AgendaCitasRespuestaApi } from 'shared';
import { SelectorDiaComponent } from './selector-dia.component';
import { ReservasService } from '../services/reservas.service';

@Component({
  standalone: true,
  imports: [SelectorDiaComponent, ReactiveFormsModule],
  template: `<dk-selector-dia [formControl]="fecha" [servicioId]="servicioId()" [servicio]="servicio()" />`,
})
class AnfitrionComponent {
  readonly fecha = new FormControl('');
  readonly servicioId = signal<string | null>('s1');
  readonly servicio = signal<string | null>('Baño');
}

/** Hoy queda fijo: el calendario arranca en el mes en curso y sin esto viaja. */
const HOY = new Date('2026-09-14T10:00:00Z');

const agenda = (dias: AgendaCitasRespuestaApi['dias'], extra: Partial<AgendaCitasRespuestaApi> = {})
: AgendaCitasRespuestaApi => ({ soportado: true, duracionMin: 45, dias, ...extra });

describe('SelectorDiaComponent', () => {
  let fixture: ComponentFixture<AnfitrionComponent>;
  let anfitrion: AnfitrionComponent;
  let pedirAgenda: jest.Mock;

  const esperar = async () => {
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  };
  const el = () => fixture.nativeElement as HTMLElement;
  const texto = () => el().textContent ?? '';
  const dias = () => Array.from(el().querySelectorAll<HTMLButtonElement>('button.cal__dia'));
  const diaDe = (numero: number) => dias().find((b) => b.textContent?.trim() === String(numero));

  beforeEach(async () => {
    jest.useFakeTimers({ doNotFake: ['setTimeout', 'queueMicrotask'] }).setSystemTime(HOY);
    pedirAgenda = jest.fn().mockResolvedValue(agenda([
      { fecha: '2026-09-14', estado: 'cerrado', huecosLibres: 0, motivo: 'El comercio no atiende ese día de la semana.' },
      { fecha: '2026-09-15', estado: 'completo', huecosLibres: 0 },
      { fecha: '2026-09-16', estado: 'libre', huecosLibres: 4, primeraHora: '10:00' },
      { fecha: '2026-09-17', estado: 'libre', huecosLibres: 2, primeraHora: '09:00' },
    ], { primeraLibre: { fecha: '2026-09-16', hora: '10:00' } }));

    await TestBed.configureTestingModule({
      imports: [AnfitrionComponent],
      providers: [{ provide: ReservasService, useValue: { agenda: pedirAgenda } }],
    }).compileComponents();
    fixture = TestBed.createComponent(AnfitrionComponent);
    anfitrion = fixture.componentInstance;
  });

  afterEach(() => { jest.useRealTimers(); });

  /* Del mes en curso sólo se pide lo que queda por delante: los días pasados
     no se pueden reservar y consultarlos es trabajo tirado. */
  it('debería pedir la agenda desde hoy hasta el fin del mes', async () => {
    await esperar();

    expect(pedirAgenda).toHaveBeenCalledWith({
      servicioId: 's1', desde: '2026-09-14', hasta: '2026-09-30',
      servicio: 'Baño', perroId: undefined, cantidad: undefined,
    });
  });

  /*
   * El corazón del cambio: antes el cliente escribía una fecha a ciegas y sólo
   * al cargar las horas se enteraba de que ese día no había nada.
   */
  it('debería adelantar el primer día libre sin que el cliente toque nada', async () => {
    await esperar();

    expect(anfitrion.fecha.value).toBe('2026-09-16');
    expect(texto()).toContain('4 citas libres');
  });

  it('debería ofrecer la primera cita libre como atajo, con su día y su hora', async () => {
    await esperar();

    const atajo = el().querySelector<HTMLButtonElement>('[data-testid="atajo-primera-cita"]');
    expect(atajo?.textContent).toContain('mié 16 sep');
    expect(atajo?.textContent).toContain('10:00');
  });

  it('debería dejar elegir sólo los días con cita libre', async () => {
    await esperar();

    expect(diaDe(15)?.disabled).toBe(true);  // completo
    expect(diaDe(17)?.disabled).toBe(false); // libre

    diaDe(17)!.click();
    await esperar();

    expect(anfitrion.fecha.value).toBe('2026-09-17');
    expect(texto()).toContain('2 citas libres');
  });

  it('no debería pisar el día que ya eligió el cliente al recargar la agenda', async () => {
    await esperar();
    diaDe(17)!.click();
    await esperar();

    anfitrion.servicio.set('Corte');
    pedirAgenda.mockResolvedValue(agenda(
      [{ fecha: '2026-09-20', estado: 'libre', huecosLibres: 1, primeraHora: '11:00' }],
      { primeraLibre: { fecha: '2026-09-20', hora: '11:00' } },
    ));
    await esperar();

    expect(anfitrion.fecha.value).toBe('2026-09-17');
  });

  it('debería avisar cuando el mes entero se queda sin citas', async () => {
    pedirAgenda.mockResolvedValue(agenda([
      { fecha: '2026-09-14', estado: 'completo', huecosLibres: 0 },
      { fecha: '2026-09-15', estado: 'cerrado', huecosLibres: 0 },
    ]));
    await esperar();

    expect(el().querySelector('[data-testid="mes-sin-citas"]')).not.toBeNull();
    expect(anfitrion.fecha.value).toBe('');
  });

  it('debería explicar por qué no hay nada que reservar en vez de pintar un calendario vacío', async () => {
    pedirAgenda.mockResolvedValue({ soportado: true, dias: [], motivo: 'No quedan citas libres en esta peluquería.' });
    await esperar();

    expect(el().querySelector('[data-testid="agenda-sin-citas"]')?.textContent)
      .toContain('No quedan citas libres');
    expect(dias()).toHaveLength(0);
  });

  /* Degradar al campo de siempre, nunca bloquear la reserva. */
  it('debería caer al campo de fecha si el servicio no se reserva por citas', async () => {
    pedirAgenda.mockResolvedValue({ soportado: false, dias: [] });
    await esperar();

    expect(el().querySelector('[data-testid="fecha-manual"]')).not.toBeNull();
  });

  it('debería caer al campo de fecha si la consulta falla', async () => {
    pedirAgenda.mockRejectedValue(new Error('red caída'));
    await esperar();

    const manual = el().querySelector<HTMLInputElement>('[data-testid="fecha-manual"]');
    expect(manual).not.toBeNull();

    manual!.value = '2026-09-25';
    manual!.dispatchEvent(new Event('input'));
    expect(anfitrion.fecha.value).toBe('2026-09-25');
  });

  /* Volver al mes anterior al comparar días es lo más normal del mundo; sin
     caché cada vaivén era otra consulta al API. */
  it('no debería volver a consultar un mes que ya tiene', async () => {
    await esperar();
    expect(pedirAgenda).toHaveBeenCalledTimes(1);

    el().querySelector<HTMLButtonElement>('.cal__nav:last-of-type')!.click();
    await esperar();
    expect(pedirAgenda).toHaveBeenCalledTimes(2);
    expect(pedirAgenda.mock.calls[1][0]).toMatchObject({ desde: '2026-10-01', hasta: '2026-10-31' });

    el().querySelector<HTMLButtonElement>('.cal__nav')!.click();
    await esperar();
    expect(pedirAgenda).toHaveBeenCalledTimes(2);
  });
});
