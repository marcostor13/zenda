import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router, convertToParamMap } from '@angular/router';
import { RouterTestingModule } from '@angular/router/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { VerticalKey } from 'shared';
import { BuscadorComponent } from './buscador.component';

describe('BuscadorComponent', () => {
  let fixture: ComponentFixture<BuscadorComponent>;
  let component: BuscadorComponent;
  let router: Router;
  let queryParams: Record<string, string>;

  const crearComponente = async (): Promise<void> => {
    await TestBed.configureTestingModule({
      imports: [BuscadorComponent, RouterTestingModule],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        {
          provide: ActivatedRoute,
          useValue: { snapshot: { queryParamMap: convertToParamMap(queryParams) } },
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(BuscadorComponent);
    component = fixture.componentInstance;
    router = TestBed.inject(Router);
    fixture.detectChanges();
  };

  beforeEach(() => {
    queryParams = {};
  });

  it('debería crear el componente', async () => {
    await crearComponente();
    expect(component).toBeTruthy();
  });

  it('debería tener las 6 categorías caninas con sus etiquetas', async () => {
    await crearComponente();
    expect(component.verticales.map((v) => v.key)).toEqual([
      VerticalKey.ALOJAMIENTO,
      VerticalKey.TRANSPORTE,
      VerticalKey.VETERINARIA,
      VerticalKey.PELUQUERIA,
      VerticalKey.ADIESTRAMIENTO,
      VerticalKey.HOTELES,
    ]);
    expect(component.verticales.map((v) => v.label)).toEqual([
      'Alojamiento canino',
      'Transporte de animales',
      'Veterinarios',
      'Peluquerías caninas',
      'Adiestramiento canino',
      'Hoteles pet-friendly',
    ]);
  });

  it('debería seleccionar alojamiento por defecto con Check-in y Check-out', async () => {
    await crearComponente();
    expect(component.verticalSeleccionado()).toBe(VerticalKey.ALOJAMIENTO);
    expect(component.verticalActual().labelFechaInicio).toBe('Check-in');
    expect(component.verticalActual().mostrarFechaFin).toBe(true);
  });

  it('debería mostrar fecha de cita para veterinarios sin fecha fin', async () => {
    await crearComponente();
    component.seleccionarVertical(VerticalKey.VETERINARIA);
    expect(component.verticalActual().labelFechaInicio).toBe('Fecha de la cita');
    expect(component.verticalActual().mostrarFechaFin).toBe(false);
  });

  it('debería preseleccionar la categoría desde los query params', async () => {
    queryParams = { vertical: VerticalKey.PELUQUERIA, ciudad: 'Sevilla' };
    await crearComponente();
    expect(component.verticalSeleccionado()).toBe(VerticalKey.PELUQUERIA);
    expect(component.formulario.value.ciudad).toBe('Sevilla');
  });

  it('debería ignorar un vertical desconocido en los query params', async () => {
    queryParams = { vertical: 'categoria-inexistente' };
    await crearComponente();
    expect(component.verticalSeleccionado()).toBe(VerticalKey.ALOJAMIENTO);
  });

  it('debería navegar a la ruta de la categoría seleccionada al buscar', async () => {
    await crearComponente();
    const navigateSpy = jest.spyOn(router, 'navigate').mockResolvedValue(true);

    component.seleccionarVertical(VerticalKey.ADIESTRAMIENTO);
    component.formulario.patchValue({ ciudad: 'Madrid', fechaInicio: '2026-09-10' });
    component.onBuscar();

    expect(navigateSpy).toHaveBeenCalledWith(['/adiestramiento'], {
      queryParams: {
        ciudad: 'Madrid',
        destino: null,
        desde: '2026-09-10',
        hasta: null,
      },
    });
  });

  it('debería navegar a /alojamiento al buscar la categoría por defecto', async () => {
    await crearComponente();
    const navigateSpy = jest.spyOn(router, 'navigate').mockResolvedValue(true);

    component.onBuscar();

    expect(navigateSpy).toHaveBeenCalledWith(['/alojamiento'], expect.anything());
  });
});
