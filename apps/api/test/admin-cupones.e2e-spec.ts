import { Types } from 'mongoose';
import { ReservaEstado, Rol, VerticalKey } from 'shared';
import { crearAppE2E, ruta, type AppE2E } from './utils/app-e2e';
import { api, como, sembrarComercio, sembrarCuenta, type CuentaSembrada } from './utils/admin-e2e';

/**
 * E2E de los códigos de descuento del panel de administración.
 *
 * Los cuerpos son los que arma `CuponesAdminComponent` al guardar —porcentaje
 * ya dividido entre cien, ceros para «sin tope» y «sin límite», el día de
 * caducidad como `YYYY-MM-DD`—: lo que se comprueba es que el API acepta lo que
 * el panel manda de verdad, y que el cupón creado sirve luego para descontar.
 */
describe('Cupones del panel de administración (e2e)', () => {
  let e2e: AppE2E;
  let admin: CuentaSembrada;
  let cliente: CuentaSembrada;

  /** Lo que envía el formulario con todo por defecto y un 20 %. */
  const cuponDelPanel = (extra: Record<string, unknown> = {}): Record<string, unknown> => ({
    codigo: 'BIENVENIDA20',
    tipo: 'porcentaje',
    valor: 0.2,
    vertical: 'global',
    montoMinimo: 0,
    topeDescuento: 0,
    usoMaximo: 0,
    asumeDescuento: 'plataforma',
    soloPrimeraReserva: false,
    usosPorUsuario: 0,
    nivelAlphaMinimo: 0,
    ...extra,
  });

  const crear = (cuerpo: Record<string, unknown>, token = admin.token) =>
    api(e2e).post(ruta('/cupones')).set(como(token)).send(cuerpo);

  const validar = (codigo: string, montoSubtotal = 100, vertical: string = VerticalKey.ALOJAMIENTO) =>
    api(e2e).post(ruta('/cupones/validar')).set(como(cliente.token)).send({ codigo, vertical, montoSubtotal });

  beforeAll(async () => {
    e2e = await crearAppE2E();
  }, 180_000);

  afterAll(async () => {
    await e2e.cerrar();
  });

  beforeEach(async () => {
    await e2e.limpiarBaseDeDatos();
    admin = await sembrarCuenta(e2e, Rol.ADMIN);
    cliente = await sembrarCuenta(e2e, Rol.CLIENTE);
  });

  describe('crear', () => {
    it('debería crear un cupón de porcentaje con lo que manda el formulario', async () => {
      const { body } = await crear(cuponDelPanel()).expect(201);

      expect(body).toMatchObject({
        codigo: 'BIENVENIDA20', tipo: 'porcentaje', valor: 0.2, vertical: 'global', activo: true, usados: 0,
      });
      expect(body._id).toBeDefined();
    });

    it('debería crear un cupón de importe fijo acotado a un vertical', async () => {
      const { body } = await crear(cuponDelPanel({
        codigo: 'VET5', tipo: 'fijo', valor: 5, vertical: VerticalKey.VETERINARIA, montoMinimo: 30,
      })).expect(201);

      expect(body).toMatchObject({ tipo: 'fijo', valor: 5, vertical: VerticalKey.VETERINARIA, montoMinimo: 30 });
    });

    it('debería guardar la descripción que escribe el admin', async () => {
      const { body } = await crear(cuponDelPanel({ descripcion: 'Campaña de bienvenida' })).expect(201);

      expect(body.descripcion).toBe('Campaña de bienvenida');
    });

    it('debería guardar el alcance: comercio, ciudad, campaña y límites por persona', async () => {
      const { comercioId } = await sembrarComercio(e2e);
      const campanaId = new Types.ObjectId().toString();

      const { body } = await crear(cuponDelPanel({
        comercioId: comercioId.toString(),
        ciudad: 'Valencia',
        campanaId,
        usosPorUsuario: 1,
        soloPrimeraReserva: true,
        usoMaximo: 50,
        topeDescuento: 15,
        asumeDescuento: 'comercio',
      })).expect(201);

      expect(body).toMatchObject({
        comercioId: comercioId.toString(),
        ciudad: 'Valencia',
        campanaId,
        usosPorUsuario: 1,
        soloPrimeraReserva: true,
        usoMaximo: 50,
        topeDescuento: 15,
        asumeDescuento: 'comercio',
      });
    });

    it('debería guardar el código en mayúsculas aunque llegue en minúsculas', async () => {
      const { body } = await crear(cuponDelPanel({ codigo: ' verano10 ' })).expect(201);

      expect(body.codigo).toBe('VERANO10');
    });

    it('debería rechazar con un motivo claro un código que ya existe', async () => {
      await crear(cuponDelPanel()).expect(201);

      const { body } = await crear(cuponDelPanel()).expect(409);

      expect(body.message).toContain('BIENVENIDA20');
      expect(await e2e.conexion.collection('cupones').countDocuments()).toBe(1);
    });

    it('debería rechazar un cupón sin código o con un tipo que no existe', async () => {
      await crear(cuponDelPanel({ codigo: undefined })).expect(400);
      await crear(cuponDelPanel({ tipo: 'regalo' })).expect(400);
      await crear(cuponDelPanel({ valor: -5 })).expect(400);
    });

    it('debería rechazar un comercio que no es un identificador válido, sin romper el servidor', async () => {
      await crear(cuponDelPanel({ comercioId: 'no-es-un-id' })).expect(400);
    });

    it('no debería dejar crear cupones a quien no es administrador', async () => {
      await crear(cuponDelPanel(), cliente.token).expect(403);
      await api(e2e).post(ruta('/cupones')).send(cuponDelPanel()).expect(401);
    });
  });

  describe('caducidad', () => {
    it('debería valer durante todo el último día, hora de Madrid', async () => {
      const { body } = await crear(cuponDelPanel({ validoHasta: '2031-07-15' })).expect(201);

      // El 15 de julio en Madrid acaba a las 22:00 UTC (horario de verano).
      // Guardado como medianoche UTC, el cupón moría al empezar ese día.
      expect(body.validoHasta).toBe('2031-07-15T21:59:59.999Z');
    });

    it('debería rechazar al cliente un cupón ya caducado', async () => {
      await crear(cuponDelPanel({ validoHasta: '2020-01-01' })).expect(201);

      await validar('BIENVENIDA20').expect(410);
    });
  });

  /**
   * Las restricciones que el panel deja configurar. Se guardaban en el cupón y
   * nadie las comprobaba al reservar: se prueban contra reservas de verdad.
   */
  describe('restricciones al reservar', () => {
    let noche = 0;

    /** Alojamiento reservable de un comercio, en la ciudad indicada. */
    async function sembrarAlojamiento(ciudad: string): Promise<{ comercioId: string; servicioId: string }> {
      const comercioId = new Types.ObjectId();
      const servicioId = new Types.ObjectId();
      await e2e.conexion.collection('comercios').insertOne({
        _id: comercioId,
        razonSocial: 'Residencia Royal SL',
        nombreComercial: `Residencia ${ciudad}`,
        vatNumber: `B${comercioId.toString().slice(-8)}`,
        verticales: [VerticalKey.ALOJAMIENTO],
        estado: 'activo',
        plan: 'basico',
      });
      await e2e.conexion.collection('servicios').insertOne({
        _id: servicioId,
        comercioId,
        comercioActivo: true,
        vertical: VerticalKey.ALOJAMIENTO,
        __t: 'Alojamiento',
        titulo: `Suite Canina ${ciudad}`,
        descripcion: 'Suite con jardín.',
        ubicacion: { ciudad },
        precioBase: 100,
        moneda: 'EUR',
        estado: 'publicado',
        espacios: [{ tipo: 'suite', tamanoMaxPerro: 'grande', precioNoche: 100, cantidad: 5, disponible: true }],
        espaciosDisponibles: 5,
        ratingPromedio: 0,
        totalReseñas: 0,
      });
      return { comercioId: comercioId.toString(), servicioId: servicioId.toString() };
    }

    /** Reserva de una noche con cupón; cada llamada usa una fecha distinta. */
    function reservar(servicioId: string, cuponCodigo: string) {
      const entrada = new Date(Date.now() + (30 + noche++) * 24 * 3600 * 1000);
      const salida = new Date(entrada.getTime() + 24 * 3600 * 1000);
      return api(e2e).post(ruta('/reservas')).set(como(cliente.token)).send({
        servicioId,
        fechaInicio: entrada.toISOString().slice(0, 10),
        fechaFin: salida.toISOString().slice(0, 10),
        cuponCodigo,
      });
    }

    /** Lo que hace el pago aprobado: la reserva deja de estar pendiente. */
    const darPorPagada = (reservaId: string) => e2e.conexion.collection('reservas').updateOne(
      { _id: new Types.ObjectId(reservaId) },
      { $set: { estado: ReservaEstado.CONFIRMADA } },
    );

    it('debería descontar en la reserva y guardar el cupón con que se hizo', async () => {
      const { servicioId } = await sembrarAlojamiento('Valencia');
      await crear(cuponDelPanel()).expect(201);

      const { body } = await reservar(servicioId, 'bienvenida20').expect(201);

      expect(body.montoTotal).toBe(80);
      expect(body.descuentoMonto).toBe(20);
      expect(body.cuponCodigo).toBe('BIENVENIDA20');
    });

    it('debería dejar usarlo una sola vez a cada persona', async () => {
      const { servicioId } = await sembrarAlojamiento('Valencia');
      await crear(cuponDelPanel({ usosPorUsuario: 1 })).expect(201);

      const { body: primera } = await reservar(servicioId, 'BIENVENIDA20').expect(201);
      await darPorPagada(primera._id);

      const { body } = await reservar(servicioId, 'BIENVENIDA20').expect(409);
      expect(body.message).toContain('Ya has usado este cupón');
    });

    it('no debería gastar el uso una reserva que no llegó a pagarse', async () => {
      const { servicioId } = await sembrarAlojamiento('Valencia');
      await crear(cuponDelPanel({ usosPorUsuario: 1 })).expect(201);

      await reservar(servicioId, 'BIENVENIDA20').expect(201);

      // La primera se quedó pendiente: el cliente vuelve a intentarlo.
      await reservar(servicioId, 'BIENVENIDA20').expect(201);
    });

    it('debería valer sólo para la primera reserva del cliente', async () => {
      const { servicioId } = await sembrarAlojamiento('Valencia');
      await crear(cuponDelPanel({ soloPrimeraReserva: true })).expect(201);

      const { body: primera } = await reservar(servicioId, 'BIENVENIDA20').expect(201);
      await darPorPagada(primera._id);

      const { body } = await reservar(servicioId, 'BIENVENIDA20').expect(422);
      expect(body.message).toContain('primera reserva');
    });

    it('debería valer sólo en el comercio para el que se creó', async () => {
      const suyo = await sembrarAlojamiento('Valencia');
      const ajeno = await sembrarAlojamiento('Valencia');
      await crear(cuponDelPanel({ comercioId: suyo.comercioId })).expect(201);

      const { body } = await reservar(ajeno.servicioId, 'BIENVENIDA20').expect(422);
      expect(body.message).toContain('no aplica a este comercio');

      await reservar(suyo.servicioId, 'BIENVENIDA20').expect(201);
    });

    it('debería valer sólo en su ciudad', async () => {
      const valencia = await sembrarAlojamiento('Valencia');
      const madrid = await sembrarAlojamiento('Madrid');
      await crear(cuponDelPanel({ ciudad: 'valencia' })).expect(201);

      await reservar(madrid.servicioId, 'BIENVENIDA20').expect(422);
      await reservar(valencia.servicioId, 'BIENVENIDA20').expect(201);
    });

    it('debería exigir el nivel Alpha mínimo', async () => {
      const { servicioId } = await sembrarAlojamiento('Valencia');
      await e2e.conexion.collection('alpha_niveles').insertMany([
        { nivel: 1, nombre: 'Alpha 1', reservasRequeridas: 0, descuentoPct: 0, beneficios: [] },
        { nivel: 2, nombre: 'Alpha 2', reservasRequeridas: 3, descuentoPct: 0.05, beneficios: [] },
      ]);
      await crear(cuponDelPanel({ nivelAlphaMinimo: 2 })).expect(201);

      const { body } = await reservar(servicioId, 'BIENVENIDA20').expect(422);
      expect(body.message).toContain('nivel Alpha 2');
    });

    it('no debería dejar bloqueada la plaza cuando el cupón se rechaza', async () => {
      const suyo = await sembrarAlojamiento('Valencia');
      const ajeno = await sembrarAlojamiento('Valencia');
      await crear(cuponDelPanel({ comercioId: suyo.comercioId })).expect(201);

      await reservar(ajeno.servicioId, 'BIENVENIDA20').expect(422);

      expect(await e2e.conexion.collection('reservas').countDocuments()).toBe(0);
    });

    it('debería avisar ya en la vista previa si el cupón es de otro comercio', async () => {
      const suyo = await sembrarAlojamiento('Valencia');
      const ajeno = await sembrarAlojamiento('Valencia');
      await crear(cuponDelPanel({ comercioId: suyo.comercioId })).expect(201);

      const previa = (servicioId: string) => api(e2e)
        .post(ruta('/cupones/validar'))
        .set(como(cliente.token))
        .send({ codigo: 'BIENVENIDA20', vertical: VerticalKey.ALOJAMIENTO, montoSubtotal: 100, servicioId });

      await previa(ajeno.servicioId).expect(422);
      await previa(suyo.servicioId).expect(200);
    });
  });

  describe('el cupón creado se puede usar', () => {
    it('debería aparecer en el listado del panel', async () => {
      await crear(cuponDelPanel()).expect(201);
      await crear(cuponDelPanel({ codigo: 'OTRO' })).expect(201);

      const { body } = await api(e2e).get(ruta('/cupones')).set(como(admin.token)).expect(200);

      expect(body.map((c: { codigo: string }) => c.codigo).sort()).toEqual(['BIENVENIDA20', 'OTRO']);
    });

    it('debería descontar al cliente el porcentaje configurado', async () => {
      await crear(cuponDelPanel()).expect(201);

      const { body } = await validar('bienvenida20', 150).expect(200);

      expect(body).toMatchObject({ codigo: 'BIENVENIDA20', descuento: 30 });
    });

    it('debería respetar el tope de descuento y el importe mínimo', async () => {
      await crear(cuponDelPanel({ topeDescuento: 10, montoMinimo: 50 })).expect(201);

      expect((await validar('BIENVENIDA20', 150).expect(200)).body.descuento).toBe(10);
      await validar('BIENVENIDA20', 40).expect(422);
    });

    it('no debería aplicarse fuera de su vertical', async () => {
      await crear(cuponDelPanel({ vertical: VerticalKey.VETERINARIA })).expect(201);

      await validar('BIENVENIDA20', 100, VerticalKey.ALOJAMIENTO).expect(422);
      await validar('BIENVENIDA20', 100, VerticalKey.VETERINARIA).expect(200);
    });

    it('debería dejar de valer cuando el admin lo desactiva o lo borra', async () => {
      const { body: cupon } = await crear(cuponDelPanel()).expect(201);

      await api(e2e).patch(ruta(`/cupones/${cupon._id}`)).set(como(admin.token)).send({ activo: false }).expect(200);
      await validar('BIENVENIDA20').expect(404);

      await api(e2e).delete(ruta(`/cupones/${cupon._id}`)).set(como(admin.token)).expect(204);
      expect(await e2e.conexion.collection('cupones').countDocuments()).toBe(0);
    });
  });
});
