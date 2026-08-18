import { ComponentFixture, TestBed } from '@angular/core/testing';
import { RsInputComponent } from './rs-input.component';

describe('RsInputComponent', () => {
  let fixture: ComponentFixture<RsInputComponent>;
  let component: RsInputComponent;

  const input = (): HTMLInputElement => fixture.nativeElement.querySelector('input');
  const escribir = (texto: string): void => {
    input().value = texto;
    input().dispatchEvent(new Event('input'));
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [RsInputComponent] }).compileComponents();
    fixture = TestBed.createComponent(RsInputComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('debería usar la clase base del design system', () => {
    expect(component.inputClasses).toBe('rs-input');
  });

  it('debería añadir la clase de error cuando hay mensaje', () => {
    fixture.componentRef.setInput('error', 'Campo obligatorio');
    fixture.detectChanges();

    expect(component.inputClasses).toContain('rs-input--error');
    expect(fixture.nativeElement.querySelector('.rs-field-error').textContent).toContain('Campo obligatorio');
  });

  it('no debería pintar la etiqueta si no se indica', () => {
    expect(fixture.nativeElement.querySelector('label')).toBeNull();
  });

  it('debería asociar la etiqueta al input por id', () => {
    // Sin el `for`, pulsar la etiqueta no enfoca el campo y el lector de
    // pantalla no sabe qué se está pidiendo.
    fixture.componentRef.setInput('label', 'Correo');
    fixture.componentRef.setInput('inputId', 'campo-email');
    fixture.detectChanges();

    const label = fixture.nativeElement.querySelector('label') as HTMLLabelElement;
    expect(label.getAttribute('for')).toBe('campo-email');
    expect(input().id).toBe('campo-email');
  });

  it('debería mostrar la ayuda cuando se indica', () => {
    fixture.componentRef.setInput('hint', 'Mínimo 8 caracteres');
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('Mínimo 8 caracteres');
  });

  describe('ControlValueAccessor', () => {
    it('debería pintar el valor que le escribe el formulario', () => {
      component.writeValue('hola');
      fixture.detectChanges();

      expect(input().value).toBe('hola');
    });

    it('debería tratar null como cadena vacía', () => {
      // Un formulario reactivo recién creado emite null; sin esto el input
      // mostraría literalmente "null".
      component.writeValue(null as unknown as string);

      expect(component.value).toBe('');
    });

    it('debería avisar al formulario de cada cambio', () => {
      const onChange = jest.fn();
      component.registerOnChange(onChange);

      escribir('nuevo texto');

      expect(onChange).toHaveBeenCalledWith('nuevo texto');
      expect(component.value).toBe('nuevo texto');
    });

    it('debería marcar el campo como tocado al perder el foco', () => {
      const onTouched = jest.fn();
      component.registerOnTouched(onTouched);

      input().dispatchEvent(new Event('blur'));

      expect(onTouched).toHaveBeenCalled();
    });
  });

  it('debería generar un id distinto por instancia si no se indica', () => {
    const otro = TestBed.createComponent(RsInputComponent);

    expect(component.inputId()).not.toBe(otro.componentInstance.inputId());
  });
});
