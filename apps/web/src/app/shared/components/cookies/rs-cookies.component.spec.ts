import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { RsCookiesComponent } from './rs-cookies.component';
import { ConsentimientoService } from '../../../core/cookies/consentimiento.service';
import { CookiesService } from '../../../core/plataforma/cookies.service';

describe('RsCookiesComponent', () => {
  let fixture: ComponentFixture<RsCookiesComponent>;
  let cookies: jest.Mocked<Pick<CookiesService, 'leer' | 'escribir' | 'borrar'>>;
  let consentimiento: ConsentimientoService;

  const html = () => fixture.nativeElement as HTMLElement;
  const boton = (texto: string): HTMLButtonElement | undefined =>
    Array.from(html().querySelectorAll('button'))
      .find((b) => (b.textContent ?? '').trim().includes(texto));

  beforeEach(async () => {
    cookies = { leer: jest.fn().mockReturnValue(null), escribir: jest.fn(), borrar: jest.fn() };

    await TestBed.configureTestingModule({
      imports: [RsCookiesComponent],
      providers: [
        provideRouter([]),
        ConsentimientoService,
        { provide: CookiesService, useValue: cookies },
      ],
    }).compileComponents();

    consentimiento = TestBed.inject(ConsentimientoService);
    fixture = TestBed.createComponent(RsCookiesComponent);
    fixture.detectChanges();
  });

  it('debería enseñarse mientras el visitante no ha decidido', () => {
    expect(html().querySelector('.ck')).not.toBeNull();
  });

  /**
   * La AEPD considera que un "rechazar" escondido detrás de un menú invalida
   * también el consentimiento de quienes aceptan: las dos salidas tienen que
   * estar a la vista y costar un solo clic.
   */
  it('debería ofrecer aceptar y rechazar al mismo nivel, sin abrir nada', () => {
    expect(boton('Aceptar todas')).toBeDefined();
    expect(boton('Rechazar todas')).toBeDefined();
  });

  it('debería guardar el rechazo de un solo clic', () => {
    boton('Rechazar todas')?.click();
    fixture.detectChanges();

    expect(consentimiento.pendiente()).toBe(false);
    expect(consentimiento.permite('analitica')).toBe(false);
  });

  it('debería guardar la aceptación de un solo clic', () => {
    boton('Aceptar todas')?.click();
    fixture.detectChanges();

    expect(consentimiento.permite('analitica')).toBe(true);
    expect(consentimiento.permite('marketing')).toBe(true);
  });

  it('debería desaparecer una vez tomada la decisión', () => {
    boton('Aceptar todas')?.click();
    fixture.detectChanges();

    expect(html().querySelector('.ck')).toBeNull();
  });

  describe('panel de configuración', () => {
    beforeEach(() => {
      boton('Configurar')?.click();
      fixture.detectChanges();
    });

    it('debería desplegar una fila por categoría', () => {
      expect(html().querySelectorAll('.ck__switch').length).toBe(3);
    });

    /**
     * Unas casillas marcadas de partida convierten el consentimiento en tácito,
     * que es justo lo que la normativa no admite.
     */
    it('debería arrancar con todas las categorías desactivadas', () => {
      const casillas = Array.from(html().querySelectorAll<HTMLInputElement>('.ck__switch input'));

      expect(casillas.every((casilla) => !casilla.checked)).toBe(true);
    });

    it('debería guardar sólo lo que el visitante ha marcado', () => {
      const primera = html().querySelector<HTMLInputElement>('.ck__switch input');
      primera?.click();
      fixture.detectChanges();

      boton('Guardar mi elección')?.click();
      fixture.detectChanges();

      expect(consentimiento.permite('preferencias')).toBe(true);
      expect(consentimiento.permite('analitica')).toBe(false);
    });

    it('debería dejar claro que las necesarias no se pueden desactivar', () => {
      expect(html().textContent).toContain('Siempre activas');
    });
  });
});
