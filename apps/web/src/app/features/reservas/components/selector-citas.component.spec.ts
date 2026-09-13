import { Component, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import type { HuecosDelDiaRespuestaApi } from 'shared';
import { SelectorCitasComponent } from './selector-citas.component';
import { ReservasService } from '../services/reservas.service';

@Component({
  standalone: true,
  imports: [SelectorCitasComponent, ReactiveFormsModule],
  template: `<dk-selector-citas [formControl]="hora" [servicioId]="servicioId()" [fecha]="fecha()" [servicio]="servicio()" />`,
})
class AnfitrionComponent {
  readonly hora = new FormControl('');
  readonly servicioId = signal<string | null>('s1');
  readonly fecha = signal<string | null>('2026-09-21');
  readonly servicio = signal<string | null>('Baño');
}

const abierto: HuecosDelDiaRespuestaApi = {
  soportado: true,
  estado: 'abierto',
  duracionMin: 45,
  huecos: [
    { hora: '09:00', inicio: '2026-09-21T07:00:00.000Z', disponible: true },
    { hora: '09:30', inicio: '2026-09-21T07:30:00.000Z', disponible: false },
    { hora: '16:00', inicio: '2026-09-21T14:00:00.000Z', disponible: true },
  ],
};

describe('SelectorCitasComponent', () => {
  let fixture: ComponentFixture<AnfitrionComponent>;
  let anfitrion: AnfitrionComponent;
  let huecosDelDia: jest.Mock;

  const esperar = async () => {
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  };
  const el = () => fixture.nativeElement as HTMLElement;
  const botones = () => Array.from(el().querySelectorAll<HTMLButtonElement>('button.cita'));

  beforeEach(async () => {
    huecosDelDia = jest.fn().mockResolvedValue(abierto);
    await TestBed.configureTestingModule({
      imports: [AnfitrionComponent],
      providers: [{ provide: ReservasService, useValue: { huecosDelDia } }],
    }).compileComponents();
    fixture = TestBed.createComponent(AnfitrionComponent);
    anfitrion = fixture.componentInstance;
  });

  it('debería pedir las citas del día y agruparlas en mañana y tarde', async () => {
    await esperar();

    expect(huecosDelDia).toHaveBeenCalledWith({ servicioId: 's1', fecha: '2026-09-21', servicio: 'Baño', perroId: undefined, cantidad: undefined });
    expect(botones().map((b) => b.textContent?.trim())).toEqual(['09:00', '09:30', '16:00']);
    expect(el().textContent).toContain('Mañana');
    expect(el().textContent).toContain('Tarde');
    expect(el().textContent).toContain('Citas de 45 min.');
    expect(botones()[1].disabled).toBe(true);
  });

  it('debería fijar la hora elegida en el formulario y marcarla', async () => {
    await esperar();

    botones()[2].click();
    fixture.detectChanges();

    expect(anfitrion.hora.value).toBe('16:00');
    expect(anfitrion.hora.touched).toBe(true);
    expect(botones()[2].classList).toContain('cita--elegida');
    expect(botones()[2].getAttribute('aria-checked')).toBe('true');
  });

  it('debería borrar la hora elegida si al cambiar de día ya no está libre', async () => {
    anfitrion.hora.setValue('09:00');
    await esperar();
    expect(anfitrion.hora.value).toBe('09:00');

    huecosDelDia.mockResolvedValue({ ...abierto, huecos: [{ hora: '09:00', inicio: 'x', disponible: false }] });
    anfitrion.fecha.set('2026-09-22');
    await esperar();

    expect(anfitrion.hora.value).toBe('');
    expect(el().querySelector('[data-testid="citas-completo"]')).not.toBeNull();
  });

  it('debería pedir el día antes de mostrar citas', async () => {
    anfitrion.fecha.set(null);
    await esperar();

    expect(huecosDelDia).not.toHaveBeenCalled();
    expect(el().textContent).toContain('Elige primero el día');
  });

  it('debería explicar por qué un día no tiene citas', async () => {
    huecosDelDia.mockResolvedValue({ soportado: true, estado: 'cerrado', motivo: 'El comercio no atiende ese día de la semana.', huecos: [] });
    await esperar();

    expect(el().querySelector('[data-testid="citas-cerrado"]')?.textContent).toContain('no atiende ese día');
  });

  it('debería avisar de que el horario es orientativo si el comercio no lo ha puesto', async () => {
    huecosDelDia.mockResolvedValue({ ...abierto, estado: 'sin_horario', duracionMin: undefined });
    await esperar();

    expect(el().textContent).toContain('Horario orientativo');
    expect(el().textContent).not.toContain('Citas de');
  });

  it('debería volver al campo de hora si el servicio no va por citas o la consulta falla', async () => {
    huecosDelDia.mockResolvedValue({ soportado: false, estado: 'sin_horario', huecos: [] });
    await esperar();

    const campo = el().querySelector<HTMLInputElement>('[data-testid="hora-manual"]')!;
    campo.value = '11:15';
    campo.dispatchEvent(new Event('input'));
    campo.dispatchEvent(new Event('blur'));
    expect(anfitrion.hora.value).toBe('11:15');
    expect(anfitrion.hora.touched).toBe(true);

    huecosDelDia.mockImplementation(() => Promise.reject(new Error('red')));
    anfitrion.servicio.set('Corte');
    await esperar();
    expect(el().textContent).toContain('No hemos podido cargar las citas');
  });

  it('debería quedarse con la última consulta si llegan desordenadas', async () => {
    let resolverLenta!: (r: HuecosDelDiaRespuestaApi) => void;
    huecosDelDia.mockReturnValueOnce(new Promise((r) => { resolverLenta = r; }));
    fixture.detectChanges();

    huecosDelDia.mockResolvedValueOnce({ ...abierto, huecos: [abierto.huecos[2]] });
    anfitrion.fecha.set('2026-09-23');
    await esperar();
    resolverLenta(abierto);
    await esperar();

    expect(botones().map((b) => b.textContent?.trim())).toEqual(['16:00']);
  });

  it('debería deshabilitar las citas si el control está deshabilitado', async () => {
    await esperar();
    anfitrion.hora.disable();
    fixture.detectChanges();

    expect(botones().every((b) => b.disabled)).toBe(true);

    anfitrion.hora.enable();
    fixture.detectChanges();
    expect(botones()[0].disabled).toBe(false);
  });
});
