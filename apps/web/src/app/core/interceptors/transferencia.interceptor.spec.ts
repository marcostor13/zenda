import { HttpClient, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { PLATFORM_ID, TransferState, makeStateKey } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { HttpRequest } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { claveDeTransferencia, transferenciaInterceptor } from './transferencia.interceptor';

function configurar(plataforma: 'browser' | 'server'): { http: HttpClient; control: HttpTestingController; estado: TransferState } {
  TestBed.configureTestingModule({
    providers: [
      { provide: PLATFORM_ID, useValue: plataforma },
      provideHttpClient(withInterceptors([transferenciaInterceptor])),
      provideHttpClientTesting(),
    ],
  });
  return {
    http: TestBed.inject(HttpClient),
    control: TestBed.inject(HttpTestingController),
    estado: TestBed.inject(TransferState),
  };
}

describe('transferenciaInterceptor', () => {
  it('debería construir la clave sin el dominio', () => {
    const peticion = new HttpRequest('GET', 'https://api.doogking.com/api/v1/catalog/servicios/x');
    expect(claveDeTransferencia(peticion)).toBe('dk-http:GET:/api/v1/catalog/servicios/x');
  });

  it('en el servidor debería guardar la respuesta pública', async () => {
    const { http, control, estado } = configurar('server');
    const respuesta = firstValueFrom(http.get('http://interno:3000/api/v1/lugares/a'));
    control.expectOne('http://interno:3000/api/v1/lugares/a').flush({ slug: 'a' });
    await respuesta;

    const clave = makeStateKey<{ body: unknown }>('dk-http:GET:/api/v1/lugares/a');
    expect(estado.get(clave, null)?.body).toEqual({ slug: 'a' });
  });

  it('en el navegador debería servir lo transferido una sola vez sin llamar al API', async () => {
    const { http, control, estado } = configurar('browser');
    estado.set(makeStateKey('dk-http:GET:/api/v1/lugares/a'), { body: { slug: 'a' }, status: 200, statusText: 'OK' });

    await expect(firstValueFrom(http.get('https://doogking.com/api/v1/lugares/a'))).resolves.toEqual({ slug: 'a' });
    control.expectNone('https://doogking.com/api/v1/lugares/a');

    const segunda = firstValueFrom(http.get('https://doogking.com/api/v1/lugares/a'));
    control.expectOne('https://doogking.com/api/v1/lugares/a').flush({ slug: 'b' });
    await expect(segunda).resolves.toEqual({ slug: 'b' });
  });

  it('no debería usar la caché con sesión', async () => {
    const { http, control, estado } = configurar('browser');
    estado.set(makeStateKey('dk-http:GET:/api/v1/perfil'), { body: { otro: true }, status: 200, statusText: 'OK' });

    const respuesta = firstValueFrom(http.get('/api/v1/perfil', { headers: { Authorization: 'Bearer x' } }));
    control.expectOne('/api/v1/perfil').flush({ propio: true });
    await expect(respuesta).resolves.toEqual({ propio: true });
  });
});
