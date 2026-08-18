import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router, convertToParamMap } from '@angular/router';
import { RouterTestingModule } from '@angular/router/testing';
import { HttpClientTestingModule } from '@angular/common/http/testing';
import { VerticalDetalleComponent } from './vertical-detalle.component';
import { CatalogBrowseService, ServicioDetalle } from './catalog-browse.service';

describe('VerticalDetalleComponent', () => {
  let fixture: ComponentFixture<VerticalDetalleComponent>;
  let component: VerticalDetalleComponent;
  let browseService: jest.Mocked<CatalogBrowseService>;

  const servicio = (extra: Record<string, unknown>, overrides: Partial<ServicioDetalle> = {}): ServicioDetalle => ({
    id: 's1', nombre: 'DogVan Madrid', ciudad: 'Madrid', barrio: 'Centro', direccion: 'Calle Mayor 1',
    comercioId: 'c1', precioPorNoche: 25, score: 4.8, scoreLabel: 'Muy bueno', numResenas: 20,
    imagenes: ['a.jpg', 'b.jpg'], destacado: false, amenities: [], cancelacionGratis: false,
    descripcion: 'Un gran servicio para tu perro.', resenas: [], extra,
    ...overrides,
  });

  const crearComponente = async (
    vertical: string,
    resultado: ServicioDetalle | Error = servicio({}),
  ): Promise<void> => {
    browseService = {
      buscar: jest.fn(),
      obtener: resultado instanceof Error
        ? jest.fn().mockRejectedValue(resultado)
        : jest.fn().mockResolvedValue(resultado),
    } as any;

    await TestBed.configureTestingModule({
      imports: [VerticalDetalleComponent, RouterTestingModule, HttpClientTestingModule],
      providers: [
        { provide: CatalogBrowseService, useValue: browseService },
        {
          provide: ActivatedRoute,
          useValue: {
            snapshot: {
              data: { vertical },
              paramMap: convertToParamMap({ id: 's1' }),
              queryParamMap: convertToParamMap({}),
            },
          },
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(VerticalDetalleComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  };

  it('debería crear el componente y cargar el servicio por id', async () => {
    await crearComponente('transporte');

    expect(browseService.obtener).toHaveBeenCalledWith('s1');
    expect(component.servicio()?.nombre).toBe('DogVan Madrid');
    expect(component.cargando()).toBe(false);
  });

  it('debería mostrar el estado "no encontrado" si la API falla, sin inventar datos', async () => {
    await crearComponente('transporte', new Error('404'));

    expect(component.servicio()).toBeNull();
    const el: HTMLElement = fixture.nativeElement;
    expect(el.textContent).toContain('No se pudo cargar esta ficha');
  });

  it('transporte: debería listar puntos reales del vehículo sin inventar experiencia', async () => {
    await crearComponente('transporte', servicio({
      tipoVehiculo: 'van_acondicionada', jaulasIncluidas: true, acompananteHumano: true,
      zonaCobertura: ['Madrid', 'Getafe'],
    }));

    const puntos = component.cfg().puntos(component.servicio()!);
    expect(puntos).toContain('Van acondicionada');
    expect(puntos).toContain('Jaulas homologadas incluidas');
    expect(puntos).toContain('Puedes acompañar a tu perro en el trayecto');
    expect(puntos.some((p) => p.includes('trayectos realizados'))).toBe(false);
  });

  it('adiestramiento: debería mostrar especialidades como chips y describir la modalidad', async () => {
    await crearComponente('adiestramiento', servicio({
      tiposAdiestramiento: ['Obediencia', 'Cachorros'], modalidad: 'programa', edadMinimaMeses: 3,
    }));

    expect(component.cfg().chips(component.servicio()!)).toEqual(['Obediencia', 'Cachorros']);
    expect(component.cfg().puntos(component.servicio()!)).toContain('Programa completo de varias sesiones');
  });

  it('hoteles: debería anunciar ventajas reales del hotel', async () => {
    await crearComponente('hoteles', servicio(
      { admiteMascotas: true, maxMascotasPorReserva: 2, serviciosPetfriendly: ['Cama para perro'] },
      { cancelacionGratis: true },
    ));

    const puntos = component.cfg().puntos(component.servicio()!);
    expect(puntos).toContain('Admite mascotas en la habitación');
    expect(puntos).toContain('Hasta 2 mascota(s) por reserva');
    expect(puntos).toContain('Cancelación gratuita');
    expect(component.cfg().chips(component.servicio()!)).toEqual(['Cama para perro']);
  });

  it('debería cambiar la imagen activa de la galería al pulsar una miniatura', async () => {
    await crearComponente('transporte');

    expect(component.imagenActiva()).toBe('a.jpg');
    component.imagenActiva.set('b.jpg');
    expect(component.imagenActiva()).toBe('b.jpg');
  });

  it('debería navegar al wizard de reserva con los datos del servicio', async () => {
    await crearComponente('transporte', servicio({ tarifaBase: 25 }));
    const router = TestBed.inject(Router);
    const navigateSpy = jest.spyOn(router, 'navigate').mockResolvedValue(true);

    component.solicitar(component.servicio()!);

    expect(navigateSpy).toHaveBeenCalledWith(
      ['/reservas', 'transporte', 's1'],
      expect.objectContaining({
        queryParams: expect.objectContaining({ comercioId: 'c1', nombre: 'DogVan Madrid', precioBase: 25 }),
      }),
    );
  });

  it('debería caer a transporte si el vertical de la ruta es desconocido', async () => {
    await crearComponente('inventado');

    expect(component.ui.key).toBeTruthy();
    expect(component.cfg().vertical).toBe('transporte');
  });

  describe('galería a pantalla completa (HU-4.1.1)', () => {
    it('debería mostrar el contador de fotografías sobre la galería', async () => {
      await crearComponente('transporte');

      const html: string = fixture.nativeElement.innerHTML;
      expect(html).toContain('2 fotografías');
    });

    it('debería abrir el lightbox con la foto pulsada', async () => {
      await crearComponente('transporte');

      component.abrirLightbox('b.jpg');

      expect(component.lightboxAbierto()).toBe(true);
      expect(component.lightboxIndice()).toBe(1);
    });

    it('debería navegar circularmente entre fotos y cerrar', async () => {
      await crearComponente('transporte');
      component.abrirLightbox('b.jpg');

      component.siguienteFoto();
      expect(component.lightboxImagen()).toBe('a.jpg');

      component.cerrarLightbox();
      expect(component.lightboxAbierto()).toBe(false);
    });
  });
  /**
   * Cada vertical arma su lista de "que incluye" con los campos que el comercio
   * haya rellenado. Un `if` de mas convierte un campo vacio en una promesa al
   * cliente que el negocio no ha hecho.
   */
  describe('puntos destacados por vertical', () => {
    const puntos = (): string[] => component.cfg().puntos(component.servicio()!);

    describe('transporte', () => {
      it('no deberia prometer nada que el comercio no haya marcado', async () => {
        await crearComponente('transporte', servicio({}));

        expect(puntos()).toEqual([]);
      });

      it('deberia traducir el tipo de vehiculo conocido', async () => {
        await crearComponente('transporte', servicio({ tipoVehiculo: 'van_acondicionada' }));

        expect(puntos()).toContain('Van acondicionada');
      });

      it('deberia dejar en crudo un vehiculo desconocido en vez de omitirlo', async () => {
        await crearComponente('transporte', servicio({ tipoVehiculo: 'nave' }));

        expect(puntos()).toContain('nave');
      });

      it('deberia listar las ventajas marcadas', async () => {
        await crearComponente('transporte', servicio({
          jaulasIncluidas: true, acompananteHumano: true, soloPerros: true,
          aceptaPPP: true, requisitoVacunas: true,
        }));

        expect(puntos()).toHaveLength(5);
      });

      it('deberia recortar la zona de cobertura a cuatro poblaciones', async () => {
        // La ficha no es un listado de municipios: con cuatro se entiende.
        await crearComponente('transporte', servicio({
          zonaCobertura: ['Madrid', 'Toledo', 'Segovia', 'Ávila', 'Cuenca'],
        }));

        const cobertura = puntos().find((p) => p.startsWith('Cubre'))!;
        expect(cobertura).toContain('Ávila');
        expect(cobertura).not.toContain('Cuenca');
      });

      it('no deberia decir "Cubre" con la zona vacia', async () => {
        await crearComponente('transporte', servicio({ zonaCobertura: [] }));

        expect(puntos().some((p) => p.startsWith('Cubre'))).toBe(false);
      });

      it('deberia usar la tarifa base como precio', async () => {
        await crearComponente('transporte', servicio({ tarifaBase: 15 }));

        expect(component.cfg().price(component.servicio()!)).toBe(15);
      });

      it('deberia caer al precio por noche si no hay tarifa base', async () => {
        await crearComponente('transporte', servicio({}));

        expect(component.cfg().price(component.servicio()!)).toBe(25);
      });
    });

    describe('adiestramiento', () => {
      it('deberia anunciar el programa completo', async () => {
        await crearComponente('adiestramiento', servicio({ modalidad: 'programa' }));

        expect(puntos()[0]).toContain('Programa completo');
      });

      it('deberia anunciar sesion individual por defecto', async () => {
        await crearComponente('adiestramiento', servicio({ modalidad: 'sesion' }));

        expect(puntos()[0]).toContain('Sesión individual');
      });

      it('deberia admitir edad minima de 0 meses como dato valido', async () => {
        // Con un `if (edadMin)` el 0 se perderia y no se diria que acepta recien
        // nacidos, que es justo lo que diferencia a ese adiestrador.
        await crearComponente('adiestramiento', servicio({ edadMinimaMeses: 0 }));

        expect(puntos().some((p) => p.includes('desde 0 meses'))).toBe(true);
      });

      it('deberia concordar el singular con un perro por sesion', async () => {
        await crearComponente('adiestramiento', servicio({ capacidadPorSesion: 1 }));

        expect(puntos().some((p) => p.includes('1 perro por sesión'))).toBe(true);
      });

      it('deberia concordar el plural con varios perros por sesion', async () => {
        await crearComponente('adiestramiento', servicio({ capacidadPorSesion: 6 }));

        expect(puntos().some((p) => p.includes('6 perros por sesión'))).toBe(true);
      });

      it('deberia anunciar el servicio a domicilio', async () => {
        await crearComponente('adiestramiento', servicio({ aDomicilio: true }));

        expect(puntos()).toContain('Disponible a domicilio');
      });

      it('deberia usar el precio por sesion cuando existe', async () => {
        await crearComponente('adiestramiento', servicio({ precioSesion: 40 }));

        expect(component.cfg().price(component.servicio()!)).toBe(40);
      });

      it('deberia listar los tipos de adiestramiento como chips', async () => {
        await crearComponente('adiestramiento', servicio({ tiposAdiestramiento: ['obediencia'] }));

        expect(component.cfg().chips(component.servicio()!)).toEqual(['obediencia']);
      });
    });

    describe('hoteles', () => {
      it('deberia dar por hecho que admite mascotas si no se dice lo contrario', async () => {
        await crearComponente('hoteles', servicio({}));

        expect(puntos()).toContain('Admite mascotas en la habitación');
      });

      it('no deberia anunciarlo si el hotel lo desmarca explicitamente', async () => {
        await crearComponente('hoteles', servicio({ admiteMascotas: false }));

        expect(puntos()).not.toContain('Admite mascotas en la habitación');
      });

      it('deberia anunciar los limites de peso y numero de mascotas', async () => {
        await crearComponente('hoteles', servicio({ pesoMaximoMascotaKg: 20, maxMascotasPorReserva: 2 }));

        expect(puntos().some((p) => p.includes('20 kg'))).toBe(true);
        expect(puntos().some((p) => p.includes('2 mascota'))).toBe(true);
      });

      it('deberia anunciar la cancelacion gratuita cuando la ofrece', async () => {
        await crearComponente('hoteles', servicio({}, { cancelacionGratis: true }));

        expect(puntos()).toContain('Cancelación gratuita');
      });

      it('no deberia anunciarla si el hotel no la ofrece', async () => {
        await crearComponente('hoteles', servicio({}, { cancelacionGratis: false }));

        expect(puntos()).not.toContain('Cancelación gratuita');
      });
    });
  });

  describe('galeria de fotos', () => {
    it('deberia avanzar y retroceder en bucle', async () => {
      await crearComponente('transporte');

      component.abrirLightbox('a.jpg');
      component.siguienteFoto();
      expect(component.lightboxImagen()).toBe('b.jpg');

      component.siguienteFoto();
      // Vuelve a la primera: la galeria es circular.
      expect(component.lightboxImagen()).toBe('a.jpg');

      component.fotoAnterior();
      expect(component.lightboxImagen()).toBe('b.jpg');
    });

    it('no deberia romperse si el servicio no tiene fotos', async () => {
      await crearComponente('transporte', servicio({}, { imagenes: [] }));

      expect(() => component.siguienteFoto()).not.toThrow();
      expect(() => component.fotoAnterior()).not.toThrow();
    });

    it('deberia cerrar el visor', async () => {
      await crearComponente('transporte');
      component.abrirLightbox('a.jpg');

      component.cerrarLightbox();

      expect(component.lightboxAbierto()).toBe(false);
    });
  });
});
