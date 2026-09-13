import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { signal } from '@angular/core';
import { of } from 'rxjs';
import { ComercioMascotaExpedienteComponent } from './comercio-mascota-expediente.component';
import { ComercioApiService } from './comercio-api.service';
import { AuthService } from '../../core/auth/auth.service';
import { ExpedienteApi, ExpedienteService, RegistroServicioApi } from '../perros/expediente.service';

// Compila una página entera con sus hijos: con la suite completa en paralelo, 5 s no llegan.
jest.setTimeout(20_000);

describe('ComercioMascotaExpedienteComponent', () => {
  let fixture: ComponentFixture<ComercioMascotaExpedienteComponent>;
  let component: ComercioMascotaExpedienteComponent;
  let expedientes: Record<string, jest.Mock>;

  const registro = (extra: Partial<RegistroServicioApi> = {}): RegistroServicioApi => ({
    _id: 'r1', vertical: 'veterinaria', origen: 'comercio', titulo: 'Consulta', nota: 'Consulta',
    datosEstructurados: {}, fechaServicio: '2026-09-01', esPropio: true, ...extra,
  });

  const expediente = (): ExpedienteApi => ({
    perro: {
      _id: 'p1', nombre: 'Nala', fotos: [], especie: 'perro', esMestizo: true, esterilizado: false, tipoPelo: [],
      vacunas: [], alergias: ['Pollo'], enfermedades: ['Otitis'], medicacion: ['Apoquel'], puedeQuedarseSolo: true,
      ansiedadSeparacion: false, miedos: [], seMarea: false, requiereTransportin: false, autorizaCompartirHistorial: true,
      sexo: 'hembra', peso: 10,
    } as ExpedienteApi['perro'],
    propietario: { nombre: 'Ana Ruiz', telefono: '600', email: 'ana@x.com' },
    registros: [registro()],
    servicios: [{ reservaId: 'res1', codigo: 'RES-1', vertical: 'veterinaria', comercioId: 'c1', fechaInicio: '2026-08-01', estado: 'completada' }],
  });

  const crear = async (opciones: { consulta?: Record<string, string>; falla?: unknown; verticales?: string[] } = {}) => {
    expedientes = {
      delComercio: opciones.falla ? jest.fn(() => rechazo(opciones.falla)) : jest.fn().mockResolvedValue(expediente()),
      crearRegistro: jest.fn().mockResolvedValue(registro({ _id: 'r2', titulo: 'Vacunación', fechaServicio: '2026-09-10' })),
      actualizarRegistro: jest.fn().mockResolvedValue(registro({ titulo: 'Consulta corregida' })),
      eliminarRegistro: jest.fn().mockResolvedValue(undefined),
      descargarInformeComercio: jest.fn().mockResolvedValue(undefined),
    };
    await TestBed.configureTestingModule({
      imports: [ComercioMascotaExpedienteComponent],
      providers: [
        provideRouter([]),
        { provide: ExpedienteService, useValue: expedientes },
        { provide: ComercioApiService, useValue: { getMiComercio: () => of({ verticales: opciones.verticales ?? ['veterinaria', 'alojamiento'] }) } },
        { provide: AuthService, useValue: { usuario: signal({ nombre: 'Dra. Pérez' }) } },
        { provide: ActivatedRoute, useValue: { snapshot: { paramMap: convertToParamMap({ perroId: 'p1' }), queryParamMap: convertToParamMap(opciones.consulta ?? {}) } } },
      ],
    }).compileComponents();
    fixture = TestBed.createComponent(ComercioMascotaExpedienteComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
    await new Promise((r) => setTimeout(r, 0));
    fixture.detectChanges();
  };

  it('debería pintar la mascota, sus alertas, el dueño y el historial', async () => {
    await crear();
    const texto = (fixture.nativeElement as HTMLElement).textContent ?? '';

    expect(texto).toContain('Nala');
    expect(texto).toContain('Pollo');
    expect(texto).toContain('Ana Ruiz');
    expect(texto).toContain('Consulta');
    expect(component.verticalesConHistorial()).toEqual(['veterinaria']);
    expect(component.alertas()).toHaveLength(3);
    expect(component.registrosPropios()).toBe(1);
    expect(component.ultimaVisita()).toBe('2026-08-01');
  });

  it('debería abrir el formulario desde la reserva indicada en la URL', async () => {
    await crear({ consulta: { registrar: 'veterinaria', reserva: 'res1' } });
    await new Promise((r) => setTimeout(r, 0));

    expect(component.formAbierto()).toBe(true);
    expect(component.verticalInicial()).toBe('veterinaria');
    expect(component.reservaInicial()).toBe('res1');
  });

  it('no debería abrir el formulario para una categoría sin historial', async () => {
    await crear();
    component.registrarDesdeReserva('alojamiento', 'x');
    await new Promise((r) => setTimeout(r, 0));
    expect(component.formAbierto()).toBe(false);
  });

  it('debería crear un registro y ponerlo el primero del historial', async () => {
    await crear();
    component.abrirFormulario();
    await component.guardar({ vertical: 'veterinaria', titulo: 'Vacunación' });

    expect(expedientes['crearRegistro']).toHaveBeenCalledWith('p1', { vertical: 'veterinaria', titulo: 'Vacunación' });
    expect(component.expediente()!.registros[0]._id).toBe('r2');
    expect(component.formAbierto()).toBe(false);
    expect(component.mensaje()).toBe('Registro guardado en el historial.');
  });

  it('debería actualizar el registro que se está editando', async () => {
    await crear();
    component.editar(registro());
    await component.guardar({ titulo: 'Consulta corregida' });

    expect(expedientes['actualizarRegistro']).toHaveBeenCalledWith('p1', 'r1', { titulo: 'Consulta corregida' });
    expect(component.expediente()!.registros).toHaveLength(1);
    expect(component.mensaje()).toBe('Registro actualizado.');
  });

  it('debería avisar si no se puede guardar', async () => {
    await crear();
    expedientes['crearRegistro'].mockRejectedValue(new Error('x'));
    await component.guardar({ titulo: 'x' });
    expect(component.errorGuardar()).toContain('No se pudo guardar');
    component.cerrarFormulario();
    expect(component.errorGuardar()).toBe('');
  });

  it('debería eliminar un registro tras confirmar', async () => {
    await crear();
    jest.spyOn(window, 'confirm').mockReturnValue(true);
    await component.eliminar(registro());
    expect(component.expediente()!.registros).toHaveLength(0);

    expedientes['eliminarRegistro'].mockRejectedValue(new Error('x'));
    await component.eliminar(registro());
    expect(component.mensaje()).toBe('No se pudo eliminar el registro.');
  });

  it('debería descargar el PDF y avisar si falla', async () => {
    await crear();
    await component.descargarPdf();
    expect(expedientes['descargarInformeComercio']).toHaveBeenCalledWith('p1', 'Nala');

    expedientes['descargarInformeComercio'].mockRejectedValue(new Error('x'));
    await component.descargarPdf();
    expect(component.mensaje()).toContain('No se pudo generar el PDF');
  });

  it('debería pintar las pestañas de ficha y reservas', async () => {
    await crear();
    component.pestana.set('ficha');
    fixture.detectChanges();
    expect((fixture.nativeElement as HTMLElement).textContent).toContain('Datos que ha rellenado el propietario');

    component.pestana.set('reservas');
    fixture.detectChanges();
    expect((fixture.nativeElement as HTMLElement).textContent).toContain('RES-1');
    expect(component.estado('completada')).toBe('Completada');
    expect(component.etiquetaVertical('veterinaria')).toBe('Veterinarios');
  });

  it('debería explicar que la mascota no es de este negocio cuando el API responde 403', async () => {
    await crear({ falla: { status: 403 } });
    expect(component.error()).toBe('Esta mascota no tiene reservas con tu negocio.');
  });

  it('debería dar un error genérico en otros fallos', async () => {
    await crear({ falla: new Error('red') });
    expect(component.error()).toContain('No se pudo cargar el expediente');
  });
});

/** Rechazo ya observado: Zone no lo da por no gestionado antes de que el componente lo espere. */
function rechazo(error: unknown): Promise<never> {
  const promesa = Promise.reject(error);
  promesa.catch(() => undefined);
  return promesa;
}
