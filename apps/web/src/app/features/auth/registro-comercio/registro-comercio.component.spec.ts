import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ReactiveFormsModule } from '@angular/forms';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { RouterTestingModule } from '@angular/router/testing';
import { VerticalKey } from 'shared';
import { RegistroComercioComponent } from './registro-comercio.component';
import { AuthService } from '../../../core/auth/auth.service';

describe('RegistroComercioComponent (wizard)', () => {
  let fixture: ComponentFixture<RegistroComercioComponent>;
  let component: RegistroComercioComponent;
  let authService: jest.Mocked<AuthService>;

  const rellenarCuenta = (): void => {
    component.cuentaForm.setValue({
      nombre: 'Ana Torres',
      email: 'ana@royaldog.eu',
      telefono: '',
      password: 'password123',
    });
  };

  beforeEach(async () => {
    localStorage.clear();
    authService = { registrarComercio: jest.fn() } as any;

    await TestBed.configureTestingModule({
      imports: [RegistroComercioComponent, ReactiveFormsModule, RouterTestingModule],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: AuthService, useValue: authService },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(RegistroComercioComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('debería crear el componente e iniciar en el paso 1', () => {
    expect(component).toBeTruthy();
    expect(component.paso()).toBe(1);
  });

  /**
   * Regresión: los `formGroup` colgaban de los `<div>` de dentro, no del
   * `<form>`. Sin directiva en el `<form>`, `(ngSubmit)` no lo emitía nadie, el
   * botón hacía un submit nativo y el navegador recargaba la página: el alta
   * parecía volver al paso 1 justo al terminar el paso 2.
   */
  it('debería enviar por ngSubmit y no dejar que el navegador recargue la página', async () => {
    authService.registrarComercio.mockResolvedValue({ email: 'ana@royaldog.eu' } as never);
    component.toggleVertical(VerticalKey.ALOJAMIENTO);
    component.siguiente();
    rellenarCuenta();
    fixture.detectChanges();

    const form = fixture.nativeElement.querySelector('form.rc-form') as HTMLFormElement;
    const evento = new Event('submit', { bubbles: true, cancelable: true });
    form.dispatchEvent(evento);
    await fixture.whenStable();

    // Si el submit no se cancela, el navegador navega y la SPA se reinicia.
    expect(evento.defaultPrevented).toBe(true);
    expect(authService.registrarComercio).toHaveBeenCalled();
    expect(component.pendiente()).toBe(true);
  });

  it('debería enlazar el formulario raíz al elemento <form>', () => {
    component.toggleVertical(VerticalKey.ALOJAMIENTO);
    component.siguiente();
    fixture.detectChanges();

    // El bloque de acceso cuelga del grupo raíz: sin eso no hay ngSubmit.
    expect(component.registroForm.get('cuenta.email')).toBe(component.cuentaForm.get('email'));
  });

  it('no debería avanzar del paso 1 sin categorías seleccionadas', () => {
    component.siguiente();
    expect(component.paso()).toBe(1);
  });

  it('debería avanzar al paso 2 tras elegir una categoría', () => {
    component.toggleVertical(VerticalKey.ALOJAMIENTO);
    component.siguiente();
    expect(component.paso()).toBe(2);
  });

  it('no debería avanzar más allá del último paso', () => {
    component.toggleVertical(VerticalKey.ALOJAMIENTO);
    component.siguiente();
    component.siguiente();
    expect(component.paso()).toBe(component.pasos.length);
  });

  it('debería señalar los campos de acceso incompletos al enviar', async () => {
    component.toggleVertical(VerticalKey.ALOJAMIENTO);

    await component.onSubmit();

    expect(authService.registrarComercio).not.toHaveBeenCalled();
    expect(component.cuentaForm.get('email')?.touched).toBe(true);
  });

  it('NO debería pedir los datos del negocio', async () => {
    // El nombre del negocio y sus datos se piden en el alta guiada, ya con la
    // cuenta verificada: el registro sólo abre la puerta.
    authService.registrarComercio.mockResolvedValue({ requiereVerificacion: true, email: 'ana@royaldog.eu' });
    component.toggleVertical(VerticalKey.ALOJAMIENTO);
    rellenarCuenta();

    await component.onSubmit();

    const enviado = authService.registrarComercio.mock.calls.at(-1)![0];
    expect(enviado).not.toHaveProperty('nombreComercial');
    expect(enviado).not.toHaveProperty('ciudad');
  });

  it('debería registrar la cuenta con sus categorías', async () => {
    authService.registrarComercio.mockResolvedValue({ requiereVerificacion: true, email: 'ana@royaldog.eu' });
    component.toggleVertical(VerticalKey.ALOJAMIENTO);
    component.toggleVertical(VerticalKey.PELUQUERIA);
    rellenarCuenta();

    await component.onSubmit();

    expect(authService.registrarComercio).toHaveBeenCalledWith({
      nombre: 'Ana Torres',
      email: 'ana@royaldog.eu',
      password: 'password123',
      telefono: undefined,
      verticales: [VerticalKey.ALOJAMIENTO, VerticalKey.PELUQUERIA],
    });
  });

  it('debería enviar verticales=undefined si no hay categorías', async () => {
    authService.registrarComercio.mockResolvedValue({ requiereVerificacion: true, email: 'ana@royaldog.eu' });
    rellenarCuenta();

    await component.onSubmit();

    expect(authService.registrarComercio).toHaveBeenCalledWith(
      expect.objectContaining({ verticales: undefined }),
    );
  });

  it('no debería registrar si la cuenta es inválida', async () => {
    await component.onSubmit();
    expect(authService.registrarComercio).not.toHaveBeenCalled();
  });

  it('debería mostrar un error específico si el email ya existe (409)', async () => {
    authService.registrarComercio.mockRejectedValue({ status: 409 });
    rellenarCuenta();

    await component.onSubmit();

    expect(component.error()).toContain('ya está registrado');
    expect(component.emailDuplicado()).toBe(true);
  });

  it('debería mostrar un error genérico ante cualquier otro fallo', async () => {
    authService.registrarComercio.mockRejectedValue(new Error('network error'));
    rellenarCuenta();

    await component.onSubmit();

    expect(component.error()).toContain('No pudimos crear tu negocio');
  });

  it('toggleVertical debería añadir y quitar categorías', () => {
    expect(component.estaSeleccionada(VerticalKey.VETERINARIA)).toBe(false);
    component.toggleVertical(VerticalKey.VETERINARIA);
    expect(component.estaSeleccionada(VerticalKey.VETERINARIA)).toBe(true);
    component.toggleVertical(VerticalKey.VETERINARIA);
    expect(component.estaSeleccionada(VerticalKey.VETERINARIA)).toBe(false);
  });

  it('atras debería retroceder de paso y limpiar el error', () => {
    component.toggleVertical(VerticalKey.ALOJAMIENTO);
    component.siguiente();
    component.error.set('algo');
    component.atras();
    expect(component.paso()).toBe(1);
    expect(component.error()).toBeNull();
  });

  describe('borrador guardado en el dispositivo', () => {
    const CLAVE = 'dk_registro_comercio_borrador';

    /** Recrea el componente: el borrador se lee en el constructor. */
    const recrear = (): RegistroComercioComponent => {
      const nuevo = TestBed.createComponent(RegistroComercioComponent);
      nuevo.detectChanges();
      return nuevo.componentInstance;
    };

    it('debería recuperar las categorías marcadas la vez anterior', () => {
      localStorage.setItem(CLAVE, JSON.stringify({ verticales: [VerticalKey.PELUQUERIA] }));

      expect(recrear().verticalesSel()).toEqual([VerticalKey.PELUQUERIA]);
    });

    /**
     * Regresión: un borrador de antes del 1-09-2026 guarda «cuidadores», que ya
     * no existe. Se restauraba tal cual y el alta moría con «each value in
     * verticales must be one of…», un mensaje sin relación con nada visible.
     */
    it('debería descartar las categorías que ya no están en el catálogo', () => {
      localStorage.setItem(CLAVE, JSON.stringify({
        verticales: ['cuidadores', VerticalKey.ALOJAMIENTO, 'paseadores'],
      }));

      const componente = recrear();

      expect(componente.verticalesSel()).toEqual([VerticalKey.ALOJAMIENTO]);
      expect(JSON.parse(localStorage.getItem(CLAVE)!)).toEqual({
        verticales: [VerticalKey.ALOJAMIENTO],
      });
    });

    it('debería borrar el borrador si ninguna categoría sigue vigente', () => {
      localStorage.setItem(CLAVE, JSON.stringify({ verticales: ['cuidadores'] }));

      const componente = recrear();

      expect(componente.verticalesSel()).toEqual([]);
      expect(componente.hayBorrador()).toBe(false);
      expect(localStorage.getItem(CLAVE)).toBeNull();
    });

    it('debería sobrevivir a un borrador ilegible', () => {
      localStorage.setItem(CLAVE, 'no-es-json');

      expect(recrear().verticalesSel()).toEqual([]);
      expect(localStorage.getItem(CLAVE)).toBeNull();
    });
  });

  describe('errores del alta', () => {
    it('debería devolver al paso 1 y limpiar el borrador si el API rechaza las categorías', async () => {
      component.toggleVertical(VerticalKey.ALOJAMIENTO);
      component.siguiente();
      rellenarCuenta();
      authService.registrarComercio.mockRejectedValue({ status: 400 });

      await component.onSubmit();

      expect(component.paso()).toBe(1);
      expect(component.verticalesSel()).toEqual([]);
      expect(localStorage.getItem('dk_registro_comercio_borrador')).toBeNull();
      expect(component.error()).toContain('categorías');
    });

    /**
     * Regresión: el aviso vivía dentro del formulario del paso 2, así que al
     * devolver al paso 1 desaparecía con él y el comercio se encontraba de
     * vuelta en la primera pantalla sin saber por qué.
     */
    it('debería seguir viéndose el aviso después de volver al paso 1', async () => {
      component.toggleVertical(VerticalKey.ALOJAMIENTO);
      component.siguiente();
      rellenarCuenta();
      authService.registrarComercio.mockRejectedValue({ status: 400 });

      await component.onSubmit();
      fixture.detectChanges();

      const texto = (fixture.nativeElement as HTMLElement).textContent ?? '';
      expect(component.paso()).toBe(1);
      expect(texto).toContain('categorías elegidas ya no está disponible');
    });

    it('debería avisar de email duplicado ante un 409', async () => {
      component.toggleVertical(VerticalKey.ALOJAMIENTO);
      component.siguiente();
      rellenarCuenta();
      authService.registrarComercio.mockRejectedValue({ status: 409 });

      await component.onSubmit();

      expect(component.emailDuplicado()).toBe(true);
      expect(component.paso()).toBe(2);
    });
  });

  describe('fuerza de la contraseña (HU-6.1.4)', () => {
    it('debería marcar como débil una contraseña corta y simple', () => {
      component.cuentaForm.patchValue({ password: 'abcdefgh' });
      expect(component.fuerzaPassword()).toBe('debil');
    });

    it('debería subir de nivel con longitud y variedad de caracteres', () => {
      component.cuentaForm.patchValue({ password: 'abcdefgh' });
      const debil = component.nivelFuerzaPassword();

      component.cuentaForm.patchValue({ password: 'AbcdefghIJKL' });
      const media = component.nivelFuerzaPassword();

      component.cuentaForm.patchValue({ password: 'AbcdefghIJKL123!' });
      const muySegura = component.nivelFuerzaPassword();

      expect(media).toBeGreaterThan(debil);
      expect(muySegura).toBeGreaterThan(media);
      expect(component.fuerzaPassword()).toBe('muy_segura');
    });
  });
});
