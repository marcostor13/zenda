// `import * as` y no import por defecto: el API compila a CommonJS y tiene
// `allowSyntheticDefaultImports` pero no `esModuleInterop`.
import * as request from 'supertest';
import { Rol, VerticalKey } from 'shared';
import { crearAppE2E, ruta, type AppE2E } from './utils/app-e2e';

/**
 * E2E del buscador por población: **encontrar un comercio aunque su ciudad se
 * escriba de otra forma**.
 *
 * Sale del reporte del cliente: un negocio dado de alta como «villa-real» no
 * aparecía al buscar «Villareal». El buscador comparaba el texto tecleado con
 * el guardado, letra a letra, así que cualquier diferencia de tilde, guion o
 * lengua oficial devolvía cero resultados sobre un comercio que sí existe.
 *
 * Se prueba de punta a punta a propósito: el arreglo tiene dos mitades —lo que
 * se guarda al crear el listado y lo que se busca después—, y sólo cruzando las
 * dos se ve que encajan.
 */
describe('Buscador por población (e2e)', () => {
  let e2e: AppE2E;
  const servidor = () => e2e.app.getHttpServer();

  const alta = {
    nombre: 'Ana Torres',
    email: 'ana@royaldog.eu',
    password: 'Segura123!',
    verticales: [VerticalKey.PELUQUERIA],
  };

  const servicio = (ciudad: string) => ({
    vertical: VerticalKey.PELUQUERIA,
    titulo: 'Royal Dog Spa',
    descripcion: 'Baño, corte y deslanado con productos hipoalergénicos.',
    ciudad,
    precioBase: 35,
    imagenes: ['1.jpg', '2.jpg', '3.jpg', '4.jpg', '5.jpg'],
    extra: { capacidadSimultanea: 4, duracionSlotMin: 60 },
  });

  async function tokenDeVerificacion(email: string): Promise<string> {
    const usuario = await e2e.conexion
      .collection('usuarios')
      .findOne<{ verificacionToken?: string }>({ email });
    if (!usuario?.verificacionToken) throw new Error(`Sin token para ${email}`);
    return usuario.verificacionToken;
  }

  async function sesionAdmin(): Promise<string> {
    const datos = { nombre: 'Admin', email: 'admin@doogking.com', password: 'Segura123!' };
    await request(servidor()).post(ruta('/auth/registro')).send(datos).expect(201);
    await e2e.conexion.collection('usuarios').updateOne({ email: datos.email }, { $set: { rol: Rol.ADMIN } });
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

  /** Comercio aprobado con un listado publicado en la población indicada. */
  async function comercioPublicadoEn(ciudad: string): Promise<void> {
    await request(servidor()).post(ruta('/comercios/registro')).send(alta).expect(201);
    const sesion = await request(servidor())
      .post(ruta('/auth/verificar-email'))
      .send({ token: await tokenDeVerificacion(alta.email) })
      .expect(200);
    const token = sesion.body.accessToken as string;
    const comercioId = sesion.body.usuario.comercioId as string;

    await request(servidor())
      .patch(ruta('/comercios/mi-comercio'))
      .set('Authorization', `Bearer ${token}`)
      .send({ altaCompletada: true })
      .expect(200);

    await request(servidor())
      .post(ruta('/catalog/servicios'))
      .set('Authorization', `Bearer ${token}`)
      .send(servicio(ciudad))
      .expect(201);

    const admin = await sesionAdmin();
    await request(servidor())
      .patch(ruta(`/comercios/${comercioId}/estado`))
      .set('Authorization', `Bearer ${admin}`)
      .send({ estado: 'activo' })
      .expect(200);
  }

  /** Qué devuelve el buscador público para ese texto de población. */
  async function buscar(ciudad: string): Promise<string[]> {
    const res = await request(servidor())
      .get(ruta(`/catalog/servicios?vertical=peluqueria&ciudad=${encodeURIComponent(ciudad)}`))
      .expect(200);
    return (res.body.items as Array<{ nombre: string }>).map((s) => s.nombre);
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

  describe('el comercio dado de alta como «villa-real»', () => {
    beforeEach(async () => {
      await comercioPublicadoEn('villa-real');
    });

    it('debería guardarse con el nombre canónico y su provincia', async () => {
      const guardado = await e2e.conexion
        .collection('servicios')
        .findOne<{ ubicacion?: Record<string, string> }>({ titulo: 'Royal Dog Spa' });

      expect(guardado?.ubicacion).toEqual(expect.objectContaining({
        ciudad: 'Vila-real',
        ciudadNormalizada: 'vila real',
        ciudadClave: 'vilareal',
        provincia: 'Castellón',
      }));
    });

    it.each(['Villareal', 'Villarreal', 'Vila-real', 'vila real', 'VILLAREAL'])(
      'debería aparecer al buscar «%s»',
      async (consulta) => {
        expect(await buscar(consulta)).toEqual(['Royal Dog Spa']);
      },
    );

    it('no debería aparecer al buscar otra población', async () => {
      expect(await buscar('Castellón de la Plana')).toEqual([]);
    });
  });

  describe('otras formas de escribir la misma población', () => {
    it('debería encontrar «Málaga» escrito sin tilde', async () => {
      await comercioPublicadoEn('Málaga');

      expect(await buscar('malaga')).toEqual(['Royal Dog Spa']);
    });

    it('debería encontrar «Elche» por su nombre oficial en valenciano', async () => {
      await comercioPublicadoEn('Elx');

      expect(await buscar('Elche')).toEqual(['Royal Dog Spa']);
    });

    it('debería encontrar «A Coruña» escrito a la castellana', async () => {
      await comercioPublicadoEn('A Coruña');

      expect(await buscar('La Coruña')).toEqual(['Royal Dog Spa']);
    });

    it('debería tolerar una errata de una letra', async () => {
      await comercioPublicadoEn('Barcelona');

      expect(await buscar('Barcelna')).toEqual(['Royal Dog Spa']);
    });
  });

  describe('poblaciones que no están en el catálogo', () => {
    it('debería encontrarlas igualmente, sin tildes y con la caja cambiada', async () => {
      await comercioPublicadoEn('Riola');

      expect(await buscar('riola')).toEqual(['Royal Dog Spa']);
    });

    it('debería respetar el nombre tal y como lo escribió el comercio', async () => {
      await comercioPublicadoEn('Riola');

      const guardado = await e2e.conexion
        .collection('servicios')
        .findOne<{ ubicacion?: Record<string, string> }>({ titulo: 'Royal Dog Spa' });

      expect(guardado?.ubicacion?.ciudad).toBe('Riola');
    });

    it('no debería confundir poblaciones que sólo comparten el final', async () => {
      await comercioPublicadoEn('Talavera de la Reina');

      expect(await buscar('Vera')).toEqual([]);
    });
  });
});
