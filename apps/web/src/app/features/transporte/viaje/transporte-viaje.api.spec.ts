import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import {
  ModalidadTransporte, ModoHorarioTransporte, OrdenTransporte, SolicitudViaje, TamanoPerro,
  NecesidadTransporte,
} from 'shared';
import { environment } from '../../../../environments/environment';
import { TransporteViajeApi } from './transporte-viaje.api';

const SOLICITUD: SolicitudViaje = {
  tipoServicio: NecesidadTransporte.SOLO_IDA,
  origen: { texto: 'Madrid', placeId: 'a' },
  destino: { texto: 'Toledo', placeId: 'b' },
  fecha: '2026-10-01',
  modoHorario: ModoHorarioTransporte.HORA_CONCRETA,
  hora: '10:00',
  mascotas: [{ especie: 'perro', tamano: TamanoPerro.MEDIANO }],
  necesidades: [],
  modalidad: ModalidadTransporte.COMPARTIDO,
  preferencias: [],
};

describe('TransporteViajeApi', () => {
  let api: TransporteViajeApi;
  let http: HttpTestingController;
  const base = environment.apiUrl;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    api = TestBed.inject(TransporteViajeApi);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  const responder = (metodo: string, url: string, respuesta: unknown = {}): Record<string, unknown> | null => {
    const req = http.expectOne({ method: metodo, url });
    req.flush(respuesta as Record<string, unknown>);
    return req.request.body as Record<string, unknown> | null;
  };

  it('debería buscar con la solicitud y el orden', async () => {
    const promesa = api.buscar(SOLICITUD, OrdenTransporte.PRECIO);
    const body = responder('POST', `${base}/transporte/cotizaciones`, { viajes: 1, resultados: [], ruta: null });
    expect(body).toEqual({ solicitud: SOLICITUD, orden: OrdenTransporte.PRECIO });
    await expect(promesa).resolves.toEqual({ viajes: 1, resultados: [], ruta: null });
  });

  it('debería cotizar una empresa concreta mandando sólo la solicitud', async () => {
    const promesa = api.cotizarEmpresa('s1', SOLICITUD);
    expect(responder('POST', `${base}/transporte/cotizaciones/s1`)).toEqual(SOLICITUD);
    await promesa;
  });

  it('debería pedir un presupuesto por empresa con el viaje, el perro y el instante de recogida', async () => {
    const conPerro: SolicitudViaje = { ...SOLICITUD, mascotas: [{ especie: 'perro', tamano: TamanoPerro.MEDIANO }, { perroId: 'p1', especie: 'perro', tamano: TamanoPerro.MEDIANO }] };
    const promesa = api.pedirPresupuesto({ servicioIds: ['s1', 's2'], solicitud: conPerro, resumen: [['Origen', 'Madrid']] });
    const reqs = http.match({ method: 'POST', url: `${base}/presupuestos` });
    expect(reqs).toHaveLength(2);
    expect(reqs.map((r) => r.request.body)).toEqual(['s1', 's2'].map((servicioId) => ({
      servicioId,
      perroId: 'p1',
      // 10:00 en Madrid en octubre (CEST, UTC+2).
      fechaServicio: '2026-10-01T08:00:00.000Z',
      solicitud: { solicitud: conPerro, resumen: [['Origen', 'Madrid']] },
    })));
    reqs.forEach((r, i) => r.flush({ id: `pr${i + 1}` }));
    await expect(promesa).resolves.toEqual([{ id: 'pr1' }, { id: 'pr2' }]);
  });

  it('debería mandar el presupuesto sin perro cuando las mascotas son a mano', async () => {
    const promesa = api.pedirPresupuesto({ servicioIds: ['s1'], solicitud: SOLICITUD, resumen: [] });
    const body = responder('POST', `${base}/presupuestos`, { id: 'pr1' });
    expect(body?.['perroId']).toBeUndefined();
    await expect(promesa).resolves.toEqual([{ id: 'pr1' }]);
  });

  it('debería leer mis presupuestos', async () => {
    const lista = api.misPresupuestos();
    responder('GET', `${base}/presupuestos/mis`, []);
    await expect(lista).resolves.toEqual([]);
  });

  it('debería aceptar un presupuesto con los datos de entrega', async () => {
    const promesa = api.aceptarPresupuesto('pr1', { entrega: { quien: 'yo' } });
    expect(responder('POST', `${base}/presupuestos/pr1/aceptar`, { id: 'pr1' })).toEqual({ detalleExtra: { entrega: { quien: 'yo' } } });
    await expect(promesa).resolves.toEqual({ id: 'pr1' });
  });

  it('debería rechazar un presupuesto con su motivo', async () => {
    const promesa = api.rechazarPresupuesto('pr1', 'Caro');
    expect(responder('POST', `${base}/presupuestos/pr1/rechazar`, { id: 'pr1' })).toEqual({ motivo: 'Caro' });
    await promesa;
  });

  it('debería pedir la vista previa y cancelar en la ruta de cancelación', async () => {
    const vista = api.vistaPreviaCancelacion('r1');
    responder('GET', `${base}/reservas/r1/cancelacion`, { porcentaje: 100, importe: 50, motivo: 'ok' });
    await expect(vista).resolves.toEqual({ porcentaje: 100, importe: 50, motivo: 'ok' });

    const cancelar = api.cancelar('r1');
    expect(responder('POST', `${base}/reservas/r1/cancelacion`)).toEqual({});
    await cancelar;
  });

  it('debería leer el contacto y la ubicación de una reserva', async () => {
    const contacto = api.contacto('r1');
    responder('GET', `${base}/reservas/r1/contacto`, { nombre: 'Ana' });
    await expect(contacto).resolves.toEqual({ nombre: 'Ana' });

    const ubicacion = api.ubicacion('r1');
    responder('GET', `${base}/reservas/r1/ubicacion`, { compartiendo: false, rastro: [] });
    await expect(ubicacion).resolves.toEqual({ compartiendo: false, rastro: [] });
  });
});
