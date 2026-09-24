import { Test } from '@nestjs/testing';
import { Types } from 'mongoose';
import {
  AplicacionSuplemento, CondicionSuplemento, FormaCalculoSuplemento, ModalidadTransporte, ModeloPrecio, ModoCobertura,
  ModoDisponibilidadTransporte, ModoHorarioTransporte, NecesidadTransporte, OrdenTransporte, PatronRecurrenciaTransporte,
  PlantillaTransporte, QuienViaja, ReglaTarifa, SolicitudViaje, SuplementoTransporte, TamanoPerro, UnidadCobro,
} from 'shared';
import { DireccionLugar, GeoService } from '../../core/geo/geo.service';
import { DomainException } from '../../shared/exceptions/domain.exception';
import { TransporteCotizable, TransporteRepository } from './transporte.repository';
import { TransporteCotizadorService } from './transporte-cotizador.service';

const lugar = (extra: Partial<DireccionLugar>): DireccionLugar => ({
  calle: '', numero: '', codigoPostal: '', ciudad: '', provincia: '', pais: 'España', formateada: '', lat: 0, lng: 0, ...extra,
});

const CASTELLON = lugar({ ciudad: 'Castellón de la Plana', provincia: 'Castellón', lat: 39.986, lng: -0.051 });
const VALENCIA = lugar({ ciudad: 'Valencia', provincia: 'Valencia', lat: 39.47, lng: -0.376 });
const TRAYECTO = { km: 70, duracionMin: 55, esEstimacion: false };
const BASE_VALENCIA = { ciudad: 'Valencia', geo: { type: 'Point', coordinates: [-0.376, 39.47] } };

/** Salida + 0,50 €/km: con 20 € de salida son 55 € por los 70 km de Castellón a Valencia. */
const regla = (tarifaSalida = 20): ReglaTarifa => ({
  id: 'r1',
  nombre: 'Base más km',
  modelo: ModeloPrecio.BASE_MAS_KM,
  unidadCobro: UnidadCobro.VEHICULO,
  tarifaSalida,
  precioKm: 0.5,
});

const exclusivoAPeticion: SuplementoTransporte = {
  clave: 'servicio_exclusivo',
  nombre: 'Servicio exclusivo',
  condicion: CondicionSuplemento.SIEMPRE,
  forma: FormaCalculoSuplemento.IMPORTE_FIJO,
  importe: 20,
  aplicacion: AplicacionSuplemento.A_PETICION,
};

const solicitud = (extra: Partial<SolicitudViaje> = {}): SolicitudViaje => ({
  tipoServicio: NecesidadTransporte.SOLO_IDA,
  origen: { texto: 'Castellón', placeId: 'a' },
  destino: { texto: 'Valencia', placeId: 'b' },
  // Un miércoles lejos en el futuro: ni antelación mínima ni recargos de fin de semana.
  fecha: '2030-03-06',
  modoHorario: ModoHorarioTransporte.HORA_CONCRETA,
  hora: '10:30',
  mascotas: [{ especie: 'perro', tamano: TamanoPerro.MEDIANO }],
  necesidades: [],
  modalidad: ModalidadTransporte.COMPARTIDO,
  preferencias: [],
  ...extra,
});

/** Un servicio dado de alta con el asistente nuevo: plantilla compartida y una regla de tarifa. */
const empresa = (extra: Record<string, unknown> = {}): TransporteCotizable => ({
  _id: new Types.ObjectId(),
  comercioId: new Types.ObjectId(),
  titulo: 'Transportes Fido',
  imagenes: ['https://cdn/fido.jpg'],
  ubicacion: { ciudad: 'Castellón', geo: { type: 'Point', coordinates: [-0.051, 39.986] } },
  ratingPromedio: 4.5,
  totalReseñas: 10,
  destacado: false,
  estado: 'publicado',
  comercioActivo: true,
  unidadesDisponibles: 2,
  tipoVehiculo: 'van_acondicionada',
  plantilla: PlantillaTransporte.COMPARTIDO,
  radioKm: 200,
  reglasTarifa: [regla()],
  ...extra,
} as unknown as TransporteCotizable);

describe('TransporteCotizadorService', () => {
  let service: TransporteCotizadorService;
  let repo: jest.Mocked<Pick<TransporteRepository, 'reservables' | 'porId'>>;
  let geo: jest.Mocked<Pick<GeoService, 'direccion' | 'direccionDePunto' | 'trayecto' | 'trayectoEntre'>>;

  beforeEach(async () => {
    const moduleRef = await Test.createTestingModule({
      providers: [
        TransporteCotizadorService,
        { provide: TransporteRepository, useValue: { reservables: jest.fn().mockResolvedValue([]), porId: jest.fn() } },
        {
          provide: GeoService,
          useValue: {
            direccion: jest.fn().mockImplementation(async (placeId: string) => (placeId === 'a' ? CASTELLON : VALENCIA)),
            direccionDePunto: jest.fn().mockResolvedValue(VALENCIA),
            trayecto: jest.fn().mockResolvedValue(TRAYECTO),
            trayectoEntre: jest.fn().mockResolvedValue(TRAYECTO),
          },
        },
      ],
    }).compile();

    service = moduleRef.get(TransporteCotizadorService);
    repo = moduleRef.get(TransporteRepository);
    geo = moduleRef.get(GeoService);
  });

  describe('rutaDe', () => {
    it('debería calcular la ruta por placeId cuando los dos puntos lo tienen', async () => {
      const ruta = await service.rutaDe(solicitud());

      expect(geo.trayecto).toHaveBeenCalledWith('a', 'b');
      expect(geo.trayectoEntre).not.toHaveBeenCalled();
      expect(ruta).toEqual({ trayecto: TRAYECTO, origen: CASTELLON, destino: VALENCIA });
    });

    it('debería calcular la ruta por coordenadas si un punto es la ubicación actual', async () => {
      const ruta = await service.rutaDe(solicitud({ destino: { texto: 'Mi ubicación', lat: 39.47, lng: -0.376 } }));

      expect(geo.direccionDePunto).toHaveBeenCalledWith(39.47, -0.376);
      expect(geo.trayectoEntre).toHaveBeenCalledWith(CASTELLON, VALENCIA);
      expect(geo.trayecto).not.toHaveBeenCalled();
      expect(ruta?.trayecto).toBe(TRAYECTO);
    });

    it('debería devolver null si un punto no tiene ni placeId ni coordenadas', async () => {
      await expect(service.rutaDe(solicitud({ destino: { texto: 'Valencia' } }))).resolves.toBeNull();
    });

    it('debería devolver null si las coordenadas no son números finitos', async () => {
      await expect(service.rutaDe(solicitud({ destino: { texto: 'x', lat: Number.NaN, lng: 1 } }))).resolves.toBeNull();
    });

    it('debería devolver null si falta un punto o no hay trayecto', async () => {
      await expect(service.rutaDe({ origen: solicitud().origen } as SolicitudViaje)).resolves.toBeNull();
      geo.trayecto.mockResolvedValue(null);
      await expect(service.rutaDe(solicitud())).resolves.toBeNull();
    });
  });

  describe('buscar', () => {
    it('debería devolver la ruta pública, un resultado con su precio y los datos de la tarjeta', async () => {
      const fido = empresa({ equipamientoVehiculo: ['climatizacion'] });
      repo.reservables.mockResolvedValue([fido]);

      const respuesta = await service.buscar(solicitud());

      expect(respuesta.ruta).toEqual({
        km: 70, duracionMin: 55, esEstimacion: false,
        origen: { lat: 39.986, lng: -0.051, provincia: 'Castellón', pais: 'España' },
        destino: { lat: 39.47, lng: -0.376, provincia: 'Valencia', pais: 'España' },
      });
      expect(respuesta.viajes).toBe(1);
      expect(respuesta.motivo).toBeUndefined();
      expect(respuesta.resultados).toEqual([{
        servicioId: fido._id.toString(),
        comercioId: fido.comercioId.toString(),
        titulo: 'Transportes Fido',
        imagen: 'https://cdn/fido.jpg',
        ciudadBase: 'Castellón',
        rating: 4.5,
        totalResenas: 10,
        verificado: true,
        destacado: false,
        modalidad: ModalidadTransporte.COMPARTIDO,
        estado: 'precio',
        motivoPresupuesto: undefined,
        total: 55,
        desglose: [{ concepto: 'Base más km', importe: 55 }],
        incluidos: ['aviso_recogida', 'aviso_entrega', 'climatizacion', 'puerta_a_puerta'],
        duracionMin: 55,
        kmHastaRecogida: 0,
        requiereAceptacion: false,
        cancelacion: { gratisHastaHoras: 24, reembolsoTardioPct: 0 },
        tipoVehiculo: 'van_acondicionada',
      }]);
    });

    it('debería dejar sin km hasta la recogida a la empresa sin ubicación de base', async () => {
      repo.reservables.mockResolvedValue([empresa({ ubicacion: undefined, imagenes: undefined, ratingPromedio: undefined })]);

      const { resultados } = await service.buscar(solicitud());

      expect(resultados[0]).toMatchObject({ kmHastaRecogida: undefined, ciudadBase: undefined, imagen: undefined, rating: 0 });
    });

    it('debería dar un resultado por cada modalidad que ofrece y admite el viaje', async () => {
      repo.reservables.mockResolvedValue([empresa({
        suplementos: [exclusivoAPeticion],
        quienViaja: QuienViaja.AMBAS,
        plazasAcompanantes: 0,
      })]);

      const { resultados } = await service.buscar(solicitud(), OrdenTransporte.PRECIO);

      // Sin plazas de acompañante no hay «viajo con mi mascota»; el exclusivo suma su suplemento.
      expect(resultados.map((r) => [r.modalidad, r.total])).toEqual([
        [ModalidadTransporte.COMPARTIDO, 55],
        [ModalidadTransporte.EXCLUSIVO, 75],
      ]);
    });

    it('debería cotizar «viajo con mi mascota» con al menos un acompañante', async () => {
      repo.reservables.mockResolvedValue([empresa({
        plantilla: PlantillaTransporte.TAXI_PETFRIENDLY,
        quienViaja: QuienViaja.MASCOTA_Y_RESPONSABLE,
        plazasAcompanantes: 2,
        suplementos: [{
          clave: 'pasajero', nombre: 'Pasajero', condicion: CondicionSuplemento.SIEMPRE,
          forma: FormaCalculoSuplemento.POR_PASAJERO, importe: 5, aplicacion: AplicacionSuplemento.AUTOMATICA,
        }],
      })]);

      const { resultados } = await service.buscar(solicitud());

      expect(resultados).toHaveLength(1);
      expect(resultados[0]).toMatchObject({ modalidad: ModalidadTransporte.CON_PROPIETARIO, total: 60 });
    });

    it('debería cotizar un servicio del alta antigua traduciendo su tarifa base más km', async () => {
      repo.reservables.mockResolvedValue([empresa({ reglasTarifa: undefined, plantilla: undefined, tarifaBase: 20, tarifaKm: 0.5 })]);

      const { resultados } = await service.buscar(solicitud());

      expect(resultados).toEqual([expect.objectContaining({ modalidad: ModalidadTransporte.EXCLUSIVO, total: 55 })]);
    });

    it('debería marcar la aceptación del transportista cuando el cliente es flexible', async () => {
      repo.reservables.mockResolvedValue([empresa()]);
      const { resultados } = await service.buscar(solicitud({ modoHorario: ModoHorarioTransporte.FLEXIBLE }));
      expect(resultados[0].requiereAceptacion).toBe(true);
    });

    it('debería descartar las empresas que no pueden hacer el viaje y explicar por qué no hay resultados', async () => {
      repo.reservables.mockResolvedValue([empresa({ especiesAdmitidas: ['Perro'] })]);

      const respuesta = await service.buscar(solicitud({ mascotas: [{ especie: 'gato', tamano: TamanoPerro.MINI }] }));

      expect(respuesta.resultados).toEqual([]);
      expect(respuesta.motivo).toBe('Ningún transportista cubre ese viaje todavía.');
    });

    it('debería excluir las empresas sin vehículos libres', async () => {
      repo.reservables.mockResolvedValue([empresa({ unidadesDisponibles: 0 })]);
      await expect(service.buscar(solicitud())).resolves.toMatchObject({ resultados: [] });
    });

    it.each([
      [['Valencia'], 1],
      [['Castellón de la Plana'], 1],
      [['provincia de castellon'], 1],
      [['Madrid'], 0],
    ])('debería decidir la cobertura por municipios con la ciudad o provincia de origen o destino (%p)', async (municipiosCobertura, esperados) => {
      repo.reservables.mockResolvedValue([empresa({ modoCobertura: ModoCobertura.MUNICIPIOS, municipiosCobertura })]);
      const { resultados } = await service.buscar(solicitud());
      expect(resultados).toHaveLength(esperados);
    });

    it('debería descartar la empresa cuya base queda fuera de su radio respecto a la recogida', async () => {
      repo.reservables.mockResolvedValue([empresa({ radioKm: 10, ubicacion: BASE_VALENCIA })]);
      await expect(service.buscar(solicitud())).resolves.toMatchObject({ resultados: [] });
    });

    it('debería contar los viajes de una serie recurrente', async () => {
      const respuesta = await service.buscar(solicitud({
        tipoServicio: NecesidadTransporte.RECURRENTE,
        recurrencia: { patron: PatronRecurrenciaTransporte.MENSUAL, diasSemana: [], hora: '10:30', hasta: '2030-05-06' },
      }));
      expect(respuesta.viajes).toBe(3);
    });

    it('debería responder sin ruta si no se puede calcular', async () => {
      geo.direccion.mockResolvedValue(null);

      const respuesta = await service.buscar(solicitud());

      expect(respuesta).toEqual(expect.objectContaining({ ruta: null, viajes: 1, resultados: [] }));
      expect(respuesta.motivo).toContain('No hemos podido calcular la ruta');
      expect(repo.reservables).not.toHaveBeenCalled();
    });

    describe('orden', () => {
      const barata = empresa({ titulo: 'Barata', reglasTarifa: [regla(5)], ratingPromedio: 3, totalReseñas: 50, ubicacion: undefined });
      const cara = empresa({
        titulo: 'Cara', reglasTarifa: [regla(60)], ratingPromedio: 5, totalReseñas: 40, destacado: true, ubicacion: BASE_VALENCIA,
      });
      const cercana = empresa({ titulo: 'Cercana', reglasTarifa: [regla(30)], ratingPromedio: 4, totalReseñas: 2 });
      const aMedida = empresa({
        titulo: 'A medida', ratingPromedio: 5, totalReseñas: 100,
        modoDisponibilidad: ModoDisponibilidadTransporte.SOLO_PRESUPUESTO,
      });

      const titulos = async (orden: OrdenTransporte): Promise<string[]> => {
        repo.reservables.mockResolvedValue([aMedida, cara, cercana, barata]);
        const { resultados } = await service.buscar(solicitud(), orden);
        return resultados.map((r) => r.titulo);
      };

      it('debería poner siempre detrás las que piden presupuesto', async () => {
        for (const orden of Object.values(OrdenTransporte)) {
          const ordenados = await titulos(orden);
          expect(ordenados[ordenados.length - 1]).toBe('A medida');
        }
      });

      it('debería marcar como presupuesto sin precio las que lo piden', async () => {
        repo.reservables.mockResolvedValue([aMedida]);
        const { resultados } = await service.buscar(solicitud());
        expect(resultados[0]).toMatchObject({
          estado: 'presupuesto', total: 0, motivoPresupuesto: 'La empresa prepara cada viaje a medida.',
        });
      });

      it('debería ordenar por precio', async () => {
        expect(await titulos(OrdenTransporte.PRECIO)).toEqual(['Barata', 'Cercana', 'Cara', 'A medida']);
      });

      it('debería ordenar por valoración', async () => {
        expect(await titulos(OrdenTransporte.VALORACION)).toEqual(['Cara', 'Cercana', 'Barata', 'A medida']);
      });

      it('debería desempatar la valoración por número de opiniones', async () => {
        const pocasOpiniones = empresa({ titulo: 'Pocas', reglasTarifa: [regla(60)], ratingPromedio: 5, totalReseñas: 1 });
        repo.reservables.mockResolvedValue([pocasOpiniones, cara]);

        const { resultados } = await service.buscar(solicitud(), OrdenTransporte.VALORACION);

        expect(resultados.map((r) => r.titulo)).toEqual(['Cara', 'Pocas']);
      });

      it('debería recomendar primero lo destacado y mejor valorado', async () => {
        expect(await titulos(OrdenTransporte.RECOMENDADOS)).toEqual(['Cara', 'Barata', 'Cercana', 'A medida']);
      });

      it('debería ordenar por cercanía a la recogida, con las que no tienen base al final', async () => {
        expect(await titulos(OrdenTransporte.RECOGIDA_PROXIMA)).toEqual(['Cercana', 'Cara', 'Barata', 'A medida']);
      });

      it('debería ordenar por duración y desempatar por precio', async () => {
        expect(await titulos(OrdenTransporte.DURACION)).toEqual(['Barata', 'Cercana', 'Cara', 'A medida']);
      });
    });
  });

  describe('cotizarEmpresa', () => {
    it.each([
      ['no existe', null],
      ['no está publicada', empresa({ estado: 'pausado' })],
      ['su comercio no está activo', empresa({ comercioActivo: false })],
    ])('debería responder 404 si la empresa %s', async (_caso, doc) => {
      repo.porId.mockResolvedValue(doc);

      await expect(service.cotizarEmpresa('x', solicitud())).rejects.toThrow(DomainException);
      await expect(service.cotizarEmpresa('x', solicitud())).rejects.toMatchObject({ statusCode: 404 });
    });

    it('debería cotizar todas las modalidades de la empresa', async () => {
      repo.porId.mockResolvedValue(empresa({ suplementos: [exclusivoAPeticion] }));

      const respuesta = await service.cotizarEmpresa('x', solicitud());

      expect(respuesta.resultados.map((r) => r.modalidad)).toEqual([ModalidadTransporte.COMPARTIDO, ModalidadTransporte.EXCLUSIVO]);
      expect(respuesta.motivo).toBeUndefined();
    });

    it('debería explicar que no cubre el viaje si está fuera de su zona', async () => {
      repo.porId.mockResolvedValue(empresa({ modoCobertura: ModoCobertura.MUNICIPIOS, municipiosCobertura: ['Madrid'] }));

      const respuesta = await service.cotizarEmpresa('x', solicitud());

      expect(respuesta.resultados).toEqual([]);
      expect(respuesta.motivo).toBe('Este transportista no cubre ese viaje.');
    });

    it('debería responder sin ruta si no se puede calcular', async () => {
      repo.porId.mockResolvedValue(empresa());
      geo.trayecto.mockResolvedValue(null);

      await expect(service.cotizarEmpresa('x', solicitud())).resolves.toMatchObject({ ruta: null, resultados: [] });
    });
  });

  describe('cotizarReserva', () => {
    it('debería cotizar con la ruta del servidor y la configuración del alta', async () => {
      const { cotizacion, ruta } = await service.cotizarReserva(empresa(), solicitud());

      expect(ruta?.trayecto).toBe(TRAYECTO);
      expect(cotizacion).toMatchObject({ estado: 'precio', total: 55, requiereAceptacion: false });
    });

    it('debería cobrar el suplemento de nocturno con la hora de Madrid de la solicitud', async () => {
      const nocturno: SuplementoTransporte = {
        clave: 'nocturno', nombre: 'Nocturno', condicion: CondicionSuplemento.NOCTURNO,
        forma: FormaCalculoSuplemento.IMPORTE_FIJO, importe: 10, aplicacion: AplicacionSuplemento.AUTOMATICA,
      };

      const { cotizacion } = await service.cotizarReserva(empresa({ suplementos: [nocturno] }), solicitud({ hora: '23:00' }));

      expect(cotizacion.total).toBe(65);
    });

    it('debería no estar disponible si no hay ruta', async () => {
      geo.trayecto.mockResolvedValue(null);

      const { cotizacion, ruta } = await service.cotizarReserva(empresa(), solicitud());

      expect(ruta).toBeNull();
      expect(cotizacion).toMatchObject({ estado: 'no_disponible', total: 0, requiereAceptacion: false });
    });

    it('debería no estar disponible si la empresa no cubre el viaje', async () => {
      const fueraDeZona = empresa({ modoCobertura: ModoCobertura.MUNICIPIOS, municipiosCobertura: ['Madrid'] });

      const { cotizacion, ruta } = await service.cotizarReserva(fueraDeZona, solicitud());

      expect(ruta).not.toBeNull();
      expect(cotizacion).toMatchObject({ estado: 'no_disponible', motivo: 'Este transportista no cubre ese viaje.' });
    });
  });
});
