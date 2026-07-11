import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { ReactiveFormsModule } from '@angular/forms';
import { RouterTestingModule } from '@angular/router/testing';
import { HttpClientTestingModule } from '@angular/common/http/testing';
import { ComercioListadoNuevoComponent } from './comercio-listado-nuevo.component';
import { ComercioApiService } from './comercio-api.service';

describe('ComercioListadoNuevoComponent', () => {
  let fixture: ComponentFixture<ComercioListadoNuevoComponent>;
  let component: ComercioListadoNuevoComponent;
  let comercioApi: jest.Mocked<ComercioApiService>;

  const llenarBase = (vertical: string) => {
    component.form.setValue({
      vertical, titulo: 'Mi servicio', descripcion: 'Una descripción de al menos 10 caracteres',
      ciudad: 'Madrid', precioBase: 20, imagenes: [],
    });
  };

  beforeEach(async () => {
    comercioApi = { crearServicio: jest.fn() } as any;

    await TestBed.configureTestingModule({
      imports: [ComercioListadoNuevoComponent, ReactiveFormsModule, RouterTestingModule, HttpClientTestingModule],
      providers: [{ provide: ComercioApiService, useValue: comercioApi }],
    }).compileComponents();

    fixture = TestBed.createComponent(ComercioListadoNuevoComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('debería crear el componente', () => {
    expect(component).toBeTruthy();
  });

  it('no debería enviar si el formulario base es inválido', async () => {
    await component.submit();
    expect(comercioApi.crearServicio).not.toHaveBeenCalled();
  });

  it('no debería enviar un alojamiento sin al menos un espacio', async () => {
    llenarBase('alojamiento');
    await component.submit();
    expect(comercioApi.crearServicio).not.toHaveBeenCalled();
    expect(component.mostrarErrores()).toBe(true);
  });

  it('debería enviar un alojamiento con espacios, amenities y datos propios del vertical', async () => {
    comercioApi.crearServicio.mockReturnValue(of({} as any));
    llenarBase('alojamiento');
    component.agregarItem(component.espacios, component.nuevoEspacio());
    component.actualizarItem(component.espacios, 0, 'precioNoche', 45);
    component.toggleChip(component.amenitiesSel, 'piscina canina');

    await component.submit();

    expect(comercioApi.crearServicio).toHaveBeenCalledWith(expect.objectContaining({
      vertical: 'alojamiento',
      extra: expect.objectContaining({
        espacios: [expect.objectContaining({ precioNoche: 45, cantidad: 1 })],
        amenities: ['piscina canina'],
      }),
    }));
  });

  it('no debería enviar un transporte sin tarifaBase/tarifaKm válidas', async () => {
    llenarBase('transporte');
    await component.submit();
    expect(comercioApi.crearServicio).not.toHaveBeenCalled();
  });

  it('debería enviar un transporte con tarifas y zona de cobertura separada por comas', async () => {
    comercioApi.crearServicio.mockReturnValue(of({} as any));
    llenarBase('transporte');
    component.transporteForm.patchValue({ tarifaBase: 10, tarifaKm: 0.8, zonaCoberturaTexto: 'Madrid, Alcobendas' });

    await component.submit();

    expect(comercioApi.crearServicio).toHaveBeenCalledWith(expect.objectContaining({
      vertical: 'transporte',
      extra: expect.objectContaining({
        tarifaBase: 10, tarifaKm: 0.8, zonaCobertura: ['Madrid', 'Alcobendas'],
      }),
    }));
  });

  it('debería enviar una veterinaria con precioConsulta y especialidades seleccionadas', async () => {
    comercioApi.crearServicio.mockReturnValue(of({} as any));
    llenarBase('veterinaria');
    component.veterinariaForm.patchValue({ precioConsulta: 35 });
    component.toggleChip(component.especialidadesSel, 'vacunación');

    await component.submit();

    expect(comercioApi.crearServicio).toHaveBeenCalledWith(expect.objectContaining({
      vertical: 'veterinaria',
      extra: expect.objectContaining({ precioConsulta: 35, especialidades: ['vacunación'] }),
    }));
  });

  it('no debería enviar una peluquería sin al menos un servicio de grooming', async () => {
    llenarBase('peluqueria');
    await component.submit();
    expect(comercioApi.crearServicio).not.toHaveBeenCalled();
  });

  it('debería enviar una peluquería con servicios de grooming', async () => {
    comercioApi.crearServicio.mockReturnValue(of({} as any));
    llenarBase('peluqueria');
    component.agregarItem(component.serviciosGrooming, component.nuevoServicioGrooming());
    component.actualizarItem(component.serviciosGrooming, 0, 'nombre', 'Baño y corte');
    component.actualizarItem(component.serviciosGrooming, 0, 'precio', 25);

    await component.submit();

    expect(comercioApi.crearServicio).toHaveBeenCalledWith(expect.objectContaining({
      vertical: 'peluqueria',
      extra: expect.objectContaining({
        serviciosGrooming: [expect.objectContaining({ nombre: 'Baño y corte', precio: 25 })],
      }),
    }));
  });

  it('debería enviar un adiestramiento por programa con precioPrograma y sesionesPorPrograma', async () => {
    comercioApi.crearServicio.mockReturnValue(of({} as any));
    llenarBase('adiestramiento');
    component.adiestramientoForm.patchValue({
      modalidad: 'programa', precioSesion: 30, precioPrograma: 200, sesionesPorPrograma: 8,
    });
    component.toggleChip(component.tiposAdiestramientoSel, 'obediencia básica');

    await component.submit();

    expect(comercioApi.crearServicio).toHaveBeenCalledWith(expect.objectContaining({
      vertical: 'adiestramiento',
      extra: expect.objectContaining({
        modalidad: 'programa', precioPrograma: 200, sesionesPorPrograma: 8,
        tiposAdiestramiento: ['obediencia básica'],
      }),
    }));
  });

  it('no debería incluir precioPrograma/sesionesPorPrograma cuando la modalidad es por sesión', async () => {
    comercioApi.crearServicio.mockReturnValue(of({} as any));
    llenarBase('adiestramiento');
    component.adiestramientoForm.patchValue({ modalidad: 'sesion', precioSesion: 30 });

    await component.submit();

    const llamada = comercioApi.crearServicio.mock.calls[0][0];
    expect(llamada.extra?.['precioPrograma']).toBeUndefined();
    expect(llamada.extra?.['sesionesPorPrograma']).toBeUndefined();
  });

  it('toggleChip debería añadir y quitar valores del signal', () => {
    component.toggleChip(component.amenitiesSel, 'patio privado');
    expect(component.amenitiesSel()).toEqual(['patio privado']);
    component.toggleChip(component.amenitiesSel, 'patio privado');
    expect(component.amenitiesSel()).toEqual([]);
  });

  it('quitarItem debería eliminar el elemento en la posición indicada', () => {
    component.agregarItem(component.espacios, component.nuevoEspacio());
    component.agregarItem(component.espacios, component.nuevoEspacio());
    component.quitarItem(component.espacios, 0);
    expect(component.espacios().length).toBe(1);
  });
});
