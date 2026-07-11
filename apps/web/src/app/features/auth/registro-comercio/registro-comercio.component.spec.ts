import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ReactiveFormsModule } from '@angular/forms';
import { RouterTestingModule } from '@angular/router/testing';
import { VerticalKey } from 'shared';
import { RegistroComercioComponent } from './registro-comercio.component';
import { AuthService } from '../../../core/auth/auth.service';

describe('RegistroComercioComponent', () => {
  let fixture: ComponentFixture<RegistroComercioComponent>;
  let component: RegistroComercioComponent;
  let authService: jest.Mocked<AuthService>;

  const datosValidos = {
    nombre: 'Ana Torres',
    email: 'ana@royaldog.eu',
    password: 'password123',
    nombreComercial: 'Royal Dog Resort',
    razonSocial: 'Royal Dog Resort S.L.',
    vatNumber: 'ES-B87654321',
  };

  beforeEach(async () => {
    authService = { registrarComercio: jest.fn() } as any;

    await TestBed.configureTestingModule({
      imports: [RegistroComercioComponent, ReactiveFormsModule, RouterTestingModule],
      providers: [{ provide: AuthService, useValue: authService }],
    }).compileComponents();

    fixture = TestBed.createComponent(RegistroComercioComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('debería crear el componente', () => {
    expect(component).toBeTruthy();
  });

  it('debería tener el formulario inválido al inicio', () => {
    expect(component.formulario.invalid).toBe(true);
  });

  it('debería registrar el comercio con los datos del formulario y las categorías seleccionadas', async () => {
    authService.registrarComercio.mockResolvedValue(undefined);
    component.formulario.setValue(datosValidos);
    component.toggleVertical(VerticalKey.ALOJAMIENTO);
    component.toggleVertical(VerticalKey.PELUQUERIA);

    await component.onSubmit();

    expect(authService.registrarComercio).toHaveBeenCalledWith({
      ...datosValidos,
      verticales: [VerticalKey.ALOJAMIENTO, VerticalKey.PELUQUERIA],
    });
  });

  it('debería enviar verticales=undefined si no se selecciona ninguna categoría', async () => {
    authService.registrarComercio.mockResolvedValue(undefined);
    component.formulario.setValue(datosValidos);

    await component.onSubmit();

    expect(authService.registrarComercio).toHaveBeenCalledWith({
      ...datosValidos,
      verticales: undefined,
    });
  });

  it('no debería registrar si el formulario es inválido', async () => {
    await component.onSubmit();
    expect(authService.registrarComercio).not.toHaveBeenCalled();
  });

  it('debería mostrar un error específico si el email o el vatNumber ya existen (409)', async () => {
    authService.registrarComercio.mockRejectedValue({ status: 409 });
    component.formulario.setValue(datosValidos);

    await component.onSubmit();

    expect(component.error()).toContain('ya está registrado');
  });

  it('debería mostrar un error genérico ante cualquier otro fallo', async () => {
    authService.registrarComercio.mockRejectedValue(new Error('network error'));
    component.formulario.setValue(datosValidos);

    await component.onSubmit();

    expect(component.error()).toBe('Error al registrar tu negocio. Inténtalo de nuevo.');
  });

  it('toggleVertical debería añadir y quitar categorías', () => {
    expect(component.estaSeleccionada(VerticalKey.VETERINARIA)).toBe(false);
    component.toggleVertical(VerticalKey.VETERINARIA);
    expect(component.estaSeleccionada(VerticalKey.VETERINARIA)).toBe(true);
    component.toggleVertical(VerticalKey.VETERINARIA);
    expect(component.estaSeleccionada(VerticalKey.VETERINARIA)).toBe(false);
  });
});
