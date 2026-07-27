import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { firstValueFrom } from 'rxjs';
import { ComercioApiService } from './comercio-api.service';

describe('ComercioApiService', () => {
  let service: ComercioApiService;
  let httpMock: HttpTestingController;

  /** Resuelve la petición pendiente que apunta a `fragmento` y devuelve el request. */
  const resolver = (fragmento: string, respuesta: unknown = {}) => {
    const req = httpMock.expectOne((r) => r.url.includes(fragmento));
    req.flush(respuesta as Record<string, unknown>);
    return req.request;
  };

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(ComercioApiService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  describe('cuenta del comercio', () => {
    it('debería pedir el comercio propio sin pasar id', async () => {
      const promesa = firstValueFrom(service.getMiComercio());

      const req = resolver('/comercios/mi-comercio', { _id: 'c1' });
      // El comercio se deduce del JWT: enviar un id desde el cliente permitiría
      // leer datos de otro comercio.
      expect(req.method).toBe('GET');
      expect(req.url).toContain('/mi-comercio');

      await expect(promesa).resolves.toMatchObject({ _id: 'c1' });
    });

    it('debería enviar el alta con razón social, IVA y verticales', async () => {
      const dto = {
        razonSocial: 'Canes SL', vatNumber: 'ESB12345678',
        nombreComercial: 'Canes', verticales: ['alojamiento'],
      };
      const promesa = firstValueFrom(service.onboarding(dto));

      const req = resolver('/comercios/onboarding', { accessToken: 'jwt', usuario: {} });
      expect(req.method).toBe('POST');
      expect(req.body).toEqual(dto);

      // El alta devuelve un token nuevo porque el rol del usuario cambia.
      await expect(promesa).resolves.toMatchObject({ accessToken: 'jwt' });
    });

    it('debería actualizar el perfil con PATCH', async () => {
      const promesa = firstValueFrom(service.actualizarComercio({ nombreComercial: 'Canes Pro' } as never));

      const req = resolver('/comercios/mi-comercio');
      expect(req.method).toBe('PATCH');
      expect(req.body).toEqual({ nombreComercial: 'Canes Pro' });

      await promesa;
    });
  });

  describe('reservas recibidas', () => {
    it('debería listar las reservas del comercio', async () => {
      const promesa = firstValueFrom(service.getMisReservas());
      resolver('/comercios/mis-reservas', []);

      await expect(promesa).resolves.toEqual([]);
    });

    it('debería completar la reserva con PATCH sobre su propia ruta', async () => {
      const promesa = firstValueFrom(service.completarReserva('r1'));

      const req = resolver('/mis-reservas/r1/completar');
      expect(req.method).toBe('PATCH');
      expect(req.body).toEqual({});

      await promesa;
    });

    it('debería enviar el hito y la nota al marcar seguimiento', async () => {
      const promesa = firstValueFrom(service.marcarSeguimiento('r1', 'salida_paseo', 'Todo bien'));

      expect(resolver('/mis-reservas/r1/seguimiento').body)
        .toEqual({ hito: 'salida_paseo', nota: 'Todo bien' });

      await promesa;
    });

    it('debería admitir un hito sin nota', async () => {
      const promesa = firstValueFrom(service.marcarSeguimiento('r1', 'entrada'));

      expect(resolver('/mis-reservas/r1/seguimiento').body.nota).toBeUndefined();
      await promesa;
    });

    it('debería solicitar el ajuste de importe contra la reserva', async () => {
      const dto = { montoNuevo: 120, motivo: 'Noche extra' };
      const promesa = firstValueFrom(service.solicitarAjuste('r1', dto as never));

      const req = resolver('/mis-reservas/r1/solicitar-ajuste');
      // El ajuste lo propone el comercio pero lo acepta el cliente: aquí solo se solicita.
      expect(req.method).toBe('PATCH');
      expect(req.body).toEqual(dto);

      await promesa;
    });
  });

  describe('equipo', () => {
    it('debería listar, crear y eliminar miembros en la misma ruta base', async () => {
      const listado = firstValueFrom(service.getMiEquipo());
      const urlListado = resolver('/comercios/mi-equipo', []).url;
      await listado;

      const alta = firstValueFrom(service.crearMiembroEquipo({ nombre: 'Ana', email: 'a@a.com' } as never));
      const reqAlta = resolver('/comercios/mi-equipo', {});
      expect(reqAlta.method).toBe('POST');
      expect(reqAlta.url).toBe(urlListado);
      await alta;

      const baja = firstValueFrom(service.eliminarMiembroEquipo('u1'));
      expect(resolver('/mi-equipo/u1').method).toBe('DELETE');
      await baja;
    });
  });

  describe('catálogo y disponibilidad', () => {
    it('debería crear el servicio contra catalog, no contra comercios', async () => {
      const promesa = firstValueFrom(service.crearServicio({ titulo: 'Suite' } as never));

      const req = resolver('/catalog/servicios', {});
      expect(req.method).toBe('POST');
      expect(req.url).not.toContain('/comercios');

      await promesa;
    });

    it('debería pedir la vista de gestión del servicio, no la pública', async () => {
      const promesa = firstValueFrom(service.obtenerServicioGestion('s1'));

      expect(resolver('/catalog/servicios/s1/gestion').url).toContain('/gestion');
      await promesa;
    });

    it('debería cambiar el estado enviando solo el estado', async () => {
      const promesa = firstValueFrom(service.cambiarEstadoServicio('s1', 'pausado'));

      const req = resolver('/mis-servicios/s1/estado');
      expect(req.method).toBe('PATCH');
      expect(req.body).toEqual({ estado: 'pausado' });

      await promesa;
    });

    it('debería mandar solo los cambios de disponibilidad', async () => {
      const cambios = { fechasBloqueadas: ['2026-08-01'] };
      const promesa = firstValueFrom(service.actualizarDisponibilidad('s1', cambios as never));

      expect(resolver('/mis-servicios/s1/disponibilidad').body).toEqual(cambios);
      await promesa;
    });
  });

  describe('suplementos', () => {
    it('debería listar solo los suplementos propios', async () => {
      const promesa = firstValueFrom(service.getMisSuplementos());

      expect(resolver('/suplementos/mis', []).method).toBe('GET');
      await promesa;
    });

    it('debería crear en la raíz y actualizar por id', async () => {
      const alta = firstValueFrom(service.crearSuplemento({ nombre: 'Paseo extra' } as never));
      const reqAlta = resolver('/suplementos', { _id: 'sup1' });
      expect(reqAlta.method).toBe('POST');
      await alta;

      const edicion = firstValueFrom(service.actualizarSuplemento('sup1', { precio: 8 } as never));
      const reqEdicion = resolver('/suplementos/sup1');
      expect(reqEdicion.method).toBe('PATCH');
      expect(reqEdicion.body).toEqual({ precio: 8 });
      await edicion;
    });

    it('debería eliminar el suplemento por id', async () => {
      const promesa = firstValueFrom(service.eliminarSuplemento('sup1'));

      expect(resolver('/suplementos/sup1').method).toBe('DELETE');
      await promesa;
    });
  });

  describe('reseñas y finanzas', () => {
    it('debería responder la reseña enviando solo el texto', async () => {
      const promesa = firstValueFrom(service.responderResena('rev1', 'Gracias'));

      const req = resolver('/mis-resenas/rev1/respuesta');
      expect(req.method).toBe('PATCH');
      expect(req.body).toEqual({ texto: 'Gracias' });

      await promesa;
    });

    it('debería pedir las finanzas propias', async () => {
      const promesa = firstValueFrom(service.getMisFinanzas());

      expect(resolver('/comercios/mis-finanzas', { gmv: 0 }).method).toBe('GET');
      await promesa;
    });

    it('debería propagar el 403 cuando el comercio no es dueño del recurso', async () => {
      const promesa = firstValueFrom(service.obtenerServicioGestion('de-otro'));
      httpMock.expectOne((r) => r.url.includes('/de-otro/gestion'))
        .flush({ message: 'Prohibido' }, { status: 403, statusText: 'Forbidden' });

      await expect(promesa).rejects.toBeDefined();
    });
  });
});
