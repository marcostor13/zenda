import { Component } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { LegalDocumentoComponent } from './legal-documento.component';
import * as datos from './legal.datos';

@Component({
  standalone: true,
  imports: [LegalDocumentoComponent],
  template: `
    <app-legal-documento titulo="Un documento" entradilla="De qué va">
      <p>Cuerpo del documento.</p>
    </app-legal-documento>
  `,
})
class AnfitrionComponent {}

describe('LegalDocumentoComponent', () => {
  let fixture: ComponentFixture<AnfitrionComponent>;

  const montar = async (): Promise<void> => {
    await TestBed.configureTestingModule({
      imports: [AnfitrionComponent],
      providers: [provideRouter([])],
    }).compileComponents();
    fixture = TestBed.createComponent(AnfitrionComponent);
    fixture.detectChanges();
  };

  afterEach(() => {
    TestBed.resetTestingModule();
    jest.restoreAllMocks();
  });

  it('debería pintar el título, la entradilla y el contenido proyectado', async () => {
    await montar();
    const texto = fixture.nativeElement.textContent as string;

    expect(texto).toContain('Un documento');
    expect(texto).toContain('De qué va');
    expect(texto).toContain('Cuerpo del documento.');
  });

  /* Lo ve el público: nada de avisos de borrador ni nombres de ficheros internos. */
  it('no debería mostrar avisos de borrador ni referencias a ficheros técnicos', async () => {
    await montar();
    const texto = fixture.nativeElement.textContent as string;

    expect(texto).not.toContain('Borrador');
    expect(texto).not.toMatch(/\.ts\b/);
  });

  /* Art. 10 LSSI-CE: los datos del titular, accesibles desde cualquier documento. */
  it('debería identificar al titular y la fecha de revisión al pie', async () => {
    await montar();
    const pie = (fixture.nativeElement.querySelector('.lg__pie') as HTMLElement).textContent ?? '';

    expect(pie).toContain(datos.RESPONSABLE.razonSocial);
    expect(pie).toContain(datos.RESPONSABLE.domicilio);
    expect(pie).toContain(datos.ULTIMA_ACTUALIZACION);
  });

  /* Se leen sin sesión y con la app cerrada al público: no deben depender de la navbar. */
  it('no debería montar la navbar de la aplicación', async () => {
    await montar();

    expect(fixture.nativeElement.querySelector('rs-navbar')).toBeNull();
  });

  it('debería enlazar los dos documentos entre sí y el correo de soporte', async () => {
    await montar();
    const enlaces: HTMLAnchorElement[] = Array.from(fixture.nativeElement.querySelectorAll('a'));
    const destinos = enlaces.map((a) => a.getAttribute('href'));

    expect(destinos).toContain('/privacidad');
    expect(destinos).toContain('/eliminar-datos');
    expect(destinos.some((d) => d?.startsWith('mailto:'))).toBe(true);
  });
});
