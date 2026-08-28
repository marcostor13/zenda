import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SocialAuthService } from './social-auth.service';
import { DomainException } from '../../shared/exceptions/domain.exception';

describe('SocialAuthService', () => {
  let service: SocialAuthService;
  let config: jest.Mocked<ConfigService>;
  const fetchMock = jest.fn();

  beforeEach(() => {
    global.fetch = fetchMock as unknown as typeof fetch;
    config = { get: jest.fn() } as unknown as jest.Mocked<ConfigService>;
    service = new SocialAuthService(config);
    fetchMock.mockReset();
  });

  const respuestaOk = (body: unknown): Response =>
    ({ ok: true, json: () => Promise.resolve(body) }) as Response;

  /*
   * El navegador dibuja el botón con lo que devuelve esto y el API valida el
   * `aud` contra lo mismo: mientras salgan de aquí no pueden divergir.
   */
  describe('configPublica', () => {
    it('debería servir los identificadores públicos de los dos proveedores', () => {
      config.get.mockImplementation((clave: string) =>
        clave === 'GOOGLE_CLIENT_ID' ? 'client-web' : clave === 'FACEBOOK_APP_ID' ? 'app-1' : undefined);

      expect(service.configPublica()).toEqual({ googleClientId: 'client-web', facebookAppId: 'app-1' });
    });

    /* La app móvil usa su propio cliente; el de la web es el primero. */
    it('debería servir el primero de la lista, que es el de la web', () => {
      config.get.mockReturnValue('client-web, client-android');

      expect(service.configPublica().googleClientId).toBe('client-web');
    });

    it('debería devolver vacío lo que no esté configurado', () => {
      config.get.mockReturnValue(undefined);

      expect(service.configPublica()).toEqual({ googleClientId: '', facebookAppId: '' });
    });

    it('debería recortar los espacios del identificador de Meta', () => {
      config.get.mockImplementation((clave: string) => (clave === 'FACEBOOK_APP_ID' ? '  app-1  ' : undefined));

      expect(service.configPublica().facebookAppId).toBe('app-1');
    });
  });

  describe('verificarGoogle', () => {
    it('debería devolver el perfil cuando la audiencia y el email coinciden', async () => {
      config.get.mockReturnValue('client-123');
      fetchMock.mockResolvedValue(
        respuestaOk({ aud: 'client-123', email: 'ana@gmail.com', email_verified: 'true', name: 'Ana', picture: 'http://foto' }),
      );

      const perfil = await service.verificarGoogle('id-token');

      expect(perfil).toEqual({ email: 'ana@gmail.com', nombre: 'Ana', avatarUrl: 'http://foto' });
    });

    it('debería lanzar 503 si Google no está configurado', async () => {
      config.get.mockReturnValue(undefined);
      await expect(service.verificarGoogle('x')).rejects.toThrow(DomainException);
      expect(fetchMock).not.toHaveBeenCalled();
    });

    it('debería rechazar un token con audiencia distinta a nuestro cliente', async () => {
      config.get.mockReturnValue('client-123');
      fetchMock.mockResolvedValue(respuestaOk({ aud: 'otro-cliente', email: 'ana@gmail.com', email_verified: 'true' }));

      await expect(service.verificarGoogle('id-token')).rejects.toThrow('no está bien configurado en este servidor');
    });

    it('debería aceptar el token aunque el client ID configurado traiga espacios', async () => {
      config.get.mockReturnValue('  client-123  ');
      fetchMock.mockResolvedValue(respuestaOk({ aud: 'client-123', email: 'ana@gmail.com', email_verified: 'true' }));

      await expect(service.verificarGoogle('id-token')).resolves.toMatchObject({ email: 'ana@gmail.com' });
    });

    it('debería aceptar cualquiera de los client IDs de la lista (web y móvil)', async () => {
      config.get.mockReturnValue('client-web,client-android');
      fetchMock.mockResolvedValue(respuestaOk({ aud: 'client-android', email: 'ana@gmail.com', email_verified: 'true' }));

      await expect(service.verificarGoogle('id-token')).resolves.toMatchObject({ email: 'ana@gmail.com' });
    });

    it('debería rechazar un token sin audiencia', async () => {
      config.get.mockReturnValue('client-123');
      fetchMock.mockResolvedValue(respuestaOk({ email: 'ana@gmail.com', email_verified: 'true' }));

      await expect(service.verificarGoogle('id-token')).rejects.toThrow('no está bien configurado en este servidor');
    });

    it('debería dejar en el log la audiencia recibida y la esperada al no coincidir', async () => {
      const aviso = jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
      config.get.mockReturnValue('client-123');
      fetchMock.mockResolvedValue(respuestaOk({ aud: 'otro-cliente', email: 'ana@gmail.com', email_verified: 'true' }));

      await expect(service.verificarGoogle('id-token')).rejects.toThrow(DomainException);

      expect(aviso).toHaveBeenCalledWith(expect.stringContaining('otro-cliente'));
      expect(aviso).toHaveBeenCalledWith(expect.stringContaining('client-123'));
      aviso.mockRestore();
    });

    it('debería rechazar un token inválido (respuesta no OK)', async () => {
      config.get.mockReturnValue('client-123');
      fetchMock.mockResolvedValue({ ok: false } as Response);

      await expect(service.verificarGoogle('id-token')).rejects.toThrow(DomainException);
    });
  });

  describe('verificarFacebook', () => {
    beforeEach(() => {
      config.get.mockImplementation((clave: string) =>
        clave === 'FACEBOOK_APP_ID' ? 'app-1' : clave === 'FACEBOOK_APP_SECRET' ? 'secret-1' : undefined,
      );
    });

    it('debería devolver el perfil cuando el token es válido para la app', async () => {
      fetchMock
        .mockResolvedValueOnce(respuestaOk({ data: { app_id: 'app-1', is_valid: true } }))
        .mockResolvedValueOnce(respuestaOk({ id: '10', name: 'Leo', email: 'leo@fb.com', picture: { data: { url: 'http://p' } } }));

      const perfil = await service.verificarFacebook('access-token');

      expect(perfil).toEqual({ email: 'leo@fb.com', nombre: 'Leo', avatarUrl: 'http://p' });
    });

    it('debería rechazar un token que no pertenece a la app', async () => {
      fetchMock.mockResolvedValueOnce(respuestaOk({ data: { app_id: 'otra', is_valid: true } }));

      await expect(service.verificarFacebook('access-token')).rejects.toThrow('no está bien configurado en este servidor');
    });

    it('debería lanzar 422 si Meta no comparte email', async () => {
      fetchMock
        .mockResolvedValueOnce(respuestaOk({ data: { app_id: 'app-1', is_valid: true } }))
        .mockResolvedValueOnce(respuestaOk({ id: '10', name: 'Leo' }));

      await expect(service.verificarFacebook('access-token')).rejects.toThrow('no comparte un email');
    });
  });
});
