import { Test } from '@nestjs/testing';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { BookingsService } from '../bookings/bookings.service';
import { AceptacionesController, CancelacionesController } from './cancelaciones.controller';
import { CancelacionesService } from './cancelaciones.service';

type Req = Parameters<CancelacionesController['vistaPrevia']>[1];

describe('CancelacionesController', () => {
  let cancelacionesCtrl: CancelacionesController;
  let aceptacionesCtrl: AceptacionesController;
  let cancelaciones: jest.Mocked<Pick<CancelacionesService, 'vistaPrevia' | 'cancelarPorCliente' | 'rechazarViaje'>>;
  let bookings: jest.Mocked<Pick<BookingsService, 'aceptarViaje'>>;

  const reqCliente = { user: { sub: 'user-1' } } as Req;
  const reqComercio = { user: { sub: 'staff-1', comercioId: 'comercio-1' } } as Req;

  beforeEach(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [CancelacionesController, AceptacionesController],
      providers: [
        {
          provide: CancelacionesService,
          useValue: {
            vistaPrevia: jest.fn().mockResolvedValue({ porcentaje: 100, importe: 55, motivo: 'Gratis' }),
            cancelarPorCliente: jest.fn().mockResolvedValue({}),
            rechazarViaje: jest.fn().mockResolvedValue({}),
          },
        },
        { provide: BookingsService, useValue: { aceptarViaje: jest.fn().mockResolvedValue({}) } },
      ],
    })
      .overrideGuard(JwtAuthGuard).useValue({ canActivate: () => true })
      .overrideGuard(RolesGuard).useValue({ canActivate: () => true })
      .compile();

    cancelacionesCtrl = moduleRef.get(CancelacionesController);
    aceptacionesCtrl = moduleRef.get(AceptacionesController);
    cancelaciones = moduleRef.get(CancelacionesService);
    bookings = moduleRef.get(BookingsService);
  });

  it('debería consultar la vista previa de cancelación del usuario del token', async () => {
    await expect(cancelacionesCtrl.vistaPrevia('r1', reqCliente)).resolves.toMatchObject({ importe: 55 });
    expect(cancelaciones.vistaPrevia).toHaveBeenCalledWith('r1', 'user-1');
  });

  it('debería cancelar como el usuario del token', async () => {
    await cancelacionesCtrl.cancelar('r1', reqCliente);
    expect(cancelaciones.cancelarPorCliente).toHaveBeenCalledWith('r1', 'user-1');
  });

  it('debería aceptar el viaje con la hora confirmada', async () => {
    await aceptacionesCtrl.resolver('r1', { decision: 'aceptar', horaConfirmada: '11:00' }, reqComercio);

    expect(bookings.aceptarViaje).toHaveBeenCalledWith('r1', 'comercio-1', '11:00');
    expect(cancelaciones.rechazarViaje).not.toHaveBeenCalled();
  });

  it('debería rechazar el viaje con el motivo', async () => {
    await aceptacionesCtrl.resolver('r1', { decision: 'rechazar', motivo: 'Sin conductor' }, reqComercio);

    expect(cancelaciones.rechazarViaje).toHaveBeenCalledWith('r1', 'comercio-1', 'Sin conductor');
    expect(bookings.aceptarViaje).not.toHaveBeenCalled();
  });

  it('debería usar un comercio vacío si el token no trae comercio', async () => {
    await aceptacionesCtrl.resolver('r1', { decision: 'aceptar' }, reqCliente);
    expect(bookings.aceptarViaje).toHaveBeenCalledWith('r1', '', undefined);
  });
});
