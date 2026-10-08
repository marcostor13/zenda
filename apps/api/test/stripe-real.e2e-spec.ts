// `import * as` y no import por defecto: ver la nota de auth.e2e-spec.ts.
import * as request from 'supertest';
import * as path from 'path';
import { config as cargarEnv } from 'dotenv';
import { Types } from 'mongoose';
// El SDK se publica en CommonJS como `module.exports = Stripe`, sin `.default`:
// un `import Stripe from` compila (allowSyntheticDefaultImports) y revienta al arrancar.
import Stripe = require('stripe');
import { PagoEstado, ReservaEstado, VerticalKey } from 'shared';
import { crearAppE2E, ruta, type AppE2E } from './utils/app-e2e';

/*
 * Las claves se leen del `.env` **antes** de arrancar la app: `crearAppE2E`
 * rellena las que falten con valores de mentira, y aquí hacen falta las de
 * verdad. Sólo se cargan las de Stripe —nunca la cadena de Mongo, que el arnés
 * sustituye por una base en memoria—.
 */
const entorno = cargarEnv({ path: path.resolve(__dirname, '../.env'), processEnv: {} }).parsed ?? {};
const CLAVE_SECRETA = process.env.STRIPE_SECRET_KEY ?? entorno['STRIPE_SECRET_KEY'] ?? '';
const SECRETO_WEBHOOK = process.env.STRIPE_WEBHOOK_SECRET ?? entorno['STRIPE_WEBHOOK_SECRET'] ?? '';

/**
 * Sólo con una clave **de pruebas**. Sin clave (CI) la suite se salta entera, y
 * con una clave real no se ejecuta jamás: aquí se cobra y se devuelve dinero.
 */
const describirConStripe = CLAVE_SECRETA.startsWith('sk_test_') && SECRETO_WEBHOOK
  ? describe
  : describe.skip;

/** Métodos con redirección que se prueban si la cuenta los tiene activos. */
const METODOS_CON_REDIRECCION = ['bancontact', 'eps', 'ideal', 'p24', 'klarna', 'satispay', 'amazon_pay'];

const DATOS_DE_FACTURACION = {
  name: 'Ana Ruiz',
  email: 'ana@doogking.test',
  phone: '+34600000000',
  address: { line1: 'Calle Mayor 1', city: 'Valencia', postal_code: '46001', country: 'ES' },
};

/**
 * E2E del cobro **contra Stripe de verdad** (modo test).
 *
 * `reserva-pago.e2e-spec.ts` recorre el mismo flujo con la pasarela simulada, y
 * por eso no puede decir nada de lo que más falla en producción: que Stripe
 * acepte lo que le mandamos, que la firma del webhook se verifique con el
 * cuerpo tal cual llega, y que los estados que devuelve se traduzcan bien. Aquí
 * no hay dobles: el API entero, Mongo en memoria y la cuenta de pruebas.
 *
 * Lo único que no se puede hacer sin navegador es lo que hace Stripe.js —pintar
 * el formulario y autenticar—; se sustituye confirmando el intent desde el
 * servidor con los métodos de prueba de Stripe (`pm_card_visa`…), que es
 * exactamente lo que acaba haciendo el formulario.
 */
describirConStripe('Cobro contra Stripe real, modo test (e2e)', () => {
  let e2e: AppE2E;
  let stripe: Stripe;
  let correlativo = 0;

  const COMERCIO_ID = new Types.ObjectId();
  const URL_DE_RETORNO = 'https://doogking.com/reservas/mis-reservas';

  beforeAll(async () => {
    process.env.STRIPE_SECRET_KEY = CLAVE_SECRETA;
    process.env.STRIPE_WEBHOOK_SECRET = SECRETO_WEBHOOK;
    // Sin correo: una prueba no manda avisos de reserva a nadie.
    process.env.RESEND_API_KEY = '';
    process.env.PAGOS_BYPASS = 'false';

    stripe = new Stripe(CLAVE_SECRETA);
    e2e = await crearAppE2E();
  }, 180_000);

  afterAll(async () => {
    await e2e?.cerrar();
  });

  beforeEach(async () => {
    await e2e.limpiarBaseDeDatos();
  });

  const api = () => request(e2e.app.getHttpServer());

  async function registrarYEntrar(): Promise<string> {
    const email = `cliente${++correlativo}@doogking.test`;
    await api()
      .post(ruta('/auth/registro'))
      .send({ nombre: 'Ana Ruiz', email, password: 'contrasena-segura-8' })
      .expect(201);

    const usuario = await e2e.conexion.collection('usuarios').findOne({ email });
    const { body } = await api()
      .post(ruta('/auth/verificar-email'))
      .send({ token: usuario!['verificacionToken'] })
      .expect(200);

    return body.accessToken as string;
  }

  async function sembrarServicio(): Promise<string> {
    await e2e.conexion.collection('comercios').insertOne({
      _id: COMERCIO_ID,
      razonSocial: 'Residencia Royal SL',
      nombreComercial: 'Residencia Royal',
      vatNumber: 'B12345678',
      verticales: [VerticalKey.ALOJAMIENTO],
      estado: 'activo',
      plan: 'basico',
    });

    const servicioId = new Types.ObjectId();
    await e2e.conexion.collection('servicios').insertOne({
      _id: servicioId,
      comercioId: COMERCIO_ID,
      comercioActivo: true,
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

  interface CobroPreparado {
    token: string;
    reservaId: string;
    total: number;
    pagoId: string;
    intentId: string;
  }

  /** Reserva creada y su PaymentIntent abierto en Stripe, listo para confirmar. */
  async function prepararCobro(): Promise<CobroPreparado> {
    const token = await registrarYEntrar();
    const servicioId = await sembrarServicio();

    // Fechas siempre futuras: la política de cancelación depende de la antelación.
    const entrada = new Date(Date.now() + 30 * 24 * 3600 * 1000);
    const salida = new Date(entrada.getTime() + 2 * 24 * 3600 * 1000);

    const { body: reserva } = await api()
      .post(ruta('/reservas'))
      .set('Authorization', `Bearer ${token}`)
      .send({
        servicioId,
        fechaInicio: entrada.toISOString().slice(0, 10),
        fechaFin: salida.toISOString().slice(0, 10),
      })
      .expect(201);

    const { body: intent } = await api()
      .post(ruta('/payments/intent'))
      .set('Authorization', `Bearer ${token}`)
      .send({ reservaId: reserva._id })
      .expect(201);

    return {
      token,
      reservaId: reserva._id as string,
      total: reserva.montoTotal as number,
      pagoId: intent.pagoId as string,
      // El secreto es `<id>_secret_<resto>`: el id es lo que va delante.
      intentId: (intent.clientSecret as string).split('_secret_')[0],
    };
  }

  /** Lo que hace Stripe.js al pulsar «pagar», hecho desde el servidor. */
  function confirmarEnStripe(intentId: string, metodoDePrueba: string): Promise<Stripe.PaymentIntent> {
    return stripe.paymentIntents.confirm(intentId, {
      payment_method: metodoDePrueba,
      return_url: URL_DE_RETORNO,
    });
  }

  async function sincronizar(cobro: CobroPreparado): Promise<string> {
    const { body } = await api()
      .post(ruta(`/payments/${cobro.pagoId}/sincronizar`))
      .set('Authorization', `Bearer ${cobro.token}`)
      .expect(200);
    return body.estado as string;
  }

  const reservaEnBd = (id: string) =>
    e2e.conexion.collection('reservas').findOne({ _id: new Types.ObjectId(id) });
  const pagoEnBd = (id: string) =>
    e2e.conexion.collection('pagos').findOne({ _id: new Types.ObjectId(id) });

  /**
   * El evento que Stripe ha generado de verdad para ese objeto. Tarda un
   * instante en aparecer en el listado, así que se pregunta varias veces.
   */
  async function eventoDeStripe(tipo: string, perteneceA: (objeto: Record<string, unknown>) => boolean): Promise<Stripe.Event> {
    for (let intento = 0; intento < 20; intento++) {
      const { data } = await stripe.events.list({ type: tipo, limit: 20 });
      const evento = data.find((e) => perteneceA(e.data.object as unknown as Record<string, unknown>));
      if (evento) return evento;
      await new Promise((resolver) => setTimeout(resolver, 1500));
    }
    throw new Error(`Stripe no ha generado el evento ${tipo} a tiempo`);
  }

  /** Entrega el evento como lo haría Stripe: cuerpo crudo y firma con el secreto del endpoint. */
  function entregarWebhook(evento: Stripe.Event, secreto = SECRETO_WEBHOOK): request.Test {
    const cuerpo = JSON.stringify(evento);
    const firma = stripe.webhooks.generateTestHeaderString({ payload: cuerpo, secret: secreto });
    return api()
      .post(ruta('/payments/webhook'))
      .set('Content-Type', 'application/json')
      .set('stripe-signature', firma)
      .send(cuerpo);
  }

  describe('crear el cobro', () => {
    it('debería abrir en Stripe un intent por el importe exacto de la reserva, en euros', async () => {
      const cobro = await prepararCobro();

      const intent = await stripe.paymentIntents.retrieve(cobro.intentId);

      expect(intent.amount).toBe(Math.round(cobro.total * 100));
      expect(intent.currency).toBe('eur');
      expect(intent.status).toBe('requires_payment_method');
      expect(intent.metadata['reservaId']).toBe(cobro.reservaId);
      expect(intent.description).toMatch(/^Reserva RES-/);
    });

    it('debería ofrecer tarjeta y dejar fuera los métodos de confirmación diferida', async () => {
      const cobro = await prepararCobro();

      const intent = await stripe.paymentIntents.retrieve(cobro.intentId);

      expect(intent.automatic_payment_methods?.enabled).toBe(true);
      expect(intent.payment_method_types).toContain('card');
      expect(intent.excluded_payment_method_types).toEqual(
        expect.arrayContaining(['sepa_debit', 'multibanco', 'customer_balance']),
      );
      expect(intent.payment_method_types).not.toContain('sepa_debit');
    });

    it('debería reutilizar el mismo intent si el cliente vuelve a pedirlo', async () => {
      const cobro = await prepararCobro();

      const { body } = await api()
        .post(ruta('/payments/intent'))
        .set('Authorization', `Bearer ${cobro.token}`)
        .send({ reservaId: cobro.reservaId })
        .expect(201);

      expect(body.pagoId).toBe(cobro.pagoId);
      expect((body.clientSecret as string).split('_secret_')[0]).toBe(cobro.intentId);
    });
  });

  describe('pago con tarjeta', () => {
    it('debería confirmar la reserva al volver de la pasarela con el pago hecho', async () => {
      const cobro = await prepararCobro();
      const intent = await confirmarEnStripe(cobro.intentId, 'pm_card_visa');
      expect(intent.status).toBe('succeeded');

      expect(await sincronizar(cobro)).toBe('aprobado');

      const reserva = await reservaEnBd(cobro.reservaId);
      const pago = await pagoEnBd(cobro.pagoId);
      expect(reserva!['estado']).toBe(ReservaEstado.CONFIRMADA);
      expect(pago!['estado']).toBe(PagoEstado.APROBADO);
      expect(pago!['stripeChargeId']).toMatch(/^ch_|^py_/);
    });

    it('debería aceptar también una tarjeta de fuera del EEE', async () => {
      const cobro = await prepararCobro();
      await confirmarEnStripe(cobro.intentId, 'pm_card_us');

      expect(await sincronizar(cobro)).toBe('aprobado');
    });

    it('no debería confirmar nada con una tarjeta rechazada, y sí al reintentar con otra', async () => {
      const cobro = await prepararCobro();

      await expect(confirmarEnStripe(cobro.intentId, 'pm_card_chargeDeclined'))
        .rejects.toMatchObject({ code: 'card_declined' });

      // El intento falló pero el intent sigue vivo: no se ha cobrado nada.
      expect(await sincronizar(cobro)).toBe('pendiente');
      expect((await reservaEnBd(cobro.reservaId))!['estado']).toBe(ReservaEstado.PENDIENTE);

      // Mismo formulario, otra tarjeta: es el camino más transitado de los fallos.
      await confirmarEnStripe(cobro.intentId, 'pm_card_visa');
      expect(await sincronizar(cobro)).toBe('aprobado');
      expect((await reservaEnBd(cobro.reservaId))!['estado']).toBe(ReservaEstado.CONFIRMADA);
    });

    it('debería confirmar aunque antes llegara el aviso del intento rechazado', async () => {
      const cobro = await prepararCobro();
      await expect(confirmarEnStripe(cobro.intentId, 'pm_card_chargeDeclinedInsufficientFunds'))
        .rejects.toBeDefined();

      const rechazo = await eventoDeStripe('payment_intent.payment_failed', (o) => o['id'] === cobro.intentId);
      await entregarWebhook(rechazo).expect(200);
      expect((await pagoEnBd(cobro.pagoId))!['estado']).toBe(PagoEstado.RECHAZADO);

      await confirmarEnStripe(cobro.intentId, 'pm_card_visa');
      const exito = await eventoDeStripe('payment_intent.succeeded', (o) => o['id'] === cobro.intentId);
      await entregarWebhook(exito).expect(200);

      expect((await pagoEnBd(cobro.pagoId))!['estado']).toBe(PagoEstado.APROBADO);
      expect((await reservaEnBd(cobro.reservaId))!['estado']).toBe(ReservaEstado.CONFIRMADA);
    });

    it('debería dejar la reserva pendiente mientras la tarjeta espera la autenticación 3-D Secure', async () => {
      const cobro = await prepararCobro();

      const intent = await confirmarEnStripe(cobro.intentId, 'pm_card_threeDSecure2Required');

      expect(intent.status).toBe('requires_action');
      expect(intent.next_action?.redirect_to_url?.url).toMatch(/^https:\/\//);
      expect(await sincronizar(cobro)).toBe('pendiente');
      expect((await reservaEnBd(cobro.reservaId))!['estado']).toBe(ReservaEstado.PENDIENTE);
    });
  });

  describe('métodos de pago con redirección', () => {
    it('debería mandar al cliente a la pasarela de cada método activo sin confirmar nada todavía', async () => {
      const cobro = await prepararCobro();
      const intent = await stripe.paymentIntents.retrieve(cobro.intentId);
      const activos = METODOS_CON_REDIRECCION.filter((m) => intent.payment_method_types.includes(m));

      // Si la cuenta sólo tuviera tarjeta, esta prueba no diría nada.
      expect(activos.length).toBeGreaterThan(0);

      for (const metodo of activos) {
        const otro = await prepararCobroExtra(cobro);
        const confirmado = await stripe.paymentIntents.confirm(otro.intentId, {
          payment_method_data: {
            type: metodo,
            billing_details: DATOS_DE_FACTURACION,
          } as Stripe.PaymentIntentConfirmParams.PaymentMethodData,
          return_url: URL_DE_RETORNO,
        });

        expect({ metodo, estado: confirmado.status }).toEqual({ metodo, estado: 'requires_action' });
        expect(confirmado.next_action?.redirect_to_url?.url ?? confirmado.next_action?.type).toBeTruthy();
        expect(await sincronizar(otro)).toBe('pendiente');
        expect((await reservaEnBd(otro.reservaId))!['estado']).toBe(ReservaEstado.PENDIENTE);
      }
    });

    /** Otra reserva del mismo cliente sobre el mismo servicio, con su propio intent. */
    async function prepararCobroExtra(base: CobroPreparado): Promise<CobroPreparado> {
      const servicio = await e2e.conexion.collection('servicios').findOne({});
      const entrada = new Date(Date.now() + (40 + correlativo++) * 24 * 3600 * 1000);
      const salida = new Date(entrada.getTime() + 24 * 3600 * 1000);

      const { body: reserva } = await api()
        .post(ruta('/reservas'))
        .set('Authorization', `Bearer ${base.token}`)
        .send({
          servicioId: servicio!._id.toString(),
          fechaInicio: entrada.toISOString().slice(0, 10),
          fechaFin: salida.toISOString().slice(0, 10),
        })
        .expect(201);

      const { body: intent } = await api()
        .post(ruta('/payments/intent'))
        .set('Authorization', `Bearer ${base.token}`)
        .send({ reservaId: reserva._id })
        .expect(201);

      return {
        token: base.token,
        reservaId: reserva._id as string,
        total: reserva.montoTotal as number,
        pagoId: intent.pagoId as string,
        intentId: (intent.clientSecret as string).split('_secret_')[0],
      };
    }
  });

  describe('webhook firmado por Stripe', () => {
    it('debería confirmar la reserva con el evento real de pago aprobado', async () => {
      const cobro = await prepararCobro();
      await confirmarEnStripe(cobro.intentId, 'pm_card_visa');
      const evento = await eventoDeStripe('payment_intent.succeeded', (o) => o['id'] === cobro.intentId);

      await entregarWebhook(evento).expect(200);

      const pago = await pagoEnBd(cobro.pagoId);
      expect((await reservaEnBd(cobro.reservaId))!['estado']).toBe(ReservaEstado.CONFIRMADA);
      expect(pago!['estado']).toBe(PagoEstado.APROBADO);
      expect(pago!['stripeChargeId']).toBeTruthy();
    });

    it('debería tragarse el mismo evento dos veces sin duplicar nada', async () => {
      const cobro = await prepararCobro();
      await confirmarEnStripe(cobro.intentId, 'pm_card_visa');
      const evento = await eventoDeStripe('payment_intent.succeeded', (o) => o['id'] === cobro.intentId);

      await entregarWebhook(evento).expect(200);
      await entregarWebhook(evento).expect(200);

      const pagos = await e2e.conexion.collection('pagos')
        .countDocuments({ reservaId: new Types.ObjectId(cobro.reservaId) });
      expect(pagos).toBe(1);
      expect((await reservaEnBd(cobro.reservaId))!['estado']).toBe(ReservaEstado.CONFIRMADA);
    });

    it('debería rechazar un evento firmado con otro secreto', async () => {
      const cobro = await prepararCobro();
      await confirmarEnStripe(cobro.intentId, 'pm_card_visa');
      const evento = await eventoDeStripe('payment_intent.succeeded', (o) => o['id'] === cobro.intentId);

      await entregarWebhook(evento, 'whsec_de_otra_cuenta').expect(400);

      expect((await reservaEnBd(cobro.reservaId))!['estado']).toBe(ReservaEstado.PENDIENTE);
    });

    it('debería dar por cerrado el cobro cuando el intent se cancela en Stripe', async () => {
      const cobro = await prepararCobro();
      await stripe.paymentIntents.cancel(cobro.intentId);
      const evento = await eventoDeStripe('payment_intent.canceled', (o) => o['id'] === cobro.intentId);

      await entregarWebhook(evento).expect(200);

      expect((await pagoEnBd(cobro.pagoId))!['estado']).toBe(PagoEstado.RECHAZADO);
      expect((await reservaEnBd(cobro.reservaId))!['estado']).toBe(ReservaEstado.PENDIENTE);
      expect(await sincronizar(cobro)).toBe('rechazado');
    });
  });

  describe('devoluciones', () => {
    async function cobroPagado(): Promise<CobroPreparado> {
      const cobro = await prepararCobro();
      await confirmarEnStripe(cobro.intentId, 'pm_card_visa');
      expect(await sincronizar(cobro)).toBe('aprobado');
      return cobro;
    }

    /** El comercio propone un suplemento: la reserva queda a la espera del cliente. */
    async function proponerAjuste(cobro: CobroPreparado, suplemento: number): Promise<void> {
      await e2e.conexion.collection('reservas').updateOne(
        { _id: new Types.ObjectId(cobro.reservaId) },
        { $set: { estado: ReservaEstado.AJUSTE_SOLICITADO, montoAjustado: cobro.total + suplemento } },
      );
    }

    const rechazarAjuste = (cobro: CobroPreparado) => api()
      .post(ruta(`/payments/reservas/${cobro.reservaId}/ajuste/rechazar`))
      .set('Authorization', `Bearer ${cobro.token}`);

    it('debería anotar lo que diga la política cuando el cliente cancela una reserva pagada', async () => {
      const cobro = await cobroPagado();

      const { body: previa } = await api()
        .get(ruta(`/reservas/${cobro.reservaId}/cancelacion`))
        .set('Authorization', `Bearer ${cobro.token}`)
        .expect(200);

      await api()
        .post(ruta(`/reservas/${cobro.reservaId}/cancelacion`))
        .set('Authorization', `Bearer ${cobro.token}`)
        .expect((respuesta) => expect([200, 201]).toContain(respuesta.status));

      const { data: reembolsos } = await stripe.refunds.list({ payment_intent: cobro.intentId });
      const devuelto = reembolsos.reduce((suma, r) => suma + r.amount, 0);

      // Lo que se le prometió en la vista previa es lo que sale de Stripe.
      expect(devuelto).toBe(Math.round((previa.importe as number) * 100));
      expect((await pagoEnBd(cobro.pagoId))!['importeReembolsado']).toBe(previa.importe);
      expect((await reservaEnBd(cobro.reservaId))!['estado']).toBe(ReservaEstado.CANCELADA);
    });

    it('debería devolver el cobro entero en Stripe cuando el cliente rechaza un suplemento', async () => {
      const cobro = await cobroPagado();
      await proponerAjuste(cobro, 20);

      await rechazarAjuste(cobro).expect(200);

      const { data: reembolsos } = await stripe.refunds.list({ payment_intent: cobro.intentId });
      const pago = await pagoEnBd(cobro.pagoId);
      expect(reembolsos).toHaveLength(1);
      expect(reembolsos[0].amount).toBe(Math.round(cobro.total * 100));
      expect(pago!['estado']).toBe(PagoEstado.REEMBOLSADO);
      expect(pago!['importeReembolsado']).toBe(cobro.total);
      expect((await reservaEnBd(cobro.reservaId))!['estado']).toBe(ReservaEstado.CANCELADA);
    });

    it('no debería contar dos veces una devolución propia cuando Stripe la avisa', async () => {
      const cobro = await cobroPagado();
      await proponerAjuste(cobro, 20);
      await rechazarAjuste(cobro).expect(200);

      const evento = await eventoDeStripe('charge.refunded', (o) => o['payment_intent'] === cobro.intentId);
      await entregarWebhook(evento).expect(200);

      const pago = await pagoEnBd(cobro.pagoId);
      expect(pago!['importeReembolsado']).toBe(cobro.total);
      expect(pago!['estado']).toBe(PagoEstado.REEMBOLSADO);
    });

    it('debería cobrar sólo la diferencia cuando el cliente acepta un suplemento', async () => {
      const cobro = await cobroPagado();
      await proponerAjuste(cobro, 20);

      const aceptar = () => api()
        .post(ruta(`/payments/reservas/${cobro.reservaId}/ajuste/aceptar`))
        .set('Authorization', `Bearer ${cobro.token}`)
        .expect(201);
      const { body: suplemento } = await aceptar();
      // Dos clics no abren dos cargos por la misma diferencia.
      expect((await aceptar()).body.pagoId).toBe(suplemento.pagoId);

      const intentId = (suplemento.clientSecret as string).split('_secret_')[0];
      expect((await stripe.paymentIntents.retrieve(intentId)).amount).toBe(2000);

      await confirmarEnStripe(intentId, 'pm_card_visa');
      expect(await sincronizar({ ...cobro, pagoId: suplemento.pagoId as string })).toBe('aprobado');

      const reserva = await reservaEnBd(cobro.reservaId);
      expect(reserva!['estado']).toBe(ReservaEstado.CONFIRMADA);
      expect(reserva!['montoTotal']).toBe(cobro.total + 20);
    });

    it('debería anotar una devolución hecha a mano desde el panel de Stripe', async () => {
      const cobro = await cobroPagado();
      // Soporte devuelve 10 € desde Stripe, sin pasar por la plataforma.
      await stripe.refunds.create({ payment_intent: cobro.intentId, amount: 1000 });
      const parcial = await eventoDeStripe('charge.refunded', (o) => o['payment_intent'] === cobro.intentId);

      await entregarWebhook(parcial).expect(200);

      let pago = await pagoEnBd(cobro.pagoId);
      expect(pago!['importeReembolsado']).toBe(10);
      expect(pago!['estado']).toBe(PagoEstado.APROBADO);

      // Y después el resto: el pago pasa a devuelto del todo.
      await stripe.refunds.create({ payment_intent: cobro.intentId });
      const total = await eventoDeStripe(
        'charge.refunded',
        (o) => o['payment_intent'] === cobro.intentId && o['refunded'] === true,
      );
      await entregarWebhook(total).expect(200);

      pago = await pagoEnBd(cobro.pagoId);
      expect(pago!['importeReembolsado']).toBe(cobro.total);
      expect(pago!['estado']).toBe(PagoEstado.REEMBOLSADO);
    });
  });

  describe('disputas', () => {
    it('debería dejar constancia en el pago cuando el cliente reclama el cargo a su banco', async () => {
      const cobro = await prepararCobro();
      // Tarjeta de prueba que Stripe disputa sola nada más cobrarla.
      await confirmarEnStripe(cobro.intentId, 'pm_card_createDispute');
      expect(await sincronizar(cobro)).toBe('aprobado');
      const evento = await eventoDeStripe('charge.dispute.created', (o) => o['payment_intent'] === cobro.intentId);

      await entregarWebhook(evento).expect(200);
      await entregarWebhook(evento).expect(200);

      const pago = await pagoEnBd(cobro.pagoId);
      expect(pago!['incidencias']).toHaveLength(1);
      expect(pago!['incidencias'][0]).toMatchObject({ tipo: 'disputa', referencia: (evento.data.object as { id: string }).id });
    });
  });
});
