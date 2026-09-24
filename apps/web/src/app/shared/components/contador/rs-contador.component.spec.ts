import { ComponentFixture, TestBed } from '@angular/core/testing';
import { RsContadorComponent } from './rs-contador.component';

describe('RsContadorComponent', () => {
  let fixture: ComponentFixture<RsContadorComponent>;
  let componente: RsContadorComponent;
  let alCambiar: jest.Mock;
  let alTocar: jest.Mock;

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [RsContadorComponent] }).compileComponents();
    fixture = TestBed.createComponent(RsContadorComponent);
    componente = fixture.componentInstance;
    fixture.componentRef.setInput('etiqueta', 'Perros');
    fixture.componentRef.setInput('max', 3);
    alCambiar = jest.fn();
    alTocar = jest.fn();
    componente.registerOnChange(alCambiar);
    componente.registerOnTouched(alTocar);
    fixture.detectChanges();
  });

  const botones = (): HTMLButtonElement[] => Array.from(fixture.nativeElement.querySelectorAll('button'));

  it('debería sumar y avisar al formulario', () => {
    botones()[1].click();

    expect(componente.valor()).toBe(2);
    expect(alCambiar).toHaveBeenCalledWith(2);
    expect(alTocar).toHaveBeenCalled();
  });

  it('no debería pasar del máximo ni bajar del mínimo', () => {
    componente.writeValue(3);
    componente.cambiar(1);
    expect(componente.valor()).toBe(3);

    componente.writeValue(1);
    componente.cambiar(-1);
    expect(componente.valor()).toBe(1);
    expect(alCambiar).not.toHaveBeenCalled();
  });

  it('debería desactivar el botón de quitar en el mínimo', () => {
    expect(botones()[0].disabled).toBe(true);
    expect(botones()[1].disabled).toBe(false);
  });

  it('debería volver al mínimo si el valor escrito no es un número', () => {
    componente.writeValue(null);
    expect(componente.valor()).toBe(1);
  });

  it('debería desactivar ambos botones si el control se desactiva', () => {
    componente.writeValue(2);
    componente.setDisabledState(true);
    fixture.detectChanges();
    expect(botones().every((b) => b.disabled)).toBe(true);
  });
});
