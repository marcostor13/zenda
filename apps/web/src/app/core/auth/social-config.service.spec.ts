import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { SocialConfigService } from './social-config.service';
import { environment } from '../../../environments/environment';

describe('SocialConfigService', () => {
  let service: SocialConfigService;
  let http: HttpTestingController;

  const url = `${environment.apiUrl}/auth/social/config`;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [SocialConfigService, provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(SocialConfigService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('debería servir los client IDs que manda el API', async () => {
    const config = service.cargar();

    http.expectOne(url).flush({ googleClientId: 'client-api', facebookAppId: 'app-api' });

    await expect(config).resolves.toEqual({ googleClientId: 'client-api', facebookAppId: 'app-api' });
  });

  /* Los client IDs no cambian mientras la app vive; pedirlos en cada pantalla sobra. */
  it('debería pedirlos una sola vez por sesión', async () => {
    const primera = service.cargar();
    http.expectOne(url).flush({ googleClientId: 'client-api', facebookAppId: 'app-api' });
    await primera;

    await service.cargar();

    http.expectNone(url);
  });

  /*
   * Un API sin este endpoint todavía (o caído) no puede dejar la web sin
   * botones: se cae a lo compilado, que es como funcionaba antes.
   */
  it('debería caer a la configuración compilada si el API no responde', async () => {
    const config = service.cargar();

    http.expectOne(url).flush('', { status: 500, statusText: 'Error' });

    await expect(config).resolves.toEqual({
      googleClientId: environment.googleClientId,
      facebookAppId: environment.facebookAppId,
    });
  });

  it('debería caer a lo compilado también con un 404 del endpoint', async () => {
    const config = service.cargar();

    http.expectOne(url).flush('', { status: 404, statusText: 'Not Found' });

    await expect(config).resolves.toMatchObject({ googleClientId: environment.googleClientId });
  });
});
