import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { Types } from 'mongoose';
import { EstadoModeracion, TipoLugar } from 'shared';
import { LugaresService } from './lugares.service';
import { Lugar } from './lugar.schema';
import { LugarReview } from './lugar-review.schema';
import { DomainException } from '../../shared/exceptions/domain.exception';

const LUGAR_ID = new Types.ObjectId().toString();
const USUARIO_ID = new Types.ObjectId().toString();

describe('LugaresService', () => {
  let service: LugaresService;
  let lugarModel: {
    find: jest.Mock; findById: jest.Mock; findByIdAndUpdate: jest.Mock;
    create: jest.Mock; updateOne: jest.Mock;
  };
  let reviewModel: { find: jest.Mock; findByIdAndUpdate: jest.Mock; create: jest.Mock };

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
      findById: jest.fn().mockReturnValue({ exec: jest.fn().mockResolvedValue(null) }),
      findByIdAndUpdate: jest.fn().mockReturnValue({ exec: jest.fn().mockResolvedValue(null) }),
      create: jest.fn().mockImplementation((d) => Promise.resolve(d)),
      updateOne: jest.fn().mockReturnValue({ exec: jest.fn().mockResolvedValue({}) }),
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
      lugarModel.findById.mockReturnValue({
        exec: jest.fn().mockResolvedValue({ estado: EstadoModeracion.PENDIENTE }),
      });

      await expect(service.obtener(LUGAR_ID)).rejects.toThrow(DomainException);
    });

    it('debería rechazar un identificador malformado con 400', async () => {
      await expect(service.obtener('no-es-un-id')).rejects.toThrow(DomainException);
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

  describe('crearReview', () => {
    const lugarPublicado = { estado: EstadoModeracion.PUBLICADO };

    beforeEach(() => {
      lugarModel.findById.mockReturnValue({ exec: jest.fn().mockResolvedValue(lugarPublicado) });
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
