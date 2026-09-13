import { Test } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { MailerService, REMITENTE_POR_DEFECTO } from './mailer.service';

const construir = async (valores: Record<string, string | undefined>): Promise<MailerService> => {
  const moduleRef = await Test.createTestingModule({
    providers: [
      MailerService,
      { provide: ConfigService, useValue: { get: jest.fn((clave: string) => valores[clave]) } },
    ],
  }).compile();
  return moduleRef.get(MailerService);
};

/** Respuesta de Resend a un envío aceptado. */
const aceptado = (): void => {
  global.fetch = jest.fn().mockResolvedValue({
    ok: true, status: 200,
    json: jest.fn().mockResolvedValue({ id: 'e-1' }),
  }) as unknown as typeof fetch;
};

/** Rechazo con el cuerpo que devuelve Resend cuando algo no cuadra. */
const rechazado = (estado: number, cuerpo: unknown): void => {
  global.fetch = jest.fn().mockResolvedValue({
    ok: false, status: estado, statusText: 'Error',
    json: jest.fn().mockResolvedValue(cuerpo),
  }) as unknown as typeof fetch;
};

/** Lo que se mandó en la última llamada, ya interpretado. */
const cuerpoEnviado = (): Record<string, unknown> => {
  const [, opciones] = (global.fetch as jest.Mock).mock.calls[0] as [string, { body: string }];
  return JSON.parse(opciones.body) as Record<string, unknown>;
};

const CORREO = { to: 'cliente@x.com', subject: 'Hola', html: '<p>hi</p>' };

describe('MailerService', () => {
  afterEach(() => jest.restoreAllMocks());

  describe('sin configurar', () => {
    it('no debería tumbar el arranque, sino fallar al enviar con un motivo claro', async () => {
      global.fetch = jest.fn() as unknown as typeof fetch;
      const service = await construir({});

      expect(service.estaConfigurado).toBe(false);
      await expect(service.enviar(CORREO)).rejects.toThrow('RESEND_API_KEY');
      expect(global.fetch).not.toHaveBeenCalled();
    });
  });

  describe('envío', () => {
    it('debería mandarlo a Resend con la clave en la cabecera', async () => {
      aceptado();
      const service = await construir({ RESEND_API_KEY: 're_test' });

      await service.enviar(CORREO);

      const [url, opciones] = (global.fetch as jest.Mock).mock.calls[0] as [
        string, { method: string; headers: Record<string, string> },
      ];
      expect(url).toBe('https://api.resend.com/emails');
      expect(opciones.method).toBe('POST');
      expect(opciones.headers['Authorization']).toBe('Bearer re_test');
    });

    /** Es la dirección que el cliente ve como remitente de toda la plataforma. */
    it('debería salir de hola@doogking.com por defecto', async () => {
      aceptado();
      const service = await construir({ RESEND_API_KEY: 're_test' });

      await service.enviar(CORREO);

      expect(REMITENTE_POR_DEFECTO).toBe('hola@doogking.com');
      expect(cuerpoEnviado()['from']).toBe('Doogking <hola@doogking.com>');
    });

    it('debería llevar destinatario, asunto y cuerpo', async () => {
      aceptado();
      const service = await construir({ RESEND_API_KEY: 're_test' });

      await service.enviar(CORREO);

      expect(cuerpoEnviado()).toMatchObject({
        to: ['cliente@x.com'],
        subject: 'Hola',
        html: '<p>hi</p>',
      });
      expect(cuerpoEnviado()['attachments']).toBeUndefined();
    });

    it('debería mandar los adjuntos en base64, como los pide Resend', async () => {
      aceptado();
      const service = await construir({ RESEND_API_KEY: 're_test' });

      await service.enviar({ ...CORREO, adjuntos: [{ nombre: 'reserva.ics', contenido: 'BEGIN:VCALENDAR', tipo: 'text/calendar' }] });

      expect(cuerpoEnviado()['attachments']).toEqual([{
        filename: 'reserva.ics',
        content: Buffer.from('BEGIN:VCALENDAR').toString('base64'),
        content_type: 'text/calendar',
      }]);
    });

    /**
     * El nombre se cambia por envío; la dirección no. Mandar desde otra haría
     * que Resend rechazara el correo: sólo acepta el dominio verificado.
     */
    it('debería cambiar sólo el nombre del remitente, nunca la dirección', async () => {
      aceptado();
      const service = await construir({ RESEND_API_KEY: 're_test' });

      await service.enviar({ ...CORREO, nombreRemitente: 'Doogking | Equipo de verificación' });

      expect(cuerpoEnviado()['from'])
        .toBe('Doogking | Equipo de verificación <hola@doogking.com>');
    });

    it('debería permitir cambiar el buzón por configuración', async () => {
      aceptado();
      const service = await construir({
        RESEND_API_KEY: 're_test',
        EMAIL_FROM: 'reservas@doogking.com',
        EMAIL_FROM_NOMBRE: 'Reservas Doogking',
      });

      await service.enviar(CORREO);

      expect(cuerpoEnviado()['from']).toBe('Reservas Doogking <reservas@doogking.com>');
    });
  });

  describe('cuando Resend rechaza el envío', () => {
    /**
     * El motivo es lo único accionable que queda en el outbox: si el dominio no
     * está verificado, si la clave no vale o si se agotó la cuota. Antes sólo
     * quedaba un número de estado.
     */
    it('debería propagar el motivo que da Resend', async () => {
      rechazado(403, { message: 'The doogking.com domain is not verified' });
      const service = await construir({ RESEND_API_KEY: 're_test' });

      await expect(service.enviar(CORREO))
        .rejects.toThrow('The doogking.com domain is not verified');
    });

    it('debería incluir el código de estado', async () => {
      rechazado(422, { message: 'Invalid to field' });
      const service = await construir({ RESEND_API_KEY: 're_test' });

      await expect(service.enviar(CORREO)).rejects.toThrow('422');
    });

    it('debería aguantar un rechazo sin cuerpo interpretable', async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: false, status: 500, statusText: 'Internal Server Error',
        json: jest.fn().mockRejectedValue(new Error('no es json')),
      }) as unknown as typeof fetch;
      const service = await construir({ RESEND_API_KEY: 're_test' });

      await expect(service.enviar(CORREO)).rejects.toThrow('Internal Server Error');
    });

    /** Un corte de red tiene que llegar arriba: el outbox lo marca fallido. */
    it('debería propagar un fallo de red', async () => {
      global.fetch = jest.fn().mockRejectedValue(new Error('ECONNRESET')) as unknown as typeof fetch;
      const service = await construir({ RESEND_API_KEY: 're_test' });

      await expect(service.enviar(CORREO)).rejects.toThrow('ECONNRESET');
    });
  });
});
