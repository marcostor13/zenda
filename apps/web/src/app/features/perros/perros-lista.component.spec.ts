import { ComponentFixture, TestBed } from '@angular/core/testing';
import { RouterTestingModule } from '@angular/router/testing';
import { HttpClientTestingModule } from '@angular/common/http/testing';
import { PerrosListaComponent } from './perros-lista.component';
import { PerrosService, PerroApi, IndiceBienestarApi } from './perros.service';
import { ExpedienteApi, ExpedienteService } from './expediente.service';
import * as descarga from '../../shared/exportacion/descarga';

// Con una sola mascota la página monta la ficha completa, que es una pantalla
// entera con sus hijos: compilarla se lleva más de los 5 s por defecto.
jest.setTimeout(20_000);

describe('PerrosListaComponent', () => {
  let fixture: ComponentFixture<PerrosListaComponent>;
  let component: PerrosListaComponent;
  let perrosService: jest.Mocked<PerrosService>;
  let expedientes: { delPropietario: jest.Mock; descargarInformePropietario: jest.Mock };

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

  const expediente = (p: PerroApi): ExpedienteApi => ({
    perro: p as ExpedienteApi['perro'], registros: [], servicios: [],
  });

  const crear = async (perros: PerroApi[], bienestarMock?: IndiceBienestarApi): Promise<void> => {
    perrosService = {
      misPerros: jest.fn().mockResolvedValue(perros),
      indiceComportamiento: jest.fn().mockResolvedValue(null),
      bienestar: bienestarMock
        ? jest.fn().mockResolvedValue(bienestarMock)
        : jest.fn().mockRejectedValue(new Error('sin datos')),
      historial: jest.fn().mockResolvedValue([]),
      informePdf: jest.fn().mockResolvedValue(new Blob(['%PDF-'], { type: 'application/pdf' })),
    } as unknown as jest.Mocked<PerrosService>;

    expedientes = {
      delPropietario: jest.fn().mockResolvedValue(expediente(perros[0] ?? perro())),
      descargarInformePropietario: jest.fn().mockResolvedValue(undefined),
    };

    await TestBed.configureTestingModule({
      imports: [PerrosListaComponent, RouterTestingModule, HttpClientTestingModule],
      providers: [
        { provide: PerrosService, useValue: perrosService },
        { provide: ExpedienteService, useValue: expedientes },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(PerrosListaComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
    // La carga encadena misPerros → indiceComportamiento → bienestar: whenStable()
    // no basta con varias promesas anidadas, así que se vacía la cola de
    // microtareas explícitamente con un macrotask real.
    await new Promise((resolve) => setTimeout(resolve, 0));
    fixture.detectChanges();
    await new Promise((resolve) => setTimeout(resolve, 0));
    fixture.detectChanges();
  };

  const dos = (extra: Partial<PerroApi> = {}): PerroApi[] => [
    perro(extra), perro({ _id: 'p2', nombre: 'Kira' }),
  ];

  it('debería cargar las mascotas del usuario', async () => {
    await crear([perro()]);

    expect(component.perros()).toHaveLength(1);
    expect(component.cargando()).toBe(false);
  });

  describe('cliente con una sola mascota', () => {
    it('debería montar la ficha completa en lugar de una tarjeta-resumen', async () => {
      await crear([perro()]);

      const el: HTMLElement = fixture.nativeElement;
      expect(el.querySelector('app-perro-ficha')).not.toBeNull();
      expect(el.querySelector('.mascota')).toBeNull();
      expect(expedientes.delPropietario).toHaveBeenCalledWith('p1');
    });

    it('no debería repetir el navbar ni el enlace de vuelta dentro de la ficha incrustada', async () => {
      await crear([perro()]);

      const el: HTMLElement = fixture.nativeElement;
      expect(el.querySelectorAll('rs-navbar')).toHaveLength(1);
      expect(el.querySelector('app-perro-ficha .volver')).toBeNull();
    });

    it('debería ofrecer los accesos rápidos apuntando a esa mascota', async () => {
      await crear([perro()]);

      const accesos = component.accesos();
      expect(accesos.map((a) => a.titulo)).toEqual([
        'Próximas reservas', 'Recordatorios de salud', 'Documentos y vacunas', 'Servicios recomendados',
      ]);
      expect(accesos[1].ruta).toEqual(['/perros', 'p1']);
      expect(accesos[1].tab).toBe('salud');
      expect((fixture.nativeElement as HTMLElement).querySelectorAll('.acceso')).toHaveLength(4);
    });

    it('no debería pedir índices que sólo pinta la tarjeta-resumen', async () => {
      await crear([perro()]);

      // La ficha incrustada trae los suyos: pedirlos aquí serían dos llamadas
      // que nadie llega a ver.
      expect(perrosService.indiceComportamiento).not.toHaveBeenCalled();
    });
  });

  describe('cliente con varias mascotas', () => {
    it('debería mostrar una tarjeta por mascota y la de añadir otra', async () => {
      await crear(dos());

      const el: HTMLElement = fixture.nativeElement;
      expect(el.querySelectorAll('.mascota')).toHaveLength(2);
      expect(el.querySelector('.anadir')).not.toBeNull();
      expect(el.querySelector('app-perro-ficha')).toBeNull();
    });

    it('no debería ofrecer accesos de una mascota concreta', async () => {
      await crear(dos());

      expect(component.accesos()).toEqual([]);
    });

    it('debería mostrar el Índice de Bienestar cuando el backend lo calcula (HU-8.1.7)', async () => {
      await crear(dos(), bienestar());

      expect(component.bienestar()['p1'].puntuacion).toBe(94);
      const el: HTMLElement = fixture.nativeElement;
      expect(el.textContent).toContain('Bienestar 94/100');
    });

    it('no debería inventar un bienestar si el backend no puede calcularlo', async () => {
      await crear(dos());

      expect(component.bienestar()['p1']).toBeUndefined();
      const el: HTMLElement = fixture.nativeElement;
      expect(el.textContent).not.toContain('Bienestar');
    });

    it('debería mostrar el % de completitud de la ficha inteligente', async () => {
      await crear(dos({ raza: undefined }));

      const el: HTMLElement = fixture.nativeElement;
      expect(el.textContent).toContain('Ficha completada al');
      expect(el.querySelector('.completitud__barra div')).not.toBeNull();
    });

    it('debería enlazar cada tarjeta con la ficha completa de su mascota', async () => {
      await crear(dos());

      const enlaces = Array.from((fixture.nativeElement as HTMLElement).querySelectorAll('a'))
        .map((a) => a.getAttribute('href'));
      expect(enlaces).toContain('/perros/p1');
      expect(enlaces).toContain('/perros/p2');
    });
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

  describe('menú de acciones de la tarjeta', () => {
    it('debería abrir el menú de una mascota y cerrar el de las demás', async () => {
      await crear(dos());

      component.alternarMenu('p1');
      expect(component.menuAbierto()).toBe('p1');

      component.alternarMenu('p2');
      expect(component.menuAbierto()).toBe('p2');

      component.alternarMenu('p2');
      expect(component.menuAbierto()).toBeNull();
    });

    it('debería cerrarse al hacer clic fuera', async () => {
      await crear(dos());

      component.alternarMenu('p1');
      component.cerrarMenu();

      expect(component.menuAbierto()).toBeNull();
    });
  });

  describe('tarjeta pasaporte (HU-8.1.1)', () => {
    it('debería mostrar edad, sexo y ciudad cuando existen', async () => {
      const hace3anios = new Date();
      hace3anios.setFullYear(hace3anios.getFullYear() - 3);
      await crear(dos({ fechaNacimiento: hace3anios.toISOString(), sexo: 'hembra', ciudad: 'Madrid' }));

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

  describe('informe de salud en PDF', () => {
    let entregado: jest.SpyInstance;

    beforeEach(() => {
      // El ayudante toca el DOM para entregar el fichero; aquí sólo interesa
      // qué se le pasa.
      entregado = jest.spyOn(descarga, 'descargarFichero').mockImplementation(() => undefined);
    });

    afterEach(() => entregado.mockRestore());

    it('debería descargar el informe de la mascota con un nombre reconocible', async () => {
      await crear([perro({ nombre: 'Maya' })]);

      await component.descargarInforme(perro({ nombre: 'Maya' }));

      expect(perrosService.informePdf).toHaveBeenCalledWith('p1');
      expect(entregado.mock.calls[0][1]).toMatch(/^doogking-informe-maya-\d{4}-\d{2}-\d{2}\.pdf$/);
    });

    it('debería limpiar del nombre del fichero los acentos y la puntuación', async () => {
      await crear([perro()]);

      await component.descargarInforme(perro({ nombre: 'Lúa / Sol' }));

      expect(entregado.mock.calls[0][1]).toContain('doogking-informe-lua-sol-');
    });

    it('debería avisar si el informe no se pudo preparar', async () => {
      await crear([perro()]);
      perrosService.informePdf.mockRejectedValue(new Error('500'));

      await component.descargarInforme(perro());

      expect(component.errorMsg()).toContain('No se pudo preparar el informe');
      expect(entregado).not.toHaveBeenCalled();
    });

    it('debería dejar de marcar la descarga en curso aunque falle', async () => {
      await crear([perro()]);
      perrosService.informePdf.mockRejectedValue(new Error('500'));

      await component.descargarInforme(perro());

      expect(component.descargandoId()).toBeNull();
    });
  });
});
