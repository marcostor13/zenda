import { ComponentFixture, TestBed } from '@angular/core/testing';
import { FormGroup, NonNullableFormBuilder } from '@angular/forms';
import {
  ModalidadTransporte, ModoHorarioTransporte, ModoPrecioTransporte, TamanoPerro, TipoServicioTransporte,
  cotizarTransporte,
} from 'shared';
import { TarifarioTransporteComponent } from './tarifario-transporte.component';

describe('TarifarioTransporteComponent', () => {
  let fixture: ComponentFixture<TarifarioTransporteComponent>;
  let componente: TarifarioTransporteComponent;
  let grupo: FormGroup;

  const crearGrupo = (fb: NonNullableFormBuilder): FormGroup => fb.group({
    tarifaBase: [20 as number | null],
    tarifaKm: [1 as number | null],
    distanciaMinimaKm: [null as number | null],
    capacidadPerros: [2],
    modoPrecio: [ModoPrecioTransporte.POR_KM as string],
    precioFijo: [null as number | null],
    zonasPrecio: fb.array<FormGroup>([]),
    modalidades: [[ModalidadTransporte.COMPARTIDO] as string[]],
    precioExclusivo: [null as number | null],
    plazasPasajeros: [0],
    tiempoExtraCompartidoMin: [0],
    especiesAceptadas: [['perro'] as string[]],
    aceptaUrgentes: [true],
    aceptaLoAntesPosible: [true],
    incluidos: [[] as string[]],
    suplementos: fb.group({
      urgente: [null as number | null], nocturno: [null as number | null],
      largaDistanciaDesdeKm: [null as number | null], largaDistancia: [null as number | null],
      mascotaAdicional: [null as number | null], mascotaGrande: [null as number | null],
      medicacion: [null as number | null], porPersona: [null as number | null], porMaleta: [null as number | null],
    }),
    reglasPresupuesto: fb.group({
      internacional: [false], masDeMascotas: [null as number | null], necesidadesEspeciales: [false],
      masDeKm: [null as number | null], especiesExoticas: [false],
    }),
    cancelacion: fb.group({ gratisHastaHoras: [24], reembolsoTardioPct: [0] }),
  });

  /** El mismo cálculo que el componente, hecho a mano con la función compartida. */
  const precioEsperado = (modalidad: ModalidadTransporte, tarifa: Parameters<typeof cotizarTransporte>[0]): number =>
    cotizarTransporte(tarifa, {
      tipoServicio: TipoServicioTransporte.SOLO_IDA, origen: { texto: '' }, destino: { texto: '' }, fecha: '',
      modoHorario: ModoHorarioTransporte.HORA_CONCRETA, hora: '10:00',
      mascotas: [{ especie: 'perro', tamano: TamanoPerro.MEDIANO }], necesidades: [], preferencias: [],
      modalidad, personas: 1,
    }, { km: 70, horasHastaRecogida: 999 }).total;

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [TarifarioTransporteComponent] }).compileComponents();
    grupo = crearGrupo(TestBed.inject(NonNullableFormBuilder));
    fixture = TestBed.createComponent(TarifarioTransporteComponent);
    componente = fixture.componentInstance;
    fixture.componentRef.setInput('grupo', grupo);
    fixture.detectChanges();
  });

  it('debería enseñar el precio de ejemplo calculado con la función del servidor', () => {
    const esperado = precioEsperado(ModalidadTransporte.COMPARTIDO, {
      modoPrecio: ModoPrecioTransporte.POR_KM, tarifaBase: 20, tarifaKm: 1, zonasPrecio: [],
      modalidades: [ModalidadTransporte.COMPARTIDO], suplementos: {}, capacidadPerros: 2, plazasPasajeros: 0,
      especiesAceptadas: ['perro'],
    });

    expect(componente.ejemplo()).toEqual([
      expect.objectContaining({ modalidad: 'compartido', estado: 'precio', total: esperado }),
    ]);
    expect(fixture.nativeElement.querySelectorAll('.tt__ejemplo-fila').length).toBe(1);
  });

  it('debería recalcular el ejemplo al cambiar la tarifa', () => {
    const antes = componente.ejemplo()[0].total;

    grupo.patchValue({ tarifaKm: 2 });

    expect(componente.ejemplo()[0].total).toBeGreaterThan(antes);
  });

  it('debería invitar a elegir modalidad si no hay ninguna', () => {
    grupo.patchValue({ modalidades: [] });
    fixture.detectChanges();

    expect(componente.ejemplo()).toEqual([]);
    expect(fixture.nativeElement.querySelector('.tt__ejemplo').textContent).toContain('Elige al menos una modalidad');
  });

  it('debería pedir los campos de cada modalidad ofrecida', () => {
    grupo.patchValue({ modalidades: ['exclusivo', 'con_propietario'] });
    fixture.detectChanges();

    expect(componente.ofrece('exclusivo')).toBe(true);
    expect(componente.ofrece('compartido')).toBe(false);
    const html = fixture.nativeElement.innerHTML as string;
    expect(html).toContain('formcontrolname="precioExclusivo"');
    expect(html).toContain('formcontrolname="plazasPasajeros"');
    expect(html).not.toContain('formcontrolname="tiempoExtraCompartidoMin"');
  });

  it('debería añadir y quitar rutas con precio en el modo por zonas', () => {
    grupo.patchValue({ modoPrecio: ModoPrecioTransporte.POR_ZONA });
    fixture.detectChanges();

    componente.anadirZona();
    componente.anadirZona();
    fixture.detectChanges();
    expect(componente.zonas.length).toBe(2);
    expect(fixture.nativeElement.querySelectorAll('.tt__zona').length).toBe(2);

    (fixture.nativeElement.querySelector('.tt__zona button') as HTMLButtonElement).click();
    expect(componente.zonas.length).toBe(1);
  });

  it('debería ilustrar el modo por zonas con la primera ruta declarada', () => {
    grupo.patchValue({ modoPrecio: ModoPrecioTransporte.POR_ZONA });
    componente.anadirZona();
    componente.zonas.at(0).patchValue({ origen: 'Madrid', destino: 'Toledo', precio: 55 });

    expect(componente.ejemplo()[0]).toEqual(expect.objectContaining({ estado: 'precio' }));
    expect(componente.ejemplo()[0].total).toBeGreaterThanOrEqual(55);
  });

  it('debería pintar el campo de precio fijo en su modo', () => {
    grupo.patchValue({ modoPrecio: ModoPrecioTransporte.FIJO, precioFijo: 45, suplementos: { urgente: '' } });
    fixture.detectChanges();

    expect(fixture.nativeElement.innerHTML).toContain('formcontrolname="precioFijo"');
    expect(componente.ejemplo()[0].total).toBeGreaterThanOrEqual(45);
  });
});
