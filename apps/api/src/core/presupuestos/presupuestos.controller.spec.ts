import { Test } from '@nestjs/testing';
import { EstadoPresupuesto, VerticalKey } from 'shared';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { PresupuestoDocument } from './presupuesto.schema';
import { PresupuestosController } from './presupuestos.controller';
import { PresupuestosService } from './presupuestos.service';

type RequestPrueba = Parameters<PresupuestosController['mis']>[0];

const peticion = (user: { sub: string; comercioId?: string }): RequestPrueba => ({ user }) as unknown as RequestPrueba;

const documento = (extra: Record<string, unknown> = {}): PresupuestoDocument => ({
  _id: 'pre-1',
  codigo: 'PRE-ABC12345',
  vertical: VerticalKey.TRANSPORTE,
  servicioId: 's1',
  comercioId: 'c1',
  estado: EstadoPresupuesto.OFERTADO,
  fechaServicio: new Date('2026-12-01T09:00:00Z'),
  solicitud: { origen: 'Castellón' },
  importe: 90,
  moneda: 'EUR',
  condiciones: 'Pago por adelantado',
  validoHasta: new Date('2026-11-20T09:00:00Z'),
  reservaId: 'res-1',
  createdAt: new Date('2026-11-18T09:00:00Z'),
  ...extra,
}) as unknown as PresupuestoDocument;

describe('PresupuestosController', () => {
  let controller: PresupuestosController;
  let service: jest.Mocked<Pick<PresupuestosService,
    'solicitar' | 'misPresupuestos' | 'delComercio' | 'titulosDeServicios' | 'ofertar' | 'aceptar' | 'rechazar'>>;

  beforeEach(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [PresupuestosController],
      providers: [
        {
          provide: PresupuestosService,
          useValue: {
            solicitar: jest.fn().mockResolvedValue(documento()),
            misPresupuestos: jest.fn().mockResolvedValue([documento()]),
            delComercio: jest.fn().mockResolvedValue([documento()]),
            titulosDeServicios: jest.fn().mockResolvedValue(new Map([['s1', 'Transportes Fido']])),
            ofertar: jest.fn().mockResolvedValue(documento()),
            aceptar: jest.fn().mockResolvedValue(documento()),
            rechazar: jest.fn().mockResolvedValue(documento()),
          },
        },
      ],
    })
      .overrideGuard(JwtAuthGuard).useValue({ canActivate: () => true })
      .overrideGuard(RolesGuard).useValue({ canActivate: () => true })
      .compile();

    controller = moduleRef.get(PresupuestosController);
    service = moduleRef.get(PresupuestosService);
  });

  it('debería pedir el presupuesto con el usuario del token y la fecha como Date', async () => {
    const respuesta = await controller.solicitar(peticion({ sub: 'u1' }), {
      servicioId: 's1', perroId: 'p1', fechaServicio: '2026-12-01T09:00:00Z', solicitud: { origen: 'Castellón' },
    });

    expect(service.solicitar).toHaveBeenCalledWith({
      usuarioId: 'u1', servicioId: 's1', perroId: 'p1',
      fechaServicio: new Date('2026-12-01T09:00:00Z'), solicitud: { origen: 'Castellón' },
    });
    expect(respuesta).toEqual({
      id: 'pre-1',
      codigo: 'PRE-ABC12345',
      vertical: VerticalKey.TRANSPORTE,
      servicioId: 's1',
      comercioId: 'c1',
      estado: EstadoPresupuesto.OFERTADO,
      fechaServicio: '2026-12-01T09:00:00.000Z',
      solicitud: { origen: 'Castellón' },
      importe: 90,
      moneda: 'EUR',
      condiciones: 'Pago por adelantado',
      validoHasta: '2026-11-20T09:00:00.000Z',
      reservaId: 'res-1',
      tituloServicio: undefined,
      createdAt: '2026-11-18T09:00:00.000Z',
    });
  });

  it('debería listar mis presupuestos con el título de cada servicio', async () => {
    const lista = await controller.mis(peticion({ sub: 'u1' }));

    expect(service.misPresupuestos).toHaveBeenCalledWith('u1');
    expect(lista[0].tituloServicio).toBe('Transportes Fido');
  });

  it('debería dejar sin validez ni reserva un presupuesto recién pedido', async () => {
    service.misPresupuestos.mockResolvedValue([documento({ validoHasta: undefined, reservaId: undefined, createdAt: undefined })]);

    const [dto] = await controller.mis(peticion({ sub: 'u1' }));

    expect(dto.validoHasta).toBeUndefined();
    expect(dto.reservaId).toBeUndefined();
    expect(typeof dto.createdAt).toBe('string');
  });

  describe('comercio', () => {
    it('debería listar las solicitudes de su negocio filtradas por estado', async () => {
      const lista = await controller.delComercio(peticion({ sub: 'u2', comercioId: 'c1' }), EstadoPresupuesto.SOLICITADO);

      expect(service.delComercio).toHaveBeenCalledWith('c1', EstadoPresupuesto.SOLICITADO);
      expect(lista[0].tituloServicio).toBe('Transportes Fido');
    });

    it('debería ofertar en nombre de su negocio', async () => {
      await controller.ofertar(peticion({ sub: 'u2', comercioId: 'c1' }), 'pre-1', { importe: 90 });
      expect(service.ofertar).toHaveBeenCalledWith('pre-1', 'c1', { importe: 90 });
    });

    it('debería responder 403 a una cuenta sin negocio', async () => {
      await expect(controller.delComercio(peticion({ sub: 'u2' }))).rejects.toMatchObject({ statusCode: 403 });
      await expect(controller.ofertar(peticion({ sub: 'u2' }), 'pre-1', { importe: 90 })).rejects.toMatchObject({ statusCode: 403 });
      expect(service.ofertar).not.toHaveBeenCalled();
    });
  });

  it('debería aceptar pasando lo que el cliente completa al aceptar', async () => {
    await controller.aceptar(peticion({ sub: 'u1' }), 'pre-1', { detalleExtra: { entrega: { quien: 'yo' } } });
    expect(service.aceptar).toHaveBeenCalledWith('pre-1', 'u1', { entrega: { quien: 'yo' } });
  });

  it('debería rechazar con el motivo del cliente', async () => {
    await controller.rechazar(peticion({ sub: 'u1' }), 'pre-1', { motivo: 'Caro' });
    expect(service.rechazar).toHaveBeenCalledWith('pre-1', 'u1', 'Caro');
  });
});
