import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { signal } from '@angular/core';
import { RsNavInferiorComponent } from './rs-nav-inferior.component';
import { MovilService } from '../../../core/movil/movil.service';
import { AuthService } from '../../../core/auth/auth.service';

/**
 * El componente decide por la URL, así que el router tiene que poder navegar a
 * ella. Los destinos no importan —nada de lo que se comprueba mira el
 * contenido—, sólo que la ruta exista y `NavigationEnd` se emita.
 */
const RUTAS_DE_PRUEBA = [
  { path: '**', children: [] },
];

describe('RsNavInferiorComponent', () => {
  let fixture: ComponentFixture<RsNavInferiorComponent>;
  let router: Router;

  /** El estado de sesión y de plataforma se inyecta; el componente sólo decide. */
  const montar = async (opciones: {
    esNativo: boolean;
    autenticado?: boolean;
    admin?: boolean;
    comercio?: boolean;
  }) => {
    await TestBed.configureTestingModule({
      imports: [RsNavInferiorComponent],
      providers: [
        provideRouter(RUTAS_DE_PRUEBA),
        { provide: MovilService, useValue: { esNativo: opciones.esNativo } },
        {
          provide: AuthService,
          useValue: {
            estaAutenticado: signal(opciones.autenticado ?? false),
            esAdmin: signal(opciones.admin ?? false),
            esComercio: signal(opciones.comercio ?? false),
          },
        },
      ],
    }).compileComponents();

    router = TestBed.inject(Router);
    fixture = TestBed.createComponent(RsNavInferiorComponent);
    fixture.detectChanges();
  };

  const hayBarra = () => fixture.nativeElement.querySelector('.nav-inf') !== null;

  const irA = async (url: string) => {
    // La barra escucha `NavigationEnd`; se fuerza la navegación real para que
    // el test recorra el mismo camino que la aplicación.
    await router.navigateByUrl(url);
    fixture.detectChanges();
  };

  it('no debería pintarse en la web, donde ya existe la navbar superior', async () => {
    await montar({ esNativo: false });
    expect(hayBarra()).toBe(false);
  });

  it('debería pintarse en la app instalada', async () => {
    await montar({ esNativo: true });
    expect(hayBarra()).toBe(true);
  });

  it('debería ocultarse en la ficha de un servicio, que ya tiene su propia barra de "Reservar"', async () => {
    await montar({ esNativo: true });
    await irA('/veterinaria/abc123');
    expect(hayBarra()).toBe(false);
  });

  it('debería ocultarse durante el pago', async () => {
    await montar({ esNativo: true });
    await irA('/reservas/pagar');
    expect(hayBarra()).toBe(false);
  });

  it('debería seguir visible en el listado de mis reservas, que es destino de pestaña', async () => {
    await montar({ esNativo: true, autenticado: true });
    await irA('/reservas/mis-reservas');
    expect(hayBarra()).toBe(true);
  });

  it('debería llevar a "Entrar" y no a rutas con guard cuando no hay sesión', async () => {
    await montar({ esNativo: true, autenticado: false });
    const destinos = [...fixture.nativeElement.querySelectorAll('.nav-inf__item')]
      .map((enlace: Element) => enlace.getAttribute('href'));

    expect(destinos).toContain('/auth/login');
    expect(destinos).not.toContain('/reservas');
    expect(destinos).not.toContain('/perfil');
  });

  it('debería ofrecer el panel del comercio a un comercio, en lugar de "mis reservas"', async () => {
    await montar({ esNativo: true, autenticado: true, comercio: true });
    const destinos = [...fixture.nativeElement.querySelectorAll('.nav-inf__item')]
      .map((enlace: Element) => enlace.getAttribute('href'));

    expect(destinos).toContain('/comercio');
    expect(destinos).not.toContain('/reservas');
  });
});
