import { Test } from '@nestjs/testing';
import { SegurosController } from './seguros.controller';
import { SegurosService } from './seguros.service';

describe('SegurosController', () => {
  let controller: SegurosController;
  let service: jest.Mocked<SegurosService>;

  const req = { user: { sub: 'u1', comercioId: 'aseguradora-1' } } as never;

  beforeEach(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [SegurosController],
      providers: [
        {
          provide: SegurosService,
          useValue: {
            recomendarPara: jest.fn().mockResolvedValue([]),
            listarDeUsuario: jest.fn().mockResolvedValue([]),
            contratar: jest.fn().mockResolvedValue({ _id: 'p1' }),
            validar: jest.fn().mockResolvedValue({ _id: 'p1' }),
          },
        },
      ],
    }).compile();

    controller = moduleRef.get(SegurosController);
    service = moduleRef.get(SegurosService);
  });

  it('debería recomendar pólizas para el perro del usuario autenticado', async () => {
    await controller.recomendaciones('perro-1', req);

    expect(service.recomendarPara).toHaveBeenCalledWith('perro-1', 'u1');
  });

  it('debería listar solo las pólizas del usuario del token', async () => {
    await controller.misPolizas(req);

    expect(service.listarDeUsuario).toHaveBeenCalledWith('u1');
  });

  it('debería contratar a nombre del usuario del token, no del cuerpo', async () => {
    // El usuario sale del token: aceptarlo del body permitiría contratar a nombre de otro.
    const dto = {
      servicioId: 's1', perroId: 'perro-1', declaracionVeracidadAceptada: true,
    } as never;

    await controller.contratar(dto, req);

    expect(service.contratar).toHaveBeenCalledWith(
      expect.objectContaining({ servicioId: 's1', perroId: 'perro-1', usuarioId: 'u1' }),
    );
  });

  it('debería propagar la reserva asociada cuando el seguro se contrata desde una', async () => {
    const dto = {
      servicioId: 's1', perroId: 'perro-1', reservaId: 'r1', declaracionVeracidadAceptada: true,
    } as never;

    await controller.contratar(dto, req);

    expect(service.contratar).toHaveBeenCalledWith(
      expect.objectContaining({ reservaId: 'r1' }),
    );
  });

  it('debería validar la póliza con el comercio del token', async () => {
    await controller.validar('p1', { aceptada: true } as never, req);

    expect(service.validar).toHaveBeenCalledWith('p1', 'aseguradora-1', true, undefined);
  });

  it('debería propagar el motivo al rechazar la cobertura', async () => {
    await controller.validar('p1', { aceptada: false, motivoRechazo: 'Datos incompletos' } as never, req);

    expect(service.validar).toHaveBeenCalledWith('p1', 'aseguradora-1', false, 'Datos incompletos');
  });
});
