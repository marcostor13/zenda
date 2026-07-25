import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { RouterTestingModule } from '@angular/router/testing';
import { AyudaComponent } from './ayuda.component';

describe('AyudaComponent', () => {
  let fixture: ComponentFixture<AyudaComponent>;
  let componente: AyudaComponent;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AyudaComponent, RouterTestingModule],
      providers: [provideHttpClient(), provideHttpClientTesting()],
    }).compileComponents();

    fixture = TestBed.createComponent(AyudaComponent);
    componente = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('debería abrir en las dudas del dueño de la mascota', () => {
    expect(componente.publico()).toBe('cliente');
    expect(componente.preguntas().length).toBeGreaterThan(0);
  });

  it('debería cambiar el listado al elegir el público de comercio', () => {
    const deCliente = componente.preguntas();

    componente.publico.set('comercio');

    expect(componente.preguntas()).not.toEqual(deCliente);
  });

  it('debería explicar que ningún suplemento se cobra sin aprobación', () => {
    const respuestas = componente.preguntas().map((f) => f.r).join(' ');

    expect(respuestas).toContain('sin tu aprobación');
  });

  it('debería dejar clara la moneda real de cobro', () => {
    const respuestas = componente.preguntas().map((f) => f.r).join(' ');

    expect(respuestas).toContain('Siempre en euros');
  });

  it('debería ofrecer una vía de contacto directa', () => {
    const el: HTMLElement = fixture.nativeElement;

    expect(el.querySelector('a[href^="mailto:"]')).toBeTruthy();
  });
});
