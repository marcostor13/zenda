import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { EliminarDatosComponent } from './eliminar-datos.component';
import { RESPONSABLE } from './legal.datos';

describe('EliminarDatosComponent', () => {
  let fixture: ComponentFixture<EliminarDatosComponent>;
  let texto: string;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [EliminarDatosComponent],
      providers: [provideRouter([])],
    }).compileComponents();

    fixture = TestBed.createComponent(EliminarDatosComponent);
    fixture.detectChanges();
    texto = fixture.nativeElement.textContent as string;
  });

  /*
   * Es la URL que Meta exige para publicar la app: sin un procedimiento
   * concreto y un contacto, la rechaza.
   */
  it('debería dar un correo con el asunto ya puesto', () => {
    const enlace: HTMLAnchorElement | null =
      fixture.nativeElement.querySelector('a[href^="mailto:"]');

    expect(enlace?.getAttribute('href')).toContain(RESPONSABLE.emailPrivacidad);
    expect(enlace?.getAttribute('href')).toContain('subject=');
  });

  it('debería comprometer un plazo máximo', () => {
    expect(texto).toContain('30 días');
  });

  it('debería enumerar qué se borra', () => {
    expect(texto).toContain('mascotas');
    expect(texto).toContain('reseñas');
    expect(texto).toContain('dispositivos');
  });

  /*
   * Prometer que se borra todo sería mentira: las reservas y sus pagos hay que
   * conservarlos por obligación fiscal, disociados de la identidad.
   */
  it('debería explicar qué se conserva y por qué', () => {
    expect(texto).toContain('seis años');
    expect(texto).toContain('disociar');
  });

  it('debería explicar cómo revocar el acceso desde Facebook', () => {
    expect(texto).toContain('Apps y sitios web');
  });

  /* Los comercios sí tienen botón; decir que no lo hay mandaría a soporte de más. */
  it('debería remitir a los comercios a su panel', () => {
    expect(texto).toContain('Cerrar cuenta');
  });

  it('debería enlazar la política de privacidad', () => {
    const enlaces: HTMLAnchorElement[] = Array.from(fixture.nativeElement.querySelectorAll('a'));

    expect(enlaces.some((a) => a.getAttribute('href') === '/privacidad')).toBe(true);
  });
});
