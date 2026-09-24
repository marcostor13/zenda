import { ComponentFixture, TestBed } from '@angular/core/testing';
import { OpcionElegible, RsOpcionesComponent } from './rs-opciones.component';

const OPCIONES: OpcionElegible[] = [
  { valor: 'a', etiqueta: 'Estándar', icono: 'car', descripcion: 'Normal' },
  { valor: 'b', etiqueta: 'Exprés', icono: 'zap' },
  { valor: 'c', etiqueta: 'Nocturno', deshabilitada: true },
];

describe('RsOpcionesComponent', () => {
  let fixture: ComponentFixture<RsOpcionesComponent>;
  let componente: RsOpcionesComponent;
  let alCambiar: jest.Mock;

  const crear = (entradas: Record<string, unknown> = {}): void => {
    fixture = TestBed.createComponent(RsOpcionesComponent);
    componente = fixture.componentInstance;
    fixture.componentRef.setInput('opciones', OPCIONES);
    fixture.componentRef.setInput('leyenda', 'Modalidad');
    Object.entries(entradas).forEach(([k, v]) => fixture.componentRef.setInput(k, v));
    alCambiar = jest.fn();
    componente.registerOnChange(alCambiar);
    fixture.detectChanges();
  };

  const inputs = (): HTMLInputElement[] => Array.from(fixture.nativeElement.querySelectorAll('input'));

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [RsOpcionesComponent] }).compileComponents();
  });

  it('debería pintar radios y elegir una sola opción', () => {
    crear();
    expect(inputs()[0].type).toBe('radio');

    inputs()[0].dispatchEvent(new Event('change'));
    inputs()[1].dispatchEvent(new Event('change'));

    expect(alCambiar).toHaveBeenLastCalledWith('b');
    expect(componente.estaElegida('a')).toBe(false);
    expect(componente.estaElegida('b')).toBe(true);
  });

  it('debería alternar varias opciones en modo múltiple', () => {
    crear({ multiple: true });
    expect(inputs()[0].type).toBe('checkbox');

    componente.alternar('a');
    componente.alternar('b');
    expect(alCambiar).toHaveBeenLastCalledWith(['a', 'b']);

    componente.alternar('a');
    expect(alCambiar).toHaveBeenLastCalledWith(['b']);
  });

  it('debería aceptar un valor suelto, una lista o nada', () => {
    crear();
    componente.writeValue('a');
    expect(componente.estaElegida('a')).toBe(true);
    componente.writeValue(['a', 'b']);
    expect(componente.elegidas().size).toBe(2);
    componente.writeValue(null);
    expect(componente.elegidas().size).toBe(0);
  });

  it('debería marcar la tarjeta elegida con el check y la descripción', () => {
    crear();
    componente.writeValue('a');
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('.op__check')).not.toBeNull();
    expect(fixture.nativeElement.querySelector('.op__desc').textContent).toContain('Normal');
    expect(inputs()[2].disabled).toBe(true);
  });

  it('no debería pintar iconos en la variante segmento ni descripciones en chip', () => {
    crear({ variante: 'segmento' });
    expect(fixture.nativeElement.querySelector('.op__icono')).toBeNull();

    crear({ variante: 'chip' });
    expect(fixture.nativeElement.querySelector('.op__icono')).not.toBeNull();
    expect(fixture.nativeElement.querySelector('.op__desc')).toBeNull();
  });

  it('debería desactivar todas las opciones y ocultar la leyenda si se pide', () => {
    crear({ leyendaVisible: false });
    componente.setDisabledState(true);
    fixture.detectChanges();

    expect(inputs().every((i) => i.disabled)).toBe(true);
    expect(fixture.nativeElement.querySelector('.op__leyenda--oculta')).not.toBeNull();
  });

  it('debería avisar al tocar', () => {
    crear();
    const alTocar = jest.fn();
    componente.registerOnTouched(alTocar);
    inputs()[0].dispatchEvent(new Event('blur'));
    expect(alTocar).toHaveBeenCalled();
  });

  it('debería dar un nombre de grupo distinto a cada instancia', () => {
    crear();
    const primero = componente.nombre;
    crear();
    expect(componente.nombre).not.toBe(primero);
  });
});
