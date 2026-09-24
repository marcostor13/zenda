import { ComponentFixture, TestBed } from '@angular/core/testing';
import { LineaPrecio, RsDesglosePrecioComponent } from './rs-desglose-precio.component';

describe('RsDesglosePrecioComponent', () => {
  let fixture: ComponentFixture<RsDesglosePrecioComponent>;

  const crear = (lineas: LineaPrecio[], viajes = 1): RsDesglosePrecioComponent => {
    fixture = TestBed.createComponent(RsDesglosePrecioComponent);
    fixture.componentRef.setInput('lineas', lineas);
    fixture.componentRef.setInput('viajes', viajes);
    fixture.detectChanges();
    return fixture.componentInstance;
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [RsDesglosePrecioComponent] }).compileComponents();
  });

  it('debería sumar las líneas y sacar el IVA de dentro del total', () => {
    const c = crear([{ concepto: 'Trayecto', importe: 100 }, { concepto: 'Suplemento', importe: 21 }]);

    expect(c.precioPorViaje()).toBe(121);
    expect(c.total()).toBe(121);
    expect(c.iva()).toBe(21);
  });

  it('debería redondear el IVA a céntimos (total - total / 1,21)', () => {
    const c = crear([{ concepto: 'Trayecto', importe: 50 }]);
    expect(c.iva()).toBe(8.68);
  });

  it('debería multiplicar por el número de viajes de la serie y mostrarlo', () => {
    const c = crear([{ concepto: 'Trayecto', importe: 30 }], 4);

    expect(c.total()).toBe(120);
    const serie = fixture.nativeElement.querySelector('.dp__serie') as HTMLElement;
    expect(serie.textContent).toContain('4');
  });

  it('no debería mostrar la serie con un solo viaje', () => {
    crear([{ concepto: 'Trayecto', importe: 30 }]);
    expect(fixture.nativeElement.querySelector('.dp__serie')).toBeNull();
    expect(fixture.nativeElement.querySelectorAll('.dp__linea').length).toBe(1);
  });
});
