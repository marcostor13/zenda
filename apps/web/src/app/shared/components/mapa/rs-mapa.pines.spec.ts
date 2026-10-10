import { ComponentFixture, TestBed } from '@angular/core/testing';
import { GeoService } from '../../../core/geo/geo.service';
import { ConsentimientoService } from '../../../core/cookies/consentimiento.service';
import { crearMotorLeaflet } from './motores/motor-leaflet';
import type { EscuchasMotor, MotorMapa, OpcionesMotor } from './motores/motor-mapa';
import { RsMapaComponent, PuntoMapa } from './rs-mapa.component';

jest.mock('./motores/motor-leaflet', () => ({ crearMotorLeaflet: jest.fn() }));

const crearMotor = crearMotorLeaflet as jest.MockedFunction<typeof crearMotorLeaflet>;

/**
 * Lo que el componente hace con un motor ya montado: aquí el motor es un doble,
 * así que se puede comprobar qué le pide al elegir un pin sin depender de que
 * un proveedor de mapas arranque en jsdom.
 */
describe('RsMapaComponent con el mapa montado', () => {
  let fixture: ComponentFixture<RsMapaComponent>;
  let componente: RsMapaComponent;
  let motor: jest.Mocked<MotorMapa>;
  let opciones: OpcionesMotor;
  let escuchas: EscuchasMotor;

  const puntos: PuntoMapa[] = [
    { id: 'a1', lat: 40.4168, lng: -3.7038, etiqueta: '24 €', titulo: 'Residencia Las Rozas' },
    { id: 'a2', lat: 41.3874, lng: 2.1686, etiqueta: '30 €', titulo: 'Can Feliç' },
  ];

  beforeEach(async () => {
    motor = {
      pintar: jest.fn(),
      pintarRuta: jest.fn().mockResolvedValue(null),
      encuadrar: jest.fn(),
      centrarEn: jest.fn(),
      zonaActual: jest.fn().mockReturnValue(null),
      refrescar: jest.fn(),
      destruir: jest.fn(),
    };
    crearMotor.mockImplementation((opcionesMotor, escuchasMotor) => {
      opciones = opcionesMotor;
      escuchas = escuchasMotor;
      return Promise.resolve(motor);
    });

    await TestBed.configureTestingModule({
      imports: [RsMapaComponent],
      providers: [
        { provide: GeoService, useValue: { claveMapas: jest.fn().mockResolvedValue('') } },
        { provide: ConsentimientoService, useValue: { permite: () => true } },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(RsMapaComponent);
    componente = fixture.componentInstance;
    fixture.componentRef.setInput('puntos', puntos);
    fixture.componentRef.setInput('pinesConPrecio', true);
    fixture.componentRef.setInput('fichaExterna', true);
    fixture.detectChanges();
    await fixture.whenStable();
  });

  afterEach(() => {
    fixture.destroy();
    jest.useRealTimers();
  });

  it('debería pedir al motor pines con precio y sin tarjeta propia', () => {
    expect(opciones.pinesConPrecio).toBe(true);
    expect(opciones.fichaExterna).toBe(true);
  });

  it('debería encuadrar los resultados al pintarlos por primera vez', () => {
    expect(motor.pintar).toHaveBeenCalledWith(puntos, null);
    expect(motor.encuadrar).toHaveBeenCalledTimes(1);
  });

  it('no debería mover el mapa ni volver a pedir la ruta sólo por resaltar un pin', () => {
    motor.encuadrar.mockClear();
    motor.pintarRuta.mockClear();

    fixture.componentRef.setInput('activo', 'a2');
    fixture.detectChanges();

    // Se repinta para marcar el elegido, pero la vista es de quien la colocó.
    expect(motor.pintar).toHaveBeenLastCalledWith(puntos, 'a2');
    expect(motor.encuadrar).not.toHaveBeenCalled();
    expect(motor.pintarRuta).not.toHaveBeenCalled();
  });

  it('debería volver a encuadrar cuando llegan resultados nuevos', () => {
    motor.centrarEn.mockClear();

    fixture.componentRef.setInput('puntos', [puntos[0]]);
    fixture.detectChanges();

    expect(motor.centrarEn).toHaveBeenCalledWith(40.4168, -3.7038, expect.any(Number));
  });

  it('debería avisar del pin elegido', () => {
    const elegidos: string[] = [];
    componente.puntoElegido.subscribe((id) => elegidos.push(id));

    escuchas.alElegirPunto('a1');

    expect(elegidos).toEqual(['a1']);
  });

  it('debería avisar de una pulsación sobre el fondo', () => {
    const pulsado = jest.fn();
    componente.fondoPulsado.subscribe(pulsado);

    escuchas.alPulsarFondo?.();

    expect(pulsado).toHaveBeenCalledTimes(1);
  });

  it('no debería tomar por pulsación del fondo la del pin que se acaba de elegir', () => {
    jest.useFakeTimers();
    const pulsado = jest.fn();
    componente.fondoPulsado.subscribe(pulsado);

    // Según el proveedor, pulsar un pin avisa también del mapa que hay debajo:
    // sin este margen la ficha se cerraría nada más abrirse.
    escuchas.alElegirPunto('a1');
    escuchas.alPulsarFondo?.();
    expect(pulsado).not.toHaveBeenCalled();

    jest.advanceTimersByTime(1000);
    escuchas.alPulsarFondo?.();
    expect(pulsado).toHaveBeenCalledTimes(1);
  });
});
