import { ComponentFixture, TestBed } from '@angular/core/testing';
import { RouterTestingModule } from '@angular/router/testing';
import { of, throwError } from 'rxjs';
import { ComercioListadosComponent } from './comercio-listados.component';
import { ComercioApiService, MiServicio } from './comercio-api.service';

describe('ComercioListadosComponent', () => {
  let fixture: ComponentFixture<ComercioListadosComponent>;
  let component: ComercioListadosComponent;
  let comercioApi: jest.Mocked<ComercioApiService>;

  const servicioTransporte: MiServicio = {
    _id: 'serv-1', titulo: 'PetTransfer Madrid', vertical: 'transporte',
    precioBase: 20, estado: 'publicado', unidadesDisponibles: 2,
  };

  const servicioAlojamiento: MiServicio = {
    _id: 'serv-2', titulo: 'Suite Canina', vertical: 'alojamiento',
    precioBase: 45, estado: 'publicado',
    espacios: [{ tipo: 'estandar', tamanoMaxPerro: 'mediano', precioNoche: 45, cantidad: 3, disponible: true }],
  };

  beforeEach(async () => {
    comercioApi = {
      getMisServicios: jest.fn().mockReturnValue(of([servicioTransporte, servicioAlojamiento])),
      cambiarEstadoServicio: jest.fn(),
      actualizarDisponibilidad: jest.fn(),
    } as unknown as jest.Mocked<ComercioApiService>;

    await TestBed.configureTestingModule({
      imports: [ComercioListadosComponent, RouterTestingModule],
      providers: [{ provide: ComercioApiService, useValue: comercioApi }],
    }).compileComponents();

    fixture = TestBed.createComponent(ComercioListadosComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
    await fixture.whenStable();
  });

  it('debería cargar los listados del comercio', () => {
    expect(component.servicios().length).toBe(2);
  });

  it('debería precargar el número de disponibilidad al abrir un vertical simple', () => {
    component.toggleDisponibilidad(servicioTransporte);
    expect(component.disponibilidadAbiertaId()).toBe('serv-1');
    expect(component.numeroCtrl.value).toBe(2);
  });

  it('debería precargar los espacios al abrir alojamiento', () => {
    component.toggleDisponibilidad(servicioAlojamiento);
    expect(component.espaciosEdit()).toHaveLength(1);
    expect(component.espaciosEdit()[0].cantidad).toBe(3);
  });

  it('debería cerrar el panel si se vuelve a pulsar el mismo botón', () => {
    component.toggleDisponibilidad(servicioTransporte);
    component.toggleDisponibilidad(servicioTransporte);
    expect(component.disponibilidadAbiertaId()).toBeNull();
  });

  it('debería guardar la disponibilidad de un vertical simple con el campo correcto', async () => {
    comercioApi.actualizarDisponibilidad.mockReturnValue(
      of({ ...servicioTransporte, unidadesDisponibles: 5 }),
    );
    component.toggleDisponibilidad(servicioTransporte);
    component.numeroCtrl.setValue(5);

    await component.guardarDisponibilidad(servicioTransporte);

    expect(comercioApi.actualizarDisponibilidad).toHaveBeenCalledWith('serv-1', { unidadesDisponibles: 5 });
    expect(component.servicios().find((s) => s._id === 'serv-1')?.unidadesDisponibles).toBe(5);
    expect(component.disponibilidadAbiertaId()).toBeNull();
  });

  it('debería guardar la lista completa de espacios para alojamiento', async () => {
    comercioApi.actualizarDisponibilidad.mockReturnValue(of(servicioAlojamiento));
    component.toggleDisponibilidad(servicioAlojamiento);
    component.agregarEspacio();

    await component.guardarDisponibilidad(servicioAlojamiento);

    expect(comercioApi.actualizarDisponibilidad).toHaveBeenCalledWith(
      'serv-2',
      { espacios: expect.arrayContaining([expect.objectContaining({ cantidad: 3 }), expect.objectContaining({ cantidad: 1 })]) },
    );
  });

  it('debería mostrar un error si falla el guardado', async () => {
    comercioApi.actualizarDisponibilidad.mockReturnValue(throwError(() => new Error('fallo')));
    component.toggleDisponibilidad(servicioTransporte);

    await component.guardarDisponibilidad(servicioTransporte);

    expect(component.disponibilidadError()).toContain('No se pudo guardar');
  });

  it('quitarEspacio debería eliminar el espacio en el índice indicado', () => {
    component.toggleDisponibilidad(servicioAlojamiento);
    component.agregarEspacio();
    expect(component.espaciosEdit()).toHaveLength(2);
    component.quitarEspacio(0);
    expect(component.espaciosEdit()).toHaveLength(1);
  });
});
