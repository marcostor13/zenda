import { Test } from '@nestjs/testing';
import { CarritoController } from './carrito.controller';
import { CarritoService } from './carrito.service';
import { PaymentsService } from '../payments/payments.service';

describe('CarritoController', () => {
  let controller: CarritoController;
  let carritoService: jest.Mocked<
    Pick<CarritoService, 'obtenerAbierto' | 'anadirItem' | 'quitarItem' | 'validar' | 'checkout'>
  >;
  let paymentsService: jest.Mocked<Pick<PaymentsService, 'crearIntentDeViaje'>>;

  const req = { user: { sub: 'user-1' } } as never;

  beforeEach(async () => {
    carritoService = {
      obtenerAbierto: jest.fn().mockResolvedValue({ _id: 'carrito-1' }),
      anadirItem: jest.fn().mockResolvedValue({ _id: 'carrito-1' }),
      quitarItem: jest.fn().mockResolvedValue({ _id: 'carrito-1' }),
      validar: jest.fn().mockResolvedValue({ valido: true, items: [] }),
      checkout: jest.fn().mockResolvedValue({
        reservas: [{ _id: 'reserva-1' }, { _id: 'reserva-2' }],
      }),
    };
    paymentsService = {
      crearIntentDeViaje: jest.fn().mockResolvedValue({ clientSecret: 'cs', pagoId: 'p1' }),
    };

    const moduleRef = await Test.createTestingModule({
      controllers: [CarritoController],
      providers: [
        { provide: CarritoService, useValue: carritoService },
        { provide: PaymentsService, useValue: paymentsService },
      ],
    }).compile();

    controller = moduleRef.get(CarritoController);
  });

  it('debería devolver el viaje abierto del usuario del token', async () => {
    await controller.obtener(req);

    expect(carritoService.obtenerAbierto).toHaveBeenCalledWith('user-1');
  });

  it('debería añadir el item al carrito del usuario del token', async () => {
    const dto = { servicioId: 's1', vertical: 'alojamiento', fechaInicio: '2026-09-01' } as never;

    await controller.anadir(dto, req);

    expect(carritoService.anadirItem).toHaveBeenCalledWith('user-1', dto);
  });

  it('debería exigir el usuario al quitar un item, no sólo el id del item', async () => {
    // Sin el usuario, cualquiera podría vaciar el carrito de otro conociendo el
    // itemId, que viaja en la URL.
    await controller.quitar('item-1', req);

    expect(carritoService.quitarItem).toHaveBeenCalledWith('user-1', 'item-1');
  });

  it('debería revalidar todo el viaje antes de pagar', async () => {
    await controller.validar(req);

    expect(carritoService.validar).toHaveBeenCalledWith('user-1');
  });

  describe('checkout', () => {
    it('debería cobrar de una vez todas las reservas creadas', async () => {
      await controller.checkout(req);

      expect(carritoService.checkout).toHaveBeenCalledWith('user-1');
      expect(paymentsService.crearIntentDeViaje).toHaveBeenCalledWith(
        ['reserva-1', 'reserva-2'],
        'user-1',
      );
    });

    it('no debería crear el cobro si el checkout falla', async () => {
      carritoService.checkout.mockRejectedValue(new Error('sin disponibilidad'));

      await expect(controller.checkout(req)).rejects.toThrow();
      expect(paymentsService.crearIntentDeViaje).not.toHaveBeenCalled();
    });
  });
});
