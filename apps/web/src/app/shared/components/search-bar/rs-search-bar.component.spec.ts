import { Component } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { ActivatedRoute, Router, convertToParamMap } from '@angular/router';
import { RouterTestingModule } from '@angular/router/testing';
import { of } from 'rxjs';
import { VerticalKey } from 'shared';
import { RsSearchBarComponent } from './rs-search-bar.component';

/** Host mínimo para poder fijar los inputs de señal del buscador. */
@Component({
  standalone: true,
  imports: [RsSearchBarComponent],
  template: `<rs-search-bar [vertical]="vertical" [variant]="variant" [buscarAlCambiar]="buscarAlCambiar"
                            [categoriasSoloMovil]="categoriasSoloMovil" />`,
})
class HostComponent {
  vertical = VerticalKey.ALOJAMIENTO as string;
  variant: 'card' | 'strip' = 'card';
  buscarAlCambiar = false;
  categoriasSoloMovil = false;
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

  it('debería mostrar la fila de categorías en todos los tamaños por defecto', async () => {
    await crear();
    const cats = (fixture.nativeElement as HTMLElement).querySelector('.sb__cats');

    expect(cats).toBeTruthy();
    expect(cats!.classList).not.toContain('sb__cats--movil');
  });

  it('debería reservar la fila de categorías para móvil cuando se le pide', async () => {
    // En escritorio la barra superior ya ofrece las categorías con su icono:
    // repetirlas aquí obligaba a elegir dos veces lo mismo.
    await crear();
    fixture.componentInstance.categoriasSoloMovil = true;
    fixture.detectChanges();

    const cats = (fixture.nativeElement as HTMLElement).querySelector('.sb__cats');
    expect(cats!.classList).toContain('sb__cats--movil');
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
    expect(bar.activo().labelFecha).toBe('Entrada');
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
