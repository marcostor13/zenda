import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { FormBuilder, FormGroup } from '@angular/forms';
import { ModalidadViaje, NecesidadTransporte, ResponsableEntrega } from 'shared';
import { PasoTransporteComponent } from './paso-transporte.component';

describe('PasoTransporteComponent', () => {
  let fixture: ComponentFixture<PasoTransporteComponent>;
  let componente: PasoTransporteComponent;
  let grupo: FormGroup;

  /** El mismo grupo que crea el wizard, con lo que usa esta pantalla. */
  const construirGrupo = (fb: FormBuilder): FormGroup => fb.group({
    necesidad: [NecesidadTransporte.SOLO_IDA as string],
    fechaRecogida: [''],
    flexibilidad: ['hora_concreta'],
    hora: [''],
    franja: ['cualquiera'],
    origen: [''],
    destino: [''],
    distanciaKm: [10],
    paradasExtra: [0],
    esperaMinutos: [30],
    especie: ['Perro'],
    tramoPeso: ['10_25'],
    perros: [1],
    necesidades: [[] as string[]],
    comportamiento: ['tranquilo'],
    notasMascota: [''],
    modalidad: [ModalidadViaje.EXCLUSIVO as string],
    pasajeros: [0],
    equipaje: ['sin_equipaje'],
    preferencias: [[] as string[]],
    suplementos: [[] as string[]],
    quienEntrega: [ResponsableEntrega.YO as string],
    contactoRecogidaNombre: [''],
    contactoRecogidaTelefono: [''],
    indicacionesRecogida: [''],
    quienRecibe: [ResponsableEntrega.YO as string],
    contactoEntregaNombre: [''],
    contactoEntregaTelefono: [''],
    indicacionesEntrega: [''],
    confirmacionEntrega: ['notificacion'],
  });

  beforeEach(async () => {
    // El autocompletado de direcciones usa `GeoService`, que pide HttpClient.
    await TestBed.configureTestingModule({
      imports: [PasoTransporteComponent],
      providers: [provideHttpClient(), provideHttpClientTesting()],
    }).compileComponents();

    grupo = construirGrupo(TestBed.inject(FormBuilder));
    fixture = TestBed.createComponent(PasoTransporteComponent);
    componente = fixture.componentInstance;
    fixture.componentRef.setInput('grupo', grupo);
    fixture.detectChanges();
  });

  const el = (): HTMLElement => fixture.nativeElement as HTMLElement;

  it('debería preguntar primero qué tipo de servicio se necesita', () => {
    expect(el().querySelector('[data-testid="necesidad-solo_ida"]')).not.toBeNull();
    expect(el().querySelector('[data-testid="necesidad-ida_vuelta"]')).not.toBeNull();
  });

  /**
   * La regla que ordena el vertical: al cliente no se le enseña nunca cómo
   * calcula la empresa. Si aparece «€/km» o «por zona» en la pantalla, es que
   * se le está pidiendo que entienda un sistema tarifario que no es suyo.
   */
  it('no debería enseñar al cliente el sistema tarifario de la empresa', () => {
    const texto = el().textContent ?? '';

    expect(texto).not.toContain('€/km');
    expect(texto).not.toContain('por zona');
    expect(texto).not.toContain('tarifa base');
  });

  describe('necesidad y modalidad', () => {
    it('debería fijar la modalidad al elegir viajar con la mascota', () => {
      componente.elegirNecesidad(NecesidadTransporte.VIAJO_CON_MI_MASCOTA);

      expect(grupo.get('modalidad')?.value).toBe(ModalidadViaje.VIAJO_CON_MI_MASCOTA);
      expect(grupo.get('pasajeros')?.value).toBe(1);
      expect(componente.viajaElResponsable()).toBe(true);
    });

    it('debería dejar los pasajeros a cero si la mascota viaja sola', () => {
      componente.elegirModalidad(ModalidadViaje.VIAJO_CON_MI_MASCOTA);
      componente.elegirModalidad(ModalidadViaje.EXCLUSIVO);

      expect(grupo.get('pasajeros')?.value).toBe(0);
      expect(componente.viajaElResponsable()).toBe(false);
    });

    it('debería pedir el tiempo de espera solo en la ida y vuelta', () => {
      expect(componente.esIdaVuelta()).toBe(false);

      componente.elegirNecesidad(NecesidadTransporte.IDA_VUELTA);
      fixture.detectChanges();

      expect(componente.esIdaVuelta()).toBe(true);
      expect(el().querySelector('#wz-espera')).not.toBeNull();
    });
  });

  describe('campos condicionales', () => {
    it('debería pedir la hora exacta solo a quien la necesita', () => {
      expect(el().querySelector('#wz-hora')).not.toBeNull();

      grupo.patchValue({ flexibilidad: 'flexible' });
      fixture.detectChanges();

      expect(el().querySelector('#wz-hora')).toBeNull();
      expect(el().querySelector('#wz-franja')).not.toBeNull();
    });

    it('no debería pedir datos de otra persona si entrega el propio cliente', () => {
      expect(el().querySelector('#wz-entrega-nombre')).toBeNull();

      grupo.patchValue({ quienEntrega: ResponsableEntrega.OTRA_PERSONA });
      fixture.detectChanges();

      expect(el().querySelector('#wz-entrega-nombre')).not.toBeNull();
    });

    it('debería ocultar las paradas si el transportista no las admite', () => {
      expect(el().querySelector('#wz-paradas')).toBeNull();

      fixture.componentRef.setInput('admiteParadas', true);
      fixture.detectChanges();

      expect(el().querySelector('#wz-paradas')).not.toBeNull();
    });
  });

  describe('listas de opciones', () => {
    it('debería marcar y desmarcar una necesidad de la mascota', () => {
      componente.alternar('necesidades', 'medicacion');
      expect(componente.tiene('necesidades', 'medicacion')).toBe(true);

      componente.alternar('necesidades', 'medicacion');
      expect(componente.tiene('necesidades', 'medicacion')).toBe(false);
    });

    it('debería guardar los suplementos elegidos en el formulario', () => {
      fixture.componentRef.setInput('suplementos', [
        { clave: 'transportin_empresa', nombre: 'Transportín', importe: 8 },
      ]);
      fixture.detectChanges();

      componente.alternar('suplementos', 'transportin_empresa');

      expect(grupo.get('suplementos')?.value).toEqual(['transportin_empresa']);
    });
  });

  describe('desglose del precio', () => {
    it('debería enseñar el total y sus líneas', () => {
      fixture.componentRef.setInput('desglose', {
        requierePresupuesto: false,
        distanciaKm: 74, kmFacturables: 148,
        lineas: [{ concepto: 'Provincia', importe: 118.4 }, { concepto: 'Nocturno', importe: 15 }],
        servicio: 118.4, suplementos: 15, total: 133.4, minimoAplicado: false,
      });
      fixture.detectChanges();

      const desglose = el().querySelector('[data-testid="desglose-transporte"]');
      expect(desglose?.textContent).toContain('Provincia');
      expect(el().querySelector('[data-testid="total-transporte"]')?.textContent).toContain('133,4');
    });

    /** Sin precio cerrado no se enseña un 0 €: se explica que va por presupuesto. */
    it('debería explicar que el viaje necesita presupuesto', () => {
      fixture.componentRef.setInput('desglose', {
        requierePresupuesto: true,
        motivoPresupuesto: 'La empresa calcula este servicio a medida.',
        distanciaKm: 900, kmFacturables: 900,
        lineas: [], servicio: 0, suplementos: 0, total: 0, minimoAplicado: false,
      });
      fixture.detectChanges();

      const desglose = el().querySelector('[data-testid="desglose-transporte"]');
      expect(desglose?.textContent).toContain('presupuesto');
      expect(el().querySelector('[data-testid="total-transporte"]')).toBeNull();
    });

    it('no debería pintar nada mientras no hay desglose', () => {
      expect(el().querySelector('[data-testid="desglose-transporte"]')).toBeNull();
    });
  });
});
