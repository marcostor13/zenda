import { Component } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { ActivatedRoute, Router, convertToParamMap } from '@angular/router';
import { RouterTestingModule } from '@angular/router/testing';
import { of } from 'rxjs';
import { VerticalKey } from 'shared';
import { By } from '@angular/platform-browser';
import { RsCalendarioRangoComponent } from '../calendario-rango/rs-calendario-rango.component';
import { RsSearchBarComponent } from './rs-search-bar.component';

/** Host mínimo para poder fijar los inputs de señal del buscador. */
@Component({
  standalone: true,
  imports: [RsSearchBarComponent],
  template: `<rs-search-bar [vertical]="vertical" [variant]="variant"
                            [buscarAlCambiar]="buscarAlCambiar" [categorias]="categorias" />`,
})
class HostComponent {
  vertical = VerticalKey.ALOJAMIENTO as string;
  variant: 'card' | 'strip' = 'card';
  buscarAlCambiar = false;
  categorias = true;
}

describe('RsSearchBarComponent', () => {
  let fixture: ComponentFixture<HostComponent>;
  let bar: RsSearchBarComponent;
  let router: Router;

  const crear = async (queryParams: Record<string, string> = {}): Promise<void> => {
    await TestBed.configureTestingModule({
      imports: [HostComponent, RouterTestingModule],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        {
          provide: ActivatedRoute,
          useValue: {
            snapshot: { queryParamMap: convertToParamMap(queryParams) },
            queryParams: of(queryParams),
          },
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(HostComponent);
    fixture.detectChanges();
    bar = fixture.debugElement.children[0].componentInstance;
    router = TestBed.inject(Router);
  };

  it('debería crear el componente con alojamiento por defecto', async () => {
    await crear();
    expect(bar.activo().key).toBe(VerticalKey.ALOJAMIENTO);
  });

  it('debería traer la fila de categorías por defecto', async () => {
    await crear();
    const cats = (fixture.nativeElement as HTMLElement).querySelector('.sb__cats');

    expect(cats).toBeTruthy();
  });

  it('debería poder prescindir de la fila de categorías', async () => {
    // Las pantallas con buscador las ofrecen en el encabezado: dentro de la
    // tarjeta serían las mismas entradas dos veces.
    await crear();
    fixture.componentInstance.categorias = false;
    fixture.detectChanges();

    expect((fixture.nativeElement as HTMLElement).querySelector('.sb__cats')).toBeNull();
  });

  it('debería inicializarse con los filtros que llegan en la URL', async () => {
    await crear({ ciudad: 'Madrid', desde: '2026-08-01', hasta: '2026-08-05', perros: '3' });

    expect(bar.formulario.getRawValue()).toEqual({
      ciudad: 'Madrid',
      desde: '2026-08-01',
      hasta: '2026-08-05',
      hora: '',
    });
    expect(bar.numPerros()).toBe(3);
  });

  it('debería recuperar las mascotas elegidas desde la URL', async () => {
    await crear({ perroIds: 'perro-1,perro-2', perros: '2' });

    expect(bar.perroIds()).toEqual(['perro-1', 'perro-2']);
    expect(bar.numPerros()).toBe(2);
  });

  it('debería navegar al listado del vertical con los filtros', async () => {
    await crear();
    const navigateSpy = jest.spyOn(router, 'navigate').mockResolvedValue(true);
    bar.formulario.patchValue({ ciudad: 'Madrid', desde: '2026-08-01', hasta: '2026-08-05' });
    bar.numPerros.set(2);

    bar.buscar();

    expect(navigateSpy).toHaveBeenCalledWith(['/alojamiento'], {
      queryParams: {
        ciudad: 'Madrid', desde: '2026-08-01', hasta: '2026-08-05',
        hora: null, perros: 2, perroIds: null, lat: null, lng: null,
      },
      queryParamsHandling: 'merge',
    });
  });

  it('no debería limitar el número de perros de la búsqueda', async () => {
    await crear();
    const navigateSpy = jest.spyOn(router, 'navigate').mockResolvedValue(true);
    bar.numPerros.set(7);

    bar.buscar();

    expect(navigateSpy).toHaveBeenCalledWith(
      ['/alojamiento'],
      expect.objectContaining({ queryParams: expect.objectContaining({ perros: 7 }) }),
    );
  });

  it('nunca debería buscar menos perros que mascotas elegidas', async () => {
    await crear();
    jest.spyOn(router, 'navigate').mockResolvedValue(true);
    const emitido = jest.fn();
    bar.buscado.subscribe(emitido);
    bar.perroIds.set(['perro-1', 'perro-2', 'perro-3']);
    bar.numPerros.set(1);

    bar.buscar();

    expect(emitido).toHaveBeenCalledWith(expect.objectContaining({ perros: 3 }));
  });

  it('debería descartar la fecha de salida en las categorías de cita', async () => {
    await crear();
    const navigateSpy = jest.spyOn(router, 'navigate').mockResolvedValue(true);
    bar.formulario.patchValue({ desde: '2026-08-01', hasta: '2026-08-05' });

    bar.seleccionarVertical(VerticalKey.VETERINARIA);

    expect(navigateSpy).toHaveBeenCalledWith(['/veterinaria'], {
      queryParams: {
        ciudad: null, desde: '2026-08-01', hasta: null,
        hora: null, perros: 1, perroIds: null, lat: null, lng: null,
      },
      queryParamsHandling: 'merge',
    });
  });

  it('debería mostrar la salida solo cuando la reserva es por noches', async () => {
    await crear();
    jest.spyOn(router, 'navigate').mockResolvedValue(true);
    const el: HTMLElement = fixture.nativeElement;
    expect(el.querySelector('#sb-hasta')).toBeTruthy();

    bar.seleccionarVertical(VerticalKey.PELUQUERIA);
    fixture.detectChanges();
    expect(el.querySelector('#sb-hasta')).toBeNull();
  });

  it('debería pedir la hora en las categorías que reservan por slot', async () => {
    await crear();
    jest.spyOn(router, 'navigate').mockResolvedValue(true);
    const el: HTMLElement = fixture.nativeElement;
    // Alojamiento reserva por noches: no tiene sentido pedir hora.
    expect(el.querySelector('#sb-hora')).toBeNull();

    bar.seleccionarVertical(VerticalKey.PELUQUERIA);
    fixture.detectChanges();
    expect(el.querySelector('#sb-hora')).toBeTruthy();
  });

  it('debería adaptar las etiquetas a la categoría activa', async () => {
    await crear();
    jest.spyOn(router, 'navigate').mockResolvedValue(true);
    expect(bar.activo().labelFecha).toBe('Ingreso');
    expect(bar.activo().labelUbicacion).toBe('¿Dónde buscas el servicio?');

    bar.seleccionarVertical(VerticalKey.TRANSPORTE);
    expect(bar.activo().labelFecha).toBe('Fecha del traslado');
    expect(bar.activo().labelUbicacion).toBe('Recogida');
  });

  it('debería llevar al resultado al pulsar una categoría, sin botón de por medio', async () => {
    await crear();
    const navigateSpy = jest.spyOn(router, 'navigate').mockResolvedValue(true);

    bar.seleccionarVertical(VerticalKey.HOTELES);

    expect(navigateSpy).toHaveBeenCalledWith(['/hoteles'], expect.anything());
  });

  it('debería conservar el botón "Buscar" en el home y quitarlo sobre los listados', async () => {
    await crear();
    const el: HTMLElement = fixture.nativeElement;
    expect(el.querySelector('.sb__cta')).toBeTruthy();

    fixture.componentInstance.variant = 'strip';
    fixture.detectChanges();
    expect(el.querySelector('.sb__cta')).toBeNull();
  });

  describe('elegir población', () => {
    const MADRID = { ciudad: 'Madrid', lat: 40.41, lng: -3.7 };

    it('no debería buscar al elegir la población en el home', async () => {
      // Salir disparado al listado al pulsar la ciudad dejaba fuera las fechas
      // y las mascotas que el usuario aún no había puesto (feedback 2026-08-30).
      await crear();
      const navigateSpy = jest.spyOn(router, 'navigate').mockResolvedValue(true);

      bar.elegirPoblacion(MADRID);

      expect(navigateSpy).not.toHaveBeenCalled();
    });

    it('debería guardar las coordenadas para la búsqueda que venga después', async () => {
      await crear();
      const navigateSpy = jest.spyOn(router, 'navigate').mockResolvedValue(true);
      bar.elegirPoblacion(MADRID);

      bar.buscar();

      expect(navigateSpy).toHaveBeenCalledWith(
        ['/alojamiento'],
        expect.objectContaining({
          queryParams: expect.objectContaining({ lat: 40.41, lng: -3.7 }),
        }),
      );
    });

    it('debería buscar al momento sobre un listado, donde no hay botón', async () => {
      await crear();
      fixture.componentInstance.buscarAlCambiar = true;
      fixture.detectChanges();
      const navigateSpy = jest.spyOn(router, 'navigate').mockResolvedValue(true);

      bar.elegirPoblacion(MADRID);

      expect(navigateSpy).toHaveBeenCalledWith(['/alojamiento'], expect.anything());
    });
  });

  describe('calendario de fechas', () => {
    const MADRID = { ciudad: 'Madrid', lat: 40.41, lng: -3.7 };
    const panel = (): HTMLElement | null =>
      (fixture.nativeElement as HTMLElement).querySelector('.sb__cal');

    it('debería abrirse solo al elegir la población, para encadenar dónde y cuándo', async () => {
      await crear();
      jest.spyOn(router, 'navigate').mockResolvedValue(true);
      expect(panel()).toBeNull();

      bar.elegirPoblacion(MADRID);
      fixture.detectChanges();

      expect(bar.calendarioAbierto()).toBe(true);
      expect(panel()).toBeTruthy();
      expect(panel()!.querySelector('rs-calendario-rango')).toBeTruthy();
    });

    it('no debería abrirse sobre un listado, donde elegir población ya busca', async () => {
      await crear();
      fixture.componentInstance.buscarAlCambiar = true;
      fixture.detectChanges();
      jest.spyOn(router, 'navigate').mockResolvedValue(true);

      bar.elegirPoblacion(MADRID);

      expect(bar.calendarioAbierto()).toBe(false);
    });

    it('debería guardar el rango y cerrarse al completarlo', async () => {
      await crear();
      bar.abrirCalendario();

      bar.elegirFechas({ entrada: '2026-09-12', salida: null });
      expect(bar.calendarioAbierto()).toBe(true);
      expect(bar.formulario.getRawValue().desde).toBe('2026-09-12');

      bar.elegirFechas({ entrada: '2026-09-12', salida: '2026-09-15' });

      expect(bar.formulario.getRawValue().hasta).toBe('2026-09-15');
      expect(bar.calendarioAbierto()).toBe(false);
    });

    it('debería cerrarse con la primera fecha en las categorías de cita', async () => {
      await crear();
      jest.spyOn(router, 'navigate').mockResolvedValue(true);
      bar.seleccionarVertical(VerticalKey.PELUQUERIA);
      bar.abrirCalendario();

      bar.elegirFechas({ entrada: '2026-09-12', salida: null });

      expect(bar.calendarioAbierto()).toBe(false);
    });

    it('debería pedir una sola fecha donde no se reserva por noches', async () => {
      await crear();
      jest.spyOn(router, 'navigate').mockResolvedValue(true);
      const calendario = (): RsCalendarioRangoComponent =>
        fixture.debugElement.query(By.directive(RsCalendarioRangoComponent)).componentInstance;

      bar.abrirCalendario();
      fixture.detectChanges();
      // Alojamiento reserva por noches: entrada y salida.
      expect(calendario().soloUnDia()).toBe(false);
      // Sin servicio elegido no hay plazas que consultar: nada que colorear.
      expect(calendario().conDisponibilidad()).toBe(false);

      bar.seleccionarVertical(VerticalKey.PELUQUERIA);
      bar.abrirCalendario();
      fixture.detectChanges();

      expect(calendario().soloUnDia()).toBe(true);
    });

    it('debería vaciar las dos fechas al borrarlas', async () => {
      await crear();
      bar.formulario.patchValue({ desde: '2026-09-12', hasta: '2026-09-15' });

      bar.borrarFechas();

      expect(bar.entradaSel()).toBeNull();
      expect(bar.salidaSel()).toBeNull();
    });

    it('debería cerrarse al pulsar fuera y con Escape', async () => {
      await crear();
      bar.abrirCalendario();

      bar.cerrarAlPulsarFuera({ target: document.body } as unknown as Event);
      expect(bar.calendarioAbierto()).toBe(false);

      bar.abrirCalendario();
      bar.cerrarConEscape();
      expect(bar.calendarioAbierto()).toBe(false);
    });

    it('no debería cerrarse al pulsar dentro del propio campo de fechas', async () => {
      await crear();
      bar.abrirCalendario();
      fixture.detectChanges();
      const dentro = (fixture.nativeElement as HTMLElement).querySelector('.sb__cal')!;

      bar.cerrarAlPulsarFuera({ target: dentro } as unknown as Event);

      expect(bar.calendarioAbierto()).toBe(true);
    });

    it('debería pintar la fecha en corto, no en ISO', async () => {
      await crear();

      expect(bar.etiquetaFecha('2026-09-12')).toBe('12 sep');
      expect(bar.etiquetaFecha(null)).toBe('');
    });
  });

  it('debería emitir los parámetros de la búsqueda', async () => {
    await crear();
    jest.spyOn(router, 'navigate').mockResolvedValue(true);
    const emitido = jest.fn();
    bar.buscado.subscribe(emitido);
    bar.formulario.patchValue({ ciudad: '  Valencia  ' });

    bar.buscar();

    expect(emitido).toHaveBeenCalledWith(
      expect.objectContaining({ vertical: VerticalKey.ALOJAMIENTO, ciudad: 'Valencia' }),
    );
  });
});
