import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { Types } from 'mongoose';
import { BookingsService } from './bookings.service';
import { Reserva, ReservaDocument } from './reserva.schema';
import { AvailabilityRegistry } from '../availability/availability.registry';
import { CatalogRepository } from '../catalog/catalog.repository';
import { AvailabilityStrategy, CalendarioStrategy } from '../availability/availability.strategy';
import { CuponesService } from '../cupones/cupones.service';
import { PerrosService } from '../perros/perros.service';
import { NotificationsService } from '../notifications/notifications.service';
import { ComisionResolverService } from '../comision-configs/comision-resolver.service';
import { EventosService } from '../eventos/eventos.service';
import { BloqueosService } from '../bloqueos/bloqueos.service';
import { HuecosService } from './huecos.service';
import { DomainException } from '../../shared/exceptions/domain.exception';
import { VerticalKey, ReservaEstado, COMISION_PCT_DEFAULT, TipoEvento, horarioSemanal } from 'shared';

describe('BookingsService', () => {
  let service: BookingsService;
  let reservaModel: jest.Mocked<any>;
  let availabilityRegistry: jest.Mocked<AvailabilityRegistry>;
  let estrategiaMock: jest.Mocked<AvailabilityStrategy & CalendarioStrategy>;
  let cuponesService: jest.Mocked<CuponesService>;
  let perrosService: jest.Mocked<PerrosService>;
  let notificationsService: jest.Mocked<NotificationsService>;
  let eventosService: jest.Mocked<Pick<EventosService, 'registrar'>>;
  let bloqueosService: jest.Mocked<Pick<BloqueosService, 'cierreQueSolapa'>>;
  let catalogRepository: jest.Mocked<Pick<CatalogRepository, 'obtenerPorId'>>;
  let huecosService: jest.Mocked<Pick<HuecosService, 'hayPlaza' | 'huecosDelDia'>>;

  const parametrosBase = {
    usuarioId: 'user-1',
    comercioId: 'comercio-1',
    servicioId: 'servicio-1',
    vertical: VerticalKey.ALOJAMIENTO,
    fechaInicio: new Date('2025-01-10'),
    fechaFin: new Date('2025-01-15'),
    cantidad: 1,
  };

  const reservaMock = {
    _id: 'reserva-1',
    codigo: 'RES-ABCD1234',
    estado: ReservaEstado.PENDIENTE,
    usuarioId: { toString: () => 'user-1' },
    comercioId: { toString: () => 'comercio-1' },
    holdId: 'hold-1',
    vertical: VerticalKey.ALOJAMIENTO,
    historialEstados: [],
    seguimiento: [],
    save: jest.fn(),
  };

  beforeEach(async () => {
    estrategiaMock = {
      vertical: VerticalKey.ALOJAMIENTO,
      // El calendario es opcional en el contrato: sólo lo tienen los verticales
      // que se reservan por rango de fechas.
      calendario: jest.fn().mockResolvedValue([]),
      checkAvailability: jest.fn().mockResolvedValue({ disponible: true, precioCalculado: 500 }),
      reserveSlot: jest.fn().mockResolvedValue({ holdId: 'hold-1', servicioId: 'servicio-1', expiraEn: new Date() }),
      releaseSlot: jest.fn().mockResolvedValue(undefined),
    };

    const mockConstructor: any = jest.fn().mockImplementation(() => ({
      ...reservaMock,
      save: jest.fn().mockResolvedValue(reservaMock),
    }));
    // `findById(...).lean()` lo usa la revalidación anti-doble-reserva; el mock
    // devuelve la misma reserva con `holdId`, es decir: plaza aún retenida.
    mockConstructor.findById = jest.fn().mockReturnValue({
      exec: jest.fn().mockResolvedValue(reservaMock),
      lean: jest.fn().mockReturnValue({ exec: jest.fn().mockResolvedValue(reservaMock) }),
    });
    mockConstructor.findByIdAndUpdate = jest.fn().mockReturnValue({ exec: jest.fn().mockResolvedValue({ ...reservaMock, estado: ReservaEstado.CONFIRMADA }) });
    mockConstructor.find = jest.fn().mockReturnValue({
      sort: jest.fn().mockReturnThis(),
      lean: jest.fn().mockReturnThis(),
      exec: jest.fn().mockResolvedValue([reservaMock]),
    });
    mockConstructor.findOne = jest.fn().mockReturnValue({
      sort: jest.fn().mockReturnThis(),
      populate: jest.fn().mockReturnThis(),
      lean: jest.fn().mockReturnThis(),
      exec: jest.fn().mockResolvedValue(null),
    });
    mockConstructor.insertMany = jest.fn().mockResolvedValue([]);
    mockConstructor.updateMany = jest.fn().mockReturnValue({ exec: jest.fn().mockResolvedValue({}) });

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BookingsService,
        { provide: getModelToken(Reserva.name), useValue: mockConstructor },
        {
          provide: AvailabilityRegistry,
          useValue: { obtener: jest.fn().mockReturnValue(estrategiaMock) },
        },
        {
          provide: CatalogRepository,
          useValue: {
            // El servicio es la fuente de verdad del comercio y del vertical.
            obtenerPorId: jest.fn().mockResolvedValue({
              comercioId: 'comercio-1',
              vertical: VerticalKey.ALOJAMIENTO,
              estado: 'publicado',
              comercioActivo: true,
            }),
          },
        },
        {
          provide: CuponesService,
          useValue: { validar: jest.fn(), aplicar: jest.fn().mockResolvedValue(undefined) },
        },
        {
          provide: PerrosService,
          useValue: { obtenerPropio: jest.fn() },
        },
        {
          provide: NotificationsService,
          useValue: {
            notificarAjusteSolicitado: jest.fn().mockResolvedValue(undefined),
            notificarHitoViaje: jest.fn().mockResolvedValue(undefined),
            notificarPendienteAceptacion: jest.fn().mockResolvedValue(undefined),
            notificarAceptacion: jest.fn().mockResolvedValue(undefined),
          },
        },
        {
          provide: EventosService,
          useValue: { registrar: jest.fn().mockResolvedValue(undefined) },
        },
        {
          // Por defecto no hay nada cerrado; los casos que lo necesiten lo fijan.
          provide: BloqueosService,
          useValue: { cierreQueSolapa: jest.fn().mockResolvedValue(null) },
        },
        {
          // Por defecto la hora está libre; los casos de doble reserva lo cambian.
          provide: HuecosService,
          useValue: {
            hayPlaza: jest.fn().mockResolvedValue(true),
            huecosDelDia: jest.fn().mockResolvedValue({ soportado: true, estado: 'abierto', huecos: [] }),
          },
        },
        {
          provide: ComisionResolverService,
          useValue: {
            resolver: jest.fn().mockResolvedValue({
              comisionPct: COMISION_PCT_DEFAULT, origen: 'vertical',
              stripePct: 0.015, stripeFijoEur: 0.25,
            }),
          },
        },
      ],
    }).compile();

    service = module.get<BookingsService>(BookingsService);
    reservaModel = module.get(getModelToken(Reserva.name));
    availabilityRegistry = module.get(AvailabilityRegistry);
    catalogRepository = module.get(CatalogRepository);
    cuponesService = module.get(CuponesService);
    perrosService = module.get(PerrosService);
    notificationsService = module.get(NotificationsService);
    eventosService = module.get(EventosService);
    bloqueosService = module.get(BloqueosService);
    huecosService = module.get(HuecosService);
  });

  /**
   * La consulta del paso 1: contesta si se puede reservar sin crear nada, y
   * nunca falla por una incompatibilidad — la convierte en motivo.
   */
  describe('comprobarDisponibilidad', () => {
    it('debería contestar que hay hueco con el precio estimado, sin retener plaza', async () => {
      estrategiaMock.checkAvailability.mockResolvedValue({
        disponible: true, precioCalculado: 500, capacidadRestante: 3,
      });

      const resultado = await service.comprobarDisponibilidad(parametrosBase);

      expect(resultado).toEqual({ disponible: true, precioEstimado: 500, capacidadRestante: 3 });
      expect(estrategiaMock.reserveSlot).not.toHaveBeenCalled();
    });

    it('debería devolver el motivo que da la estrategia cuando no hay hueco', async () => {
      estrategiaMock.checkAvailability.mockResolvedValue({
        disponible: false, motivo: 'No quedan plazas libres.', capacidadRestante: 0,
      });

      const resultado = await service.comprobarDisponibilidad(parametrosBase);

      expect(resultado).toEqual({
        disponible: false, motivo: 'No quedan plazas libres.', capacidadRestante: 0,
      });
    });

    it('debería caer en un texto genérico si la estrategia no explica el motivo', async () => {
      estrategiaMock.checkAvailability.mockResolvedValue({ disponible: false });

      const resultado = await service.comprobarDisponibilidad(parametrosBase);

      expect(resultado.disponible).toBe(false);
      expect(resultado.motivo).toBe('El servicio no está disponible para las fechas seleccionadas');
    });

    it('debería convertir un 409 de la estrategia en motivo, no en error', async () => {
      estrategiaMock.checkAvailability.mockRejectedValue(
        new DomainException('Este espacio admite perros hasta tamaño "mediano"', 409),
      );

      const resultado = await service.comprobarDisponibilidad(parametrosBase);

      expect(resultado).toEqual({
        disponible: false, motivo: 'Este espacio admite perros hasta tamaño "mediano"',
      });
    });

    it('debería propagar los errores que no son de negocio, como un 404', async () => {
      estrategiaMock.checkAvailability.mockRejectedValue(
        new DomainException('Alojamiento no encontrado', 404),
      );

      await expect(service.comprobarDisponibilidad(parametrosBase))
        .rejects.toThrow('Alojamiento no encontrado');
    });
  });

  describe('calendarioDisponibilidad', () => {
    it('debería devolver los días que da la estrategia del vertical', async () => {
      const dias = [{ fecha: '2026-09-01', disponible: true, plazasLibres: 2 }];
      estrategiaMock.calendario = jest.fn().mockResolvedValue(dias);

      const resultado = await service.calendarioDisponibilidad({
        usuarioId: 'user-1', servicioId: 'servicio-1',
        desde: new Date('2026-09-01'), hasta: new Date('2026-09-30'),
      });

      expect(resultado).toEqual({ soportado: true, dias });
    });

    it('debería responder que no lo soporta si el vertical no se reserva por fechas', async () => {
      // Una peluquería trabaja por huecos horarios: un calendario de noches
      // libres no significaría nada ahí.
      delete (estrategiaMock as { calendario?: unknown }).calendario;

      const resultado = await service.calendarioDisponibilidad({
        usuarioId: 'user-1', servicioId: 'servicio-1',
        desde: new Date('2026-09-01'), hasta: new Date('2026-09-30'),
      });

      expect(resultado).toEqual({ soportado: false, dias: [] });
    });

    it('debería recortar el rango para no recorrer la colección entera', async () => {
      estrategiaMock.calendario = jest.fn().mockResolvedValue([]);

      await service.calendarioDisponibilidad({
        usuarioId: 'user-1', servicioId: 'servicio-1',
        desde: new Date('2026-01-01'), hasta: new Date('2030-01-01'),
      });

      const rango = estrategiaMock.calendario.mock.calls[0][1] as { hasta: Date };
      const dias = (rango.hasta.getTime() - Date.parse('2026-01-01')) / (24 * 60 * 60 * 1000);
      expect(dias).toBeLessThanOrEqual(120);
    });

    it('debería rechazar un rango del revés', async () => {
      estrategiaMock.calendario = jest.fn().mockResolvedValue([]);

      await expect(service.calendarioDisponibilidad({
        usuarioId: 'user-1', servicioId: 'servicio-1',
        desde: new Date('2026-09-30'), hasta: new Date('2026-09-01'),
      })).rejects.toThrow(DomainException);
    });
  });

  /**
   * El comercio y el vertical mandan sobre la comisión y sobre a quién se le
   * liquida el dinero. Antes llegaban en el cuerpo de la petición sin
   * contrastarse, así que un cliente podía elegirlos.
   */
  describe('crear — el servicio manda sobre el comercio y el vertical', () => {
    it('debería tomar comercio y vertical del servicio, no de lo que envía el cliente', async () => {
      catalogRepository.obtenerPorId.mockResolvedValue({
        comercioId: 'comercio-real',
        vertical: VerticalKey.PELUQUERIA,
        estado: 'publicado',
        comercioActivo: true,
      } as never);

      await service.crear({
        ...parametrosBase,
        comercioId: undefined,
        vertical: undefined,
      });

      expect(availabilityRegistry.obtener).toHaveBeenCalledWith(VerticalKey.PELUQUERIA);
      expect(reservaModel).toHaveBeenCalledWith(
        expect.objectContaining({ comercioId: 'comercio-real', vertical: VerticalKey.PELUQUERIA }),
      );
    });

    it('debería rechazar la reserva de un servicio cuyo comercio está pausado o dado de baja', async () => {
      // Llega por un favorito o un enlace compartido: el buscador ya no lo lista,
      // pero la ficha guardada sigue apuntando aquí.
      catalogRepository.obtenerPorId.mockResolvedValue({
        comercioId: 'comercio-1',
        vertical: VerticalKey.ALOJAMIENTO,
        estado: 'publicado',
        comercioActivo: false,
      } as never);

      await expect(service.crear({ ...parametrosBase })).rejects.toThrow('ya no acepta reservas');
      expect(estrategiaMock.reserveSlot).not.toHaveBeenCalled();
    });

    it('debería rechazar la reserva de un servicio despublicado', async () => {
      catalogRepository.obtenerPorId.mockResolvedValue({
        comercioId: 'comercio-1',
        vertical: VerticalKey.ALOJAMIENTO,
        estado: 'pausado',
        comercioActivo: true,
      } as never);

      await expect(service.crear({ ...parametrosBase })).rejects.toThrow('ya no acepta reservas');
    });

    it('debería rechazar si el cliente declara un comercio distinto al del servicio', async () => {
      catalogRepository.obtenerPorId.mockResolvedValue({
        comercioId: 'comercio-real',
        vertical: VerticalKey.ALOJAMIENTO,
        estado: 'publicado',
        comercioActivo: true,
      } as never);

      await expect(
        service.crear({ ...parametrosBase, comercioId: 'comercio-del-atacante' }),
      ).rejects.toThrow(DomainException);
      expect(estrategiaMock.reserveSlot).not.toHaveBeenCalled();
    });

    it('debería rechazar si el cliente declara un vertical distinto al del servicio', async () => {
      catalogRepository.obtenerPorId.mockResolvedValue({
        comercioId: 'comercio-1',
        vertical: VerticalKey.TRANSPORTE,
        estado: 'publicado',
        comercioActivo: true,
      } as never);

      // Elegir el vertical es elegir el porcentaje de comisión (CLAUDE.md §11.2).
      await expect(
        service.crear({ ...parametrosBase, vertical: VerticalKey.VETERINARIA }),
      ).rejects.toThrow(DomainException);
    });

    it('debería resolver la comisión con el comercio y el vertical reales', async () => {
      catalogRepository.obtenerPorId.mockResolvedValue({
        comercioId: 'comercio-real',
        vertical: VerticalKey.VETERINARIA,
        estado: 'publicado',
        comercioActivo: true,
      } as never);

      await service.crear({ ...parametrosBase, comercioId: undefined, vertical: undefined });

      const resolver = (service as unknown as {
        comisionResolver: { resolver: jest.Mock };
      }).comisionResolver.resolver;
      expect(resolver).toHaveBeenCalledWith(
        expect.objectContaining({ comercioId: 'comercio-real', vertical: VerticalKey.VETERINARIA }),
      );
    });

    it('debería lanzar 404 si el servicio no existe', async () => {
      catalogRepository.obtenerPorId.mockResolvedValue(null);

      await expect(service.crear(parametrosBase)).rejects.toThrow(DomainException);
    });

    it('debería rechazar un servicio sin comercio asociado', async () => {
      catalogRepository.obtenerPorId.mockResolvedValue({
        vertical: VerticalKey.ALOJAMIENTO,
      } as never);

      await expect(service.crear(parametrosBase)).rejects.toThrow(DomainException);
    });
  });

  /**
   * Un comercio no vende sólo por Doogking: lo que cierra a mano tiene que
   * cortar la reserva, o acabará con dos clientes para el mismo hueco.
   */
  describe('crear — tramos cerrados por el comercio', () => {
    it('debería rechazar la reserva que cae en un cierre, diciendo el motivo', async () => {
      bloqueosService.cierreQueSolapa.mockResolvedValue(
        { motivo: 'Vacaciones de agosto' } as never,
      );

      await expect(service.crear(parametrosBase)).rejects.toThrow('Vacaciones de agosto');
    });

    it('no debería llegar a mirar el cupo del vertical si está cerrado', async () => {
      // El cierre manda sobre cualquier disponibilidad declarada.
      bloqueosService.cierreQueSolapa.mockResolvedValue({ motivo: 'Obras' } as never);

      await expect(service.crear(parametrosBase)).rejects.toThrow(DomainException);
      expect(estrategiaMock.checkAvailability).not.toHaveBeenCalled();
    });

    it('debería consultar el cierre con las fechas pedidas', async () => {
      await service.crear(parametrosBase);

      expect(bloqueosService.cierreQueSolapa).toHaveBeenCalledWith(
        parametrosBase.servicioId, parametrosBase.fechaInicio, parametrosBase.fechaFin,
      );
    });

    it('debería reservar con normalidad si no hay nada cerrado', async () => {
      await expect(service.crear(parametrosBase)).resolves.toBeDefined();
    });
  });

  describe('crear — importes', () => {
    /**
     * Los precios del catálogo llevan el IVA incluido: lo que el comercio
     * anuncia es lo que el cliente paga. La base imponible se obtiene
     * dividiendo, no sumando por encima al llegar al pago.
     */
    it('debería cobrar el precio anunciado, con el IVA ya dentro', async () => {
      estrategiaMock.checkAvailability.mockResolvedValue({
        disponible: true,
        precioCalculado: 121,
      } as never);

      await service.crear(parametrosBase);

      const guardado = reservaModel.mock.calls.at(-1)?.[0] as {
        comisionMonto: number; montoTotal: number; montoSubtotal: number;
      };

      expect(guardado.montoTotal).toBe(121);
      // 121 / 1.21 = 100 de base, así que el IVA contenido son 21 €.
      expect(guardado.montoSubtotal).toBe(100);
    });

    it('debería redondear al céntimo lo que persiste', async () => {
      // Sin redondear se persistían valores tipo 146.41000000000003, que luego
      // no cuadraban con lo que PaymentsService recalcula para cobrar.
      estrategiaMock.checkAvailability.mockResolvedValue({
        disponible: true,
        precioCalculado: 146.41,
      } as never);

      await service.crear(parametrosBase);

      const guardado = reservaModel.mock.calls.at(-1)?.[0] as {
        comisionMonto: number; montoTotal: number; montoSubtotal: number;
      };

      expect(guardado.montoTotal).toBe(Number(guardado.montoTotal.toFixed(2)));
      expect(guardado.montoSubtotal).toBe(Number(guardado.montoSubtotal.toFixed(2)));
      expect(guardado.comisionMonto).toBe(Number(guardado.comisionMonto.toFixed(2)));
    });

    it('debería comisionar sobre la base, no sobre el IVA', async () => {
      // El IVA no es ingreso del comercio: comisionarlo sería cobrar sobre un
      // dinero que va a Hacienda.
      estrategiaMock.checkAvailability.mockResolvedValue({
        disponible: true,
        precioCalculado: 121,
      } as never);

      await service.crear(parametrosBase);

      const guardado = reservaModel.mock.calls.at(-1)?.[0] as {
        comisionMonto: number; montoSubtotal: number;
      };

      const pct = guardado.comisionMonto / guardado.montoSubtotal;
      expect(guardado.comisionMonto).toBeCloseTo(100 * pct, 2);
    });
  });

  describe('crear', () => {
    it('debería crear reserva cuando el servicio está disponible', async () => {
      const resultado = await service.crear(parametrosBase);
      expect(estrategiaMock.checkAvailability).toHaveBeenCalledWith('servicio-1', expect.any(Object));
      expect(estrategiaMock.reserveSlot).toHaveBeenCalled();
      expect(resultado).toBeTruthy();
    });

    it('debería rechazar con el motivo de la estrategia, no con el texto genérico', async () => {
      estrategiaMock.checkAvailability.mockResolvedValue({
        disponible: false, motivo: 'No quedan plazas libres en este alojamiento.',
      });

      await expect(service.crear(parametrosBase))
        .rejects.toThrow('No quedan plazas libres en este alojamiento.');
      expect(estrategiaMock.reserveSlot).not.toHaveBeenCalled();
    });

    it('debería validar el cupón con el subtotal cuando se indica cuponCodigo', async () => {
      cuponesService.validar.mockResolvedValue({ codigo: 'VERANO', tipo: 'porcentaje', descuento: 50 });
      await service.crear({ ...parametrosBase, cuponCodigo: 'VERANO' });
      expect(cuponesService.validar).toHaveBeenCalledWith('VERANO', VerticalKey.ALOJAMIENTO, 500);
    });

    it('no debería validar cupón si no se indica código', async () => {
      await service.crear(parametrosBase);
      expect(cuponesService.validar).not.toHaveBeenCalled();
    });

    it('debería congelar un snapshot del perro cuando se indica perroId', async () => {
      perrosService.obtenerPropio.mockResolvedValue({ nombre: 'Nala', peso: 3 } as never);

      await service.crear({ ...parametrosBase, perroId: 'perro-1' });

      expect(perrosService.obtenerPropio).toHaveBeenCalledWith('perro-1', 'user-1');
      expect((reservaModel as unknown as jest.Mock).mock.calls[0][0]).toEqual(
        expect.objectContaining({ perroId: 'perro-1', perroSnapshot: expect.objectContaining({ nombre: 'Nala' }) }),
      );
    });

    it('debería enriquecer parametrosExtra con el tamaño/tipo de pelo del perro (Ficha Inteligente)', async () => {
      perrosService.obtenerPropio.mockResolvedValue({
        nombre: 'Nala', tamano: 'mini', tipoPelo: ['corto'],
      } as never);

      await service.crear({ ...parametrosBase, perroId: 'perro-1', detalle: { servicio: 'Baño' } });

      expect(estrategiaMock.checkAvailability).toHaveBeenCalledWith('servicio-1', expect.objectContaining({
        parametrosExtra: expect.objectContaining({ servicio: 'Baño', perroTamano: 'mini', perroTipoPelo: ['corto'] }),
      }));
    });

    it('debería enriquecer parametrosExtra con peso/especie/PPP/raza del perro (para hoteles)', async () => {
      perrosService.obtenerPropio.mockResolvedValue({
        nombre: 'Rex', peso: 32, especie: 'perro', esPPP: true, raza: 'Pitbull',
      } as never);

      await service.crear({ ...parametrosBase, perroId: 'perro-1' });

      expect(estrategiaMock.checkAvailability).toHaveBeenCalledWith('servicio-1', expect.objectContaining({
        parametrosExtra: expect.objectContaining({
          perroPeso: 32, perroEspecie: 'perro', perroEsPPP: true, perroRaza: 'Pitbull',
        }),
      }));
    });

    it('debería lanzar DomainException 409 si el servicio no está disponible', async () => {
      estrategiaMock.checkAvailability.mockResolvedValue({ disponible: false });

      await expect(service.crear(parametrosBase)).rejects.toThrow(DomainException);
      try {
        await service.crear(parametrosBase);
      } catch (error) {
        expect((error as DomainException).statusCode).toBe(409);
      }
    });

    describe('recurrencia (docs §4.3: guardería/peluquería/transporte recurrente)', () => {
      it('debería generar una reserva hija por cada ocurrencia del patrón', async () => {
        // Viernes 10/01/2025 → lunes y miércoles hasta el 22/01: 13,15,20,22 = 4 ocurrencias.
        await service.crear({
          ...parametrosBase,
          fechaInicio: new Date('2025-01-10'),
          recurrencia: { diasSemana: [1, 3], hora: '09:00', fechaFin: new Date('2025-01-22') },
        });

        expect(reservaModel.insertMany).toHaveBeenCalledTimes(1);
        const hijas = reservaModel.insertMany.mock.calls[0][0];
        expect(hijas).toHaveLength(4);
        // La serie se cobra entera en la origen; las hijas van a 0 € para no
        // contar dos veces el GMV.
        expect(hijas[0]).toEqual(expect.objectContaining({
          reservaOrigenId: 'reserva-1', estado: ReservaEstado.PENDIENTE,
          montoTotal: 0, montoSubtotal: 0, comisionMonto: 0,
          detalle: expect.objectContaining({ cubiertaPorSerie: true }),
        }));
      });

      it('debería cobrar la serie completa en la reserva origen y anotar viajes y precio por viaje', async () => {
        await service.crear({
          ...parametrosBase,
          fechaInicio: new Date('2025-01-10'),
          recurrencia: { diasSemana: [1, 3], hora: '09:00', fechaFin: new Date('2025-01-22') },
        });

        const origen = reservaModel.mock.calls[0][0];
        // 1 + 4 viajes a 500 € cada uno.
        expect(origen.montoTotal).toBe(2500);
        expect(origen.detalle).toEqual(expect.objectContaining({ viajes: 5, precioPorViaje: 500 }));
      });

      it('debería repetir el mismo día de cada mes en la recurrencia mensual', async () => {
        await service.crear({
          ...parametrosBase,
          fechaInicio: new Date('2026-01-31T09:00:00Z'),
          fechaFin: undefined,
          recurrencia: { diasSemana: [], hora: '10:00', fechaFin: new Date('2026-04-30'), mensual: true },
        });

        const hijas = reservaModel.insertMany.mock.calls[0][0] as Array<{ fechaInicio: Date }>;
        expect(hijas.map((h) => h.fechaInicio.toISOString())).toEqual([
          '2026-02-28T09:00:00.000Z', '2026-03-31T08:00:00.000Z', '2026-04-30T08:00:00.000Z',
        ]);
      });

      it('no debería llamar a insertMany si no se indica recurrencia', async () => {
        await service.crear(parametrosBase);
        expect(reservaModel.insertMany).not.toHaveBeenCalled();
      });

      it('debería lanzar 400 si fechaFin no es posterior a fechaInicio', async () => {
        await expect(service.crear({
          ...parametrosBase,
          fechaInicio: new Date('2025-01-10'),
          recurrencia: { diasSemana: [1], hora: '09:00', fechaFin: new Date('2025-01-05') },
        })).rejects.toThrow(DomainException);
      });

      it('debería lanzar 400 si la recurrencia generaría demasiadas ocurrencias', async () => {
        await expect(service.crear({
          ...parametrosBase,
          fechaInicio: new Date('2025-01-01'),
          recurrencia: { diasSemana: [0, 1, 2, 3, 4, 5, 6], hora: '09:00', fechaFin: new Date('2027-01-01') },
        })).rejects.toThrow(DomainException);
      });

      it('no debería reservar slot ni crear la reserva origen si la recurrencia es inválida (falla rápido)', async () => {
        await expect(service.crear({
          ...parametrosBase,
          recurrencia: { diasSemana: [1], hora: '09:00', fechaFin: new Date('2020-01-01') },
        })).rejects.toThrow(DomainException);
        expect(estrategiaMock.checkAvailability).not.toHaveBeenCalled();
      });

      it('debería poner cada sesión a su hora de Madrid, también en invierno', async () => {
        // Jueves 22/10/2026 → martes 27/10, ya en horario de invierno (+01:00).
        await service.crear({
          ...parametrosBase,
          fechaInicio: new Date('2026-10-22T08:00:00Z'),
          fechaFin: undefined,
          recurrencia: { diasSemana: [2], hora: '10:00', fechaFin: new Date('2026-10-27') },
        });

        const [hija] = reservaModel.insertMany.mock.calls[0][0];
        expect(hija.fechaInicio.toISOString()).toBe('2026-10-27T09:00:00.000Z');
      });
    });
  });

  /**
   * Veterinaria y peluquería mandan el día y la hora por separado. Se guardaban
   * a medianoche UTC y sin fin: la agenda las pintaba como un bloque de 24 horas
   * y se podía reservar fuera del horario del comercio.
   */
  describe('crear — citas con hora', () => {
    const lunesEnHorario = horarioSemanal(
      { dias: ['lunes', 'martes', 'miercoles', 'jueves', 'viernes'], abre: '09:00', cierra: '14:00' },
    );
    const cita = {
      ...parametrosBase,
      vertical: VerticalKey.VETERINARIA,
      // Lunes 21 de septiembre de 2026: el día, a medianoche UTC, como lo manda la web antigua.
      fechaInicio: new Date('2026-09-21T00:00:00Z'),
      fechaFin: undefined,
      detalle: { hora: '10:00', servicio: 'Vacunación' },
    };

    beforeEach(() => {
      catalogRepository.obtenerPorId.mockResolvedValue({
        comercioId: 'comercio-1', vertical: VerticalKey.VETERINARIA, estado: 'publicado', comercioActivo: true,
        horario: lunesEnHorario, excepcionesHorario: [],
      } as never);
      estrategiaMock.checkAvailability.mockResolvedValue({
        disponible: true, precioCalculado: 40, metadata: { duracionMin: 30, perros: 1 },
      });
    });

    const guardada = () => reservaModel.mock.calls[0][0];

    it('debería guardar el instante de las 10:00 de Madrid y el fin según la duración', async () => {
      await service.crear(cita);

      expect(guardada().fechaInicio.toISOString()).toBe('2026-09-21T08:00:00.000Z');
      expect(guardada().fechaFin.toISOString()).toBe('2026-09-21T08:30:00.000Z');
      expect(guardada().detalle).toMatchObject({ hora: '10:00', duracionMin: 30 });
    });

    it('debería respetar el instante si la web ya lo manda completo', async () => {
      await service.crear({ ...cita, fechaInicio: new Date('2026-09-21T08:00:00.000Z') });

      expect(guardada().fechaInicio.toISOString()).toBe('2026-09-21T08:00:00.000Z');
    });

    it('debería encadenar una cita por mascota', async () => {
      estrategiaMock.checkAvailability.mockResolvedValue({
        disponible: true, precioCalculado: 80, metadata: { duracionMin: 30, perros: 2 },
      });

      await service.crear(cita);

      expect(guardada().fechaFin.toISOString()).toBe('2026-09-21T09:00:00.000Z');
      expect(guardada().detalle.duracionMin).toBe(60);
    });

    it('debería rechazar con 409 una cita fuera del horario del comercio', async () => {
      await expect(service.crear({ ...cita, detalle: { hora: '13:45' } }))
        .rejects.toMatchObject({ statusCode: 409 });
      await expect(service.crear({ ...cita, fechaInicio: new Date('2026-09-20T00:00:00Z') }))
        .rejects.toMatchObject({ statusCode: 409, message: 'El comercio no atiende ese día de la semana.' });
      expect(estrategiaMock.reserveSlot).not.toHaveBeenCalled();
    });

    it('debería avisar del horario ya en la comprobación del paso 1, sin fallar', async () => {
      const respuesta = await service.comprobarDisponibilidad({ ...cita, detalle: { hora: '08:00' } });

      expect(respuesta).toMatchObject({ disponible: false });
      expect(respuesta.disponible === false && respuesta.motivo).toContain('09:00–14:00');
    });

    it('debería rechazar con 409 una hora que ya tiene otra cita, sin retener plaza', async () => {
      huecosService.hayPlaza.mockResolvedValue(false);

      await expect(service.crear(cita)).rejects.toMatchObject({ statusCode: 409, message: expect.stringContaining('ya está reservada') });
      expect(estrategiaMock.reserveSlot).not.toHaveBeenCalled();
      expect(huecosService.hayPlaza).toHaveBeenCalledWith(
        expect.objectContaining({ servicioId: 'servicio-1', comercioId: 'comercio-1', duracionMin: 30, capacidad: 1 }),
        new Date('2026-09-21T08:00:00.000Z'),
        new Date('2026-09-21T08:30:00.000Z'),
      );
    });

    it('debería contar las mesas de la peluquería como plazas a la vez', async () => {
      estrategiaMock.checkAvailability.mockResolvedValue({
        disponible: true, precioCalculado: 40, metadata: { duracionMin: 30, perros: 1, capacidadSimultanea: 3 },
      });

      await service.crear(cita);

      expect(huecosService.hayPlaza.mock.calls[0][0].capacidad).toBe(3);
    });

    it('debería avisar de la hora ocupada ya en la comprobación del paso 1', async () => {
      huecosService.hayPlaza.mockResolvedValue(false);

      const respuesta = await service.comprobarDisponibilidad(cita);

      expect(respuesta).toMatchObject({ disponible: false, motivo: expect.stringContaining('ya está reservada') });
    });

    it('no debería aplicar el horario a lo que no tiene duración, como una estancia', async () => {
      estrategiaMock.checkAvailability.mockResolvedValue({ disponible: true, precioCalculado: 40 });

      await service.crear({ ...cita, detalle: {}, fechaInicio: new Date('2026-09-20T00:00:00Z') });

      expect(guardada().fechaFin).toBeUndefined();
    });
  });

  describe('huecosDelDia', () => {
    const consulta = { usuarioId: 'user-1', servicioId: 'servicio-1', fecha: '2026-09-21', detalle: { servicio: 'Baño' } };

    beforeEach(() => {
      catalogRepository.obtenerPorId.mockResolvedValue({
        comercioId: 'comercio-1', vertical: VerticalKey.PELUQUERIA, estado: 'publicado', comercioActivo: true,
        horario: [], excepcionesHorario: [],
      } as never);
    });

    it('debería calcular las citas con la duración del servicio elegido y los perros', async () => {
      estrategiaMock.checkAvailability.mockResolvedValue({
        disponible: true, precioCalculado: 40, metadata: { duracionMin: 45, perros: 2, capacidadSimultanea: 2 },
      });

      await service.huecosDelDia({ ...consulta, cantidad: 2 });

      expect(estrategiaMock.checkAvailability).toHaveBeenCalledWith('servicio-1', expect.objectContaining({
        cantidad: 2, parametrosExtra: { servicio: 'Baño' },
      }));
      expect(huecosService.huecosDelDia).toHaveBeenCalledWith(
        expect.objectContaining({ duracionMin: 90, capacidad: 2, comercioId: 'comercio-1' }), '2026-09-21',
      );
    });

    it('debería decir que no se reserva por citas si el vertical no da duración', async () => {
      estrategiaMock.checkAvailability.mockResolvedValue({ disponible: true, precioCalculado: 40 });

      await expect(service.huecosDelDia(consulta)).resolves.toMatchObject({ soportado: false, huecos: [] });
      expect(huecosService.huecosDelDia).not.toHaveBeenCalled();
    });

    it('debería convertir la falta de cupo o un 409 del vertical en un día sin citas', async () => {
      estrategiaMock.checkAvailability.mockResolvedValueOnce({ disponible: false, motivo: 'Sin cupos' });
      await expect(service.huecosDelDia(consulta)).resolves.toEqual({ soportado: true, estado: 'cerrado', motivo: 'Sin cupos', huecos: [] });

      estrategiaMock.checkAvailability.mockRejectedValueOnce(new DomainException('No atiende gatos', 409));
      await expect(service.huecosDelDia(consulta)).resolves.toMatchObject({ estado: 'cerrado', motivo: 'No atiende gatos' });

      estrategiaMock.checkAvailability.mockRejectedValueOnce(new DomainException('No existe', 404));
      await expect(service.huecosDelDia(consulta)).rejects.toMatchObject({ statusCode: 404 });
    });

    it('debería tener en cuenta el perro elegido para la duración por tamaño', async () => {
      perrosService.obtenerPropio.mockResolvedValue({ _id: 'p1', nombre: 'Nala', tamano: 'grande' } as never);
      estrategiaMock.checkAvailability.mockResolvedValue({ disponible: true, metadata: { duracionMin: 60 } });

      await service.huecosDelDia({ ...consulta, perroId: 'p1' });

      expect(estrategiaMock.checkAvailability.mock.calls[0][1].parametrosExtra).toMatchObject({ perroTamano: 'grande' });
    });
  });

  describe('confirmar', () => {
    it('debería actualizar el estado de la reserva a CONFIRMADA', async () => {
      const resultado = await service.confirmar('reserva-1');
      expect(reservaModel.findByIdAndUpdate).toHaveBeenCalledWith(
        'reserva-1',
        expect.objectContaining({ estado: ReservaEstado.CONFIRMADA }),
        { new: true },
      );
    });

    it('debería lanzar DomainException 404 si la reserva no existe', async () => {
      reservaModel.findByIdAndUpdate.mockReturnValue({ exec: jest.fn().mockResolvedValue(null) });
      await expect(service.confirmar('no-existe')).rejects.toThrow(DomainException);
    });

    it('debería confirmar en cascada las reservas hijas de la serie recurrente', async () => {
      await service.confirmar('reserva-1');

      expect(reservaModel.updateMany).toHaveBeenCalledWith(
        { reservaOrigenId: 'reserva-1', estado: ReservaEstado.PENDIENTE },
        { estado: ReservaEstado.CONFIRMADA },
      );
    });

    describe('revalidación anti-doble-reserva', () => {
      /** Reserva sin `holdId`: la retención de plaza ya caducó. */
      const sinHold = {
        ...reservaMock,
        holdId: undefined,
        servicioId: { toString: () => 'servicio-1' },
        fechaInicio: new Date('2026-09-01'),
        cantidad: 1,
      };

      const conRetencionCaducada = (disponible: boolean): void => {
        reservaModel.findById.mockReturnValue({
          exec: jest.fn().mockResolvedValue(sinHold),
          lean: jest.fn().mockReturnValue({ exec: jest.fn().mockResolvedValue(sinHold) }),
        });
        estrategiaMock.checkAvailability.mockResolvedValue({ disponible } as never);
      };

      it('no debería comprobar nada si la plaza sigue retenida', async () => {
        estrategiaMock.checkAvailability.mockClear();

        await service.confirmar('reserva-1');

        expect(estrategiaMock.checkAvailability).not.toHaveBeenCalled();
      });

      it('debería confirmar si la retención caducó pero la plaza sigue libre', async () => {
        conRetencionCaducada(true);

        await service.confirmar('reserva-1');

        expect(reservaModel.findByIdAndUpdate).toHaveBeenCalledWith(
          'reserva-1',
          expect.objectContaining({ estado: ReservaEstado.CONFIRMADA }),
          { new: true },
        );
      });

      it('debería dejar la reserva en disputa si la plaza ya no existe, no venderla dos veces', async () => {
        conRetencionCaducada(false);

        await service.confirmar('reserva-1');

        expect(reservaModel.findByIdAndUpdate).toHaveBeenCalledWith(
          'reserva-1',
          expect.objectContaining({ estado: ReservaEstado.EN_DISPUTA }),
          { new: true },
        );
      });

      it('no debería bloquear una reserva ya pagada si falla la comprobación', async () => {
        reservaModel.findById.mockReturnValue({
          exec: jest.fn().mockResolvedValue(sinHold),
          lean: jest.fn().mockReturnValue({ exec: jest.fn().mockResolvedValue(sinHold) }),
        });
        estrategiaMock.checkAvailability.mockRejectedValue(new Error('proveedor caído'));

        await service.confirmar('reserva-1');

        expect(reservaModel.findByIdAndUpdate).toHaveBeenCalledWith(
          'reserva-1',
          expect.objectContaining({ estado: ReservaEstado.CONFIRMADA }),
          { new: true },
        );
      });
    });
  });

  describe('cancelar', () => {
    it('debería cancelar la reserva y liberar el hold', async () => {
      reservaMock.save.mockResolvedValue({ ...reservaMock, estado: ReservaEstado.CANCELADA });
      await service.cancelar('reserva-1', 'user-1');
      expect(estrategiaMock.releaseSlot).toHaveBeenCalledWith('hold-1');
    });

    it('debería lanzar DomainException 403 si el usuario no es el dueño', async () => {
      await expect(service.cancelar('reserva-1', 'otro-user')).rejects.toThrow(DomainException);
    });

    it('debería lanzar DomainException 400 si la reserva ya está cancelada', async () => {
      reservaModel.findById.mockReturnValue({
        exec: jest.fn().mockResolvedValue({ ...reservaMock, estado: ReservaEstado.CANCELADA }),
      });
      await expect(service.cancelar('reserva-1', 'user-1')).rejects.toThrow(DomainException);
    });
  });

  describe('completar', () => {
    it('debería marcar como completada una reserva confirmada del comercio', async () => {
      reservaModel.findById.mockReturnValue({
        exec: jest.fn().mockResolvedValue({
          ...reservaMock,
          // `completar` emite el evento que dispara la solicitud de reseña.
          servicioId: { toString: () => 'servicio-1' },
          estado: ReservaEstado.CONFIRMADA,
          save: jest.fn().mockResolvedValue({ ...reservaMock, estado: ReservaEstado.COMPLETADA }),
        }),
      });
      const resultado = await service.completar('reserva-1', 'comercio-1');
      expect(resultado.estado).toBe(ReservaEstado.COMPLETADA);
    });

    it('debería anunciar el servicio completado para que se pida la reseña', async () => {
      reservaModel.findById.mockReturnValue({
        exec: jest.fn().mockResolvedValue({
          ...reservaMock,
          servicioId: { toString: () => 'servicio-1' },
          estado: ReservaEstado.CONFIRMADA,
          save: jest.fn().mockResolvedValue({ ...reservaMock, estado: ReservaEstado.COMPLETADA }),
        }),
      });

      await service.completar('reserva-1', 'comercio-1');

      expect(eventosService.registrar).toHaveBeenCalledWith(
        expect.objectContaining({ tipo: TipoEvento.SERVICIO_COMPLETADO }),
      );
    });

    it('debería lanzar DomainException 403 si la reserva no es del comercio', async () => {
      reservaModel.findById.mockReturnValue({
        exec: jest.fn().mockResolvedValue({ ...reservaMock, estado: ReservaEstado.CONFIRMADA }),
      });
      await expect(service.completar('reserva-1', 'otro-comercio')).rejects.toThrow(DomainException);
    });

    it('debería lanzar DomainException 400 si la reserva no está confirmada', async () => {
      reservaModel.findById.mockReturnValue({
        exec: jest.fn().mockResolvedValue({ ...reservaMock, estado: ReservaEstado.PENDIENTE }),
      });
      await expect(service.completar('reserva-1', 'comercio-1')).rejects.toThrow(DomainException);
    });

    it('debería lanzar DomainException 404 si la reserva no existe', async () => {
      reservaModel.findById.mockReturnValue({ exec: jest.fn().mockResolvedValue(null) });
      await expect(service.completar('no-existe', 'comercio-1')).rejects.toThrow(DomainException);
    });
  });

  function ajusteReservaMock(overrides: Record<string, unknown> = {}) {
    const doc: any = {
      _id: { toString: () => 'reserva-1' },
      comercioId: { toString: () => 'comercio-1' },
      usuarioId: { toString: () => 'user-1' },
      estado: ReservaEstado.CONFIRMADA,
      montoSubtotal: 100,
      comisionMonto: 15,
      montoTotal: 121,
      suplementos: [],
      evidencias: [],
      ...overrides,
    };
    doc.save = jest.fn().mockImplementation(() => Promise.resolve(doc));
    return doc;
  }

  describe('solicitarAjuste', () => {
    it('debería añadir los suplementos, adjuntar evidencia y pasar a AJUSTE_SOLICITADO', async () => {
      const doc = ajusteReservaMock();
      reservaModel.findById.mockReturnValue({ exec: jest.fn().mockResolvedValue(doc) });

      const resultado = await service.solicitarAjuste(
        'reserva-1',
        'comercio-1',
        [{ concepto: 'Nudos severos', monto: 15 }],
        'https://x/foto.jpg',
      );

      expect(resultado.estado).toBe(ReservaEstado.AJUSTE_SOLICITADO);
      expect(resultado.suplementos).toHaveLength(1);
      expect(resultado.evidencias).toHaveLength(1);
      // El suplemento también viene con el IVA incluido: 121 + 15 = 136.
      expect(resultado.montoAjustado).toBeCloseTo(136);
    });

    it('debería avisar al cliente del ajuste, que nunca se aplica sin su aprobación', async () => {
      reservaModel.findById.mockReturnValue({ exec: jest.fn().mockResolvedValue(ajusteReservaMock()) });

      await service.solicitarAjuste('reserva-1', 'comercio-1', [{ concepto: 'Nudos severos', monto: 15 }]);

      expect(notificationsService.notificarAjusteSolicitado).toHaveBeenCalledWith('reserva-1');
    });

    it('no debería avisar cuando el ajuste se rechaza por regla de negocio', async () => {
      reservaModel.findById.mockReturnValue({ exec: jest.fn().mockResolvedValue(ajusteReservaMock()) });

      await expect(
        service.solicitarAjuste('reserva-1', 'otro-comercio', [{ concepto: 'X', monto: 5 }]),
      ).rejects.toThrow(DomainException);

      expect(notificationsService.notificarAjusteSolicitado).not.toHaveBeenCalled();
    });

    it('debería lanzar 403 si la reserva no es del comercio', async () => {
      reservaModel.findById.mockReturnValue({ exec: jest.fn().mockResolvedValue(ajusteReservaMock()) });
      await expect(
        service.solicitarAjuste('reserva-1', 'otro-comercio', [{ concepto: 'X', monto: 5 }]),
      ).rejects.toThrow(DomainException);
    });

    it('debería lanzar 400 si la reserva no está confirmada', async () => {
      const doc = ajusteReservaMock({ estado: ReservaEstado.PENDIENTE });
      reservaModel.findById.mockReturnValue({ exec: jest.fn().mockResolvedValue(doc) });
      await expect(
        service.solicitarAjuste('reserva-1', 'comercio-1', [{ concepto: 'X', monto: 5 }]),
      ).rejects.toThrow(DomainException);
    });

    it('debería lanzar 400 si no se indica ningún suplemento', async () => {
      reservaModel.findById.mockReturnValue({ exec: jest.fn().mockResolvedValue(ajusteReservaMock()) });
      await expect(service.solicitarAjuste('reserva-1', 'comercio-1', [])).rejects.toThrow(DomainException);
    });

    it('debería rechazar el ciclo de suplementos en reservas de veterinaria', async () => {
      const doc = ajusteReservaMock({ vertical: VerticalKey.VETERINARIA });
      reservaModel.findById.mockReturnValue({ exec: jest.fn().mockResolvedValue(doc) });
      await expect(
        service.solicitarAjuste('reserva-1', 'comercio-1', [{ concepto: 'Analítica', monto: 55 }]),
      ).rejects.toThrow(DomainException);
    });
  });

  describe('confirmarAjuste', () => {
    it('debería recalcular subtotal/comisión y volver a CONFIRMADA', async () => {
      const doc = ajusteReservaMock({ estado: ReservaEstado.AJUSTE_SOLICITADO, montoAjustado: 139.15 });
      reservaModel.findById.mockReturnValue({ exec: jest.fn().mockResolvedValue(doc) });

      const resultado = await service.confirmarAjuste('reserva-1');

      expect(resultado.estado).toBe(ReservaEstado.CONFIRMADA);
      expect(resultado.montoTotal).toBe(139.15);
      expect(resultado.montoSubtotal).toBeCloseTo(115);
      expect(resultado.montoAjustado).toBeUndefined();
    });

    it('debería ser idempotente si ya no hay ajuste pendiente', async () => {
      const doc = ajusteReservaMock({ estado: ReservaEstado.CONFIRMADA });
      reservaModel.findById.mockReturnValue({ exec: jest.fn().mockResolvedValue(doc) });

      await service.confirmarAjuste('reserva-1');

      expect(doc.save).not.toHaveBeenCalled();
    });
  });

  describe('rechazarAjuste', () => {
    it('debería cancelar la reserva cuando el cliente rechaza el ajuste', async () => {
      const doc = ajusteReservaMock({ estado: ReservaEstado.AJUSTE_SOLICITADO, montoAjustado: 139.15 });
      reservaModel.findById.mockReturnValue({ exec: jest.fn().mockResolvedValue(doc) });

      const resultado = await service.rechazarAjuste('reserva-1', 'user-1');

      expect(resultado.estado).toBe(ReservaEstado.CANCELADA);
      expect(resultado.montoAjustado).toBeUndefined();
    });

    it('debería lanzar 400 si no hay ajuste pendiente', async () => {
      const doc = ajusteReservaMock({ estado: ReservaEstado.CONFIRMADA });
      reservaModel.findById.mockReturnValue({ exec: jest.fn().mockResolvedValue(doc) });
      await expect(service.rechazarAjuste('reserva-1', 'user-1')).rejects.toThrow(DomainException);
    });
  });

  describe('recordatorios', () => {
    const findConReservas = (reservas: unknown[]) => {
      reservaModel.find.mockReturnValue({
        select: jest.fn().mockReturnThis(),
        sort: jest.fn().mockReturnThis(),
        lean: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue(reservas),
      });
    };

    it('debería sugerir volver a peluquería si hace más del umbral (2 meses)', async () => {
      const hace5meses = new Date();
      hace5meses.setMonth(hace5meses.getMonth() - 5);
      findConReservas([{ vertical: VerticalKey.PELUQUERIA, fechaInicio: hace5meses }]);

      const recordatorios = await service.recordatorios('user-1');

      expect(recordatorios).toHaveLength(1);
      expect(recordatorios[0].vertical).toBe(VerticalKey.PELUQUERIA);
      expect(recordatorios[0].mesesDesde).toBeGreaterThanOrEqual(2);
    });

    it('no debería sugerir nada si el servicio es reciente', async () => {
      const haceUnMes = new Date();
      haceUnMes.setMonth(haceUnMes.getMonth() - 1);
      findConReservas([{ vertical: VerticalKey.PELUQUERIA, fechaInicio: haceUnMes }]);

      expect(await service.recordatorios('user-1')).toHaveLength(0);
    });
  });

  describe('proxima', () => {
    const findOneCon = (reserva: unknown) => {
      reservaModel.findOne.mockReturnValue({
        sort: jest.fn().mockReturnThis(),
        populate: jest.fn().mockReturnThis(),
        lean: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue(reserva),
      });
    };

    it('debería devolver null si el usuario no tiene reservas confirmadas por delante', async () => {
      findOneCon(null);
      expect(await service.proxima('user-1')).toBeNull();
    });

    it('debería devolver el nombre del servicio, imagen y ciudad de la próxima reserva', async () => {
      const fecha = new Date('2026-09-01');
      findOneCon({
        codigo: 'RES-ABCD1234',
        fechaInicio: fecha,
        vertical: VerticalKey.ALOJAMIENTO,
        servicioId: { titulo: 'Royal Dog Resort', imagenes: ['foto.jpg'] },
        comercioId: { nombreComercial: 'Royal Dog SL', direccion: { ciudad: 'Madrid' } },
      });

      const resultado = await service.proxima('user-1');

      expect(resultado).toEqual({
        codigo: 'RES-ABCD1234',
        titulo: 'Royal Dog Resort',
        imagen: 'foto.jpg',
        ciudad: 'Madrid',
        fechaInicio: fecha,
        vertical: VerticalKey.ALOJAMIENTO,
      });
    });

    it('debería caer al nombre del comercio si el servicio no tiene título', async () => {
      findOneCon({
        codigo: 'RES-ABCD1234',
        fechaInicio: new Date(),
        vertical: VerticalKey.TRANSPORTE,
        servicioId: {},
        comercioId: { nombreComercial: 'Transportes Fido' },
      });

      const resultado = await service.proxima('user-1');

      expect(resultado?.titulo).toBe('Transportes Fido');
      expect(resultado?.imagen).toBe('');
      expect(resultado?.ciudad).toBe('');
    });
  });

  /** Documento de reserva con lo que usan los flujos de viaje: `save` devuelve el propio documento. */
  const docReserva = (extra: Record<string, unknown> = {}) => {
    const doc: Record<string, unknown> = {
      ...reservaMock,
      servicioId: { toString: () => 'servicio-1' },
      seguimiento: [],
      historialEstados: [],
      evidencias: [],
      markModified: jest.fn(),
      ...extra,
    };
    doc['save'] = jest.fn().mockImplementation(() => Promise.resolve(doc));
    return doc as unknown as ReservaDocument & {
      save: jest.Mock; markModified: jest.Mock; evidencias: Array<Record<string, unknown>>;
    };
  };

  const devolverAlBuscar = (doc: unknown) => {
    reservaModel.findById.mockReturnValue({ exec: jest.fn().mockResolvedValue(doc) });
  };

  describe('agregarSeguimiento', () => {
    it('añade un hito, pone EN_CURSO si la reserva estaba confirmada y avisa al cliente', async () => {
      const doc = docReserva({ estado: ReservaEstado.CONFIRMADA });
      devolverAlBuscar(doc);

      await service.agregarSeguimiento('reserva-1', 'comercio-1', 'recogida', 'Todo bien');

      expect(doc.seguimiento).toHaveLength(1);
      expect(doc.seguimiento[0]).toMatchObject({ hito: 'recogida', nota: 'Todo bien' });
      expect(doc.estado).toBe(ReservaEstado.EN_CURSO);
      expect(doc.historialEstados).toEqual([expect.objectContaining({ estado: ReservaEstado.EN_CURSO })]);
      expect(notificationsService.notificarHitoViaje).toHaveBeenCalledWith('reserva-1', 'recogida', 'Todo bien', undefined);
    });

    it('el hito "finalizada" marca la reserva COMPLETADA', async () => {
      const doc = docReserva({ estado: ReservaEstado.EN_CURSO });
      devolverAlBuscar(doc);

      await service.agregarSeguimiento('reserva-1', 'comercio-1', 'finalizada');
      expect(doc.estado).toBe(ReservaEstado.COMPLETADA);
    });

    it('no cambia el estado si la reserva ya está en curso y el hito no es el final', async () => {
      const doc = docReserva({ estado: ReservaEstado.EN_CURSO });
      devolverAlBuscar(doc);

      await service.agregarSeguimiento('reserva-1', 'comercio-1', 'en_trayecto');
      expect(doc.estado).toBe(ReservaEstado.EN_CURSO);
      expect(doc.historialEstados).toHaveLength(0);
    });

    it('guarda la foto del hito como evidencia', async () => {
      const doc = docReserva({ estado: ReservaEstado.CONFIRMADA });
      devolverAlBuscar(doc);

      await service.agregarSeguimiento('reserva-1', 'comercio-1', 'entregada', undefined, 'https://cdn/foto.jpg');

      expect(doc.evidencias).toEqual([expect.objectContaining({ tipo: 'hito_entregada', url: 'https://cdn/foto.jpg' })]);
    });

    it('rechaza con 404 si la reserva no existe', async () => {
      devolverAlBuscar(null);
      await expect(service.agregarSeguimiento('reserva-1', 'comercio-1', 'recogida'))
        .rejects.toMatchObject({ statusCode: 404 });
    });

    it('rechaza si la reserva no es del comercio', async () => {
      devolverAlBuscar(docReserva({ comercioId: { toString: () => 'otro' } }));
      await expect(service.agregarSeguimiento('reserva-1', 'comercio-1', 'recogida'))
        .rejects.toMatchObject({ statusCode: 403 });
    });

    it('rechaza con 400 si la reserva no está confirmada ni en curso', async () => {
      devolverAlBuscar(docReserva({ estado: ReservaEstado.PENDIENTE }));
      await expect(service.agregarSeguimiento('reserva-1', 'comercio-1', 'recogida'))
        .rejects.toMatchObject({ statusCode: 400 });
    });

    it('rechaza con 409 si el viaje todavía está pendiente de aceptar', async () => {
      devolverAlBuscar(docReserva({
        estado: ReservaEstado.CONFIRMADA, aceptacion: { requerida: true, estado: 'pendiente', plazoMin: 60 },
      }));
      await expect(service.agregarSeguimiento('reserva-1', 'comercio-1', 'recogida'))
        .rejects.toMatchObject({ statusCode: 409 });
    });

    it('deja que el vertical valide el hito y no guarda nada si lo rechaza', async () => {
      const doc = docReserva({ estado: ReservaEstado.CONFIRMADA });
      devolverAlBuscar(doc);
      const validarHito = jest.fn().mockImplementation(() => {
        throw new DomainException('Hito desconocido', 400);
      });
      availabilityRegistry.obtener.mockReturnValue({ ...estrategiaMock, validarHito } as never);

      await expect(service.agregarSeguimiento('reserva-1', 'comercio-1', 'volando'))
        .rejects.toMatchObject({ statusCode: 400 });
      expect(validarHito).toHaveBeenCalledWith(expect.objectContaining({ servicioId: 'servicio-1' }), 'volando', undefined);
      expect(doc.save).not.toHaveBeenCalled();
      expect(notificationsService.notificarHitoViaje).not.toHaveBeenCalled();
    });
  });

  describe('aceptación de viajes', () => {
    const pendiente = (extra: Record<string, unknown> = {}) => docReserva({
      estado: ReservaEstado.CONFIRMADA,
      fechaInicio: new Date('2026-10-01T07:00:00.000Z'),
      aceptacion: { requerida: true, estado: 'pendiente', plazoMin: 60 },
      ...extra,
    });

    it('aceptarViaje fija la hora confirmada en hora de Madrid y avisa al cliente', async () => {
      const doc = pendiente();
      devolverAlBuscar(doc);

      await service.aceptarViaje('reserva-1', 'comercio-1', '11:15');

      expect(doc.fechaInicio.toISOString()).toBe('2026-10-01T09:15:00.000Z');
      expect(doc.aceptacion).toEqual(expect.objectContaining({ estado: 'aceptada', requerida: true, plazoMin: 60 }));
      expect(doc.aceptacion?.resueltaAt).toBeInstanceOf(Date);
      expect(doc.markModified).toHaveBeenCalledWith('aceptacion');
      expect(doc.historialEstados).toEqual([expect.objectContaining({ motivo: 'Aceptada por el comercio', por: 'comercio:comercio-1' })]);
      expect(notificationsService.notificarAceptacion).toHaveBeenCalledWith('reserva-1', true);
    });

    it('aceptarViaje conserva la hora si no llega una hora válida', async () => {
      const doc = pendiente();
      devolverAlBuscar(doc);

      await service.aceptarViaje('reserva-1', 'comercio-1', '99:99');

      expect(doc.fechaInicio.toISOString()).toBe('2026-10-01T07:00:00.000Z');
    });

    it('pendienteDeAceptar lanza 404 si la reserva no existe', async () => {
      devolverAlBuscar(null);
      await expect(service.pendienteDeAceptar('reserva-1', 'comercio-1')).rejects.toMatchObject({ statusCode: 404 });
    });

    it('pendienteDeAceptar lanza 403 si la reserva es de otro comercio', async () => {
      devolverAlBuscar(pendiente({ comercioId: { toString: () => 'otro' } }));
      await expect(service.pendienteDeAceptar('reserva-1', 'comercio-1')).rejects.toMatchObject({ statusCode: 403 });
    });

    it('pendienteDeAceptar lanza 400 si ya se aceptó', async () => {
      devolverAlBuscar(pendiente({ aceptacion: { requerida: true, estado: 'aceptada', plazoMin: 60 } }));
      await expect(service.pendienteDeAceptar('reserva-1', 'comercio-1')).rejects.toMatchObject({ statusCode: 400 });
    });

    it('pendienteDeAceptar lanza 400 si la reserva aún no se ha pagado', async () => {
      devolverAlBuscar(pendiente({ estado: ReservaEstado.PENDIENTE }));
      await expect(service.pendienteDeAceptar('reserva-1', 'comercio-1')).rejects.toMatchObject({ statusCode: 400 });
    });

    it('aceptacionesVencidas busca confirmadas pendientes con el plazo vencido', async () => {
      const limit = jest.fn().mockReturnValue({ exec: jest.fn().mockResolvedValue([]) });
      reservaModel.find.mockReturnValue({ limit });

      await service.aceptacionesVencidas(20);

      expect(reservaModel.find).toHaveBeenCalledWith({
        estado: ReservaEstado.CONFIRMADA,
        'aceptacion.estado': 'pendiente',
        'aceptacion.venceEn': { $lt: expect.any(Date) },
      });
      expect(limit).toHaveBeenCalledWith(20);
    });
  });

  describe('cancelación con política del vertical', () => {
    it('politicaCancelacion sin estrategia de cancelación no devuelve nada automáticamente', async () => {
      const politica = await service.politicaCancelacion(docReserva());
      expect(politica.porcentaje).toBe(0);
      expect(politica.motivo).toContain('revisará');
    });

    it('politicaCancelacion delega en la estrategia del vertical cuando la tiene', async () => {
      const politicaReembolso = jest.fn().mockResolvedValue({ porcentaje: 100, motivo: 'Gratis' });
      availabilityRegistry.obtener.mockReturnValue({ ...estrategiaMock, politicaReembolso } as never);
      const doc = docReserva({ estado: ReservaEstado.CONFIRMADA, fechaInicio: new Date('2026-10-01T07:00:00Z'), detalle: { a: 1 } });

      const politica = await service.politicaCancelacion(doc);

      expect(politica).toEqual({ porcentaje: 100, motivo: 'Gratis' });
      expect(politicaReembolso).toHaveBeenCalledWith(expect.objectContaining({
        servicioId: 'servicio-1', estado: ReservaEstado.CONFIRMADA, detalle: { a: 1 },
      }));
    });

    it.each([ReservaEstado.PENDIENTE, ReservaEstado.CONFIRMADA])('cancelablePorCliente admite una reserva %s', async (estado) => {
      const doc = docReserva({ estado });
      devolverAlBuscar(doc);
      await expect(service.cancelablePorCliente('reserva-1', 'user-1')).resolves.toBe(doc);
    });

    it.each([ReservaEstado.EN_CURSO, ReservaEstado.CANCELADA, ReservaEstado.COMPLETADA])(
      'cancelablePorCliente rechaza una reserva %s', async (estado) => {
        devolverAlBuscar(docReserva({ estado }));
        await expect(service.cancelablePorCliente('reserva-1', 'user-1')).rejects.toMatchObject({ statusCode: 400 });
      },
    );

    it('marcarCancelada libera la plaza, anota reembolso y aceptación y cancela la serie', async () => {
      const doc = docReserva({
        estado: ReservaEstado.CONFIRMADA, holdId: 'hold-9',
        aceptacion: { requerida: true, estado: 'pendiente', plazoMin: 60 },
      });

      await service.marcarCancelada(doc, {
        por: 'comercio:comercio-1', motivo: 'Sin conductor',
        reembolso: { porcentaje: 100, importe: 55 }, aceptacion: 'rechazada',
      });

      expect(estrategiaMock.releaseSlot).toHaveBeenCalledWith('hold-9');
      expect(doc.holdId).toBeUndefined();
      expect(doc.estado).toBe(ReservaEstado.CANCELADA);
      expect(doc.reembolso).toEqual(expect.objectContaining({ porcentaje: 100, importe: 55, motivo: 'Sin conductor' }));
      expect(doc.aceptacion).toEqual(expect.objectContaining({ estado: 'rechazada', motivo: 'Sin conductor' }));
      expect(doc.markModified).toHaveBeenCalledWith('aceptacion');
      expect(reservaModel.updateMany).toHaveBeenCalledWith(
        { reservaOrigenId: 'reserva-1', estado: { $in: [ReservaEstado.PENDIENTE, ReservaEstado.CONFIRMADA] } },
        { estado: ReservaEstado.CANCELADA },
      );
    });

    it('marcarCancelada sin hold ni reembolso sólo cambia el estado', async () => {
      const doc = docReserva({ estado: ReservaEstado.PENDIENTE, holdId: undefined });

      await service.marcarCancelada(doc, { por: 'cliente', motivo: 'Cambio de planes', aceptacion: 'caducada' });

      expect(estrategiaMock.releaseSlot).not.toHaveBeenCalled();
      expect(doc.reembolso).toBeUndefined();
      expect(doc.aceptacion).toBeUndefined();
      expect(doc.estado).toBe(ReservaEstado.CANCELADA);
    });

    it('cancelar también cancela las reservas hija de la serie', async () => {
      devolverAlBuscar(docReserva({ estado: ReservaEstado.CONFIRMADA }));

      await service.cancelar('reserva-1', 'user-1');

      expect(reservaModel.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({ reservaOrigenId: 'reserva-1' }),
        { estado: ReservaEstado.CANCELADA },
      );
    });
  });

  describe('confirmar — lo que pasa tras cobrar', () => {
    beforeEach(() => {
      // Reserva aún pendiente y con la plaza retenida: se confirma sin revalidar.
      const pendiente = { ...reservaMock, estado: ReservaEstado.PENDIENTE, holdId: 'hold-1' };
      reservaModel.findById.mockReturnValue({
        exec: jest.fn().mockResolvedValue(pendiente),
        lean: jest.fn().mockReturnValue({ exec: jest.fn().mockResolvedValue(pendiente) }),
      });
    });

    it('arranca el plazo de aceptación y avisa al comercio', async () => {
      const confirmada = docReserva({
        estado: ReservaEstado.CONFIRMADA, aceptacion: { requerida: true, estado: 'pendiente', plazoMin: 30 },
      });
      reservaModel.findByIdAndUpdate.mockReturnValue({ exec: jest.fn().mockResolvedValue(confirmada) });
      const antes = Date.now();

      await service.confirmar('reserva-1');

      const venceEn = confirmada.aceptacion?.venceEn as Date;
      expect(venceEn.getTime()).toBeGreaterThanOrEqual(antes + 30 * 60_000);
      expect(confirmada.save).toHaveBeenCalled();
      expect(notificationsService.notificarPendienteAceptacion).toHaveBeenCalledWith('reserva-1');
    });

    it('no reinicia el plazo si ya estaba arrancado', async () => {
      const venceEn = new Date('2030-01-01');
      const confirmada = docReserva({
        estado: ReservaEstado.CONFIRMADA, aceptacion: { requerida: true, estado: 'pendiente', plazoMin: 30, venceEn },
      });
      reservaModel.findByIdAndUpdate.mockReturnValue({ exec: jest.fn().mockResolvedValue(confirmada) });

      await service.confirmar('reserva-1');

      expect(confirmada.aceptacion?.venceEn).toBe(venceEn);
      expect(notificationsService.notificarPendienteAceptacion).not.toHaveBeenCalled();
    });
  });

  describe('crear — viajes de transporte', () => {
    it('debería cobrar el precio acordado en lugar de la tarifa y pasárselo al vertical', async () => {
      await service.crear({ ...parametrosBase, precioAcordado: 180 });

      expect(estrategiaMock.checkAvailability).toHaveBeenCalledWith('servicio-1', expect.objectContaining({
        parametrosExtra: expect.objectContaining({ precioAcordado: 180 }),
      }));
      const guardada = reservaModel.mock.calls[0][0];
      expect(guardada.montoTotal).toBe(180);
    });

    it('no debería mandar precio acordado al vertical si la reserva no viene de un presupuesto', async () => {
      await service.crear(parametrosBase);

      const consulta = estrategiaMock.checkAvailability.mock.calls[0][1];
      expect(consulta.parametrosExtra).not.toHaveProperty('precioAcordado');
    });

    it('debería rechazar con 409 un viaje que requiere presupuesto si no trae precio acordado', async () => {
      estrategiaMock.checkAvailability.mockResolvedValue({
        disponible: true, precioCalculado: 0,
        metadata: { requierePresupuesto: true, motivoPresupuesto: 'Viaje a medida' },
      });

      await expect(service.crear(parametrosBase)).rejects.toMatchObject({ message: 'Viaje a medida', statusCode: 409 });
      expect(estrategiaMock.reserveSlot).not.toHaveBeenCalled();
    });

    it('debería usar un motivo genérico si el vertical no explica por qué requiere presupuesto', async () => {
      estrategiaMock.checkAvailability.mockResolvedValue({
        disponible: true, precioCalculado: 0, metadata: { requierePresupuesto: true },
      });

      await expect(service.crear(parametrosBase)).rejects.toMatchObject({
        message: 'Este servicio necesita un presupuesto a medida.',
      });
    });

    it('debería reservar un viaje que requiere presupuesto cuando trae el precio acordado', async () => {
      estrategiaMock.checkAvailability.mockResolvedValue({
        disponible: true, precioCalculado: 0, metadata: { requierePresupuesto: true },
      });

      await service.crear({ ...parametrosBase, precioAcordado: 95 });

      expect(reservaModel.mock.calls[0][0].montoTotal).toBe(95);
    });

    it('congela la ficha de las demás mascotas del viaje, sin repetir la principal', async () => {
      perrosService.obtenerPropio.mockImplementation(async (id: string) => ({
        _id: id, nombre: `perro-${id}`, especie: 'perro',
      }) as never);

      await service.crear({ ...parametrosBase, perroId: 'p1', perroIdsAdicionales: ['p2', 'p1', 'p2', 'p3'] });

      const guardada = reservaModel.mock.calls[0][0];
      expect(guardada.perrosAdicionales).toEqual([
        { perroId: 'p2', snapshot: expect.objectContaining({ nombre: 'perro-p2' }) },
        { perroId: 'p3', snapshot: expect.objectContaining({ nombre: 'perro-p3' }) },
      ]);
      expect(perrosService.obtenerPropio).toHaveBeenCalledWith('p2', 'user-1');
    });

    it('guarda lo que la estrategia anota en metadata.detalleReserva y la aceptación requerida', async () => {
      estrategiaMock.checkAvailability.mockResolvedValue({
        disponible: true, precioCalculado: 55,
        metadata: { detalleReserva: { km: 70, desglose: [{ concepto: 'Trayecto', importe: 55 }] }, requiereAceptacion: true, plazoAceptacionMin: 2 },
      });

      await service.crear({ ...parametrosBase, detalle: { origen: 'A' } });

      const guardada = reservaModel.mock.calls[0][0];
      expect(guardada.detalle).toEqual(expect.objectContaining({ origen: 'A', km: 70 }));
      // El plazo mínimo es de 5 minutos aunque la estrategia pida menos.
      expect(guardada.aceptacion).toEqual({ requerida: true, estado: 'pendiente', plazoMin: 5 });
    });

    it('no pide aceptación si la estrategia no lo indica', async () => {
      await service.crear(parametrosBase);
      expect(reservaModel.mock.calls[0][0].aceptacion).toBeUndefined();
    });
  });
  describe('obtenerPuntos', () => {
    const USER_ID = new Types.ObjectId().toString();

    it('debería calcular puntos por gasto y el progreso al próximo descuento', async () => {
      reservaModel.aggregate = jest.fn().mockReturnValue({
        exec: jest.fn().mockResolvedValue([{ total: 350.75 }]),
      });

      const puntos = await service.obtenerPuntos(USER_ID);

      expect(puntos.puntos).toBe(350); // se trunca
      expect(puntos.proximoUmbral).toBe(400);
      expect(puntos.puntosFaltantes).toBe(50);
      expect(puntos.valorProximoDescuento).toBe(5);
    });

    it('debería devolver 0 puntos si no hay reservas', async () => {
      reservaModel.aggregate = jest.fn().mockReturnValue({
        exec: jest.fn().mockResolvedValue([]),
      });

      const puntos = await service.obtenerPuntos(USER_ID);
      expect(puntos.puntos).toBe(0);
      expect(puntos.proximoUmbral).toBe(400);
    });
  });
});
