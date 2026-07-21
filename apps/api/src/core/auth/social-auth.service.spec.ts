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

      await expect(service.verificarGoogle('id-token')).rejects.toThrow('no pertenece a esta aplicación');
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

      await expect(service.verificarFacebook('access-token')).rejects.toThrow('no es válido para esta aplicación');
    });

    it('debería lanzar 422 si Meta no comparte email', async () => {
      fetchMock
        .mockResolvedValueOnce(respuestaOk({ data: { app_id: 'app-1', is_valid: true } }))
        .mockResolvedValueOnce(respuestaOk({ id: '10', name: 'Leo' }));

      await expect(service.verificarFacebook('access-token')).rejects.toThrow('no comparte un email');
    });
  });
});
