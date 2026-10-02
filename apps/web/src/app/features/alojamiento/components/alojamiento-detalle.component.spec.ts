import { ComponentFixture, TestBed } from '@angular/core/testing';
import { HttpClientTestingModule } from '@angular/common/http/testing';
import { RouterTestingModule } from '@angular/router/testing';
import { ActivatedRoute, Params, Router, convertToParamMap } from '@angular/router';
import { of } from 'rxjs';
import { AlojamientoDetalleComponent } from './alojamiento-detalle.component';
import { AlojamientoService, AlojamientoDetalle, Espacio } from '../services/alojamiento.service';
import { PerrosService, PerroApi } from '../../perros/perros.service';

// jsdom no implementa scrollIntoView; lo usa irAEspacios() de la barra fija de móvil.
if (!Element.prototype.scrollIntoView) {
  Element.prototype.scrollIntoView = jest.fn();
}

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
    compatibilidadSocialNoAdmitida: [],
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
    it('debería agrupar las políticas en Horario, Cancelación y Vacunas', async () => {
      fixture.detectChanges();
      await fixture.whenStable();
      fixture.detectChanges();

      const acordeones: HTMLElement[] = Array.from(fixture.nativeElement.querySelectorAll('.policy-acc'));
      const titulos = acordeones.map((a) => a.querySelector('summary')?.textContent?.trim() ?? '');

      expect(titulos).toEqual([
        'Horario de entrada y salida',
        'Cancelación',
        'Vacunas y requisitos sanitarios',
      ]);
    });

    it('debería dejar el horario abierto y el resto plegadas al llegar', async () => {
      fixture.detectChanges();
      await fixture.whenStable();
      fixture.detectChanges();

      const acordeones: HTMLDetailsElement[] =
        Array.from(fixture.nativeElement.querySelectorAll('.policy-acc'));

      expect(acordeones.map((a) => a.open)).toEqual([true, false, false]);
    });

    /**
     * Entrada y salida son las dos mitades del mismo dato. En acordeones
     * separados había que abrir el de abajo para saber la otra mitad, y salía
     * plegado.
     */
    it('debería enseñar la entrada y la salida en la misma tarjeta', async () => {
      fixture.detectChanges();
      await fixture.whenStable();
      fixture.detectChanges();

      const tarjetas: HTMLElement[] = Array.from(fixture.nativeElement.querySelectorAll('details.policy-acc'));
      const conHoras = tarjetas.filter((t) => t.textContent?.includes('10:00') || t.textContent?.includes('19:00'));

      expect(conHoras).toHaveLength(1);
      expect(conHoras[0].textContent).toContain('Entrada');
      expect(conHoras[0].textContent).toContain('Salida');
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

  /*
   * Barra fija de móvil (HU: la acción de reservar quedaba fuera de la
   * pantalla hasta bajar toda la ficha). Se prueba por comportamiento, no por
   * maquetación: qué hace el botón según haya o no un espacio elegido.
   */
  describe('barra fija de reserva en móvil', () => {
    it('debería llevar a la lista de espacios cuando aún no hay ninguno elegido', async () => {
      fixture.detectChanges();
      await fixture.whenStable();
      const espacios = document.createElement('div');
      espacios.id = 'espacios';
      document.body.appendChild(espacios);
      const scrollSpy = jest.spyOn(espacios, 'scrollIntoView').mockImplementation(() => {});

      component.irAEspacios();

      expect(scrollSpy).toHaveBeenCalledWith({ behavior: 'smooth', block: 'start' });
      espacios.remove();
    });

    it('no debería fallar si el ancla de espacios no está en el DOM', async () => {
      fixture.detectChanges();
      await fixture.whenStable();

      expect(() => component.irAEspacios()).not.toThrow();
    });

    /*
     * La barra dice siempre "Reservar", con espacio elegido y sin él: la ficha
     * promete una sola acción y renombrarla a mitad de camino hacía dudar de si
     * eran dos cosas distintas. Lo que cambia es a dónde lleva, no cómo se
     * llama, y eso es lo que se vigila aquí.
     */
    it('debería llamar "Reservar" a la acción haya espacio elegido o no', async () => {
      fixture.detectChanges();
      await fixture.whenStable();
      fixture.detectChanges();

      const barra = () => fixture.nativeElement.querySelector('.mobile-cta');
      expect(barra().textContent).toContain('Reservar');

      component.seleccionarEspacio(espacioMock);
      fixture.detectChanges();

      expect(barra().textContent).toContain('Reservar');
    });

    it('debería llevar a elegir espacio mientras no haya ninguno', async () => {
      fixture.detectChanges();
      await fixture.whenStable();
      fixture.detectChanges();
      const irA = jest.spyOn(component, 'irAEspacios');

      fixture.nativeElement.querySelector('.mobile-cta .rs-btn').click();

      expect(irA).toHaveBeenCalled();
    });

    it('debería mostrar el precio del espacio en cuanto se elige uno', async () => {
      fixture.detectChanges();
      await fixture.whenStable();

      component.seleccionarEspacio(espacioMock);
      fixture.detectChanges();

      expect(fixture.nativeElement.querySelector('.mobile-cta__precio').textContent)
        .toContain(String(espacioMock.precioNoche));
    });

    it('el botón "Reservar" de la barra fija debería navegar con el espacio elegido', async () => {
      fixture.detectChanges();
      await fixture.whenStable();
      const router = TestBed.inject(Router);
      const navigateSpy = jest.spyOn(router, 'navigate').mockResolvedValue(true);
      component.seleccionarEspacio(espacioMock);
      fixture.detectChanges();

      const boton = [...fixture.nativeElement.querySelectorAll('.mobile-cta .rs-btn')]
        .find((b: HTMLElement) => b.textContent?.trim() === 'Reservar') as HTMLElement;
      boton.click();

      expect(navigateSpy).toHaveBeenCalledWith(
        ['/reservas', 'alojamiento', 'a1'],
        expect.objectContaining({ queryParams: expect.objectContaining({ espacioId: 'e1' }) }),
      );
    });
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
      component.alojamiento.set({ ...detalleMock, compatibilidadSocialNoAdmitida: [] });
      component.perroCompat.set(perroMock);

      expect(component.compatibilidad()).toContain('Perfil social admitido para perros sociable');
    });

    it('no inventa compatibilidad social si el centro excluye algún perfil', () => {
      component.alojamiento.set({ ...detalleMock, compatibilidadSocialNoAdmitida: ['individual'] });
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

  it('debería ir directo a reservar el espacio pulsado, sin el precio en la URL', async () => {
    fixture.detectChanges();
    await fixture.whenStable();
    const router = TestBed.inject(Router);
    const navigateSpy = jest.spyOn(router, 'navigate').mockResolvedValue(true);

    component.reservarEspacio(espacioMock);

    expect(component.espacioSelec()).toEqual(espacioMock);
    expect(navigateSpy).toHaveBeenCalledWith(
      ['/reservas', 'alojamiento', 'a1'],
      expect.objectContaining({
        queryParams: expect.objectContaining({ espacioId: 'e1' }),
      }),
    );
    // El precio lo pide el asistente al API: uno en la URL se podría editar.
    const [, extras] = navigateSpy.mock.calls[0] as [unknown, { queryParams: Record<string, unknown> }];
    expect(extras.queryParams).not.toHaveProperty('precioBase');
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
   * La fila de miniaturas tiene seis huecos fijos, igual que en el resto de
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

    it('deberia llenar los seis huecos justos', () => {
      conFotos(6);

      expect(component.miniaturas()).toHaveLength(6);
      expect(component.fotosOcultas()).toBe(0);
    });

    it('deberia dejar el ultimo hueco a la tarjeta de mas fotos', () => {
      // Cinco miniaturas + la tarjeta: seis huecos, no siete. Con una columna
      // de mas todas las miniaturas encogian.
      conFotos(9);

      expect(component.miniaturas()).toHaveLength(5);
      expect(component.fotosOcultas()).toBe(4);
    });

    it('deberia abrir la galeria por la primera foto que no se ve', () => {
      conFotos(9);

      expect(component.primeraFotoOculta()).toBe('f6.jpg');
    });

    it('no deberia romperse sin alojamiento cargado', () => {
      component.alojamiento.set(null);

      expect(component.miniaturas()).toEqual([]);
      expect(component.fotosOcultas()).toBe(0);
      expect(component.primeraFotoOculta()).toBe('');
    });
  });

  /**
   * El mosaico de la cabecera: una foto grande y dos apiladas al costado, como
   * en Booking. Con una sola panorámica arriba se enseñaba una foto de siete.
   */
  describe('mosaico de la galeria', () => {
    const conFotos = (n: number) => {
      component.alojamiento.set({
        ...detalleMock,
        imagenes: Array.from({ length: n }, (_, i) => `f${i + 1}.jpg`),
      } as never);
    };

    it('deberia acompañar la grande con las dos siguientes', () => {
      conFotos(5);
      component.imagenActiva.set('f1.jpg');

      expect(component.secundarias()).toEqual(['f2.jpg', 'f3.jpg']);
    });

    it('deberia seguir la foto que el visitante eligio', () => {
      conFotos(5);
      component.imagenActiva.set('f3.jpg');

      expect(component.secundarias()).toEqual(['f4.jpg', 'f5.jpg']);
    });

    it('deberia dar la vuelta al llegar al final, para no dejar el costado a medias', () => {
      conFotos(4);
      component.imagenActiva.set('f4.jpg');

      expect(component.secundarias()).toEqual(['f1.jpg', 'f2.jpg']);
    });

    it('no deberia repetir la foto grande cuando solo hay dos', () => {
      conFotos(2);
      component.imagenActiva.set('f1.jpg');

      expect(component.secundarias()).toEqual(['f2.jpg']);
    });

    it('deberia dejar la grande sola con una unica foto', () => {
      // Sin columna que enseñar, la foto ocupa todo el ancho.
      conFotos(1);
      component.imagenActiva.set('f1.jpg');

      expect(component.secundarias()).toEqual([]);
    });

    it('no deberia romperse sin alojamiento cargado', () => {
      component.alojamiento.set(null);

      expect(component.secundarias()).toEqual([]);
    });
  });

  /*
   * La ficha tiene que poder reservarse desde la primera pantalla. Antes el
   * botón del panel se quedaba gris ("Selecciona un espacio") hasta bajar a la
   * lista, que está a media página: la única acción de la pantalla no se podía
   * pulsar. Y la garantía —ocho líneas idénticas en toda la web— se daba dos
   * veces: encima del contenido y otra vez en el panel.
   */
  describe('panel de reserva', () => {
    const montar = async (detalle = detalleMock): Promise<HTMLElement> => {
      alojamientoService.obtener.mockResolvedValue(detalle);
      fixture.detectChanges();
      await fixture.whenStable();
      fixture.detectChanges();
      return fixture.nativeElement as HTMLElement;
    };

    it('debería llevar a elegir espacio en vez de dejar el botón muerto', async () => {
      const el = await montar();
      const boton = el.querySelector<HTMLButtonElement>('.booking-panel__card .rs-btn--gold')!;

      expect(boton.disabled).toBe(false);
      expect(boton.textContent).toContain('Reservar');

      const irA = jest.spyOn(component, 'irAEspacios');
      boton.click();
      expect(irA).toHaveBeenCalled();
    });

    it('debería pasar a reservar en cuanto hay un espacio elegido', async () => {
      const el = await montar();
      component.seleccionarEspacio(espacioMock);
      fixture.detectChanges();

      expect(el.querySelector('.booking-panel__card .rs-btn--gold')!.textContent).toContain('Reservar');
    });

    it('debería dar la garantía una sola vez, y no por duplicado arriba', async () => {
      const el = await montar();

      expect(el.querySelectorAll('rs-trust-block')).toHaveLength(1);
    });

    /* El aviso de urgencia sale del dato del comercio, nunca de un número
       inventado: uno falso es lo que hace que no se crea el siguiente. */
    it('debería avisar de los últimos espacios sólo cuando de verdad quedan pocos', async () => {
      await montar({ ...detalleMock, espaciosDisponibles: 2 });
      expect(component.avisoUltimosEspacios()).toBe('Quedan 2 espacios libres');

      // Ids distintos: `seleccionarEspacio` alterna cuando se repite el mismo.
      component.seleccionarEspacio({ ...espacioMock, id: 'e-uno', cantidad: 1 });
      expect(component.avisoUltimosEspacios()).toBe('Queda 1 espacio de este tipo');

      component.seleccionarEspacio({ ...espacioMock, id: 'e-muchos', cantidad: 9 });
      expect(component.avisoUltimosEspacios()).toBeNull();
    });
  });

  describe('reparto de la pantalla', () => {
    it('debería dejar la galería dentro de la columna, con el panel a su derecha', async () => {
      fixture.detectChanges();
      await fixture.whenStable();
      fixture.detectChanges();
      const el = fixture.nativeElement as HTMLElement;

      // Dentro de la columna: así queda alineada con el contenido de debajo y
      // el hueco de la derecha lo ocupa el panel desde la primera pantalla.
      expect(el.querySelector('.info-col .gallery')).not.toBeNull();
      // Y el titular, delante de las fotos.
      const columna = el.querySelector('.info-col')!;
      const orden = Array.from(columna.children).map((n) => n.className);
      expect(orden.findIndex((c) => c.includes('info-header')))
        .toBeLessThan(orden.findIndex((c) => c.includes('gallery')));
    });

    it('no debería dejar el hueco del mosaico cuando el alojamiento no tiene fotos', async () => {
      alojamientoService.obtener.mockResolvedValue({ ...detalleMock, imagenes: [] });
      fixture.detectChanges();
      await fixture.whenStable();
      fixture.detectChanges();

      expect((fixture.nativeElement as HTMLElement).querySelector('.gallery')).toBeNull();
    });
  });
});

describe('AlojamientoDetalleComponent con búsqueda en la URL', () => {
  let alojamientoService: jest.Mocked<Pick<AlojamientoService, 'obtener'>>;
  let perrosService: jest.Mocked<Pick<PerrosService, 'obtener' | 'bienestar'>>;
  let navigateSpy: jest.SpyInstance;

  const base: AlojamientoDetalle = {
    id: 'a1', nombre: 'Royal Paws Retreat', ciudad: 'Madrid', barrio: 'Pozuelo',
    direccion: 'Camino de la Dehesa 12', score: 0, scoreLabel: '', numResenas: 0,
    precioPorNoche: 0, imagenes: [], amenities: [], cancelacionGratis: false,
    paseosIncluidos: false, espaciosDisponibles: 0, destacado: false, descripcion: '',
    politicaCancelacion: '', checkIn: '10:00', checkOut: '19:00', requisitoVacunas: false,
    camaras24h: false, espacios: [], resenas: [], reglas: [], comercioId: 'c1',
    compatibilidadSocialNoAdmitida: [], requisitoMicrochip: false,
    requiereDesparasitacionInterna: false, requiereDesparasitacionExterna: false,
    requiereVacunaTosPerreras: false, serviciosAdicionales: [],
  };

  const espacio: Espacio = {
    id: 'e1', tipo: 'suite', descripcion: '', tamanoMaxPerro: 'grande', precioNoche: 45,
    cantidad: 1, disponible: true, amenities: [], imagenes: [], cancelacionGratis: true,
  };

  const conGuarderia = (guarderia: Record<string, unknown>): AlojamientoDetalle => ({
    ...base, extra: { modalidades: ['guarderia'], guarderia },
  });

  async function crear(
    id: string,
    query: Params,
    detalle: AlojamientoDetalle = base,
  ): Promise<AlojamientoDetalleComponent> {
    alojamientoService = { obtener: jest.fn().mockResolvedValue(detalle) };
    perrosService = {
      obtener: jest.fn().mockResolvedValue(null),
      bienestar: jest.fn().mockResolvedValue(null),
    };
    await TestBed.configureTestingModule({
      imports: [AlojamientoDetalleComponent, RouterTestingModule, HttpClientTestingModule],
      providers: [
        { provide: AlojamientoService, useValue: alojamientoService },
        { provide: PerrosService, useValue: perrosService },
        {
          provide: ActivatedRoute,
          useValue: {
            snapshot: { paramMap: convertToParamMap({ id }), queryParamMap: convertToParamMap(query) },
            paramMap: of(convertToParamMap({ id })),
            queryParamMap: of(convertToParamMap(query)),
            queryParams: of(query),
          },
        },
      ],
    }).compileComponents();
    navigateSpy = jest.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
    const fixture = TestBed.createComponent(AlojamientoDetalleComponent);
    const component = fixture.componentInstance;
    component.ngOnInit();
    await fixture.whenStable();
    return component;
  }

  it('debería pasar al asistente las fechas, perros y mascota de la búsqueda', async () => {
    const component = await crear('a1', {
      desde: '2026-10-10', hasta: '2026-10-12', perros: '2', perroId: 'p1',
    }, { ...base, imagenes: ['foto.jpg'] });

    // Sin mascota disponible el bloque se omite en vez de inventarse.
    expect(perrosService.obtener).toHaveBeenCalledWith('p1');
    expect(component.perroCompat()).toBeNull();
    expect(component.bienestarPerro()).toBeNull();

    component.reservarEspacio(espacio);
    expect(navigateSpy).toHaveBeenCalledWith(['/reservas', 'alojamiento', 'a1'], {
      queryParams: expect.objectContaining({
        espacioId: 'e1', imagen: 'foto.jpg', checkIn: '2026-10-10', checkOut: '2026-10-12',
        perros: '2', perroId: 'p1',
      }),
    });
  });

  it('debería llevar a la URL legible si se entra por el id', async () => {
    await crear('a1', {}, { ...base, slug: 'royal-paws' });
    expect(navigateSpy).toHaveBeenCalledWith(
      ['/alojamiento', 'royal-paws'],
      expect.objectContaining({ replaceUrl: true }),
    );
  });

  it('no debería consultar la mascota si no se eligió ninguna', async () => {
    const component = await crear('a1', {});
    expect(perrosService.obtener).not.toHaveBeenCalled();
    component.reservarEspacio(espacio);
    const [, extras] = navigateSpy.mock.calls[0] as [unknown, { queryParams: Record<string, unknown> }];
    expect(extras.queryParams['imagen']).toBe('');
    expect(extras.queryParams['checkIn']).toBeUndefined();
  });

  it('debería cargar la ficha con fotos relativas y coordenadas sin romper', async () => {
    const component = await crear('royal-paws', {}, {
      ...base, slug: 'royal-paws', descripcion: 'Descripción propia', precioPorNoche: 30,
      imagenes: ['https://cdn/x.jpg', '/rel.jpg', 'sin-barra.jpg'], lat: 40.4, lng: -3.7,
    });
    expect(component.alojamiento()?.id).toBe('a1');
    expect(navigateSpy).not.toHaveBeenCalled();
    expect(component.lineaDireccion()).toContain('Madrid');
    expect(component.ubicacion()).toEqual(expect.objectContaining({ lat: 40.4, lng: -3.7 }));
  });

  describe('guardería de día', () => {
    it('debería listar los tramos con precio, su horario y el precio desde', async () => {
      const component = await crear('a1', { desde: '2026-10-10', perros: '1', perroId: 'p1' }, conGuarderia({
        precioHora: 5, precioMediaJornada: 15, precioDiaCompleto: 25, plazasPorDia: 4,
        apertura: '08:00', cierre: '20:00',
      }));

      expect(component.ofreceGuarderiaFicha()).toBe(true);
      expect(component.ofreceResidenciaFicha()).toBe(false);
      expect(component.horarioGuarderia()).toBe('08:00 – 20:00');
      expect(component.desdeGuarderia()).toBe(5);
      const tramos = component.tramosGuarderia();
      expect(tramos.map((t) => [t.precio, t.unidad])).toEqual([
        [5, 'por hora y perro'], [15, 'por perro'], [25, 'por perro'],
      ]);

      component.irAReservaGuarderia(tramos[1].tramo);
      expect(navigateSpy).toHaveBeenCalledWith(['/reservas', 'alojamiento', 'a1'], {
        queryParams: expect.objectContaining({
          modalidad: 'guarderia', tramo: 'media_jornada', checkIn: '2026-10-10', perros: '1', perroId: 'p1',
        }),
      });
    });

    it('debería omitir los tramos sin precio y el horario incompleto', async () => {
      const component = await crear('a1', {}, conGuarderia({ precioDiaCompleto: 20, plazasPorDia: 2, apertura: '08:00' }));

      expect(component.tramosGuarderia().map((t) => t.precio)).toEqual([20]);
      expect(component.horarioGuarderia()).toBeNull();

      component.irAReservaGuarderia();
      const [, extras] = navigateSpy.mock.calls[0] as [unknown, { queryParams: Record<string, unknown> }];
      expect(extras.queryParams['tramo']).toBeUndefined();
      expect(extras.queryParams['checkIn']).toBeUndefined();
      expect(extras.queryParams['imagen']).toBe('');
    });

    it('no debería ofrecer guardería sin configuración aunque la modalidad esté marcada', async () => {
      const component = await crear('a1', {}, { ...base, extra: { modalidades: ['guarderia'] } });
      expect(component.ofreceGuarderiaFicha()).toBe(false);
      expect(component.tramosGuarderia()).toEqual([]);
      expect(component.desdeGuarderia()).toBeUndefined();
    });

    it('no debería navegar a la guardería sin alojamiento cargado', async () => {
      const component = await crear('a1', {});
      component.alojamiento.set(null);
      component.irAReservaGuarderia();
      expect(navigateSpy).not.toHaveBeenCalled();
    });
  });

  describe('sin alojamiento cargado', () => {
    it('debería dejar la dirección vacía y las fotos quietas', async () => {
      const component = await crear('a1', {});
      component.alojamiento.set(null);

      expect(component.lineaDireccion()).toBe('');
      expect(component.lightboxIndice()).toBe(0);
      component.siguienteFoto();
      component.fotoAnterior();
      expect(component.lightboxImagen()).toBe('');
      expect(component.ratingItems()).toEqual([]);
      expect(component.avisoUltimosEspacios()).toBeNull();
      expect(component.compatibilidad()).toEqual([]);
    });

    it('debería empezar por la primera foto si la del lightbox ya no existe', async () => {
      const component = await crear('a1', {}, { ...base, imagenes: ['a.jpg', 'b.jpg'] });
      component.abrirLightbox('desaparecida.jpg');
      expect(component.lightboxIndice()).toBe(0);
      component.siguienteFoto();
      expect(component.lightboxImagen()).toBe('b.jpg');
    });
  });

  describe('avisos y etiquetas', () => {
    it('debería avisar del último espacio elegido y de varios libres', async () => {
      const component = await crear('a1', {}, { ...base, espaciosDisponibles: 2 });
      expect(component.avisoUltimosEspacios()).toBe('Quedan 2 espacios libres');

      component.seleccionarEspacio({ ...espacio, cantidad: 1 });
      expect(component.avisoUltimosEspacios()).toBe('Queda 1 espacio de este tipo');
      component.seleccionarEspacio({ ...espacio, id: 'e2', cantidad: 2 });
      expect(component.avisoUltimosEspacios()).toBe('Quedan 2 espacios de este tipo');
    });

    it('debería traducir el perfil social conocido y dejar el desconocido en crudo', async () => {
      const component = await crear('a1', {});
      expect(component.etiquetaPerfilSocial('solo_machos')).toBe('Solo con machos');
      expect(component.etiquetaPerfilSocial('raro')).toBe('raro');
    });

    it('debería añadir paseos y cámaras al bloque de confianza', async () => {
      const component = await crear('a1', {}, { ...base, paseosIncluidos: true, camaras24h: true });
      expect(component.extrasTrust().map((t) => t.icon)).toEqual(['bone', 'video']);
    });

    it('debería admitir cualquier perfil social si el perro no lo declara', async () => {
      const component = await crear('a1', {});
      const perro = {
        _id: 'p1', nombre: 'Maya', fotos: [], especie: 'perro', esMestizo: false,
        esterilizado: true, tipoPelo: [], vacunas: [], alergias: [], enfermedades: [],
        medicacion: [], puedeQuedarseSolo: true, ansiedadSeparacion: false, miedos: [],
        seMarea: false, requiereTransportin: false, autorizaCompartirHistorial: true,
      } as PerroApi;
      component.perroCompat.set(perro);
      expect(component.compatibilidad()).toEqual(['Perfil social admitido para perros de cualquier tipo']);
    });
  });
});
