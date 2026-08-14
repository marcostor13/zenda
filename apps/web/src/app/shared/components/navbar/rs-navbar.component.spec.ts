import { ComponentFixture, TestBed } from '@angular/core/testing';
import { RouterTestingModule } from '@angular/router/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { signal } from '@angular/core';
import { VERTICALES_UI } from '../../verticales/verticales.config';
import { RsNavbarComponent } from './rs-navbar.component';
import { AuthService } from '../../../core/auth/auth.service';
import { PerrosService } from '../../../features/perros/perros.service';
import { ReservasService } from '../../../features/reservas/services/reservas.service';
import { ReviewsService } from '../../../features/reservas/services/reviews.service';
import { AlphaService, AlphaEstadoApi } from '../../../features/alpha/alpha.service';

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

  it('debería mostrar la marca compacta "D" junto al logotipo', () => {
    const el: HTMLElement = fixture.nativeElement;
    const marca = el.querySelector('.rs-navbar__brand .rs-navbar__mark');

    expect(marca?.getAttribute('src')).toBe('/images/logo-doogking-d.svg');
    expect(el.querySelector('.rs-navbar__brand .rs-navbar__wordmark')).toBeTruthy();
  });

  it('debería ofrecer el alta de empresa al visitante y al cliente', () => {
    const el: HTMLElement = fixture.nativeElement;
    const alta = el.querySelector('.rs-navbar__link--pro');

    // Sin sesión (visitante) el enlace está presente…
    expect(alta?.getAttribute('href')).toBe('/auth/registro-comercio');
    expect(alta?.textContent?.trim()).toBe('Registra tu empresa');
    // …y la regla que lo gobierna solo lo oculta a comercios y admin.
    expect(fixture.componentInstance.muestraAltaComercio()).toBe(true);
  });

  it('debería repetir las mismas categorías en el menú móvil', () => {
    fixture.componentInstance.menuAbierto.set(true);
    fixture.detectChanges();
    const el: HTMLElement = fixture.nativeElement;

    const enlaces = el.querySelectorAll('.rs-mobile-menu__nav .rs-mobile-menu__link');
    expect(enlaces.length).toBe(VERTICALES_UI.length);
  });
});

describe('RsNavbarComponent (usuario autenticado, HU-12.3)', () => {
  let fixture: ComponentFixture<RsNavbarComponent>;

  const crear = async (opciones: {
    mascotas?: unknown[];
    proximaReserva?: unknown | null;
    misResenas?: unknown[];
    pendientes?: unknown[];
    alpha?: Partial<AlphaEstadoApi> | null;
    usuarioId?: string;
  } = {}): Promise<void> => {
    await TestBed.configureTestingModule({
      imports: [RsNavbarComponent, RouterTestingModule],
      providers: [
        provideHttpClient(), provideHttpClientTesting(),
        {
          provide: AuthService,
          useValue: {
            usuario: signal({ id: opciones.usuarioId ?? 'u1', nombre: 'Ana Ruiz', verificado: true }),
            estaAutenticado: signal(true),
            esAdmin: signal(false),
            esComercio: signal(false),
            esCliente: signal(true),
            clienteVerificado: signal(true),
          },
        },
        { provide: PerrosService, useValue: { misPerros: jest.fn().mockResolvedValue(opciones.mascotas ?? []) } },
        { provide: ReservasService, useValue: { proximaReserva: jest.fn().mockResolvedValue(opciones.proximaReserva ?? null) } },
        {
          provide: ReviewsService,
          useValue: {
            misResenas: jest.fn().mockResolvedValue(opciones.misResenas ?? []),
            pendientesDeValorar: jest.fn().mockResolvedValue(opciones.pendientes ?? []),
          },
        },
        { provide: AlphaService, useValue: { miEstado: jest.fn().mockResolvedValue(opciones.alpha ?? null) } },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(RsNavbarComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  };

  it('debería contar las mascotas del usuario en el desplegable', async () => {
    await crear({ mascotas: [{ _id: 'p1' }, { _id: 'p2' }] });

    expect(fixture.componentInstance.numMascotas()).toBe(2);
  });

  it('debería marcar el punto de notificación cuando hay una reserva próxima', async () => {
    await crear({ proximaReserva: { codigo: 'RES-1', titulo: 'Royal Dog Resort' } });

    expect(fixture.componentInstance.tieneReservaProxima()).toBe(true);
    fixture.componentInstance.cuentaAbierto.set(true);
    fixture.detectChanges();
    const el: HTMLElement = fixture.nativeElement;
    expect(el.querySelector('.rs-navbar__dot')).toBeTruthy();
    expect(el.textContent).toContain('Próxima reserva');
  });

  it('no debería marcar nada sin reservas ni mascotas', async () => {
    await crear();

    expect(fixture.componentInstance.numMascotas()).toBe(0);
    expect(fixture.componentInstance.tieneReservaProxima()).toBe(false);
  });

  it('debería mostrar el nombre y el sello de verificado en la cabecera del desplegable (HU-12.1)', async () => {
    await crear();
    fixture.componentInstance.cuentaAbierto.set(true);
    fixture.detectChanges();

    const el: HTMLElement = fixture.nativeElement;
    expect(el.querySelector('.rs-navbar__dropdown-name')?.textContent?.trim()).toBe('Ana Ruiz');
    expect(el.textContent).toContain('Cliente verificado');
  });

  it('debería mostrar el nivel Alpha en la cabecera cuando está disponible (HU-12.1/12.2)', async () => {
    await crear({ alpha: { nombreNivel: 'Alpha 2', nivelActual: 2, reservasCompletadas: 6 } });
    fixture.componentInstance.cuentaAbierto.set(true);
    fixture.detectChanges();

    const el: HTMLElement = fixture.nativeElement;
    // El nombre antiguo guardado en BD se presenta en romanos (TCK-8011).
    expect(el.querySelector('.rs-navbar__dropdown-alpha')?.textContent).toContain('ALPHA II');
    expect(el.querySelector('a[href="/perfil/alpha"]')).toBeTruthy();
  });

  it('debería contar las reseñas del usuario (HU-12.3)', async () => {
    await crear({ misResenas: [{ _id: 'r1' }, { _id: 'r2' }, { _id: 'r3' }] });

    expect(fixture.componentInstance.numResenas()).toBe(3);
  });

  it('debería marcar el punto de notificación cuando hay una reseña pendiente, aunque no haya reserva próxima', async () => {
    await crear({ pendientes: [{ reservaId: 'r1' }] });

    expect(fixture.componentInstance.tieneReservaProxima()).toBe(false);
    expect(fixture.componentInstance.tienePendientesResena()).toBe(true);
    expect(fixture.componentInstance.tieneAvisoPendiente()).toBe(true);
  });
});
