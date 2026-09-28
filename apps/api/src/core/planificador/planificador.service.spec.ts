import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { ConfigService } from '@nestjs/config';
import { Types } from 'mongoose';
import { AlojamientoViaje, DesplazamientoViaje, RitmoViaje, VerticalKey } from 'shared';
import { PlanificadorService } from './planificador.service';
import { Servicio } from '../catalog/servicio.schema';
import { Lugar } from '../lugares/lugar.schema';
import { PerrosService } from '../perros/perros.service';
import { CentrosPoblacionService } from '../geo/centros-poblacion.service';
import { DomainException } from '../../shared/exceptions/domain.exception';

const LUGAR_ID = new Types.ObjectId();
const SERVICIO_ID = new Types.ObjectId();

const lugar = { _id: LUGAR_ID, nombre: 'Playa canina', tipo: 'playa', descripcion: '', ubicacion: { ciudad: 'Cádiz' } };
const servicio = {
  _id: SERVICIO_ID, titulo: 'Residencia Royal', descripcion: '',
  vertical: VerticalKey.ALOJAMIENTO, precioBase: 45, ubicacion: { ciudad: 'Cádiz' },
};

describe('PlanificadorService', () => {
  let service: PlanificadorService;
  let servicioModel: { find: jest.Mock; aggregate: jest.Mock };
  let lugarModel: { find: jest.Mock; aggregate: jest.Mock };
  let centrosPoblacion: { centroDe: jest.Mock };
  let perrosService: { obtenerPropio: jest.Mock };
  let fetchMock: jest.Mock;

  const cadena = (resultado: unknown[]) => ({
    sort: jest.fn().mockReturnThis(),
    limit: jest.fn().mockReturnThis(),
    select: jest.fn().mockReturnThis(),
    lean: jest.fn().mockReturnThis(),
    exec: jest.fn().mockResolvedValue(resultado),
  });

  const crear = async (apiKey?: string): Promise<PlanificadorService> => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PlanificadorService,
        { provide: getModelToken(Servicio.name), useValue: servicioModel },
        { provide: getModelToken(Lugar.name), useValue: lugarModel },
        { provide: PerrosService, useValue: perrosService },
        { provide: CentrosPoblacionService, useValue: centrosPoblacion },
        { provide: ConfigService, useValue: { get: jest.fn().mockReturnValue(apiKey) } },
      ],
    }).compile();
    return module.get(PlanificadorService);
  };

  const respuestaIA = (contenido: unknown): void => {
    fetchMock.mockResolvedValue({
      ok: true, status: 200,
      json: async () => ({ choices: [{ message: { content: JSON.stringify(contenido) } }] }),
    });
  };

  beforeEach(async () => {
    servicioModel = { find: jest.fn().mockReturnValue(cadena([servicio])), aggregate: jest.fn() };
    lugarModel = { find: jest.fn().mockReturnValue(cadena([lugar])), aggregate: jest.fn() };
    centrosPoblacion = { centroDe: jest.fn().mockResolvedValue(null) };
    perrosService = { obtenerPropio: jest.fn() };

    fetchMock = jest.fn();
    global.fetch = fetchMock as unknown as typeof fetch;

    service = await crear('clave-de-prueba');
  });

  it('debería exigir una provincia', async () => {
    await expect(service.generar({ provincia: '  ' })).rejects.toThrow(DomainException);
  });

  it('debería avisar si no hay contenido en la provincia', async () => {
    servicioModel.find.mockReturnValue(cadena([]));
    lugarModel.find.mockReturnValue(cadena([]));

    await expect(service.generar({ provincia: 'Teruel' })).rejects.toThrow(DomainException);
  });

  it('solo debería usar lugares ya moderados', async () => {
    await service.generar({ provincia: 'Cádiz' });

    expect(lugarModel.find).toHaveBeenCalledWith(
      expect.objectContaining({ estado: 'publicado' }),
    );
  });

  it('debería acotar los servicios al presupuesto indicado', async () => {
    await service.generar({ provincia: 'Cádiz', presupuestoMax: 60 });

    const filtro = servicioModel.find.mock.calls[0][0] as Record<string, unknown>;
    expect(filtro['precioBase']).toEqual({ $lte: 60 });
  });

  describe('sin clave de IA configurada', () => {
    beforeEach(async () => {
      service = await crear(undefined);
    });

    it('debería devolver un itinerario real, no un error', async () => {
      const respuesta = await service.generar({ provincia: 'Cádiz' });

      expect(respuesta.esFallback).toBe(true);
      expect(respuesta.opciones).toHaveLength(1);
      expect(fetchMock).not.toHaveBeenCalled();
    });

    /**
     * Regresión (observación del cliente 09-09-2026): el aviso decía «el
     * asistente con IA no está disponible ahora mismo» y el cliente lo leía
     * como que el planificador estaba roto, aunque debajo tuviera el plan
     * entero. Sin clave configurada esto es el camino normal, no una avería.
     */
    it('no debería anunciar el itinerario propio como una avería', async () => {
      const respuesta = await service.generar({ provincia: 'Cádiz' });

      expect(respuesta.aviso).not.toMatch(/no est[áa] disponible/i);
      expect(respuesta.aviso).toContain('Cádiz');
      expect(respuesta.aviso).toMatch(/verificad/i);
    });

    it('debería abrir el plan con el alojamiento disponible', async () => {
      const respuesta = await service.generar({ provincia: 'Cádiz' });

      const primera = respuesta.opciones[0].dias[0].paradas[0];
      expect(primera.tipo).toBe('servicio');
      expect(primera.servicioId).toBe(String(SERVICIO_ID));
    });

    it('debería titular cada día por el tipo de sitio que lo domina', async () => {
      const respuesta = await service.generar({ provincia: 'Cádiz' });

      // El único lugar del contexto es una playa.
      expect(respuesta.opciones[0].dias[0].titulo).toBe('Día 1 · Playas y costa');
    });

    it('debería estimar el presupuesto con el precio del alojamiento', async () => {
      const respuesta = await service.generar({ provincia: 'Cádiz' });

      expect(respuesta.opciones[0].presupuestoEstimado).toBe(45);
    });

    it('debería resumir el plan diciendo cuántos días y cuántos sitios trae', async () => {
      const respuesta = await service.generar({ provincia: 'Cádiz' });

      expect(respuesta.opciones[0].resumen).toContain('1 sitio');
    });
  });

  describe('con IA', () => {
    it('debería conservar las paradas que apuntan al catálogo real', async () => {
      respuestaIA({
        opciones: [{
          nombre: 'Plan tranquilo', resumen: 'x', presupuestoEstimado: 120,
          dias: [{ dia: 1, titulo: 'Día 1', paradas: [{ titulo: 'X', descripcion: '', tipo: 'servicio', servicioId: String(SERVICIO_ID) }] }],
        }],
      });

      const respuesta = await service.generar({ provincia: 'Cádiz' });

      const parada = respuesta.opciones[0].dias[0].paradas[0];
      expect(respuesta.esFallback).toBe(false);
      expect(parada.servicioId).toBe(String(SERVICIO_ID));
      // El título se reemplaza por el real del catálogo, no el que redactó la IA.
      expect(parada.titulo).toBe('Residencia Royal');
    });

    it('debería desactivar las paradas que la IA se inventó', async () => {
      respuestaIA({
        opciones: [{
          nombre: 'Plan', resumen: 'x', presupuestoEstimado: 0,
          dias: [{ dia: 1, titulo: 'Día 1', paradas: [{ titulo: 'Hotel inventado', descripcion: '', tipo: 'servicio', servicioId: 'no-existe' }] }],
        }],
      });

      const respuesta = await service.generar({ provincia: 'Cádiz' });

      const parada = respuesta.opciones[0].dias[0].paradas[0];
      // Sobrevive como texto, pero sin botón de reservar: no se puede ofrecer
      // algo que no está en el catálogo.
      expect(parada.servicioId).toBeUndefined();
      expect(parada.tipo).toBe('lugar');
    });

    it('debería caer al itinerario propio si el proveedor falla', async () => {
      fetchMock.mockResolvedValue({ ok: false, status: 500, json: async () => ({}) });

      const respuesta = await service.generar({ provincia: 'Cádiz' });

      expect(respuesta.esFallback).toBe(true);
      expect(respuesta.opciones.length).toBeGreaterThan(0);
    });

    it('debería cachear por provincia y mes para no pagar dos generaciones', async () => {
      respuestaIA({ opciones: [{ nombre: 'A', resumen: '', presupuestoEstimado: 0, dias: [] }] });

      await service.generar({ provincia: 'Cádiz', desde: '2026-08-01' });
      await service.generar({ provincia: 'cádiz', desde: '2026-08-20' });

      expect(fetchMock).toHaveBeenCalledTimes(1);
    });

    it('debería limitar cuántos itinerarios genera un mismo usuario al día', async () => {
      respuestaIA({ opciones: [{ nombre: 'A', resumen: '', presupuestoEstimado: 0, dias: [] }] });

      // Provincias distintas para esquivar la caché y llegar al tope.
      for (let i = 0; i < 10; i++) {
        await service.generar({ provincia: `Provincia${i}` }, 'user-1');
      }

      await expect(service.generar({ provincia: 'Otra' }, 'user-1')).rejects.toThrow(DomainException);
    });

    it('no debería impedir el viaje si el perro indicado no es accesible', async () => {
      perrosService.obtenerPropio.mockRejectedValue(new Error('403'));
      respuestaIA({ opciones: [{ nombre: 'A', resumen: '', presupuestoEstimado: 0, dias: [] }] });

      await expect(
        service.generar({ provincia: 'Cádiz', perroId: 'p1' }, 'user-1'),
      ).resolves.toBeDefined();
    });
  });

  /*
   * Observación del cliente 28-09: más preguntas para afinar el itinerario y
   * que el plan termine siempre en un servicio de la plataforma.
   */
  describe('preguntas del viaje', () => {
    beforeEach(async () => {
      service = await crear(undefined);
    });

    it('debería buscar servicios por provincia y no sólo por la ciudad que se llama igual', async () => {
      await service.generar({ provincia: 'Alicante', municipio: 'Dénia' });

      const filtro = servicioModel.find.mock.calls[0][0] as { $or: Array<Record<string, RegExp>> };
      expect(filtro.$or.map((c) => Object.keys(c)[0])).toEqual([
        'ubicacion.provincia', 'ubicacion.ciudad', 'ubicacion.ciudad',
      ]);
      expect(filtro).toMatchObject({ comercioActivo: true });
    });

    it('debería buscar primero las categorías que el viaje necesita', async () => {
      await service.generar({
        provincia: 'Alicante',
        desplazamiento: DesplazamientoViaje.TRANSPORTE_MASCOTA,
        serviciosExtra: [VerticalKey.PELUQUERIA],
      });

      const filtro = servicioModel.find.mock.calls[0][0] as { vertical: { $in: string[] } };
      expect(filtro.vertical.$in).toEqual([
        VerticalKey.TRANSPORTE, VerticalKey.ALOJAMIENTO, VerticalKey.HOTELES, VerticalKey.PELUQUERIA,
      ]);
    });

    it('debería buscar servicios alrededor si la provincia no tiene ninguno', async () => {
      servicioModel.find
        .mockReturnValueOnce(cadena([]))
        .mockReturnValueOnce(cadena([]))
        .mockReturnValueOnce(cadena([servicio]));
      centrosPoblacion.centroDe.mockResolvedValue({ lat: 38.84, lng: 0.1 });

      const respuesta = await service.generar({ provincia: 'Alicante' });

      const filtro = servicioModel.find.mock.calls[2][0] as Record<string, unknown>;
      expect(filtro['ubicacion.geo']).toBeDefined();
      expect(respuesta.serviciosSugeridos[0].servicioId).toBe(String(SERVICIO_ID));
    });

    it('debería filtrar los lugares por los intereses elegidos', async () => {
      await service.generar({ provincia: 'Cádiz', intereses: ['playa', 'no-existe'] });

      expect(lugarModel.find.mock.calls[0][0]).toMatchObject({ tipo: { $in: ['playa'] } });
    });

    it('debería armar tantos días como abarcan las fechas', async () => {
      const respuesta = await service.generar({ provincia: 'Cádiz', desde: '2026-10-01', hasta: '2026-10-03' });

      expect(respuesta.opciones[0].dias).toHaveLength(3);
    });

    it('debería terminar en un servicio aunque ya tenga alojamiento', async () => {
      const respuesta = await service.generar({
        provincia: 'Cádiz', alojamiento: AlojamientoViaje.YA_LO_TENGO, ritmo: RitmoViaje.TRANQUILO,
      });

      const paradas = respuesta.opciones[0].dias.flatMap((d) => d.paradas);
      expect(paradas.some((p) => p.servicioId)).toBe(true);
      expect(respuesta.serviciosSugeridos).toHaveLength(1);
    });

    it('no debería compartir caché entre viajes con distinto ritmo', async () => {
      await service.generar({ provincia: 'Cádiz', ritmo: RitmoViaje.TRANQUILO });
      await service.generar({ provincia: 'Cádiz', ritmo: RitmoViaje.INTENSO });

      expect(lugarModel.find).toHaveBeenCalledTimes(2);
    });
  });

  describe('con IA y sin servicios en su plan', () => {
    it('debería añadir un servicio reservable a la opción que no trae ninguno', async () => {
      respuestaIA({
        opciones: [{
          nombre: 'Sólo playas', resumen: 'x', presupuestoEstimado: 0,
          dias: [{ dia: 1, titulo: 'Día 1', paradas: [{ titulo: 'P', descripcion: '', tipo: 'lugar', lugarId: String(LUGAR_ID) }] }],
        }],
      });

      const respuesta = await service.generar({ provincia: 'Cádiz' });

      const paradas = respuesta.opciones[0].dias[0].paradas;
      expect(paradas.at(-1)?.servicioId).toBe(String(SERVICIO_ID));
    });
  });

  describe('destinos', () => {
    it('debería unir provincias de lugares y servicios sin duplicarlas y ordenarlas por contenido', async () => {
      lugarModel.aggregate.mockReturnValue({ exec: jest.fn().mockResolvedValue([
        { _id: 'Castellón', n: 21 }, { _id: 'Alicante', n: 60 },
      ]) });
      servicioModel.aggregate.mockReturnValue({ exec: jest.fn().mockResolvedValue([
        { _id: 'castellon', n: 4 }, { _id: 'Madrid', n: 2 },
      ]) });

      const destinos = await service.destinos();

      expect(destinos).toEqual([
        { provincia: 'Alicante', lugares: 60, servicios: 0 },
        { provincia: 'Castellón', lugares: 21, servicios: 4 },
        { provincia: 'Madrid', lugares: 0, servicios: 2 },
      ]);
    });

    it('debería guardar los destinos una hora para no recontarlos en cada visita', async () => {
      lugarModel.aggregate.mockReturnValue({ exec: jest.fn().mockResolvedValue([]) });
      servicioModel.aggregate.mockReturnValue({ exec: jest.fn().mockResolvedValue([]) });

      await service.destinos();
      await service.destinos();

      expect(lugarModel.aggregate).toHaveBeenCalledTimes(1);
    });
  });
});
