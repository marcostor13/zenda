import { ComponentFixture, TestBed } from '@angular/core/testing';
import { RegistroServicioComponent } from './registro-servicio.component';
import { RegistroServicioApi } from '../expediente.service';

describe('RegistroServicioComponent', () => {
  let fixture: ComponentFixture<RegistroServicioComponent>;

  const registro = (extra: Partial<RegistroServicioApi> = {}): RegistroServicioApi => ({
    _id: 'r1', vertical: 'veterinaria', origen: 'comercio', titulo: 'Revisión anual', nota: 'Todo en orden',
    datosEstructurados: { diagnostico: 'Sano', pesoKg: 12.5, desconocido: 'x' },
    fechaServicio: '2026-09-10', profesional: 'Dra. Pérez', comercioNombre: 'Clínica Royal', esPropio: true,
    ...extra,
  });

  const crear = (datos: RegistroServicioApi, opciones: { editable?: boolean; mostrarComercio?: boolean } = {}) => {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({ imports: [RegistroServicioComponent] });
    fixture = TestBed.createComponent(RegistroServicioComponent);
    fixture.componentRef.setInput('registro', datos);
    if (opciones.editable !== undefined) fixture.componentRef.setInput('editable', opciones.editable);
    if (opciones.mostrarComercio !== undefined) fixture.componentRef.setInput('mostrarComercio', opciones.mostrarComercio);
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  };

  it('debería pintar título, comercio, profesional y los datos conocidos de la categoría', () => {
    const el = crear(registro());

    expect(el.textContent).toContain('Revisión anual');
    expect(el.textContent).toContain('Clínica Royal');
    expect(el.textContent).toContain('Dra. Pérez');
    expect(el.textContent).toContain('Diagnóstico');
    expect(el.textContent).toContain('kg');
    expect(el.textContent).not.toContain('desconocido');
    expect(el.textContent).toContain('Todo en orden');
  });

  /*
   * El mismo componente pinta la ficha del dueño y el panel del comercio, así
   * que los documentos que sube la clínica se leen y se bajan desde ambos sitios
   * sin duplicar nada.
   */
  it('debería dejar ver y descargar los documentos del registro', () => {
    const el = crear(registro({
      adjuntos: [{ nombre: 'Analitica.pdf', url: 'https://cdn/a.pdf', tipo: 'application/pdf' }],
    }));

    const enlaces = Array.from(el.querySelectorAll<HTMLAnchorElement>('.adj__accion'));
    expect(enlaces.map((a) => a.textContent?.trim())).toEqual(['Ver', 'Descargar']);
    expect(el.textContent).toContain('Analitica.pdf');
  });

  it('no debería dejar hueco de documentos cuando el registro no tiene ninguno', () => {
    const el = crear(registro());

    expect(el.querySelector('[data-testid="adjuntos-registro"]')).toBeNull();
  });

  it('no debería repetir la nota cuando es igual al título', () => {
    crear(registro({ nota: 'Revisión anual' }));
    expect(fixture.componentInstance.observaciones()).toBe('');
  });

  it('debería ocultar el comercio si se pide', () => {
    const el = crear(registro(), { mostrarComercio: false });
    expect(el.textContent).not.toContain('Clínica Royal');
  });

  it('debería ofrecer editar y eliminar sólo los registros propios en modo editable', () => {
    const editar = jest.fn();
    const eliminar = jest.fn();
    const el = crear(registro(), { editable: true });
    fixture.componentInstance.editar.subscribe(editar);
    fixture.componentInstance.eliminar.subscribe(eliminar);

    const botones = el.querySelectorAll<HTMLButtonElement>('.registro__acciones button');
    botones[0].click();
    botones[1].click();
    expect(editar).toHaveBeenCalled();
    expect(eliminar).toHaveBeenCalled();

    TestBed.resetTestingModule();
    const ajeno = crear(registro({ esPropio: false }), { editable: true });
    expect(ajeno.querySelector('.registro__acciones')).toBeNull();
  });

  it('debería avisar de la próxima cita y de si el dueño editó la entrada', () => {
    const el = crear(registro({ proximaCita: '2027-03-01', editadaAt: '2026-09-11' }));
    expect(el.textContent).toContain('Próxima cita');
    expect(el.textContent).toContain('Editado por el propietario');
  });
});
