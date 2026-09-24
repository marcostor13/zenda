import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { MarcoViajeComponent } from './marco-viaje.component';

describe('MarcoViajeComponent', () => {
  let fixture: ComponentFixture<MarcoViajeComponent>;
  let el: HTMLElement;

  const crear = (entradas: Record<string, unknown>): void => {
    fixture = TestBed.createComponent(MarcoViajeComponent);
    fixture.componentRef.setInput('titulo', '¿A dónde vamos?');
    Object.entries(entradas).forEach(([k, v]) => fixture.componentRef.setInput(k, v));
    fixture.detectChanges();
    el = fixture.nativeElement as HTMLElement;
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [MarcoViajeComponent],
      providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()],
    }).compileComponents();
  });

  it('debería marcar los pasos hechos, el actual y los pendientes', () => {
    crear({ paso: 3 });

    const pasos = Array.from(el.querySelectorAll('.rs-steps__item'));
    expect(pasos).toHaveLength(5);
    expect(pasos.filter((p) => p.classList.contains('done'))).toHaveLength(2);
    expect(pasos.filter((p) => p.classList.contains('active'))).toHaveLength(3);
    expect(pasos[2].getAttribute('aria-current')).toBe('step');
    expect(el.querySelectorAll('.rs-steps__line')).toHaveLength(4);
  });

  it('no debería pintar pasos ni volver si no se piden', () => {
    crear({});

    expect(el.querySelector('.rs-steps')).toBeNull();
    expect(el.querySelector('.mv__volver')).toBeNull();
    expect(el.querySelector('.mv__ante')).toBeNull();
    expect(el.querySelector('.mv__sub')).toBeNull();
    expect(el.querySelector('.mv__titulo')?.textContent).toContain('¿A dónde vamos?');
  });

  it('debería pintar el enlace de volver, el antetítulo, el subtítulo y el modo ancho', () => {
    crear({ volverA: '/transporte', antetitulo: 'Transporte', subtitulo: 'Paso a paso', ancho: true });

    expect(el.querySelector('.mv__volver')?.getAttribute('href')).toBe('/transporte');
    expect(el.querySelector('.mv__ante')?.textContent).toContain('Transporte');
    expect(el.querySelector('.mv__sub')?.textContent).toContain('Paso a paso');
    expect(el.querySelector('.mv--ancho')).not.toBeNull();
  });
});
