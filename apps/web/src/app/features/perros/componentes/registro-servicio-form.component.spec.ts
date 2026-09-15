import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { environment } from '../../../../environments/environment';
import { RegistroServicioFormComponent } from './registro-servicio-form.component';
import { RegistroServicioApi, ServicioExpedienteApi } from '../expediente.service';

describe('RegistroServicioFormComponent', () => {
  let fixture: ComponentFixture<RegistroServicioFormComponent>;
  let component: RegistroServicioFormComponent;
  let http: HttpTestingController;

  const servicio: ServicioExpedienteApi = {
    reservaId: 'res1', codigo: 'RES-1', vertical: 'veterinaria', comercioId: 'c1', fechaInicio: '2026-09-10', estado: 'completada',
  };

  const crear = (inputs: Record<string, unknown>) => {
    TestBed.configureTestingModule({
      imports: [RegistroServicioFormComponent],
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    http = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(RegistroServicioFormComponent);
    component = fixture.componentInstance;
    for (const [clave, valor] of Object.entries(inputs)) fixture.componentRef.setInput(clave, valor);
    fixture.detectChanges();
  };

  const el = () => fixture.nativeElement as HTMLElement;
  const campoArchivo = () => el().querySelector<HTMLInputElement>('[data-testid="adjuntar-registro"]');

  /** Simula elegir ficheros: los `FileList` reales no se pueden construir. */
  const elegir = (...ficheros: File[]) => {
    const campo = campoArchivo()!;
    Object.defineProperty(campo, 'files', { value: ficheros, configurable: true });
    campo.dispatchEvent(new Event('change'));
  };

  const nombresAdjuntos = () =>
    Array.from(el().querySelectorAll('[data-testid="adjuntos-registro"] .adj__nombre'))
      .map((n) => n.textContent?.trim());

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

  /*
   * Los documentos se suben al elegirlos, no al guardar: el profesional ve si el
   * fichero entró mientras aún está escribiendo, y un formato rechazado no le
   * tira la nota entera.
   */
  describe('documentos adjuntos', () => {
    const pdf = () => new File(['%PDF'], 'Analitica.pdf', { type: 'application/pdf' });

    it('debería subir el documento al elegirlo y mostrarlo en la lista', async () => {
      crear({ verticales: ['veterinaria'] });

      elegir(pdf());
      http.expectOne(`${environment.apiUrl}/upload/documento`).flush({ url: 'https://cdn/a.pdf' });
      await fixture.whenStable();
      fixture.detectChanges();

      expect(nombresAdjuntos()).toEqual(['Analitica.pdf']);
    });

    it('debería mandar los documentos junto con el registro', async () => {
      crear({ verticales: ['veterinaria'] });
      const guardar = jest.fn();
      component.guardar.subscribe(guardar);

      elegir(new File(['x'], 'Informe.docx', { type: 'application/msword' }));
      http.expectOne(`${environment.apiUrl}/upload/documento`).flush({ url: 'https://cdn/i.docx' });
      await fixture.whenStable();
      fixture.detectChanges();

      component.form.controls.titulo.setValue('Consulta');
      component.enviar();

      expect(guardar.mock.calls[0][0].adjuntos).toEqual([
        { nombre: 'Informe.docx', url: 'https://cdn/i.docx', tipo: 'application/msword', tamano: 1 },
      ]);
    });

    it('debería explicar el fallo sin perder lo escrito', async () => {
      crear({ verticales: ['veterinaria'] });
      component.form.controls.titulo.setValue('Consulta');

      elegir(new File(['<html>'], 'virus.html', { type: 'text/html' }));
      http.expectOne(`${environment.apiUrl}/upload/documento`)
        .flush({ message: 'formato' }, { status: 422, statusText: 'Unprocessable Entity' });
      // El rechazo viaja por la promesa antes de llegar al catch: dos vueltas.
      await fixture.whenStable();
      await fixture.whenStable();
      fixture.detectChanges();

      expect(el().querySelector('.rs-field-error')?.textContent).toContain('No pudimos subir');
      expect(nombresAdjuntos()).toEqual([]);
      expect(component.form.controls.titulo.value).toBe('Consulta');
    });

    it('debería dejar quitar un documento antes de guardar', async () => {
      crear({ verticales: ['veterinaria'] });

      elegir(pdf());
      http.expectOne(`${environment.apiUrl}/upload/documento`).flush({ url: 'https://cdn/a.pdf' });
      await fixture.whenStable();
      fixture.detectChanges();

      el().querySelector<HTMLButtonElement>('.adj__quitar')!.click();
      fixture.detectChanges();

      expect(nombresAdjuntos()).toEqual([]);
    });

    it('al editar debería partir de los documentos que ya tenía el registro', () => {
      const registro: RegistroServicioApi = {
        _id: 'r1', vertical: 'veterinaria', origen: 'comercio', titulo: 'Consulta', nota: 'Consulta',
        datosEstructurados: {}, esPropio: true,
        adjuntos: [{ nombre: 'Previo.pdf', url: 'https://cdn/p.pdf', tipo: 'application/pdf' }],
      };
      crear({ verticales: ['veterinaria'], registro });

      expect(nombresAdjuntos()).toEqual(['Previo.pdf']);
    });

    /* Seis por registro: el tope que declara el contrato del API. */
    it('no debería ofrecer adjuntar cuando ya se llegó al tope', async () => {
      crear({ verticales: ['veterinaria'] });

      for (let i = 0; i < 6; i++) {
        elegir(new File(['x'], `doc-${i}.pdf`, { type: 'application/pdf' }));
        http.expectOne(`${environment.apiUrl}/upload/documento`).flush({ url: `https://cdn/${i}.pdf` });
        await fixture.whenStable();
        fixture.detectChanges();
      }

      expect(nombresAdjuntos()).toHaveLength(6);
      expect(campoArchivo()).toBeNull();
    });
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
