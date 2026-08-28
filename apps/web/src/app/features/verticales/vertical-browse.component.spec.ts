import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router, convertToParamMap } from '@angular/router';
import { RouterTestingModule } from '@angular/router/testing';
import { HttpClientTestingModule } from '@angular/common/http/testing';
import { of } from 'rxjs';
import { VerticalBrowseComponent } from './vertical-browse.component';
import { CatalogBrowseService, ServicioCard } from './catalog-browse.service';

describe('VerticalBrowseComponent', () => {
  let fixture: ComponentFixture<VerticalBrowseComponent>;
  let component: VerticalBrowseComponent;
  let browseService: jest.Mocked<CatalogBrowseService>;

  const tarjeta = (extra: Record<string, unknown>): ServicioCard => ({
    id: 's1', nombre: 'Servicio Demo', ciudad: 'Madrid', comercioId: 'c1',
    precioPorNoche: 20, score: 4.5, scoreLabel: 'Muy bueno', numResenas: 10,
    imagenes: [], destacado: false, extra,
  });

  const crearComponente = async (
    vertical: string,
    queryParams: Record<string, string> = {},
  ): Promise<void> => {
    // El listado unificado pagina, pide facetas y pinta el mapa: el doble tiene
    // que responder a los tres, o `cargar()` se corta antes de buscar.
    browseService = {
      buscarPaginado: jest.fn().mockResolvedValue({ items: [], total: 0, page: 1, totalPages: 1 }),
      facetas: jest.fn().mockResolvedValue({ amenities: [], precios: [], valoracion: [] }),
      puntosMapa: jest.fn().mockResolvedValue([]),
    } as any;

    await TestBed.configureTestingModule({
      imports: [VerticalBrowseComponent, RouterTestingModule, HttpClientTestingModule],
      providers: [
        { provide: CatalogBrowseService, useValue: browseService },
        {
          provide: ActivatedRoute,
          useValue: {
            snapshot: { data: { vertical }, queryParamMap: convertToParamMap(queryParams) },
            queryParams: of(queryParams),
          },
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(VerticalBrowseComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  };

  it('debería crear el componente', async () => {
    await crearComponente('veterinaria');
    expect(component).toBeTruthy();
  });

  it('veterinaria: debería leer especialidades[] y serviciosClinicos[] reales (no placeholders)', async () => {
    await crearComponente('veterinaria');
    const c = tarjeta({
      especialidades: ['Dermatología'],
      serviciosClinicos: [{ nombre: 'Vacunación', precio: 20 }, { nombre: 'Cirugía', precio: 90 }],
      atiendeUrgencias: true,
      precioConsulta: 35,
    });

    expect(component.cfg().badge(c)).toBe('Dermatología');
    expect(component.cfg().meta(c)).toEqual(['Vacunación · Cirugía', 'Urgencias 24h']);
    expect(component.cfg().price(c)).toBe(35);
  });

  it('veterinaria: debería usar los valores por defecto cuando no hay datos propios del vertical', async () => {
    await crearComponente('veterinaria');
    const c = tarjeta({});

    expect(component.cfg().badge(c)).toBe('Medicina general');
    expect(component.cfg().meta(c)).toEqual(['Consulta general', 'Consulta horario']);
    expect(component.cfg().price(c)).toBe(20);
  });

  it('peluqueria: debería leer serviciosGrooming[] reales y calcular el precio mínimo', async () => {
    await crearComponente('peluqueria');
    const c = tarjeta({
      serviciosGrooming: [{ nombre: 'Baño y corte', precio: 25 }, { nombre: 'Deslanado', precio: 40 }],
      aDomicilio: true,
    });

    expect(component.cfg().badge(c)).toBe('Baño y corte');
    expect(component.cfg().meta(c)).toEqual(['Baño y corte · Deslanado', 'A domicilio']);
    expect(component.cfg().price(c)).toBe(25);
  });

  it('adiestramiento: debería leer tiposAdiestramiento[], modalidad y edadMinimaMeses reales', async () => {
    await crearComponente('adiestramiento');
    const c = tarjeta({
      tiposAdiestramiento: ['Modificación de conducta'],
      modalidad: 'programa',
      edadMinimaMeses: 6,
      precioSesion: 45,
    });

    expect(component.cfg().badge(c)).toBe('Modificación de conducta');
    expect(component.cfg().meta(c)).toEqual(['Programa completo', 'Desde 6 meses']);
    expect(component.cfg().price(c)).toBe(45);
  });

  it('debería buscar con la ciudad que llega en la URL', async () => {
    await crearComponente('veterinaria', { ciudad: 'Bilbao' });

    expect(browseService.buscarPaginado).toHaveBeenCalledWith(
      'veterinaria',
      expect.objectContaining({ ciudad: 'Bilbao' }),
    );
  });

  it('debería filtrar por compatibilidad con la mascota elegida en el buscador', async () => {
    await crearComponente('veterinaria', { ciudad: 'Bilbao', perroIds: 'perro-1,perro-2' });

    expect(browseService.buscarPaginado).toHaveBeenCalledWith(
      'veterinaria',
      expect.objectContaining({ perroId: 'perro-1' }),
    );
  });

  it('debería resumir junto al recuento lo que se pidió en el buscador', async () => {
    await crearComponente('veterinaria', {
      ciudad: 'Bilbao', desde: '2026-09-01', hora: '10:30', perroIds: 'perro-1',
    });

    expect(component.contextoBusqueda()).toEqual([
      '2026-09-01', '10:30', 'Compatible con tu mascota',
    ]);
  });

  it('debería titular la vista con el copy de marca de la categoría', async () => {
    await crearComponente('peluqueria', { ciudad: 'Sevilla' });

    expect(component.titular()).toBe('El cuidado que merece');
    expect(component.subtitular()).toBe(
      'Encuentra y reserva el cuidado ideal para su pelo, su piel y bienestar.',
    );
  });

  it('debería encabezar los resultados con el reclamo de la categoría', async () => {
    // El reclamo ocupa el sitio del antiguo titular: dice lo mismo mejor y
    // viene con la ilustración al lado.
    await crearComponente('peluqueria', { ciudad: 'Sevilla' });
    const el: HTMLElement = fixture.nativeElement;

    expect(el.querySelector('.ls__reclamo-txt h1')?.textContent?.trim())
      .toBe('Bienestar y belleza para tu mejor amigo');
    expect(el.querySelector('.ls__reclamo-art img')).not.toBeNull();
  });

  it('debería situar la ciudad buscada junto al recuento de resultados', async () => {
    await crearComponente('peluqueria', { ciudad: 'Sevilla' });

    expect(component.sufijoCiudad()).toBe(' en Sevilla');
  });

  it('debería mostrar el buscador estándar sobre los resultados', async () => {
    await crearComponente('veterinaria');
    const el: HTMLElement = fixture.nativeElement;

    expect(el.querySelector('rs-search-bar')).toBeTruthy();
  });

  it('hoteles: debería distinguir los que admiten mascotas', async () => {
    await crearComponente('hoteles');

    const petFriendly = tarjeta({ maxMascotasPorReserva: 2, serviciosPetfriendly: ['Cama para perro'] });
    expect(component.cfg().badge(petFriendly)).toBe('Pet-friendly');
    expect(component.cfg().meta(petFriendly)).toEqual(['Hasta 2 mascota(s)', 'Cama para perro']);
    expect(component.cfg().price(petFriendly)).toBe(20);

    expect(component.cfg().badge(tarjeta({ admiteMascotas: false }))).toBe('Hotel');
    expect(component.cfg().meta(tarjeta({}))[0]).toContain('sin límite');
  });

  it('seguros: debería contar coberturas y avisar de la renovación', async () => {
    await crearComponente('seguros');

    const poliza = tarjeta({
      tiposSeguro: ['salud', 'rc'], duracionMeses: 24,
      renovacionAutomatica: false, primaAnualBase: 180,
    });
    expect(component.cfg().badge(poliza)).toBe('2 coberturas');
    expect(component.cfg().meta(poliza)).toEqual(['24 meses de vigencia', 'Sin renovación automática']);
    expect(component.cfg().price(poliza)).toBe(180);

    // Sin datos propios se asume la póliza anual renovable, no una en blanco.
    expect(component.cfg().meta(tarjeta({}))).toEqual(['12 meses de vigencia', 'Renovación automática']);
    expect(component.cfg().price(tarjeta({}))).toBe(20);
  });

  it('peluqueria y adiestramiento: deberían tener valores por defecto propios', async () => {
    await crearComponente('peluqueria');
    expect(component.cfg().badge(tarjeta({}))).toBeTruthy();
    expect(component.cfg().meta(tarjeta({})).length).toBe(2);
    expect(component.cfg().price(tarjeta({}))).toBe(20);
  });

  it('adiestramiento: debería describir la modalidad por sesión', async () => {
    await crearComponente('adiestramiento');

    expect(component.cfg().meta(tarjeta({ modalidad: 'sesion' }))[0]).toBeTruthy();
    expect(component.cfg().badge(tarjeta({}))).toBeTruthy();
    expect(component.cfg().price(tarjeta({}))).toBe(20);
  });

  it('debería caer a veterinaria ante un vertical desconocido', async () => {
    await crearComponente('inventado');

    expect(component.cfg().vertical).toBe('veterinaria');
  });

  it('debería marcar el error sin inventar servicios', async () => {
    await crearComponente('veterinaria');
    browseService.buscarPaginado.mockRejectedValue(new Error('500'));

    await (component as unknown as { cargar: () => Promise<void> })['cargar']();

    expect(component.error()).toBe(true);
    expect(component.items()).toEqual([]);
    expect(component.cargando()).toBe(false);
  });

  it('no debería mostrar contexto de búsqueda cuando no se filtró nada', async () => {
    await crearComponente('veterinaria');

    expect(component.contextoBusqueda()).toEqual([]);
    expect(component.sufijoCiudad()).toBe('');
  });

  it('debería mandar cadena vacía si la tarjeta no trae comercio ni imagen', async () => {
    await crearComponente('veterinaria');
    const navigateSpy = jest.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);

    component.solicitar({ ...tarjeta({}), comercioId: undefined, imagenes: undefined } as never);

    const [, extras] = navigateSpy.mock.calls[0];
    const qp = (extras as { queryParams: Record<string, unknown> }).queryParams;
    expect(qp['comercioId']).toBe('');
    expect(qp['imagen']).toBe('');
    expect(qp['desde']).toBeNull();
  });

  it('debería llevar la fecha y las mascotas buscadas a la reserva', async () => {
    await crearComponente('veterinaria', { desde: '2026-08-01', perros: '2' });
    const navigateSpy = jest.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);

    component.solicitar(tarjeta({ precioConsulta: 35 }));

    const [ruta, extras] = navigateSpy.mock.calls[0];
    expect(ruta).toEqual(['/reservas', 'veterinaria', 's1']);
    expect((extras as { queryParams: Record<string, unknown> }).queryParams).toMatchObject({
      desde: '2026-08-01',
      perros: '2',
    });
  });

  it('HU-3.2: debería calcular badges automáticos reales, no solo la categoría', async () => {
    await crearComponente('veterinaria');
    const c = tarjeta({ especialidades: ['Dermatología'] });
    c.score = 4.9;
    c.numResenas = 30;

    const badges = component.badgesDe(c);

    expect(badges).toEqual([
      { label: 'Dermatología' },
      { icon: 'trophy', label: 'Mejor valorado', variant: 'warning' },
    ]);
  });

  it('HU-3.2: debería marcar Premium cuando el servicio está destacado', async () => {
    await crearComponente('veterinaria');
    const c = tarjeta({ especialidades: ['Dermatología'] });
    c.destacado = true;

    const badges = component.badgesDe(c);

    expect(badges).toContainEqual({ icon: 'crown', label: 'Premium', variant: 'warning' });
  });

  describe('selector "¿Qué problema quieres resolver?" (PDF 27/07 §13)', () => {
    const conTipos = (id: string, tipos: string[]): ServicioCard =>
      ({ ...tarjeta({ tiposAdiestramiento: tipos }), id });

    it('debería ofrecerse en adiestramiento', async () => {
      await crearComponente('adiestramiento');
      expect(component.esAdiestramiento()).toBe(true);
    });

    it('no debería ofrecerse en el resto de verticales', async () => {
      await crearComponente('veterinaria');
      expect(component.esAdiestramiento()).toBe(false);
    });

    it('debería poner delante a quien declara la especialidad, sin ocultar al resto', async () => {
      await crearComponente('adiestramiento');
      component.items.set([
        conTipos('generalista', ['Agility']),
        conTipos('especialista', ['Paseo con correa']),
      ]);

      component.elegirProblema('Tira de la correa');

      // Reordena, no filtra: no declarar la especialidad no significa no saber tratarla.
      expect(component.itemsOrdenados().map((c) => c.id)).toEqual(['especialista', 'generalista']);
    });

    it('debería volver al orden original al deseleccionar el mismo problema', async () => {
      await crearComponente('adiestramiento');
      component.items.set([conTipos('a', ['Agility']), conTipos('b', ['Paseo con correa'])]);

      component.elegirProblema('Tira de la correa');
      component.elegirProblema('Tira de la correa');

      expect(component.problema()).toBeNull();
      expect(component.itemsOrdenados().map((c) => c.id)).toEqual(['a', 'b']);
    });

    it('no debería reordenar nada si ningún profesional declara esa especialidad', async () => {
      await crearComponente('adiestramiento');
      component.items.set([conTipos('a', ['Agility']), conTipos('b', ['Llamada'])]);

      component.elegirProblema('Es un cachorro');

      expect(component.itemsOrdenados().map((c) => c.id)).toEqual(['a', 'b']);
    });
  });
  /*
   * El listado pedía 20 resultados y ahí se quedaba: el recuento decía 43 y no
   * había forma de llegar a los 23 restantes.
   */
  describe('ver más resultados', () => {
    const pagina = (ids: string[], total: number) => ({
      items: ids.map((id) => ({ ...tarjeta({}), id })), total, page: 1, totalPages: 2,
    });

    it('debería añadir la página siguiente al final de la lista', async () => {
      await crearComponente('veterinaria');
      browseService.buscarPaginado.mockResolvedValue(pagina(['a', 'b'], 4));
      component.recargar();
      await fixture.whenStable();
      browseService.buscarPaginado.mockResolvedValue(pagina(['c', 'd'], 4));

      await component.verMas();

      expect(component.items().map((i) => i.id)).toEqual(['a', 'b', 'c', 'd']);
      expect(component.pagina()).toBe(2);
    });

    /* Si algo cambió de sitio entre dos peticiones, mejor perder un resultado
     * que pintarlo dos veces. */
    it('debería descartar los que ya estaban en la lista', async () => {
      await crearComponente('veterinaria');
      browseService.buscarPaginado.mockResolvedValue(pagina(['a', 'b'], 4));
      component.recargar();
      await fixture.whenStable();
      browseService.buscarPaginado.mockResolvedValue(pagina(['b', 'c'], 4));

      await component.verMas();

      expect(component.items().map((i) => i.id)).toEqual(['a', 'b', 'c']);
    });

    it('no debería pedir más cuando ya están todos', async () => {
      await crearComponente('veterinaria');
      browseService.buscarPaginado.mockResolvedValue(pagina(['a', 'b'], 2));
      component.recargar();
      await fixture.whenStable();
      const llamadas = browseService.buscarPaginado.mock.calls.length;

      await component.verMas();

      expect(component.hayMas()).toBe(false);
      expect(browseService.buscarPaginado).toHaveBeenCalledTimes(llamadas);
    });

    it('no debería lanzar dos peticiones a la vez', async () => {
      await crearComponente('veterinaria');
      browseService.buscarPaginado.mockResolvedValue(pagina(['a'], 9));
      component.recargar();
      await fixture.whenStable();
      component.cargandoMas.set(true);
      const llamadas = browseService.buscarPaginado.mock.calls.length;

      await component.verMas();

      expect(browseService.buscarPaginado).toHaveBeenCalledTimes(llamadas);
    });

    it('debería conservar lo ya visible si la ampliación falla', async () => {
      await crearComponente('veterinaria');
      browseService.buscarPaginado.mockResolvedValue(pagina(['a', 'b'], 4));
      component.recargar();
      await fixture.whenStable();
      browseService.buscarPaginado.mockRejectedValue(new Error('500'));

      await component.verMas();

      expect(component.items().map((i) => i.id)).toEqual(['a', 'b']);
      expect(component.cargandoMas()).toBe(false);
    });
  });

  describe('búsqueda por mapa', () => {
    /** Opciones con las que se pidió la última búsqueda. */
    const ultimasOpciones = () => browseService.buscarPaginado.mock.calls.at(-1)![1]!;

    it('debería buscar en la zona arrastrada, ignorando la ciudad escrita', async () => {
      await crearComponente('veterinaria', { ciudad: 'Madrid' });

      await component.buscarEnZona({ swLat: 1, swLng: 2, neLat: 3, neLng: 4 } as never);

      expect(ultimasOpciones().zona).toEqual({ swLat: 1, swLng: 2, neLat: 3, neLng: 4 });
      expect(ultimasOpciones().ciudad).toBeUndefined();
    });

    /* Dejar activa una zona invisible haría que los filtros no cuadrasen con nada. */
    it('debería volver a la ciudad escrita al cerrar el mapa', async () => {
      await crearComponente('veterinaria', { ciudad: 'Madrid' });
      component.alternarMapa();
      await component.buscarEnZona({ swLat: 1, swLng: 2, neLat: 3, neLng: 4 } as never);

      component.alternarMapa();
      await fixture.whenStable();

      expect(component.mapaAbierto()).toBe(false);
      expect(ultimasOpciones().zona).toBeUndefined();
      expect(ultimasOpciones().ciudad).toBe('Madrid');
    });

    it('no debería rebuscar al cerrar el mapa si nunca se movió', async () => {
      await crearComponente('veterinaria', { ciudad: 'Madrid' });
      component.alternarMapa();
      const llamadas = browseService.buscarPaginado.mock.calls.length;

      component.alternarMapa();

      expect(browseService.buscarPaginado).toHaveBeenCalledTimes(llamadas);
    });

    it('debería convertir los pines del API en puntos del mapa', async () => {
      await crearComponente('veterinaria');
      browseService.puntosMapa.mockResolvedValue([
        { id: 'p1', titulo: 'Clínica', precio: 30, lat: 40, lng: -3, rating: 4.5, imagen: 'a.jpg' },
      ]);
      component.recargar();
      // Los pines y las facetas se piden sin esperarlas dentro de `cargar()`:
      // hace falta ceder el turno para que resuelvan.
      await new Promise((resolve) => setTimeout(resolve, 0));

      expect(component.puntosMapa()).toEqual([
        expect.objectContaining({ id: 'p1', lat: 40, lng: -3, vertical: 'veterinaria', rating: 4.5 }),
      ]);
    });
  });

  describe('orden y filtros', () => {
    const ultimasOpciones = () => browseService.buscarPaginado.mock.calls.at(-1)![1]!;

    it('debería pedir al API el orden elegido', async () => {
      await crearComponente('veterinaria');

      component.cambiarOrden('precio_asc');
      await fixture.whenStable();

      expect(ultimasOpciones().orden).toBe('precio_asc');
      expect(component.orden()).toBe('precio_asc');
    });

    it('debería trasladar los filtros del panel a la búsqueda', async () => {
      await crearComponente('veterinaria');

      component.aplicarFiltros({
        vertical: { atiendeUrgencias: true }, precioMin: 10, precioMax: 90,
        ratingMin: 4, amenities: ['Urgencias 24 h'],
      });
      await fixture.whenStable();

      expect(ultimasOpciones()).toMatchObject({
        precioMin: 10, precioMax: 90, ratingMin: 4,
        amenities: ['Urgencias 24 h'], filtrosVertical: { atiendeUrgencias: true },
      });
    });

    /* Si fallan las facetas los filtros siguen sirviendo: solo pierden el número. */
    it('debería dejar el panel sin contadores si las facetas fallan', async () => {
      await crearComponente('veterinaria');
      browseService.facetas.mockRejectedValue(new Error('500'));

      component.recargar();
      await new Promise((resolve) => setTimeout(resolve, 0));

      expect(component.facetas()).toBeNull();
      expect(component.histogramaPrecios()).toEqual([]);
    });

    it('debería pasar el histograma de precios al panel', async () => {
      await crearComponente('veterinaria');
      browseService.facetas.mockResolvedValue({
        precios: [{ desde: 0, hasta: 50, n: 3 }], amenities: [], valoracion: [],
      });

      component.recargar();
      await new Promise((resolve) => setTimeout(resolve, 0));

      expect(component.histogramaPrecios()).toEqual([{ desde: 0, hasta: 50, n: 3 }]);
    });
  });

  describe('resumen de lo buscado', () => {
    it('debería concordar el singular con un perro', async () => {
      await crearComponente('veterinaria', { perros: '1' });

      expect(component.contextoBusqueda()).toContain('1 perro');
    });

    it('debería concordar el plural con varios perros', async () => {
      await crearComponente('veterinaria', { perros: '3' });

      expect(component.contextoBusqueda()).toContain('3 perros');
    });

    it.each([
      ['un número de perros ilegible', { perros: 'muchos' }],
      ['cero perros', { perros: '0' }],
    ])('no debería resumir %s', async (_caso, params) => {
      await crearComponente('veterinaria', params);

      expect(component.contextoBusqueda().some((c) => c.includes('perro'))).toBe(false);
    });

    it('no debería poner sufijo de ciudad si no se buscó ninguna', async () => {
      await crearComponente('veterinaria');

      expect(component.sufijoCiudad()).toBe('');
    });
  });

  /**
   * Sin enlace en la tarjeta no hay forma de llegar al detalle de un comercio.
   * Pasó con veterinaria y peluquería: el componente llevaba su propia lista de
   * categorías con ficha y se quedó desfasada.
   */
  describe('enlace a la ficha del comercio', () => {
    for (const vertical of ['veterinaria', 'peluqueria', 'adiestramiento', 'hoteles', 'seguros', 'cuidadores']) {
      it(`deberia enlazar la tarjeta a la ficha en ${vertical}`, async () => {
        await crearComponente(vertical);

        expect(component.enlaceAServicio(vertical, 's1')).toEqual([`/${vertical}`, 's1']);
      });
    }
  });
});
