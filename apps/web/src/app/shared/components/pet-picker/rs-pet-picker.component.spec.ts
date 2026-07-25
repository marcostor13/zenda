import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { RouterTestingModule } from '@angular/router/testing';
import { AuthService } from '../../../core/auth/auth.service';
import { PerroApi, PerrosService } from '../../../features/perros/perros.service';
import { RsPetPickerComponent } from './rs-pet-picker.component';

const perro = (id: string, nombre: string): PerroApi => ({
  _id: id, nombre, fotos: [], especie: 'perro', esMestizo: false, esterilizado: false,
  tipoPelo: [], vacunas: [], alergias: [], enfermedades: [], medicacion: [], miedos: [],
  puedeQuedarseSolo: true, ansiedadSeparacion: false, seMarea: false,
  requiereTransportin: false, autorizaCompartirHistorial: true,
});

describe('RsPetPickerComponent', () => {
  let fixture: ComponentFixture<RsPetPickerComponent>;
  let componente: RsPetPickerComponent;
  let perrosService: jest.Mocked<Pick<PerrosService, 'misPerros'>>;

  const crear = async (autenticado = true): Promise<void> => {
    perrosService = { misPerros: jest.fn().mockResolvedValue([perro('p1', 'Maya'), perro('p2', 'Toby')]) };

    await TestBed.configureTestingModule({
      imports: [RsPetPickerComponent, RouterTestingModule],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: PerrosService, useValue: perrosService },
        { provide: AuthService, useValue: { estaAutenticado: () => autenticado } },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(RsPetPickerComponent);
    componente = fixture.componentInstance;
    fixture.detectChanges();
  };

  it('debería empezar en un perro y sin mascota elegida', async () => {
    await crear();
    expect(componente.numPerros()).toBe(1);
    expect(componente.perroIds()).toEqual([]);
    expect(componente.resumen()).toBe('1 perro');
  });

  it('no debería tener tope al añadir perros', async () => {
    await crear();
    for (let i = 0; i < 9; i++) componente.anadirSinFicha();

    expect(componente.numPerros()).toBe(10);
    expect(componente.resumen()).toBe('10 perros');
  });

  it('nunca debería bajar de un perro', async () => {
    await crear();
    componente.quitarSinFicha();
    componente.quitarSinFicha();

    expect(componente.numPerros()).toBe(1);
  });

  it('debería subir el total al elegir una segunda mascota', async () => {
    await crear();
    componente.alternarPerro('p1');
    componente.alternarPerro('p2');

    expect(componente.perroIds()).toEqual(['p1', 'p2']);
    expect(componente.numPerros()).toBe(2);
  });

  it('no debería permitir quitar perros por debajo de las mascotas elegidas', async () => {
    await crear();
    componente.alternarPerro('p1');
    componente.alternarPerro('p2');

    expect(componente.puedeQuitar()).toBe(false);
  });

  it('debería resumir con los nombres de las mascotas elegidas', async () => {
    await crear();
    componente.alternar();
    await fixture.whenStable();

    componente.alternarPerro('p1');
    expect(componente.resumen()).toBe('Maya');

    componente.alternarPerro('p2');
    expect(componente.resumen()).toBe('Maya y Toby');

    componente.anadirSinFicha();
    expect(componente.resumen()).toBe('Maya y Toby + 1 perro');
  });

  it('debería cargar las mascotas solo al abrir, no al renderizar', async () => {
    await crear();
    expect(perrosService.misPerros).not.toHaveBeenCalled();

    componente.alternar();
    await fixture.whenStable();

    expect(perrosService.misPerros).toHaveBeenCalledTimes(1);
  });

  it('no debería pedir mascotas sin sesión iniciada', async () => {
    await crear(false);
    componente.alternar();
    await fixture.whenStable();

    expect(perrosService.misPerros).not.toHaveBeenCalled();
    expect(componente.abierto()).toBe(true);
  });

  it('debería seguir siendo usable si falla la carga de mascotas', async () => {
    await crear();
    perrosService.misPerros.mockRejectedValue(new Error('red caída'));

    componente.alternar();
    await fixture.whenStable();

    expect(componente.perros()).toEqual([]);
    expect(componente.cargando()).toBe(false);
  });
});
