import { Component } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router, convertToParamMap } from '@angular/router';
import { RouterTestingModule } from '@angular/router/testing';
import { of } from 'rxjs';
import { VerticalKey } from 'shared';
import { RsSearchBarComponent } from './rs-search-bar.component';

/** Host mínimo para poder fijar los inputs de señal del buscador. */
@Component({
  standalone: true,
  imports: [RsSearchBarComponent],
  template: `<rs-search-bar [vertical]="vertical" [buscarAlCambiar]="buscarAlCambiar" />`,
})
class HostComponent {
  vertical = VerticalKey.ALOJAMIENTO as string;
  buscarAlCambiar = false;
}

describe('RsSearchBarComponent', () => {
  let fixture: ComponentFixture<HostComponent>;
  let bar: RsSearchBarComponent;
  let router: Router;

  const crear = async (queryParams: Record<string, string> = {}): Promise<void> => {
    await TestBed.configureTestingModule({
      imports: [HostComponent, RouterTestingModule],
      providers: [
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

  it('debería inicializarse con los filtros que llegan en la URL', async () => {
    await crear({ ciudad: 'Madrid', desde: '2026-08-01', hasta: '2026-08-05', perros: '3' });

    expect(bar.formulario.getRawValue()).toEqual({
      ciudad: 'Madrid',
      desde: '2026-08-01',
      hasta: '2026-08-05',
      perros: 3,
    });
  });

  it('debería navegar al listado del vertical con los filtros', async () => {
    await crear();
    const navigateSpy = jest.spyOn(router, 'navigate').mockResolvedValue(true);
    bar.formulario.patchValue({ ciudad: 'Madrid', desde: '2026-08-01', hasta: '2026-08-05', perros: 2 });

    bar.buscar();

    expect(navigateSpy).toHaveBeenCalledWith(['/alojamiento'], {
      queryParams: { ciudad: 'Madrid', desde: '2026-08-01', hasta: '2026-08-05', perros: 2 },
      queryParamsHandling: 'merge',
    });
  });

  it('debería descartar la fecha de salida en las categorías de cita', async () => {
    await crear();
    const navigateSpy = jest.spyOn(router, 'navigate').mockResolvedValue(true);
    bar.formulario.patchValue({ desde: '2026-08-01', hasta: '2026-08-05' });

    bar.seleccionarVertical(VerticalKey.VETERINARIA);
    bar.buscar();

    expect(navigateSpy).toHaveBeenCalledWith(['/veterinaria'], {
      queryParams: { ciudad: null, desde: '2026-08-01', hasta: null, perros: 1 },
      queryParamsHandling: 'merge',
    });
  });

  it('debería mostrar la salida solo cuando la reserva es por noches', async () => {
    await crear();
    const el: HTMLElement = fixture.nativeElement;
    expect(el.querySelector('#sb-hasta')).toBeTruthy();

    bar.seleccionarVertical(VerticalKey.PELUQUERIA);
    fixture.detectChanges();
    expect(el.querySelector('#sb-hasta')).toBeNull();
  });

  it('debería adaptar las etiquetas a la categoría activa', async () => {
    await crear();
    expect(bar.activo().labelFecha).toBe('Entrada');
    expect(bar.activo().labelUbicacion).toBe('¿Dónde?');

    bar.seleccionarVertical(VerticalKey.TRANSPORTE);
    expect(bar.activo().labelFecha).toBe('Fecha del traslado');
    expect(bar.activo().labelUbicacion).toBe('Recogida');
  });

  it('no debería buscar al cambiar de categoría si no se le pide', async () => {
    await crear();
    const navigateSpy = jest.spyOn(router, 'navigate').mockResolvedValue(true);

    bar.seleccionarVertical(VerticalKey.VETERINARIA);

    expect(navigateSpy).not.toHaveBeenCalled();
  });

  it('debería buscar al cambiar de categoría en los listados', async () => {
    await crear();
    fixture.componentInstance.buscarAlCambiar = true;
    fixture.detectChanges();
    const navigateSpy = jest.spyOn(router, 'navigate').mockResolvedValue(true);

    bar.seleccionarVertical(VerticalKey.HOTELES);

    expect(navigateSpy).toHaveBeenCalledWith(['/hoteles'], expect.anything());
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
