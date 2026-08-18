import { Test } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import type { Response } from 'express';
import { AgendaController } from './agenda.controller';
import { AgendaService } from './agenda.service';
import { OauthStateService } from './oauth-state.service';

describe('AgendaController', () => {
  let controller: AgendaController;
  let service: jest.Mocked<AgendaService>;
  let config: { get: jest.Mock };
  let conector: { urlAutorizacion: jest.Mock; canjearCodigo: jest.Mock };

  const COMERCIO_ID = 'comercio-1';
  const req = { user: { sub: 'u1', comercioId: COMERCIO_ID } } as never;

  /** `Response` de Express con lo justo que usa el callback de OAuth. */
  function respuestaFalsa(): Response & { redirect: jest.Mock } {
    return { redirect: jest.fn() } as never;
  }

  /**
   * El `state` va firmado, así que el test usa el servicio real en vez de
   * componerlo a mano: si dejara de estar firmado, estas pruebas fallarían.
   */
  let oauthState: OauthStateService;

  beforeEach(async () => {
    conector = {
      urlAutorizacion: jest.fn().mockReturnValue('https://proveedor/oauth?state=x'),
      canjearCodigo: jest.fn().mockResolvedValue({ accessToken: 'at', refreshToken: 'rt' }),
    };
    config = { get: jest.fn().mockReturnValue('https://doogking.com') };

    const moduleRef = await Test.createTestingModule({
      controllers: [AgendaController],
      providers: [
        {
          provide: AgendaService,
          useValue: {
            listarAgendas: jest.fn().mockResolvedValue([]),
            crearAgenda: jest.fn().mockResolvedValue({ _id: 'a1' }),
            actualizarAgenda: jest.fn().mockResolvedValue({ _id: 'a1' }),
            huecosDe: jest.fn().mockResolvedValue([]),
            listarRecursos: jest.fn().mockResolvedValue([]),
            crearRecurso: jest.fn().mockResolvedValue({ _id: 'r1' }),
            bloquear: jest.fn().mockResolvedValue({ _id: 'b1' }),
            desbloquear: jest.fn().mockResolvedValue(undefined),
            sincronizar: jest.fn().mockResolvedValue({ importados: 2, eliminados: 1 }),
            conectarCalendario: jest.fn().mockResolvedValue(undefined),
            desconectarCalendario: jest.fn().mockResolvedValue(undefined),
            conector: jest.fn().mockReturnValue(conector),
          },
        },
        { provide: ConfigService, useValue: config },
        {
          provide: OauthStateService,
          useValue: new OauthStateService(new JwtService({ secret: 'secreto-de-pruebas' })),
        },
      ],
    }).compile();

    controller = moduleRef.get(AgendaController);
    oauthState = moduleRef.get(OauthStateService);
    service = moduleRef.get(AgendaService);
  });

  describe('agendas', () => {
    it('debería listar solo las agendas del comercio del token', async () => {
      await controller.listar(req);

      expect(service.listarAgendas).toHaveBeenCalledWith(COMERCIO_ID);
    });

    it('debería crear la agenda a nombre del comercio del token', async () => {
      const dto = { nombre: 'Sala 1' } as never;

      await controller.crear(dto, req);

      expect(service.crearAgenda).toHaveBeenCalledWith(COMERCIO_ID, dto);
    });

    it('debería actualizar exigiendo también el comercio, no solo el id', async () => {
      // Sin el comercio, un comercio podría editar la agenda de otro.
      const dto = { nombre: 'Sala 2' } as never;

      await controller.actualizar('a1', dto, req);

      expect(service.actualizarAgenda).toHaveBeenCalledWith('a1', COMERCIO_ID, dto);
    });
  });

  describe('huecos', () => {
    it('debería convertir el día a fecha y usar la duración pedida', async () => {
      await controller.huecos('a1', '2026-09-01', '45');

      const [id, dia, duracion] = service.huecosDe.mock.calls[0];
      expect(id).toBe('a1');
      expect(dia).toBeInstanceOf(Date);
      expect(dia.toISOString().slice(0, 10)).toBe('2026-09-01');
      expect(duracion).toBe(45);
    });

    it('debería usar 30 minutos cuando no se indica duración', async () => {
      await controller.huecos('a1', '2026-09-01');

      expect(service.huecosDe.mock.calls[0][2]).toBe(30);
    });

    it('debería caer a 30 minutos si la duración no es un número', async () => {
      await controller.huecos('a1', '2026-09-01', 'no-es-un-numero');

      expect(service.huecosDe.mock.calls[0][2]).toBe(30);
    });
  });

  describe('recursos y bloqueos', () => {
    it('debería listar los recursos del comercio', async () => {
      await controller.recursos(req);

      expect(service.listarRecursos).toHaveBeenCalledWith(COMERCIO_ID);
    });

    it('debería crear el recurso a nombre del comercio', async () => {
      const dto = { nombre: 'Furgoneta' } as never;

      await controller.crearRecurso(dto, req);

      expect(service.crearRecurso).toHaveBeenCalledWith(COMERCIO_ID, dto);
    });

    it('debería convertir a fecha el inicio y el fin del bloqueo', async () => {
      await controller.bloquear(
        'a1',
        { inicio: '2026-09-01T09:00:00Z', fin: '2026-09-01T11:00:00Z', motivo: 'Mantenimiento' } as never,
        req,
      );

      const [id, comercioId, inicio, fin, motivo] = service.bloquear.mock.calls[0];
      expect(id).toBe('a1');
      expect(comercioId).toBe(COMERCIO_ID);
      expect(inicio).toBeInstanceOf(Date);
      expect(fin).toBeInstanceOf(Date);
      expect(motivo).toBe('Mantenimiento');
    });

    it('debería admitir un bloqueo sin motivo', async () => {
      await controller.bloquear(
        'a1', { inicio: '2026-09-01T09:00:00Z', fin: '2026-09-01T11:00:00Z' } as never, req,
      );

      expect(service.bloquear.mock.calls[0][4]).toBeUndefined();
    });

    it('debería exigir el comercio al quitar un bloqueo', async () => {
      await controller.desbloquear('b1', req);

      expect(service.desbloquear).toHaveBeenCalledWith('b1', COMERCIO_ID);
    });
  });

  describe('conexión con calendario externo', () => {
    it('debería llevar agenda y comercio dentro del state de la autorización', async () => {
      // El `state` es lo único que vuelve del proveedor: sin él no se sabría a
      // qué agenda pertenece la conexión.
      const { url } = controller.urlConexion('a1', 'google' as never, req);

      expect(url).toBe('https://proveedor/oauth?state=x');
      const estado = conector.urlAutorizacion.mock.calls[0][0] as string;
      expect(oauthState.verificar(estado)).toEqual({ agendaId: 'a1', comercioId: COMERCIO_ID });
    });

    it('debería rechazar un state fabricado por un tercero', async () => {
      // El callback no puede exigir sesión, así que la firma del `state` es lo
      // único que impide enganchar un calendario ajeno a la agenda de otro.
      const res = respuestaFalsa();
      const falsificado = Buffer
        .from(JSON.stringify({ agendaId: 'agenda-ajena', comercioId: 'comercio-ajeno' }))
        .toString('base64url');

      await controller.callback('google' as never, 'codigo-del-atacante', falsificado, res);

      expect(service.conectarCalendario).not.toHaveBeenCalled();
      expect(res.redirect).toHaveBeenCalledWith('https://doogking.com/comercio/agenda?error=conexion');
    });

    it('debería conectar y volver al panel indicando el proveedor', async () => {
      const res = respuestaFalsa();
      const estado = oauthState.firmar({ agendaId: 'a1', comercioId: COMERCIO_ID });

      await controller.callback('google' as never, 'codigo-oauth', estado, res);

      expect(conector.canjearCodigo).toHaveBeenCalledWith('codigo-oauth');
      expect(service.conectarCalendario).toHaveBeenCalledWith(
        'a1', COMERCIO_ID, 'google', { accessToken: 'at', refreshToken: 'rt' },
      );
      expect(res.redirect).toHaveBeenCalledWith('https://doogking.com/comercio/agenda?conectado=google');
    });

    it('debería volver con error, no reventar, si el state viene corrupto', async () => {
      // Lo invoca el proveedor, no el frontend: un fallo aquí no puede acabar en
      // una pantalla de error del navegador.
      const res = respuestaFalsa();

      await controller.callback('google' as never, 'codigo', 'no-es-base64-valido', res);

      expect(res.redirect).toHaveBeenCalledWith('https://doogking.com/comercio/agenda?error=conexion');
      expect(service.conectarCalendario).not.toHaveBeenCalled();
    });

    it('debería volver con error si el proveedor rechaza el código', async () => {
      const res = respuestaFalsa();
      conector.canjearCodigo.mockRejectedValue(new Error('código caducado'));
      const estado = oauthState.firmar({ agendaId: 'a1', comercioId: COMERCIO_ID });

      await controller.callback('google' as never, 'codigo', estado, res);

      expect(res.redirect).toHaveBeenCalledWith('https://doogking.com/comercio/agenda?error=conexion');
    });

    it('debería redirigir a una ruta relativa si no hay APP_URL configurada', async () => {
      config.get.mockReturnValue(undefined);
      const res = respuestaFalsa();

      await controller.callback('google' as never, 'codigo', 'corrupto', res);

      expect(res.redirect).toHaveBeenCalledWith('/comercio/agenda?error=conexion');
    });

    it('debería sincronizar los eventos del calendario externo', async () => {
      await expect(controller.sincronizar('a1')).resolves.toEqual({ importados: 2, eliminados: 1 });
    });

    it('debería exigir el comercio al desconectar el calendario', async () => {
      await controller.desconectar('a1', req);

      expect(service.desconectarCalendario).toHaveBeenCalledWith('a1', COMERCIO_ID);
    });
  });
});
