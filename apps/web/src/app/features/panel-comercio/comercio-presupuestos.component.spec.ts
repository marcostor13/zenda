import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { EstadoPresupuesto, PresupuestoDto, VerticalKey } from 'shared';
import { ComercioApiService } from './comercio-api.service';
import { ComercioPresupuestosComponent } from './comercio-presupuestos.component';

const presupuesto = (id: string, estado: EstadoPresupuesto, extra: Partial<PresupuestoDto> = {}): PresupuestoDto => ({
  id, codigo: `PRE-${id}`, vertical: VerticalKey.TRANSPORTE, servicioId: 's1', comercioId: 'c1', estado,
  fechaServicio: '2026-10-10T08:00:00.000Z', moneda: 'EUR', tituloServicio: 'DogVan',
  solicitud: { resumen: [['Origen', 'Madrid'], ['Destino', 'París'], ['Notas', 'Con dos gatos']] },
  createdAt: '2026-09-20T10:00:00.000Z',
  ...extra,
});

describe('ComercioPresupuestosComponent', () => {
  let fixture: ComponentFixture<ComercioPresupuestosComponent>;
  let componente: ComercioPresupuestosComponent;
  let api: jest.Mocked<Pick<ComercioApiService, 'misPresupuestos' | 'ofertarPresupuesto'>>;

  const LISTA = [
    presupuesto('1', EstadoPresupuesto.SOLICITADO),
    presupuesto('2', EstadoPresupuesto.OFERTADO, {
      importe: 250, condiciones: 'Incluye peajes', validoHasta: '2026-09-25T00:00:00.000Z',
    }),
    presupuesto('3', EstadoPresupuesto.ACEPTADO, { importe: 300, reservaId: 'r1' }),
    presupuesto('4', EstadoPresupuesto.CADUCADO),
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
      ofertarPresupuesto: jest.fn().mockReturnValue(of(LISTA[1])),
    };
  });

  afterEach(() => fixture?.destroy());

  it('debería repartir los presupuestos en pestañas y contar cada una', async () => {
    await crear();

    expect(componente.cargando()).toBe(false);
    expect(componente.contar('pendientes')).toBe(1);
    expect(componente.contar('respondidas')).toBe(1);
    expect(componente.contar('cerradas')).toBe(2);
    expect(componente.visibles().map((p) => p.id)).toEqual(['1']);

    const texto = fixture.nativeElement.textContent as string;
    expect(texto).toContain('París');
    expect(texto).toContain('Con dos gatos');
    expect(texto).toContain('Responder con precio');
  });

  it('debería cambiar de pestaña al pulsarla y enseñar el precio enviado', async () => {
    await crear();

    (fixture.nativeElement.querySelectorAll('.cp__pestana')[1] as HTMLButtonElement).click();
    fixture.detectChanges();

    expect(componente.pestana()).toBe('respondidas');
    expect(fixture.nativeElement.querySelector('.cp__enviado')).not.toBeNull();
    expect(fixture.nativeElement.querySelector('.cp__responder')?.textContent).toContain('Cambiar precio');
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

  it('debería etiquetar cada estado y tolerar uno desconocido', async () => {
    await crear();

    expect(componente.etiquetaEstado(LISTA[0])).toBe('Pendiente de respuesta');
    expect(componente.etiquetaEstado(LISTA[2])).toBe('Aceptado');
    expect(componente.etiquetaEstado(presupuesto('x', 'rara' as EstadoPresupuesto))).toBe('rara');
    expect(componente.resumen(presupuesto('y', EstadoPresupuesto.SOLICITADO, { solicitud: {} }))).toEqual([]);
  });

  it('sólo debería dejar responder a presupuestos pedidos o ya ofertados', async () => {
    await crear();

    expect(componente.puedeResponder(LISTA[0])).toBe(true);
    expect(componente.puedeResponder(LISTA[1])).toBe(true);
    expect(componente.puedeResponder(LISTA[2])).toBe(false);
    expect(componente.puedeResponder(LISTA[3])).toBe(false);
  });

  it('debería abrir el formulario con el precio y las condiciones ya enviados', async () => {
    await crear();

    componente.abrir(LISTA[1]);

    expect(componente.abierta()).toBe('2');
    expect(componente.form.getRawValue()).toEqual({ importe: 250, validezDias: 2, condiciones: 'Incluye peajes' });
  });

  it('debería abrir el formulario vacío si todavía no hay precio', async () => {
    await crear();

    (fixture.nativeElement.querySelector('.cp__responder') as HTMLButtonElement).click();
    fixture.detectChanges();

    expect(componente.abierta()).toBe('1');
    expect(componente.form.getRawValue()).toEqual({ importe: null, validezDias: 2, condiciones: '' });
    expect(fixture.nativeElement.querySelector('.cp__form')).not.toBeNull();
  });

  it('debería ofertar con la validez en horas y actualizar la lista', async () => {
    await crear();
    const ofertado = { ...LISTA[0], estado: EstadoPresupuesto.OFERTADO, importe: 180 };
    api.ofertarPresupuesto.mockReturnValue(of(ofertado));
    componente.abrir(LISTA[0]);
    componente.form.patchValue({ importe: 180, validezDias: 3 });

    await componente.responder(LISTA[0]);

    expect(api.ofertarPresupuesto).toHaveBeenCalledWith('1', { importe: 180, condiciones: undefined, validezHoras: 72 });
    expect(componente.presupuestos()[0]).toEqual(ofertado);
    expect(componente.contar('respondidas')).toBe(2);
    expect(componente.abierta()).toBeNull();
    expect(componente.enviando()).toBe(false);
  });

  it('debería mandar las condiciones escritas', async () => {
    await crear();
    componente.abrir(LISTA[0]);
    componente.form.patchValue({ importe: 90, condiciones: 'Sin peajes' });

    await componente.responder(LISTA[0]);

    expect(api.ofertarPresupuesto).toHaveBeenCalledWith('1', { importe: 90, condiciones: 'Sin peajes', validezHoras: 48 });
  });

  it('no debería enviar sin importe', async () => {
    await crear();
    componente.abrir(LISTA[0]);

    await componente.responder(LISTA[0]);

    expect(api.ofertarPresupuesto).not.toHaveBeenCalled();
  });

  it('debería mantener el formulario abierto si el envío falla', async () => {
    await crear();
    api.ofertarPresupuesto.mockReturnValue(throwError(() => new Error('500')));
    componente.abrir(LISTA[0]);
    componente.form.patchValue({ importe: 120 });

    await componente.responder(LISTA[0]);

    expect(componente.error()).toBeTruthy();
    expect(componente.abierta()).toBe('1');
    expect(componente.enviando()).toBe(false);
  });
});
