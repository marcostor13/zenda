import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { ActivatedRoute, convertToParamMap } from '@angular/router';
import { RouterTestingModule } from '@angular/router/testing';
import { TipoLugar } from 'shared';
import { ExploraDetalleComponent } from './explora-detalle.component';
import { LugarApi, LugaresService } from './lugares.service';

const lugar = (extra: Partial<LugarApi> = {}): LugarApi => ({
  _id: 'l1', tipo: TipoLugar.PARQUE, nombre: 'Parque del Retiro',
  descripcion: 'Con zona canina vallada', fotos: [],
  ubicacion: { ciudad: 'Madrid', provincia: 'Madrid' },
  atributos: {}, ratingPromedio: 4.5, totalReviews: 12,
  ...extra,
});

describe('ExploraDetalleComponent', () => {
  let fixture: ComponentFixture<ExploraDetalleComponent>;
  let componente: ExploraDetalleComponent;
  let lugaresService: jest.Mocked<Pick<LugaresService, 'obtener' | 'reviews'>>;

  const crear = async (datos: LugarApi | null): Promise<void> => {
    lugaresService = {
      obtener: datos
        ? jest.fn().mockResolvedValue(datos)
        : jest.fn().mockRejectedValue(new Error('404')),
      reviews: jest.fn().mockResolvedValue([]),
    };

    await TestBed.configureTestingModule({
      imports: [ExploraDetalleComponent, RouterTestingModule],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: LugaresService, useValue: lugaresService },
        { provide: ActivatedRoute, useValue: { snapshot: { paramMap: convertToParamMap({ id: 'l1' }) } } },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(ExploraDetalleComponent);
    componente = fixture.componentInstance;
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  };

  it('debería mostrar la ficha del lugar', async () => {
    await crear(lugar());

    expect(componente.lugar()?.nombre).toBe('Parque del Retiro');
    expect(componente.etiquetaTipo()).toBe('Parque canino');
  });

  it('solo debería listar los atributos que el sitio sí tiene', async () => {
    await crear(lugar({ atributos: { vallado: true, sombra: false, agility: true, superficie: '' } }));

    const claves = componente.atributos().map((a) => a.clave);
    expect(claves).toEqual(['vallado', 'agility']);
  });

  it('debería traducir los booleanos a un texto legible', async () => {
    await crear(lugar({ atributos: { vallado: true } }));

    expect(componente.atributos()[0]).toMatchObject({ etiqueta: 'Vallado', valor: 'Sí' });
  });

  it('no debería ofrecer "Cómo llegar" sin coordenadas', async () => {
    await crear(lugar());

    expect(componente.comoLlegar()).toBe('');
  });

  it('debería invertir el orden de GeoJSON en el enlace de mapas', async () => {
    await crear(lugar({
      ubicacion: { ciudad: 'Madrid', geo: { type: 'Point', coordinates: [-3.68, 40.41] } },
    }));

    // GeoJSON guarda [lng, lat]; el enlace de mapas espera lat,lng.
    expect(componente.comoLlegar()).toContain('query=40.41,-3.68');
  });

  it('debería enlazar los servicios de Doogking en la ciudad del lugar', async () => {
    await crear(lugar());
    const el: HTMLElement = fixture.nativeElement;

    expect(el.querySelector('.ed-servicios')?.textContent).toContain('Madrid');
    expect(componente.rutaAlojamiento).toBe('/alojamiento');
  });

  it('debería avisar sin romperse si el lugar no existe', async () => {
    await crear(null);

    expect(componente.lugar()).toBeNull();
    expect(fixture.nativeElement.querySelector('.rs-alert--error')).toBeTruthy();
  });
});
