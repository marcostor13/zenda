import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { Types } from 'mongoose';
import { EstadoModeracion, TipoLugar } from 'shared';
import { ATRIBUTOS_INTERNOS, LugaresService } from './lugares.service';
import { Lugar } from './lugar.schema';
import { LugarReview } from './lugar-review.schema';
import { DomainException } from '../../shared/exceptions/domain.exception';

const LUGAR_ID = new Types.ObjectId().toString();
const USUARIO_ID = new Types.ObjectId().toString();

describe('LugaresService', () => {
  let service: LugaresService;
  let lugarModel: {
    find: jest.Mock; findById: jest.Mock; findOne: jest.Mock; findByIdAndUpdate: jest.Mock;
    create: jest.Mock; updateOne: jest.Mock; exists: jest.Mock;
  };
  let reviewModel: { find: jest.Mock; findByIdAndUpdate: jest.Mock; create: jest.Mock };

  /** Cadena `findOne().select().exec()` con el documento indicado. */
  const cadenaFicha = (documento: unknown) => ({
    select: jest.fn().mockReturnThis(),
    exec: jest.fn().mockResolvedValue(documento),
  });

  /** Cadena `find().sort().limit().exec()` con el resultado indicado. */
  const cadenaBusqueda = (resultado: unknown[]) => ({
    sort: jest.fn().mockReturnThis(),
    limit: jest.fn().mockReturnThis(),
    select: jest.fn().mockReturnThis(),
    lean: jest.fn().mockReturnThis(),
    exec: jest.fn().mockResolvedValue(resultado),
  });

  beforeEach(async () => {
    lugarModel = {
      find: jest.fn().mockReturnValue(cadenaBusqueda([])),
      findById: jest.fn().mockReturnValue(cadenaFicha(null)),
      findOne: jest.fn().mockReturnValue(cadenaFicha(null)),
      findByIdAndUpdate: jest.fn().mockReturnValue({ exec: jest.fn().mockResolvedValue(null) }),
      create: jest.fn().mockImplementation((d) => Promise.resolve(d)),
      updateOne: jest.fn().mockReturnValue({ exec: jest.fn().mockResolvedValue({}) }),
      exists: jest.fn().mockResolvedValue(null),
    };
    reviewModel = {
      find: jest.fn().mockReturnValue(cadenaBusqueda([])),
      findByIdAndUpdate: jest.fn().mockReturnValue({ exec: jest.fn().mockResolvedValue(null) }),
      create: jest.fn().mockImplementation((d) => Promise.resolve(d)),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        LugaresService,
        { provide: getModelToken(Lugar.name), useValue: lugarModel },
        { provide: getModelToken(LugarReview.name), useValue: reviewModel },
      ],
    }).compile();

    service = module.get(LugaresService);
  });

  describe('buscar', () => {
    it('solo debería devolver lugares ya aprobados', async () => {
      await service.buscar({});

      expect(lugarModel.find).toHaveBeenCalledWith(
        expect.objectContaining({ estado: EstadoModeracion.PUBLICADO }),
      );
    });

    it('debería filtrar por tipo y provincia', async () => {
      await service.buscar({ tipo: TipoLugar.PLAYA, provincia: 'Cádiz' });

      const filtro = lugarModel.find.mock.calls[0][0] as Record<string, unknown>;
      expect(filtro['tipo']).toBe(TipoLugar.PLAYA);
      expect(filtro['ubicacion.provincia']).toEqual(/Cádiz/i);
    });

    it('debería encontrar la población aunque se escriba de otra forma', async () => {
      // «Villareal» tiene que traer las fichas guardadas como «Vila-real»: es el
      // mismo desajuste que dejaba comercios sin aparecer en el buscador.
      await service.buscar({ ciudad: 'Villareal' });

      const filtro = lugarModel.find.mock.calls[0][0] as Record<string, RegExp>;
      expect(filtro['ubicacion.ciudad'].test('Vila-real')).toBe(true);
      expect(filtro['ubicacion.ciudad'].test('Villarreal')).toBe(true);
    });

    it('debería ordenar por cercanía cuando se dan coordenadas', async () => {
      await service.buscar({ lat: 36.5, lng: -6.2, radioKm: 10 });

      const filtro = lugarModel.find.mock.calls[0][0] as Record<string, { $nearSphere: Record<string, unknown> }>;
      expect(filtro['ubicacion.geo'].$nearSphere['$maxDistance']).toBe(10000);
    });

    it('no debería aplicar un orden propio junto a $nearSphere, que ya ordena', async () => {
      const cadena = cadenaBusqueda([]);
      lugarModel.find.mockReturnValue(cadena);

      await service.buscar({ lat: 36.5, lng: -6.2 });

      expect(cadena.sort).not.toHaveBeenCalled();
    });

    it('debería acotar el número de resultados aunque pidan más', async () => {
      const cadena = cadenaBusqueda([]);
      lugarModel.find.mockReturnValue(cadena);

      await service.buscar({ limit: 500 });

      expect(cadena.limit).toHaveBeenCalledWith(60);
    });
  });

  describe('obtener', () => {
    it('debería lanzar 404 si el lugar no existe', async () => {
      await expect(service.obtener(LUGAR_ID)).rejects.toThrow(DomainException);
    });

    it('no debería exponer un lugar pendiente de moderación', async () => {
      lugarModel.findOne.mockReturnValue(cadenaFicha({ estado: EstadoModeracion.PENDIENTE }));

      await expect(service.obtener(LUGAR_ID)).rejects.toThrow(DomainException);
    });

    /**
     * Las direcciones legibles (`/explora/rio-jucar-riola`) conviven con los
     * enlaces antiguos por id, que siguen circulando en marcadores y en el
     * índice de Google: romperlos habría convertido una mejora de SEO en una
     * pérdida de tráfico.
     */
    it('debería buscar por id cuando le llega un ObjectId', async () => {
      lugarModel.findOne.mockReturnValue(cadenaFicha({ estado: EstadoModeracion.PUBLICADO }));

      await service.obtener(LUGAR_ID);

      expect(lugarModel.findOne).toHaveBeenCalledWith(
        expect.objectContaining({ _id: expect.anything() }),
      );
    });

    it('debería buscar por slug cuando le llega una dirección legible', async () => {
      lugarModel.findOne.mockReturnValue(cadenaFicha({ estado: EstadoModeracion.PUBLICADO }));

      await service.obtener('Rio-Jucar-Riola');

      // En minúsculas: el slug se guarda así y la URL puede llegar como sea.
      expect(lugarModel.findOne).toHaveBeenCalledWith({ slug: 'rio-jucar-riola' });
    });

    it('debería responder 404 ante un slug que no existe', async () => {
      await expect(service.obtener('no-existe-este-sitio')).rejects.toThrow(DomainException);
    });
  });

  /**
   * Regresión (observación del cliente 09-09-2026): la ficha de Explora
   * enumera todos los atributos, y el sembrado del censo guardaba ahí la hoja
   * de origen. En pantalla se leía «Fuente: municipios_final.xlsx» entre las
   * duchas y el aparcamiento.
   */
  describe('atributos internos', () => {
    it('no debería enviar la procedencia del dato al buscar', async () => {
      const cadena = cadenaBusqueda([]);
      lugarModel.find.mockReturnValue(cadena);

      await service.buscar({});

      expect(cadena.select).toHaveBeenCalledWith(expect.stringContaining('-atributos.fuente'));
    });

    it('no debería enviarla tampoco en la ficha', async () => {
      const cadena = cadenaFicha({ estado: EstadoModeracion.PUBLICADO });
      lugarModel.findOne.mockReturnValue(cadena);

      await service.obtener(LUGAR_ID);

      expect(cadena.select).toHaveBeenCalledWith(expect.stringContaining('-atributos.fuente'));
    });

    it('debería excluir todos los atributos de trazabilidad, no solo uno', async () => {
      const cadena = cadenaBusqueda([]);
      lugarModel.find.mockReturnValue(cadena);

      await service.buscar({});

      const proyeccion = cadena.select.mock.calls[0][0] as string;
      for (const clave of ATRIBUTOS_INTERNOS) {
        expect(proyeccion).toContain(`-atributos.${clave}`);
      }
    });
  });

  describe('crear', () => {
    it('debería nacer pendiente de moderación, nunca publicado', async () => {
      await service.crear(
        { tipo: TipoLugar.PARQUE, nombre: 'Parque del Retiro', ciudad: 'Madrid' },
        USUARIO_ID,
      );

      expect(lugarModel.create).toHaveBeenCalledWith(
        expect.objectContaining({ estado: EstadoModeracion.PENDIENTE }),
      );
    });

    it('debería guardar la posición en formato GeoJSON (lng, lat)', async () => {
      await service.crear(
        { tipo: TipoLugar.PLAYA, nombre: 'Playa canina', ciudad: 'Cádiz', lat: 36.5, lng: -6.2 },
        USUARIO_ID,
      );

      const creado = lugarModel.create.mock.calls[0][0] as { ubicacion: { geo: { coordinates: number[] } } };
      expect(creado.ubicacion.geo.coordinates).toEqual([-6.2, 36.5]);
    });

    it('no debería inventar coordenadas si no las dan', async () => {
      await service.crear({ tipo: TipoLugar.RUTA, nombre: 'Ruta del agua', ciudad: 'Cuenca' }, USUARIO_ID);

      const creado = lugarModel.create.mock.calls[0][0] as { ubicacion: Record<string, unknown> };
      expect(creado.ubicacion['geo']).toBeUndefined();
    });
  });

  describe('proponerCambios', () => {
    it('debería devolver el lugar a moderación tras editarlo', async () => {
      const doc = {
        estado: EstadoModeracion.PUBLICADO,
        atributos: { vallado: true },
        save: jest.fn().mockImplementation(function (this: unknown) { return Promise.resolve(this); }),
      };
      lugarModel.findById.mockReturnValue({ exec: jest.fn().mockResolvedValue(doc) });

      await service.proponerCambios(LUGAR_ID, { descripcion: 'Ahora tiene fuente' });

      expect(doc.estado).toBe(EstadoModeracion.PENDIENTE);
    });

    it('debería fusionar los atributos en vez de reemplazarlos', async () => {
      const doc = {
        estado: EstadoModeracion.PUBLICADO,
        atributos: { vallado: true, sombra: false },
        save: jest.fn().mockImplementation(function (this: unknown) { return Promise.resolve(this); }),
      };
      lugarModel.findById.mockReturnValue({ exec: jest.fn().mockResolvedValue(doc) });

      await service.proponerCambios(LUGAR_ID, { atributos: { sombra: true } });

      expect(doc.atributos).toEqual({ vallado: true, sombra: true });
    });
  });

  describe('moderarLugar', () => {
    const conSave = (documento: Record<string, unknown>): Record<string, unknown> & { save: jest.Mock } => ({
      ...documento,
      save: jest.fn().mockResolvedValue(undefined),
    });

    /**
     * La dirección legible se reserva al publicar, no al crear: una ficha
     * pendiente puede acabar rechazada, y darle slug antes de saberlo dejaría
     * direcciones ocupadas por contenido que nunca llegó a verse.
     */
    it('debería asignar la dirección legible al publicar', async () => {
      const doc = conSave({
        _id: LUGAR_ID,
        estado: EstadoModeracion.PUBLICADO,
        nombre: 'Río Júcar',
        ubicacion: { ciudad: 'Riola' },
      });
      lugarModel.findByIdAndUpdate.mockReturnValue({ exec: jest.fn().mockResolvedValue(doc) });

      await service.moderarLugar(LUGAR_ID, { estado: EstadoModeracion.PUBLICADO });

      expect(doc['slug']).toBe('rio-jucar-riola');
      expect(doc.save).toHaveBeenCalled();
    });

    it('no debería dar dirección legible a una ficha rechazada', async () => {
      const doc = conSave({
        _id: LUGAR_ID,
        estado: EstadoModeracion.RECHAZADO,
        nombre: 'Río Júcar',
        ubicacion: { ciudad: 'Riola' },
      });
      lugarModel.findByIdAndUpdate.mockReturnValue({ exec: jest.fn().mockResolvedValue(doc) });

      await service.moderarLugar(LUGAR_ID, { estado: EstadoModeracion.RECHAZADO });

      expect(doc['slug']).toBeUndefined();
    });

    /**
     * Un slug que se mueve rompe todos los enlaces que ya circulan a cambio de
     * nada: lo que se ve en la página es el nombre, no la URL.
     */
    it('no debería cambiar la dirección de una ficha que ya la tiene', async () => {
      const doc = conSave({
        _id: LUGAR_ID,
        estado: EstadoModeracion.PUBLICADO,
        slug: 'nombre-viejo',
        nombre: 'Nombre nuevo',
        ubicacion: { ciudad: 'Riola' },
      });
      lugarModel.findByIdAndUpdate.mockReturnValue({ exec: jest.fn().mockResolvedValue(doc) });

      await service.moderarLugar(LUGAR_ID, { estado: EstadoModeracion.PUBLICADO });

      expect(doc['slug']).toBe('nombre-viejo');
      expect(doc.save).not.toHaveBeenCalled();
    });

    it('debería numerar la dirección si otra ficha ya la ocupa', async () => {
      const doc = conSave({
        _id: LUGAR_ID,
        estado: EstadoModeracion.PUBLICADO,
        nombre: 'Parque Central',
        ubicacion: { ciudad: 'Riola' },
      });
      lugarModel.findByIdAndUpdate.mockReturnValue({ exec: jest.fn().mockResolvedValue(doc) });
      lugarModel.exists.mockImplementation(async ({ slug }: { slug: string }) =>
        (slug === 'parque-central-riola' ? { _id: 'otro' } : null));

      await service.moderarLugar(LUGAR_ID, { estado: EstadoModeracion.PUBLICADO });

      expect(doc['slug']).toBe('parque-central-riola-2');
    });
  });

  describe('crearReview', () => {
    const lugarPublicado = { estado: EstadoModeracion.PUBLICADO };

    beforeEach(() => {
      lugarModel.findOne.mockReturnValue(cadenaFicha(lugarPublicado));
    });

    it('debería entrar en moderación, no publicarse sola', async () => {
      await service.crearReview(LUGAR_ID, USUARIO_ID, 'Marta', { puntuacion: 5 });

      expect(reviewModel.create).toHaveBeenCalledWith(
        expect.objectContaining({ estado: EstadoModeracion.PENDIENTE }),
      );
    });

    it('debería traducir el duplicado de índice a un 409 comprensible', async () => {
      reviewModel.create.mockRejectedValue({ code: 11000 });

      await expect(
        service.crearReview(LUGAR_ID, USUARIO_ID, 'Marta', { puntuacion: 4 }),
      ).rejects.toThrow(DomainException);
    });
  });

  describe('moderarReview', () => {
    it('debería recalcular la media solo con las valoraciones aprobadas', async () => {
      reviewModel.findByIdAndUpdate.mockReturnValue({
        exec: jest.fn().mockResolvedValue({ lugarId: { toString: () => LUGAR_ID } }),
      });
      reviewModel.find.mockReturnValue(cadenaBusqueda([{ puntuacion: 5 }, { puntuacion: 4 }]));

      await service.moderarReview(new Types.ObjectId().toString(), { estado: EstadoModeracion.PUBLICADO });

      expect(lugarModel.updateOne).toHaveBeenCalledWith(
        expect.anything(),
        { $set: { ratingPromedio: 4.5, totalReviews: 2 } },
      );
    });

    it('debería dejar la media a cero si no queda ninguna aprobada', async () => {
      reviewModel.findByIdAndUpdate.mockReturnValue({
        exec: jest.fn().mockResolvedValue({ lugarId: { toString: () => LUGAR_ID } }),
      });
      reviewModel.find.mockReturnValue(cadenaBusqueda([]));

      await service.moderarReview(new Types.ObjectId().toString(), { estado: EstadoModeracion.RECHAZADO });

      expect(lugarModel.updateOne).toHaveBeenCalledWith(
        expect.anything(),
        { $set: { ratingPromedio: 0, totalReviews: 0 } },
      );
    });

    it('las incidencias no deberían contar como valoración', async () => {
      reviewModel.findByIdAndUpdate.mockReturnValue({
        exec: jest.fn().mockResolvedValue({ lugarId: { toString: () => LUGAR_ID } }),
      });

      await service.moderarReview(new Types.ObjectId().toString(), { estado: EstadoModeracion.PUBLICADO });

      expect(reviewModel.find).toHaveBeenCalledWith(
        expect.objectContaining({ esIncidencia: false }),
      );
    });
  });
});
