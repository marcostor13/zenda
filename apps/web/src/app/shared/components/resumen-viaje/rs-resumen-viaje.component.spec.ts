import { ComponentFixture, TestBed } from '@angular/core/testing';
import { RsResumenViajeComponent } from './rs-resumen-viaje.component';

describe('RsResumenViajeComponent', () => {
  let fixture: ComponentFixture<RsResumenViajeComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [RsResumenViajeComponent] }).compileComponents();
    fixture = TestBed.createComponent(RsResumenViajeComponent);
    fixture.componentRef.setInput('origen', 'Madrid');
    fixture.componentRef.setInput('destino', 'Toledo');
  });

  it('debería pintar la ruta y los detalles separados por puntos', () => {
    fixture.componentRef.setInput('detalles', ['1 perro', 'Ida y vuelta']);
    fixture.detectChanges();

    const texto = fixture.nativeElement.textContent as string;
    expect(texto).toContain('Madrid');
    expect(texto).toContain('Toledo');
    expect(fixture.nativeElement.querySelector('.rv__detalles').textContent).toContain('1 perro · Ida y vuelta');
  });

  it('debería emitir modificar al pulsar el botón', () => {
    fixture.detectChanges();
    const emitido = jest.fn();
    fixture.componentInstance.modificar.subscribe(emitido);

    fixture.nativeElement.querySelector('.rv__modificar').click();

    expect(emitido).toHaveBeenCalled();
  });

  it('no debería ofrecer modificar ni detalles si no procede', () => {
    fixture.componentRef.setInput('modificable', false);
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('.rv__modificar')).toBeNull();
    expect(fixture.nativeElement.querySelector('.rv__detalles')).toBeNull();
  });
});
