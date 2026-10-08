import { Test } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { CuponesRepository } from './cupones.repository';
import { Cupon } from './cupon.schema';
import { Reserva } from '../bookings/reserva.schema';
import { ReservaEstado } from 'shared';

describe('CuponesRepository', () => {
  let repository: CuponesRepository;
  let model: jest.Mock & Record<string, jest.Mock>;
  let guardar: jest.Mock;
  let reservas: { countDocuments: jest.Mock };

  const conExec = (resultado: unknown) => ({ exec: jest.fn().mockResolvedValue(resultado) });

  beforeEach(async () => {
    guardar = jest.fn().mockResolvedValue({ codigo: 'VERANO' });
    model = jest.fn().mockImplementation((datos: unknown) => ({ ...(datos as object), save: guardar })) as never;
    model.findOne = jest.fn().mockReturnValue(conExec(null));
    model.updateOne = jest.fn().mockReturnValue(conExec({}));
    model.findByIdAndUpdate = jest.fn().mockReturnValue(conExec(null));
    model.findByIdAndDelete = jest.fn().mockReturnValue(conExec(null));
    model.find = jest.fn().mockReturnValue({
      sort: jest.fn().mockReturnThis(),
      lean: jest.fn().mockReturnThis(),
      exec: jest.fn().mockResolvedValue([]),
    });

    reservas = { countDocuments: jest.fn().mockReturnValue(conExec(2)) };

    const moduleRef = await Test.createTestingModule({
      providers: [
        CuponesRepository,
        { provide: getModelToken(Cupon.name), useValue: model },
        { provide: getModelToken(Reserva.name), useValue: reservas },
      ],
    }).compile();

    repository = moduleRef.get(CuponesRepository);
  });

  describe('lo que ya ha reservado el cliente', () => {
    const USUARIO = '64b000000000000000000001';

    it('debería contar sólo las reservas pagadas', async () => {
      // Una reserva sin pagar o cancelada no gasta la «primera reserva».
      await expect(repository.contarReservasPagadas(USUARIO)).resolves.toBe(2);

      const filtro = reservas.countDocuments.mock.calls[0][0];
      expect(filtro.usuarioId.toString()).toBe(USUARIO);
      expect(filtro.estado).toEqual({ $nin: [ReservaEstado.PENDIENTE, ReservaEstado.CANCELADA] });
      expect(filtro).not.toHaveProperty('cuponCodigo');
    });

    it('debería contar los usos de un cupón por su código en mayúsculas', async () => {
      await repository.contarUsosDe(' verano ', USUARIO);

      const filtro = reservas.countDocuments.mock.calls[0][0];
      expect(filtro.cuponCodigo).toBe('VERANO');
      expect(filtro.estado).toEqual({ $nin: [ReservaEstado.PENDIENTE, ReservaEstado.CANCELADA] });
    });
  });

  describe('normalización del código', () => {
    it('debería buscar en mayúsculas y sin espacios sobrantes', () => {
      // El usuario teclea "  verano24 " y espera que funcione igual.
      void repository.findByCodigo('  verano24 ');

      expect(model.findOne).toHaveBeenCalledWith({ codigo: 'VERANO24' });
    });

    it('debería normalizar también al contabilizar el uso', () => {
      void repository.incrementarUso(' verano24 ');

      expect(model.updateOne).toHaveBeenCalledWith(
        { codigo: 'VERANO24' },
        { $inc: { usados: 1 } },
      );
    });
  });

  it('debería crear el cupón con los datos indicados', async () => {
    await repository.crear({ codigo: 'VERANO', valor: 0.1 } as never);

    expect(model).toHaveBeenCalledWith({ codigo: 'VERANO', valor: 0.1 });
    expect(guardar).toHaveBeenCalled();
  });

  it('debería devolver el documento actualizado, no el anterior', async () => {
    await repository.actualizar('c1', { activo: false } as never);

    expect(model.findByIdAndUpdate).toHaveBeenCalledWith('c1', { activo: false }, { new: true });
  });

  it('debería eliminar por id', async () => {
    await repository.eliminar('c1');

    expect(model.findByIdAndDelete).toHaveBeenCalledWith('c1');
  });

  it('debería listar los cupones del más reciente al más antiguo', async () => {
    const cadena = model.find();
    await repository.listar();

    expect(cadena.sort).toHaveBeenCalledWith({ createdAt: -1 });
  });
});
