import { ComponentFixture, TestBed } from '@angular/core/testing';
import { RsButtonComponent } from './rs-button.component';

describe('RsButtonComponent', () => {
  let fixture: ComponentFixture<RsButtonComponent>;
  let component: RsButtonComponent;

  const boton = (): HTMLButtonElement => fixture.nativeElement.querySelector('button');

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [RsButtonComponent] }).compileComponents();
    fixture = TestBed.createComponent(RsButtonComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('debería usar la variante primaria y el tamaño medio por defecto', () => {
    expect(component.buttonClasses).toBe('rs-btn rs-btn--primary');
  });

  it('debería aplicar la clase de la variante elegida', () => {
    fixture.componentRef.setInput('variant', 'danger');
    fixture.detectChanges();

    expect(component.buttonClasses).toContain('rs-btn--danger');
  });

  it('no debería añadir clase de tamaño cuando es el medio', () => {
    // `md` es el tamaño base del design system: no tiene modificador propio.
    fixture.componentRef.setInput('size', 'md');
    fixture.detectChanges();

    expect(component.buttonClasses).not.toContain('rs-btn--md');
  });

  it('debería añadir la clase de tamaño cuando no es el medio', () => {
    fixture.componentRef.setInput('size', 'xl');
    fixture.detectChanges();

    expect(component.buttonClasses).toContain('rs-btn--xl');
  });

  it('debería añadir la clase de bloque cuando se pide', () => {
    fixture.componentRef.setInput('block', true);
    fixture.detectChanges();

    expect(component.buttonClasses).toContain('rs-btn--block');
  });

  it('debería deshabilitarse mientras carga, no sólo con disabled', () => {
    // Si no, un doble clic durante la carga dispara dos veces la acción.
    fixture.componentRef.setInput('loading', true);
    fixture.detectChanges();

    expect(boton().disabled).toBe(true);
  });

  it('debería mostrar el spinner sólo mientras carga', () => {
    expect(fixture.nativeElement.querySelector('.rs-spinner')).toBeNull();

    fixture.componentRef.setInput('loading', true);
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('.rs-spinner')).not.toBeNull();
  });

  it('debería emitir el clic', () => {
    const espia = jest.fn();
    component.clicked.subscribe(espia);

    boton().click();

    expect(espia).toHaveBeenCalled();
  });

  it('no debería emitir el clic si está deshabilitado', () => {
    const espia = jest.fn();
    component.clicked.subscribe(espia);
    fixture.componentRef.setInput('disabled', true);
    fixture.detectChanges();

    boton().click();

    expect(espia).not.toHaveBeenCalled();
  });

  it('debería respetar el type para poder enviar formularios', () => {
    fixture.componentRef.setInput('type', 'submit');
    fixture.detectChanges();

    expect(boton().type).toBe('submit');
  });
});
