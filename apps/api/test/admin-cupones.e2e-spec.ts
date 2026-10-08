import { Types } from 'mongoose';
import { Rol, VerticalKey } from 'shared';
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
