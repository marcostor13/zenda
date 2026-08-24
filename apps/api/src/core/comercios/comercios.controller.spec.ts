import { Test } from '@nestjs/testing';
import { MotivoBajaComercio } from 'shared';
import { ComerciosController } from './comercios.controller';
import { ComerciosService } from './comercios.service';
import { ComercioCuentaService } from './comercio-cuenta.service';

describe('ComerciosController', () => {
  let controller: ComerciosController;
  let service: jest.Mocked<ComerciosService>;
  let cuenta: jest.Mocked<ComercioCuentaService>;

  beforeEach(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [ComerciosController],
      providers: [
        {
          provide: ComerciosService,
          useValue: {
            registrar: jest.fn().mockResolvedValue({}),
            registrarConCuenta: jest.fn().mockResolvedValue({}),
            vincularNuevoComercio: jest.fn().mockResolvedValue({}),
            listar: jest.fn().mockResolvedValue({}),
            obtener: jest.fn().mockResolvedValue({}),
            obtenerReservasComercio: jest.fn().mockResolvedValue({}),
            obtenerFinanzasComercio: jest.fn().mockResolvedValue({}),
            obtenerEquipo: jest.fn().mockResolvedValue({}),
            crearMiembroEquipo: jest.fn().mockResolvedValue({}),
            actualizarMiembroEquipo: jest.fn().mockResolvedValue({}),
            eliminarMiembroEquipo: jest.fn().mockResolvedValue({}),
            completarReserva: jest.fn().mockResolvedValue({}),
            marcarSeguimiento: jest.fn().mockResolvedValue({}),
            solicitarAjusteReserva: jest.fn().mockResolvedValue({}),
            obtenerServiciosComercio: jest.fn().mockResolvedValue({}),
            cambiarEstadoServicio: jest.fn().mockResolvedValue({}),
            actualizarDisponibilidadServicio: jest.fn().mockResolvedValue({}),
            obtenerResenasComercio: jest.fn().mockResolvedValue({}),
            responderResena: jest.fn().mockResolvedValue({}),
            actualizarComercio: jest.fn().mockResolvedValue({}),
            cambiarEstado: jest.fn().mockResolvedValue({}),
            fijarSocioFundador: jest.fn().mockResolvedValue({}),
            fijarAlphaAdherido: jest.fn().mockResolvedValue({}),
          },
        },
        {
          provide: ComercioCuentaService,
          useValue: {
            impacto: jest.fn().mockResolvedValue({}),
            pausar: jest.fn().mockResolvedValue({}),
            reactivar: jest.fn().mockResolvedValue({}),
            darDeBaja: jest.fn().mockResolvedValue({}),
          },
        },
      ],
    }).compile();

    controller = moduleRef.get(ComerciosController);
    service = moduleRef.get(ComerciosService);
    cuenta = moduleRef.get(ComercioCuentaService);
  });

  describe('cuenta del comercio', () => {
    const req = { user: { sub: 'u1', comercioId: 'c1' } } as never;

    it('debería pausar la cuenta con el motivo indicado', async () => {
      const dto = { motivo: MotivoBajaComercio.PAUSA_TEMPORADA } as never;
      await controller.pausarMiCuenta(req, dto);
      expect(cuenta.pausar).toHaveBeenCalledWith('c1', dto, 'u1', 'comercio');
    });

    it('debería reactivar la cuenta del comercio autenticado', async () => {
      await controller.reactivarMiCuenta(req);
      expect(cuenta.reactivar).toHaveBeenCalledWith('c1', 'u1');
    });

    it('debería rechazar la baja si el nombre escrito no coincide', async () => {
      service.obtener.mockResolvedValue({ nombreComercial: 'Peluquería Luna' } as never);

      await expect(
        controller.darDeBajaMiCuenta(req, {
          motivo: MotivoBajaComercio.CIERRE_NEGOCIO,
          confirmacion: 'otra cosa',
        } as never),
      ).rejects.toThrow('Escribe el nombre del negocio tal cual para confirmar la baja');
      expect(cuenta.darDeBaja).not.toHaveBeenCalled();
    });

    it('debería dar de baja cuando la confirmación coincide, ignorando mayúsculas', async () => {
      service.obtener.mockResolvedValue({ nombreComercial: 'Peluquería Luna' } as never);

      await controller.darDeBajaMiCuenta(req, {
        motivo: MotivoBajaComercio.CIERRE_NEGOCIO,
        confirmacion: '  peluquería luna ',
      } as never);

      expect(cuenta.darDeBaja).toHaveBeenCalledWith('c1', {
        motivo: MotivoBajaComercio.CIERRE_NEGOCIO,
        comentario: undefined,
        aceptaContacto: undefined,
        origen: 'comercio',
        actorId: 'u1',
      });
    });
  });

  it('debería delegar el registro en el service', async () => {
    const dto = { razonSocial: 'X', vatNumber: 'B-1', nombreComercial: 'X' };
    service.registrar.mockResolvedValue({ id: 'c1' } as never);
    await controller.registrar(dto);
    expect(service.registrar).toHaveBeenCalledWith(dto);
  });

  it('debería listar filtrando por estado', async () => {
    service.listar.mockResolvedValue([] as never);
    await controller.listar('pendiente');
    expect(service.listar).toHaveBeenCalledWith('pendiente');
  });

  it('debería obtener por id', async () => {
    service.obtener.mockResolvedValue({ id: 'c1' } as never);
    await controller.obtener('c1');
    expect(service.obtener).toHaveBeenCalledWith('c1');
  });

  it('debería cambiar el estado pasando el motivo y quién lo hace', async () => {
    service.cambiarEstado.mockResolvedValue({ id: 'c1' } as never);
    const req = { user: { sub: 'admin-1' } } as never;

    await controller.cambiarEstado('c1', { estado: 'suspendido', motivo: 'documentación caducada' }, req);

    // El motivo y el actor son lo que permite auditar la decisión (TCK-8034).
    expect(service.cambiarEstado).toHaveBeenCalledWith('c1', 'suspendido', 'documentación caducada', 'admin-1');
  });

  it('debería solicitar un ajuste de precio con el comercioId del token', async () => {
    const req = { user: { comercioId: 'comercio-1' } } as never;
    const dto = { suplementos: [{ concepto: 'Nudos severos', monto: 15 }] };
    service.solicitarAjusteReserva.mockResolvedValue({ id: 'r1' } as never);

    await controller.solicitarAjusteReserva(req, 'reserva-1', dto);

    expect(service.solicitarAjusteReserva).toHaveBeenCalledWith('reserva-1', 'comercio-1', dto);
  });
  /**
   * El comercio SIEMPRE sale del token, nunca de la URL ni del cuerpo. Es la
   * frontera del multi-tenant: si un solo endpoint lo tomara del cliente, ese
   * comercio veria las reservas y las finanzas de otro.
   */
  describe('aislamiento entre comercios', () => {
    const req = { user: { sub: 'user-1', comercioId: 'comercio-1' } } as never;

    it('deberia leer el propio comercio del token', async () => {
      await controller.miComercio(req);
      expect(service.obtener).toHaveBeenCalledWith('comercio-1');
    });

    it('deberia acotar reservas, finanzas, equipo, servicios y resenas al comercio del token', async () => {
      await controller.misReservas(req);
      await controller.misFinanzas(req);
      await controller.miEquipo(req);
      await controller.misServicios(req);
      await controller.misResenas(req);

      expect(service.obtenerReservasComercio).toHaveBeenCalledWith('comercio-1', 200);
      expect(service.obtenerFinanzasComercio).toHaveBeenCalledWith('comercio-1');
      expect(service.obtenerEquipo).toHaveBeenCalledWith('comercio-1');
      expect(service.obtenerServiciosComercio).toHaveBeenCalledWith('comercio-1');
      expect(service.obtenerResenasComercio).toHaveBeenCalledWith('comercio-1');
    });

    it('deberia exigir el comercio del token al operar sobre una reserva ajena', async () => {
      // El reservaId viaja en la URL: sin el comercio del token, cualquiera
      // podria completar o ajustar la reserva de otro negocio.
      await controller.completarReserva(req, 'reserva-1');
      await controller.marcarSeguimiento(req, 'reserva-1', { hito: 'recogido' } as never);

      expect(service.completarReserva).toHaveBeenCalledWith('reserva-1', 'comercio-1');
      expect(service.marcarSeguimiento).toHaveBeenCalledWith('reserva-1', 'comercio-1', 'recogido', undefined);
    });

    it('deberia exigir el comercio del token al tocar un listado', async () => {
      await controller.cambiarEstadoServicio(req, 'servicio-1', { estado: 'pausado' } as never);
      await controller.actualizarDisponibilidad(req, 'servicio-1', { plazas: 3 } as never);

      expect(service.cambiarEstadoServicio).toHaveBeenCalledWith('servicio-1', 'comercio-1', 'pausado');
      expect(service.actualizarDisponibilidadServicio).toHaveBeenCalledWith(
        'servicio-1', 'comercio-1', { plazas: 3 },
      );
    });

    it('deberia exigir el comercio del token al responder una resena', async () => {
      await controller.responderResena(req, 'resena-1', 'Gracias');

      expect(service.responderResena).toHaveBeenCalledWith('resena-1', 'comercio-1', 'Gracias');
    });

    it('deberia actualizar solo el propio comercio', async () => {
      await controller.actualizarMiComercio(req, { nombreComercial: 'Nuevo' } as never);

      expect(service.actualizarComercio).toHaveBeenCalledWith('comercio-1', { nombreComercial: 'Nuevo' });
    });
  });

  describe('equipo del comercio', () => {
    const req = { user: { sub: 'user-1', comercioId: 'comercio-1' } } as never;

    it('deberia crear el miembro dentro del comercio del token', async () => {
      const dto = { nombre: 'Ana', email: 'ana@test.com' } as never;

      await controller.crearMiembroEquipo(req, dto);

      expect(service.crearMiembroEquipo).toHaveBeenCalledWith('comercio-1', dto);
    });

    it('deberia pasar tambien quien edita, para no dejarse editar a si mismo el rol', async () => {
      const dto = { rol: 'comercio_staff' } as never;

      await controller.actualizarMiembroEquipo(req, 'miembro-9', dto);

      expect(service.actualizarMiembroEquipo).toHaveBeenCalledWith(
        'comercio-1', 'miembro-9', 'user-1', dto,
      );
    });

    it('deberia pasar quien elimina, para no dejarse borrar a si mismo', async () => {
      await controller.eliminarMiembroEquipo(req, 'miembro-9');

      expect(service.eliminarMiembroEquipo).toHaveBeenCalledWith('comercio-1', 'miembro-9', 'user-1');
    });
  });

  describe('alta de comercios', () => {
    it('deberia registrar cuenta y negocio en un solo paso', async () => {
      const dto = { email: 'x@test.com', password: 'secreta8', nombreComercial: 'X' } as never;

      await controller.registrarConCuenta(dto);

      expect(service.registrarConCuenta).toHaveBeenCalledWith(dto);
    });

    it('deberia vincular el negocio a la cuenta que hace el onboarding', async () => {
      const req = { user: { sub: 'user-1' } } as never;
      const dto = { nombreComercial: 'X', vatNumber: 'B1', razonSocial: 'X SL' } as never;

      await controller.onboarding(req, dto);

      expect(service.vincularNuevoComercio).toHaveBeenCalledWith('user-1', dto);
    });
  });

  describe('acciones de administracion', () => {
    const admin = { user: { sub: 'admin-1' } } as never;

    it('deberia registrar que admin cambia el estado y con que motivo', async () => {
      await controller.cambiarEstado('comercio-1', { estado: 'suspendido', motivo: 'fraude' } as never, admin);

      expect(service.cambiarEstado).toHaveBeenCalledWith('comercio-1', 'suspendido', 'fraude', 'admin-1');
    });

    it('deberia fijar socio fundador y adhesion a Alpha', async () => {
      await controller.fijarSocioFundador('comercio-1', { socioFundador: true } as never);
      await controller.fijarAlphaAdherido('comercio-1', { alphaAdherido: true } as never);

      expect(service.fijarSocioFundador).toHaveBeenCalledWith('comercio-1', { socioFundador: true });
      expect(service.fijarAlphaAdherido).toHaveBeenCalledWith('comercio-1', true);
    });

    it('deberia listar filtrando por estado cuando se indica', async () => {
      await controller.listar('activo' as never);

      expect(service.listar).toHaveBeenCalledWith('activo');
    });
  });
});
