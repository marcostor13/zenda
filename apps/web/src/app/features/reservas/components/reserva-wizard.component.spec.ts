import { ComponentFixture, TestBed } from '@angular/core/testing';
import { HttpErrorResponse, provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting, HttpTestingController } from '@angular/common/http/testing';
import { ActivatedRoute, convertToParamMap } from '@angular/router';
import { RouterTestingModule } from '@angular/router/testing';
import { of } from 'rxjs';
import {
  FranjaHoraria, LugarRecogida, ModoPrecioRecogida, MonedaSoportada, PasoEmbudo, TipoEvento,
  UrgenciaFunerario, VerticalKey,
} from 'shared';
import { ReservaWizardComponent } from './reserva-wizard.component';
import { ReservasService } from '../services/reservas.service';
import { PaymentsService } from '../services/payments.service';
import { CuponesService } from '../services/cupones.service';
import { RecomendadorService } from '../services/recomendador.service';
import { PerrosService } from '../../perros/perros.service';
import { CatalogBrowseService } from '../../verticales/catalog-browse.service';
import { StripeService } from '../../../core/stripe/stripe.service';
import { GeoService } from '../../../core/geo/geo.service';
import { EventosService } from '../../../core/eventos/eventos.service';
import { AuthService } from '../../../core/auth/auth.service';
import { MonedaService } from '../../../core/moneda/moneda.service';

interface Dobles {
  reservas: { crear: jest.Mock; comprobarDisponibilidad: jest.Mock; calendario: jest.Mock };
  payments: { crearIntent: jest.Mock; configuracion: jest.Mock; confirmarSinCobro: jest.Mock; sincronizar: jest.Mock };
  cupones: { validar: jest.Mock };
  recomendador: { adiestramiento: jest.Mock; veterinaria: jest.Mock };
  perros: { misPerros: jest.Mock };
  catalog: { obtener: jest.Mock };
  stripe: { getStripe: jest.Mock };
  geo: { trayecto: jest.Mock };
  eventos: { registrar: jest.Mock; cerrarEmbudo: jest.Mock };
  auth: {
    usuario: () => unknown;
    estaAutenticado: () => boolean;
    esAdmin: () => boolean;
    esComercio: () => boolean;
    esCliente: () => boolean;
    clienteVerificado: () => boolean;
    logout: jest.Mock;
  };
}

/**
 * Doble de `AuthService`. Cubre tambien lo que consume el navbar embebido, que
 * de otro modo revienta el arranque del wizard entero.
 */
const autenticacion = (usuario: unknown) => ({
  usuario: () => usuario,
  estaAutenticado: () => usuario !== null,
  esAdmin: () => false,
  esComercio: () => false,
  esCliente: () => usuario !== null,
  clienteVerificado: () => usuario !== null,
  logout: jest.fn(),
});

const sinSesion = () => autenticacion(null);

/** Espera a que se cumpla una condicion, con tope para no colgar el test. */
const esperarA = async (condicion: () => boolean, intentos = 50): Promise<void> => {
  for (let i = 0; i < intentos && !condicion(); i++) {
    await new Promise((resolver) => setTimeout(resolver, 0));
  }
};

const perro = (extra: Record<string, unknown> = {}) => ({
  _id: 'p1', nombre: 'Maya', tamano: 'mediano', tipoPelo: ['corto'],
  fotos: [], especie: 'perro', esMestizo: false, esterilizado: true,
  vacunas: [], alergias: [], enfermedades: [], medicacion: [],
  puedeQuedarseSolo: true, ansiedadSeparacion: false, miedos: [],
  seMarea: false, requiereTransportin: false, autorizaCompartirHistorial: true,
  ...extra,
});

describe('ReservaWizardComponent', () => {
  let fixture: ComponentFixture<ReservaWizardComponent>;
  let componente: ReservaWizardComponent;
  let dobles: Dobles;

  const elementoStripe = { mount: jest.fn() };
  const stripeFake = {
    elements: jest.fn(() => ({ create: jest.fn(() => elementoStripe) })),
    confirmPayment: jest.fn().mockResolvedValue({}),
  };

  const crear = async (
    params: Record<string, string> = {},
    query: Record<string, string> = {},
    ajustes: Partial<Dobles> = {},
  ): Promise<void> => {
    dobles = {
      reservas: {
        crear: jest.fn().mockResolvedValue({ _id: 'r1', codigo: 'RES-AAAA1111' }),
        comprobarDisponibilidad: jest.fn().mockResolvedValue({ disponible: true, precioEstimado: 150 }),
        calendario: jest.fn().mockResolvedValue({
          soportado: true,
          dias: [{ fecha: '2026-09-01', disponible: true, plazasLibres: 2 }],
        }),
      },
      payments: {
        crearIntent: jest.fn().mockResolvedValue({ clientSecret: 'cs_1', pagoId: 'pago-1', montoTotal: 242 }),
        // Sin bypass por defecto, igual que en produccion.
        configuracion: jest.fn().mockResolvedValue({ bypassPagoHabilitado: false }),
        confirmarSinCobro: jest.fn().mockResolvedValue(undefined),
        sincronizar: jest.fn().mockResolvedValue({ estado: 'aprobado' }),
      },
      cupones: { validar: jest.fn().mockResolvedValue({ codigo: 'VERANO', descuento: 20 }) },
      recomendador: {
        adiestramiento: jest.fn().mockResolvedValue({ modalidad: 'sesion', bloqueaGrupales: false }),
        veterinaria: jest.fn().mockResolvedValue({ servicio: 'consulta' }),
      },
      perros: { misPerros: jest.fn().mockResolvedValue([]) },
      catalog: { obtener: jest.fn().mockResolvedValue({ extra: {} }) },
      stripe: { getStripe: jest.fn().mockResolvedValue(stripeFake) },
      geo: {
        trayecto: jest.fn().mockResolvedValue({ km: 70, duracionMin: 55, esEstimacion: false }),
        // Lo pide `MonedaService` en cuanto se elige una divisa distinta al euro.
        tiposDeCambio: jest.fn().mockReturnValue(of({ base: 'EUR', fecha: '', tasas: { EUR: 1, GBP: 0.84 } })),
      },
      eventos: { registrar: jest.fn(), cerrarEmbudo: jest.fn() },
      // Sin sesion por defecto: el wizard admite invitados.
      auth: sinSesion(),
      ...ajustes,
    };

    await TestBed.configureTestingModule({
      imports: [ReservaWizardComponent, RouterTestingModule],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: ReservasService, useValue: dobles.reservas },
        { provide: PaymentsService, useValue: dobles.payments },
        { provide: CuponesService, useValue: dobles.cupones },
        { provide: RecomendadorService, useValue: dobles.recomendador },
        { provide: PerrosService, useValue: dobles.perros },
        { provide: CatalogBrowseService, useValue: dobles.catalog },
        { provide: StripeService, useValue: dobles.stripe },
        { provide: GeoService, useValue: dobles.geo },
        { provide: EventosService, useValue: dobles.eventos },
        { provide: AuthService, useValue: dobles.auth },
        {
          provide: ActivatedRoute,
          useValue: {
            snapshot: {
              paramMap: convertToParamMap(params),
              queryParamMap: convertToParamMap(query),
            },
          },
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(ReservaWizardComponent);
    componente = fixture.componentInstance;
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  };

  const contexto = (vertical: VerticalKey, query: Record<string, string> = {}) => ({
    params: { vertical, servicioId: 's1' },
    query: { comercioId: 'c1', nombre: 'Servicio', precioBase: '50', ...query },
  });

  afterEach(() => {
    jest.clearAllMocks();
    stripeFake.confirmPayment.mockResolvedValue({});
  });

  describe('contexto desde la ruta', () => {
    it('debería tomar vertical, servicio y precio de la ruta', async () => {
      const { params, query } = contexto(VerticalKey.ALOJAMIENTO);
      await crear(params, query);

      expect(componente.vertical()).toBe(VerticalKey.ALOJAMIENTO);
      expect(componente.precioBase()).toBe(50);
      expect(componente.nombreServicio()).toBe('Servicio');
    });

    it('debería caer a alojamiento si la ruta no trae vertical', async () => {
      await crear();

      expect(componente.vertical()).toBe(VerticalKey.ALOJAMIENTO);
    });

    it('debería prellenar las fechas ya elegidas en el buscador', async () => {
      const { params, query } = contexto(VerticalKey.ALOJAMIENTO, {
        desde: '2026-09-01', hasta: '2026-09-04', perros: '3',
      });
      await crear(params, query);

      // Volver a pedir lo que el usuario ya indicó en el buscador es fricción pura.
      expect(componente.paso1AlojamientoForm.value).toMatchObject({
        checkIn: '2026-09-01', checkOut: '2026-09-04', perros: 3,
      });
    });

    it('debería preferir checkIn/checkOut del detalle sobre desde/hasta', async () => {
      const { params, query } = contexto(VerticalKey.ALOJAMIENTO, {
        desde: '2026-09-01', checkIn: '2026-10-10', checkOut: '2026-10-12',
      });
      await crear(params, query);

      expect(componente.paso1AlojamientoForm.value.checkIn).toBe('2026-10-10');
    });

    it('debería propagar la fecha buscada a los verticales de cita', async () => {
      const { params, query } = contexto(VerticalKey.VETERINARIA, { desde: '2026-09-01' });
      await crear(params, query);

      expect(componente.paso1VeterinariaForm.value.fecha).toBe('2026-09-01');
      expect(componente.paso1PeluqueriaForm.value.fecha).toBe('2026-09-01');
      expect(componente.paso1AdiestramientoForm.value.fechaInicio).toBe('2026-09-01');
      expect(componente.paso1TransporteForm.value.fechaRecogida).toBe('2026-09-01');
    });

    it('debería usar la ciudad como origen del trayecto', async () => {
      const { params, query } = contexto(VerticalKey.TRANSPORTE, { ciudad: 'Madrid' });
      await crear(params, query);

      expect(componente.paso1TransporteForm.value.origen).toBe('Madrid');
    });
  });

  describe('selección de perro', () => {
    it('debería preseleccionar el perro si solo hay uno', async () => {
      const { params, query } = contexto(VerticalKey.ALOJAMIENTO);
      await crear(params, query, { perros: { misPerros: jest.fn().mockResolvedValue([perro()]) } });

      expect(componente.perroSeleccionado()).toBe('p1');
    });

    it('debería respetar el perro que venía en la url', async () => {
      const { params, query } = contexto(VerticalKey.ALOJAMIENTO, { perroId: 'p2' });
      await crear(params, query, {
        perros: { misPerros: jest.fn().mockResolvedValue([perro(), perro({ _id: 'p2', nombre: 'Toby' })]) },
      });

      expect(componente.perroSeleccionado()).toBe('p2');
    });

    it('no debería preseleccionar nada si hay varios perros y ninguno indicado', async () => {
      const { params, query } = contexto(VerticalKey.ALOJAMIENTO);
      await crear(params, query, {
        perros: { misPerros: jest.fn().mockResolvedValue([perro(), perro({ _id: 'p2' })]) },
      });

      expect(componente.perroSeleccionado()).toBeNull();
    });

    it('debería seguir permitiendo reservar si la ficha del perro no carga', async () => {
      const { params, query } = contexto(VerticalKey.ALOJAMIENTO);
      await crear(params, query, { perros: { misPerros: jest.fn().mockRejectedValue(new Error('sin red')) } });

      // La ficha es opcional: un fallo suyo no puede bloquear la compra.
      expect(componente.perros()).toEqual([]);
      expect(componente.paso()).toBe(1);
    });
  });

  describe('tarjeta visual de mascota (HU-5.1.3)', () => {
    it('debería devolver la edad en meses para un cachorro', async () => {
      const { params, query } = contexto(VerticalKey.ALOJAMIENTO);
      await crear(params, query);

      const hace4meses = new Date(Date.now() - 4 * 30.44 * 24 * 60 * 60 * 1000).toISOString();
      expect(componente.edadDe(perro({ fechaNacimiento: hace4meses }))).toBe('4 meses');
    });

    it('debería devolver la edad en años para un perro adulto', async () => {
      const { params, query } = contexto(VerticalKey.ALOJAMIENTO);
      await crear(params, query);

      const fecha = new Date();
      fecha.setFullYear(fecha.getFullYear() - 3);
      expect(componente.edadDe(perro({ fechaNacimiento: fecha.toISOString() }))).toBe('3 años');
    });

    it('no debería inventar una edad si la mascota no la tiene declarada', async () => {
      const { params, query } = contexto(VerticalKey.ALOJAMIENTO);
      await crear(params, query);

      expect(componente.edadDe(perro())).toBeNull();
    });
  });

  describe('precio', () => {
    it('debería multiplicar el precio por las noches reservadas', async () => {
      const { params, query } = contexto(VerticalKey.ALOJAMIENTO);
      await crear(params, query);
      componente.paso1AlojamientoForm.patchValue({ checkIn: '2026-09-01', checkOut: '2026-09-04' });

      expect(componente.subtotal()).toBe(150);
    });

    it('debería cobrar al menos una noche cuando no hay fechas', async () => {
      const { params, query } = contexto(VerticalKey.ALOJAMIENTO);
      await crear(params, query);

      expect(componente.subtotal()).toBe(50);
    });

    it('debería sumar los extras seleccionados, configurados por el comercio (HU-15.1/15.2)', async () => {
      const { params, query } = contexto(VerticalKey.ALOJAMIENTO);
      await crear(params, query);
      componente.serviciosAdicionalesAlojamiento.set([
        { nombre: 'Paseo extra diario', precio: 10 },
        { nombre: 'Acceso cámara 24/7', precio: 5 },
      ]);
      componente.toggleExtra('Paseo extra diario');
      componente.toggleExtra('Acceso cámara 24/7');

      expect(componente.subtotal()).toBe(65);
    });

    it('debería quitar el extra al pulsarlo de nuevo', async () => {
      const { params, query } = contexto(VerticalKey.ALOJAMIENTO);
      await crear(params, query);
      componente.serviciosAdicionalesAlojamiento.set([{ nombre: 'Paseo extra diario', precio: 10 }]);
      componente.toggleExtra('Paseo extra diario');
      componente.toggleExtra('Paseo extra diario');

      expect(componente.extrasSelec()).toEqual([]);
      expect(componente.subtotal()).toBe(50);
    });

    it('debería desglosar el trayecto: tarifa base + kilómetros + extras (HU-5.5.3)', async () => {
      const { params, query } = contexto(VerticalKey.TRANSPORTE);
      await crear(params, query);
      componente.tarifasTransporte.set({ tarifaBase: 12, tarifaKm: 1.2 });
      componente.serviciosAdicionalesTransporte.set([{ nombre: 'Recogida a domicilio', precio: 15 }]);
      componente.paso1TransporteForm.patchValue({ distanciaKm: 25 });
      componente.toggleExtra('Recogida a domicilio');

      expect(componente.tarifaBaseTransporte()).toBe(12);
      expect(componente.costeKmTransporte()).toBe(30);
      expect(componente.extrasTransporte()).toBe(15);
      expect(componente.subtotal()).toBe(57);
    });

    it('debería caer a la tarifa base si el catálogo del transportista no ha cargado', async () => {
      const { params, query } = contexto(VerticalKey.TRANSPORTE);
      await crear(params, query);
      componente.paso1TransporteForm.patchValue({ distanciaKm: 25 });

      // Sin config no se inventan kilómetros: el backend sigue siendo la fuente de verdad.
      expect(componente.costeKmTransporte()).toBe(0);
      expect(componente.subtotal()).toBe(componente.precioBase());
    });

    /**
     * Los precios del catálogo llevan el IVA incluido: el descuento se aplica
     * sobre el total anunciado y el impuesto se desglosa dividiendo, no se
     * suma encima al llegar al pago.
     */
    it('debería descontar del total anunciado, no añadir el IVA por encima', async () => {
      const { params, query } = contexto(VerticalKey.ALOJAMIENTO, { precioBase: '100' });
      await crear(params, query);
      componente.cuponInput = 'verano';
      await componente.aplicarCupon();

      expect(componente.total()).toBe(80);
      // 80 / 1.21 = 66,12 de base; el resto es el IVA que ya iba dentro.
      expect(componente.baseImponible()).toBeCloseTo(66.12, 2);
      expect(componente.iva()).toBeCloseTo(13.88, 2);
    });

    it('debería usar el total del API en cuanto existe, no el estimado', async () => {
      const { params, query } = contexto(VerticalKey.ALOJAMIENTO);
      await crear(params, query);
      componente.totalFromApi.set(242);

      // El servidor es la autoridad del importe: el cálculo local solo es un anticipo.
      expect(componente.total()).toBe(242);
    });

    it('no debería dejar el subtotal en negativo con un descuento mayor que la compra', async () => {
      const { params, query } = contexto(VerticalKey.ALOJAMIENTO, { precioBase: '10' });
      await crear(params, query, {
        cupones: { validar: jest.fn().mockResolvedValue({ codigo: 'BIG', descuento: 50 }) },
      });
      componente.cuponInput = 'BIG';
      await componente.aplicarCupon();

      expect(componente.total()).toBe(0);
    });

    it('debería mostrar un solo precio en los verticales de cita', async () => {
      const { params, query } = contexto(VerticalKey.PELUQUERIA);
      await crear(params, query);

      expect(componente.subtotal()).toBe(50);
      expect(componente.precioPorLabel()).toBe('servicio');
    });
  });

  describe('cupones', () => {
    it('debería normalizar el código a mayúsculas antes de validarlo', async () => {
      const { params, query } = contexto(VerticalKey.ALOJAMIENTO);
      await crear(params, query);
      componente.cuponInput = '  verano ';
      await componente.aplicarCupon();

      expect(dobles.cupones.validar).toHaveBeenCalledWith('VERANO', VerticalKey.ALOJAMIENTO, 50);
      expect(componente.descuento()).toBe(20);
    });

    it('no debería llamar al API con el campo vacío', async () => {
      const { params, query } = contexto(VerticalKey.ALOJAMIENTO);
      await crear(params, query);
      componente.cuponInput = '   ';
      await componente.aplicarCupon();

      expect(dobles.cupones.validar).not.toHaveBeenCalled();
    });

    it('debería explicar el rechazo sin aplicar descuento', async () => {
      const { params, query } = contexto(VerticalKey.ALOJAMIENTO);
      await crear(params, query, {
        cupones: { validar: jest.fn().mockRejectedValue(new Error('caducado')) },
      });
      componente.cuponInput = 'CADUCADO';
      await componente.aplicarCupon();

      expect(componente.cuponError()).toContain('no válido');
      expect(componente.descuento()).toBe(0);
      expect(componente.aplicandoCupon()).toBe(false);
    });

    it('debería revertir el descuento al quitar el cupón', async () => {
      const { params, query } = contexto(VerticalKey.ALOJAMIENTO);
      await crear(params, query);
      componente.cuponInput = 'VERANO';
      await componente.aplicarCupon();

      componente.quitarCupon();

      expect(componente.descuento()).toBe(0);
      expect(componente.cuponCodigo()).toBeNull();
      expect(componente.cuponInput).toBe('');
    });
  });

  describe('navegación entre pasos', () => {
    it('debería bloquear el paso 2 mientras el formulario de contacto sea inválido', async () => {
      const { params, query } = contexto(VerticalKey.ALOJAMIENTO);
      await crear(params, query);
      componente.irPaso(2);

      componente.continuarPaso2();

      expect(componente.paso()).toBe(2);
      expect(componente.paso2Form.touched).toBe(true);
    });

    it('debería avanzar al pago con los datos de contacto completos', async () => {
      const { params, query } = contexto(VerticalKey.ALOJAMIENTO);
      await crear(params, query);
      componente.paso2Form.setValue({
        nombre: 'Ana', apellidos: 'Ruiz', email: 'ana@ruiz.com', telefono: '600000000',
        pais: 'ES', peticiones: '', confirmaDatosMascota: true, aceptaTerminos: true,
      });

      componente.continuarPaso2();

      expect(componente.paso()).toBe(3);
    });

    it('debería registrar cada paso alcanzado para medir el embudo', async () => {
      const { params, query } = contexto(VerticalKey.ALOJAMIENTO);
      await crear(params, query);
      componente.irPaso(2);

      expect(dobles.eventos.registrar).toHaveBeenCalledWith(
        TipoEvento.PASO_COMPLETADO,
        expect.objectContaining({ paso: PasoEmbudo.DATOS, servicioId: 's1' }),
      );
    });

    it('debería descartar el pago preparado al volver al paso 1', async () => {
      const { params, query } = contexto(VerticalKey.ALOJAMIENTO);
      await crear(params, query);
      componente.irPaso(3);
      await fixture.whenStable();

      componente.irPaso(1);

      // Cambiar fechas o extras cambia el importe: reutilizar el intent anterior
      // cobraría un total que ya no corresponde.
      expect(componente.stripeListo()).toBe(false);
      expect(componente.totalFromApi()).toBeNull();
    });

    it('debería validar el paso 1 según el vertical activo', async () => {
      const { params, query } = contexto(VerticalKey.VETERINARIA);
      await crear(params, query);

      expect(componente.paso1Valido()).toBe(false);
      componente.paso1VeterinariaForm.patchValue({ fecha: '2026-09-01', hora: '10:00' });
      expect(componente.paso1Valido()).toBe(true);
    });
  });

  /**
   * El selector de divisa de la cabecera es de **visualización**: el cargo va
   * siempre en euros. En el último paso conviven las dos cifras y hay que
   * distinguirlas, o el importe del extracto sorprende al cliente.
   */
  describe('divisa de visualización', () => {
    const enPasoDePago = async (moneda?: MonedaSoportada): Promise<string> => {
      const { params, query } = contexto(VerticalKey.ALOJAMIENTO);
      await crear(params, query);
      if (moneda) TestBed.inject(MonedaService).elegirMoneda(moneda);

      componente.paso1AlojamientoForm.patchValue({ checkIn: '2026-09-01', checkOut: '2026-09-03' });
      componente.irPaso(3);
      await fixture.whenStable();
      fixture.detectChanges();

      return (fixture.nativeElement as HTMLElement).textContent ?? '';
    };

    afterEach(() => localStorage.removeItem('doogking_moneda'));

    it('no debería avisar de nada mientras se paga en euros', async () => {
      expect(await enPasoDePago()).not.toContain('El cargo se hará en euros');
    });

    it('debería avisar de que el cargo va en euros al elegir otra divisa', async () => {
      const texto = await enPasoDePago('GBP');

      expect(texto).toContain('El cargo se hará en euros');
      // 242 es el total que devuelve el intent del API; el convertido, 203,28.
      expect(texto).toContain('242');
      expect(texto).toContain('GBP');
    });

    it('debería enseñar el total convertido en el botón de pagar', async () => {
      const texto = await enPasoDePago('GBP');

      expect(texto).toContain('203,28');
    });
  });

  describe('preparación del pago', () => {
    it('debería crear reserva e intent al entrar en el paso de pago', async () => {
      const { params, query } = contexto(VerticalKey.ALOJAMIENTO);
      await crear(params, query);
      componente.paso1AlojamientoForm.patchValue({ checkIn: '2026-09-01', checkOut: '2026-09-03' });

      componente.irPaso(3);
      await fixture.whenStable();

      expect(dobles.reservas.crear).toHaveBeenCalledWith(expect.objectContaining({
        servicioId: 's1', comercioId: 'c1', vertical: VerticalKey.ALOJAMIENTO,
        fechaInicio: '2026-09-01', fechaFin: '2026-09-03',
      }));
      expect(dobles.payments.crearIntent).toHaveBeenCalledWith('r1');
      expect(componente.totalFromApi()).toBe(242);
      expect(componente.codigoReserva()).toBe('RES-AAAA1111');
    });

    it('debería enviar el detalle propio del transporte', async () => {
      const { params, query } = contexto(VerticalKey.TRANSPORTE);
      await crear(params, query);
      componente.paso1TransporteForm.patchValue({
        fechaRecogida: '2026-09-01', hora: '09:30', origen: 'Madrid', destino: 'Toledo', distanciaKm: 70,
      });

      componente.irPaso(3);
      await fixture.whenStable();

      expect(dobles.reservas.crear).toHaveBeenCalledWith(expect.objectContaining({
        fechaInicio: '2026-09-01T09:30:00',
        detalle: expect.objectContaining({ origen: 'Madrid', destino: 'Toledo', distanciaKm: 70 }),
      }));
    });

    it('debería adjuntar el cupón aplicado a la reserva', async () => {
      const { params, query } = contexto(VerticalKey.ALOJAMIENTO);
      await crear(params, query);
      componente.cuponInput = 'VERANO';
      await componente.aplicarCupon();
      componente.paso1AlojamientoForm.patchValue({ checkIn: '2026-09-01', checkOut: '2026-09-02' });

      componente.irPaso(3);
      await fixture.whenStable();

      expect(dobles.reservas.crear.mock.calls[0][0].cuponCodigo).toBe('VERANO');
    });

    it('debería enviar fecha y hora de la cita veterinaria', async () => {
      const { params, query } = contexto(VerticalKey.VETERINARIA);
      await crear(params, query);
      componente.paso1VeterinariaForm.patchValue({ fecha: '2026-09-01', hora: '10:00', servicio: 'vacunacion' });

      componente.irPaso(3);
      await fixture.whenStable();

      expect(dobles.reservas.crear).toHaveBeenCalledWith(expect.objectContaining({
        fechaInicio: '2026-09-01', cantidad: 1,
        detalle: { hora: '10:00', servicio: 'vacunacion' },
      }));
    });

    it('debería enviar el servicio de grooming elegido', async () => {
      const { params, query } = contexto(VerticalKey.PELUQUERIA);
      await crear(params, query);
      componente.paso1PeluqueriaForm.patchValue({ fecha: '2026-09-01', hora: '11:00', servicio: 'bano' });

      componente.irPaso(3);
      await fixture.whenStable();

      expect(dobles.reservas.crear).toHaveBeenCalledWith(expect.objectContaining({
        detalle: { hora: '11:00', servicio: 'bano' },
      }));
    });

    it('debería enviar modalidad y edad en adiestramiento', async () => {
      const { params, query } = contexto(VerticalKey.ADIESTRAMIENTO);
      await crear(params, query);
      componente.paso1AdiestramientoForm.patchValue({
        fechaInicio: '2026-09-01', modalidad: 'programa', edadMeses: 18, servicio: 'Obediencia',
        motivo: 'miedos', intensidad: 'grave',
        descripcionComportamiento: 'Se esconde cuando hay ruido',
      });

      componente.irPaso(3);
      await fixture.whenStable();

      // El contexto del problema (HU-5.6.2) viaja con la reserva: es lo que
      // permite al adiestrador preparar la primera sesión.
      expect(dobles.reservas.crear).toHaveBeenCalledWith(expect.objectContaining({
        detalle: {
          modalidad: 'programa', edadMeses: 18, servicio: 'Obediencia',
          motivo: 'miedos', intensidad: 'grave',
          descripcionComportamiento: 'Se esconde cuando hay ruido',
        },
      }));
    });

    it('debería exponer la duración del servicio de grooming elegido (HU-5.3.2)', async () => {
      const { params, query } = contexto(VerticalKey.PELUQUERIA);
      await crear(params, query);
      componente.peluqueriaDetalle.set({
        serviciosGrooming: [{ nombre: 'Baño completo', precio: 30, duracionMin: 60 }],
        politicaTemperamentoDificil: 'aceptar',
        bozalObligatorioSiAgresivo: false,
        serviciosAdicionales: [],
        razasEspecificas: [],
        requiereVacunasAlDia: true,
        requiereMicrochip: false,
      });
      componente.paso1PeluqueriaForm.patchValue({ servicio: 'Baño completo' });

      expect(componente.duracionGroomingElegida()).toBe(60);
    });

    it('no debería inventar duración si el salón no la ha configurado', async () => {
      const { params, query } = contexto(VerticalKey.PELUQUERIA);
      await crear(params, query);
      componente.peluqueriaDetalle.set({
        serviciosGrooming: [{ nombre: 'Baño completo', precio: 30 }],
        politicaTemperamentoDificil: 'aceptar',
        bozalObligatorioSiAgresivo: false,
        serviciosAdicionales: [],
        razasEspecificas: [],
        requiereVacunasAlDia: true,
        requiereMicrochip: false,
      });
      componente.paso1PeluqueriaForm.patchValue({ servicio: 'Baño completo' });

      expect(componente.duracionGroomingElegida()).toBeNull();
    });

    it('debería enviar las mascotas declaradas en un hotel', async () => {
      const { params, query } = contexto(VerticalKey.HOTELES);
      await crear(params, query);
      componente.paso1HotelesForm.patchValue({
        checkIn: '2026-09-01', checkOut: '2026-09-03', mascotas: 2, tamanoPerro: 'grande',
        adultos: 3, ninos: 1,
      });

      componente.irPaso(3);
      await fixture.whenStable();

      expect(dobles.reservas.crear).toHaveBeenCalledWith(expect.objectContaining({
        fechaInicio: '2026-09-01', fechaFin: '2026-09-03', cantidad: 2,
        // HU-5.7.1: en hoteles viajan personas además de la mascota.
        detalle: { tamanoPerro: 'grande', adultos: 3, ninos: 1, observaciones: undefined },
      }));
    });

    it('debería resumir el viaje con personas, mascotas y fechas en hoteles', async () => {
      const { params, query } = contexto(VerticalKey.HOTELES);
      await crear(params, query);
      componente.paso1HotelesForm.patchValue({
        checkIn: '2026-07-28', checkOut: '2026-07-30', mascotas: 2, adultos: 2, ninos: 1,
      });
      componente.irPaso(2);
      await fixture.whenStable();

      // Cada dato lleva su icono Lucide, no un emoji en el texto (TCK-8010).
      expect(componente.resumenViaje()).toEqual([
        { icono: 'user', texto: '2 adultos' },
        { icono: 'baby', texto: '1 niño' },
        { icono: 'dog', texto: '2 mascotas' },
        { icono: 'calendar', texto: '28–30 julio' },
      ]);
    });

    it('no debería mostrar resumen de viaje fuera de hoteles', async () => {
      const { params, query } = contexto(VerticalKey.ALOJAMIENTO);
      await crear(params, query);

      expect(componente.resumenViaje()).toEqual([]);
    });

    it('debería adjuntar el perro seleccionado a la reserva', async () => {
      const { params, query } = contexto(VerticalKey.VETERINARIA);
      await crear(params, query, { perros: { misPerros: jest.fn().mockResolvedValue([perro()]) } });
      componente.paso1VeterinariaForm.patchValue({ fecha: '2026-09-01', hora: '10:00' });

      componente.irPaso(3);
      await fixture.whenStable();

      expect(dobles.reservas.crear.mock.calls[0][0].perroId).toBe('p1');
    });

    it('debería incluir el espacio elegido en el detalle del alojamiento', async () => {
      const { params, query } = contexto(VerticalKey.ALOJAMIENTO, { espacioId: 'esp1' });
      await crear(params, query);
      componente.paso1AlojamientoForm.patchValue({ checkIn: '2026-09-01', checkOut: '2026-09-02' });

      componente.irPaso(3);
      await fixture.whenStable();

      // Sin el espacio, el comercio no sabría qué suite ha quedado ocupada.
      expect(dobles.reservas.crear.mock.calls[0][0].detalle.espacioId).toBe('esp1');
    });

    it('debería incluir los extras seleccionados en el detalle del alojamiento (HU-15.1/15.2)', async () => {
      const { params, query } = contexto(VerticalKey.ALOJAMIENTO);
      await crear(params, query);
      componente.serviciosAdicionalesAlojamiento.set([{ nombre: 'Paseo extra diario', precio: 10 }]);
      componente.toggleExtra('Paseo extra diario');
      componente.paso1AlojamientoForm.patchValue({ checkIn: '2026-09-01', checkOut: '2026-09-02' });

      componente.irPaso(3);
      await fixture.whenStable();

      expect(dobles.reservas.crear.mock.calls[0][0].detalle.extras).toEqual(['Paseo extra diario']);
    });

    it('no debería enviar el campo extras si no se seleccionó ninguno', async () => {
      const { params, query } = contexto(VerticalKey.ALOJAMIENTO);
      await crear(params, query);
      componente.paso1AlojamientoForm.patchValue({ checkIn: '2026-09-01', checkOut: '2026-09-02' });

      componente.irPaso(3);
      await fixture.whenStable();

      expect(dobles.reservas.crear.mock.calls[0][0].detalle.extras).toBeUndefined();
    });

    it('no debería crear reserva sin servicio ni comercio en la ruta', async () => {
      await crear({ vertical: VerticalKey.ALOJAMIENTO }, {});

      componente.irPaso(3);
      await fixture.whenStable();

      expect(dobles.reservas.crear).not.toHaveBeenCalled();
    });

    it('debería avisar si no se puede preparar el pago', async () => {
      const { params, query } = contexto(VerticalKey.ALOJAMIENTO);
      // Se repone el doble entero: sustituir solo `crearIntent` dejaba al
      // componente sin `configuracion()`, que consulta al arrancar.
      await crear(params, query, {
        payments: {
          crearIntent: jest.fn().mockRejectedValue(new Error('stripe caído')),
          configuracion: jest.fn().mockResolvedValue({ bypassPagoHabilitado: false }),
          confirmarSinCobro: jest.fn().mockResolvedValue(undefined),
        },
      });

      componente.irPaso(3);
      await fixture.whenStable();

      // Nunca dejar al usuario en un paso de pago mudo: si falla, se dice.
      expect(componente.stripeListo()).toBe(false);
      expect(componente.errorPago()).toContain('No se pudo preparar el pago');
    });
  });

  describe('cobro', () => {
    const irAPago = async () => {
      componente.irPaso(3);
      await fixture.whenStable();
    };

    it('debería negarse a cobrar si Stripe no está listo', async () => {
      const { params, query } = contexto(VerticalKey.ALOJAMIENTO);
      await crear(params, query, { stripe: { getStripe: jest.fn().mockResolvedValue(null) } });
      await irAPago();

      await componente.procesarPago();

      // Sin SDK no hay cobro real: simular éxito confirmaría una reserva impagada.
      expect(componente.paso()).not.toBe(4);
      expect(componente.errorPago()).toContain('no está disponible');
    });

    it('debería confirmar y cerrar el embudo tras un pago correcto', async () => {
      const { params, query } = contexto(VerticalKey.ALOJAMIENTO);
      await crear(params, query);
      await irAPago();

      await componente.procesarPago();

      expect(stripeFake.confirmPayment).toHaveBeenCalled();
      expect(dobles.eventos.cerrarEmbudo).toHaveBeenCalledWith('r1', VerticalKey.ALOJAMIENTO);
      expect(componente.paso()).toBe(4);
      expect(componente.procesando()).toBe(false);
    });

    it('debería mostrar el mensaje de Stripe cuando la tarjeta se rechaza', async () => {
      const { params, query } = contexto(VerticalKey.ALOJAMIENTO);
      await crear(params, query);
      await irAPago();
      stripeFake.confirmPayment.mockResolvedValue({ error: { message: 'Tarjeta rechazada' } });

      await componente.procesarPago();

      expect(componente.errorPago()).toBe('Tarjeta rechazada');
      expect(componente.paso()).toBe(3);
    });

    /*
     * La autenticación de la tarjeta (3-D Secure) es obligatoria en la mayoría
     * de emisores europeos, y sin `return_url` Stripe devuelve error en lugar
     * de autenticar: esas tarjetas no tenían forma de completar el pago.
     */
    it('debería dar a Stripe una url de retorno para el 3-D Secure', async () => {
      const { params, query } = contexto(VerticalKey.ALOJAMIENTO);
      await crear(params, query);
      await irAPago();

      await componente.procesarPago();

      const opciones = stripeFake.confirmPayment.mock.calls[0][0];
      expect(opciones.confirmParams.return_url).toContain('/reservas/mis-reservas');
      expect(opciones.redirect).toBe('if_required');
    });

    it('debería avisar de que la confirmación va con retraso si el servidor no la cierra', async () => {
      const { params, query } = contexto(VerticalKey.ALOJAMIENTO);
      await crear(params, query, {
        payments: {
          crearIntent: jest.fn().mockResolvedValue({ clientSecret: 'cs_1', pagoId: 'pago-1', montoTotal: 242 }),
          configuracion: jest.fn().mockResolvedValue({ bypassPagoHabilitado: false }),
          confirmarSinCobro: jest.fn().mockResolvedValue(undefined),
          sincronizar: jest.fn().mockResolvedValue({ estado: 'pendiente' }),
        },
      });
      await irAPago();

      await componente.procesarPago();

      // Se llega igual a la confirmación —el dinero está cobrado—, pero sin
      // prometer una reserva que el listado enseña como pendiente.
      expect(componente.paso()).toBe(4);
      expect(componente.confirmacionPendiente()).toBe(true);
    });

    it('no debería avisar de retraso cuando el servidor confirma en el acto', async () => {
      const { params, query } = contexto(VerticalKey.ALOJAMIENTO);
      await crear(params, query);
      await irAPago();

      await componente.procesarPago();

      expect(componente.confirmacionPendiente()).toBe(false);
    });
  });

  describe('trayecto de transporte', () => {
    it('debería rellenar la distancia al fijar origen y destino', async () => {
      const { params, query } = contexto(VerticalKey.TRANSPORTE);
      await crear(params, query);

      componente.fijarOrigen({ placeId: 'o1', descripcion: 'Madrid' } as never);
      componente.fijarDestino({ placeId: 'd1', descripcion: 'Toledo' } as never);
      await fixture.whenStable();

      expect(componente.paso1TransporteForm.value.distanciaKm).toBe(70);
      expect(componente.resumenTrayecto()).toContain('por carretera');
    });

    it('debería marcar la distancia como aproximada cuando es una estimación', async () => {
      const { params, query } = contexto(VerticalKey.TRANSPORTE);
      await crear(params, query, {
        geo: { trayecto: jest.fn().mockResolvedValue({ km: 65, duracionMin: 50, esEstimacion: true }) },
      });

      componente.fijarOrigen({ placeId: 'o1' } as never);
      componente.fijarDestino({ placeId: 'd1' } as never);
      await fixture.whenStable();

      expect(componente.resumenTrayecto()).toContain('estimación');
    });

    it('debería pedir la distancia al usuario si no se puede calcular', async () => {
      const { params, query } = contexto(VerticalKey.TRANSPORTE);
      await crear(params, query, { geo: { trayecto: jest.fn().mockResolvedValue(null) } });

      componente.fijarOrigen({ placeId: 'o1' } as never);
      componente.fijarDestino({ placeId: 'd1' } as never);
      await fixture.whenStable();

      expect(componente.resumenTrayecto()).toContain('indícala tú');
      expect(componente.calculandoTrayecto()).toBe(false);
    });

    it('no debería calcular nada con un solo extremo del trayecto', async () => {
      const { params, query } = contexto(VerticalKey.TRANSPORTE);
      await crear(params, query);

      componente.fijarOrigen({ placeId: 'o1' } as never);
      await fixture.whenStable();

      expect(dobles.geo.trayecto).not.toHaveBeenCalled();
    });
  });

  describe('número de perros', () => {
    it('debería subir y bajar el contador', async () => {
      const { params, query } = contexto(VerticalKey.ALOJAMIENTO);
      await crear(params, query);
      const control = componente.paso1AlojamientoForm.controls.perros;

      componente.cambiarPerros(control, 2);
      expect(control.value).toBe(3);

      componente.cambiarPerros(control, -1);
      expect(control.value).toBe(2);
    });

    it('nunca debería bajar de un perro', async () => {
      const { params, query } = contexto(VerticalKey.ALOJAMIENTO);
      await crear(params, query);
      const control = componente.paso1AlojamientoForm.controls.perros;

      componente.cambiarPerros(control, -5);

      expect(control.value).toBe(1);
      expect(componente.puedeQuitarPerros(control)).toBe(false);
    });
  });

  describe('catálogo enriquecido', () => {
    it('debería filtrar el grooming por el tipo de pelo del perro', async () => {
      const { params, query } = contexto(VerticalKey.PELUQUERIA);
      await crear(params, query, {
        perros: { misPerros: jest.fn().mockResolvedValue([perro({ tipoPelo: ['largo'] })]) },
        catalog: {
          obtener: jest.fn().mockResolvedValue({
            extra: {
              serviciosGrooming: [
                { nombre: 'Deslanado', precio: 40, tipoPeloCompatible: ['largo'] },
                { nombre: 'Rasurado', precio: 30, tipoPeloCompatible: ['rizado'] },
                { nombre: 'Baño', precio: 20 },
              ],
            },
          }),
        },
      });

      const nombres = componente.serviciosGroomingOpciones().map((s) => s.nombre);
      expect(nombres).toEqual(['Deslanado', 'Baño']);
    });

    it('debería elegir un servicio compatible si el actual no lo es', async () => {
      const { params, query } = contexto(VerticalKey.PELUQUERIA);
      await crear(params, query, {
        perros: { misPerros: jest.fn().mockResolvedValue([perro({ tipoPelo: ['largo'] })]) },
        catalog: {
          obtener: jest.fn().mockResolvedValue({
            extra: { serviciosGrooming: [{ nombre: 'Deslanado', precio: 40, tipoPeloCompatible: ['largo'] }] },
          }),
        },
      });

      expect(componente.paso1PeluqueriaForm.value.servicio).toBe('Deslanado');
    });

    it('debería cobrar el precio del tramo correspondiente al tamaño del perro', async () => {
      const { params, query } = contexto(VerticalKey.PELUQUERIA);
      await crear(params, query, {
        perros: { misPerros: jest.fn().mockResolvedValue([perro({ tamano: 'grande' })]) },
      });

      const servicio = {
        nombre: 'Baño', precio: 20,
        preciosPorTamano: [{ tamano: 'grande', precio: 35, duracionMin: 60 }],
      };
      expect(componente.precioServicioGrooming(servicio)).toBe(35);
    });

    it('debería usar el precio general si el tamaño no tiene tramo propio', async () => {
      const { params, query } = contexto(VerticalKey.PELUQUERIA);
      await crear(params, query, {
        perros: { misPerros: jest.fn().mockResolvedValue([perro({ tamano: 'pequeno' })]) },
      });

      const servicio = {
        nombre: 'Baño', precio: 20,
        preciosPorTamano: [{ tamano: 'grande', precio: 35, duracionMin: 60 }],
      };
      expect(componente.precioServicioGrooming(servicio)).toBe(20);
    });

    it('debería cargar los servicios clínicos del veterinario', async () => {
      const { params, query } = contexto(VerticalKey.VETERINARIA);
      await crear(params, query, {
        catalog: {
          obtener: jest.fn().mockResolvedValue({
            extra: { serviciosClinicos: [{ nombre: 'consulta', precio: 40 }] },
          }),
        },
      });
      componente.paso1VeterinariaForm.patchValue({ servicio: 'consulta' });

      expect(componente.servicioClinicoSeleccionado()).toMatchObject({ precio: 40 });
    });

    it('debería ocultar los programas fuera del rango de edad del perro', async () => {
      const { params, query } = contexto(VerticalKey.ADIESTRAMIENTO);
      await crear(params, query, {
        catalog: {
          obtener: jest.fn().mockResolvedValue({
            extra: {
              serviciosAdiestramiento: [
                { nombre: 'Cachorros', tipo: 'basico', precio: 50, edadMaximaMeses: 6 },
                { nombre: 'Obediencia', tipo: 'basico', precio: 60, edadMinimaMeses: 6 },
              ],
            },
          }),
        },
      });
      componente.paso1AdiestramientoForm.patchValue({ edadMeses: 24 });

      expect(componente.serviciosAdiestramientoOpciones().map((s) => s.nombre)).toEqual(['Obediencia']);
    });

    it('debería cargar los servicios adicionales configurados por el comercio de alojamiento (HU-15.1/15.2)', async () => {
      const { params, query } = contexto(VerticalKey.ALOJAMIENTO);
      await crear(params, query, {
        catalog: {
          obtener: jest.fn().mockResolvedValue({
            extra: { serviciosAdicionales: [{ nombre: 'Recogida a domicilio', precio: 15 }] },
          }),
        },
      });

      expect(componente.serviciosAdicionalesAlojamiento()).toEqual([{ nombre: 'Recogida a domicilio', precio: 15 }]);
    });

    it('debería cargar los suplementos del hotel configurados por el comercio (HU-15.1/15.2)', async () => {
      const { params, query } = contexto(VerticalKey.HOTELES);
      await crear(params, query, {
        catalog: {
          obtener: jest.fn().mockResolvedValue({
            extra: {
              suplementoPorTamanoMascota: [{ tamano: 'grande', precioPorNoche: 20 }],
              suplementoSegundaMascotaPorNoche: 8,
            },
          }),
        },
      });
      componente.paso1HotelesForm.patchValue({
        checkIn: '2026-09-01', checkOut: '2026-09-03', mascotas: 2, tamanoPerro: 'grande',
      });

      // 2 noches × (20 tamaño + 8 segunda mascota) = 56
      expect(componente.suplementoHotel()).toBe(56);
      expect(componente.subtotal()).toBe(componente.precioBase() * 2 + 56);
    });

    it('el suplemento del hotel debería ser 0 si no hay configuración', async () => {
      const { params, query } = contexto(VerticalKey.HOTELES);
      await crear(params, query);
      componente.paso1HotelesForm.patchValue({ checkIn: '2026-09-01', checkOut: '2026-09-03' });

      expect(componente.suplementoHotel()).toBe(0);
    });

    it('debería seguir funcionando si el catálogo enriquecido falla', async () => {
      const { params, query } = contexto(VerticalKey.PELUQUERIA);
      await crear(params, query, { catalog: { obtener: jest.fn().mockRejectedValue(new Error('404')) } });

      expect(componente.peluqueriaDetalle()).toBeNull();
      expect(componente.serviciosGroomingOpciones()).toEqual([]);
    });
  });

  /**
   * Funerarios sustituyó a «cuidadores» en el catálogo (2026-09-01) y llegó sin
   * ninguna prueba de reserva, siendo el vertical con el paso 1 más exigente:
   * el precio se compone de cuatro cosas y la ficha decide qué se puede pedir.
   */
  describe('funerarios', () => {
    const CATALOGO = {
      serviciosFunerarios: [
        {
          nombre: 'Cremación individual', tipo: 'cremacion_individual', precioBase: 180,
          devuelveCenizas: true, urnaIncluida: true, certificadoIncluido: true, activo: true,
          tramosPeso: [{ hastaKg: 10, precio: 150 }, { hastaKg: 30, precio: 260 }],
        },
        {
          nombre: 'Cremación colectiva', tipo: 'cremacion_colectiva', precioBase: 90,
          devuelveCenizas: false, urnaIncluida: false, certificadoIncluido: false, activo: true,
        },
        { nombre: 'Retirado', tipo: 'otros', precioBase: 50, devuelveCenizas: true, activo: false },
      ],
      extras: [
        { nombre: 'Urna de madera', precio: 45, activo: true },
        { nombre: 'Ceremonia', precio: 120, activo: false },
      ],
      ofreceRecogida: true,
      radioRecogidaKm: 25,
      modoPrecioRecogida: 'fija',
      precioRecogida: 40,
      lugaresRecogida: ['domicilio'],
      franjasDisponibles: ['manana'],
      suplementoUrgencia: 60,
    };

    const conCatalogo = async (extra: Record<string, unknown> = CATALOGO) => {
      const ctx = contexto(VerticalKey.FUNERARIOS);
      await crear(ctx.params, ctx.query, {
        catalog: { obtener: jest.fn().mockResolvedValue({ extra }) },
      });
    };

    describe('catálogo de la empresa', () => {
      it('debería ofrecer sólo los servicios activos', async () => {
        await conCatalogo();

        expect(componente.serviciosFunerariosDisponibles().map((s) => s.nombre))
          .toEqual(['Cremación individual', 'Cremación colectiva']);
      });

      it('debería ofrecer sólo los extras activos', async () => {
        await conCatalogo();

        expect(componente.extrasFunerariosDisponibles().map((e) => e.nombre))
          .toEqual(['Urna de madera']);
      });

      it('debería ofrecer sólo los lugares desde los que recoge', async () => {
        await conCatalogo();

        expect(componente.lugaresRecogidaDisponibles().map((l) => l.valor)).toEqual(['domicilio']);
      });

      it('debería ofrecer todos los lugares si la empresa no declara ninguno', async () => {
        await conCatalogo({ ...CATALOGO, lugaresRecogida: [] });

        expect(componente.lugaresRecogidaDisponibles().length)
          .toBe(Object.values(LugarRecogida).length);
      });

      it('debería ofrecer sólo las franjas declaradas', async () => {
        await conCatalogo();

        expect(componente.franjasFunerarioDisponibles().map((f) => f.valor)).toEqual(['manana']);
      });

      it('debería ofrecer todas las franjas si la empresa no declara ninguna', async () => {
        await conCatalogo({ ...CATALOGO, franjasDisponibles: [] });

        expect(componente.franjasFunerarioDisponibles().length)
          .toBe(Object.values(FranjaHoraria).length);
      });

      it('no debería pedir zona si la empresa no tarifica por zonas', async () => {
        await conCatalogo();

        expect(componente.zonasRecogidaDisponibles()).toEqual([]);
      });

      it('debería pedir zona cuando la empresa tarifica por zonas', async () => {
        await conCatalogo({
          ...CATALOGO,
          modoPrecioRecogida: ModoPrecioRecogida.POR_ZONA,
          zonasRecogida: [{ nombre: 'Norte', precio: 30 }],
        });

        expect(componente.zonasRecogidaDisponibles()).toEqual([{ nombre: 'Norte', precio: 30 }]);
      });
    });

    describe('precio cerrado del paso 1', () => {
      /*
       * La urgencia por defecto del formulario es «lo antes posible», que sí
       * lleva suplemento. Estas pruebas miden las otras partes del precio, así
       * que parten de una fecha elegida, que no lo lleva.
       */
      const elegir = (patch: Record<string, unknown>): void => {
        componente.paso1FunerariosForm.patchValue({
          servicioNombre: 'Cremación individual', pesoKg: 8,
          urgencia: UrgenciaFunerario.FECHA, fecha: '2026-09-10',
          ...patch,
        });
      };

      it('debería cobrar el tramo de peso que corresponde', async () => {
        await conCatalogo();

        elegir({ pesoKg: 8 });
        expect(componente.subtotal()).toBe(150);

        elegir({ pesoKg: 25 });
        expect(componente.subtotal()).toBe(260);
      });

      it('debería cobrar el tramo más alto por encima del último', async () => {
        await conCatalogo();

        elegir({ pesoKg: 60 });

        expect(componente.subtotal()).toBe(260);
      });

      it('debería usar el precio base de un servicio sin tramos', async () => {
        await conCatalogo();

        elegir({ servicioNombre: 'Cremación colectiva', aceptaSinCenizas: true });

        expect(componente.subtotal()).toBe(90);
      });

      it('debería sumar la recogida a precio fijo', async () => {
        await conCatalogo();

        elegir({ necesitaRecogida: true });

        expect(componente.subtotal()).toBe(190);
      });

      it('debería sumar la recogida por kilómetro', async () => {
        await conCatalogo({
          ...CATALOGO, modoPrecioRecogida: ModoPrecioRecogida.POR_KM, precioRecogidaPorKm: 1.5,
        });

        elegir({ necesitaRecogida: true, distanciaKm: 20 });

        expect(componente.subtotal()).toBe(180);
      });

      it('debería sumar la recogida por zona', async () => {
        await conCatalogo({
          ...CATALOGO,
          modoPrecioRecogida: ModoPrecioRecogida.POR_ZONA,
          zonasRecogida: [{ nombre: 'Norte', precio: 30 }],
        });

        elegir({ necesitaRecogida: true, zonaRecogida: 'Norte' });

        expect(componente.subtotal()).toBe(180);
      });

      it('no debería cobrar recogida si el cliente no la pide', async () => {
        await conCatalogo();

        elegir({ necesitaRecogida: false });

        expect(componente.subtotal()).toBe(150);
      });

      it('debería sumar el suplemento sólo en una urgencia real', async () => {
        await conCatalogo();

        elegir({ urgencia: UrgenciaFunerario.LO_ANTES_POSIBLE });
        expect(componente.subtotal()).toBe(210);

        // Elegir una fecha no es una urgencia: no se cobra el suplemento.
        elegir({ urgencia: UrgenciaFunerario.FECHA, fecha: '2026-09-10' });
        expect(componente.subtotal()).toBe(150);
      });

      it('debería sumar los extras marcados', async () => {
        await conCatalogo();
        elegir({});

        componente.toggleExtraFunerario('Urna de madera');

        expect(componente.subtotal()).toBe(195);
      });

      it('debería poder desmarcar un extra', async () => {
        await conCatalogo();
        elegir({});
        componente.toggleExtraFunerario('Urna de madera');

        componente.toggleExtraFunerario('Urna de madera');

        expect(componente.tieneExtraFunerario('Urna de madera')).toBe(false);
        expect(componente.subtotal()).toBe(150);
      });

      it('no debería poner precio mientras no se elija servicio', async () => {
        await conCatalogo();

        expect(componente.subtotal()).toBe(0);
      });
    });

    describe('lo que el formulario no puede validar solo', () => {
      const rellenarMinimo = (patch: Record<string, unknown> = {}): void => {
        componente.paso1FunerariosForm.patchValue({
          servicioNombre: 'Cremación individual', pesoKg: 8, ...patch,
        });
      };

      it('debería dejar seguir con el mínimo relleno', async () => {
        await conCatalogo();

        rellenarMinimo();

        expect(componente.paso1Valido()).toBe(true);
      });

      it('no debería dejar seguir sin elegir servicio', async () => {
        await conCatalogo();

        expect(componente.paso1Valido()).toBe(false);
      });

      /* Ningún cobro sin consentimiento explícito. */
      it('no debería dejar seguir sin aceptar que no hay cenizas', async () => {
        await conCatalogo();

        rellenarMinimo({ servicioNombre: 'Cremación colectiva' });
        expect(componente.paso1Valido()).toBe(false);

        rellenarMinimo({ servicioNombre: 'Cremación colectiva', aceptaSinCenizas: true });
        expect(componente.paso1Valido()).toBe(true);
      });

      it('no debería dejar pedir recogida a quien no la hace', async () => {
        await conCatalogo({ ...CATALOGO, ofreceRecogida: false });

        rellenarMinimo({ necesitaRecogida: true });

        expect(componente.paso1Valido()).toBe(false);
      });

      it('no debería dejar seguir fuera del radio de recogida', async () => {
        await conCatalogo();

        rellenarMinimo({ necesitaRecogida: true, distanciaKm: 40 });
        expect(componente.paso1Valido()).toBe(false);

        rellenarMinimo({ necesitaRecogida: true, distanciaKm: 25 });
        expect(componente.paso1Valido()).toBe(true);
      });

      it('debería exigir la zona cuando la empresa tarifica por zonas', async () => {
        await conCatalogo({
          ...CATALOGO,
          modoPrecioRecogida: ModoPrecioRecogida.POR_ZONA,
          zonasRecogida: [{ nombre: 'Norte', precio: 30 }],
        });

        rellenarMinimo({ necesitaRecogida: true });
        expect(componente.paso1Valido()).toBe(false);

        rellenarMinimo({ necesitaRecogida: true, zonaRecogida: 'Norte' });
        expect(componente.paso1Valido()).toBe(true);
      });

      it('debería exigir la fecha cuando el cliente elige una', async () => {
        await conCatalogo();

        rellenarMinimo({ urgencia: UrgenciaFunerario.FECHA });
        expect(componente.paso1Valido()).toBe(false);

        rellenarMinimo({ urgencia: UrgenciaFunerario.FECHA, fecha: '2026-09-10' });
        expect(componente.paso1Valido()).toBe(true);
      });
    });

    describe('fecha de inicio según la urgencia', () => {
      const fechaEnviada = async (patch: Record<string, unknown>): Promise<string> => {
        await conCatalogo();
        componente.paso1FunerariosForm.patchValue({
          servicioNombre: 'Cremación individual', pesoKg: 8, ...patch,
        });
        // El alta se dispara al entrar en el paso de pago, igual que en la UI.
        componente.irPaso(3);
        await fixture.whenStable();
        const payload = dobles.reservas.crear.mock.calls.at(-1)?.[0] as Record<string, unknown>;
        return payload['fechaInicio'] as string;
      };

      it('debería mandar el momento actual con «lo antes posible»', async () => {
        const fecha = await fechaEnviada({ urgencia: UrgenciaFunerario.LO_ANTES_POSIBLE });

        // ISO completo con milisegundos: es "ahora", no una franja del día.
        expect(fecha).toMatch(/\dT\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
      });

      it('debería mandar el día siguiente con «mañana», en la franja elegida', async () => {
        const fecha = await fechaEnviada({
          urgencia: UrgenciaFunerario.MANANA, franja: FranjaHoraria.NOCHE,
        });

        const manana = new Date();
        manana.setDate(manana.getDate() + 1);
        expect(fecha).toBe(`${manana.toISOString().slice(0, 10)}T21:00:00`);
      });

      it('debería llevar la mañana a las 09:00', async () => {
        // Aquí no se promete una hora exacta: la franja es lo que se acuerda.
        expect(await fechaEnviada({
          urgencia: UrgenciaFunerario.FECHA, fecha: '2026-09-10', franja: FranjaHoraria.MANANA,
        })).toBe('2026-09-10T09:00:00');
      });

      it('debería llevar la tarde a las 16:00', async () => {
        expect(await fechaEnviada({
          urgencia: UrgenciaFunerario.FECHA, fecha: '2026-09-10', franja: FranjaHoraria.TARDE,
        })).toBe('2026-09-10T16:00:00');
      });
    });
  });

  describe('recomendador', () => {
    it('debería forzar sesión individual si el caso bloquea las grupales', async () => {
      const { params, query } = contexto(VerticalKey.ADIESTRAMIENTO);
      await crear(params, query, {
        recomendador: {
          adiestramiento: jest.fn().mockResolvedValue({ modalidad: 'sesion', bloqueaGrupales: true }),
          veterinaria: jest.fn(),
        },
      });
      componente.paso1AdiestramientoForm.patchValue({ motivo: 'agresividad_perros', intensidad: 'alta' });

      await componente.consultarRecomendacionAdiestramiento();

      // Un perro reactivo en una clase grupal es un riesgo para el resto.
      expect(componente.paso1AdiestramientoForm.value.modalidad).toBe('sesion');
      expect(componente.recomendacionAdiestramiento()).toBeTruthy();
    });

    it('debería consultar el triaje veterinario con motivo y gravedad', async () => {
      const { params, query } = contexto(VerticalKey.VETERINARIA);
      await crear(params, query);
      componente.paso1VeterinariaForm.patchValue({ motivoTriage: 'cojera', gravedad: 'moderada' });

      await componente.consultarRecomendacionVeterinaria();

      expect(dobles.recomendador.veterinaria).toHaveBeenCalledWith('cojera', 'moderada');
      expect(componente.recomendacionVeterinaria()).toBeTruthy();
    });

    it('no debería romper el flujo si el recomendador falla', async () => {
      const { params, query } = contexto(VerticalKey.ADIESTRAMIENTO);
      await crear(params, query, {
        recomendador: {
          adiestramiento: jest.fn().mockRejectedValue(new Error('sin IA')),
          veterinaria: jest.fn().mockRejectedValue(new Error('sin IA')),
        },
      });

      await componente.consultarRecomendacionAdiestramiento();
      await componente.consultarRecomendacionVeterinaria();

      expect(componente.recomendacionAdiestramiento()).toBeNull();
      expect(componente.recomendacionVeterinaria()).toBeNull();
    });
  });

  describe('continuar el viaje', () => {
    it('debería ofrecer completar el viaje tras reservar alojamiento', async () => {
      const { params, query } = contexto(VerticalKey.ALOJAMIENTO);
      await crear(params, query);

      expect(componente.ofreceCompletarViaje()).toBe(true);
    });

    it('no debería ofrecerlo en verticales sin fechas ni destino propios', async () => {
      const { params, query } = contexto(VerticalKey.VETERINARIA);
      await crear(params, query);

      expect(componente.ofreceCompletarViaje()).toBe(false);
    });

    it('debería arrastrar ciudad y fecha al siguiente servicio', async () => {
      const { params, query } = contexto(VerticalKey.ALOJAMIENTO, { ciudad: 'Madrid', desde: '2026-09-01' });
      await crear(params, query);

      expect(componente.parametrosViaje()).toEqual({ ciudad: 'Madrid', desde: '2026-09-01' });
    });
  });

  describe('etiquetas por vertical', () => {
    it('debería adaptar títulos y textos a cada vertical', async () => {
      const { params, query } = contexto(VerticalKey.HOTELES);
      await crear(params, query);

      // HU-5.7.1: en hoteles el paso 1 es "Tu viaje", no "Tu estancia".
      expect(componente.paso1Label()).toBe('Tu viaje');
      expect(componente.paso1Titulo()).toContain('pet-friendly');
      expect(componente.iconoVertical()).toBe('hotel');
      expect(componente.peticionesPlaceholder()).toContain('mascota');
    });

    it('debería resumir la línea de precio según el vertical', async () => {
      const { params, query } = contexto(VerticalKey.ALOJAMIENTO);
      await crear(params, query);
      componente.paso1AlojamientoForm.patchValue({ checkIn: '2026-09-01', checkOut: '2026-09-03', perros: 2 });

      expect(componente.lineaResumen()).toBe('50 € × 2 noches · 2 perros');
    });

    it('debería distinguir programa de sesión en adiestramiento', async () => {
      const { params, query } = contexto(VerticalKey.ADIESTRAMIENTO);
      await crear(params, query);
      componente.paso1AdiestramientoForm.patchValue({ modalidad: 'programa' });

      expect(componente.lineaResumen()).toContain('Programa');
    });

    it('debería resumir el trayecto y la cita según el vertical', async () => {
      const { params, query } = contexto(VerticalKey.TRANSPORTE);
      await crear(params, query);

      expect(componente.lineaResumen()).toContain('Tarifa base');
      expect(componente.precioPorLabel()).toBe('trayecto');
      expect(componente.paso1Label()).toBe('Tu trayecto');
    });

    it('debería resumir la cita veterinaria', async () => {
      const { params, query } = contexto(VerticalKey.VETERINARIA);
      await crear(params, query);

      expect(componente.lineaResumen()).toContain('Cita veterinaria');
      expect(componente.iconoVertical()).toBe('stethoscope');
      expect(componente.peticionesPlaceholder()).toContain('Síntomas');
    });

    it('debería resumir la cita de peluquería', async () => {
      const { params, query } = contexto(VerticalKey.PELUQUERIA);
      await crear(params, query);

      expect(componente.lineaResumen()).toContain('peluquería');
      expect(componente.paso1Titulo()).toContain('peluquería');
    });

    it('debería contar las noches del hotel en el resumen', async () => {
      const { params, query } = contexto(VerticalKey.HOTELES);
      await crear(params, query);
      componente.paso1HotelesForm.patchValue({ checkIn: '2026-09-01', checkOut: '2026-09-02' });

      expect(componente.lineaResumen()).toContain('1 noche');
      expect(componente.subtotal()).toBe(50);
    });

    it('debería usar textos neutros en un vertical no contemplado', async () => {
      await crear({ vertical: 'inventado', servicioId: 's1' }, { precioBase: '50' });

      expect(componente.paso1Label()).toBe('Selección');
      expect(componente.paso1Titulo()).toContain('Resumen');
      expect(componente.iconoVertical()).toBe('paw');
      expect(componente.precioPorLabel()).toBe('');
      expect(componente.lineaResumen()).toBe('50 €');
      expect(componente.paso1Valido()).toBe(false);
      expect(componente.verticaLabel()).toBe('inventado');
    });

    it('debería nombrar los extras seleccionados con su precio', async () => {
      const { params, query } = contexto(VerticalKey.ALOJAMIENTO);
      await crear(params, query);
      componente.serviciosAdicionalesAlojamiento.set([{ nombre: 'Baño y cepillado', precio: 25 }]);

      expect(componente.extraNombre('Baño y cepillado')).toBe('Baño y cepillado');
      expect(componente.extraPrecio('Baño y cepillado')).toBe(25);
      expect(componente.extraNombre('inexistente')).toBe('');
      expect(componente.extraPrecio('inexistente')).toBe(0);
    });
  });
  /**
   * Cada vertical arma su propio payload. Un campo que no viaja no da error: el
   * comercio recibe la reserva sin el dato y se entera al atender al perro.
   */
  describe('payload por vertical', () => {
    /** Dispara el alta de la reserva y devuelve el payload que se envio. */
    const payloadEnviado = async (): Promise<Record<string, unknown>> => {
      // El alta se dispara al entrar en el paso de pago, igual que en la UI.
      componente.irPaso(3);
      await fixture.whenStable();
      return dobles.reservas.crear.mock.calls.at(-1)?.[0] as Record<string, unknown>;
    };

    it('deberia enviar servicio, comercio y vertical del contexto de la ruta', async () => {
      const ctx = contexto(VerticalKey.ALOJAMIENTO);
      await crear(ctx.params, ctx.query);
      componente.paso1AlojamientoForm.patchValue({ checkIn: '2026-09-01', checkOut: '2026-09-05', perros: 2 });

      const payload = await payloadEnviado();

      expect(payload['servicioId']).toBe('s1');
      expect(payload['comercioId']).toBe('c1');
      expect(payload['vertical']).toBe(VerticalKey.ALOJAMIENTO);
    });

    it('deberia mandar las noches y el numero de perros en alojamiento', async () => {
      const ctx = contexto(VerticalKey.ALOJAMIENTO);
      await crear(ctx.params, ctx.query);
      componente.paso1AlojamientoForm.patchValue({ checkIn: '2026-09-01', checkOut: '2026-09-05', perros: 2 });

      const payload = await payloadEnviado();

      expect(payload['fechaInicio']).toBe('2026-09-01');
      expect(payload['fechaFin']).toBe('2026-09-05');
      expect(payload['cantidad']).toBe(2);
    });

    it('deberia componer fecha y franja en funerarios', async () => {
      // El backend espera un ISO completo: la franja elegida se traduce a hora.
      const ctx = contexto(VerticalKey.FUNERARIOS);
      await crear(ctx.params, ctx.query);
      componente.paso1FunerariosForm.patchValue({
        servicioNombre: 'Cremación individual', pesoKg: 12,
        urgencia: UrgenciaFunerario.FECHA, fecha: '2026-09-01', franja: FranjaHoraria.TARDE,
      });

      const payload = await payloadEnviado();

      expect(payload['fechaInicio']).toBe('2026-09-01T16:00:00');
      const detalle = payload['detalle'] as Record<string, unknown>;
      expect(detalle['servicioNombre']).toBe('Cremación individual');
      expect(detalle['pesoKg']).toBe(12);
    });

    it('no deberia mandar los datos de recogida si el cliente no la pide', async () => {
      // Mandarlos igualmente haría que la estrategia cobrara un desplazamiento
      // que nadie ha pedido, o que rechazara la reserva por cobertura.
      const ctx = contexto(VerticalKey.FUNERARIOS);
      await crear(ctx.params, ctx.query);
      componente.paso1FunerariosForm.patchValue({
        servicioNombre: 'Cremación individual', pesoKg: 12,
        necesitaRecogida: false, distanciaKm: 30, zonaRecogida: 'Norte',
      });

      const detalle = (await payloadEnviado())['detalle'] as Record<string, unknown>;

      expect(detalle['necesitaRecogida']).toBe(false);
      expect(detalle['distanciaKm']).toBeUndefined();
      expect(detalle['zonaRecogida']).toBeUndefined();
    });

    it('deberia mandar adultos, ninos y tamano en hoteles', async () => {
      const ctx = contexto(VerticalKey.HOTELES);
      await crear(ctx.params, ctx.query);
      componente.paso1HotelesForm.patchValue({
        checkIn: '2026-09-01', checkOut: '2026-09-03', mascotas: 1,
        adultos: 2, ninos: 1, tamanoPerro: 'grande',
      });

      const detalle = (await payloadEnviado())['detalle'] as Record<string, unknown>;

      expect(detalle).toMatchObject({ adultos: 2, ninos: 1, tamanoPerro: 'grande' });
    });

    it('deberia omitir los campos vacios de adiestramiento en vez de mandar cadenas vacias', async () => {
      const ctx = contexto(VerticalKey.ADIESTRAMIENTO);
      await crear(ctx.params, ctx.query);
      componente.paso1AdiestramientoForm.patchValue({
        fechaInicio: '2026-09-01', modalidad: 'sesion', edadMeses: 8, motivo: '',
      });

      const detalle = (await payloadEnviado())['detalle'] as Record<string, unknown>;

      expect(detalle['edadMeses']).toBe(8);
      expect(detalle['motivo']).toBeUndefined();
    });

    it('no deberia adjuntar la clave de videos si no se subio ninguno', async () => {
      const ctx = contexto(VerticalKey.ADIESTRAMIENTO);
      await crear(ctx.params, ctx.query);
      componente.paso1AdiestramientoForm.patchValue({ fechaInicio: '2026-09-01', modalidad: 'sesion' });

      const detalle = (await payloadEnviado())['detalle'] as Record<string, unknown>;

      expect(detalle['videosUrl']).toBeUndefined();
    });

    it('deberia adjuntar el perro seleccionado', async () => {
      const ctx = contexto(VerticalKey.ALOJAMIENTO);
      await crear(ctx.params, ctx.query);
      componente.paso1AlojamientoForm.patchValue({ checkIn: '2026-09-01', checkOut: '2026-09-02' });
      componente.seleccionarPerro('perro-1');

      expect((await payloadEnviado())['perroId']).toBe('perro-1');
    });
  });

  describe('catalogo enriquecido por vertical', () => {
    it('deberia guardar las tarifas de transporte cuando el catalogo las trae', async () => {
      const ctx = contexto(VerticalKey.TRANSPORTE);
      await crear(ctx.params, ctx.query, {
        catalog: { obtener: jest.fn().mockResolvedValue({ extra: { tarifaBase: 15, tarifaKm: 0.9 } }) },
      });

      expect(componente.tarifasTransporte()).toEqual({ tarifaBase: 15, tarifaKm: 0.9 });
    });

    it('no deberia fijar tarifas a medias si falta una de las dos', async () => {
      // Con solo una, el resumen daria un precio inventado.
      const ctx = contexto(VerticalKey.TRANSPORTE);
      await crear(ctx.params, ctx.query, {
        catalog: { obtener: jest.fn().mockResolvedValue({ extra: { tarifaBase: 15 } }) },
      });

      expect(componente.tarifasTransporte()).toBeNull();
    });

    it('deberia seguir funcionando si el catalogo detallado no responde', async () => {
      const ctx = contexto(VerticalKey.TRANSPORTE);
      await crear(ctx.params, ctx.query, {
        catalog: { obtener: jest.fn().mockRejectedValue(new Error('500')) },
      });

      expect(componente.tarifasTransporte()).toBeNull();
    });

    it('deberia cargar los suplementos del hotel', async () => {
      const ctx = contexto(VerticalKey.HOTELES);
      await crear(ctx.params, ctx.query, {
        catalog: {
          obtener: jest.fn().mockResolvedValue({
            extra: { suplementoSegundaMascotaPorNoche: 12, suplementoPorTamanoMascota: [] },
          }),
        },
      });

      expect(componente.hotelSuplementos()?.suplementoSegundaMascotaPorNoche).toBe(12);
    });

    it('deberia dejar los suplementos a cero si el hotel no los declara', async () => {
      const ctx = contexto(VerticalKey.HOTELES);
      await crear(ctx.params, ctx.query, {
        catalog: { obtener: jest.fn().mockResolvedValue({ extra: {} }) },
      });

      expect(componente.hotelSuplementos()?.suplementoSegundaMascotaPorNoche).toBe(0);
    });

    it('deberia cargar los servicios adicionales de alojamiento', async () => {
      const ctx = contexto(VerticalKey.ALOJAMIENTO);
      await crear(ctx.params, ctx.query, {
        catalog: {
          obtener: jest.fn().mockResolvedValue({
            extra: { serviciosAdicionales: [{ nombre: 'Paseo extra', precio: 8 }] },
          }),
        },
      });

      expect(componente.serviciosAdicionalesAlojamiento()).toHaveLength(1);
    });

    it('deberia dejar la lista vacia si el vertical no declara adicionales', async () => {
      const ctx = contexto(VerticalKey.ALOJAMIENTO);
      await crear(ctx.params, ctx.query);

      expect(componente.serviciosAdicionalesAlojamiento()).toEqual([]);
    });
  });

  describe('sincronizacion del servicio de peluqueria con el perro', () => {
    const conGrooming = (servicios: unknown[]) => ({
      catalog: { obtener: jest.fn().mockResolvedValue({ extra: { serviciosGrooming: servicios } }) },
    });

    it('deberia elegir el primer servicio compatible al cambiar de perro', async () => {
      // Si el servicio elegido deja de estar disponible para ese perro, el
      // formulario se quedaria apuntando a algo que el comercio no puede hacer.
      const ctx = contexto(VerticalKey.PELUQUERIA);
      await crear(ctx.params, ctx.query, conGrooming([{ nombre: 'Baño', precio: 25 }]));

      componente.seleccionarPerro('perro-1');

      expect(componente.perroSeleccionado()).toBe('perro-1');
    });

    it('no deberia tocar el servicio en otros verticales', async () => {
      const ctx = contexto(VerticalKey.ALOJAMIENTO);
      await crear(ctx.params, ctx.query);

      componente.seleccionarPerro('perro-1');

      expect(componente.perroSeleccionado()).toBe('perro-1');
    });
  });
  describe('datos de contacto del paso 2 (feedback 2026-08-20)', () => {
    const sesion = (nombre: string, email = 'ana@doogking.com') => ({
      auth: autenticacion({ id: 'u1', nombre, email, rol: 'cliente' }),
    });

    it('deberia llegar relleno para quien ya tiene sesion', async () => {
      const ctx = contexto(VerticalKey.ALOJAMIENTO);
      await crear(ctx.params, ctx.query, sesion('Ana Garcia Ruiz'));

      expect(componente.paso2Form.value).toMatchObject({
        nombre: 'Ana',
        apellidos: 'Garcia Ruiz',
        email: 'ana@doogking.com',
      });
    });

    it('deberia dejar los apellidos vacios si el nombre es una sola palabra', async () => {
      // El `required` obliga entonces a completarlos, que es lo que se quiere.
      const ctx = contexto(VerticalKey.ALOJAMIENTO);
      await crear(ctx.params, ctx.query, sesion('Ana'));

      expect(componente.paso2Form.value.nombre).toBe('Ana');
      expect(componente.paso2Form.value.apellidos).toBe('');
    });

    it('no deberia rellenar nada sin sesion', async () => {
      const ctx = contexto(VerticalKey.ALOJAMIENTO);
      await crear(ctx.params, ctx.query);

      expect(componente.paso2Form.value).toMatchObject({ nombre: '', apellidos: '', email: '' });
    });

    it('deberia completar el telefono que llega del perfil', async () => {
      const ctx = contexto(VerticalKey.ALOJAMIENTO);
      await crear(ctx.params, ctx.query, sesion('Ana Garcia'));

      const http = TestBed.inject(HttpTestingController);
      http.expectOne((r) => r.url.endsWith('/users/me')).flush({ telefono: '+34600111222' });
      await fixture.whenStable();

      expect(componente.paso2Form.value.telefono).toBe('+34600111222');
    });

    it('no deberia pisar el telefono que el usuario ya esta escribiendo', async () => {
      // El perfil llega tarde; lo tecleado manda.
      const ctx = contexto(VerticalKey.ALOJAMIENTO);
      await crear(ctx.params, ctx.query, sesion('Ana Garcia'));

      componente.paso2Form.controls.telefono.setValue('+34699000111');
      componente.paso2Form.controls.telefono.markAsDirty();

      const http = TestBed.inject(HttpTestingController);
      http.expectOne((r) => r.url.endsWith('/users/me')).flush({ telefono: '+34600111222' });
      await fixture.whenStable();

      expect(componente.paso2Form.value.telefono).toBe('+34699000111');
    });

    it('no deberia romper la reserva si el perfil falla', async () => {
      const ctx = contexto(VerticalKey.ALOJAMIENTO);
      await crear(ctx.params, ctx.query, sesion('Ana Garcia'));

      const http = TestBed.inject(HttpTestingController);
      http.expectOne((r) => r.url.endsWith('/users/me'))
        .flush('nope', { status: 500, statusText: 'Server Error' });

      expect(componente.paso2Form.value.nombre).toBe('Ana');
    });
  });
  describe('confirmacion: valoracion y preguntas frecuentes (feedback 2026-08-20)', () => {
    const enConfirmacion = async (vertical = VerticalKey.ALOJAMIENTO) => {
      const ctx = contexto(vertical);
      await crear(ctx.params, ctx.query);
      componente.paso.set(4);
    };

    it('deberia registrar la nota como evento del embudo', async () => {
      await enConfirmacion();

      componente.valorarExperiencia(5);

      expect(dobles.eventos.registrar).toHaveBeenCalledWith(
        TipoEvento.EXPERIENCIA_VALORADA,
        expect.objectContaining({
          paso: PasoEmbudo.CONFIRMACION,
          payload: { puntuacion: 5 },
        }),
      );
    });

    it('deberia cerrarse al momento si la experiencia fue buena', async () => {
      // Alargar el formulario a quien ha ido bien solo consigue que no vuelva.
      await enConfirmacion();

      componente.valorarExperiencia(4);

      expect(componente.valoracionEnviada()).toBe(true);
      expect(componente.pideMotivoValoracion()).toBe(false);
    });

    it('deberia preguntar que fallo cuando la nota es baja', async () => {
      await enConfirmacion();

      componente.valorarExperiencia(2);

      expect(componente.pideMotivoValoracion()).toBe(true);
      expect(componente.valoracionEnviada()).toBe(false);
    });

    it('no deberia perder la nota si el usuario se va sin escribir el motivo', async () => {
      // La nota viaja al pulsar la estrella, no al enviar el texto.
      await enConfirmacion();

      componente.valorarExperiencia(1);

      expect(dobles.eventos.registrar).toHaveBeenCalledTimes(1);
    });

    it('deberia mandar el motivo escrito junto a la nota', async () => {
      await enConfirmacion();
      componente.valorarExperiencia(2);
      dobles.eventos.registrar.mockClear();

      componente.motivoValoracion.set('  El pago tardo mucho  ');
      componente.enviarMotivoValoracion();

      expect(dobles.eventos.registrar).toHaveBeenCalledWith(
        TipoEvento.EXPERIENCIA_VALORADA,
        expect.objectContaining({
          payload: { puntuacion: 2, motivo: 'El pago tardo mucho' },
        }),
      );
      expect(componente.valoracionEnviada()).toBe(true);
    });

    it('no deberia mandar nada si el motivo se deja vacio', async () => {
      await enConfirmacion();
      componente.valorarExperiencia(3);
      dobles.eventos.registrar.mockClear();

      componente.enviarMotivoValoracion();

      expect(dobles.eventos.registrar).not.toHaveBeenCalled();
      expect(componente.valoracionEnviada()).toBe(true);
    });

    it('no deberia romper la confirmacion si la telemetria falla', async () => {
      // La reserva ya esta pagada: un error aqui daria a entender lo contrario.
      await enConfirmacion();
      dobles.eventos.registrar.mockImplementation(() => { throw new Error('sin red'); });

      expect(() => componente.valorarExperiencia(5)).not.toThrow();
      expect(componente.valoracionEnviada()).toBe(true);
    });

    it('deberia ofrecer preguntas propias de la categoria reservada', async () => {
      await enConfirmacion(VerticalKey.VETERINARIA);

      expect(componente.faq()[0].pregunta).toContain('cita');
    });

    it('deberia incluir siempre las preguntas comunes', async () => {
      await enConfirmacion(VerticalKey.TRANSPORTE);

      const preguntas = componente.faq().map((p) => p.pregunta);
      expect(preguntas.some((p) => p.includes('cobra el importe'))).toBe(true);
      expect(preguntas.some((p) => p.includes('cancelo'))).toBe(true);
    });
  });
  /**
   * Omitir el pago es un atajo de pruebas. Quien decide si se permite es el
   * API: si el cliente lo dedujese por su cuenta, el boton saldria donde el
   * servidor lo va a rechazar.
   */
  describe('confirmar sin pagar', () => {
    const conBypass = (habilitado: boolean) => ({
      payments: {
        crearIntent: jest.fn().mockResolvedValue({ clientSecret: 'cs_1', pagoId: 'pago-1', montoTotal: 242 }),
        configuracion: jest.fn().mockResolvedValue({ bypassPagoHabilitado: habilitado }),
        confirmarSinCobro: jest.fn().mockResolvedValue(undefined),
      },
    });

    it('no deberia ofrecerlo si el entorno no lo permite', async () => {
      const { params, query } = contexto(VerticalKey.ALOJAMIENTO);
      await crear(params, query, conBypass(false));

      expect(componente.bypassDisponible()).toBe(false);
    });

    it('deberia ofrecerlo cuando el API lo permite', async () => {
      const { params, query } = contexto(VerticalKey.ALOJAMIENTO);
      await crear(params, query, conBypass(true));

      expect(componente.bypassDisponible()).toBe(true);
    });

    it('no deberia ofrecerlo si la consulta falla', async () => {
      // Ante la duda, no se ensena un atajo de pruebas.
      const { params, query } = contexto(VerticalKey.ALOJAMIENTO);
      await crear(params, query, {
        payments: {
          crearIntent: jest.fn().mockResolvedValue({ clientSecret: 'cs_1', pagoId: 'pago-1', montoTotal: 242 }),
          configuracion: jest.fn().mockRejectedValue(new Error('sin red')),
          confirmarSinCobro: jest.fn().mockResolvedValue(undefined),
          sincronizar: jest.fn().mockResolvedValue({ estado: 'aprobado' }),
        },
      });

      expect(componente.bypassDisponible()).toBe(false);
    });

    it('deberia llevar a la confirmacion como un pago normal', async () => {
      const { params, query } = contexto(VerticalKey.ALOJAMIENTO);
      await crear(params, query, conBypass(true));
      componente.reservaIdReal.set('r1');

      await componente.confirmarSinPagar();

      expect(dobles.payments.confirmarSinCobro).toHaveBeenCalledWith('r1');
      expect(componente.paso()).toBe(4);
    });

    it('deberia cerrar el embudo igual que un pago real', async () => {
      // Si no, las reservas de prueba falsearian la medida del recorrido.
      const { params, query } = contexto(VerticalKey.ALOJAMIENTO);
      await crear(params, query, conBypass(true));
      componente.reservaIdReal.set('r1');

      await componente.confirmarSinPagar();

      expect(dobles.eventos.cerrarEmbudo).toHaveBeenCalled();
    });

    it('no deberia intentarlo sin reserva creada', async () => {
      const { params, query } = contexto(VerticalKey.ALOJAMIENTO);
      await crear(params, query, conBypass(true));
      componente.reservaIdReal.set(null);

      await componente.confirmarSinPagar();

      expect(dobles.payments.confirmarSinCobro).not.toHaveBeenCalled();
      expect(componente.errorPago()).toContain('todavía no está creada');
    });

    it('deberia avisar si el servidor lo rechaza', async () => {
      // Pasa si alguien llega con el boton de otro entorno: el API responde 403.
      const { params, query } = contexto(VerticalKey.ALOJAMIENTO);
      await crear(params, query, {
        payments: {
          crearIntent: jest.fn().mockResolvedValue({ clientSecret: 'cs_1', pagoId: 'pago-1', montoTotal: 242 }),
          configuracion: jest.fn().mockResolvedValue({ bypassPagoHabilitado: true }),
          confirmarSinCobro: jest.fn().mockRejectedValue(new Error('403')),
          sincronizar: jest.fn().mockResolvedValue({ estado: 'aprobado' }),
        },
      });
      componente.reservaIdReal.set('r1');

      await componente.confirmarSinPagar();

      expect(componente.errorPago()).toContain('No se pudo confirmar');
      expect(componente.paso()).not.toBe(4);
    });
  });
  /**
   * El motivo por el que no se puede reservar tiene que salir aqui, al elegir
   * las fechas. Antes solo aparecia al entrar en el paso 3, cuando se creaba la
   * reserva: el cliente rellenaba sus datos para chocar al final con el rechazo.
   */
  describe('disponibilidad en el paso 1', () => {
    const conFechas = async (respuesta: unknown) => {
      const { params, query } = contexto(VerticalKey.ALOJAMIENTO);
      await crear(params, query);
      dobles.reservas.comprobarDisponibilidad.mockResolvedValue(respuesta);

      componente.paso1AlojamientoForm.patchValue({ checkIn: '2026-09-01', checkOut: '2026-09-04' });
      fixture.detectChanges();

      // La consulta espera a que el cliente deje de teclear.
      jest.advanceTimersByTime(500);
      await fixture.whenStable();
      fixture.detectChanges();
    };

    beforeEach(() => jest.useFakeTimers({ doNotFake: ['nextTick', 'queueMicrotask'] }));
    afterEach(() => jest.useRealTimers());

    it('deberia consultar al API en cuanto el paso 1 tiene fechas', async () => {
      await conFechas({ disponible: true, precioEstimado: 150 });

      expect(dobles.reservas.comprobarDisponibilidad).toHaveBeenCalledWith(
        expect.objectContaining({ servicioId: 's1', fechaInicio: '2026-09-01', fechaFin: '2026-09-04' }),
      );
      expect(componente.disponibilidad().estado).toBe('ok');
    });

    it('no deberia mandar cupon ni recurrencia: no influyen en si hay hueco', async () => {
      await conFechas({ disponible: true });

      const payload = dobles.reservas.comprobarDisponibilidad.mock.calls[0][0];
      expect(payload).not.toHaveProperty('cuponCodigo');
      expect(payload).not.toHaveProperty('recurrencia');
    });

    it('deberia mostrar el motivo que devuelve el API cuando no hay hueco', async () => {
      await conFechas({ disponible: false, motivo: 'No quedan plazas libres.' });

      expect(componente.disponibilidad()).toEqual({
        estado: 'sin_hueco', motivo: 'No quedan plazas libres.',
      });
      expect(fixture.nativeElement.textContent).toContain('No quedan plazas libres.');
    });

    it('deberia impedir avanzar al paso 2 cuando no hay hueco', async () => {
      await conFechas({ disponible: false, motivo: 'No quedan plazas libres.' });

      const boton: HTMLButtonElement | null =
        fixture.nativeElement.querySelector('.wizard-cta button');
      expect(boton?.disabled).toBe(true);
    });

    it('no deberia bloquear el avance si la consulta falla', async () => {
      // Un fallo de red no es un "no hay hueco": el API vuelve a validar al reservar.
      const { params, query } = contexto(VerticalKey.ALOJAMIENTO);
      await crear(params, query);
      dobles.reservas.comprobarDisponibilidad.mockRejectedValue(new Error('sin red'));

      componente.paso1AlojamientoForm.patchValue({ checkIn: '2026-09-01', checkOut: '2026-09-04' });
      fixture.detectChanges();
      jest.advanceTimersByTime(500);
      await fixture.whenStable();

      expect(componente.disponibilidad().estado).toBe('idle');
    });
  });

  describe('paso 3 — reserva que el API rechaza', () => {
    it('deberia mostrar el motivo del API, no un texto generico', async () => {
      const { params, query } = contexto(VerticalKey.ALOJAMIENTO);
      await crear(params, query);
      dobles.reservas.crear.mockRejectedValue(
        new HttpErrorResponse({ status: 409, error: { message: 'No quedan plazas libres.' } }),
      );
      componente.paso1AlojamientoForm.patchValue({ checkIn: '2026-09-01', checkOut: '2026-09-03' });

      componente.irPaso(3);
      await fixture.whenStable();

      expect(componente.errorPago()).toBe('No quedan plazas libres.');
      // Sin reserva creada no hay nada que confirmar, ni pagando ni con el atajo.
      expect(componente.reservaIdReal()).toBeNull();
    });

    it('deberia caer en el texto generico si el error no trae mensaje', async () => {
      const { params, query } = contexto(VerticalKey.ALOJAMIENTO);
      await crear(params, query);
      dobles.reservas.crear.mockRejectedValue(new Error('boom'));
      componente.paso1AlojamientoForm.patchValue({ checkIn: '2026-09-01', checkOut: '2026-09-03' });

      componente.irPaso(3);
      await fixture.whenStable();

      expect(componente.errorPago()).toContain('No se pudo preparar el pago');
    });
  });
  /**
   * El calendario del paso 1: enseña qué noches tienen plaza y no deja marcar
   * las que no. Vive en un componente aparte; aquí se comprueba el cableado.
   */
  describe('calendario de fechas', () => {
    it('deberia pedir el calendario del servicio al abrir un alojamiento', async () => {
      const { params, query } = contexto(VerticalKey.ALOJAMIENTO);
      await crear(params, query);

      expect(dobles.reservas.calendario).toHaveBeenCalledWith(
        expect.objectContaining({ servicioId: 's1' }),
      );
      expect(componente.diasCalendario()).toHaveLength(1);
    });

    it('deberia arrancar en el mes de las fechas que trae el buscador', async () => {
      const { params, query } = contexto(VerticalKey.ALOJAMIENTO, { checkIn: '2026-10-10' });
      await crear(params, query);

      const consulta = dobles.reservas.calendario.mock.calls[0][0];
      expect(consulta.desde).toBe('2026-10-01');
    });

    it('no deberia pedirlo en un vertical que no se reserva por rango de fechas', async () => {
      // Una peluqueria trabaja por huecos horarios: un calendario de noches
      // libres no significaria nada.
      const { params, query } = contexto(VerticalKey.PELUQUERIA);
      await crear(params, query);

      expect(dobles.reservas.calendario).not.toHaveBeenCalled();
      expect(componente.usaCalendario()).toBe(false);
    });

    it('deberia pasar al formulario el rango elegido en el calendario', async () => {
      const { params, query } = contexto(VerticalKey.ALOJAMIENTO);
      await crear(params, query);

      componente.aplicarRango({ entrada: '2026-09-01', salida: '2026-09-04' });

      expect(componente.paso1AlojamientoForm.value).toMatchObject({
        checkIn: '2026-09-01', checkOut: '2026-09-04',
      });
    });

    it('deberia acumular los meses en vez de reemplazarlos al navegar', async () => {
      // Si cada mes borrase al anterior, volver atras dejaria el calendario en
      // blanco y el rango a caballo entre dos meses no se podria validar.
      const { params, query } = contexto(VerticalKey.ALOJAMIENTO);
      await crear(params, query);
      dobles.reservas.calendario.mockResolvedValue({
        soportado: true, dias: [{ fecha: '2026-12-01', disponible: true, plazasLibres: 1 }],
      });

      await componente.cargarCalendario({ anio: 2026, mes: 12 });

      expect(componente.diasCalendario().map((d) => d.fecha))
        .toEqual(expect.arrayContaining(['2026-09-01', '2026-12-01']));
    });

    it('no deberia volver a pedir un mes ya cargado', async () => {
      const { params, query } = contexto(VerticalKey.ALOJAMIENTO);
      await crear(params, query);
      const llamadas = dobles.reservas.calendario.mock.calls.length;

      const hoy = new Date();
      await componente.cargarCalendario({ anio: hoy.getUTCFullYear(), mes: hoy.getUTCMonth() + 1 });

      expect(dobles.reservas.calendario).toHaveBeenCalledTimes(llamadas);
    });

    it('no deberia guardar dias si el vertical no soporta calendario', async () => {
      const { params, query } = contexto(VerticalKey.ALOJAMIENTO);
      await crear(params, query, {
        reservas: {
          crear: jest.fn().mockResolvedValue({ _id: 'r1', codigo: 'RES-AAAA1111' }),
          comprobarDisponibilidad: jest.fn().mockResolvedValue({ disponible: true }),
          calendario: jest.fn().mockResolvedValue({ soportado: false, dias: [] }),
        },
      });

      expect(componente.diasCalendario()).toEqual([]);
    });

    it('no deberia romper el paso 1 si el calendario falla', async () => {
      // Se espera la llamada directamente en vez de dejarla en el ngOnInit: ahi
      // sale sin await y su rechazo se le acababa achacando a otro test.
      const { params, query } = contexto(VerticalKey.ALOJAMIENTO);
      await crear(params, query);
      const cargadosAntes = componente.diasCalendario().length;
      dobles.reservas.calendario.mockImplementation(() => Promise.reject(new Error('sin red')));

      await expect(componente.cargarCalendario({ anio: 2027, mes: 3 })).resolves.toBeUndefined();

      expect(componente.diasCalendario()).toHaveLength(cargadosAntes);
      expect(componente.cargandoCalendario()).toBe(false);
      expect(componente.paso()).toBe(1);
    });
  });
  /**
   * El API valida el tamaño contra la ficha del perro, no contra lo que diga
   * el desplegable. Si no se igualan, el cliente ve un tamaño y le rechazan la
   * reserva por otro que nunca eligió.
   */
  describe('tamano del perro', () => {
    it('deberia ofrecer la escala completa, incluido mini', async () => {
      // Faltaba "mini": con un espacio que admite hasta mini no habia ninguna
      // opcion elegible y la reserva se rechazaba siempre.
      const { params, query } = contexto(VerticalKey.ALOJAMIENTO);
      await crear(params, query);

      const opciones = [...fixture.nativeElement.querySelectorAll('select[formControlName=tamanoPerro] option')]
        .map((o: HTMLOptionElement) => o.value);
      expect(opciones).toEqual(['mini', 'pequeno', 'mediano', 'grande', 'gigante']);
    });

    it('deberia tomar el tamano de la ficha al elegir un perro', async () => {
      const { params, query } = contexto(VerticalKey.ALOJAMIENTO);
      await crear(params, query, { perros: { misPerros: jest.fn().mockResolvedValue([]) } });

      componente.perros.set([perro({ _id: 'p9', tamano: 'gigante' })]);
      componente.seleccionarPerro('p9');

      expect(componente.paso1AlojamientoForm.value.tamanoPerro).toBe('gigante');
    });

    it('deberia hacerlo tambien con el perro autoseleccionado', async () => {
      // Con un solo perro registrado se elige solo: tiene que sincronizar igual.
      const { params, query } = contexto(VerticalKey.ALOJAMIENTO);
      await crear(params, query, {
        perros: { misPerros: jest.fn().mockResolvedValue([perro({ _id: 'p9', tamano: 'mini' })]) },
      });

      expect(componente.perroSeleccionado()).toBe('p9');
      expect(componente.paso1AlojamientoForm.value.tamanoPerro).toBe('mini');
    });

    it('no deberia tocar el desplegable si la ficha no declara tamano', async () => {
      const { params, query } = contexto(VerticalKey.ALOJAMIENTO);
      await crear(params, query, { perros: { misPerros: jest.fn().mockResolvedValue([]) } });

      componente.perros.set([perro({ _id: 'p9', tamano: undefined })]);
      componente.seleccionarPerro('p9');

      expect(componente.paso1AlojamientoForm.value.tamanoPerro).toBe('mediano');
    });

    it('deberia enseñar el motivo tal cual, sin anadir consejos que no aplican', async () => {
      // "Prueba con otras fechas" no arregla una incompatibilidad de tamano.
      const { params, query } = contexto(VerticalKey.ALOJAMIENTO);
      await crear(params, query);
      jest.useFakeTimers({ doNotFake: ['nextTick', 'queueMicrotask'] });
      dobles.reservas.comprobarDisponibilidad.mockResolvedValue({
        disponible: false, motivo: 'Este espacio solo admite perros de tamano Mini (0-5 kg) o menor.',
      });

      componente.paso1AlojamientoForm.patchValue({ checkIn: '2026-09-01', checkOut: '2026-09-04' });
      fixture.detectChanges();
      jest.advanceTimersByTime(500);
      await fixture.whenStable();
      fixture.detectChanges();
      jest.useRealTimers();

      expect(fixture.nativeElement.textContent).not.toContain('Prueba con otras fechas o elige otro servicio');
    });
  });
  /**
   * Los botones de la pantalla de cierre se leen como un par. Estaban uno en
   * --lg y otro por defecto: distinta altura, distinto cuerpo de letra y
   * distinto radio, uno al lado del otro.
   */
  describe('pantalla de confirmacion', () => {
    const enConfirmacion = async () => {
      const { params, query } = contexto(VerticalKey.ALOJAMIENTO);
      await crear(params, query);
      componente.irPaso(4);
      fixture.detectChanges();
    };

    it('deberia dar el mismo tamano a los dos botones de cierre', async () => {
      await enConfirmacion();

      const botones = [...fixture.nativeElement.querySelectorAll('.confirmation__actions .rs-btn')];
      expect(botones).toHaveLength(2);
      expect(botones.every((b: HTMLElement) => b.classList.contains('rs-btn--lg'))).toBe(true);
    });

    it('deberia distinguirlos por variante, no por tamano', async () => {
      await enConfirmacion();

      const botones = [...fixture.nativeElement.querySelectorAll('.confirmation__actions .rs-btn')];
      expect(botones[0].classList.contains('rs-btn--primary')).toBe(true);
      expect(botones[1].classList.contains('rs-btn--secondary')).toBe(true);
    });
  });
  /**
   * El cobro sale bien en el navegador, pero la reserva solo se confirma en el
   * servidor. Antes se dejaba entero al webhook de Stripe: llega con retraso en
   * produccion y nunca en local, asi que la reserva se quedaba "pendiente de
   * pago" con el dinero ya cobrado.
   */
  describe('confirmacion tras el pago', () => {
    const pagar = async (ajustes: Partial<Dobles> = {}) => {
      const { params, query } = contexto(VerticalKey.ALOJAMIENTO);
      await crear(params, query, ajustes);
      componente.paso1AlojamientoForm.patchValue({ checkIn: '2026-09-01', checkOut: '2026-09-03' });
      componente.irPaso(3);
      // `irPaso(3)` lanza `prepararStripe()` sin await. Un solo `whenStable`
      // puede resolverse antes de que termine, y entonces no hay `pagoId` que
      // sincronizar: el test fallaba de forma intermitente bajo carga.
      await esperarA(() => componente.stripeListo());
      await componente.procesarPago();
      fixture.detectChanges();
    };

    it('deberia avisar al servidor del pago en vez de esperar solo al webhook', async () => {
      await pagar();

      expect(dobles.payments.sincronizar).toHaveBeenCalledWith('pago-1');
      expect(componente.paso()).toBe(4);
    });

    it('no deberia avisar de nada si el servidor ya la dio por confirmada', async () => {
      await pagar();

      expect(componente.confirmacionPendiente()).toBe(false);
      expect(fixture.nativeElement.textContent).not.toContain('Estamos terminando de confirmarla');
    });

    it('deberia decirlo en pantalla si la confirmacion aun no ha llegado', async () => {
      // El dinero esta cobrado: prometer "confirmada" cuando el listado dira
      // "pendiente de pago" es justo lo que confunde al cliente.
      await pagar({
        payments: {
          crearIntent: jest.fn().mockResolvedValue({ clientSecret: 'cs_1', pagoId: 'pago-1', montoTotal: 242 }),
          configuracion: jest.fn().mockResolvedValue({ bypassPagoHabilitado: false }),
          confirmarSinCobro: jest.fn().mockResolvedValue(undefined),
          sincronizar: jest.fn().mockResolvedValue({ estado: 'pendiente' }),
        },
      });

      expect(componente.confirmacionPendiente()).toBe(true);
      expect(fixture.nativeElement.textContent).toContain('Estamos terminando de confirmarla');
    });

    it('no deberia bloquear la confirmacion si la consulta falla', async () => {
      // El webhook sigue de respaldo: dejar al cliente atascado seria peor.
      await pagar({
        payments: {
          crearIntent: jest.fn().mockResolvedValue({ clientSecret: 'cs_1', pagoId: 'pago-1', montoTotal: 242 }),
          configuracion: jest.fn().mockResolvedValue({ bypassPagoHabilitado: false }),
          confirmarSinCobro: jest.fn().mockResolvedValue(undefined),
          sincronizar: jest.fn().mockImplementation(() => Promise.reject(new Error('sin red'))),
        },
      });

      expect(componente.paso()).toBe(4);
      expect(componente.confirmacionPendiente()).toBe(true);
    });
  });
});
