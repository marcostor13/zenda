import { ComponentFixture, TestBed } from '@angular/core/testing';
import { RouterTestingModule } from '@angular/router/testing';
import { HttpClientTestingModule } from '@angular/common/http/testing';
import { PerrosListaComponent } from './perros-lista.component';
import { PerrosService, PerroApi, IndiceBienestarApi } from './perros.service';

describe('PerrosListaComponent', () => {
  let fixture: ComponentFixture<PerrosListaComponent>;
  let component: PerrosListaComponent;
  let perrosService: jest.Mocked<PerrosService>;

  const perro = (extra: Partial<PerroApi> = {}): PerroApi => ({
    _id: 'p1', nombre: 'Maya', fotos: [], especie: 'perro', raza: 'Golden Retriever',
    esMestizo: false, esterilizado: true, tipoPelo: [], vacunas: [], alergias: [],
    enfermedades: [], medicacion: [], puedeQuedarseSolo: true, ansiedadSeparacion: false,
    miedos: [], seMarea: false, requiereTransportin: false, autorizaCompartirHistorial: true,
    ...extra,
  });

  const bienestar = (extra: Partial<IndiceBienestarApi> = {}): IndiceBienestarApi => ({
    perroId: 'p1', puntuacion: 94, nivel: 'excelente', descuentoSeguroPct: 0.15, ejes: [],
    ...extra,
  });

  const crear = async (perros: PerroApi[], bienestarMock?: IndiceBienestarApi): Promise<void> => {
    perrosService = {
      misPerros: jest.fn().mockResolvedValue(perros),
      indiceComportamiento: jest.fn().mockResolvedValue(null),
      bienestar: bienestarMock
        ? jest.fn().mockResolvedValue(bienestarMock)
        : jest.fn().mockRejectedValue(new Error('sin datos')),
    } as unknown as jest.Mocked<PerrosService>;

    await TestBed.configureTestingModule({
      imports: [PerrosListaComponent, RouterTestingModule, HttpClientTestingModule],
      providers: [{ provide: PerrosService, useValue: perrosService }],
    }).compileComponents();

    fixture = TestBed.createComponent(PerrosListaComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
    // La carga encadena misPerros → indiceComportamiento → bienestar: whenStable()
    // no basta con varias promesas anidadas, así que se vacía la cola de
    // microtareas explícitamente con un macrotask real.
    await new Promise((resolve) => setTimeout(resolve, 0));
    fixture.detectChanges();
  };

  it('debería cargar los perros del usuario', async () => {
    await crear([perro()]);

    expect(component.perros()).toHaveLength(1);
    expect(component.cargando()).toBe(false);
  });

  it('debería mostrar el Índice de Bienestar cuando el backend lo calcula (HU-8.1.7)', async () => {
    await crear([perro()], bienestar());

    expect(component.bienestar()['p1'].puntuacion).toBe(94);
    const el: HTMLElement = fixture.nativeElement;
    expect(el.textContent).toContain('Bienestar 94/100');
  });

  it('no debería inventar un bienestar si el backend no puede calcularlo', async () => {
    await crear([perro()]);

    expect(component.bienestar()['p1']).toBeUndefined();
    const el: HTMLElement = fixture.nativeElement;
    expect(el.textContent).not.toContain('Bienestar');
  });

  it('debería usar variante e icono neutros para el nivel inicial (no es un juicio al propietario)', async () => {
    await crear([perro()]);
    expect(component.varianteBienestar('inicial')).toBe('neutral');
    expect(component.iconoBienestar('inicial')).toBe('⚪');
  });

  it('debería usar variante de éxito para niveles buenos', async () => {
    await crear([perro()]);
    expect(component.varianteBienestar('excelente')).toBe('success');
    expect(component.varianteBienestar('muy_bueno')).toBe('success');
  });

  it('debería mostrar el % de completitud de la ficha inteligente', async () => {
    await crear([perro({ raza: undefined })]);

    const el: HTMLElement = fixture.nativeElement;
    expect(el.textContent).toContain('Ficha inteligente:');
    expect(el.textContent).toContain('% completada');
  });
});
