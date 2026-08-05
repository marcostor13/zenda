import { ComponentFixture, TestBed } from '@angular/core/testing';
import { RouterTestingModule } from '@angular/router/testing';
import { HttpClientTestingModule } from '@angular/common/http/testing';
import { PerrosListaComponent } from './perros-lista.component';
import { PerrosService, PerroApi, IndiceBienestarApi, PerroHistorialApi } from './perros.service';

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
      historial: jest.fn().mockResolvedValue([]),
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
    expect(component.iconoBienestar('inicial')).toBe('circle');
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

  describe('tarjeta pasaporte (HU-8.1.1)', () => {
    it('debería mostrar edad, sexo y ciudad cuando existen', async () => {
      const hace3anios = new Date();
      hace3anios.setFullYear(hace3anios.getFullYear() - 3);
      await crear([perro({ fechaNacimiento: hace3anios.toISOString(), sexo: 'hembra', ciudad: 'Madrid' })]);

      const el: HTMLElement = fixture.nativeElement;
      expect(el.textContent).toContain('3 años');
      expect(el.textContent).toContain('Hembra');
      expect(el.textContent).toContain('Madrid');
    });

    it('no debería inventar una edad si la mascota no la tiene declarada', async () => {
      await crear([perro()]);

      expect(component.edadDe(component.perros()[0])).toBeNull();
    });

    it('debería calcular las etiquetas de estado a partir de datos reales', async () => {
      await crear([perro({
        sociabilidadPerros: 'alta', vacunas: ['rabia'], esterilizado: true, microchip: '123',
      })]);

      const tags = component.etiquetasEstado(component.perros()[0]).map((t) => t.label);
      expect(tags).toEqual(['Sociable', 'Vacunada', 'Esterilizada', 'Microchip']);
    });

    it('no debería mostrar ninguna etiqueta si no hay datos reales que la respalden', async () => {
      await crear([perro({ esterilizado: false })]);

      expect(component.etiquetasEstado(component.perros()[0])).toEqual([]);
    });
  });

  describe('resumen de salud e historial (HU-8.1.3/8.1.4)', () => {
    it('debería mostrar el resumen al pulsar "Ver ficha completa" y cargar el historial', async () => {
      await crear([perro()]);
      const historial: PerroHistorialApi[] = [
        { _id: 'h1', vertical: 'peluqueria', nota: 'Baño y corte', createdAt: '2026-01-01' },
      ];
      perrosService.historial.mockResolvedValue(historial);

      await component.toggleHistorial(component.perros()[0]);
      fixture.detectChanges();

      expect(component.historialAbiertoId()).toBe('p1');
      expect(perrosService.historial).toHaveBeenCalledWith('p1');
      const el: HTMLElement = fixture.nativeElement;
      expect(el.textContent).toContain('Baño y corte');
    });

    it('debería ocultar el resumen al pulsar de nuevo', async () => {
      await crear([perro()]);

      await component.toggleHistorial(component.perros()[0]);
      await component.toggleHistorial(component.perros()[0]);

      expect(component.historialAbiertoId()).toBeNull();
    });

    it('no debería volver a pedir el historial si ya está en caché', async () => {
      await crear([perro()]);

      await component.toggleHistorial(component.perros()[0]);
      await component.toggleHistorial(component.perros()[0]);
      await component.toggleHistorial(component.perros()[0]);

      expect(perrosService.historial).toHaveBeenCalledTimes(1);
    });
  });
});
