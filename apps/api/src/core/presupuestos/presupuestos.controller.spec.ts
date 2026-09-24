import { Test } from '@nestjs/testing';
import { CrearSolicitudPresupuestoDto, VerticalKey } from 'shared';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { PresupuestosComercioController, PresupuestosController } from './presupuestos.controller';
import { PresupuestosService } from './presupuestos.service';

type Req = Parameters<PresupuestosController['mis']>[0];

describe('PresupuestosController', () => {
  let cliente: PresupuestosController;
  let comercio: PresupuestosComercioController;
  let service: jest.Mocked<PresupuestosService>;

  const reqCliente = { user: { sub: 'user-1' } } as Req;
  const reqComercio = { user: { sub: 'staff-1', comercioId: 'comercio-1' } } as Req;

  beforeEach(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [PresupuestosController, PresupuestosComercioController],
      providers: [
        {
          provide: PresupuestosService,
          useValue: {
            crear: jest.fn().mockResolvedValue({ id: 'p1' }),
            misSolicitudes: jest.fn().mockResolvedValue([]),
            deUsuario: jest.fn().mockResolvedValue({ id: 'p1' }),
            cancelar: jest.fn().mockResolvedValue({ id: 'p1' }),
            bandejaComercio: jest.fn().mockResolvedValue([]),
            responder: jest.fn().mockResolvedValue([]),
            rechazar: jest.fn().mockResolvedValue([]),
          },
        },
      ],
    })
      .overrideGuard(JwtAuthGuard).useValue({ canActivate: () => true })
      .overrideGuard(RolesGuard).useValue({ canActivate: () => true })
      .compile();

    cliente = moduleRef.get(PresupuestosController);
    comercio = moduleRef.get(PresupuestosComercioController);
    service = moduleRef.get(PresupuestosService);
  });

  describe('lado del cliente', () => {
    it('debería crear la solicitud a nombre del usuario del token', async () => {
      const dto = { vertical: VerticalKey.TRANSPORTE, servicioIds: ['s1'], detalle: {}, fechaServicio: '2030-03-01' } as CrearSolicitudPresupuestoDto;
      await cliente.crear(dto, reqCliente);
      expect(service.crear).toHaveBeenCalledWith('user-1', dto);
    });

    it('debería listar, obtener y cancelar sólo las del usuario', async () => {
      await cliente.mis(reqCliente);
      await cliente.obtener('p1', reqCliente);
      await cliente.cancelar('p1', reqCliente);

      expect(service.misSolicitudes).toHaveBeenCalledWith('user-1');
      expect(service.deUsuario).toHaveBeenCalledWith('p1', 'user-1');
      expect(service.cancelar).toHaveBeenCalledWith('p1', 'user-1');
    });
  });

  describe('lado del comercio', () => {
    it('debería usar el comercio del token para la bandeja, responder y rechazar', async () => {
      await comercio.bandeja(reqComercio);
      await comercio.responder('p1', 's1', { importe: 100 }, reqComercio);
      await comercio.rechazar('p1', 's1', { motivo: 'Sin hueco' }, reqComercio);

      expect(service.bandejaComercio).toHaveBeenCalledWith('comercio-1');
      expect(service.responder).toHaveBeenCalledWith('p1', 'comercio-1', 's1', { importe: 100 });
      expect(service.rechazar).toHaveBeenCalledWith('p1', 'comercio-1', 's1', 'Sin hueco');
    });

    it('debería usar un comercio vacío si el token no trae comercio', async () => {
      await comercio.bandeja(reqCliente);
      expect(service.bandejaComercio).toHaveBeenCalledWith('');
    });
  });
});
