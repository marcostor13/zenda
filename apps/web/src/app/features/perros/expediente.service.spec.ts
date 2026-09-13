import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ExpedienteApi, ExpedienteService, normalizarExpediente } from './expediente.service';
import * as descarga from '../../shared/exportacion/descargar-archivo';
import { environment } from '../../../environments/environment';

describe('ExpedienteService', () => {
  let service: ExpedienteService;
  let http: HttpTestingController;
  const api = environment.apiUrl;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    service = TestBed.inject(ExpedienteService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('debería pedir el expediente del perro propio', async () => {
    const promesa = service.delPropietario('p1');
    http.expectOne(`${api}/perros/p1/expediente`).flush({ perro: {}, registros: [], servicios: [] });
    await expect(promesa).resolves.toMatchObject({ perro: { vacunas: [] }, registros: [], servicios: [] });
  });

  it('debería completar las listas que falten en una ficha antigua (fallo de producción)', async () => {
    const promesa = service.delPropietario('p1');
    http.expectOne(`${api}/perros/p1/expediente`).flush({ perro: { _id: 'p1', nombre: 'Luna' } });

    const exp = await promesa;
    expect(exp.perro.vacunas).toEqual([]);
    expect(exp.perro.alergias).toEqual([]);
    expect(exp.registros).toEqual([]);
    expect(exp.servicios).toEqual([]);
  });

  it('no debería tocar las listas que ya vienen', () => {
    const exp = normalizarExpediente({ perro: { vacunas: ['Rabia'] }, registros: [], servicios: [] } as unknown as ExpedienteApi);
    expect(exp.perro.vacunas).toEqual(['Rabia']);
  });

  it('debería mandar la búsqueda de mascotas sólo cuando hay texto', async () => {
    const sinTexto = service.mascotasDelComercio('  ');
    http.expectOne(`${api}/comercio/mascotas`).flush([]);
    await sinTexto;

    const conTexto = service.mascotasDelComercio(' nala ');
    const peticion = http.expectOne((r) => r.url === `${api}/comercio/mascotas`);
    expect(peticion.request.params.get('q')).toBe('nala');
    peticion.flush([]);
    await conTexto;
  });

  it('debería leer el expediente de una mascota del comercio', async () => {
    const promesa = service.delComercio('p1');
    http.expectOne(`${api}/comercio/mascotas/p1`).flush({ perro: {}, registros: [], servicios: [] });
    await promesa;
  });

  it('debería crear, actualizar y eliminar registros con el verbo correcto', async () => {
    const crear = service.crearRegistro('p1', { vertical: 'veterinaria', titulo: 'Consulta' });
    const post = http.expectOne(`${api}/comercio/mascotas/p1/registros`);
    expect(post.request.method).toBe('POST');
    post.flush({ _id: 'r1' });
    await crear;

    const actualizar = service.actualizarRegistro('p1', 'r1', { titulo: 'Revisión' });
    const patch = http.expectOne(`${api}/comercio/mascotas/p1/registros/r1`);
    expect(patch.request.method).toBe('PATCH');
    patch.flush({ _id: 'r1' });
    await actualizar;

    const eliminar = service.eliminarRegistro('p1', 'r1');
    const del = http.expectOne(`${api}/comercio/mascotas/p1/registros/r1`);
    expect(del.request.method).toBe('DELETE');
    del.flush(null);
    await eliminar;
  });

  it('debería descargar los informes como archivo con nombre legible', async () => {
    const guardar = jest.spyOn(descarga, 'descargarBlob').mockImplementation(() => undefined);

    const delComercio = service.descargarInformeComercio('p1', 'Nala Ñandú');
    const peticion = http.expectOne(`${api}/comercio/mascotas/p1/informe`);
    expect(peticion.request.responseType).toBe('blob');
    peticion.flush(new Blob(['%PDF']));
    await delComercio;

    const delDueno = service.descargarInformePropietario('p1', 'Nala');
    http.expectOne(`${api}/perros/p1/informe`).flush(new Blob(['%PDF']));
    await delDueno;

    expect(guardar).toHaveBeenNthCalledWith(1, expect.any(Blob), expect.stringMatching(/^doogking-informe-nala-nandu-/));
    expect(guardar).toHaveBeenNthCalledWith(2, expect.any(Blob), expect.stringMatching(/^doogking-informe-nala-/));
  });
});
