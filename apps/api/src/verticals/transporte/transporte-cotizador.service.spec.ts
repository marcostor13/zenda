import { Test } from '@nestjs/testing';
import { Types } from 'mongoose';
import {
  ModalidadTransporte, ModoHorarioTransporte, OrdenTransporte, PatronRecurrenciaTransporte, PreferenciaTransporte,
  SolicitudTransporte, TamanoPerro, TipoServicioTransporte,
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

const solicitud = (extra: Partial<SolicitudTransporte> = {}): SolicitudTransporte => ({
  tipoServicio: TipoServicioTransporte.SOLO_IDA,
  origen: { texto: 'Castellón', placeId: 'a' },
  destino: { texto: 'Valencia', placeId: 'b' },
  // Lejos en el futuro: la antelación mínima nunca interfiere.
  fecha: '2030-03-01',
  modoHorario: ModoHorarioTransporte.HORA_CONCRETA,
  hora: '10:30',
  mascotas: [{ especie: 'perro', tamano: TamanoPerro.MEDIANO }],
  necesidades: [],
  modalidad: ModalidadTransporte.COMPARTIDO,
  preferencias: [],
  ...extra,
});

const empresa = (extra: Partial<TransporteCotizable> = {}): TransporteCotizable => ({
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
  tarifaBase: 20,
  tarifaKm: 0.5,
  capacidadPerros: 4,
  unidadesDisponibles: 2,
  zonaCobertura: [],
  modalidades: [ModalidadTransporte.COMPARTIDO],
  especiesAceptadas: ['perro'],
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
      await expect(service.rutaDe({ origen: solicitud().origen } as SolicitudTransporte)).resolves.toBeNull();
      geo.trayecto.mockResolvedValue(null);
      await expect(service.rutaDe(solicitud())).resolves.toBeNull();
    });
  });

  describe('buscar', () => {
    it('debería devolver la ruta pública, un resultado con su precio y los datos de la tarjeta', async () => {
      const fido = empresa({ incluidos: [PreferenciaTransporte.CLIMATIZACION], cancelacion: { gratisHastaHoras: 48, reembolsoTardioPct: 50 } });
      repo.reservables.mockResolvedValue([fido]);

      const respuesta = await service.buscar(solicitud());

      expect(respuesta.ruta).toEqual({
        km: 70, duracionMin: 55, esEstimacion: false,
        origen: { lat: 39.986, lng: -0.051, provincia: 'Castellón', pais: 'España' },
        destino: { lat: 39.47, lng: -0.376, provincia: 'Valencia', pais: 'España' },
      });
      expect(respuesta.viajes).toBe(1);
      expect(respuesta.motivo).toBeUndefined();
      expect(respuesta.resultados).toEqual([expect.objectContaining({
        servicioId: fido._id.toString(),
        titulo: 'Transportes Fido',
        imagen: 'https://cdn/fido.jpg',
        verificado: true,
        modalidad: ModalidadTransporte.COMPARTIDO,
        estado: 'precio',
        total: 55,
        incluidos: [PreferenciaTransporte.CLIMATIZACION],
        cancelacion: { gratisHastaHoras: 48, reembolsoTardioPct: 50 },
        kmHastaRecogida: 0,
        duracionMin: 55,
      })]);
    });

    it('debería sumar el tiempo extra del viaje compartido a la duración', async () => {
      repo.reservables.mockResolvedValue([empresa({ tiempoExtraCompartidoMin: 20 })]);
      const { resultados } = await service.buscar(solicitud());
      expect(resultados[0].duracionMin).toBe(75);
    });

    it('debería dar un resultado por cada modalidad que ofrece y admite el viaje', async () => {
      repo.reservables.mockResolvedValue([empresa({
        modalidades: [ModalidadTransporte.COMPARTIDO, ModalidadTransporte.EXCLUSIVO, ModalidadTransporte.CON_PROPIETARIO],
        precioExclusivo: 20,
        plazasPasajeros: 0,
      })]);

      const { resultados } = await service.buscar(solicitud(), OrdenTransporte.PRECIO);

      // «Viajo con mi mascota» sin plazas de pasajero no es posible: se descarta.
      expect(resultados.map((r) => [r.modalidad, r.total])).toEqual([
        [ModalidadTransporte.COMPARTIDO, 55],
        [ModalidadTransporte.EXCLUSIVO, 75],
      ]);
    });

    it('debería cotizar «viajo con mi mascota» con al menos un acompañante', async () => {
      repo.reservables.mockResolvedValue([empresa({
        modalidades: [ModalidadTransporte.CON_PROPIETARIO], plazasPasajeros: 2, suplementos: { porPersona: 5 },
      })]);

      const { resultados } = await service.buscar(solicitud());

      expect(resultados).toHaveLength(1);
      expect(resultados[0].total).toBe(60);
    });

    it('debería descartar las empresas que no pueden hacer el viaje y explicar por qué no hay resultados', async () => {
      repo.reservables.mockResolvedValue([empresa()]);

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
    ])('debería decidir la cobertura por provincia o ciudad de origen o destino (%p)', async (zonaCobertura, esperados) => {
      repo.reservables.mockResolvedValue([empresa({ zonaCobertura })]);
      const { resultados } = await service.buscar(solicitud());
      expect(resultados).toHaveLength(esperados);
    });

    it('debería contar los viajes de una serie recurrente', async () => {
      const respuesta = await service.buscar(solicitud({
        tipoServicio: TipoServicioTransporte.RECURRENTE,
        recurrencia: { patron: PatronRecurrenciaTransporte.MENSUAL, diasSemana: [], hora: '10:30', hasta: '2030-05-01' },
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
      const barata = empresa({ titulo: 'Barata', tarifaBase: 5, ratingPromedio: 3, totalReseñas: 50, ubicacion: undefined });
      const cara = empresa({
        titulo: 'Cara', tarifaBase: 60, ratingPromedio: 5, totalReseñas: 40, destacado: true,
        ubicacion: { ciudad: 'Valencia', geo: { type: 'Point', coordinates: [-0.376, 39.47] } },
      } as Partial<TransporteCotizable>);
      const cercana = empresa({ titulo: 'Cercana', tarifaBase: 30, ratingPromedio: 4, totalReseñas: 2, tiempoExtraCompartidoMin: 30 });
      const aMedida = empresa({ titulo: 'A medida', tarifaBase: 1, ratingPromedio: 5, totalReseñas: 100, reglasPresupuesto: { masDeKm: 10 } });

      const titulos = async (orden: OrdenTransporte): Promise<string[]> => {
        repo.reservables.mockResolvedValue([aMedida, cara, cercana, barata]);
        const { resultados } = await service.buscar(solicitud(), orden);
        return resultados.map((r) => r.titulo);
      };

      it('debería poner siempre detrás las que piden presupuesto', async () => {
        for (const orden of Object.values(OrdenTransporte)) {
          const orden_ = await titulos(orden);
          expect(orden_[orden_.length - 1]).toBe('A medida');
        }
      });

      it('debería marcar como presupuesto sin precio las que lo piden', async () => {
        repo.reservables.mockResolvedValue([aMedida]);
        const { resultados } = await service.buscar(solicitud());
        expect(resultados[0]).toMatchObject({ estado: 'presupuesto', total: 0, motivoPresupuesto: expect.any(String) });
      });

      it('debería ordenar por precio', async () => {
        expect(await titulos(OrdenTransporte.PRECIO)).toEqual(['Barata', 'Cercana', 'Cara', 'A medida']);
      });

      it('debería ordenar por valoración', async () => {
        expect(await titulos(OrdenTransporte.VALORACION)).toEqual(['Cara', 'Cercana', 'Barata', 'A medida']);
      });

      it('debería recomendar primero lo destacado y mejor valorado', async () => {
        expect(await titulos(OrdenTransporte.RECOMENDADOS)).toEqual(['Cara', 'Barata', 'Cercana', 'A medida']);
      });

      it('debería ordenar por cercanía a la recogida, con las que no tienen base al final', async () => {
        expect(await titulos(OrdenTransporte.RECOGIDA_PROXIMA)).toEqual(['Cercana', 'Cara', 'Barata', 'A medida']);
      });

      it('debería ordenar por duración y desempatar por precio', async () => {
        expect(await titulos(OrdenTransporte.DURACION)).toEqual(['Barata', 'Cara', 'Cercana', 'A medida']);
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
      repo.porId.mockResolvedValue(empresa({ modalidades: [ModalidadTransporte.COMPARTIDO, ModalidadTransporte.EXCLUSIVO] }));

      const respuesta = await service.cotizarEmpresa('x', solicitud());

      expect(respuesta.resultados).toHaveLength(2);
      expect(respuesta.motivo).toBeUndefined();
    });

    it('debería explicar que no cubre el viaje si está fuera de su zona', async () => {
      repo.porId.mockResolvedValue(empresa({ zonaCobertura: ['Madrid'] }));

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
    it('debería cotizar con la ruta del servidor', async () => {
      const { cotizacion, ruta } = await service.cotizarReserva(empresa(), solicitud());

      expect(ruta?.trayecto).toBe(TRAYECTO);
      expect(cotizacion).toMatchObject({ estado: 'precio', total: 55 });
    });

    it('debería no estar disponible si no hay ruta', async () => {
      geo.trayecto.mockResolvedValue(null);

      const { cotizacion, ruta } = await service.cotizarReserva(empresa(), solicitud());

      expect(ruta).toBeNull();
      expect(cotizacion).toMatchObject({ estado: 'no_disponible', total: 0, requiereAceptacion: false });
    });

    it('debería no estar disponible si la empresa no cubre el viaje', async () => {
      const { cotizacion, ruta } = await service.cotizarReserva(empresa({ zonaCobertura: ['Madrid'] }), solicitud());

      expect(ruta).not.toBeNull();
      expect(cotizacion).toMatchObject({ estado: 'no_disponible', motivo: 'Este transportista no cubre ese viaje.' });
    });
  });
});
