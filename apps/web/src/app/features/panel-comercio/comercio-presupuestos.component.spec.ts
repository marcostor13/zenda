import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import {
  EstadoRespuestaPresupuesto, EstadoSolicitudPresupuesto, SolicitudPresupuestoComercioVista, VerticalKey,
} from 'shared';
import { ComercioApiService } from './comercio-api.service';
import { ComercioPresupuestosComponent } from './comercio-presupuestos.component';

const solicitud = (
  id: string,
  estado: EstadoRespuestaPresupuesto,
  extra: Partial<SolicitudPresupuestoComercioVista> = {},
): SolicitudPresupuestoComercioVista => ({
  id, codigo: `PRE-${id}`, vertical: VerticalKey.TRANSPORTE, estadoSolicitud: EstadoSolicitudPresupuesto.ABIERTA,
  servicioId: 's1', tituloServicio: 'DogVan', detalle: { resumen: [['Origen', 'Madrid'], ['Destino', 'París']] },
  fechaServicio: '2026-10-10', clienteNombre: 'Ana', createdAt: '2026-09-20T10:00:00.000Z',
  respuesta: { servicioId: 's1', comercioId: 'c1', estado },
  ...extra,
});

describe('ComercioPresupuestosComponent', () => {
  let fixture: ComponentFixture<ComercioPresupuestosComponent>;
  let componente: ComercioPresupuestosComponent;
  let api: jest.Mocked<Pick<ComercioApiService, 'misPresupuestos' | 'responderPresupuesto' | 'rechazarPresupuesto'>>;

  const LISTA = [
    solicitud('1', EstadoRespuestaPresupuesto.PENDIENTE, { comentario: 'Con dos gatos' }),
    solicitud('2', EstadoRespuestaPresupuesto.RESPONDIDA, {
      respuesta: {
        servicioId: 's1', comercioId: 'c1', estado: EstadoRespuestaPresupuesto.RESPONDIDA,
        importe: 250, condiciones: 'Incluye peajes', validoHasta: '2026-09-25T00:00:00.000Z',
      },
    }),
    solicitud('3', EstadoRespuestaPresupuesto.ACEPTADA),
    solicitud('4', EstadoRespuestaPresupuesto.PENDIENTE, { estadoSolicitud: EstadoSolicitudPresupuesto.CADUCADA }),
  ];

  const crear = async (): Promise<void> => {
    await TestBed.configureTestingModule({
      imports: [ComercioPresupuestosComponent],
      providers: [{ provide: ComercioApiService, useValue: api }],
    }).compileComponents();
    fixture = TestBed.createComponent(ComercioPresupuestosComponent);
    componente = fixture.componentInstance;
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  };

  beforeEach(() => {
    api = {
      misPresupuestos: jest.fn().mockReturnValue(of(LISTA)),
      responderPresupuesto: jest.fn().mockReturnValue(of([])),
      rechazarPresupuesto: jest.fn().mockReturnValue(of([])),
    };
  });

  it('debería repartir las solicitudes en pestañas y contar cada una', async () => {
    await crear();

    expect(componente.cargando()).toBe(false);
    expect(componente.contar('pendientes')).toBe(1);
    expect(componente.contar('respondidas')).toBe(1);
    expect(componente.contar('cerradas')).toBe(2);
    expect(componente.visibles().map((s) => s.id)).toEqual(['1']);

    const texto = fixture.nativeElement.textContent as string;
    expect(texto).toContain('París');
    expect(texto).toContain('Con dos gatos');
  });

  it('debería cambiar de pestaña al pulsarla', async () => {
    await crear();

    (fixture.nativeElement.querySelectorAll('.cp__pestana')[1] as HTMLButtonElement).click();
    fixture.detectChanges();

    expect(componente.pestana()).toBe('respondidas');
    expect(fixture.nativeElement.querySelector('.cp__enviado')).not.toBeNull();
  });

  it('debería avisar si no se pueden cargar', async () => {
    api.misPresupuestos.mockReturnValue(throwError(() => new Error('500')));
    await crear();

    expect(componente.error()).toBeTruthy();
    expect(componente.cargando()).toBe(false);
  });

  it('debería mostrar el vacío en una pestaña sin solicitudes', async () => {
    api.misPresupuestos.mockReturnValue(of([]));
    await crear();

    expect(fixture.nativeElement.querySelector('.cp__vacio')).not.toBeNull();
  });

  it('debería etiquetar cada estado de respuesta y tolerar uno desconocido', async () => {
    await crear();

    expect(componente.etiquetaRespuesta(LISTA[0])).toBe('Sin responder');
    expect(componente.etiquetaRespuesta(LISTA[2])).toBe('Aceptada por el cliente');
    expect(componente.etiquetaRespuesta(solicitud('x', 'rara' as EstadoRespuestaPresupuesto))).toBe('rara');
    expect(componente.resumen(solicitud('y', EstadoRespuestaPresupuesto.PENDIENTE, { detalle: {} }))).toEqual([]);
  });

  it('sólo debería dejar responder a solicitudes abiertas pendientes o ya respondidas', async () => {
    await crear();

    expect(componente.puedeResponder(LISTA[0])).toBe(true);
    expect(componente.puedeResponder(LISTA[1])).toBe(true);
    expect(componente.puedeResponder(LISTA[2])).toBe(false);
    expect(componente.puedeResponder(LISTA[3])).toBe(false);
  });

  it('debería abrir el formulario con el precio y condiciones ya enviados', async () => {
    await crear();

    componente.abrir(LISTA[1]);

    expect(componente.abierta()).toBe('2:s1');
    expect(componente.form.getRawValue()).toEqual({ importe: 250, validezDias: 3, condiciones: 'Incluye peajes' });
  });

  it('debería enviar el presupuesto y refrescar la lista', async () => {
    await crear();
    api.responderPresupuesto.mockReturnValue(of([LISTA[1]]));
    componente.abrir(LISTA[0]);
    fixture.detectChanges();
    componente.form.patchValue({ importe: 180 });

    await componente.responder(LISTA[0]);

    expect(api.responderPresupuesto).toHaveBeenCalledWith('1', 's1', { importe: 180, validezDias: 3, condiciones: undefined });
    expect(componente.solicitudes()).toEqual([LISTA[1]]);
    expect(componente.abierta()).toBeNull();
    expect(componente.enviando()).toBe(false);
  });

  it('no debería enviar sin importe', async () => {
    await crear();
    componente.abrir(LISTA[0]);

    await componente.responder(LISTA[0]);

    expect(api.responderPresupuesto).not.toHaveBeenCalled();
  });

  it('debería rechazar sin enviar las condiciones como motivo', async () => {
    await crear();
    componente.abrir(LISTA[0]);
    componente.form.patchValue({ condiciones: 'No hago internacionales' });

    await componente.rechazar(LISTA[0]);

    expect(api.rechazarPresupuesto).toHaveBeenCalledWith('1', 's1');
  });

  it('debería mantener el formulario abierto si el envío falla', async () => {
    await crear();
    api.rechazarPresupuesto.mockReturnValue(throwError(() => new Error('500')));
    componente.abrir(LISTA[0]);

    await componente.rechazar(LISTA[0]);

    expect(componente.error()).toBeTruthy();
    expect(componente.abierta()).toBe('1:s1');
    expect(componente.enviando()).toBe(false);
  });
});
