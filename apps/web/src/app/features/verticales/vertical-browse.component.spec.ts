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
    browseService = { buscar: jest.fn().mockResolvedValue([]) } as any;

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

    expect(component.cfg().badge(c)).toBe('🩺 Dermatología');
    expect(component.cfg().meta(c)).toEqual(['💉 Vacunación · Cirugía', '🚑 Urgencias 24h']);
    expect(component.cfg().price(c)).toBe(35);
  });

  it('veterinaria: debería usar los valores por defecto cuando no hay datos propios del vertical', async () => {
    await crearComponente('veterinaria');
    const c = tarjeta({});

    expect(component.cfg().badge(c)).toBe('🩺 Medicina general');
    expect(component.cfg().meta(c)).toEqual(['💉 Consulta general', '🕐 Consulta horario']);
    expect(component.cfg().price(c)).toBe(20);
  });

  it('peluqueria: debería leer serviciosGrooming[] reales y calcular el precio mínimo', async () => {
    await crearComponente('peluqueria');
    const c = tarjeta({
      serviciosGrooming: [{ nombre: 'Baño y corte', precio: 25 }, { nombre: 'Deslanado', precio: 40 }],
      aDomicilio: true,
    });

    expect(component.cfg().badge(c)).toBe('✂️ Baño y corte');
    expect(component.cfg().meta(c)).toEqual(['🛁 Baño y corte · Deslanado', '🏠 A domicilio']);
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

    expect(component.cfg().badge(c)).toBe('🎓 Modificación de conducta');
    expect(component.cfg().meta(c)).toEqual(['🐕 Programa completo', '🦮 Desde 6 meses']);
    expect(component.cfg().price(c)).toBe(45);
  });

  it('debería buscar con la ciudad que llega en la URL', async () => {
    await crearComponente('veterinaria', { ciudad: 'Bilbao' });

    expect(browseService.buscar).toHaveBeenCalledWith(
      'veterinaria',
      expect.objectContaining({ ciudad: 'Bilbao' }),
    );
  });

  it('debería filtrar por compatibilidad con la mascota elegida en el buscador', async () => {
    await crearComponente('veterinaria', { ciudad: 'Bilbao', perroIds: 'perro-1,perro-2' });

    expect(browseService.buscar).toHaveBeenCalledWith(
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
    const el: HTMLElement = fixture.nativeElement;

    expect(component.titular()).toBe('El cuidado que merece');
    expect(component.subtitular()).toBe(
      'Encuentra y reserva el cuidado ideal para su pelo, su piel y bienestar.',
    );
    expect(el.querySelector('.vb-head h1')?.textContent?.trim()).toBe('El cuidado que merece');
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
    expect(component.cfg().badge(petFriendly)).toBe('🐾 Pet-friendly');
    expect(component.cfg().meta(petFriendly)).toEqual(['🐾 Hasta 2 mascota(s)', '🎁 Cama para perro']);
    expect(component.cfg().price(petFriendly)).toBe(20);

    expect(component.cfg().badge(tarjeta({ admiteMascotas: false }))).toBe('🏨 Hotel');
    expect(component.cfg().meta(tarjeta({}))[0]).toContain('sin límite');
  });

  it('seguros: debería contar coberturas y avisar de la renovación', async () => {
    await crearComponente('seguros');

    const poliza = tarjeta({
      tiposSeguro: ['salud', 'rc'], duracionMeses: 24,
      renovacionAutomatica: false, primaAnualBase: 180,
    });
    expect(component.cfg().badge(poliza)).toBe('🛡️ 2 coberturas');
    expect(component.cfg().meta(poliza)).toEqual(['📅 24 meses de vigencia', '🔁 Sin renovación automática']);
    expect(component.cfg().price(poliza)).toBe(180);

    // Sin datos propios se asume la póliza anual renovable, no una en blanco.
    expect(component.cfg().meta(tarjeta({}))).toEqual(['📅 12 meses de vigencia', '🔁 Renovación automática']);
    expect(component.cfg().price(tarjeta({}))).toBe(20);
  });

  it('cuidadores: debería resumir duración y radio de la visita', async () => {
    await crearComponente('cuidadores');

    const conMedicacion = tarjeta({
      administraMedicacion: true, duracionVisitaMin: 60, radioDesplazamientoKm: 25, precioVisita: 18,
    });
    expect(component.cfg().badge(conMedicacion)).toBe('💊 Administra medicación');
    expect(component.cfg().meta(conMedicacion)).toEqual(['⏱️ 60 min por visita', '🚗 Hasta 25 km']);
    expect(component.cfg().price(conMedicacion)).toBe(18);

    expect(component.cfg().badge(tarjeta({}))).toBe('🏠 A domicilio');
    expect(component.cfg().meta(tarjeta({}))).toEqual(['⏱️ 45 min por visita', '🚗 Hasta 10 km']);
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
    browseService.buscar.mockRejectedValue(new Error('500'));

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
});
