import { Test } from '@nestjs/testing';
import { BookingsController } from './bookings.controller';
import { BookingsService } from './bookings.service';
import { VerticalKey } from 'shared';

describe('BookingsController', () => {
  let controller: BookingsController;
  let service: jest.Mocked<BookingsService>;

  const req = { user: { sub: 'user-1' } } as never;

  beforeEach(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [BookingsController],
      providers: [
        {
          provide: BookingsService,
          useValue: {
            crear: jest.fn(),
            comprobarDisponibilidad: jest.fn(),
            calendarioDisponibilidad: jest.fn(),
            listarPorUsuario: jest.fn(),
            obtenerDeUsuario: jest.fn(),
            cancelar: jest.fn(),
          },
        },
      ],
    }).compile();

    controller = moduleRef.get(BookingsController);
    service = moduleRef.get(BookingsService);
  });

  it('debería crear la reserva con el usuario del token y fechas convertidas a Date', async () => {
    service.crear.mockResolvedValue({ id: 'r1' } as never);

    await controller.crear(
      {
        servicioId: 's1',
        comercioId: 'c1',
        vertical: VerticalKey.ALOJAMIENTO,
        fechaInicio: '2026-07-15',
        fechaFin: '2026-07-17',
        cantidad: 2,
      },
      req,
    );

    const arg = service.crear.mock.calls[0][0];
    expect(arg.usuarioId).toBe('user-1');
    expect(arg.servicioId).toBe('s1');
    expect(arg.fechaInicio).toBeInstanceOf(Date);
    expect(arg.fechaFin).toBeInstanceOf(Date);
    expect(arg.cantidad).toBe(2);
  });

  it('debería consultar disponibilidad con el usuario del token y fechas convertidas a Date', async () => {
    service.comprobarDisponibilidad.mockResolvedValue({ disponible: true, precioEstimado: 90 });

    const respuesta = await controller.comprobarDisponibilidad(
      {
        servicioId: 's1',
        vertical: VerticalKey.ALOJAMIENTO,
        fechaInicio: '2026-07-15',
        fechaFin: '2026-07-17',
        cantidad: 1,
      },
      req,
    );

    const arg = service.comprobarDisponibilidad.mock.calls[0][0];
    expect(arg.usuarioId).toBe('user-1');
    expect(arg.fechaInicio).toBeInstanceOf(Date);
    expect(arg.fechaFin).toBeInstanceOf(Date);
    expect(respuesta).toEqual({ disponible: true, precioEstimado: 90 });
  });

  it('debería pedir el calendario con las fechas del rango convertidas a Date', async () => {
    const dias = [{ fecha: '2026-09-01', disponible: true, plazasLibres: 2 }];
    service.calendarioDisponibilidad.mockResolvedValue({ soportado: true, dias });

    const respuesta = await controller.calendarioDisponibilidad(
      { servicioId: 's1', desde: '2026-09-01', hasta: '2026-09-30', espacioId: 'suite-1' },
      req,
    );

    const arg = service.calendarioDisponibilidad.mock.calls[0][0];
    expect(arg.usuarioId).toBe('user-1');
    expect(arg.desde).toBeInstanceOf(Date);
    expect(arg.hasta).toBeInstanceOf(Date);
    expect(arg.espacioId).toBe('suite-1');
    expect(respuesta).toEqual({ soportado: true, dias });
  });

  it('debería listar las reservas del usuario autenticado', async () => {
    service.listarPorUsuario.mockResolvedValue([] as never);
    await controller.misReservas(req);
    expect(service.listarPorUsuario).toHaveBeenCalledWith('user-1');
  });

  it('debería obtener una reserva propia validando el dueño', async () => {
    service.obtenerDeUsuario.mockResolvedValue({ id: 'r1' } as never);
    await controller.obtener('r1', req);
    expect(service.obtenerDeUsuario).toHaveBeenCalledWith('r1', 'user-1');
  });

  it('debería cancelar pasando el usuario del token', async () => {
    service.cancelar.mockResolvedValue({ id: 'r1' } as never);
    await controller.cancelar('r1', req);
    expect(service.cancelar).toHaveBeenCalledWith('r1', 'user-1');
  });
});
