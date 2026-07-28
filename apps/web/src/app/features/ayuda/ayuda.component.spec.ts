import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { RouterTestingModule } from '@angular/router/testing';
import { signal } from '@angular/core';
import { AyudaComponent } from './ayuda.component';
import { AuthService } from '../../core/auth/auth.service';
import { ReservasService, ReservaApi } from '../reservas/services/reservas.service';

const reserva = (extra: Partial<ReservaApi> = {}): ReservaApi => ({
  codigo: 'RES-AAAA1111',
  vertical: 'alojamiento',
  servicioId: 's1',
  comercioId: 'c1',
  montoSubtotal: 100,
  comisionMonto: 15,
  descuentoMonto: 0,
  montoTotal: 121,
  moneda: 'EUR',
  fechaInicio: '2026-09-01T00:00:00.000Z',
  cantidad: 1,
  estado: 'confirmada',
  servicioTitulo: 'Residencia Royal',
  ...extra,
});

describe('AyudaComponent', () => {
  let fixture: ComponentFixture<AyudaComponent>;
  let componente: AyudaComponent;
  let reservasService: { misReservas: jest.Mock };

  const crear = async (usuario: Record<string, unknown> | null = null, reservas: ReservaApi[] = []): Promise<void> => {
    reservasService = { misReservas: jest.fn().mockResolvedValue(reservas) };

    await TestBed.configureTestingModule({
      imports: [AyudaComponent, RouterTestingModule],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        {
          provide: AuthService,
          useValue: {
            usuario: signal(usuario),
            estaAutenticado: signal(usuario !== null),
            esAdmin: signal(false),
            esComercio: signal(false),
            logout: jest.fn(),
          },
        },
        { provide: ReservasService, useValue: reservasService },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(AyudaComponent);
    componente = fixture.componentInstance;
    fixture.detectChanges();
    await fixture.whenStable();
    await new Promise((resolve) => setTimeout(resolve, 0));
    fixture.detectChanges();
  };

  describe('público y preguntas', () => {
    it('debería abrir en las dudas del dueño de la mascota', async () => {
      await crear();

      expect(componente.publico()).toBe('cliente');
      expect(componente.preguntas().length).toBeGreaterThan(0);
    });

    it('debería cambiar el listado al elegir el público de comercio', async () => {
      await crear();
      const deCliente = componente.preguntas();

      componente.cambiarPublico('comercio');

      expect(componente.preguntas()).not.toEqual(deCliente);
    });

    it('debería resetear la categoría al cambiar de público', async () => {
      await crear();
      componente.categoria.set('pagos');

      componente.cambiarPublico('comercio');

      expect(componente.categoria()).toBeNull();
    });

    it('debería explicar que ningún suplemento se cobra sin aprobación', async () => {
      await crear();
      const respuestas = componente.preguntas().map((f) => f.r).join(' ');

      expect(respuestas).toContain('sin tu aprobación');
    });

    it('debería dejar clara la moneda real de cobro', async () => {
      await crear();
      const respuestas = componente.preguntas().map((f) => f.r).join(' ');

      expect(respuestas).toContain('Siempre en euros');
    });

    it('debería ofrecer una vía de contacto directa', async () => {
      await crear();
      const el: HTMLElement = fixture.nativeElement;

      expect(el.querySelector('a[href^="mailto:"]')).toBeTruthy();
    });
  });

  describe('buscador y categorías (HU-14.1.2)', () => {
    it('debería filtrar por texto en la pregunta o la respuesta', async () => {
      await crear();

      componente.busqueda.set('cancelar');

      expect(componente.preguntasFiltradas()).toHaveLength(1);
      expect(componente.preguntasFiltradas()[0].p).toContain('cancelar');
    });

    it('debería filtrar por categoría', async () => {
      await crear();

      componente.categoria.set('mascota');

      expect(componente.preguntasFiltradas().every((f) => f.categoria === 'mascota')).toBe(true);
      expect(componente.preguntasFiltradas().length).toBeGreaterThan(0);
    });

    it('debería combinar búsqueda y categoría', async () => {
      await crear();

      componente.categoria.set('pagos');
      componente.busqueda.set('moneda');

      expect(componente.preguntasFiltradas()).toHaveLength(1);
    });

    it('debería devolver una lista vacía si nada coincide', async () => {
      await crear();

      componente.busqueda.set('xyzxyz-no-existe');

      expect(componente.preguntasFiltradas()).toEqual([]);
    });

    it('debería exponer categorías propias para el público de comercio', async () => {
      await crear();
      componente.cambiarPublico('comercio');

      const claves = componente.categorias().map((c) => c.key);
      expect(claves).toContain('cobros');
      expect(claves).toContain('valoraciones');
    });
  });

  describe('ayuda personalizada (HU-14.1.5)', () => {
    it('no debería mostrar saludo sin sesión iniciada', async () => {
      await crear(null);

      expect(componente.saludo()).toBeNull();
    });

    it('no debería mostrar saludo si el usuario no tiene reservas', async () => {
      await crear({ nombre: 'Ana Ruiz' }, []);

      expect(componente.saludo()).toBeNull();
    });

    it('debería saludar con el primer nombre y listar hasta 3 reservas', async () => {
      await crear(
        { nombre: 'Ana Ruiz García' },
        [reserva({ codigo: 'r1' }), reserva({ codigo: 'r2' }), reserva({ codigo: 'r3' }), reserva({ codigo: 'r4' })],
      );

      expect(componente.saludo()?.nombre).toBe('Ana');
      expect(componente.saludo()?.reservas).toHaveLength(3);
      const el: HTMLElement = fixture.nativeElement;
      expect(el.textContent).toContain('Hola Ana');
    });
  });

  describe('vista de comercio (HU-14.2.2/14.2.3)', () => {
    it('debería exponer incidencias rápidas y temas de aprendizaje', async () => {
      await crear();

      expect(componente.incidencias.length).toBeGreaterThan(0);
      expect(componente.aprendizaje.length).toBeGreaterThan(0);
    });

    it('debería rellenar el buscador al pulsar una pregunta de "más consultadas"', async () => {
      await crear();
      componente.cambiarPublico('comercio');
      const pregunta = componente.masConsultadas()[0].p;

      componente.busqueda.set(pregunta);

      expect(componente.busqueda()).toBe(pregunta);
    });
  });
});
