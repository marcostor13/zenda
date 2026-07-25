import { ComponentFixture, TestBed } from '@angular/core/testing';
import { RouterTestingModule } from '@angular/router/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { VERTICALES_UI } from '../../verticales/verticales.config';
import { RsNavbarComponent } from './rs-navbar.component';

describe('RsNavbarComponent', () => {
  let fixture: ComponentFixture<RsNavbarComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [RsNavbarComponent, RouterTestingModule],
      providers: [provideHttpClient(), provideHttpClientTesting()],
    }).compileComponents();

    fixture = TestBed.createComponent(RsNavbarComponent);
    fixture.detectChanges();
  });

  it('debería mostrar una entrada de menú por categoría', () => {
    const el: HTMLElement = fixture.nativeElement;
    const enlaces = Array.from(el.querySelectorAll('.rs-navbar__nav .rs-navbar__link'));

    expect(enlaces.length).toBe(VERTICALES_UI.length);
    expect(enlaces.map((a) => a.textContent?.trim())).toEqual(
      VERTICALES_UI.map((v) => v.labelCorto),
    );
  });

  it('debería enlazar cada entrada a la ruta de su categoría', () => {
    const el: HTMLElement = fixture.nativeElement;
    const hrefs = Array.from(el.querySelectorAll('.rs-navbar__nav a')).map((a) =>
      a.getAttribute('href'),
    );

    expect(hrefs).toEqual(VERTICALES_UI.map((v) => v.route));
  });

  it('debería incluir hoteles pet-friendly en el menú', () => {
    const el: HTMLElement = fixture.nativeElement;
    const hrefs = Array.from(el.querySelectorAll('.rs-navbar__nav a')).map((a) =>
      a.getAttribute('href'),
    );

    expect(hrefs).toContain('/hoteles');
  });

  it('debería repetir las mismas categorías en el menú móvil', () => {
    fixture.componentInstance.menuAbierto.set(true);
    fixture.detectChanges();
    const el: HTMLElement = fixture.nativeElement;

    const enlaces = el.querySelectorAll('.rs-mobile-menu__nav .rs-mobile-menu__link');
    expect(enlaces.length).toBe(VERTICALES_UI.length);
  });
});
