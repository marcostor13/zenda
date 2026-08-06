import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { ActivatedRoute, convertToParamMap } from '@angular/router';
import { RouterTestingModule } from '@angular/router/testing';
import { PasoEmbudo, TipoEvento, VerticalKey } from 'shared';
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

interface Dobles {
  reservas: { crear: jest.Mock };
  payments: { crearIntent: jest.Mock };
  cupones: { validar: jest.Mock };
  recomendador: { adiestramiento: jest.Mock; veterinaria: jest.Mock };
  perros: { misPerros: jest.Mock };
  catalog: { obtener: jest.Mock };
  stripe: { getStripe: jest.Mock };
  geo: { trayecto: jest.Mock };
  eventos: { registrar: jest.Mock; cerrarEmbudo: jest.Mock };
}

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
      reservas: { crear: jest.fn().mockResolvedValue({ _id: 'r1', codigo: 'RES-AAAA1111' }) },
      payments: { crearIntent: jest.fn().mockResolvedValue({ clientSecret: 'cs_1', montoTotal: 242 }) },
      cupones: { validar: jest.fn().mockResolvedValue({ codigo: 'VERANO', descuento: 20 }) },
      recomendador: {
        adiestramiento: jest.fn().mockResolvedValue({ modalidad: 'sesion', bloqueaGrupales: false }),
        veterinaria: jest.fn().mockResolvedValue({ servicio: 'consulta' }),
      },
      perros: { misPerros: jest.fn().mockResolvedValue([]) },
      catalog: { obtener: jest.fn().mockResolvedValue({ extra: {} }) },
      stripe: { getStripe: jest.fn().mockResolvedValue(stripeFake) },
      geo: { trayecto: jest.fn().mockResolvedValue({ km: 70, duracionMin: 55, esEstimacion: false }) },
      eventos: { registrar: jest.fn(), cerrarEmbudo: jest.fn() },
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

    it('debería aplicar el IVA sobre el importe ya descontado', async () => {
      const { params, query } = contexto(VerticalKey.ALOJAMIENTO, { precioBase: '100' });
      await crear(params, query);
      componente.cuponInput = 'verano';
      await componente.aplicarCupon();

      expect(componente.subtotalNeto()).toBe(80);
      expect(componente.iva()).toBe(16.8);
      expect(componente.total()).toBe(96.8);
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

      expect(componente.subtotalNeto()).toBe(0);
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
        pais: 'ES', peticiones: '', aceptaTerminos: true,
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
      await crear(params, query, { payments: { crearIntent: jest.fn().mockRejectedValue(new Error('stripe caído')) } });

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

      expect(componente.lineaResumen()).toBe('€50 × 2 noches · 2 perros');
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
      expect(componente.lineaResumen()).toBe('€50');
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
});
