import { ComponentFixture, TestBed } from '@angular/core/testing';
import { PasoTimeline, RsTimelineViajeComponent } from './rs-timeline-viaje.component';

describe('RsTimelineViajeComponent', () => {
  let fixture: ComponentFixture<RsTimelineViajeComponent>;

  const pintar = (pasos: PasoTimeline[]): HTMLElement => {
    fixture.componentRef.setInput('pasos', pasos);
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [RsTimelineViajeComponent] }).compileComponents();
    fixture = TestBed.createComponent(RsTimelineViajeComponent);
  });

  it('debería pintar un paso por hito con su estado y la línea salvo en el último', () => {
    const el = pintar([
      { clave: 'a', etiqueta: 'Recogido', estado: 'hecho', at: '2026-09-25T08:30:00Z' },
      { clave: 'b', etiqueta: 'En camino', estado: 'actual' },
      { clave: 'c', etiqueta: 'Entregado', estado: 'pendiente' },
    ]);

    const pasos = el.querySelectorAll('.tl__paso');
    expect(pasos.length).toBe(3);
    expect(pasos[0].getAttribute('data-estado')).toBe('hecho');
    expect(pasos[1].getAttribute('aria-current')).toBe('step');
    expect(pasos[0].getAttribute('aria-current')).toBeNull();
    expect(el.querySelectorAll('.tl__linea').length).toBe(2);
    expect(el.querySelector('.tl__hora')).not.toBeNull();
    expect(el.querySelector('.tl__ahora')).not.toBeNull();
  });

  it('debería mostrar la nota y la foto del momento', () => {
    const el = pintar([{ clave: 'a', etiqueta: 'Recogido', estado: 'hecho', nota: 'Todo bien', fotoUrl: 'https://f/x.jpg' }]);

    expect(el.querySelector('.tl__nota')?.textContent).toContain('Todo bien');
    expect(el.querySelector('.tl__foto img')?.getAttribute('src')).toBe('https://f/x.jpg');
  });

  it('no debería marcar como en curso un paso pendiente sin hora', () => {
    const el = pintar([{ clave: 'a', etiqueta: 'Entregado', estado: 'pendiente' }]);
    expect(el.querySelector('.tl__ahora')).toBeNull();
    expect(el.querySelector('.tl__hora')).toBeNull();
  });
});
