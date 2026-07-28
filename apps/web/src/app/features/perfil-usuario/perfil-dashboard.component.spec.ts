import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { RouterTestingModule } from '@angular/router/testing';
import { signal } from '@angular/core';
import { ReservaEstado, VerticalKey } from 'shared';
import { PerfilDashboardComponent } from './perfil-dashboard.component';
import { AuthService } from '../../core/auth/auth.service';
import { ReservaApi, ReservasService } from '../reservas/services/reservas.service';
import { PerrosService } from '../perros/perros.service';
import { FavoritosService } from '../favoritos/favoritos.service';
import { AlphaService, AlphaEstadoApi } from '../alpha/alpha.service';

const reserva = (extra: Partial<ReservaApi> = {}): ReservaApi => ({
  _id: 'r1', codigo: 'RES-AAAA1111', vertical: VerticalKey.ALOJAMIENTO,
  servicioId: 's1', comercioId: 'c1',
  montoSubtotal: 100, comisionMonto: 15, descuentoMonto: 0, montoTotal: 121, moneda: 'EUR',
  fechaInicio: '2026-09-01T00:00:00.000Z', cantidad: 1,
  estado: ReservaEstado.CONFIRMADA, createdAt: '2026-07-01T00:00:00.000Z',
  ...extra,
});

describe('PerfilDashboardComponent', () => {
  let fixture: ComponentFixture<PerfilDashboardComponent>;
  let componente: PerfilDashboardComponent;
  let auth: Record<string, unknown> & { logout: jest.Mock };
  let reservasService: Record<string, jest.Mock>;
  let perrosService: Record<string, jest.Mock>;
  let favoritos: Record<string, jest.Mock | (() => number)>;

  const crear = async (datos: {
    usuario?: Record<string, unknown> | null;
    reservas?: ReservaApi[];
    mascotas?: unknown[];
    favoritos?: number;
    ajustes?: Record<string, jest.Mock>;
    alphaEstado?: AlphaEstadoApi | null;
  } = {}): Promise<void> => {
    // La barra de navegación embebida consulta también el rol del usuario.
    auth = {
      usuario: signal(datos.usuario === undefined ? { nombre: 'Ana Ruiz García' } : datos.usuario),
      estaAutenticado: signal(datos.usuario !== null),
      esAdmin: signal(false),
      esComercio: signal(false),
      logout: jest.fn(),
    };
    reservasService = {
      misReservas: jest.fn().mockResolvedValue(datos.reservas ?? []),
      recordatorios: jest.fn().mockResolvedValue([]),
      puntos: jest.fn().mockResolvedValue({ puntos: 50, proximoUmbral: 200, nivel: 'plata' }),
      proximaReserva: jest.fn().mockResolvedValue(null),
      ...datos.ajustes,
    };
    perrosService = { misPerros: jest.fn().mockResolvedValue(datos.mascotas ?? []) };
    favoritos = { cargarIds: jest.fn().mockResolvedValue(undefined), count: () => datos.favoritos ?? 0 };
    const alphaService = {
      miEstado: jest.fn().mockResolvedValue(datos.alphaEstado ?? null),
      niveles: jest.fn().mockResolvedValue([]),
    };

    await TestBed.configureTestingModule({
      imports: [PerfilDashboardComponent, RouterTestingModule],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: AuthService, useValue: auth },
        { provide: ReservasService, useValue: reservasService },
        { provide: PerrosService, useValue: perrosService },
        { provide: FavoritosService, useValue: favoritos },
        { provide: AlphaService, useValue: alphaService },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(PerfilDashboardComponent);
    componente = fixture.componentInstance;
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  };

  const stat = (label: string) => componente.stats().find((s) => s.label === label)!.value;

  afterEach(() => {
    fixture?.destroy();
    jest.clearAllMocks();
  });

  describe('identidad', () => {
    it('debería componer las iniciales con dos palabras como mucho', async () => {
      await crear();

      expect(componente.iniciales()).toBe('AR');
    });

    it('debería tolerar que no haya usuario cargado', async () => {
      await crear({ usuario: null });

      expect(componente.iniciales()).toBe('');
      expect(componente.avatarUrl()).toBeNull();
    });

    it('debería usar el avatar si el usuario tiene uno', async () => {
      await crear({ usuario: { nombre: 'Ana', avatarUrl: '/avatar.png' } });

      expect(componente.avatarUrl()).toBe('/avatar.png');
    });
  });

  describe('resumen de actividad', () => {
    it('debería contar reservas, completadas, mascotas y favoritos', async () => {
      await crear({
        reservas: [reserva(), reserva({ _id: 'r2', estado: ReservaEstado.COMPLETADA })],
        // `fotos` siempre viaja: el esquema del API lo declara con `default: []`.
        mascotas: [{ _id: 'p1', nombre: 'Maya', fotos: [], esMestizo: false }],
        favoritos: 3,
      });

      expect(stat('Reservas realizadas')).toBe('2');
      expect(stat('Servicios utilizados')).toBe('1');
      expect(stat('Mis mascotas')).toBe('1');
      expect(stat('Servicios favoritos')).toBe('3');
    });

    it('debería mostrar solo las tres reservas más recientes', async () => {
      await crear({ reservas: Array.from({ length: 6 }, (_, i) => reserva({ _id: `r${i}` })) });

      expect(componente.reservasRecientes()).toHaveLength(3);
    });

    it('debería quedarse a cero si el API no responde', async () => {
      await crear({ ajustes: { misReservas: jest.fn(() => { throw new Error('500'); }) } });

      expect(stat('Reservas realizadas')).toBe('0');
      expect(componente.reservasRecientes()).toEqual([]);
    });

    it('debería seguir mostrando reservas aunque fallen mascotas y puntos', async () => {
      await crear({
        reservas: [reserva()],
        ajustes: {
          recordatorios: jest.fn().mockRejectedValue(new Error('500')),
          puntos: jest.fn().mockRejectedValue(new Error('500')),
        },
      });

      expect(stat('Reservas realizadas')).toBe('1');
      expect(componente.puntos()).toBeNull();
      expect(componente.recordatorios()).toEqual([]);
    });
  });

  describe('próxima reserva (HU-7.3)', () => {
    it('debería mostrar el bloque cuando el usuario tiene una próxima reserva', async () => {
      const enTresDias = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString();
      await crear({
        ajustes: {
          proximaReserva: jest.fn().mockResolvedValue({
            codigo: 'RES-BBBB2222', titulo: 'Royal Dog Resort', imagen: 'foto.jpg',
            ciudad: 'Madrid', fechaInicio: enTresDias, vertical: VerticalKey.ALOJAMIENTO,
          }),
        },
      });

      expect(componente.proximaReserva()?.titulo).toBe('Royal Dog Resort');
      const el: HTMLElement = fixture.nativeElement;
      expect(el.textContent).toContain('Tu próxima reserva');
      expect(el.textContent).toContain('Royal Dog Resort');
    });

    it('no debería mostrar nada si el usuario no tiene reservas por delante', async () => {
      await crear();

      expect(componente.proximaReserva()).toBeNull();
      const el: HTMLElement = fixture.nativeElement;
      expect(el.textContent).not.toContain('Tu próxima reserva');
    });

    it('debería calcular los días restantes sin devolver negativos', async () => {
      await crear();

      const pasado = new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString();
      expect(componente.diasFaltantes(pasado)).toBe(0);
    });
  });

  describe('saludo personalizado (HU-7.1)', () => {
    it('debería saludar solo con el primer nombre', async () => {
      await crear({ usuario: { nombre: 'Ana Ruiz García' } });

      expect(componente.primerNombre()).toBe('Ana');
      const el: HTMLElement = fixture.nativeElement;
      expect(el.textContent).toContain('Hola, Ana');
    });
  });

  describe('tarjetas de reserva', () => {
    it('debería usar el título del servicio cuando existe', async () => {
      await crear({ reservas: [reserva({ detalle: { titulo: 'Residencia Royal' } })] });

      expect(componente.reservasRecientes()[0].titulo).toBe('Residencia Royal');
    });

    it('debería construir un nombre con el vertical y el código si no hay título', async () => {
      await crear({ reservas: [reserva({ vertical: VerticalKey.TRANSPORTE })] });

      expect(componente.reservasRecientes()[0].titulo).toContain('RES-AAAA1111');
    });

    it('debería traducir el estado a etiqueta y color', async () => {
      await crear({ reservas: [reserva({ estado: ReservaEstado.COMPLETADA })] });

      expect(componente.reservasRecientes()[0].estado).toBe('Completada');
      expect(componente.reservasRecientes()[0].badgeClass).toContain('accent');
    });

    it('debería mostrar tal cual un estado desconocido', async () => {
      await crear({ reservas: [reserva({ estado: 'inventado' as ReservaEstado })] });

      expect(componente.reservasRecientes()[0].estado).toBe('inventado');
      expect(componente.reservasRecientes()[0].badgeClass).toBe('');
    });
  });

  describe('programa de puntos', () => {
    it('debería calcular el avance hacia el siguiente nivel', async () => {
      await crear();

      expect(componente.progresoPuntos()).toBe(25);
    });

    it('no debería dividir por cero en el nivel máximo', async () => {
      await crear({ ajustes: { puntos: jest.fn().mockResolvedValue({ puntos: 500, proximoUmbral: 0, nivel: 'oro' }) } });

      expect(componente.progresoPuntos()).toBe(0);
    });
  });

  describe('Doogking Alpha (HU-13.2)', () => {
    const estado = (extra: Partial<AlphaEstadoApi> = {}): AlphaEstadoApi => ({
      nivelActual: 1,
      nombreNivel: 'Alpha 1',
      descuentoPct: 0,
      beneficios: ['Promos'],
      reservasCompletadas: 2,
      reservasParaSiguiente: 3,
      siguienteNivel: { nivel: 2, nombre: 'Alpha 2', reservasRequeridas: 5, descuentoPct: 0.05, beneficios: [] },
      esMaximoNivel: false,
      ...extra,
    });

    it('debería mostrar el nivel actual y el progreso hacia el siguiente', async () => {
      await crear({ alphaEstado: estado() });

      expect(componente.alpha()?.nombreNivel).toBe('Alpha 1');
      expect(componente.progresoAlpha()).toBe(40); // 2 de 5 reservas
      const el: HTMLElement = fixture.nativeElement;
      expect(el.textContent).toContain('Alpha 2');
    });

    it('debería mostrar el 100% y el mensaje de nivel máximo cuando no hay siguiente nivel', async () => {
      await crear({
        alphaEstado: estado({ nivelActual: 3, nombreNivel: 'Alpha 3', reservasParaSiguiente: null, siguienteNivel: null, esMaximoNivel: true }),
      });

      expect(componente.progresoAlpha()).toBe(100);
      const el: HTMLElement = fixture.nativeElement;
      expect(el.textContent).toContain('máximo nivel');
    });

    it('no debería mostrar la tarjeta si el estado Alpha no está disponible', async () => {
      await crear();

      expect(componente.alpha()).toBeNull();
    });
  });

  describe('sesión', () => {
    it('debería cerrar sesión al pedirlo', async () => {
      await crear();

      componente.cerrarSesion();

      expect(auth.logout).toHaveBeenCalled();
    });
  });
});
