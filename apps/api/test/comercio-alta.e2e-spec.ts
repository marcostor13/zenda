// `import * as` y no import por defecto: el API compila a CommonJS y tiene
// `allowSyntheticDefaultImports` pero no `esModuleInterop`, así que el import
// por defecto se emite como `supertest_1.default` y queda `undefined` en runtime.
import * as request from 'supertest';
import { Types } from 'mongoose';
import { Rol, VerticalKey } from 'shared';
import { crearAppE2E, ruta, type AppE2E } from './utils/app-e2e';

/**
 * E2E del alta de comercio: desde que un profesional se registra hasta que
 * tiene sesión, negocio vinculado y perfil completo.
 *
 * Es el recorrido que trae la oferta a la plataforma, y el que más veces se ha
 * roto: la observación del cliente del 09-09-2026 llegó justo de aquí («each
 * value in verticales must be one of…»). Se prueba contra el API ensamblado y
 * una Mongo en memoria, porque casi todo lo que puede fallar está en las
 * costuras —validación global, unicidad en la base, orden de creación de
 * usuario y comercio— y no dentro de un método suelto.
 *
 * El alta tiene dos caminos y los dos se cubren:
 *  1. **Rápida** (`POST /comercios/registro`): crea cuenta y negocio a la vez,
 *     pendiente de verificar el email. Es la de la web pública.
 *  2. **Onboarding** (`POST /comercios/onboarding`): vincula un negocio a una
 *     cuenta de comercio que todavía no tiene ninguno.
 */
describe('Alta de comercio (e2e)', () => {
  let e2e: AppE2E;

  const alta = {
    nombre: 'Ana Torres',
    email: 'ana@royaldog.eu',
    password: 'Segura123!',
    telefono: '+34600111222',
    verticales: [VerticalKey.PELUQUERIA, VerticalKey.VETERINARIA],
  };

  const servidor = () => e2e.app.getHttpServer();

  /** Lee el token que el API acaba de guardar, como si se abriera el correo. */
  async function tokenDeVerificacion(email: string): Promise<string> {
    const usuario = await e2e.conexion
      .collection('usuarios')
      .findOne<{ verificacionToken?: string }>({ email });
    if (!usuario?.verificacionToken) {
      throw new Error(`No se generó token de verificación para ${email}`);
    }
    return usuario.verificacionToken;
  }

  /** Alta rápida + verificación. Devuelve la sesión ya iniciada. */
  async function altaCompleta(datos: Record<string, unknown> = alta): Promise<{
    accessToken: string;
    usuario: { rol: string; comercioId?: string; email: string };
  }> {
    await request(servidor()).post(ruta('/comercios/registro')).send(datos).expect(201);
    const res = await request(servidor())
      .post(ruta('/auth/verificar-email'))
      .send({ token: await tokenDeVerificacion(datos['email'] as string) })
      .expect(200);
    return res.body;
  }

  /** El documento tal y como quedó en la base, para comprobar lo que no se devuelve. */
  const comercioDe = (id: string) =>
    e2e.conexion.collection('comercios').findOne({ _id: new Types.ObjectId(id) });

  beforeAll(async () => {
    e2e = await crearAppE2E();
  });

  afterAll(async () => {
    await e2e.cerrar();
  });

  beforeEach(async () => {
    await e2e.limpiarBaseDeDatos();
  });

  // ── 1. Alta rápida ──────────────────────────────────────────────────────

  describe('alta rápida: cuenta y negocio de una vez', () => {
    it('debería dejar la cuenta pendiente de verificar, sin entregar token', async () => {
      const res = await request(servidor())
        .post(ruta('/comercios/registro'))
        .send(alta)
        .expect(201);

      expect(res.body).toEqual({ requiereVerificacion: true, email: alta.email });
      expect(res.body.accessToken).toBeUndefined();
    });

    it('debería crear el negocio con las categorías marcadas', async () => {
      await request(servidor()).post(ruta('/comercios/registro')).send(alta).expect(201);

      const comercio = await e2e.conexion.collection('comercios').findOne({});
      expect(comercio?.['verticales']).toEqual([VerticalKey.PELUQUERIA, VerticalKey.VETERINARIA]);
    });

    /** Nada se publica solo: un comercio nuevo espera a que lo apruebe un admin. */
    it('debería nacer pendiente de aprobación', async () => {
      await request(servidor()).post(ruta('/comercios/registro')).send(alta).expect(201);

      const comercio = await e2e.conexion.collection('comercios').findOne({});
      expect(comercio?.['estado']).toBe('pendiente');
      expect(comercio?.['plan']).toBe('basico');
    });

    it('debería crear la cuenta como administradora de su comercio', async () => {
      await request(servidor()).post(ruta('/comercios/registro')).send(alta).expect(201);

      const usuario = await e2e.conexion.collection('usuarios').findOne({ email: alta.email });
      const comercio = await e2e.conexion.collection('comercios').findOne({});

      expect(usuario?.['rol']).toBe(Rol.COMERCIO_ADMIN);
      expect(String(usuario?.['comercioId'])).toBe(String(comercio?.['_id']));
      expect(usuario?.['verificado']).not.toBe(true);
    });

    it('nunca debería guardar la contraseña en claro ni devolverla', async () => {
      const res = await request(servidor())
        .post(ruta('/comercios/registro'))
        .send(alta)
        .expect(201);

      const usuario = await e2e.conexion
        .collection('usuarios')
        .findOne<{ passwordHash?: string }>({ email: alta.email });

      expect(JSON.stringify(res.body)).not.toContain(alta.password);
      expect(usuario?.passwordHash).toBeDefined();
      expect(usuario?.passwordHash).not.toBe(alta.password);
      expect(usuario?.passwordHash).toMatch(/^\$2[aby]\$/);
    });

    /**
     * El alta rápida sólo pide los datos de acceso: el negocio se nombra
     * después, en el alta guiada. El documento no puede quedarse sin nombre, así
     * que lleva un provisional derivado del de la persona.
     */
    it('debería poner un nombre comercial provisional si el alta no lo trae', async () => {
      await request(servidor()).post(ruta('/comercios/registro')).send(alta).expect(201);

      const comercio = await e2e.conexion.collection('comercios').findOne({});
      expect(comercio?.['nombreComercial']).toBe('Negocio de Ana Torres');
    });

    it('debería respetar el nombre comercial si sí lo trae', async () => {
      await request(servidor())
        .post(ruta('/comercios/registro'))
        .send({ ...alta, nombreComercial: 'Royal Dog Spa' })
        .expect(201);

      const comercio = await e2e.conexion.collection('comercios').findOne({});
      expect(comercio?.['nombreComercial']).toBe('Royal Dog Spa');
    });

    /**
     * Rellenar la razón social con el provisional dejaba al negocio con una
     * identidad legal inventada que nadie corregía después.
     */
    it('no debería inventarse la razón social', async () => {
      await request(servidor()).post(ruta('/comercios/registro')).send(alta).expect(201);

      const comercio = await e2e.conexion.collection('comercios').findOne({});
      expect(comercio?.['razonSocial']).toBeUndefined();
    });

    it('debería admitir un alta sin categorías, para elegirlas después', async () => {
      const { verticales: _sinUsar, ...sinCategorias } = alta;

      await request(servidor()).post(ruta('/comercios/registro')).send(sinCategorias).expect(201);

      const comercio = await e2e.conexion.collection('comercios').findOne({});
      expect(comercio?.['verticales']).toEqual([]);
    });
  });

  // ── 2. Validación de la entrada ─────────────────────────────────────────

  describe('validación del alta', () => {
    /**
     * Regresión de la observación del cliente del 09-09-2026. El borrador que
     * el navegador guardaba traía «cuidadores», una categoría retirada del
     * catálogo el 1-09, y el alta moría aquí con un mensaje que el comercio no
     * podía relacionar con nada de lo que veía en pantalla.
     */
    it('debería rechazar una categoría que ya no está en el catálogo', async () => {
      const res = await request(servidor())
        .post(ruta('/comercios/registro'))
        .send({ ...alta, verticales: ['cuidadores'] })
        .expect(400);

      expect(JSON.stringify(res.body)).toContain('verticales');
      // Y no deja rastro: ni comercio ni cuenta a medias.
      expect(await e2e.conexion.collection('comercios').countDocuments()).toBe(0);
      expect(await e2e.conexion.collection('usuarios').countDocuments()).toBe(0);
    });

    it('debería aceptar las ocho categorías vigentes', async () => {
      await request(servidor())
        .post(ruta('/comercios/registro'))
        .send({ ...alta, verticales: Object.values(VerticalKey) })
        .expect(201);

      const comercio = await e2e.conexion.collection('comercios').findOne({});
      expect(comercio?.['verticales']).toHaveLength(Object.values(VerticalKey).length);
    });

    it('debería rechazar categorías repetidas', async () => {
      await request(servidor())
        .post(ruta('/comercios/registro'))
        .send({ ...alta, verticales: [VerticalKey.PELUQUERIA, VerticalKey.PELUQUERIA] })
        .expect(400);
    });

    it('debería rechazar un email con formato inválido', async () => {
      await request(servidor())
        .post(ruta('/comercios/registro'))
        .send({ ...alta, email: 'no-es-un-email' })
        .expect(400);
    });

    it('debería exigir una contraseña de al menos ocho caracteres', async () => {
      await request(servidor())
        .post(ruta('/comercios/registro'))
        .send({ ...alta, password: 'corta12' })
        .expect(400);
    });

    /**
     * `forbidNonWhitelisted` está activo en el bootstrap: colar `rol` para
     * autoproclamarse administrador de la plataforma tiene que fallar, no
     * ignorarse en silencio.
     */
    it('debería rechazar campos que no declara el DTO', async () => {
      await request(servidor())
        .post(ruta('/comercios/registro'))
        .send({ ...alta, rol: Rol.ADMIN })
        .expect(400);

      await request(servidor())
        .post(ruta('/comercios/registro'))
        .send({ ...alta, estado: 'activo' })
        .expect(400);
    });

    it('debería exigir el nombre de la persona', async () => {
      const { nombre: _sinUsar, ...sinNombre } = alta;

      await request(servidor()).post(ruta('/comercios/registro')).send(sinNombre).expect(400);
    });
  });

  // ── 3. Colisiones ───────────────────────────────────────────────────────

  describe('altas que chocan con una existente', () => {
    it('debería rechazar con 409 un email ya registrado', async () => {
      await request(servidor()).post(ruta('/comercios/registro')).send(alta).expect(201);

      await request(servidor()).post(ruta('/comercios/registro')).send(alta).expect(409);
    });

    /** El segundo intento no puede dejar un negocio suelto en la colección. */
    it('no debería crear un segundo negocio al fallar por email duplicado', async () => {
      await request(servidor()).post(ruta('/comercios/registro')).send(alta).expect(201);
      await request(servidor()).post(ruta('/comercios/registro')).send(alta).expect(409);

      expect(await e2e.conexion.collection('comercios').countDocuments()).toBe(1);
    });

    it('debería rechazar con 409 un identificador fiscal ya usado', async () => {
      await request(servidor())
        .post(ruta('/comercios/registro'))
        .send({ ...alta, vatNumber: 'B12345678' })
        .expect(201);

      await request(servidor())
        .post(ruta('/comercios/registro'))
        .send({ ...alta, email: 'otra@royaldog.eu', vatNumber: 'B12345678' })
        .expect(409);
    });

    it('debería dejar registrarse a dos negocios distintos', async () => {
      await request(servidor()).post(ruta('/comercios/registro')).send(alta).expect(201);

      await request(servidor())
        .post(ruta('/comercios/registro'))
        .send({ ...alta, nombre: 'Luis Gil', email: 'luis@caninos.eu' })
        .expect(201);

      expect(await e2e.conexion.collection('comercios').countDocuments()).toBe(2);
      expect(await e2e.conexion.collection('usuarios').countDocuments()).toBe(2);
    });
  });

  // ── 4. Verificación del correo y entrada al panel ───────────────────────

  describe('verificación del correo', () => {
    it('debería abrir sesión con el rol y el comercio ya vinculados', async () => {
      const sesion = await altaCompleta();

      expect(sesion.accessToken).toBeDefined();
      expect(sesion.usuario.rol).toBe(Rol.COMERCIO_ADMIN);
      expect(sesion.usuario.comercioId).toBeDefined();
      expect(sesion.usuario.email).toBe(alta.email);
    });

    it('debería dejar entrar por login una vez verificada la cuenta', async () => {
      await altaCompleta();

      const res = await request(servidor())
        .post(ruta('/auth/login'))
        .send({ email: alta.email, password: alta.password })
        .expect(200);

      expect(res.body.usuario.rol).toBe(Rol.COMERCIO_ADMIN);
    });

    /** Sin confirmar el correo no se entra: es la barrera contra altas falsas. */
    it('no debería dejar entrar antes de verificar el correo', async () => {
      await request(servidor()).post(ruta('/comercios/registro')).send(alta).expect(201);

      await request(servidor())
        .post(ruta('/auth/login'))
        .send({ email: alta.email, password: alta.password })
        .expect(403);
    });

    it('debería rechazar un token de verificación inventado', async () => {
      await request(servidor()).post(ruta('/comercios/registro')).send(alta).expect(201);

      await request(servidor())
        .post(ruta('/auth/verificar-email'))
        .send({ token: 'no-es-el-token' })
        .expect(400);
    });
  });

  // ── 5. El panel del comercio recién creado ──────────────────────────────

  describe('primer acceso al panel', () => {
    let sesion: Awaited<ReturnType<typeof altaCompleta>>;
    const autorizado = (metodo: 'get' | 'patch' | 'post', camino: string) =>
      request(servidor())[metodo](ruta(camino)).set('Authorization', `Bearer ${sesion.accessToken}`);

    beforeEach(async () => {
      sesion = await altaCompleta();
    });

    it('debería poder leer su propio comercio', async () => {
      const res = await autorizado('get', '/comercios/mi-comercio').expect(200);

      expect(res.body.nombreComercial).toBe('Negocio de Ana Torres');
      expect(res.body.estado).toBe('pendiente');
      expect(res.body.verticales).toEqual([VerticalKey.PELUQUERIA, VerticalKey.VETERINARIA]);
    });

    it('debería empezar sin reservas y sin servicios publicados', async () => {
      const reservas = await autorizado('get', '/comercios/mis-reservas').expect(200);
      const servicios = await autorizado('get', '/comercios/mis-servicios').expect(200);

      expect(reservas.body).toEqual([]);
      expect(servicios.body).toEqual([]);
    });

    it('debería tener a quien lo dio de alta como única persona del equipo', async () => {
      const res = await autorizado('get', '/comercios/mi-equipo').expect(200);

      expect(res.body).toHaveLength(1);
      expect(res.body[0].email).toBe(alta.email);
      expect(res.body[0].rol).toBe(Rol.COMERCIO_ADMIN);
    });

    it('debería completar el perfil del negocio desde el panel', async () => {
      const res = await autorizado('patch', '/comercios/mi-comercio')
        .send({
          nombreComercial: 'Royal Dog Spa',
          razonSocial: 'Royal Dog Spa SL',
          vatNumber: 'B98765432',
        })
        .expect(200);

      expect(res.body.nombreComercial).toBe('Royal Dog Spa');
      expect(res.body.razonSocial).toBe('Royal Dog Spa SL');

      const guardado = await comercioDe(sesion.usuario.comercioId!);
      expect(guardado?.['vatNumber']).toBe('B98765432');
    });

    it('no debería poder cambiar su propio estado ni su plan', async () => {
      await autorizado('patch', '/comercios/mi-comercio')
        .send({ estado: 'activo' })
        .expect(400);

      const guardado = await comercioDe(sesion.usuario.comercioId!);
      expect(guardado?.['estado']).toBe('pendiente');
    });

    /** Multi-tenant: la sesión de un comercio no alcanza el panel de otro. */
    it('no debería ver el panel de administración de la plataforma', async () => {
      await autorizado('get', '/comercios').expect(403);
    });

    it('no debería poder registrar comercios sueltos como si fuera admin', async () => {
      await autorizado('post', '/comercios')
        .send({ razonSocial: 'Otra SL', vatNumber: 'B11111111', nombreComercial: 'Otra' })
        .expect(403);
    });

    it('no debería poder vincular un segundo negocio a la misma cuenta', async () => {
      await autorizado('post', '/comercios/onboarding')
        .send({ razonSocial: 'Segunda SL', vatNumber: 'B22222222', nombreComercial: 'Segunda' })
        .expect(409);
    });
  });

  // ── 6. Onboarding: cuenta de comercio sin negocio ───────────────────────

  describe('onboarding de una cuenta sin negocio', () => {
    /**
     * Deja una cuenta con rol de comercio y **sin** `comercioId`, que es como
     * quedan las que se vincularon mal o las que crea la plataforma a mano.
     */
    async function cuentaSinComercio(): Promise<string> {
      await altaCompleta();
      await e2e.conexion
        .collection('usuarios')
        .updateOne({ email: alta.email }, { $unset: { comercioId: '' } });
      await e2e.conexion.collection('comercios').deleteMany({});

      // Hay que volver a entrar: el token del alta lleva el `comercioId` viejo.
      const res = await request(servidor())
        .post(ruta('/auth/login'))
        .send({ email: alta.email, password: alta.password })
        .expect(200);
      return res.body.accessToken;
    }

    it('debería crear el negocio y devolver una sesión ya vinculada', async () => {
      const token = await cuentaSinComercio();

      const res = await request(servidor())
        .post(ruta('/comercios/onboarding'))
        .set('Authorization', `Bearer ${token}`)
        .send({ razonSocial: 'Royal Dog SL', vatNumber: 'B55555555', nombreComercial: 'Royal Dog' })
        .expect(201);

      expect(res.body.usuario.comercioId).toBeDefined();
      // El token nuevo es imprescindible: el anterior no lleva `comercioId` y
      // los guards del panel lo leen de ahí.
      expect(res.body.accessToken).toBeDefined();
      expect(res.body.accessToken).not.toBe(token);
    });

    it('debería dejar el negocio pendiente de aprobación, como el alta rápida', async () => {
      const token = await cuentaSinComercio();

      await request(servidor())
        .post(ruta('/comercios/onboarding'))
        .set('Authorization', `Bearer ${token}`)
        .send({ razonSocial: 'Royal Dog SL', vatNumber: 'B55555555', nombreComercial: 'Royal Dog' })
        .expect(201);

      const comercio = await e2e.conexion.collection('comercios').findOne({});
      expect(comercio?.['estado']).toBe('pendiente');
    });

    it('debería exigir razón social, identificador fiscal y nombre comercial', async () => {
      const token = await cuentaSinComercio();

      await request(servidor())
        .post(ruta('/comercios/onboarding'))
        .set('Authorization', `Bearer ${token}`)
        .send({ nombreComercial: 'Royal Dog' })
        .expect(400);
    });

    it('debería rechazarlo sin sesión', async () => {
      await request(servidor())
        .post(ruta('/comercios/onboarding'))
        .send({ razonSocial: 'Royal Dog SL', vatNumber: 'B55555555', nombreComercial: 'Royal Dog' })
        .expect(401);
    });
  });

  // ── 7. Aprobación por la plataforma ─────────────────────────────────────

  describe('aprobación del negocio', () => {
    /** Crea un administrador de plataforma verificado y devuelve su sesión. */
    async function sesionAdmin(): Promise<string> {
      const datos = { nombre: 'Admin', email: 'admin@doogking.com', password: 'Segura123!' };
      await request(servidor()).post(ruta('/auth/registro')).send(datos).expect(201);
      await e2e.conexion
        .collection('usuarios')
        .updateOne({ email: datos.email }, { $set: { rol: Rol.ADMIN } });
      await request(servidor())
        .post(ruta('/auth/verificar-email'))
        .send({ token: await tokenDeVerificacion(datos.email) })
        .expect(200);

      const res = await request(servidor())
        .post(ruta('/auth/login'))
        .send({ email: datos.email, password: datos.password })
        .expect(200);
      return res.body.accessToken;
    }

    it('debería pasar a activo cuando la plataforma lo aprueba', async () => {
      const comercio = await altaCompleta();
      const token = await sesionAdmin();

      await request(servidor())
        .patch(ruta(`/comercios/${comercio.usuario.comercioId}/estado`))
        .set('Authorization', `Bearer ${token}`)
        .send({ estado: 'activo' })
        .expect(200);

      const guardado = await comercioDe(comercio.usuario.comercioId!);
      expect(guardado?.['estado']).toBe('activo');
    });

    it('debería aparecer en el listado de pendientes de la plataforma', async () => {
      await altaCompleta();
      const token = await sesionAdmin();

      const res = await request(servidor())
        .get(ruta('/comercios?estado=pendiente'))
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(res.body).toHaveLength(1);
      expect(res.body[0].nombreComercial).toBe('Negocio de Ana Torres');
    });
  });
});
