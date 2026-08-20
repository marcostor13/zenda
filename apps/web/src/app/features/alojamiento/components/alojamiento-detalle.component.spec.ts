import { ComponentFixture, TestBed } from '@angular/core/testing';
import { HttpClientTestingModule } from '@angular/common/http/testing';
import { RouterTestingModule } from '@angular/router/testing';
import { Router } from '@angular/router';
import { AlojamientoDetalleComponent } from './alojamiento-detalle.component';
import { AlojamientoService, AlojamientoDetalle, Espacio } from '../services/alojamiento.service';
import { PerrosService, PerroApi } from '../../perros/perros.service';

describe('AlojamientoDetalleComponent', () => {
  let fixture: ComponentFixture<AlojamientoDetalleComponent>;
  let component: AlojamientoDetalleComponent;
  let alojamientoService: jest.Mocked<AlojamientoService>;

  const espacioMock: Espacio = {
    id: 'e1',
    tipo: 'suite',
    descripcion: 'Suite climatizada',
    tamanoMaxPerro: 'grande',
    precioNoche: 45,
    cantidad: 4,
    disponible: true,
    amenities: ['Climatización'],
    imagenes: ['img.jpg'],
    cancelacionGratis: true,
  };

  const detalleMock: AlojamientoDetalle = {
    id: 'a1',
    nombre: 'Royal Paws Retreat',
    ciudad: 'Madrid',
    barrio: 'Pozuelo',
    direccion: 'Camino de la Dehesa 12',
    score: 5.0,
    scoreLabel: 'Excepcional',
    numResenas: 128,
    precioPorNoche: 45,
    imagenes: ['img1.jpg', 'img2.jpg'],
    amenities: ['Piscina para perros'],
    cancelacionGratis: true,
    paseosIncluidos: true,
    espaciosDisponibles: 4,
    destacado: true,
    descripcion: 'Alojamiento canino de lujo',
    politicaCancelacion: 'Gratis hasta 24h antes',
    checkIn: '10:00',
    checkOut: '19:00',
    requisitoVacunas: true,
    camaras24h: true,
    espacios: [espacioMock],
    resenas: [],
    reglas: ['Cartilla de vacunación al día obligatoria'],
    comercioId: 'c1',
    compatibilidadSocialAdmitida: [],
    requisitoMicrochip: false,
    requiereDesparasitacionInterna: false,
    requiereDesparasitacionExterna: false,
    requiereVacunaTosPerreras: false,
    serviciosAdicionales: [],
  };

  beforeEach(async () => {
    alojamientoService = { buscar: jest.fn(), obtener: jest.fn() } as any;
    alojamientoService.obtener.mockResolvedValue(detalleMock);

    await TestBed.configureTestingModule({
      imports: [AlojamientoDetalleComponent, RouterTestingModule, HttpClientTestingModule],
      providers: [
        { provide: AlojamientoService, useValue: alojamientoService },
        {
          provide: PerrosService,
          useValue: { obtener: jest.fn().mockResolvedValue(null), bienestar: jest.fn().mockResolvedValue(null) },
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(AlojamientoDetalleComponent);
    component = fixture.componentInstance;
  });

  it('debería crear el componente', () => {
    expect(component).toBeTruthy();
  });

  describe('políticas en acordeón (PDF 27/07 §13)', () => {
    it('debería agrupar las políticas en Entrada, Salida, Cancelación y Vacunas', async () => {
      fixture.detectChanges();
      await fixture.whenStable();
      fixture.detectChanges();

      const acordeones: HTMLElement[] = Array.from(fixture.nativeElement.querySelectorAll('.policy-acc'));
      const titulos = acordeones.map((a) => a.querySelector('summary')?.textContent?.trim() ?? '');

      expect(titulos).toEqual([
        'Entrada',
        'Salida',
        'Cancelación',
        'Vacunas y requisitos sanitarios',
      ]);
    });

    it('debería dejar "Entrada" abierta y el resto plegadas al llegar', async () => {
      fixture.detectChanges();
      await fixture.whenStable();
      fixture.detectChanges();

      const acordeones: HTMLDetailsElement[] =
        Array.from(fixture.nativeElement.querySelectorAll('.policy-acc'));

      expect(acordeones.map((a) => a.open)).toEqual([true, false, false, false]);
    });
  });

  describe('desglose de valoración por aspectos (HU-4.1.6)', () => {
    const resenaCon = (aspectos: Record<string, number>) => ({
      id: `r${Math.random()}`, autorNombre: 'Ana', puntuacion: 5,
      comentario: 'Genial', fecha: '2026-07-01T00:00:00.000Z', aspectos,
    });

    it('debería promediar cada aspecto sobre las reseñas que lo puntuaron', async () => {
      alojamientoService.obtener.mockResolvedValue({
        ...detalleMock,
        resenas: [
          resenaCon({ limpieza: 5, atencion: 4 }),
          resenaCon({ limpieza: 4, atencion: 3 }),
        ],
      });
      fixture.detectChanges();
      await fixture.whenStable();

      const items = component.ratingItems();
      expect(items).toContainEqual({ label: 'Limpieza', val: 4.5, pct: 90 });
      expect(items).toContainEqual({ label: 'Atención', val: 3.5, pct: 70 });
    });

    it('debería omitir los aspectos que nadie ha valorado, no mostrarlos como 0', async () => {
      alojamientoService.obtener.mockResolvedValue({
        ...detalleMock,
        resenas: [resenaCon({ limpieza: 5 })],
      });
      fixture.detectChanges();
      await fixture.whenStable();

      const labels = component.ratingItems().map((i) => i.label);
      expect(labels).toEqual(['Limpieza']);
    });

    it('no debería mostrar desglose si no hay reseñas', async () => {
      fixture.detectChanges();
      await fixture.whenStable();

      expect(component.ratingItems()).toEqual([]);
    });
  });

  it('debería cargar el detalle del alojamiento al iniciar', async () => {
    fixture.detectChanges();
    await fixture.whenStable();

    expect(alojamientoService.obtener).toHaveBeenCalled();
    expect(component.alojamiento()?.nombre).toBe('Royal Paws Retreat');
    expect(component.cargando()).toBe(false);
  });

  it('debería mostrar los espacios con su precio por noche', async () => {
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    const html: string = fixture.nativeElement.innerHTML;
    expect(html).toContain('Tipos de espacio');
    // Sobre textContent: el espacio duro del importe se serializa como &nbsp;.
    expect(fixture.nativeElement.textContent).toContain('45'+String.fromCharCode(160)+'€');
    expect(html).toContain('por noche');
  });

  it('debería alternar la selección de un espacio', async () => {
    fixture.detectChanges();
    await fixture.whenStable();

    component.seleccionarEspacio(espacioMock);
    expect(component.espacioSelec()?.id).toBe('e1');

    component.seleccionarEspacio(espacioMock);
    expect(component.espacioSelec()).toBeNull();
  });

  it('no debería navegar a reserva sin espacio seleccionado', async () => {
    fixture.detectChanges();
    await fixture.whenStable();
    const router = TestBed.inject(Router);
    const navigateSpy = jest.spyOn(router, 'navigate');

    component.irAReserva();

    expect(navigateSpy).not.toHaveBeenCalled();
  });

  describe('galería a pantalla completa (HU-4.1.1)', () => {
    it('debería mostrar el contador de fotografías sobre la galería', async () => {
      fixture.detectChanges();
      await fixture.whenStable();
      fixture.detectChanges();

      const html: string = fixture.nativeElement.innerHTML;
      expect(html).toContain('2 fotografías');
    });

    it('debería abrir el lightbox con la foto pulsada', async () => {
      fixture.detectChanges();
      await fixture.whenStable();

      component.abrirLightbox('img2.jpg');

      expect(component.lightboxAbierto()).toBe(true);
      expect(component.lightboxImagen()).toBe('img2.jpg');
      expect(component.lightboxIndice()).toBe(1);
    });

    it('debería navegar circularmente entre fotos', async () => {
      fixture.detectChanges();
      await fixture.whenStable();
      component.abrirLightbox('img2.jpg');

      component.siguienteFoto();
      expect(component.lightboxImagen()).toBe('img1.jpg');

      component.fotoAnterior();
      expect(component.lightboxImagen()).toBe('img2.jpg');
    });

    it('debería cerrar el lightbox', () => {
      component.abrirLightbox('img1.jpg');
      component.cerrarLightbox();

      expect(component.lightboxAbierto()).toBe(false);
    });
  });

  describe('compatibilidad con la mascota (HU-4.1.7)', () => {
    const perroMock: PerroApi = {
      _id: 'p1', nombre: 'Maya', fotos: [], especie: 'perro', esMestizo: false,
      esterilizado: true, tipoPelo: [], vacunas: [], alergias: [], enfermedades: [],
      medicacion: [], puedeQuedarseSolo: true, ansiedadSeparacion: true, miedos: [],
      seMarea: false, requiereTransportin: false, autorizaCompartirHistorial: true,
      sociabilidadPerros: 'sociable', tamano: 'grande', temperamento: 'tranquilo',
    };

    it('sin mascota elegida no da ningún punto de compatibilidad', () => {
      component.alojamiento.set(detalleMock);
      expect(component.compatibilidad()).toEqual([]);
    });

    it('detecta cámaras 24h como punto útil para un perro con ansiedad por separación', () => {
      component.alojamiento.set(detalleMock);
      component.perroCompat.set(perroMock);

      expect(component.compatibilidad()).toContain('Cámaras 24h: podrás ver cómo lleva la separación');
    });

    it('admite el perfil social cuando el alojamiento no restringe compatibilidad', () => {
      component.alojamiento.set({ ...detalleMock, compatibilidadSocialAdmitida: [] });
      component.perroCompat.set(perroMock);

      expect(component.compatibilidad()).toContain('Perfil social admitido para perros sociable');
    });

    it('no inventa compatibilidad social si el alojamiento la restringe a otro perfil', () => {
      component.alojamiento.set({ ...detalleMock, compatibilidadSocialAdmitida: ['tímido'] });
      component.perroCompat.set(perroMock);

      expect(component.compatibilidad()).not.toContain('Perfil social admitido para perros sociable');
    });

    it('muestra el Índice de Bienestar de la mascota junto a la compatibilidad (HU-8.1.7)', async () => {
      fixture.detectChanges();
      await fixture.whenStable();

      component.perroCompat.set(perroMock);
      component.bienestarPerro.set({ perroId: 'p1', puntuacion: 88, nivel: 'muy_bueno', descuentoSeguroPct: 0.1, ejes: [] });
      fixture.detectChanges();

      const el: HTMLElement = fixture.nativeElement;
      expect(el.textContent).toContain('Índice de Bienestar de Maya: 88/100');
    });
  });

  it('debería navegar a /reservas/alojamiento con el espacio seleccionado', async () => {
    fixture.detectChanges();
    await fixture.whenStable();
    const router = TestBed.inject(Router);
    const navigateSpy = jest.spyOn(router, 'navigate').mockResolvedValue(true);

    component.seleccionarEspacio(espacioMock);
    component.irAReserva();

    expect(navigateSpy).toHaveBeenCalledWith(
      ['/reservas', 'alojamiento', 'a1'],
      expect.objectContaining({
        queryParams: expect.objectContaining({ espacioId: 'e1', precioBase: 45 }),
      }),
    );
  });

  it('debería traducir tipo y tamaño de perro a etiquetas en español', () => {
    expect(component.tipoLabel('suite')).toBe('Suite individual');
    expect(component.tipoLabel('compartido')).toBe('Espacio compartido');
    expect(component.tamanoLabel('pequeno')).toBe('pequeño');
    expect(component.tamanoLabel('gigante')).toBe('gigante');
  });

  it('debería quedar sin detalle (no encontrado, sin mock) si la API falla', async () => {
    alojamientoService.obtener.mockRejectedValue(new Error('offline'));
    fixture.detectChanges();
    await fixture.whenStable();

    expect(component.alojamiento()).toBeNull();
    expect(component.cargando()).toBe(false);
  });
  describe('etiquetas y respaldos de la ficha', () => {
    it('deberia traducir los tipos de espacio conocidos y dejar el resto en crudo', () => {
      expect(component.tipoLabel('suite')).toBe('Suite individual');
      expect(component.tipoLabel('climatizada')).toBe('Habitación climatizada');
      expect(component.tipoLabel('inventado' as never)).toBe('inventado');
    });

    it('deberia traducir los tamanos y dejar el resto en crudo', () => {
      expect(component.tamanoLabel('pequeno' as never)).toBe('pequeño');
      expect(component.tamanoLabel('desconocido' as never)).toBe('desconocido');
    });

    it('deberia usar la foto del espacio si la tiene', () => {
      component.alojamiento.set(detalleMock);

      expect(component.imagenEspacio({ ...espacioMock, imagenes: ['propia.jpg'] })).toBe('propia.jpg');
    });

    it('deberia caer a la foto del alojamiento si el espacio no tiene', () => {
      // Un espacio sin foto no puede salir con el hueco en blanco.
      component.alojamiento.set(detalleMock);

      expect(component.imagenEspacio({ ...espacioMock, imagenes: [] })).toBe('img1.jpg');
    });

    it('deberia caer al placeholder si no hay ninguna foto', () => {
      component.alojamiento.set({ ...detalleMock, imagenes: [] });

      expect(component.imagenEspacio({ ...espacioMock, imagenes: [] })).toBeTruthy();
    });
  });

  describe('requisitos de desparasitacion', () => {
    it('no deberia decir nada si el alojamiento no ha cargado', () => {
      component.alojamiento.set(null);

      expect(component.desparasitacionLabel()).toBe('');
    });

    it('no deberia decir nada si no exige ninguna', () => {
      component.alojamiento.set({
        ...detalleMock, requiereDesparasitacionInterna: false, requiereDesparasitacionExterna: false,
      });

      expect(component.desparasitacionLabel()).toBe('');
    });

    it('deberia nombrar solo la que exige', () => {
      component.alojamiento.set({
        ...detalleMock, requiereDesparasitacionInterna: true, requiereDesparasitacionExterna: false,
      });

      expect(component.desparasitacionLabel()).toBe('Interna');
    });

    it('deberia unir ambas cuando exige las dos', () => {
      component.alojamiento.set({
        ...detalleMock, requiereDesparasitacionInterna: true, requiereDesparasitacionExterna: true,
      });

      expect(component.desparasitacionLabel()).toBe('Interna y Externa');
    });
  });

  describe('seleccion de espacio', () => {
    it('deberia seleccionar y deseleccionar al pulsar dos veces', () => {
      component.seleccionarEspacio(espacioMock);
      expect(component.espacioSelec()?.id).toBe(espacioMock.id);

      component.seleccionarEspacio(espacioMock);
      expect(component.espacioSelec()).toBeNull();
    });

    it('deberia cambiar de espacio al pulsar otro distinto', () => {
      component.seleccionarEspacio(espacioMock);

      component.seleccionarEspacio({ ...espacioMock, id: 'otro' });

      expect(component.espacioSelec()?.id).toBe('otro');
    });

    it('no deberia navegar a reserva sin espacio elegido', () => {
      // Sin espacio no hay nada que reservar; el paso siguiente fallaría.
      const router = TestBed.inject(Router);
      const navigateSpy = jest.spyOn(router, 'navigate').mockResolvedValue(true);
      component.espacioSelec.set(null);

      component.irAReserva();

      expect(navigateSpy).not.toHaveBeenCalled();
    });
  });

  describe('compatibilidad por tamano', () => {
    const perroGrande = {
      _id: 'p1', nombre: 'Maya', tamano: 'grande', sociabilidadPerros: 'sociable',
    } as never;

    it('deberia admitir el tamano si hay un espacio sin limite declarado', () => {
      component.alojamiento.set({
        ...detalleMock, espacios: [{ ...espacioMock, tamanoMaxPerro: undefined }],
      });
      component.perroCompat.set(perroGrande);

      expect(component.compatibilidad().some((p) => p.includes('su tamaño'))).toBe(true);
    });

    it('no deberia prometer espacio si ninguno admite ese tamano', () => {
      component.alojamiento.set({
        ...detalleMock, espacios: [{ ...espacioMock, tamanoMaxPerro: 'mini' }],
      });
      component.perroCompat.set(perroGrande);

      expect(component.compatibilidad().some((p) => p.includes('su tamaño'))).toBe(false);
    });

    it('deberia admitir cualquier tamano si el alojamiento no declara espacios', () => {
      component.alojamiento.set({ ...detalleMock, espacios: [] });
      component.perroCompat.set(perroGrande);

      expect(component.compatibilidad().some((p) => p.includes('su tamaño'))).toBe(true);
    });

    it('deberia mencionar el temperamento declarado', () => {
      component.alojamiento.set(detalleMock);
      component.perroCompat.set({ ...perroGrande, temperamento: 'tranquilo' } as never);

      expect(component.compatibilidad()).toContain('Temperamento declarado: tranquilo');
    });
  });
  /**
   * La fila de miniaturas tiene cuatro huecos fijos, igual que en el resto de
   * fichas. Al generarlas a partir del contenido, un alojamiento con dos fotos
   * sacaba dos miniaturas de media pantalla cada una.
   */
  describe('miniaturas de la galeria', () => {
    const conFotos = (n: number) => {
      component.alojamiento.set({
        ...detalleMock,
        imagenes: Array.from({ length: n }, (_, i) => `f${i + 1}.jpg`),
      } as never);
    };

    it('deberia enseñarlas todas cuando caben', () => {
      conFotos(3);

      expect(component.miniaturas()).toEqual(['f1.jpg', 'f2.jpg', 'f3.jpg']);
      expect(component.fotosOcultas()).toBe(0);
    });

    it('deberia llenar los cuatro huecos justos', () => {
      conFotos(4);

      expect(component.miniaturas()).toHaveLength(4);
      expect(component.fotosOcultas()).toBe(0);
    });

    it('deberia dejar el ultimo hueco a la tarjeta de mas fotos', () => {
      // Tres miniaturas + la tarjeta: cuatro huecos, no cinco. Con una quinta
      // columna todas las miniaturas encogian.
      conFotos(9);

      expect(component.miniaturas()).toHaveLength(3);
      expect(component.fotosOcultas()).toBe(6);
    });

    it('deberia abrir la galeria por la primera foto que no se ve', () => {
      conFotos(9);

      expect(component.primeraFotoOculta()).toBe('f4.jpg');
    });

    it('no deberia romperse sin alojamiento cargado', () => {
      component.alojamiento.set(null);

      expect(component.miniaturas()).toEqual([]);
      expect(component.fotosOcultas()).toBe(0);
      expect(component.primeraFotoOculta()).toBe('');
    });
  });
});
