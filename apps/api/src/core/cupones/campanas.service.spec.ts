import { Test } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { Types } from 'mongoose';
import { AsumeDescuento } from 'shared';
import { CampanasService } from './campanas.service';
import { Campana } from './campana.schema';
import { Cupon } from './cupon.schema';
import { DomainException } from '../../shared/exceptions/domain.exception';

describe('CampanasService', () => {
  let service: CampanasService;
  let campanaModel: { find: jest.Mock; create: jest.Mock; findByIdAndUpdate: jest.Mock };
  let cuponModel: { find: jest.Mock };

  const ADMIN_ID = new Types.ObjectId().toString();

  /** `find().sort().lean().exec()` y `find().sort().exec()` en la misma cadena. */
  function mockCampanas(docs: unknown[]) {
    const exec = jest.fn().mockResolvedValue(docs);
    const cadena = { lean: jest.fn().mockReturnValue({ exec }), exec };
    campanaModel.find.mockReturnValue({ sort: jest.fn().mockReturnValue(cadena) });
  }

  function mockCupones(docs: unknown[]) {
    cuponModel.find.mockReturnValue({
      select: jest.fn().mockReturnThis(),
      lean: jest.fn().mockReturnThis(),
      exec: jest.fn().mockResolvedValue(docs),
    });
  }

  beforeEach(async () => {
    campanaModel = { find: jest.fn(), create: jest.fn(), findByIdAndUpdate: jest.fn() };
    cuponModel = { find: jest.fn() };

    const moduleRef = await Test.createTestingModule({
      providers: [
        CampanasService,
        { provide: getModelToken(Campana.name), useValue: campanaModel },
        { provide: getModelToken(Cupon.name), useValue: cuponModel },
      ],
    }).compile();

    service = moduleRef.get(CampanasService);
  });

  describe('listar', () => {
    it('debería devolver las campañas de la más reciente a la más antigua', async () => {
      const sort = jest.fn().mockReturnValue({ exec: jest.fn().mockResolvedValue([{ nombre: 'X' }]) });
      campanaModel.find.mockReturnValue({ sort });

      await expect(service.listar()).resolves.toEqual([{ nombre: 'X' }]);
      expect(sort).toHaveBeenCalledWith({ createdAt: -1 });
    });
  });

  describe('crear', () => {
    const desde = new Date('2026-01-01');
    const hasta = new Date('2026-02-01');

    it('debería exigir la vigencia de la campaña', async () => {
      expect(() => service.crear({ nombre: 'Sin fechas' }, ADMIN_ID))
        .toThrow('Indica la vigencia de la campaña');
    });

    it('debería exigir que termine después de empezar', async () => {
      expect(() => service.crear({ nombre: 'X', desde: hasta, hasta: desde } as never, ADMIN_ID))
        .toThrow('debe terminar después de empezar');
    });

    it('debería rechazar una campaña que empieza y acaba a la vez', async () => {
      expect(() => service.crear({ nombre: 'X', desde, hasta: desde } as never, ADMIN_ID))
        .toThrow(DomainException);
    });

    it('debería guardar quién la creó', async () => {
      campanaModel.create.mockResolvedValue({ _id: 'c1' });

      await service.crear({ nombre: 'Navidad', desde, hasta } as never, ADMIN_ID);

      const datos = campanaModel.create.mock.calls[0][0];
      expect(String(datos.creadaPor)).toBe(ADMIN_ID);
    });

    it('no debería romperse si el identificador del admin no es válido', async () => {
      campanaModel.create.mockResolvedValue({ _id: 'c1' });

      await service.crear({ nombre: 'Navidad', desde, hasta } as never, 'no-es-un-id');

      expect(campanaModel.create.mock.calls[0][0].creadaPor).toBeUndefined();
    });
  });

  describe('actualizar', () => {
    it('debería rechazar un identificador malformado con 400, no reventar con 500', async () => {
      await expect(service.actualizar('no-es-un-id', { nombre: 'X' }))
        .rejects.toThrow('Identificador no válido');
    });

    it('debería lanzar 404 si la campaña no existe', async () => {
      campanaModel.findByIdAndUpdate.mockReturnValue({ exec: jest.fn().mockResolvedValue(null) });

      await expect(service.actualizar(new Types.ObjectId().toString(), { nombre: 'X' }))
        .rejects.toThrow('Campaña no encontrada');
    });

    it('debería devolver la campaña ya actualizada', async () => {
      campanaModel.findByIdAndUpdate.mockReturnValue({
        exec: jest.fn().mockResolvedValue({ nombre: 'Nuevo' }),
      });

      const res = await service.actualizar(new Types.ObjectId().toString(), { nombre: 'Nuevo' });

      expect(res).toEqual({ nombre: 'Nuevo' });
      // `new: true`: hay que devolver el documento posterior al cambio.
      expect(campanaModel.findByIdAndUpdate.mock.calls[0][2]).toEqual({ new: true });
    });
  });

  describe('metricas', () => {
    it('debería separar el coste según quién asume el descuento', async () => {
      // Mezclarlos daría un margen falso: lo que paga el comercio no sale del
      // bolsillo de la plataforma.
      mockCampanas([{ _id: 'c1', nombre: 'Navidad', activa: true, enviados: 100 }]);
      mockCupones([
        { tipo: 'fijo', valor: 10, usados: 3, asumeDescuento: AsumeDescuento.PLATAFORMA },
        { tipo: 'fijo', valor: 5, usados: 2, asumeDescuento: AsumeDescuento.COMERCIO },
      ]);

      const [metrica] = await service.metricas();

      expect(metrica.costePlataforma).toBe(30);
      expect(metrica.costeComercios).toBe(10);
    });

    it('debería asumir que el descuento lo paga la plataforma si no se declara', async () => {
      mockCampanas([{ _id: 'c1', nombre: 'X', enviados: 0 }]);
      mockCupones([{ tipo: 'fijo', valor: 8, usados: 1 }]);

      const [metrica] = await service.metricas();

      expect(metrica.costePlataforma).toBe(8);
      expect(metrica.costeComercios).toBe(0);
    });

    it('debería estimar el coste de un porcentaje sobre el importe mínimo', async () => {
      mockCampanas([{ _id: 'c1', nombre: 'X', enviados: 0 }]);
      mockCupones([{ tipo: 'porcentaje', valor: 0.2, usados: 2, montoMinimo: 50 }]);

      const [metrica] = await service.metricas();

      // 50 × 0,20 × 2 usos = 20; se queda corto antes que exagerar el gasto.
      expect(metrica.costePlataforma).toBe(20);
    });

    it('no debería contar coste de un cupón porcentual sin importe mínimo', async () => {
      mockCampanas([{ _id: 'c1', nombre: 'X', enviados: 0 }]);
      mockCupones([{ tipo: 'porcentaje', valor: 0.2, usados: 2 }]);

      expect((await service.metricas())[0].costePlataforma).toBe(0);
    });

    it('no debería contar coste de un cupón que nadie ha usado', async () => {
      mockCampanas([{ _id: 'c1', nombre: 'X', enviados: 0 }]);
      mockCupones([{ tipo: 'fijo', valor: 100, usados: 0 }]);

      const [metrica] = await service.metricas();

      expect(metrica.costePlataforma).toBe(0);
      expect(metrica.usos).toBe(0);
    });

    it('debería calcular la tasa de conversión con un decimal', async () => {
      mockCampanas([{ _id: 'c1', nombre: 'X', enviados: 300 }]);
      mockCupones([{ tipo: 'fijo', valor: 1, usados: 7 }]);

      // 7 de 300 = 2,333…% → 2,3 %
      expect((await service.metricas())[0].tasaConversion).toBe(2.3);
    });

    it('debería dejar la conversión a cero si no se envió nada, sin dividir por cero', async () => {
      mockCampanas([{ _id: 'c1', nombre: 'X', enviados: 0 }]);
      mockCupones([{ tipo: 'fijo', valor: 1, usados: 5 }]);

      expect((await service.metricas())[0].tasaConversion).toBe(0);
    });

    it('debería tratar como cero los envíos no declarados', async () => {
      mockCampanas([{ _id: 'c1', nombre: 'X' }]);
      mockCupones([]);

      const [metrica] = await service.metricas();

      expect(metrica.enviados).toBe(0);
      expect(metrica.cupones).toBe(0);
    });

    it('debería devolver lista vacía si no hay campañas', async () => {
      mockCampanas([]);

      expect(await service.metricas()).toEqual([]);
    });
  });
});
