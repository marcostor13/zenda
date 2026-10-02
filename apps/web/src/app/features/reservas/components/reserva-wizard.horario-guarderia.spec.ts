import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { ActivatedRoute, convertToParamMap } from '@angular/router';
import { RouterTestingModule } from '@angular/router/testing';
import {
  ModalidadAlojamiento, TramoGuarderia, VerticalKey, type ConfigGuarderia, type ProblemaHorarioEstancia,
} from 'shared';
import { ReservaWizardComponent } from './reserva-wizard.component';
import { ReservasService, type CrearReservaPayload, type DisponibilidadApi } from '../services/reservas.service';
import { PaymentsService } from '../services/payments.service';
import { CuponesService } from '../services/cupones.service';
import { RecomendadorService } from '../services/recomendador.service';
import { PerrosService, type EstimacionPrecioApi } from '../../perros/perros.service';
import { CatalogBrowseService, type ServicioDetalle } from '../../verticales/catalog-browse.service';
import { StripeService } from '../../../core/stripe/stripe.service';
import { GeoService } from '../../../core/geo/geo.service';
import { EventosService } from '../../../core/eventos/eventos.service';
import { AuthService } from '../../../core/auth/auth.service';

/*
 * Horario de entrega y recogida de las estancias, guardería de día y precio
 * leído del servidor. Va aparte del spec principal del wizard, que ya es muy
 * largo, con su propio arranque mínimo.
 *
 * Las fechas son de 2030 a propósito: las alternativas nunca proponen días
 * pasados, y con fechas cercanas el test caducaría con el calendario.
 * 2030-03-04 es lunes; 2030-03-03, domingo; 2030-03-09, sábado.
 */
const LUNES = '2030-03-04';
const MARTES = '2030-03-05';
const MIERCOLES_FESTIVO = '2030-03-06';
const VIERNES = '2030-03-08';
const SABADO = '2030-03-09';
const DOMINGO = '2030-03-03';

/** Abre de lunes a viernes por la mañana; cierra el fin de semana y un miércoles festivo. */
const HORARIO = {
  horario: [
    ...['lunes', 'martes', 'miercoles', 'jueves', 'viernes']
      .map((dia) => ({ dia, abre: '09:00', cierra: '11:00', cerrado: false })),
    { dia: 'sabado', cerrado: true },
    { dia: 'domingo', cerrado: true },
  ],
  excepcionesHorario: [{ fecha: MIERCOLES_FESTIVO, cerrado: true }],
};

const fichaDe = (datos: Record<string, unknown> = {}): ServicioDetalle =>
  ({ extra: {}, precioPorNoche: 50, ...datos }) as unknown as ServicioDetalle;

const GUARDERIA: ConfigGuarderia = {
  precioHora: 8, precioMediaJornada: 20, precioDiaCompleto: 30, plazasPorDia: 6,
  apertura: '08:00', cierre: '19:00',
};

type DoblesReservas = jest.Mocked<Pick<ReservasService, 'crear' | 'comprobarDisponibilidad' | 'calendario'>>;
type DoblesPerros = jest.Mocked<Pick<PerrosService, 'misPerros' | 'estimacionPrecio'>>;
type DoblesCatalogo = jest.Mocked<Pick<CatalogBrowseService, 'obtener'>>;

describe('ReservaWizardComponent — horario, guardería y precio del servidor', () => {
  let fixture: ComponentFixture<ReservaWizardComponent>;
  let componente: ReservaWizardComponent;
  let reservas: DoblesReservas;
  let perros: DoblesPerros;
  let catalogo: DoblesCatalogo;

  const crear = async (
    vertical: VerticalKey,
    ficha: ServicioDetalle = fichaDe(),
    query: Record<string, string> = {},
  ): Promise<void> => {
    reservas = {
      crear: jest.fn().mockResolvedValue({ _id: 'r1', codigo: 'RES-AAAA1111' }),
      comprobarDisponibilidad: jest.fn().mockResolvedValue({ disponible: true }),
      calendario: jest.fn().mockResolvedValue({ soportado: true, dias: [] }),
    };
    perros = {
      misPerros: jest.fn().mockResolvedValue([]),
      estimacionPrecio: jest.fn().mockResolvedValue({
        precioBase: 50, precioEstimado: 55, promedioAjustePct: 10, basadoEnReservas: 3,
      }),
    };
    catalogo = { obtener: jest.fn().mockResolvedValue(ficha) };

    await TestBed.configureTestingModule({
      imports: [ReservaWizardComponent, RouterTestingModule],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: ReservasService, useValue: reservas },
        { provide: PaymentsService, useValue: {
          crearIntent: jest.fn().mockResolvedValue({ clientSecret: '', pagoId: 'pago-1', montoTotal: 0 }),
          configuracion: jest.fn().mockResolvedValue({ bypassPagoHabilitado: false }),
        } },
        { provide: CuponesService, useValue: { validar: jest.fn() } },
        { provide: RecomendadorService, useValue: { adiestramiento: jest.fn(), veterinaria: jest.fn() } },
        { provide: PerrosService, useValue: perros },
        { provide: CatalogBrowseService, useValue: catalogo },
        { provide: StripeService, useValue: { getStripe: jest.fn().mockResolvedValue(null) } },
        { provide: GeoService, useValue: { trayecto: jest.fn() } },
        { provide: EventosService, useValue: { registrar: jest.fn(), cerrarEmbudo: jest.fn() } },
        { provide: AuthService, useValue: {
          usuario: () => null, estaAutenticado: () => false, esAdmin: () => false,
          esComercio: () => false, esCliente: () => false, clienteVerificado: () => false, logout: jest.fn(),
        } },
        {
          provide: ActivatedRoute,
          useValue: {
            snapshot: {
              paramMap: convertToParamMap({ vertical, servicioId: 's1' }),
              queryParamMap: convertToParamMap({ comercioId: 'c1', nombre: 'Servicio', ...query }),
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

  /** El alta se dispara al entrar en el paso de pago, igual que en la UI. */
  const payloadEnviado = async (): Promise<CrearReservaPayload> => {
    componente.irPaso(3);
    await fixture.whenStable();
    const llamada = reservas.crear.mock.calls.at(-1);
    if (!llamada) throw new Error('No se creó la reserva');
    return llamada[0];
  };

  const detalleDe = (payload: CrearReservaPayload): Record<string, unknown> =>
    (payload.detalle ?? {}) as Record<string, unknown>;

  const eventoSelect = (valor: string): Event => {
    const select = document.createElement('select');
    const opcion = document.createElement('option');
    opcion.value = valor;
    select.appendChild(opcion);
    select.value = valor;
    return { target: select } as unknown as Event;
  };

  afterEach(() => jest.clearAllMocks());

  describe('horas de entrega y recogida', () => {
    it('debería ofrecer las horas de atención del día de entrada y del de salida', async () => {
      await crear(VerticalKey.ALOJAMIENTO, fichaDe(HORARIO));
      componente.paso1AlojamientoForm.patchValue({ checkIn: LUNES, checkOut: VIERNES });
      fixture.detectChanges();

      expect(componente.horasEntrada()).toEqual(['09:00', '09:30', '10:00', '10:30']);
      expect(componente.horasSalida()).toEqual(['09:00', '09:30', '10:00', '10:30']);
    });

    it('no debería ofrecer horas mientras no haya fechas elegidas', async () => {
      await crear(VerticalKey.ALOJAMIENTO, fichaDe(HORARIO));

      expect(componente.horasEntrada()).toBeNull();
      expect(componente.horasSalida()).toBeNull();
      expect(componente.problemaEstancia()).toBeNull();
    });

    it('debería dejar cualquier hora si el comercio no ha puesto horario', async () => {
      await crear(VerticalKey.ALOJAMIENTO, fichaDe());
      componente.paso1AlojamientoForm.patchValue({ checkIn: DOMINGO, checkOut: SABADO });

      expect(componente.horasEntrada()).toBeNull();
      expect(componente.problemaEstancia()).toBeNull();
      expect(componente.paso1Valido()).toBe(true);
    });

    it('debería devolver una lista vacía de horas en un día cerrado', async () => {
      await crear(VerticalKey.ALOJAMIENTO, fichaDe(HORARIO));
      componente.paso1AlojamientoForm.patchValue({ checkIn: LUNES, checkOut: SABADO });

      expect(componente.horasSalida()).toEqual([]);
    });

    it('debería marcar como cerrados el fin de semana y los festivos del comercio', async () => {
      await crear(VerticalKey.ALOJAMIENTO, fichaDe(HORARIO));

      const esCerrado = componente.esDiaCerrado();
      expect(esCerrado?.(DOMINGO)).toBe(true);
      expect(esCerrado?.(MIERCOLES_FESTIVO)).toBe(true);
      expect(esCerrado?.(LUNES)).toBe(false);
    });

    it('no debería tener criterio de días cerrados si la ficha no carga', async () => {
      await crear(VerticalKey.ALOJAMIENTO);
      catalogo.obtener.mockRejectedValue(new Error('sin red'));
      componente.fichaServicio.set(null);

      expect(componente.esDiaCerrado()).toBeNull();
      expect(componente.horasEntrada()).toBeNull();
    });

    it('no debería ofrecer horas fuera de una estancia', async () => {
      await crear(VerticalKey.VETERINARIA, fichaDe(HORARIO));
      componente.paso1VeterinariaForm.patchValue({ fecha: LUNES });

      expect(componente.horasEntrada()).toBeNull();
      expect(componente.horasSalida()).toBeNull();
      expect(componente.problemaEstancia()).toBeNull();
    });

    it('debería ofrecer las horas también en un hotel', async () => {
      await crear(VerticalKey.HOTELES, fichaDe(HORARIO));
      componente.paso1HotelesForm.patchValue({ checkIn: LUNES, checkOut: MARTES });

      expect(componente.horasEntrada()).toHaveLength(4);
      expect(componente.horasSalida()).toHaveLength(4);
    });
  });

  describe('problema de horario en la estancia', () => {
    it('debería bloquear una entrada en domingo y proponer los días abiertos más cercanos', async () => {
      await crear(VerticalKey.ALOJAMIENTO, fichaDe(HORARIO));
      componente.paso1AlojamientoForm.patchValue({ checkIn: DOMINGO, checkOut: VIERNES });
      fixture.detectChanges();

      const problema = componente.problemaEstancia();
      expect(problema?.momento).toBe('entrada');
      expect(problema?.fecha).toBe(DOMINGO);
      // El lunes está a un día; el viernes anterior, a dos.
      expect(problema?.alternativas).toEqual([LUNES, '2030-03-01']);
      expect(componente.paso1Valido()).toBe(false);
    });

    it('debería bloquear una salida en sábado y proponer sólo días posteriores a la entrada', async () => {
      await crear(VerticalKey.ALOJAMIENTO, fichaDe(HORARIO));
      componente.paso1AlojamientoForm.patchValue({ checkIn: LUNES, checkOut: SABADO });
      fixture.detectChanges();

      const problema = componente.problemaEstancia();
      expect(problema?.momento).toBe('salida');
      expect(problema?.alternativas).toEqual([VIERNES, '2030-03-11']);
      expect(componente.paso1Valido()).toBe(false);
    });

    it('debería proponer el mismo día cuando sólo falla la hora de entrega', async () => {
      await crear(VerticalKey.ALOJAMIENTO, fichaDe(HORARIO));
      componente.paso1AlojamientoForm.patchValue({ checkIn: LUNES, checkOut: VIERNES, horaEntrada: '15:00' });
      fixture.detectChanges();

      const problema = componente.problemaEstancia();
      expect(problema?.momento).toBe('entrada');
      expect(problema?.alternativas[0]).toBe(LUNES);
      expect(problema?.motivo).toContain('A las 15:00');
    });

    it('debería validar la hora de recogida contra el horario del día de salida', async () => {
      await crear(VerticalKey.ALOJAMIENTO, fichaDe(HORARIO));
      componente.paso1AlojamientoForm.patchValue({
        checkIn: LUNES, checkOut: VIERNES, horaEntrada: '09:30', horaSalida: '18:00',
      });

      expect(componente.problemaEstancia()?.momento).toBe('salida');
    });

    it('debería dejar avanzar cuando entrada y salida caen en horas de atención', async () => {
      await crear(VerticalKey.ALOJAMIENTO, fichaDe(HORARIO));
      componente.paso1AlojamientoForm.patchValue({
        checkIn: LUNES, checkOut: VIERNES, horaEntrada: '09:30', horaSalida: '10:00',
      });

      expect(componente.problemaEstancia()).toBeNull();
      expect(componente.paso1Valido()).toBe(true);
    });

    it('debería exigir en adiestramiento que el centro atienda el día de la sesión', async () => {
      await crear(VerticalKey.ADIESTRAMIENTO, fichaDe(HORARIO));
      componente.paso1AdiestramientoForm.patchValue({ fechaInicio: DOMINGO });
      fixture.detectChanges();

      expect(componente.problemaEstancia()?.momento).toBe('entrada');
      expect(componente.paso1Valido()).toBe(false);

      componente.paso1AdiestramientoForm.patchValue({ fechaInicio: LUNES });
      expect(componente.problemaEstancia()).toBeNull();
      expect(componente.paso1Valido()).toBe(true);
    });

    it('debería bloquear también un hotel con la salida en día cerrado', async () => {
      await crear(VerticalKey.HOTELES, fichaDe(HORARIO));
      componente.paso1HotelesForm.patchValue({ checkIn: LUNES, checkOut: SABADO });

      expect(componente.problemaEstancia()?.momento).toBe('salida');
      expect(componente.paso1Valido()).toBe(false);
    });
  });

  describe('usar una alternativa propuesta', () => {
    const problema = (momento: 'entrada' | 'salida', fecha: string): ProblemaHorarioEstancia =>
      ({ momento, fecha, motivo: '', alternativas: [] });

    it('debería mover la entrada al día propuesto y vaciar la hora elegida', async () => {
      await crear(VerticalKey.ALOJAMIENTO, fichaDe(HORARIO));
      componente.paso1AlojamientoForm.patchValue({ checkIn: DOMINGO, checkOut: VIERNES, horaEntrada: '10:00' });

      componente.usarAlternativa(problema('entrada', DOMINGO), LUNES);

      expect(componente.paso1AlojamientoForm.value.checkIn).toBe(LUNES);
      expect(componente.paso1AlojamientoForm.value.horaEntrada).toBe('');
    });

    it('debería conservar el día de entrada si sólo fallaba la hora', async () => {
      await crear(VerticalKey.ALOJAMIENTO, fichaDe(HORARIO));
      componente.paso1AlojamientoForm.patchValue({ checkIn: LUNES, checkOut: VIERNES, horaEntrada: '15:00' });

      componente.usarAlternativa(problema('entrada', LUNES), LUNES);

      expect(componente.paso1AlojamientoForm.value.checkIn).toBe(LUNES);
      expect(componente.paso1AlojamientoForm.value.horaEntrada).toBe('');
    });

    it('debería mover la salida al día propuesto y vaciar la hora de recogida', async () => {
      await crear(VerticalKey.ALOJAMIENTO, fichaDe(HORARIO));
      componente.paso1AlojamientoForm.patchValue({ checkIn: LUNES, checkOut: SABADO, horaSalida: '10:00' });

      componente.usarAlternativa(problema('salida', SABADO), VIERNES);

      expect(componente.paso1AlojamientoForm.value.checkOut).toBe(VIERNES);
      expect(componente.paso1AlojamientoForm.value.horaSalida).toBe('');
    });

    it('debería conservar el día de salida si sólo fallaba la hora de recogida', async () => {
      await crear(VerticalKey.ALOJAMIENTO, fichaDe(HORARIO));
      componente.paso1AlojamientoForm.patchValue({ checkIn: LUNES, checkOut: VIERNES, horaSalida: '18:00' });

      componente.usarAlternativa(problema('salida', VIERNES), VIERNES);

      expect(componente.paso1AlojamientoForm.value.checkOut).toBe(VIERNES);
      expect(componente.paso1AlojamientoForm.value.horaSalida).toBe('');
    });

    it('debería aplicar la alternativa al formulario del hotel', async () => {
      await crear(VerticalKey.HOTELES, fichaDe(HORARIO));
      componente.paso1HotelesForm.patchValue({ checkIn: DOMINGO, checkOut: VIERNES });

      componente.usarAlternativa(problema('entrada', DOMINGO), LUNES);

      expect(componente.paso1HotelesForm.value.checkIn).toBe(LUNES);
      expect(componente.paso1AlojamientoForm.value.checkIn).not.toBe(LUNES);
    });

    it('debería cambiar la fecha de la sesión en adiestramiento', async () => {
      await crear(VerticalKey.ADIESTRAMIENTO, fichaDe(HORARIO));
      componente.paso1AdiestramientoForm.patchValue({ fechaInicio: DOMINGO });

      componente.usarAlternativa(problema('entrada', DOMINGO), LUNES);

      expect(componente.paso1AdiestramientoForm.value.fechaInicio).toBe(LUNES);
    });
  });

  describe('hora elegida', () => {
    it('debería leer y escribir la hora de entrega y de recogida del alojamiento', async () => {
      await crear(VerticalKey.ALOJAMIENTO, fichaDe(HORARIO));
      expect(componente.horaElegida('entrada')).toBe('');

      componente.elegirHora('entrada', eventoSelect('09:30'));
      componente.elegirHora('salida', eventoSelect('10:30'));

      expect(componente.horaElegida('entrada')).toBe('09:30');
      expect(componente.horaElegida('salida')).toBe('10:30');
      expect(componente.paso1AlojamientoForm.value.horaSalida).toBe('10:30');
    });

    it('debería usar el formulario del hotel cuando se reserva un hotel', async () => {
      await crear(VerticalKey.HOTELES, fichaDe(HORARIO));

      componente.elegirHora('entrada', eventoSelect('10:00'));

      expect(componente.paso1HotelesForm.value.horaEntrada).toBe('10:00');
      expect(componente.horaElegida('entrada')).toBe('10:00');
      expect(componente.paso1AlojamientoForm.value.horaEntrada).toBe('');
    });

    it('debería describir el día en palabras para el aviso', async () => {
      await crear(VerticalKey.ALOJAMIENTO);

      expect(componente.fechaEnPalabras(LUNES)).toBe('el lunes 4 de marzo');
    });
  });

  describe('rango elegido en el calendario', () => {
    it('debería vaciar sólo las horas de los días que cambian', async () => {
      await crear(VerticalKey.ALOJAMIENTO, fichaDe(HORARIO));
      componente.paso1AlojamientoForm.patchValue({
        checkIn: LUNES, checkOut: MARTES, horaEntrada: '09:00', horaSalida: '10:00',
      });

      componente.aplicarRango({ entrada: LUNES, salida: VIERNES });

      expect(componente.paso1AlojamientoForm.value).toEqual(expect.objectContaining({
        checkIn: LUNES, checkOut: VIERNES, horaEntrada: '09:00', horaSalida: '',
      }));
    });

    it('debería vaciar la hora de entrada si cambia el día de entrada', async () => {
      await crear(VerticalKey.ALOJAMIENTO, fichaDe(HORARIO));
      componente.paso1AlojamientoForm.patchValue({
        checkIn: LUNES, checkOut: VIERNES, horaEntrada: '09:00', horaSalida: '10:00',
      });

      componente.aplicarRango({ entrada: MARTES, salida: VIERNES });

      expect(componente.paso1AlojamientoForm.value.horaEntrada).toBe('');
      expect(componente.paso1AlojamientoForm.value.horaSalida).toBe('10:00');
    });

    it('debería aplicar el rango al hotel', async () => {
      await crear(VerticalKey.HOTELES);

      componente.aplicarRango({ entrada: LUNES, salida: MARTES });

      expect(componente.paso1HotelesForm.value.checkIn).toBe(LUNES);
      expect(componente.resumenEstancia()).toBe('1 noche');
    });

    it('no debería tocar nada en un vertical sin rango de noches', async () => {
      await crear(VerticalKey.VETERINARIA);

      componente.aplicarRango({ entrada: LUNES, salida: MARTES });

      expect(componente.paso1AlojamientoForm.value.checkIn).toBe('');
      expect(componente.paso1HotelesForm.value.checkIn).toBe('');
    });

    it('debería resumir las noches de la estancia elegida', async () => {
      await crear(VerticalKey.ALOJAMIENTO);
      expect(componente.resumenEstancia()).toBe('Elige ingreso y salida en el calendario.');

      componente.aplicarRango({ entrada: LUNES, salida: VIERNES });

      expect(componente.resumenEstancia()).toBe('4 noches');
    });
  });

  describe('payload con horas de la estancia', () => {
    it('debería mandar la hora de entrega y de recogida elegidas del alojamiento', async () => {
      await crear(VerticalKey.ALOJAMIENTO, fichaDe(), { espacioId: 'esp-1' });
      componente.paso1AlojamientoForm.patchValue({
        checkIn: LUNES, checkOut: VIERNES, horaEntrada: '09:30', horaSalida: '10:00',
      });

      const detalle = detalleDe(await payloadEnviado());

      expect(detalle).toEqual(expect.objectContaining({
        modalidad: ModalidadAlojamiento.RESIDENCIA, horaEntrada: '09:30', horaSalida: '10:00', espacioId: 'esp-1',
      }));
    });

    it('no debería mandar horas que el cliente no ha elegido', async () => {
      await crear(VerticalKey.ALOJAMIENTO);
      componente.paso1AlojamientoForm.patchValue({ checkIn: LUNES, checkOut: VIERNES });

      const detalle = detalleDe(await payloadEnviado());

      expect(detalle).not.toHaveProperty('horaEntrada');
      expect(detalle).not.toHaveProperty('horaSalida');
      expect(detalle).not.toHaveProperty('espacioId');
    });

    it('debería mandar horas y habitación en un hotel', async () => {
      await crear(VerticalKey.HOTELES, fichaDe(), { espacioId: 'hab-2' });
      componente.paso1HotelesForm.patchValue({
        checkIn: LUNES, checkOut: VIERNES, horaEntrada: '09:00', horaSalida: '10:30', observaciones: 'Planta baja',
      });

      const payload = await payloadEnviado();
      const detalle = detalleDe(payload);

      expect(payload.fechaFin).toBe(VIERNES);
      expect(detalle).toEqual(expect.objectContaining({
        espacioId: 'hab-2', horaEntrada: '09:00', horaSalida: '10:30', observaciones: 'Planta baja',
      }));
    });

    it('no debería mandar horas ni habitación en un hotel si no se han elegido', async () => {
      await crear(VerticalKey.HOTELES);
      componente.paso1HotelesForm.patchValue({ checkIn: LUNES, checkOut: VIERNES });

      const detalle = detalleDe(await payloadEnviado());

      expect(detalle).not.toHaveProperty('horaEntrada');
      expect(detalle).not.toHaveProperty('espacioId');
      expect(detalle['observaciones']).toBeUndefined();
    });
  });

  describe('guardería de día', () => {
    const conGuarderia = (config: ConfigGuarderia | undefined, modalidades: string[], extra: Record<string, unknown> = {}) =>
      fichaDe({ extra: { modalidades, ...(config ? { guarderia: config } : {}), ...extra } });

    it('debería pasar a guardería si el centro no vende residencia', async () => {
      await crear(VerticalKey.ALOJAMIENTO, conGuarderia(GUARDERIA, [ModalidadAlojamiento.GUARDERIA]));
      fixture.detectChanges();

      expect(componente.esGuarderia()).toBe(true);
      expect(componente.ofreceAmbasModalidades()).toBe(false);
    });

    it('debería seguir en residencia si el centro vende las dos modalidades', async () => {
      await crear(VerticalKey.ALOJAMIENTO, conGuarderia(GUARDERIA, [
        ModalidadAlojamiento.RESIDENCIA, ModalidadAlojamiento.GUARDERIA,
      ]));

      expect(componente.ofreceAmbasModalidades()).toBe(true);
      expect(componente.esGuarderia()).toBe(false);

      componente.elegirModalidad(ModalidadAlojamiento.GUARDERIA);
      fixture.detectChanges();
      expect(componente.esGuarderia()).toBe(true);
    });

    it('no debería ser guardería fuera del vertical de alojamiento', async () => {
      await crear(VerticalKey.HOTELES, fichaDe(), { modalidad: ModalidadAlojamiento.GUARDERIA });

      expect(componente.modalidadAlojamiento()).toBe(ModalidadAlojamiento.GUARDERIA);
      expect(componente.esGuarderia()).toBe(false);
    });

    it('debería listar los tramos con su precio y unidad', async () => {
      await crear(VerticalKey.ALOJAMIENTO, conGuarderia(GUARDERIA, [ModalidadAlojamiento.GUARDERIA]));

      expect(componente.tramosGuarderia()).toEqual([
        { tramo: TramoGuarderia.HORAS, etiqueta: 'Por horas', precio: 8, unidad: 'por hora' },
        { tramo: TramoGuarderia.MEDIA_JORNADA, etiqueta: 'Media jornada (5 h)', precio: 20, unidad: 'por perro' },
        { tramo: TramoGuarderia.DIA_COMPLETO, etiqueta: 'Día completo', precio: 30, unidad: 'por perro' },
      ]);
      expect(componente.horarioGuarderia()).toBe('08:00 – 19:00');
    });

    it('no debería listar tramos ni horario sin configuración de guardería', async () => {
      await crear(VerticalKey.ALOJAMIENTO, conGuarderia(undefined, [ModalidadAlojamiento.RESIDENCIA]));

      expect(componente.tramosGuarderia()).toEqual([]);
      expect(componente.horarioGuarderia()).toBeNull();
    });

    it('no debería mostrar horario si la guardería no tiene apertura y cierre', async () => {
      await crear(VerticalKey.ALOJAMIENTO, conGuarderia(
        { plazasPorDia: 4, precioHora: 6 }, [ModalidadAlojamiento.GUARDERIA],
      ));

      expect(componente.horarioGuarderia()).toBeNull();
      expect(componente.tramosGuarderia().map((t) => t.precio)).toEqual([6]);
    });

    it('debería elegir el último tramo ofrecido si el actual no se vende', async () => {
      await crear(VerticalKey.ALOJAMIENTO, conGuarderia(
        { plazasPorDia: 4, precioHora: 6, precioMediaJornada: 18 }, [ModalidadAlojamiento.GUARDERIA],
      ));

      expect(componente.paso1GuarderiaForm.value.tramo).toBe(TramoGuarderia.MEDIA_JORNADA);
    });

    it('debería tomar modalidad y tramo de la ficha desde la URL', async () => {
      await crear(VerticalKey.ALOJAMIENTO, conGuarderia(GUARDERIA, [
        ModalidadAlojamiento.RESIDENCIA, ModalidadAlojamiento.GUARDERIA,
      ]), { modalidad: ModalidadAlojamiento.GUARDERIA, tramo: TramoGuarderia.HORAS, checkIn: LUNES, perros: '2' });

      expect(componente.esGuarderia()).toBe(true);
      expect(componente.paso1GuarderiaForm.value).toEqual(expect.objectContaining({
        tramo: TramoGuarderia.HORAS, fecha: LUNES, perros: 2,
      }));
    });

    it('debería calcular el día completo por perro con el mismo motor que cobra el API', async () => {
      await crear(VerticalKey.ALOJAMIENTO, conGuarderia(GUARDERIA, [ModalidadAlojamiento.GUARDERIA]));
      componente.paso1GuarderiaForm.patchValue({ fecha: LUNES, tramo: TramoGuarderia.DIA_COMPLETO, perros: 2 });

      expect(componente.subtotal()).toBe(60);
      expect(componente.lineaResumen()).toBe('Guardería de día · Día completo · 2 perros');
    });

    it('debería cobrar por horas y decir cuántas en el resumen', async () => {
      await crear(VerticalKey.ALOJAMIENTO, conGuarderia(GUARDERIA, [ModalidadAlojamiento.GUARDERIA]));
      componente.paso1GuarderiaForm.patchValue({ fecha: LUNES, tramo: TramoGuarderia.HORAS, horas: 3, perros: 1 });

      expect(componente.subtotal()).toBe(24);
      expect(componente.lineaResumen()).toBe('Guardería de día · Por horas · 3 h · 1 perro');
    });

    it('debería sumar los extras al día de guardería', async () => {
      await crear(VerticalKey.ALOJAMIENTO, conGuarderia(GUARDERIA, [ModalidadAlojamiento.GUARDERIA], {
        serviciosAdicionales: [{ nombre: 'Baño', precio: 12 }],
      }));
      componente.paso1GuarderiaForm.patchValue({ fecha: LUNES, tramo: TramoGuarderia.MEDIA_JORNADA, perros: 1 });
      componente.toggleExtra('Baño');

      expect(componente.subtotal()).toBe(32);
    });

    it('debería dejar el precio pendiente si falta la configuración de la guardería', async () => {
      await crear(VerticalKey.ALOJAMIENTO, fichaDe(), { modalidad: ModalidadAlojamiento.GUARDERIA });
      componente.paso1GuarderiaForm.patchValue({ fecha: LUNES });

      expect(componente.subtotal()).toBe(0);
    });

    it('debería validar el paso 1 con el formulario de guardería, sin noches', async () => {
      await crear(VerticalKey.ALOJAMIENTO, conGuarderia(GUARDERIA, [ModalidadAlojamiento.GUARDERIA]));
      expect(componente.paso1Valido()).toBe(false);

      componente.paso1GuarderiaForm.patchValue({ fecha: LUNES });

      expect(componente.paso1Valido()).toBe(true);
    });

    it('debería mandar el día, el tramo por horas y la hora de entrada, sin fecha de salida', async () => {
      await crear(VerticalKey.ALOJAMIENTO, conGuarderia(GUARDERIA, [ModalidadAlojamiento.GUARDERIA], {
        serviciosAdicionales: [{ nombre: 'Baño', precio: 12 }],
      }));
      componente.paso1GuarderiaForm.patchValue({
        fecha: LUNES, tramo: TramoGuarderia.HORAS, horas: 4, horaEntrada: '09:00', perros: 2,
      });
      componente.toggleExtra('Baño');

      const payload = await payloadEnviado();

      expect(payload.fechaInicio).toBe(LUNES);
      expect(payload.fechaFin).toBeUndefined();
      expect(payload.cantidad).toBe(2);
      expect(detalleDe(payload)).toEqual(expect.objectContaining({
        modalidad: ModalidadAlojamiento.GUARDERIA, tramoGuarderia: TramoGuarderia.HORAS,
        horasGuarderia: 4, horaEntrada: '09:00', extras: ['Baño'],
      }));
    });

    it('no debería mandar horas ni extras en un día completo sin hora de entrada', async () => {
      await crear(VerticalKey.ALOJAMIENTO, conGuarderia(GUARDERIA, [ModalidadAlojamiento.GUARDERIA]));
      componente.paso1GuarderiaForm.patchValue({ fecha: LUNES, tramo: TramoGuarderia.DIA_COMPLETO });

      const detalle = detalleDe(await payloadEnviado());

      expect(detalle['tramoGuarderia']).toBe(TramoGuarderia.DIA_COMPLETO);
      expect(detalle).not.toHaveProperty('horasGuarderia');
      expect(detalle).not.toHaveProperty('horaEntrada');
      expect(detalle).not.toHaveProperty('extras');
    });
  });

  /**
   * El importe que manda es el que calcula el servidor al comprobar la
   * disponibilidad: incluye perros, extras y noches, y es lo que se cobra.
   */
  describe('precio leído del servidor', () => {
    beforeEach(() => jest.useFakeTimers({ doNotFake: ['nextTick', 'queueMicrotask'] }));
    afterEach(() => jest.useRealTimers());

    const consultar = async (respuesta: DisponibilidadApi): Promise<void> => {
      reservas.comprobarDisponibilidad.mockResolvedValue(respuesta);
      componente.paso1AlojamientoForm.patchValue({ checkIn: LUNES, checkOut: VIERNES });
      fixture.detectChanges();
      jest.advanceTimersByTime(500);
      await fixture.whenStable();
      fixture.detectChanges();
    };

    it('debería usar el precio estimado del servidor en lugar de la cuenta local', async () => {
      await crear(VerticalKey.ALOJAMIENTO, fichaDe(), { precioBase: '1' });
      await consultar({ disponible: true, precioEstimado: 173.5 });

      expect(componente.precioConfirmado()).toBe(173.5);
      expect(componente.subtotal()).toBe(173.5);
    });

    it('debería ignorar el precio de la URL y calcular con la ficha mientras no responde el servidor', async () => {
      await crear(VerticalKey.ALOJAMIENTO, fichaDe(), { precioBase: '1' });
      await consultar({ disponible: true });

      expect(componente.precioConfirmado()).toBeNull();
      // 50 € por noche de la ficha × 4 noches.
      expect(componente.subtotal()).toBe(200);
    });

    it('no debería confirmar precio cuando no hay hueco y usar el motivo por defecto', async () => {
      await crear(VerticalKey.ALOJAMIENTO);
      await consultar({ disponible: false, precioEstimado: 120 });

      expect(componente.precioConfirmado()).toBeNull();
      expect(componente.disponibilidad()).toEqual({
        estado: 'sin_hueco', motivo: 'El servicio no está disponible para las fechas seleccionadas.',
      });
    });

    it('debería volver a calcular localmente cuando el servidor devuelve un importe de cero', async () => {
      await crear(VerticalKey.ALOJAMIENTO);
      await consultar({ disponible: true, precioEstimado: 0 });

      expect(componente.precioConfirmado()).toBe(0);
      expect(componente.subtotal()).toBe(200);
    });

    it('debería descartar el precio confirmado al dejar el paso 1 incompleto', async () => {
      await crear(VerticalKey.ALOJAMIENTO);
      await consultar({ disponible: true, precioEstimado: 173.5 });

      componente.paso1AlojamientoForm.patchValue({ checkOut: '' });
      fixture.detectChanges();

      expect(componente.precioConfirmado()).toBeNull();
      expect(componente.disponibilidad().estado).toBe('idle');
    });
  });

  describe('estimación por el historial del perro', () => {
    const alPaso2 = async (): Promise<void> => {
      componente.irPaso(2);
      await fixture.whenStable();
    };

    it('debería mostrar la estimación cuando hay reservas previas con ajuste relevante', async () => {
      await crear(VerticalKey.ALOJAMIENTO);
      componente.perroSeleccionado.set('p1');

      await alPaso2();

      expect(perros.estimacionPrecio).toHaveBeenCalledWith('p1', 50);
      expect(componente.estimacionPrecio()?.precioEstimado).toBe(55);
    });

    it('no debería mostrar una estimación sin reservas previas o con ajuste insignificante', async () => {
      await crear(VerticalKey.ALOJAMIENTO);
      componente.perroSeleccionado.set('p1');
      const sinHistorial: EstimacionPrecioApi = {
        precioBase: 50, precioEstimado: 50, promedioAjustePct: 0.5, basadoEnReservas: 4,
      };
      perros.estimacionPrecio.mockResolvedValue(sinHistorial);

      await alPaso2();

      expect(componente.estimacionPrecio()).toBeNull();
    });

    it('no debería pedir estimación sin perro elegido', async () => {
      await crear(VerticalKey.ALOJAMIENTO);

      await alPaso2();

      expect(perros.estimacionPrecio).not.toHaveBeenCalled();
      expect(componente.estimacionPrecio()).toBeNull();
    });

    it('debería quedarse sin estimación si la consulta falla', async () => {
      await crear(VerticalKey.ALOJAMIENTO);
      componente.perroSeleccionado.set('p1');
      perros.estimacionPrecio.mockRejectedValue(new Error('sin red'));

      await alPaso2();

      expect(componente.estimacionPrecio()).toBeNull();
    });
  });
});
