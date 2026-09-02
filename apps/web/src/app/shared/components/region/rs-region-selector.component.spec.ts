import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { IDIOMAS_SOPORTADOS } from 'shared';
import { RsRegionSelectorComponent } from './rs-region-selector.component';
import { I18nService } from '../../../core/i18n/i18n.service';

describe('RsRegionSelectorComponent', () => {
  let fixture: ComponentFixture<RsRegionSelectorComponent>;
  let i18n: I18nService;

  const el = (): HTMLElement => fixture.nativeElement;
  const disparadores = (): HTMLButtonElement[] =>
    [...el().querySelectorAll<HTMLButtonElement>('.rg__wrap > .rg__trigger')];

  beforeEach(async () => {
    localStorage.clear();
    localStorage.setItem('doogking_idioma', 'es');

    await TestBed.configureTestingModule({
      imports: [RsRegionSelectorComponent],
      providers: [provideHttpClient(), provideHttpClientTesting()],
    }).compileComponents();

    i18n = TestBed.inject(I18nService);
    fixture = TestBed.createComponent(RsRegionSelectorComponent);
    fixture.detectChanges();
  });

  it('debería ofrecer solo dos controles: idioma y moneda', () => {
    // El de país se retiró: enseñaba una segunda bandera en la cabecera y no
    // filtraba nada, porque ningún componente leía la región elegida.
    expect(disparadores().length).toBe(2);
  });

  it('debería enseñar el idioma activo en versales, como el código de país', () => {
    expect(disparadores()[0].textContent?.trim()).toBe('ES');
  });

  describe('desplegable de idioma', () => {
    beforeEach(() => {
      disparadores()[0].click();
      fixture.detectChanges();
    });

    it('debería listar todos los idiomas soportados con su nombre nativo', () => {
      const opciones = [...el().querySelectorAll('.rg__pop .rg__opt')].map((o) => o.textContent?.trim());
      expect(opciones).toEqual(IDIOMAS_SOPORTADOS.map((i) => i.nombre));
    });

    it('debería marcar el idioma activo para lectores de pantalla', () => {
      const activa = el().querySelector('.rg__opt.is-on');
      expect(activa?.getAttribute('aria-checked')).toBe('true');
      expect(activa?.textContent?.trim()).toBe('Español');
    });

    it('debería cambiar el idioma y cerrar el panel al elegir uno', async () => {
      const ingles = [...el().querySelectorAll<HTMLButtonElement>('.rg__opt')]
        .find((o) => o.textContent?.trim() === 'English')!;

      ingles.click();
      // El diccionario llega por `import()`: hay que dejar que se vacíe la cola
      // de microtareas —y el turno del propio import— antes de mirar el
      // resultado. `whenStable` solo no llega hasta el final de esa cadena.
      await new Promise((resolver) => setTimeout(resolver, 0));
      await fixture.whenStable();
      fixture.detectChanges();

      expect(i18n.idioma()).toBe('en');
      expect(el().querySelector('.rg__pop')).toBeNull();
      expect(disparadores()[0].textContent?.trim()).toBe('EN');
    });

    it('debería cerrarse al pulsar fuera', () => {
      document.body.click();
      fixture.detectChanges();
      expect(el().querySelector('.rg__pop')).toBeNull();
    });
  });

  it('debería seguir permitiendo elegir moneda', () => {
    disparadores()[1].click();
    fixture.detectChanges();
    expect(el().querySelector('.rg__pop--moneda')).toBeTruthy();
  });
});
