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
  describe('filtros del listado', () => {
    it('no deberia filtrar nada por defecto', () => {
      expect(component.serviciosFiltrados()).toHaveLength(2);
    });

    it('deberia filtrar por estado', () => {
      component.filtroEstado.set('pausado');

      expect(component.serviciosFiltrados()).toHaveLength(0);
    });

    it('deberia filtrar por categoria', () => {
      component.categoria.set('transporte');

      expect(component.serviciosFiltrados()).toHaveLength(1);
      expect(component.serviciosFiltrados()[0].vertical).toBe('transporte');
    });

    it('deberia buscar por titulo sin distinguir mayusculas ni espacios', () => {
      component.busqueda.set('  SUITE  ');

      expect(component.serviciosFiltrados()).toHaveLength(1);
      expect(component.serviciosFiltrados()[0].titulo).toBe('Suite Canina');
    });

    it('deberia combinar los tres filtros', () => {
      component.filtroEstado.set('publicado');
      component.categoria.set('alojamiento');
      component.busqueda.set('suite');

      expect(component.serviciosFiltrados()).toHaveLength(1);
    });

    it('deberia devolver las categorias sin repetir y ordenadas', () => {
      expect(component.categorias()).toEqual(['alojamiento', 'transporte']);
    });

    it('deberia contar por estado, y "todos" como el total', () => {
      expect(component.contarEstado('todos')).toBe(2);
      expect(component.contarEstado('publicado')).toBe(2);
      expect(component.contarEstado('pausado')).toBe(0);
    });

    it('deberia limpiar los tres filtros de una vez', () => {
      component.filtroEstado.set('pausado');
      component.categoria.set('transporte');
      component.busqueda.set('x');

      component.limpiarFiltros();

      expect(component.serviciosFiltrados()).toHaveLength(2);
    });
  });

  describe('etiquetas por vertical', () => {
    it('deberia leer el precio en los terminos de cada vertical', () => {
      // "45 / noche" y "20 base" no son lo mismo: el comercio tiene que ver como
      // se le esta vendiendo.
      expect(component.precioDe(servicioAlojamiento)).toBe('45 € / noche');
      expect(component.precioDe(servicioTransporte)).toBe('20 € base');
      expect(component.precioDe({ ...servicioTransporte, vertical: 'adiestramiento' })).toBe('20 € / sesión');
      expect(component.precioDe({ ...servicioTransporte, vertical: 'veterinaria' })).toBe('20 € / cita');
    });

    it('deberia redondear el importe', () => {
      expect(component.precioDe({ ...servicioTransporte, precioBase: 20.6 })).toBe('21 € base');
    });

    it('deberia colorear el badge segun el estado', () => {
      expect(component.estadoBadge('publicado')).toContain('success');
      expect(component.estadoBadge('pausado')).toContain('warning');
      expect(component.estadoBadge('borrador')).toContain('neutral');
    });

    it('deberia devolver el estado en crudo si no tiene etiqueta conocida', () => {
      expect(component.etiquetaEstado('inventado')).toBe('inventado');
    });

    it('deberia etiquetar la disponibilidad segun el vertical', () => {
      expect(component.labelDisponibilidad('transporte')).toContain('Unidades');
      expect(component.labelDisponibilidad('veterinaria')).toContain('Citas');
      expect(component.labelDisponibilidad('desconocido')).toBe('Disponibilidad');
    });
  });

  describe('resumen de disponibilidad', () => {
    it('deberia contar tipos de espacio y plazas en alojamiento', () => {
      expect(component.resumenDisponibilidad(servicioAlojamiento)).toBe('1 tipo de espacio · 3 plazas');
    });

    it('deberia concordar el plural con varios espacios', () => {
      const conDos = {
        ...servicioAlojamiento,
        espacios: [
          { tipo: 'estandar', tamanoMaxPerro: 'mediano', precioNoche: 45, cantidad: 1, disponible: true },
          { tipo: 'suite', tamanoMaxPerro: 'grande', precioNoche: 80, cantidad: 2, disponible: true },
        ],
      };

      expect(component.resumenDisponibilidad(conDos)).toBe('2 tipos de espacio · 3 plazas');
    });

    it('deberia avisar si el alojamiento no tiene espacios', () => {
      expect(component.resumenDisponibilidad({ ...servicioAlojamiento, espacios: [] }))
        .toBe('Sin espacios configurados');
    });

    it('deberia usar el vocabulario de cada vertical', () => {
      expect(component.resumenDisponibilidad(servicioTransporte)).toBe('2 unidades disponibles');
      expect(component.resumenDisponibilidad({ ...servicioTransporte, unidadesDisponibles: 1 }))
        .toBe('1 unidad disponible');
    });

    it('deberia avisar cuando el vertical no tiene disponibilidad configurada', () => {
      expect(component.resumenDisponibilidad({ ...servicioTransporte, unidadesDisponibles: undefined }))
        .toBe('Sin disponibilidad configurada');
    });
  });

  describe('publicar y pausar', () => {
    it('deberia alternar a pausado y reflejarlo en la lista', async () => {
      comercioApi.cambiarEstadoServicio.mockReturnValue(of({ ...servicioTransporte, estado: 'pausado' }) as never);

      await component.toggleEstado(servicioTransporte);

      expect(comercioApi.cambiarEstadoServicio).toHaveBeenCalledWith('serv-1', 'pausado');
      expect(component.servicios().find((s) => s._id === 'serv-1')?.estado).toBe('pausado');
      expect(component.toggling()).toBeNull();
    });

    it('deberia alternar de pausado a publicado', async () => {
      const pausado = { ...servicioTransporte, estado: 'pausado' as const };
      comercioApi.cambiarEstadoServicio.mockReturnValue(of({ ...pausado, estado: 'publicado' }) as never);

      await component.toggleEstado(pausado);

      expect(comercioApi.cambiarEstadoServicio).toHaveBeenCalledWith('serv-1', 'publicado');
    });

    it('deberia avisar y desbloquear el boton si el cambio falla', async () => {
      comercioApi.cambiarEstadoServicio.mockReturnValue(throwError(() => new Error('500')));

      await component.toggleEstado(servicioTransporte);

      expect(component.errorMsg()).toContain('Error al cambiar');
      expect(component.toggling()).toBeNull();
    });
  });

  describe('edicion de espacios', () => {
    beforeEach(() => {
      component.toggleDisponibilidad(servicioAlojamiento);
    });

    it('deberia agregar un espacio con valores por defecto', () => {
      component.agregarEspacio();

      expect(component.espaciosEdit()).toHaveLength(2);
      expect(component.espaciosEdit()[1]).toMatchObject({ tipo: 'estandar', cantidad: 1 });
    });

    it('deberia quitar el espacio de la posicion indicada', () => {
      component.agregarEspacio();
      component.quitarEspacio(0);

      expect(component.espaciosEdit()).toHaveLength(1);
      expect(component.espaciosEdit()[0].cantidad).toBe(1);
    });

    it('deberia actualizar cantidad y precio convirtiendo el texto del input', () => {
      component.actualizarEspacio(0, 'cantidad', '7');
      component.actualizarEspacio(0, 'precioNoche', '99.5');

      expect(component.espaciosEdit()[0].cantidad).toBe(7);
      expect(component.espaciosEdit()[0].precioNoche).toBe(99.5);
    });

    it('deberia caer a 0 si el input no es un numero, en vez de guardar NaN', () => {
      component.actualizarEspacio(0, 'cantidad', 'muchos');

      expect(component.espaciosEdit()[0].cantidad).toBe(0);
    });

    it('no deberia tocar los demas espacios al editar uno', () => {
      component.agregarEspacio();
      component.actualizarEspacio(1, 'cantidad', '5');

      expect(component.espaciosEdit()[0].cantidad).toBe(3);
      expect(component.espaciosEdit()[1].cantidad).toBe(5);
    });
  });

  describe('guardar disponibilidad', () => {
    it('deberia enviar los espacios en alojamiento', async () => {
      comercioApi.actualizarDisponibilidad.mockReturnValue(of(servicioAlojamiento) as never);
      component.toggleDisponibilidad(servicioAlojamiento);

      await component.guardarDisponibilidad(servicioAlojamiento);

      const [, payload] = comercioApi.actualizarDisponibilidad.mock.calls[0];
      expect(payload).toHaveProperty('espacios');
      expect(component.disponibilidadAbiertaId()).toBeNull();
    });

    it('deberia enviar el campo propio del vertical en los demas', async () => {
      comercioApi.actualizarDisponibilidad.mockReturnValue(of(servicioTransporte) as never);
      component.toggleDisponibilidad(servicioTransporte);
      component.numeroCtrl.setValue(9);

      await component.guardarDisponibilidad(servicioTransporte);

      const [, payload] = comercioApi.actualizarDisponibilidad.mock.calls[0];
      expect(payload).toEqual({ unidadesDisponibles: 9 });
    });

    it('deberia dejar el panel abierto y avisar si el guardado falla', async () => {
      // Cerrarlo perderia lo que el comercio acababa de teclear.
      comercioApi.actualizarDisponibilidad.mockReturnValue(throwError(() => new Error('500')));
      component.toggleDisponibilidad(servicioTransporte);

      await component.guardarDisponibilidad(servicioTransporte);

      expect(component.disponibilidadError()).toContain('No se pudo guardar');
      expect(component.disponibilidadAbiertaId()).toBe('serv-1');
      expect(component.guardandoDisponibilidad()).toBe(false);
    });
  });

  it('deberia cerrar el menu contextual al pulsar fuera', () => {
    component.menuAbiertoId.set('serv-1');

    component.cerrarMenu();

    expect(component.menuAbiertoId()).toBeNull();
  });
});
