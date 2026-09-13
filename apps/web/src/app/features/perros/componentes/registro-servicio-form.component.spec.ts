import { ComponentFixture, TestBed } from '@angular/core/testing';
import { RegistroServicioFormComponent } from './registro-servicio-form.component';
import { RegistroServicioApi, ServicioExpedienteApi } from '../expediente.service';

describe('RegistroServicioFormComponent', () => {
  let fixture: ComponentFixture<RegistroServicioFormComponent>;
  let component: RegistroServicioFormComponent;

  const servicio: ServicioExpedienteApi = {
    reservaId: 'res1', codigo: 'RES-1', vertical: 'veterinaria', comercioId: 'c1', fechaInicio: '2026-09-10', estado: 'completada',
  };

  const crear = (inputs: Record<string, unknown>) => {
    TestBed.configureTestingModule({ imports: [RegistroServicioFormComponent] });
    fixture = TestBed.createComponent(RegistroServicioFormComponent);
    component = fixture.componentInstance;
    for (const [clave, valor] of Object.entries(inputs)) fixture.componentRef.setInput(clave, valor);
    fixture.detectChanges();
  };

  it('debería arrancar con la categoría inicial, el profesional y la reserva de la que se viene', () => {
    crear({
      verticales: ['veterinaria', 'peluqueria'], servicios: [servicio],
      verticalInicial: 'veterinaria', reservaInicial: 'res1', profesionalInicial: 'Dra. Pérez',
    });

    expect(component.vertical()).toBe('veterinaria');
    expect(component.form.controls.profesional.value).toBe('Dra. Pérez');
    expect(component.form.controls.reservaId.value).toBe('res1');
    expect(component.campos().map((c) => c.clave)).toContain('diagnostico');
  });

  it('no debería vincular una reserva que no es de la categoría', () => {
    crear({ verticales: ['peluqueria'], servicios: [servicio], reservaInicial: 'res1' });
    expect(component.form.controls.reservaId.value).toBe('');
  });

  it('debería cambiar los campos al elegir otra categoría', () => {
    crear({ verticales: ['veterinaria', 'peluqueria'] });
    component.elegirVertical('peluqueria');
    expect(component.campos().map((c) => c.clave)).toContain('serviciosRealizados');
    expect(component.sugerencias()).toContain('Baño y corte');
    component.usarTitulo('Baño y corte');
    expect(component.form.controls.titulo.value).toBe('Baño y corte');
  });

  it('no debería emitir sin título y marcar el error', () => {
    crear({ verticales: ['veterinaria'] });
    const guardar = jest.fn();
    component.guardar.subscribe(guardar);

    component.enviar();

    expect(guardar).not.toHaveBeenCalled();
    expect(component.form.controls.titulo.touched).toBe(true);
  });

  it('debería emitir el payload con sólo los datos rellenos', () => {
    crear({ verticales: ['veterinaria'], servicios: [servicio] });
    const guardar = jest.fn();
    component.guardar.subscribe(guardar);

    component.form.patchValue({ titulo: ' Consulta ', nota: 'Bien', reservaId: 'res1', proximaCita: '2027-01-01' });
    component.datos.get('diagnostico')!.setValue('Otitis');
    component.enviar();

    expect(guardar).toHaveBeenCalledWith(expect.objectContaining({
      vertical: 'veterinaria', reservaId: 'res1', titulo: 'Consulta', nota: 'Bien',
      proximaCita: '2027-01-01', datosEstructurados: { diagnostico: 'Otitis' },
    }));
  });

  it('al editar debería cargar el registro y no mandar categoría ni reserva', () => {
    const registro: RegistroServicioApi = {
      _id: 'r1', vertical: 'adiestramiento', origen: 'comercio', titulo: 'Sesión', nota: 'Sesión',
      datosEstructurados: { objetivos: 'Llamada', otro: undefined }, fechaServicio: '2026-09-01T00:00:00.000Z', esPropio: true,
    };
    crear({ verticales: ['adiestramiento'], registro });
    const guardar = jest.fn();
    component.guardar.subscribe(guardar);

    expect(component.form.controls.titulo.value).toBe('Sesión');
    expect(component.form.controls.nota.value).toBe('');
    expect(component.datos.get('objetivos')!.value).toBe('Llamada');

    component.enviar();
    const payload = guardar.mock.calls[0][0];
    expect(payload.vertical).toBeUndefined();
    expect(payload.reservaId).toBeUndefined();
  });
});
