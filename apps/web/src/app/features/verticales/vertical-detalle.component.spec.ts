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
});
