import { ComponentFixture, TestBed } from '@angular/core/testing';
import { FormBuilder, FormGroup } from '@angular/forms';
import { ModeloPrecio, PlantillaTransporte, QuienViaja, UnidadCobro } from 'shared';
import { AltaTransporteComponent } from './alta-transporte.component';

describe('AltaTransporteComponent', () => {
  let fixture: ComponentFixture<AltaTransporteComponent>;
  let componente: AltaTransporteComponent;
  let grupo: FormGroup;

  /** El grupo que le pasa el formulario del listado, con lo mínimo que usa. */
  const construirGrupo = (fb: FormBuilder): FormGroup => fb.group({
    plantilla: [PlantillaTransporte.EXCLUSIVO as string],
    quienViaja: [QuienViaja.SOLO_MASCOTA as string],
    tiposTrayecto: [['solo_ida'] as string[]],
    ambitos: [['local'] as string[]],
    tipoRecogida: ['puerta_a_puerta'],
    finalidades: [[] as string[]],
    modoCobertura: ['radio'],
    direccionBase: [''],
    radioKm: [50],
    distanciaMaximaKm: [0],
    municipiosCobertura: [[] as string[]],
    paisesCobertura: [[] as string[]],
    puntosTrayecto: ['libres'],
    baseKilometraje: ['recogida_destino'],
    tipoIdaVuelta: ['espera_mismo_dia'],
    politicaParadas: ['con_suplemento'],
    esperaIncluidaMin: [30],
    politicaPeajes: ['incluidos'],
    reglasTarifa: fb.array<FormGroup>([]),
    redondeoDistancia: ['exacta'],
    suplementos: fb.array<FormGroup>([]),
    precioOrientativo: ['desde'],
    horasRespuestaPresupuesto: [12],
    validezPresupuestoHoras: [48],
    especiesAdmitidas: [['Perro'] as string[]],
    tamanosAdmitidos: [[] as string[]],
    maxMascotasPorReserva: [3],
    compartido: ['misma_familia'],
    situacionesConfirmacion: [[] as string[]],
    plazasAcompanantes: [0],
    precioAcompanante: ['incluido'],
    equipajeAdmitido: [[] as string[]],
    equipamientoVehiculo: [[] as string[]],
    requisitosDocumentales: fb.array<FormGroup>([]),
    modoDisponibilidad: ['calendario'],
    antelacionMinimaHoras: [24],
    ventanaRecogida: ['franja_60'],
    confirmacionHoras: [0],
    frecuenciasRecurrencia: [[] as string[]],
    periodoMaximoSemanas: [12],
    salidas: fb.array<FormGroup>([]),
    respuestaUrgenteHoras: [2],
    politicaCancelacionTransporte: ['estandar'],
    cortesiaMinutos: [15],
    accionNoShow: ['cobro_completo'],
  });

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [AltaTransporteComponent] }).compileComponents();

    grupo = construirGrupo(TestBed.inject(FormBuilder));
    fixture = TestBed.createComponent(AltaTransporteComponent);
    componente = fixture.componentInstance;
    fixture.componentRef.setInput('grupo', grupo);
    fixture.detectChanges();
  });

  const el = (): HTMLElement => fixture.nativeElement as HTMLElement;

  it('debería arrancar en el paso del tipo de servicio', () => {
    expect(componente.pasoActivo()).toBe(1);
    expect(el().querySelector('[data-testid="paso-tipo"]')).not.toBeNull();
  });

  it('debería moverse entre pasos sin perder lo escrito', () => {
    componente.irAPaso(3);
    fixture.detectChanges();

    expect(el().querySelector('[data-testid="paso-precio"]')).not.toBeNull();
    expect(grupo.get('radioKm')?.value).toBe(50);
  });

  it('no debería salirse del rango de pasos', () => {
    componente.irAPaso(0);
    expect(componente.pasoActivo()).toBe(1);
    componente.irAPaso(99);
    expect(componente.pasoActivo()).toBe(1);
  });

  describe('plantilla', () => {
    /**
     * Quien elige «taxi pet-friendly» ya ha dicho que viajan personas: volver a
     * preguntárselo campo a campo es hacerle repetir lo que acaba de decir.
     */
    it('debería arrastrar quién viaja y las plazas al elegir taxi pet-friendly', () => {
      componente.elegirPlantilla(PlantillaTransporte.TAXI_PETFRIENDLY);

      expect(grupo.get('quienViaja')?.value).toBe(QuienViaja.MASCOTA_Y_RESPONSABLE);
      expect(grupo.get('plazasAcompanantes')?.value).toBe(1);
    });

    it('debería poner el compartido de familias distintas al elegir compartido', () => {
      componente.elegirPlantilla(PlantillaTransporte.COMPARTIDO);

      expect(grupo.get('compartido')?.value).toBe('distintas_separadas');
    });

    it('debería pasar a salidas programadas al elegir ruta programada', () => {
      componente.elegirPlantilla(PlantillaTransporte.RUTA_PROGRAMADA);

      expect(grupo.get('modoDisponibilidad')?.value).toBe('salidas_programadas');
      expect(componente.ofreceRutaProgramada()).toBe(true);
    });
  });

  describe('reglas de tarifa', () => {
    it('debería añadir y quitar reglas', () => {
      componente.anadirRegla();
      componente.anadirRegla();
      expect(componente.reglas.length).toBe(2);

      componente.quitarRegla(0);
      expect(componente.reglas.length).toBe(1);
    });

    /** El orden **es** el dato: gana la primera regla que encaja. */
    it('debería reordenar las reglas sin perder su contenido', () => {
      componente.anadirRegla();
      componente.anadirRegla();
      componente.reglas.at(0).patchValue({ nombre: 'Primera' });
      componente.reglas.at(1).patchValue({ nombre: 'Segunda' });

      componente.subirRegla(1);

      expect(componente.reglas.at(0).get('nombre')?.value).toBe('Segunda');
      expect(componente.reglas.at(1).get('nombre')?.value).toBe('Primera');
    });

    it('no debería mover una regla fuera de la lista', () => {
      componente.anadirRegla();
      componente.subirRegla(0);
      componente.bajarRegla(0);

      expect(componente.reglas.length).toBe(1);
    });

    it('debería encadenar los tramos desde donde acaba el anterior', () => {
      componente.anadirRegla();
      componente.reglas.at(0).patchValue({ modelo: ModeloPrecio.TRAMOS });
      componente.anadirTramo(0);
      componente.tramosDe(0).at(0).patchValue({ hastaKm: 50 });
      componente.anadirTramo(0);

      expect(componente.tramosDe(0).at(1).get('desdeKm')?.value).toBe(51);
    });
  });

  describe('suplementos', () => {
    it('debería activar un suplemento con la forma de cálculo que le corresponde', () => {
      componente.alternarSuplemento('urgencia');

      expect(componente.tieneSuplemento('urgencia')).toBe(true);
      expect(componente.suplementos.at(0).get('forma')?.value).toBe('importe_fijo');
      expect(componente.suplementos.at(0).get('aplicacion')?.value).toBe('automatica');
    });

    /**
     * Lo que no se dispara solo se pide: así el cliente no se encuentra un
     * cargo que no eligió.
     */
    it('debería dejar «a petición» los suplementos que no tienen condición propia', () => {
      componente.alternarSuplemento('transportin_empresa');

      expect(componente.suplementos.at(0).get('aplicacion')?.value).toBe('a_peticion');
    });

    it('debería quitarlo al desmarcarlo', () => {
      componente.alternarSuplemento('urgencia');
      componente.alternarSuplemento('urgencia');

      expect(componente.suplementos.length).toBe(0);
    });
  });

  describe('requisitos documentales', () => {
    it('debería proponer cuándo se exige cada documento', () => {
      componente.alternarRequisito('pasaporte');

      expect(componente.requisitos.at(0).get('exigencia')?.value).toBe('internacional');
    });

    it('debería localizar el requisito por su clave', () => {
      componente.alternarRequisito('microchip');
      componente.alternarRequisito('vacunas');

      expect(componente.indiceRequisito('vacunas')).toBe(1);
      expect(componente.indiceRequisito('pasaporte')).toBe(-1);
    });
  });

  describe('campos condicionales', () => {
    it('no debería ofrecer el precio del acompañante sin plazas para personas', () => {
      expect(componente.admiteAcompanantes()).toBe(false);

      grupo.patchValue({ plazasAcompanantes: 2 });
      expect(componente.admiteAcompanantes()).toBe(true);
    });

    it('debería ofrecer la recurrencia solo si se aceptan trayectos recurrentes', () => {
      expect(componente.ofreceRecurrente()).toBe(false);

      componente.alternar('tiposTrayecto', 'recurrente');
      expect(componente.ofreceRecurrente()).toBe(true);
    });

    it('debería enseñar el bloque de presupuesto si alguna regla lo usa', () => {
      expect(componente.usaPresupuesto()).toBe(false);

      componente.anadirRegla();
      componente.reglas.at(0).patchValue({ modelo: ModeloPrecio.PRESUPUESTO });
      expect(componente.usaPresupuesto()).toBe(true);
    });
  });

  describe('simulación', () => {
    /**
     * Es el ejemplo del documento de alta: Castellón → Valencia, ida y vuelta,
     * 0,80 €/km y suplemento nocturno de 15 €.
     */
    it('debería calcular el mismo importe que cobrará el API', () => {
      componente.anadirRegla();
      componente.reglas.at(0).patchValue({
        nombre: 'Provincia', modelo: ModeloPrecio.KM,
        unidadCobro: UnidadCobro.VEHICULO, precioKm: 0.8,
      });
      componente.alternarSuplemento('nocturno');
      componente.suplementos.at(0).patchValue({ importe: 15 });

      componente.simKm.set(74);
      componente.simIdaVuelta.set(true);
      componente.simNocturno.set(true);

      const simulacion = componente.simulacion();
      expect(simulacion?.kmFacturables).toBe(148);
      expect(simulacion?.total).toBe(133.4);
    });

    it('no debería simular nada sin reglas de tarifa', () => {
      expect(componente.simulacion()).toBeNull();
    });

    it('debería avisar de que el trayecto simulado saldría por presupuesto', () => {
      componente.anadirRegla();
      componente.reglas.at(0).patchValue({ modelo: ModeloPrecio.PRESUPUESTO });

      expect(componente.simulacion()?.requierePresupuesto).toBe(true);
    });
  });

  describe('comprobaciones antes de publicar', () => {
    it('no debería dejar publicar un alta sin tarifa', () => {
      const tarifa = componente.comprobaciones().find((c) => c.clave === 'tarifa');

      expect(tarifa?.cumplida).toBe(false);
      expect(componente.puedePublicar()).toBe(false);
    });

    it('debería dar por buena la tarifa en cuanto una regla tiene importe', () => {
      componente.anadirRegla();
      componente.reglas.at(0).patchValue({ modelo: ModeloPrecio.KM, precioKm: 0.85 });

      expect(componente.comprobaciones().find((c) => c.clave === 'tarifa')?.cumplida).toBe(true);
      expect(componente.puedePublicar()).toBe(true);
    });

    /** Una regla de presupuesto no lleva importe: el precio lo pone la empresa. */
    it('debería aceptar una regla de presupuesto como tarifa válida', () => {
      componente.anadirRegla();
      componente.reglas.at(0).patchValue({ modelo: ModeloPrecio.PRESUPUESTO });

      expect(componente.comprobaciones().find((c) => c.clave === 'tarifa')?.cumplida).toBe(true);
    });

    it('debería exigir municipios cuando la cobertura es por municipios', () => {
      grupo.patchValue({ modoCobertura: 'municipios', municipiosCobertura: [] });
      expect(componente.comprobaciones().find((c) => c.clave === 'cobertura')?.cumplida).toBe(false);

      grupo.patchValue({ municipiosCobertura: ['Castellón'] });
      expect(componente.comprobaciones().find((c) => c.clave === 'cobertura')?.cumplida).toBe(true);
    });
  });
});
