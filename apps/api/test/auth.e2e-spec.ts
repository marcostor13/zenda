// `import * as` y no import por defecto: el API compila a CommonJS y tiene
// `allowSyntheticDefaultImports` pero no `esModuleInterop`, así que el import
// por defecto se emite como `supertest_1.default` y queda `undefined` en runtime.
import * as request from 'supertest';
import { crearAppE2E, ruta, type AppE2E } from './utils/app-e2e';

/**
 * E2E de autenticación: el recorrido de entrada a la plataforma, contra el API
 * real y una Mongo en memoria. Es el primer flujo porque todo lo demás depende
 * de él: sin registro, verificación y login válidos, ningún otro E2E puede
 * autenticarse.
 *
 * El alta no es de un solo paso: `registro` deja la cuenta pendiente y **no**
 * devuelve token; hay que confirmar el email antes de poder entrar. El token de
 * verificación viaja por correo, así que aquí se lee de la base de datos, que es
 * el equivalente a abrir el enlace recibido.
 */
describe('Autenticación (e2e)', () => {
  let e2e: AppE2E;

  const cliente = {
    nombre: 'Ana Ruiz',
    email: 'ana@ruiz.com',
    password: 'Segura123!',
    telefono: '+34600000000',
  };

  /** Lee el token que el API acaba de guardar, como si se abriera el email. */
  async function tokenDeVerificacion(email: string): Promise<string> {
    const usuario = await e2e.conexion
      .collection('usuarios')
      .findOne<{ verificacionToken?: string }>({ email });
    if (!usuario?.verificacionToken) {
      throw new Error(`No se generó token de verificación para ${email}`);
    }
    return usuario.verificacionToken;
  }

  /** Alta completa: registro + verificación. Devuelve el token de sesión. */
  async function registrarYVerificar(datos = cliente): Promise<string> {
    await request(e2e.app.getHttpServer()).post(ruta('/auth/registro')).send(datos).expect(201);
    const res = await request(e2e.app.getHttpServer())
      .post(ruta('/auth/verificar-email'))
      .send({ token: await tokenDeVerificacion(datos.email) })
      .expect(200);
    return res.body.accessToken;
  }

  beforeAll(async () => {
    e2e = await crearAppE2E();
  });

  afterAll(async () => {
    await e2e.cerrar();
  });

  beforeEach(async () => {
    await e2e.limpiarBaseDeDatos();
  });

  describe('registro', () => {
    it('debería dejar la cuenta pendiente de verificar, sin entregar token', async () => {
      const res = await request(e2e.app.getHttpServer())
        .post(ruta('/auth/registro'))
        .send(cliente)
        .expect(201);

      expect(res.body).toEqual({ requiereVerificacion: true, email: cliente.email });
      // Un registro sin verificar no puede dar acceso.
      expect(res.body.accessToken).toBeUndefined();
    });

    it('nunca debería devolver la contraseña ni su hash', async () => {
      const res = await request(e2e.app.getHttpServer())
        .post(ruta('/auth/registro'))
        .send(cliente)
        .expect(201);

      const cuerpo = JSON.stringify(res.body);
      expect(cuerpo).not.toContain(cliente.password);
      expect(cuerpo).not.toContain('passwordHash');
    });

    it('debería rechazar con 409 un email ya registrado', async () => {
      await request(e2e.app.getHttpServer()).post(ruta('/auth/registro')).send(cliente).expect(201);

      await request(e2e.app.getHttpServer())
        .post(ruta('/auth/registro'))
        .send(cliente)
        .expect(409);
    });

    it('debería rechazar un email con formato inválido', async () => {
      await request(e2e.app.getHttpServer())
        .post(ruta('/auth/registro'))
        .send({ ...cliente, email: 'no-es-un-email' })
        .expect(400);
    });

    it('debería rechazar una contraseña más corta que el mínimo', async () => {
      await request(e2e.app.getHttpServer())
        .post(ruta('/auth/registro'))
        .send({ ...cliente, password: 'corta' })
        .expect(400);
    });

    it('debería rechazar campos no declarados en el DTO', async () => {
      // `forbidNonWhitelisted` está activo en el bootstrap: colar `rol` para
      // autoproclamarse admin tiene que fallar, no ignorarse en silencio.
      await request(e2e.app.getHttpServer())
        .post(ruta('/auth/registro'))
        .send({ ...cliente, rol: 'admin' })
        .expect(400);
    });
  });

  describe('verificación de email', () => {
    it('debería confirmar la cuenta y devolver un token de sesión', async () => {
      await request(e2e.app.getHttpServer()).post(ruta('/auth/registro')).send(cliente).expect(201);

      const res = await request(e2e.app.getHttpServer())
        .post(ruta('/auth/verificar-email'))
        .send({ token: await tokenDeVerificacion(cliente.email) })
        .expect(200);

      expect(res.body.accessToken).toEqual(expect.any(String));
      expect(res.body.usuario).toEqual(
        expect.objectContaining({ email: cliente.email, rol: 'cliente', verificado: true }),
      );
    });

    it('debería rechazar un token inventado', async () => {
      await request(e2e.app.getHttpServer())
        .post(ruta('/auth/verificar-email'))
        .send({ token: 'token-que-nadie-emitio' })
        .expect(400);
    });

    it('debería rechazar un token ya caducado', async () => {
      await request(e2e.app.getHttpServer()).post(ruta('/auth/registro')).send(cliente).expect(201);
      const token = await tokenDeVerificacion(cliente.email);
      await e2e.conexion
        .collection('usuarios')
        .updateOne({ email: cliente.email }, { $set: { verificacionExpira: new Date(Date.now() - 1000) } });

      await request(e2e.app.getHttpServer())
        .post(ruta('/auth/verificar-email'))
        .send({ token })
        .expect(400);
    });
  });

  describe('login', () => {
    it('debería bloquear con 403 mientras el email no esté verificado', async () => {
      await request(e2e.app.getHttpServer()).post(ruta('/auth/registro')).send(cliente).expect(201);

      await request(e2e.app.getHttpServer())
        .post(ruta('/auth/login'))
        .send({ email: cliente.email, password: cliente.password })
        .expect(403);
    });

    it('debería devolver un token tras verificar la cuenta', async () => {
      await registrarYVerificar();

      const res = await request(e2e.app.getHttpServer())
        .post(ruta('/auth/login'))
        .send({ email: cliente.email, password: cliente.password })
        .expect(200);

      expect(res.body.accessToken).toEqual(expect.any(String));
      expect(res.body.usuario.email).toBe(cliente.email);
    });

    it('debería rechazar una contraseña incorrecta', async () => {
      await registrarYVerificar();

      await request(e2e.app.getHttpServer())
        .post(ruta('/auth/login'))
        .send({ email: cliente.email, password: 'EquivocadaDelTodo1!' })
        .expect(401);
    });

    it('no debería distinguir "usuario inexistente" de "contraseña incorrecta"', async () => {
      // Mismo código y mismo mensaje en ambos casos: lo contrario permitiría
      // enumerar qué correos están dados de alta en la plataforma.
      await registrarYVerificar();

      const inexistente = await request(e2e.app.getHttpServer())
        .post(ruta('/auth/login'))
        .send({ email: 'nadie@doogking.com', password: cliente.password });
      const malaPassword = await request(e2e.app.getHttpServer())
        .post(ruta('/auth/login'))
        .send({ email: cliente.email, password: 'EquivocadaDelTodo1!' });

      expect(inexistente.status).toBe(401);
      expect(inexistente.status).toBe(malaPassword.status);
      expect(inexistente.body.message).toEqual(malaPassword.body.message);
    });

    it('debería impedir la entrada de una cuenta desactivada', async () => {
      await registrarYVerificar();
      await e2e.conexion
        .collection('usuarios')
        .updateOne({ email: cliente.email }, { $set: { activo: false } });

      await request(e2e.app.getHttpServer())
        .post(ruta('/auth/login'))
        .send({ email: cliente.email, password: cliente.password })
        .expect(403);
    });
  });

  describe('rutas protegidas', () => {
    it('debería rechazar el acceso sin token', async () => {
      await request(e2e.app.getHttpServer()).get(ruta('/perros/mis')).expect(401);
    });

    it('debería rechazar un token con firma inválida', async () => {
      await request(e2e.app.getHttpServer())
        .get(ruta('/perros/mis'))
        .set('Authorization', 'Bearer no.es.un.token')
        .expect(401);
    });

    it('debería permitir el acceso con el token de una cuenta verificada', async () => {
      const token = await registrarYVerificar();

      const res = await request(e2e.app.getHttpServer())
        .get(ruta('/perros/mis'))
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(res.body).toEqual([]);
    });
  });
});
