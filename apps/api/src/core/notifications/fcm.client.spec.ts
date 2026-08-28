import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JWT } from 'google-auth-library';
import { FcmClient, MensajePush } from './fcm.client';

jest.mock('google-auth-library', () => ({
  JWT: jest.fn().mockImplementation(() => ({ request: jest.fn() })),
}));

const JwtMock = JWT as unknown as jest.Mock;

/** Credenciales completas; cada test cambia solo lo que le interesa. */
const CREDENCIALES: Record<string, string> = {
  FCM_PROJECT_ID: 'doogking-123',
  FCM_CLIENT_EMAIL: 'push@doogking.iam.gserviceaccount.com',
  FCM_PRIVATE_KEY: '-----BEGIN PRIVATE KEY-----\\nabc\\n-----END PRIVATE KEY-----\\n',
};

const MENSAJE: MensajePush = { titulo: 'Reserva confirmada', cuerpo: 'Tu plaza está lista', ruta: '/reservas/9' };

describe('FcmClient', () => {
  let request: jest.Mock;

  const crear = (valores: Record<string, string | undefined> = CREDENCIALES): FcmClient => {
    const config = { get: (clave: string) => valores[clave] } as unknown as ConfigService;
    return new FcmClient(config);
  };

  beforeEach(() => {
    jest.clearAllMocks();
    request = jest.fn();
    JwtMock.mockImplementation(() => ({ request }));
  });

  describe('configuración', () => {
    it('debería quedar configurado con las tres credenciales', () => {
      expect(crear().estaConfigurado).toBe(true);
    });

    it('debería deshacer los saltos de línea escapados de la clave privada', () => {
      crear();

      expect(JwtMock).toHaveBeenCalledWith(
        expect.objectContaining({ key: '-----BEGIN PRIVATE KEY-----\nabc\n-----END PRIVATE KEY-----' }),
      );
    });

    it.each([
      ['FCM_PROJECT_ID', 'falta el proyecto'],
      ['FCM_CLIENT_EMAIL', 'falta el email'],
      ['FCM_PRIVATE_KEY', 'falta la clave'],
    ])('no debería configurarse si %s no está (%s)', (ausente) => {
      const aviso = jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);

      const cliente = crear({ ...CREDENCIALES, [ausente]: undefined });

      expect(cliente.estaConfigurado).toBe(false);
      expect(JwtMock).not.toHaveBeenCalled();
      expect(aviso).toHaveBeenCalledWith(expect.stringContaining('FCM sin configurar'));
      aviso.mockRestore();
    });

    it('no debería configurarse con una clave que solo tiene espacios', () => {
      jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);

      expect(crear({ ...CREDENCIALES, FCM_PRIVATE_KEY: '   ' }).estaConfigurado).toBe(false);
    });
  });

  describe('enviar', () => {
    it('debería devolver "entregado" cuando FCM responde 200', async () => {
      request.mockResolvedValue({ status: 200 });

      await expect(crear().enviar('token-1', MENSAJE)).resolves.toBe('entregado');
    });

    it('debería mandar el mensaje a la API v1 del proyecto configurado', async () => {
      request.mockResolvedValue({ status: 200 });

      await crear().enviar('token-1', MENSAJE);

      expect(request).toHaveBeenCalledWith(
        expect.objectContaining({
          url: 'https://fcm.googleapis.com/v1/projects/doogking-123/messages:send',
          method: 'POST',
        }),
      );
    });

    it('debería llevar la ruta en data, que FCM exige en texto', async () => {
      request.mockResolvedValue({ status: 200 });

      await crear().enviar('token-1', MENSAJE);

      const { data } = request.mock.calls[0][0] as { data: { message: { data: { ruta: string } } } };
      expect(data.message.data).toEqual({ ruta: '/reservas/9' });
    });

    it('debería poner la raíz como ruta cuando el mensaje no trae ninguna', async () => {
      request.mockResolvedValue({ status: 200 });

      await crear().enviar('token-1', { titulo: 'Hola', cuerpo: 'Qué tal' });

      const { data } = request.mock.calls[0][0] as { data: { message: { data: { ruta: string } } } };
      expect(data.message.data).toEqual({ ruta: '/' });
    });

    it('debería devolver "error" ante un 2xx que no sea 200', async () => {
      request.mockResolvedValue({ status: 204 });

      await expect(crear().enviar('token-1', MENSAJE)).resolves.toBe('error');
    });

    it('debería devolver "error" sin llamar a FCM si no está configurado', async () => {
      jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);

      const cliente = crear({});

      await expect(cliente.enviar('token-1', MENSAJE)).resolves.toBe('error');
      expect(request).not.toHaveBeenCalled();
    });

    /*
     * La distinción importa: 'token_invalido' da de baja el dispositivo y
     * 'error' no. Confundirlos borraría dispositivos vivos ante un corte de red.
     */
    it.each([404, 400])('debería tratar el %i de FCM como token que ya no sirve', async (status) => {
      request.mockRejectedValue({ response: { status } });

      await expect(crear().enviar('token-1', MENSAJE)).resolves.toBe('token_invalido');
    });

    it('debería tratar un 5xx como fallo pasajero, sin dar de baja el token', async () => {
      const aviso = jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
      request.mockRejectedValue(Object.assign(new Error('backend error'), { response: { status: 503 } }));

      await expect(crear().enviar('token-1', MENSAJE)).resolves.toBe('error');

      expect(aviso).toHaveBeenCalledWith(expect.stringContaining('estado 503'));
      aviso.mockRestore();
    });

    it('debería registrar el estado como desconocido cuando el fallo no trae respuesta', async () => {
      const aviso = jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
      request.mockRejectedValue(new Error('socket colgado'));

      await expect(crear().enviar('token-1', MENSAJE)).resolves.toBe('error');

      expect(aviso).toHaveBeenCalledWith(expect.stringContaining('estado desconocido'));
      expect(aviso).toHaveBeenCalledWith(expect.stringContaining('socket colgado'));
      aviso.mockRestore();
    });

    it('debería aguantar un fallo que no es un Error', async () => {
      const aviso = jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
      request.mockRejectedValue('se cayó todo');

      await expect(crear().enviar('token-1', MENSAJE)).resolves.toBe('error');

      expect(aviso).toHaveBeenCalledWith(expect.stringContaining('se cayó todo'));
      aviso.mockRestore();
    });
  });
});
