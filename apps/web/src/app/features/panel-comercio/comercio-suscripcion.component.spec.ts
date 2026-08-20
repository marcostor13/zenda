import { ComponentFixture, TestBed } from '@angular/core/testing';
import { RouterTestingModule } from '@angular/router/testing';
import { of, throwError } from 'rxjs';
import { VerticalKey } from 'shared';
import { ComercioSuscripcionComponent } from './comercio-suscripcion.component';
import { ComercioApiService, MiComercio } from './comercio-api.service';
import { PLANES } from '../../shared/catalogos/planes.catalogo';

const miComercio = (extra: Partial<MiComercio> = {}): MiComercio => ({
  _id: 'c1', nombreComercial: 'Canes', razonSocial: 'Canes SL', vatNumber: 'ESB12345678',
  verticales: [VerticalKey.ALOJAMIENTO], plan: 'basico', estado: 'activo',
  ...extra,
} as MiComercio);

/** Ancho de ventana; el corte de beneficios en móvil depende de él. */
const anchoDe = (px: number): void => {
  Object.defineProperty(window, 'innerWidth', { value: px, configurable: true, writable: true });
};

describe('ComercioSuscripcionComponent', () => {
  let fixture: ComponentFixture<ComercioSuscripcionComponent>;
  let componente: ComercioSuscripcionComponent;

  const crear = async (datos: MiComercio | Error = miComercio()): Promise<void> => {
    const api = {
      getMiComercio: jest.fn().mockReturnValue(
        datos instanceof Error ? throwError(() => datos) : of(datos),
      ),
    };

    await TestBed.configureTestingModule({
      imports: [ComercioSuscripcionComponent, RouterTestingModule],
      providers: [{ provide: ComercioApiService, useValue: api }],
    }).compileComponents();

    fixture = TestBed.createComponent(ComercioSuscripcionComponent);
    componente = fixture.componentInstance;
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  };

  beforeEach(() => anchoDe(1400));
  afterEach(() => jest.clearAllMocks());

  describe('plan contratado', () => {
    it('debería marcar el básico como plan actual', async () => {
      await crear();

      expect(componente.esActual(PLANES[0])).toBe(true);
      expect(componente.esActual(PLANES[1])).toBe(false);
    });

    it('debería marcar el Pro a quien lo tiene', async () => {
      await crear(miComercio({ plan: 'pro' }));

      expect(componente.esActual(PLANES[1])).toBe(true);
    });

    it('debería tratar como Pro a quien venía del antiguo premium', async () => {
      await crear(miComercio({ plan: 'premium' } as Partial<MiComercio>));

      expect(componente.planActual().clave).toBe('pro');
    });

    it('debería seguir enseñando los planes si la ficha no carga', async () => {
      // Los planes son información del producto: no dependen del comercio.
      await crear(new Error('API caída'));

      expect(componente.cargando()).toBe(false);
      expect(componente.planes.length).toBe(2);
      expect(componente.esActual(PLANES[0])).toBe(true);
    });
  });

  describe('beneficios', () => {
    it('debería enseñarlos todos en escritorio', async () => {
      await crear();

      expect(componente.beneficiosDe(PLANES[1])).toHaveLength(PLANES[1].beneficios.length);
      expect(componente.tieneMasBeneficios(PLANES[1])).toBe(false);
    });

    it('debería recortarlos en móvil', async () => {
      // La lista del Pro son diez líneas: en el móvil la pantalla se hacía
      // interminable.
      anchoDe(390);
      await crear();

      expect(componente.beneficiosDe(PLANES[1])).toHaveLength(4);
      expect(componente.tieneMasBeneficios(PLANES[1])).toBe(true);
    });

    it('debería desplegarlos a petición', async () => {
      anchoDe(390);
      await crear();

      componente.verTodos.set(true);

      expect(componente.beneficiosDe(PLANES[1])).toHaveLength(PLANES[1].beneficios.length);
      expect(componente.tieneMasBeneficios(PLANES[1])).toBe(false);
    });

    it('no debería ofrecer desplegar lo que ya se ve entero', async () => {
      anchoDe(390);
      await crear();

      // El básico tiene siete; se recorta igual, así que sí ofrece desplegar.
      expect(componente.tieneMasBeneficios(PLANES[0])).toBe(true);
    });
  });

  describe('mejora de plan', () => {
    it('no debería ofrecer mejorar al plan que ya se tiene', async () => {
      await crear(miComercio({ plan: 'pro' }));
      fixture.detectChanges();

      const el: HTMLElement = fixture.nativeElement;
      expect(el.textContent).not.toContain('Mejorar a Plan Pro');
    });

    it('debería llevar la solicitud por correo mientras no haya alta online', async () => {
      await crear();

      const enlace = componente.enlaceMejora(PLANES[1]);
      expect(enlace.startsWith('mailto:')).toBe(true);
      expect(decodeURIComponent(enlace)).toContain('Plan Pro');
    });

    it('debería identificar el negocio en la solicitud', async () => {
      await crear(miComercio({ nombreComercial: 'Villa Perruna' }));

      expect(decodeURIComponent(componente.enlaceMejora(PLANES[1]))).toContain('Villa Perruna');
    });
  });

  describe('pantalla', () => {
    it('debería abrir con el titular del plan', async () => {
      await crear();

      const el: HTMLElement = fixture.nativeElement;
      expect(el.querySelector('.page-title')?.textContent).toContain('Tu plan Doogking');
    });

    it('no debería hablar de límites de servicios', async () => {
      await crear();

      const texto: string = fixture.nativeElement.textContent ?? '';
      expect(texto).not.toMatch(/Hasta \d+ servicios/);
      expect(texto).toContain('Sin límite');
    });

    it('debería empezar con la comparativa plegada', async () => {
      // En móvil la pantalla ya trae dos tarjetas; la tabla se pide.
      await crear();

      expect(componente.comparativaAbierta()).toBe(false);
    });

    it('debería desplegar la comparativa al pedirla', async () => {
      await crear();

      componente.comparativaAbierta.set(true);
      fixture.detectChanges();

      expect(fixture.nativeElement.querySelector('.cmp__caja--abierta')).not.toBeNull();
    });

    it('debería acortar el nombre del plan en la comparativa', async () => {
      await crear();

      expect(componente.etiquetaCorta(PLANES[0])).toBe('Básico');
      expect(componente.etiquetaCorta(PLANES[1])).toBe('Pro');
    });
  });
});
