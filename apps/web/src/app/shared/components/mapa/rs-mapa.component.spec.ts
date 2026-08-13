import { ComponentFixture, TestBed } from '@angular/core/testing';
import { RsMapaComponent, PuntoMapa } from './rs-mapa.component';

/**
 * Leaflet necesita un contenedor con tamaño real y APIs que jsdom no
 * implementa del todo, así que aquí se comprueba lo que sí es verificable sin
 * un navegador: que el componente monta sin romper, expone el lienzo accesible
 * y sobrevive a que el mapa no llegue a inicializarse.
 */
describe('RsMapaComponent', () => {
  let fixture: ComponentFixture<RsMapaComponent>;
  let componente: RsMapaComponent;

  const puntos: PuntoMapa[] = [
    { id: 'a1', lat: 40.4168, lng: -3.7038, etiqueta: '€24', titulo: 'Residencia Las Rozas' },
    { id: 'a2', lat: 41.3874, lng: 2.1686, etiqueta: '€30', titulo: 'Can Feliç' },
  ];

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [RsMapaComponent] }).compileComponents();
    fixture = TestBed.createComponent(RsMapaComponent);
    componente = fixture.componentInstance;
  });

  afterEach(() => fixture.destroy());

  it('debería renderizar el lienzo con su etiqueta accesible', () => {
    fixture.componentRef.setInput('ariaLabel', 'Mapa de alojamientos');
    fixture.detectChanges();

    const lienzo: HTMLElement = fixture.nativeElement.querySelector('.rs-mapa__lienzo');
    expect(lienzo).toBeTruthy();
    expect(lienzo.getAttribute('role')).toBe('application');
    expect(lienzo.getAttribute('aria-label')).toBe('Mapa de alojamientos');
  });

  it('no debería romper al recibir puntos antes de que el mapa esté listo', () => {
    fixture.componentRef.setInput('puntos', puntos);
    expect(() => fixture.detectChanges()).not.toThrow();
  });

  it('debería poder destruirse sin mapa inicializado', () => {
    fixture.detectChanges();
    expect(() => componente.ngOnDestroy()).not.toThrow();
  });

  it('refrescar debería ser seguro aunque no haya mapa', () => {
    expect(() => componente.refrescar()).not.toThrow();
  });

  it('centrarEn debería ignorar coordenadas no numéricas', () => {
    fixture.detectChanges();
    // El catálogo local de poblaciones no trae coordenadas: centrar con NaN
    // mandaría el mapa al punto (0,0), en mitad del Atlántico.
    expect(() => componente.centrarEn(NaN, NaN)).not.toThrow();
  });

  it('zonaActual debería ser null mientras el mapa no exista', () => {
    expect(componente.zonaActual()).toBeNull();
  });
});
