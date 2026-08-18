// `import * as` y no import por defecto: ver la nota de auth.e2e-spec.ts.
import * as request from 'supertest';
import { Types } from 'mongoose';
import { PagoEstado, ReservaEstado, VerticalKey } from 'shared';
import { PAYMENT_GATEWAY } from '../src/core/payments/payment-gateway.interface';
import { crearAppE2E, ruta, type AppE2E } from './utils/app-e2e';

/**
 * E2E del flujo crítico: **buscar → reservar → pagar → confirmar**.
 *
 * Es el recorrido que gana dinero, y el único sitio donde se comprueba de punta
 * a punta que las piezas encajan: el buscador sólo enseña lo publicado de un
 * comercio activo, la reserva deriva comercio y vertical del servicio, el
 * webhook de Stripe confirma la reserva y el importe cobrado cuadra al céntimo
 * con el de la reserva.
 *
 * Stripe es lo único simulado: es el único externo que no se puede llamar de
 * verdad. Todo lo demás —guards, pipes, Mongo, comisiones— es el sistema real.
 */
describe('Reserva y pago (e2e)', () => {
  let e2e: AppE2E;

  /** Doble de la pasarela: devuelve intents deterministas y guarda lo que recibe. */
  const pasarela = {
    crearIntent: jest.fn(),
    construirEvento: jest.fn(),
    extraerIntentDeEvento: jest.fn(),
    reembolsar: jest.fn().mockResolvedValue(undefined),
  };

  const cliente = {
    nombre: 'Ana Ruiz',
    email: 'ana@doogking.test',
    password: 'contrasena-segura-8',
  };

  const COMERCIO_ID = new Types.ObjectId();
  const OTRO_COMERCIO_ID = new Types.ObjectId();

  beforeAll(async () => {
    e2e = await crearAppE2E([{ token: PAYMENT_GATEWAY, valor: pasarela }]);
  }, 180_000);

  afterAll(async () => {
    await e2e.cerrar();
  });

  beforeEach(async () => {
    await e2e.limpiarBaseDeDatos();
    jest.clearAllMocks();
    pasarela.crearIntent.mockResolvedValue({ intentId: 'pi_e2e', clientSecret: 'pi_e2e_secret' });
  });

  const api = () => request(e2e.app.getHttpServer());

  /** Alta + verificación por base de datos: equivale a abrir el enlace del correo. */
  async function registrarYEntrar(): Promise<string> {
    await api().post(ruta('/auth/registro')).send(cliente).expect(201);

    const usuario = await e2e.conexion
      .collection('usuarios')
      .findOne({ email: cliente.email });

    const { body } = await api()
      .post(ruta('/auth/verificar-email'))
      .send({ token: usuario!['verificacionToken'] })
      .expect(200);

    return body.accessToken as string;
  }

  /**
   * Comercio activo con un listado publicado. Se inserta directo en Mongo: el
   * alta de comercio pasa por aprobación del admin, y lo que se prueba aquí es
   * el flujo del cliente, no el del panel.
   */
  async function sembrarServicio(
    comercioId = COMERCIO_ID,
    estadoComercio: 'activo' | 'suspendido' = 'activo',
  ): Promise<string> {
    await e2e.conexion.collection('comercios').insertOne({
      _id: comercioId,
      razonSocial: 'Residencia Royal SL',
      nombreComercial: 'Residencia Royal',
      vatNumber: `B${comercioId.toString().slice(-8)}`,
      verticales: [VerticalKey.ALOJAMIENTO],
      estado: estadoComercio,
      plan: 'basico',
    });

    const servicioId = new Types.ObjectId();
    await e2e.conexion.collection('servicios').insertOne({
      _id: servicioId,
      comercioId,
      comercioActivo: estadoComercio === 'activo',
      vertical: VerticalKey.ALOJAMIENTO,
      __t: 'Alojamiento',
      titulo: 'Suite Canina Royal',
      descripcion: 'Suite con jardín y cámaras 24h.',
      ubicacion: { ciudad: 'Valencia' },
      precioBase: 100,
      moneda: 'EUR',
      estado: 'publicado',
      espacios: [
        { tipo: 'suite', tamanoMaxPerro: 'grande', precioNoche: 100, cantidad: 3, disponible: true },
      ],
      espaciosDisponibles: 3,
      ratingPromedio: 0,
      totalReseñas: 0,
    });

    return servicioId.toString();
  }

  describe('el buscador sólo enseña oferta reservable', () => {
    it('debería encontrar el listado publicado de un comercio activo', async () => {
      await sembrarServicio();

      const { body } = await api()
        .get(ruta('/catalog/servicios'))
        .query({ vertical: VerticalKey.ALOJAMIENTO, ciudad: 'Valencia' })
        .expect(200);

      expect(body.items).toHaveLength(1);
      expect(body.items[0].nombre).toBe('Suite Canina Royal');
    });

    it('no debería enseñar los listados de un comercio suspendido', async () => {
      // Suspender un comercio (HU J1) tiene que sacarlo del buscador: antes
      // seguía siendo público y reservable.
      await sembrarServicio(COMERCIO_ID, 'suspendido');

      const { body } = await api()
        .get(ruta('/catalog/servicios'))
        .query({ vertical: VerticalKey.ALOJAMIENTO })
        .expect(200);

      expect(body.items).toHaveLength(0);
    });

    it('debería tratar la ciudad como texto literal, no como patrón', async () => {
      await sembrarServicio();

      // Un patrón de retroceso catastrófico tiene que responder al instante.
      const inicio = Date.now();
      await api().get(ruta('/catalog/servicios')).query({ ciudad: '(a+)+$' }).expect(200);

      expect(Date.now() - inicio).toBeLessThan(3_000);
    });
  });

  describe('crear la reserva', () => {
    it('debería exigir sesión', async () => {
      const servicioId = await sembrarServicio();

      await api()
        .post(ruta('/reservas'))
        .send({ servicioId, fechaInicio: '2026-09-01', fechaFin: '2026-09-03' })
        .expect(401);
    });

    it('debería derivar comercio y vertical del servicio, sin que el cliente los mande', async () => {
      const token = await registrarYEntrar();
      const servicioId = await sembrarServicio();

      const { body } = await api()
        .post(ruta('/reservas'))
        .set('Authorization', `Bearer ${token}`)
        .send({ servicioId, fechaInicio: '2026-09-01', fechaFin: '2026-09-03', cantidad: 1 })
        .expect(201);

      expect(body.comercioId).toBe(COMERCIO_ID.toString());
      expect(body.vertical).toBe(VerticalKey.ALOJAMIENTO);
      expect(body.estado).toBe(ReservaEstado.PENDIENTE);
      expect(body.codigo).toMatch(/^RES-/);
    });

    it('debería rechazar la reserva si el cliente declara otro comercio', async () => {
      // De ese comercio dependen la comisión y a quién se liquida el dinero.
      const token = await registrarYEntrar();
      const servicioId = await sembrarServicio();

      await api()
        .post(ruta('/reservas'))
        .set('Authorization', `Bearer ${token}`)
        .send({
          servicioId,
          comercioId: OTRO_COMERCIO_ID.toString(),
          fechaInicio: '2026-09-01',
          fechaFin: '2026-09-03',
        })
        .expect(409);
    });

    it('debería rechazar la reserva si el cliente declara otro vertical', async () => {
      const token = await registrarYEntrar();
      const servicioId = await sembrarServicio();

      await api()
        .post(ruta('/reservas'))
        .set('Authorization', `Bearer ${token}`)
        .send({
          servicioId,
          vertical: VerticalKey.VETERINARIA,
          fechaInicio: '2026-09-01',
          fechaFin: '2026-09-03',
        })
        .expect(409);
    });

    it('debería devolver 404, no 500, con un servicio inexistente', async () => {
      const token = await registrarYEntrar();

      await api()
        .post(ruta('/reservas'))
        .set('Authorization', `Bearer ${token}`)
        .send({
          servicioId: new Types.ObjectId().toString(),
          fechaInicio: '2026-09-01',
          fechaFin: '2026-09-03',
        })
        .expect(404);
    });

    it('debería guardar los importes redondeados al céntimo', async () => {
      const token = await registrarYEntrar();
      const servicioId = await sembrarServicio();

      const { body } = await api()
        .post(ruta('/reservas'))
        .set('Authorization', `Bearer ${token}`)
        .send({ servicioId, fechaInicio: '2026-09-01', fechaFin: '2026-09-03' })
        .expect(201);

      for (const campo of ['montoSubtotal', 'comisionMonto', 'montoTotal'] as const) {
        expect(body[campo]).toBe(Number(body[campo].toFixed(2)));
      }
    });
  });

  describe('cobro y confirmación', () => {
    /** Deja la reserva creada y devuelve su id junto al token del cliente. */
    async function reservaPendiente(): Promise<{ token: string; reservaId: string; total: number }> {
      const token = await registrarYEntrar();
      const servicioId = await sembrarServicio();

      const { body } = await api()
        .post(ruta('/reservas'))
        .set('Authorization', `Bearer ${token}`)
        .send({ servicioId, fechaInicio: '2026-09-01', fechaFin: '2026-09-03' })
        .expect(201);

      return { token, reservaId: body._id as string, total: body.montoTotal as number };
    }

    it('debería crear el intent por el mismo importe que la reserva', async () => {
      const { token, reservaId, total } = await reservaPendiente();

      const { body } = await api()
        .post(ruta('/payments/intent'))
        .set('Authorization', `Bearer ${token}`)
        .send({ reservaId })
        .expect(201);

      expect(body.clientSecret).toBe('pi_e2e_secret');
      expect(body.montoTotal).toBe(total);
      // Y a Stripe se le piden esos mismos euros, en céntimos enteros.
      expect(pasarela.crearIntent.mock.calls[0][0].montoEnCentavos).toBe(Math.round(total * 100));
    });

    it('no debería dejar pagar la reserva de otra persona', async () => {
      const { reservaId } = await reservaPendiente();

      // Segunda cuenta, que no tiene nada que ver con esa reserva.
      await api()
        .post(ruta('/auth/registro'))
        .send({ ...cliente, email: 'otro@doogking.test' })
        .expect(201);
      const otro = await e2e.conexion
        .collection('usuarios')
        .findOne({ email: 'otro@doogking.test' });
      const { body: sesion } = await api()
        .post(ruta('/auth/verificar-email'))
        .send({ token: otro!['verificacionToken'] })
        .expect(200);

      await api()
        .post(ruta('/payments/intent'))
        .set('Authorization', `Bearer ${sesion.accessToken}`)
        .send({ reservaId })
        .expect(403);
    });

    it('debería confirmar la reserva cuando Stripe avisa del pago', async () => {
      const { token, reservaId } = await reservaPendiente();
      await api()
        .post(ruta('/payments/intent'))
        .set('Authorization', `Bearer ${token}`)
        .send({ reservaId })
        .expect(201);

      pasarela.construirEvento.mockReturnValue({ type: 'payment_intent.succeeded' });
      pasarela.extraerIntentDeEvento.mockReturnValue({
        intentId: 'pi_e2e', estado: 'succeeded', chargeId: 'ch_e2e',
      });

      await api()
        .post(ruta('/payments/webhook'))
        .set('stripe-signature', 'firma-valida')
        .send({})
        .expect(200);

      const reserva = await e2e.conexion
        .collection('reservas')
        .findOne({ _id: new Types.ObjectId(reservaId) });
      const pago = await e2e.conexion
        .collection('pagos')
        .findOne({ stripePaymentIntentId: 'pi_e2e' });

      expect(reserva!['estado']).toBe(ReservaEstado.CONFIRMADA);
      expect(pago!['estado']).toBe(PagoEstado.APROBADO);
      expect(pago!['stripeChargeId']).toBe('ch_e2e');
    });

    it('debería rechazar el webhook si la firma no es válida', async () => {
      pasarela.construirEvento.mockImplementation(() => {
        throw new Error('Invalid signature');
      });

      await api()
        .post(ruta('/payments/webhook'))
        .set('stripe-signature', 'firma-falsa')
        .send({})
        .expect(400);
    });

    it('debería ignorar un webhook repetido sin volver a tocar nada', async () => {
      const { token, reservaId } = await reservaPendiente();
      await api()
        .post(ruta('/payments/intent'))
        .set('Authorization', `Bearer ${token}`)
        .send({ reservaId })
        .expect(201);

      pasarela.construirEvento.mockReturnValue({ type: 'payment_intent.succeeded' });
      pasarela.extraerIntentDeEvento.mockReturnValue({ intentId: 'pi_e2e', estado: 'succeeded' });

      await api().post(ruta('/payments/webhook')).set('stripe-signature', 'ok').send({}).expect(200);
      await api().post(ruta('/payments/webhook')).set('stripe-signature', 'ok').send({}).expect(200);

      const pagos = await e2e.conexion.collection('pagos').countDocuments({ reservaId: new Types.ObjectId(reservaId) });
      expect(pagos).toBe(1);
    });

    it('no debería confirmar nada si el pago falla', async () => {
      const { token, reservaId } = await reservaPendiente();
      await api()
        .post(ruta('/payments/intent'))
        .set('Authorization', `Bearer ${token}`)
        .send({ reservaId })
        .expect(201);

      pasarela.construirEvento.mockReturnValue({ type: 'payment_intent.payment_failed' });
      pasarela.extraerIntentDeEvento.mockReturnValue({ intentId: 'pi_e2e', estado: 'failed' });

      await api().post(ruta('/payments/webhook')).set('stripe-signature', 'ok').send({}).expect(200);

      const reserva = await e2e.conexion
        .collection('reservas')
        .findOne({ _id: new Types.ObjectId(reservaId) });

      expect(reserva!['estado']).toBe(ReservaEstado.PENDIENTE);
    });

    it('debería dejar la reserva visible en "mis reservas" tras confirmarla', async () => {
      const { token, reservaId } = await reservaPendiente();
      await api()
        .post(ruta('/payments/intent'))
        .set('Authorization', `Bearer ${token}`)
        .send({ reservaId })
        .expect(201);

      pasarela.construirEvento.mockReturnValue({ type: 'payment_intent.succeeded' });
      pasarela.extraerIntentDeEvento.mockReturnValue({ intentId: 'pi_e2e', estado: 'succeeded' });
      await api().post(ruta('/payments/webhook')).set('stripe-signature', 'ok').send({}).expect(200);

      const { body } = await api()
        .get(ruta('/reservas/mis'))
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(body).toHaveLength(1);
      expect(body[0].estado).toBe(ReservaEstado.CONFIRMADA);
    });
  });
});
