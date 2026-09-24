import { TamanoPerro } from '../enums/perro.enum';
import {
  ContextoViaje, SolicitudViaje, cotizarViaje, cubreViaje, incluidosDe, modalidadesDe, normalizarTerritorio,
  resumenCancelacionDe,
} from './solicitud-viaje';
import { CONFIG_TRANSPORTE_DEFECTO, ConfigTransporte, ReglaTarifa, SuplementoTransporte } from './transporte.config';
import {
  AmbitoTransporte, AplicacionSuplemento, CondicionSuplemento, FormaCalculoSuplemento, ModeloPrecio, ModoCobertura,
  ModoDisponibilidadTransporte, NecesidadTransporte, PlantillaTransporte, PoliticaCancelacionTransporte, QuienViaja,
  TipoRecogida, TipoTrayecto, UnidadCobro, VentanaRecogida,
} from './transporte.enums';
import {
  FranjaTransporte, ModalidadTransporte, ModoHorarioTransporte, PLAZO_ACEPTACION_MIN, VueltaTransporte,
} from './viaje.catalogo';

const REGLA_FIJA: ReglaTarifa = {
  id: 'fija',
  nombre: 'Tarifa fija',
  modelo: ModeloPrecio.FIJO,
  unidadCobro: UnidadCobro.VEHICULO,
  precioIda: 40,
};

const suplemento = (
  clave: string,
  condicion: CondicionSuplemento,
  importe: number,
  extra: Partial<SuplementoTransporte> = {},
): SuplementoTransporte => ({
  clave,
  nombre: clave,
  condicion,
  forma: FormaCalculoSuplemento.IMPORTE_FIJO,
  importe,
  aplicacion: AplicacionSuplemento.AUTOMATICA,
  ...extra,
});

const config = (extra: Partial<ConfigTransporte> = {}): ConfigTransporte => ({
  ...CONFIG_TRANSPORTE_DEFECTO,
  reglasTarifa: [REGLA_FIJA],
  ...extra,
});

const viaje = (extra: Partial<SolicitudViaje> = {}): SolicitudViaje => ({
  tipoServicio: NecesidadTransporte.SOLO_IDA,
  origen: { texto: 'Castellón' },
  destino: { texto: 'Valencia' },
  fecha: '2026-10-07',
  modoHorario: ModoHorarioTransporte.HORA_CONCRETA,
  hora: '10:00',
  mascotas: [{ especie: 'perro', tamano: TamanoPerro.MEDIANO }],
  necesidades: [],
  modalidad: ModalidadTransporte.EXCLUSIVO,
  preferencias: [],
  ...extra,
});

/** Miércoles 7 de octubre de 2026, 10:00 en Madrid (CEST, UTC+2). */
const MIERCOLES_10H = new Date('2026-10-07T08:00:00Z');

const contexto = (extra: Partial<ContextoViaje> = {}): ContextoViaje => ({
  km: 10,
  instanteRecogida: MIERCOLES_10H,
  horasHastaRecogida: 48,
  ...extra,
});

const conceptos = (config_: ConfigTransporte, v: SolicitudViaje, c: ContextoViaje = contexto()): string[] =>
  cotizarViaje(config_, v, c).desglose.map((l) => l.concepto);

describe('normalizarTerritorio', () => {
  it('debería quitar tildes, mayúsculas, el prefijo de provincia y la forma cooficial', () => {
    expect(normalizarTerritorio('  Provincia de Castellón ')).toBe('castellon');
    expect(normalizarTerritorio('Valencia/València')).toBe('valencia');
    expect(normalizarTerritorio('Province of Girona')).toBe('girona');
  });

  it('debería devolver una cadena vacía si no hay valor', () => {
    expect(normalizarTerritorio(undefined)).toBe('');
  });
});

describe('modalidadesDe', () => {
  it('debería ofrecer sólo exclusivo en la plantilla exclusiva que lleva sólo a la mascota', () => {
    expect(modalidadesDe(config())).toEqual([ModalidadTransporte.EXCLUSIVO]);
  });

  it('debería añadir «viajo con mi mascota» cuando admite acompañantes y tiene plazas', () => {
    expect(modalidadesDe(config({ quienViaja: QuienViaja.AMBAS, plazasAcompanantes: 2 })))
      .toEqual([ModalidadTransporte.EXCLUSIVO, ModalidadTransporte.CON_PROPIETARIO]);
  });

  it('no debería ofrecer «viajo con mi mascota» sin plazas para acompañantes', () => {
    expect(modalidadesDe(config({ quienViaja: QuienViaja.AMBAS, plazasAcompanantes: 0 })))
      .toEqual([ModalidadTransporte.EXCLUSIVO]);
  });

  it.each([PlantillaTransporte.COMPARTIDO, PlantillaTransporte.RUTA_PROGRAMADA])(
    'debería ofrecer compartido en la plantilla %s',
    (plantilla) => {
      expect(modalidadesDe(config({ plantilla }))).toEqual([ModalidadTransporte.COMPARTIDO]);
    },
  );

  it('debería añadir exclusivo a un compartido que vende el suplemento «servicio exclusivo»', () => {
    const conExclusivo = config({
      plantilla: PlantillaTransporte.COMPARTIDO,
      suplementos: [suplemento('servicio_exclusivo', CondicionSuplemento.SIEMPRE, 20, { aplicacion: AplicacionSuplemento.A_PETICION })],
    });
    expect(modalidadesDe(conExclusivo)).toEqual([ModalidadTransporte.COMPARTIDO, ModalidadTransporte.EXCLUSIVO]);
  });

  it('debería ofrecer sólo «viajo con mi mascota» en un taxi que exige al responsable', () => {
    expect(modalidadesDe(config({ plantilla: PlantillaTransporte.TAXI_PETFRIENDLY, quienViaja: QuienViaja.MASCOTA_Y_RESPONSABLE })))
      .toEqual([ModalidadTransporte.CON_PROPIETARIO]);
  });

  it('debería añadir exclusivo a un taxi que también lleva a la mascota sola', () => {
    expect(modalidadesDe(config({ plantilla: PlantillaTransporte.TAXI_PETFRIENDLY, quienViaja: QuienViaja.AMBAS })))
      .toEqual([ModalidadTransporte.CON_PROPIETARIO, ModalidadTransporte.EXCLUSIVO]);
  });

  it('debería ofrecer exclusivo en el transporte especial', () => {
    expect(modalidadesDe(config({ plantilla: PlantillaTransporte.ESPECIAL }))).toEqual([ModalidadTransporte.EXCLUSIVO]);
  });
});

describe('incluidosDe', () => {
  it('debería traducir el equipamiento por defecto al vocabulario de preferencias', () => {
    expect(incluidosDe(config())).toEqual([
      'aviso_recogida', 'aviso_entrega', 'climatizacion', 'transportin_empresa', 'puerta_a_puerta',
    ]);
  });

  it('debería incluir gps, cámara y conductor especializado, y omitir puerta a puerta si recoge en un punto', () => {
    const incluidos = incluidosDe(config({
      plantilla: PlantillaTransporte.ESPECIAL,
      equipamientoVehiculo: ['gps', 'camara'],
      tipoRecogida: TipoRecogida.PUNTO_ENCUENTRO,
    }));
    expect(incluidos).toEqual(['aviso_recogida', 'aviso_entrega', 'gps', 'camara', 'conductor_especializado']);
  });
});

describe('resumenCancelacionDe', () => {
  it('debería dar 24 h de cancelación gratis con la política estándar', () => {
    expect(resumenCancelacionDe(config())).toEqual({ gratisHastaHoras: 24, reembolsoTardioPct: 0 });
  });

  it('debería dar 0 h con la política no reembolsable', () => {
    expect(resumenCancelacionDe(config({ politicaCancelacion: PoliticaCancelacionTransporte.NO_REEMBOLSABLE })))
      .toEqual({ gratisHastaHoras: 0, reembolsoTardioPct: 0 });
  });
});

describe('cubreViaje', () => {
  describe('por radio', () => {
    it('debería cubrir si la recogida está dentro del radio', () => {
      expect(cubreViaje(config({ radioKm: 50 }), contexto({ kmBaseRecogida: 40 }))).toBe(true);
    });

    it('no debería cubrir si la recogida está fuera del radio', () => {
      expect(cubreViaje(config({ radioKm: 50 }), contexto({ kmBaseRecogida: 60 }))).toBe(false);
    });

    it('debería cubrir si no declaró radio o no se conoce la distancia a la base', () => {
      expect(cubreViaje(config({ radioKm: undefined }), contexto({ kmBaseRecogida: 999 }))).toBe(true);
      expect(cubreViaje(config({ radioKm: 50 }), contexto())).toBe(true);
    });
  });

  describe('por municipios o provincias', () => {
    it('debería cubrir cuando no declaró zonas', () => {
      expect(cubreViaje(config({ modoCobertura: ModoCobertura.MUNICIPIOS, municipiosCobertura: [] }), contexto())).toBe(true);
    });

    it('debería cubrir si el origen o el destino están en sus municipios, sin importar tildes', () => {
      const municipios = config({ modoCobertura: ModoCobertura.MUNICIPIOS, municipiosCobertura: ['Castellón'] });
      expect(cubreViaje(municipios, contexto({ ciudadOrigen: 'castellon', ciudadDestino: 'Valencia' }))).toBe(true);
      expect(cubreViaje(municipios, contexto({ ciudadOrigen: 'Madrid', ciudadDestino: 'Castellón' }))).toBe(true);
    });

    it('no debería cubrir si ningún extremo está en sus zonas', () => {
      const municipios = config({ modoCobertura: ModoCobertura.MUNICIPIOS, municipiosCobertura: ['Castellón'] });
      expect(cubreViaje(municipios, contexto({ ciudadOrigen: 'Madrid', ciudadDestino: 'Toledo' }))).toBe(false);
    });

    it('debería comparar provincias quitando el prefijo «Provincia de»', () => {
      const provincias = config({ modoCobertura: ModoCobertura.PROVINCIAS, municipiosCobertura: ['Provincia de Castellón'] });
      expect(cubreViaje(provincias, contexto({ provinciaOrigen: 'Castellón' }))).toBe(true);
    });
  });

  describe('por países', () => {
    it('debería cubrir cuando no declaró países', () => {
      expect(cubreViaje(config({ modoCobertura: ModoCobertura.PAISES, paisesCobertura: [] }), contexto())).toBe(true);
    });

    it('debería cubrir si algún extremo está en sus países', () => {
      const paises = config({ modoCobertura: ModoCobertura.PAISES, paisesCobertura: ['España'] });
      expect(cubreViaje(paises, contexto({ paisOrigen: 'Francia', paisDestino: 'espana' }))).toBe(true);
    });

    it('no debería cubrir si ningún extremo está en sus países', () => {
      const paises = config({ modoCobertura: ModoCobertura.PAISES, paisesCobertura: ['Francia'] });
      expect(cubreViaje(paises, contexto({ paisOrigen: 'España', paisDestino: 'Portugal' }))).toBe(false);
    });
  });

  describe('nacional', () => {
    const nacional = config({ modoCobertura: ModoCobertura.NACIONAL });

    it('debería cubrir si falta algún país', () => {
      expect(cubreViaje(nacional, contexto({ paisOrigen: 'España' }))).toBe(true);
    });

    it('debería cubrir un viaje dentro del mismo país', () => {
      expect(cubreViaje(nacional, contexto({ paisOrigen: 'España', paisDestino: 'espana' }))).toBe(true);
    });

    it('no debería cubrir un viaje entre países', () => {
      expect(cubreViaje(nacional, contexto({ paisOrigen: 'España', paisDestino: 'Francia' }))).toBe(false);
    });
  });

  it('debería tratar como «no lo ha dicho» las listas de cobertura ausentes', () => {
    expect(cubreViaje(config({ modoCobertura: ModoCobertura.MUNICIPIOS, municipiosCobertura: undefined }), contexto())).toBe(true);
    expect(cubreViaje(config({ modoCobertura: ModoCobertura.PAISES, paisesCobertura: undefined }), contexto())).toBe(true);
  });

  it.each([ModoCobertura.RUTAS_FIJAS, ModoCobertura.PRESUPUESTO])('debería cubrir siempre en el modo %s', (modoCobertura) => {
    expect(cubreViaje(config({ modoCobertura }), contexto())).toBe(true);
  });
});

describe('cotizarViaje', () => {
  describe('viajes imposibles', () => {
    it('debería rechazar una modalidad que la empresa no ofrece', () => {
      const cotizacion = cotizarViaje(config(), viaje({ modalidad: ModalidadTransporte.COMPARTIDO }), contexto());
      expect(cotizacion).toEqual({
        estado: 'no_disponible',
        motivo: 'Esta empresa no ofrece esa modalidad de viaje.',
        total: 0,
        desglose: [],
        requiereAceptacion: false,
      });
    });

    it('debería rechazar una especie no admitida', () => {
      const cotizacion = cotizarViaje(config(), viaje({ mascotas: [{ especie: 'reptil', tamano: TamanoPerro.MINI }] }), contexto());
      expect(cotizacion.motivo).toBe('Esta empresa no traslada ese tipo de animal.');
    });

    it('debería rechazar más mascotas de las que lleva por viaje', () => {
      const cuatro = Array.from({ length: 4 }, () => ({ especie: 'perro', tamano: TamanoPerro.MINI }));
      const cotizacion = cotizarViaje(config(), viaje({ mascotas: cuatro }), contexto());
      expect(cotizacion.motivo).toBe('Esta empresa lleva como máximo 3 mascota(s) por viaje.');
    });

    it('no debería limitar las mascotas si el máximo es 0', () => {
      const cuatro = Array.from({ length: 4 }, () => ({ especie: 'perro', tamano: TamanoPerro.MINI }));
      expect(cotizarViaje(config({ maxMascotasPorReserva: 0 }), viaje({ mascotas: cuatro }), contexto()).estado).toBe('precio');
    });

    it('debería rechazar más acompañantes que plazas', () => {
      const conAcompanantes = config({ quienViaja: QuienViaja.AMBAS, plazasAcompanantes: 1 });
      const cotizacion = cotizarViaje(
        conAcompanantes,
        viaje({ modalidad: ModalidadTransporte.CON_PROPIETARIO, personas: 2 }),
        contexto(),
      );
      expect(cotizacion.motivo).toBe('Esta empresa no tiene plazas para tantos acompañantes.');
    });

    it.each([
      [NecesidadTransporte.RECURRENTE, ModoHorarioTransporte.HORA_CONCRETA],
      [NecesidadTransporte.URGENTE, ModoHorarioTransporte.HORA_CONCRETA],
      [NecesidadTransporte.SOLO_IDA, ModoHorarioTransporte.LO_ANTES_POSIBLE],
    ])('debería rechazar el trayecto %s (%s) si la empresa no lo hace', (tipoServicio, modoHorario) => {
      const cotizacion = cotizarViaje(config(), viaje({ tipoServicio, modoHorario }), contexto());
      expect(cotizacion.motivo).toBe('Esta empresa no hace ese tipo de trayecto.');
    });

    it('debería aceptar cualquier trayecto si la empresa no declaró tipos', () => {
      const cotizacion = cotizarViaje(
        config({ tiposTrayecto: [] }),
        viaje({ tipoServicio: NecesidadTransporte.RECURRENTE }),
        contexto(),
      );
      expect(cotizacion.estado).toBe('precio');
    });

    it('debería rechazar una recogida que ya ha pasado', () => {
      const cotizacion = cotizarViaje(config(), viaje(), contexto({ horasHastaRecogida: -1 }));
      expect(cotizacion.motivo).toBe('La hora de recogida ya ha pasado.');
    });

    it.each([ModoDisponibilidadTransporte.CALENDARIO, ModoDisponibilidadTransporte.SALIDAS_PROGRAMADAS])(
      'debería exigir la antelación mínima en el modo %s',
      (modoDisponibilidad) => {
        const cotizacion = cotizarViaje(config({ modoDisponibilidad }), viaje(), contexto({ horasHastaRecogida: 10 }));
        expect(cotizacion.motivo).toBe('Esta empresa necesita reservar con 24 h de antelación.');
      },
    );

    it('no debería exigir antelación a un servicio bajo demanda', () => {
      const cotizacion = cotizarViaje(
        config({ modoDisponibilidad: ModoDisponibilidadTransporte.BAJO_DEMANDA }),
        viaje(),
        contexto({ horasHastaRecogida: 10 }),
      );
      expect(cotizacion.estado).toBe('precio');
    });

    it('no debería exigir antelación si la empresa la tiene a 0', () => {
      const cotizacion = cotizarViaje(config({ antelacionMinimaHoras: 0 }), viaje(), contexto({ horasHastaRecogida: 1 }));
      expect(cotizacion.estado).toBe('precio');
    });

    it('no debería aplicar antelación ni hora pasada a un viaje urgente', () => {
      const urgente = config({ tiposTrayecto: [TipoTrayecto.URGENTE] });
      const cotizacion = cotizarViaje(
        urgente,
        viaje({ tipoServicio: NecesidadTransporte.URGENTE }),
        contexto({ horasHastaRecogida: -1 }),
      );
      expect(cotizacion.estado).toBe('precio');
    });
  });

  describe('presupuesto', () => {
    it('debería mandar a presupuesto a una empresa que sólo trabaja a medida', () => {
      const cotizacion = cotizarViaje(
        config({ modoDisponibilidad: ModoDisponibilidadTransporte.SOLO_PRESUPUESTO }),
        viaje(),
        contexto(),
      );
      expect(cotizacion).toEqual({
        estado: 'presupuesto',
        motivo: 'La empresa prepara cada viaje a medida.',
        total: 0,
        desglose: [],
        requiereAceptacion: false,
      });
    });

    it('debería mandar a presupuesto cuando ninguna tarifa encaja, con el motivo del motor', () => {
      const cotizacion = cotizarViaje(config({ reglasTarifa: [] }), viaje(), contexto());
      expect(cotizacion.estado).toBe('presupuesto');
      expect(cotizacion.motivo).toBe('Este trayecto no encaja en ninguna tarifa publicada.');
    });

    it('debería mandar a presupuesto un trayecto más largo que la distancia máxima', () => {
      const cotizacion = cotizarViaje(config({ distanciaMaximaKm: 5 }), viaje(), contexto({ km: 10 }));
      expect(cotizacion.estado).toBe('presupuesto');
      expect(cotizacion.motivo).toContain('5 km');
    });
  });

  describe('precio', () => {
    it('debería cotizar un viaje sencillo con la regla fija y sin aceptación', () => {
      expect(cotizarViaje(config(), viaje(), contexto())).toEqual({
        estado: 'precio',
        total: 40,
        desglose: [{ concepto: 'Tarifa fija', importe: 40 }],
        requiereAceptacion: false,
      });
    });

    it('debería cobrar el suplemento «servicio exclusivo» al pedir exclusivo a un compartido', () => {
      const compartido = config({
        plantilla: PlantillaTransporte.COMPARTIDO,
        suplementos: [suplemento('servicio_exclusivo', CondicionSuplemento.SIEMPRE, 20, { aplicacion: AplicacionSuplemento.A_PETICION })],
      });
      const exclusivo = cotizarViaje(compartido, viaje({ modalidad: ModalidadTransporte.EXCLUSIVO }), contexto());
      const compartidoSinSuplemento = cotizarViaje(compartido, viaje({ modalidad: ModalidadTransporte.COMPARTIDO }), contexto());
      expect(exclusivo.total).toBe(60);
      expect(compartidoSinSuplemento.total).toBe(40);
    });

    it('debería pedir los suplementos de medicación, transportín y equipaje especial que implica la solicitud', () => {
      const aPeticion = { aplicacion: AplicacionSuplemento.A_PETICION };
      const conSuplementos = config({
        suplementos: [
          suplemento('medicacion', CondicionSuplemento.SIEMPRE, 3, aPeticion),
          suplemento('transportin_empresa', CondicionSuplemento.SIEMPRE, 4, aPeticion),
          suplemento('equipaje_especial', CondicionSuplemento.SIEMPRE, 6, aPeticion),
        ],
      });
      const todos = cotizarViaje(conSuplementos, viaje({
        necesidades: ['medicacion'],
        preferencias: ['transportin_empresa'],
        equipaje: 'varias_maletas',
      }), contexto());
      const equipajeNormal = cotizarViaje(conSuplementos, viaje({ equipaje: 'maleta' }), contexto());
      expect(todos.total).toBe(53);
      expect(equipajeNormal.total).toBe(40);
    });

    describe('nocturno y fin de semana en hora de Madrid', () => {
      const conRecargos = config({
        suplementos: [
          suplemento('nocturno', CondicionSuplemento.NOCTURNO, 10),
          suplemento('finde', CondicionSuplemento.FIN_DE_SEMANA, 5),
        ],
      });

      it('no debería aplicar recargos un miércoles a las 10:00', () => {
        expect(conceptos(conRecargos, viaje())).toEqual(['Tarifa fija']);
      });

      it('debería aplicar el nocturno a las 23:00 de Madrid aunque en UTC sean las 21:00', () => {
        const noche = contexto({ instanteRecogida: new Date('2026-10-07T21:00:00Z') });
        expect(conceptos(conRecargos, viaje({ hora: '23:00' }), noche)).toEqual(['Tarifa fija', 'nocturno']);
      });

      it('debería aplicar el nocturno de madrugada, antes de las 7:00', () => {
        const madrugada = contexto({ instanteRecogida: new Date('2026-10-07T04:00:00Z') });
        expect(conceptos(conRecargos, viaje({ hora: '06:00' }), madrugada)).toEqual(['Tarifa fija', 'nocturno']);
      });

      it('no debería aplicar el nocturno si el cliente es flexible y no hay hora cerrada', () => {
        const noche = contexto({ instanteRecogida: new Date('2026-10-07T21:00:00Z') });
        expect(conceptos(conRecargos, viaje({ modoHorario: ModoHorarioTransporte.FLEXIBLE, franja: FranjaTransporte.TARDE }), noche))
          .toEqual(['Tarifa fija']);
      });

      it('debería aplicar el fin de semana el sábado en Madrid aunque en UTC aún sea viernes', () => {
        // Sábado 10/10 a las 00:30 en Madrid = viernes 22:30 UTC; también es nocturno.
        const sabado = contexto({ instanteRecogida: new Date('2026-10-09T22:30:00Z') });
        expect(conceptos(conRecargos, viaje({ hora: '00:30' }), sabado)).toEqual(['Tarifa fija', 'nocturno', 'finde']);
      });

      it('debería aplicar el fin de semana el domingo', () => {
        const domingo = contexto({ instanteRecogida: new Date('2026-10-11T08:00:00Z') });
        expect(conceptos(conRecargos, viaje(), domingo)).toEqual(['Tarifa fija', 'finde']);
      });
    });

    describe('ida y vuelta', () => {
      const conEspera = config({
        suplementos: [suplemento('espera', CondicionSuplemento.ESPERA, 10, { forma: FormaCalculoSuplemento.POR_HORA })],
      });

      it('debería cobrar ida y vuelta y la espera por encima de la incluida', () => {
        const cotizacion = cotizarViaje(conEspera, viaje({
          tipoServicio: NecesidadTransporte.IDA_VUELTA,
          vuelta: { modo: VueltaTransporte.TRAS_HORAS, horas: 2 },
        }), contexto());
        // 80 € ida y vuelta + (120 − 30 min incluidos) a 10 €/h.
        expect(cotizacion.desglose).toEqual([{ concepto: 'Tarifa fija', importe: 80 }, { concepto: 'espera', importe: 15 }]);
      });

      it('no debería cobrar espera si la vuelta tras horas no dice cuántas', () => {
        const cotizacion = cotizarViaje(conEspera, viaje({
          tipoServicio: NecesidadTransporte.IDA_VUELTA,
          vuelta: { modo: VueltaTransporte.TRAS_HORAS },
        }), contexto());
        expect(cotizacion.total).toBe(80);
      });

      it('no debería cobrar espera si la vuelta es a una hora determinada', () => {
        const cotizacion = cotizarViaje(conEspera, viaje({
          tipoServicio: NecesidadTransporte.IDA_VUELTA,
          vuelta: { modo: VueltaTransporte.HORA, hora: '18:00' },
        }), contexto());
        expect(cotizacion.total).toBe(80);
      });

      it('debería cobrar sólo ida si pide ida y vuelta sin describir la vuelta', () => {
        expect(cotizarViaje(conEspera, viaje({ tipoServicio: NecesidadTransporte.IDA_VUELTA }), contexto()).total).toBe(40);
      });
    });

    it('debería contar al menos un pasajero cuando viaja con su mascota', () => {
      const porPersona = config({
        quienViaja: QuienViaja.AMBAS,
        plazasAcompanantes: 2,
        reglasTarifa: [{ ...REGLA_FIJA, unidadCobro: UnidadCobro.PERSONA_Y_MASCOTA }],
      });
      expect(cotizarViaje(porPersona, viaje({ modalidad: ModalidadTransporte.CON_PROPIETARIO }), contexto()).total).toBe(80);
      expect(cotizarViaje(porPersona, viaje({ modalidad: ModalidadTransporte.CON_PROPIETARIO, personas: 2 }), contexto()).total).toBe(120);
    });

    describe('ámbito del trayecto', () => {
      const porAmbito = (ambito: AmbitoTransporte): ConfigTransporte => config({
        reglasTarifa: [{ ...REGLA_FIJA, id: 'ambito', nombre: 'Por ámbito', precioIda: 100, ambitos: [ambito] }, REGLA_FIJA],
      });

      it.each([
        [AmbitoTransporte.INTERNACIONAL, { paisOrigen: 'España', paisDestino: 'Francia' }],
        [AmbitoTransporte.NACIONAL, { paisOrigen: 'España', paisDestino: 'España', provinciaOrigen: 'Castellón', provinciaDestino: 'Madrid' }],
        [AmbitoTransporte.PROVINCIAL, { provinciaOrigen: 'Castellón', provinciaDestino: 'castellon', ciudadOrigen: 'Castellón', ciudadDestino: 'Vila-real' }],
        [AmbitoTransporte.LOCAL, { ciudadOrigen: 'Castellón', ciudadDestino: 'Castellón' }],
      ])('debería deducir el ámbito %s del contexto', (ambito, lugares) => {
        expect(cotizarViaje(porAmbito(ambito), viaje(), contexto(lugares)).total).toBe(100);
      });

      it('no debería deducir ámbito sin ciudad de origen y la regla sin ámbito coincidente sigue valiendo', () => {
        // Sin ámbito en la solicitud, el motor no descarta reglas por ámbito.
        expect(cotizarViaje(porAmbito(AmbitoTransporte.LOCAL), viaje(), contexto()).total).toBe(100);
      });

      it('no debería aplicar la regla de un ámbito distinto', () => {
        const cotizacion = cotizarViaje(
          porAmbito(AmbitoTransporte.INTERNACIONAL),
          viaje(),
          contexto({ ciudadOrigen: 'Castellón', ciudadDestino: 'Castellón' }),
        );
        expect(cotizacion.total).toBe(40);
      });
    });
  });

  describe('aceptación del transportista', () => {
    const urgente = config({ tiposTrayecto: [TipoTrayecto.URGENTE] });

    it('debería exigir aceptación en un urgente con el plazo por defecto', () => {
      const cotizacion = cotizarViaje(urgente, viaje({ tipoServicio: NecesidadTransporte.URGENTE }), contexto());
      expect(cotizacion.requiereAceptacion).toBe(true);
      expect(cotizacion.plazoAceptacionMin).toBe(PLAZO_ACEPTACION_MIN.urgente);
    });

    it('debería usar las horas de respuesta urgente que declaró la empresa', () => {
      const cotizacion = cotizarViaje(
        config({ tiposTrayecto: [TipoTrayecto.URGENTE], respuestaUrgenteHoras: 2 }),
        viaje({ modoHorario: ModoHorarioTransporte.LO_ANTES_POSIBLE }),
        contexto(),
      );
      expect(cotizacion.plazoAceptacionMin).toBe(120);
    });

    it('debería exigir aceptación con el plazo de la empresa si confirma en unas horas', () => {
      const cotizacion = cotizarViaje(config({ confirmacionHoras: 3 }), viaje(), contexto());
      expect(cotizacion).toMatchObject({ requiereAceptacion: true, plazoAceptacionMin: 180 });
    });

    it('debería exigir aceptación si la empresa confirma la ventana de recogida', () => {
      const cotizacion = cotizarViaje(config({ ventanaRecogida: VentanaRecogida.CONFIRMA_EMPRESA }), viaje(), contexto());
      expect(cotizacion).toMatchObject({ requiereAceptacion: true, plazoAceptacionMin: PLAZO_ACEPTACION_MIN.normal });
    });

    it('debería exigir aceptación si la mascota tiene una necesidad que la empresa confirma', () => {
      const conSituaciones = config({ situacionesConfirmacion: ['medicacion'] });
      expect(cotizarViaje(conSituaciones, viaje({ necesidades: ['medicacion'] }), contexto()).requiereAceptacion).toBe(true);
      expect(cotizarViaje(conSituaciones, viaje({ necesidades: ['arnes'] }), contexto()).requiereAceptacion).toBe(false);
    });

    it.each(['reactivo_perros', 'reactivo_personas'])(
      'debería tratar el comportamiento %s como conducta reactiva',
      (comportamiento) => {
        const conSituaciones = config({ situacionesConfirmacion: ['conducta_reactiva'] });
        expect(cotizarViaje(conSituaciones, viaje({ comportamiento }), contexto()).requiereAceptacion).toBe(true);
      },
    );

    it('no debería tratar un comportamiento tranquilo como conducta reactiva', () => {
      const conSituaciones = config({ situacionesConfirmacion: ['conducta_reactiva'] });
      expect(cotizarViaje(conSituaciones, viaje({ comportamiento: 'tranquilo' }), contexto()).requiereAceptacion).toBe(false);
    });

    it('debería exigir aceptación si el cliente es flexible', () => {
      const cotizacion = cotizarViaje(config(), viaje({ modoHorario: ModoHorarioTransporte.FLEXIBLE }), contexto());
      expect(cotizacion).toMatchObject({ requiereAceptacion: true, plazoAceptacionMin: PLAZO_ACEPTACION_MIN.normal });
    });

    it('debería exigir aceptación si la vuelta es «cuando yo avise»', () => {
      const cotizacion = cotizarViaje(config(), viaje({
        tipoServicio: NecesidadTransporte.IDA_VUELTA,
        vuelta: { modo: VueltaTransporte.CUANDO_AVISE },
      }), contexto());
      expect(cotizacion.requiereAceptacion).toBe(true);
    });
  });
});
