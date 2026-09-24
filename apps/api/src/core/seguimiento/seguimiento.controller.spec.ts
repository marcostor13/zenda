import { Test } from '@nestjs/testing';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { SeguimientoClienteController, SeguimientoComercioController } from './seguimiento.controller';
import { SeguimientoService } from './seguimiento.service';

type Req = Parameters<SeguimientoClienteController['ubicacion']>[1];

describe('SeguimientoController', () => {
  let cliente: SeguimientoClienteController;
  let comercio: SeguimientoComercioController;
  let service: jest.Mocked<Pick<SeguimientoService, 'ubicacion' | 'contacto' | 'registrarPosicion'>>;

  const reqCliente = { user: { sub: 'user-1' } } as Req;
  const reqComercio = { user: { sub: 'staff-1', comercioId: 'comercio-1' } } as Req;

  beforeEach(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [SeguimientoClienteController, SeguimientoComercioController],
      providers: [
        {
          provide: SeguimientoService,
          useValue: {
            ubicacion: jest.fn().mockResolvedValue({ compartiendo: false, rastro: [] }),
            contacto: jest.fn().mockResolvedValue({ nombre: 'Fido' }),
            registrarPosicion: jest.fn().mockResolvedValue({ ok: true }),
          },
        },
      ],
    })
      .overrideGuard(JwtAuthGuard).useValue({ canActivate: () => true })
      .overrideGuard(RolesGuard).useValue({ canActivate: () => true })
      .compile();

    cliente = moduleRef.get(SeguimientoClienteController);
    comercio = moduleRef.get(SeguimientoComercioController);
    service = moduleRef.get(SeguimientoService);
  });

  it('debería consultar la ubicación y el contacto como el usuario del token', async () => {
    await cliente.ubicacion('r1', reqCliente);
    await cliente.contacto('r1', reqCliente);

    expect(service.ubicacion).toHaveBeenCalledWith('r1', 'user-1');
    expect(service.contacto).toHaveBeenCalledWith('r1', 'user-1');
  });

  it('debería registrar la posición con el comercio del token', async () => {
    const dto = { lat: 1, lng: 2 };
    await expect(comercio.posicion('r1', dto, reqComercio)).resolves.toEqual({ ok: true });
    expect(service.registrarPosicion).toHaveBeenCalledWith('r1', 'comercio-1', dto);
  });

  it('debería usar un comercio vacío si el token no trae comercio', async () => {
    await comercio.posicion('r1', { lat: 1, lng: 2 }, reqCliente);
    expect(service.registrarPosicion).toHaveBeenCalledWith('r1', '', { lat: 1, lng: 2 });
  });
});
