import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { RouterTestingModule } from '@angular/router/testing';
import { of, throwError } from 'rxjs';
import { PerfilComercioComponent } from './perfil-comercio.component';
import { AuthService } from '../../core/auth/auth.service';
import { ComercioApiService } from '../panel-comercio/comercio-api.service';

describe('PerfilComercioComponent', () => {
  let fixture: ComponentFixture<PerfilComercioComponent>;
  let component: PerfilComercioComponent;
  let comercioApi: jest.Mocked<ComercioApiService>;
  let authService: jest.Mocked<AuthService>;

  const comercio = {
    nombreComercial: 'peluquería Nala',
    verticales: ['peluqueria', 'alojamiento'],
    direccion: { ciudad: 'Valencia' },
  };

  /** Valor de la tarjeta de estadística por su etiqueta. */
  const stat = (label: string): string | undefined =>
    component.stats().find((s) => s.label === label)?.value;

  async function montar(): Promise<void> {
    fixture = TestBed.createComponent(PerfilComercioComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
    await fixture.whenStable();
  }

  beforeEach(async () => {
    comercioApi = {
      getMiComercio: jest.fn().mockReturnValue(of(comercio)),
      getMisReservas: jest.fn().mockReturnValue(of([])),
      getMisServicios: jest.fn().mockReturnValue(of([])),
      getMisResenas: jest.fn().mockReturnValue(of([])),
    } as never;
    // El navbar embebido consulta el estado de sesión en su propio ngOnInit.
    authService = {
      logout: jest.fn(),
      estaAutenticado: () => true,
      usuario: () => ({ id: 'u1', nombre: 'Test', email: 't@t.com', rol: 'comercio_admin' }),
      esAdmin: () => false,
      esComercio: () => true,
      esCliente: () => false,
      clienteVerificado: () => false,
      token: () => 'jwt',
    } as never;

    await TestBed.configureTestingModule({
      imports: [PerfilComercioComponent, RouterTestingModule],
      providers: [
        // El árbol del componente arrastra servicios que inyectan HttpClient.
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: ComercioApiService, useValue: comercioApi },
        { provide: AuthService, useValue: authService },
      ],
    }).compileComponents();
  });

  describe('cabecera del comercio', () => {
    it('debería usar la inicial del nombre en mayúscula', async () => {
      await montar();

      expect(component.inicial()).toBe('P');
    });

    it('debería caer a "C" si aún no hay comercio cargado', () => {
      fixture = TestBed.createComponent(PerfilComercioComponent);
      component = fixture.componentInstance;

      expect(component.inicial()).toBe('C');
      expect(component.categorias()).toBe('Comercio');
      expect(component.ciudad()).toBe('');
    });

    it('debería unir los verticales con separador', async () => {
      await montar();

      expect(component.categorias()).toBe('peluqueria · alojamiento');
    });

    it('debería decir "Comercio" si el negocio no declaró ningún vertical', async () => {
      comercioApi.getMiComercio.mockReturnValue(of({ ...comercio, verticales: [] }) as never);
      await montar();

      expect(component.categorias()).toBe('Comercio');
    });

  });

  describe('estadísticas', () => {
    it('debería contar reservas totales y completadas', async () => {
      comercioApi.getMisReservas.mockReturnValue(
        of([{ estado: 'completada' }, { estado: 'completada' }, { estado: 'confirmada' }]) as never,
      );
      await montar();

      expect(stat('Reservas totales')).toBe('3');
      expect(stat('Servicios completados')).toBe('2');
    });

    it('debería contar sólo los servicios publicados como activos', async () => {
      comercioApi.getMisServicios.mockReturnValue(
        of([{ estado: 'publicado' }, { estado: 'borrador' }]) as never,
      );
      await montar();

      expect(stat('Servicios activos')).toBe('1');
    });

    it('debería promediar las reseñas con un decimal', async () => {
      comercioApi.getMisResenas.mockReturnValue(
        of([{ puntuacion: 5 }, { puntuacion: 4 }]) as never,
      );
      await montar();

      expect(stat('Valoración media')).toBe('4.5');
    });

    it('debería mostrar un guion, no un 0, cuando no hay reseñas', async () => {
      // Un 0 se leería como "valorado con un cero", que es lo contrario de
      // "todavía sin valorar".
      await montar();

      expect(stat('Valoración media')).toBe('—');
    });

    it('debería seguir mostrando el comercio aunque fallen las listas secundarias', async () => {
      comercioApi.getMisReservas.mockReturnValue(throwError(() => new Error('500')));
      comercioApi.getMisServicios.mockReturnValue(throwError(() => new Error('500')));
      comercioApi.getMisResenas.mockReturnValue(throwError(() => new Error('500')));

      await montar();

      expect(component.comercio()).toMatchObject({ nombreComercial: 'peluquería Nala' });
      expect(stat('Reservas totales')).toBe('0');
    });

    it('debería mantener el estado inicial si el API entero está caído', async () => {
      comercioApi.getMiComercio.mockReturnValue(throwError(() => new Error('500')));

      await montar();

      expect(component.comercio()).toBeNull();
      expect(stat('Reservas totales')).toBe('0');
    });
  });

  it('debería cerrar sesión al pulsar salir', async () => {
    await montar();

    component.cerrarSesion();

    expect(authService.logout).toHaveBeenCalled();
  });
});
