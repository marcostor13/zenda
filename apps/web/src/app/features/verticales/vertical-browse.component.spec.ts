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
