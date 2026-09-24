import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import {
  ModalidadTransporte, ModoHorarioTransporte, OrdenTransporte, SolicitudTransporte, TamanoPerro,
  TipoServicioTransporte, VerticalKey,
} from 'shared';
import { environment } from '../../../../environments/environment';
import { TransporteViajeApi } from './transporte-viaje.api';

const SOLICITUD: SolicitudTransporte = {
  tipoServicio: TipoServicioTransporte.SOLO_IDA,
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

  it('debería pedir presupuesto con el vertical, el detalle y la fecha del servicio', async () => {
    const promesa = api.pedirPresupuesto({
      servicioIds: ['s1', 's2'], solicitud: SOLICITUD, resumen: [['Origen', 'Madrid']], comentario: 'Hola',
    });
    const body = responder('POST', `${base}/presupuestos`);
    expect(body).toEqual({
      vertical: VerticalKey.TRANSPORTE,
      servicioIds: ['s1', 's2'],
      detalle: { solicitud: SOLICITUD, resumen: [['Origen', 'Madrid']] },
      fechaServicio: '2026-10-01',
      comentario: 'Hola',
    });
    await promesa;
  });

  it('debería leer mis presupuestos y uno concreto', async () => {
    const lista = api.misPresupuestos();
    responder('GET', `${base}/presupuestos/mis`, []);
    await expect(lista).resolves.toEqual([]);

    const uno = api.presupuesto('pr1');
    responder('GET', `${base}/presupuestos/pr1`, { id: 'pr1' });
    await expect(uno).resolves.toEqual({ id: 'pr1' });
  });

  it('debería cancelar un presupuesto', async () => {
    const promesa = api.cancelarPresupuesto('pr1');
    expect(responder('POST', `${base}/presupuestos/pr1/cancelar`)).toEqual({});
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
