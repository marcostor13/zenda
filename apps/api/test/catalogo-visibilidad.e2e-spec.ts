// `import * as` y no import por defecto: el API compila a CommonJS y tiene
// `allowSyntheticDefaultImports` pero no `esModuleInterop`, así que el import
// por defecto se emite como `supertest_1.default` y queda `undefined` en runtime.
import * as request from 'supertest';
import { Rol, VerticalKey } from 'shared';
import { crearAppE2E, ruta, type AppE2E } from './utils/app-e2e';

/**
 * E2E de la visibilidad del catálogo: **qué hace falta para que un listado
 * salga en la búsqueda de la web, y qué lo saca de ella**.
 *
 * Se escribe a raíz del reporte del cliente del 10-09-2026 —«hay negocios ya
 * aprobados que no aparecen en la búsqueda»—, cuya causa era que el buscador no
 * consulta el estado del comercio: filtra por `comercioActivo`, una copia que
 * cada listado lleva encima (ver `Servicio.comercioActivo`; el porqué del índice
 * ESR está en CLAUDE.md §4.3). Aprobar un negocio por una vía que no propagaba
 * esa copia lo dejaba activo y con todos sus listados invisibles.
 *
 * Por eso las pruebas cruzan siempre las dos capas: aprueban por el camino que
 * usa el panel y **preguntan al buscador**, en vez de mirar el documento.
 */
describe('Visibilidad del catálogo (e2e)', () => {
  let e2e: AppE2E;
  const servidor = () => e2e.app.getHttpServer();

  const alta = {
    nombre: 'Ana Torres',
    email: 'ana@royaldog.eu',
    password: 'Segura123!',
    verticales: [VerticalKey.PELUQUERIA],
  };

  /**
   * Cinco fotos y capacidad declarada: es el mínimo para que un listado nazca
   * publicado y con plazas. Sin `capacidadSimultanea` el contador se queda a 0 y
   * la búsqueda lo descarta por no tener nada que reservar (ver
   * `catalog/disponibilidad.ts`), que es otro de los motivos por los que un
   * negocio aprobado puede no verse.
   */
  const servicio = {
    vertical: VerticalKey.PELUQUERIA,
    titulo: 'Royal Dog Spa',
    descripcion: 'Baño, corte y deslanado con productos hipoalergénicos.',
    ciudad: 'Valencia',
    precioBase: 35,
    imagenes: ['1.jpg', '2.jpg', '3.jpg', '4.jpg', '5.jpg'],
    extra: { capacidadSimultanea: 4, duracionSlotMin: 60 },
  };

  async function tokenDeVerificacion(email: string): Promise<string> {
    const usuario = await e2e.conexion
      .collection('usuarios')
      .findOne<{ verificacionToken?: string }>({ email });
    if (!usuario?.verificacionToken) throw new Error(`Sin token para ${email}`);
    return usuario.verificacionToken;
  }

  /** Comercio dado de alta y verificado; devuelve su sesión. */
  async function comercioVerificado(): Promise<{ token: string; comercioId: string }> {
    await request(servidor()).post(ruta('/comercios/registro')).send(alta).expect(201);
    const res = await request(servidor())
      .post(ruta('/auth/verificar-email'))
      .send({ token: await tokenDeVerificacion(alta.email) })
      .expect(200);
    return { token: res.body.accessToken, comercioId: res.body.usuario.comercioId };
  }

  /** Administrador de plataforma verificado; devuelve su sesión. */
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

  /**
   * Deja el negocio listo para publicar: cierra el alta guiada, que es lo que
   * permite que un listado nazca publicado en vez de en borrador.
   */
  async function cerrarAlta(token: string): Promise<void> {
    await request(servidor())
      .patch(ruta('/comercios/mi-comercio'))
      .set('Authorization', `Bearer ${token}`)
      .send({ altaCompletada: true })
      .expect(200);
  }

  async function crearServicio(token: string, datos = servicio): Promise<string> {
    const res = await request(servidor())
      .post(ruta('/catalog/servicios'))
      .set('Authorization', `Bearer ${token}`)
      .send(datos)
      .expect(201);
    return res.body.id;
  }

  /**
   * Lo que de verdad importa: qué devuelve el buscador público.
   *
   * Se acota a Valencia porque los seeders de cada categoría siembran sus
   * listados de demostración al arrancar el módulo, todos en Madrid: sin acotar,
   * la lista traería también los suyos y la prueba no distinguiría el listado
   * que acaba de crear del ruido de fondo.
   */
  async function loQueVeLaWeb(): Promise<string[]> {
    const res = await request(servidor())
      .get(ruta('/catalog/servicios?vertical=peluqueria&ciudad=Valencia'))
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

  // ── Lo que hace falta para salir ────────────────────────────────────────

  describe('para aparecer en la búsqueda', () => {
    it('no debería salir mientras el negocio está pendiente de aprobación', async () => {
      const { token } = await comercioVerificado();
      await cerrarAlta(token);
      await crearServicio(token);

      expect(await loQueVeLaWeb()).toEqual([]);
    });

    it('debería salir en cuanto la plataforma aprueba el negocio', async () => {
      const { token, comercioId } = await comercioVerificado();
      await cerrarAlta(token);
      await crearServicio(token);
      const admin = await sesionAdmin();

      await request(servidor())
        .patch(ruta(`/comercios/${comercioId}/estado`))
        .set('Authorization', `Bearer ${admin}`)
        .send({ estado: 'activo' })
        .expect(200);

      expect(await loQueVeLaWeb()).toEqual(['Royal Dog Spa']);
    });

    /**
     * El orden inverso: primero se aprueba el negocio y después publica. Aquí la
     * copia se fija al crear el listado, no al aprobar.
     */
    it('debería salir un listado creado cuando el negocio ya estaba aprobado', async () => {
      const { token, comercioId } = await comercioVerificado();
      const admin = await sesionAdmin();
      await request(servidor())
        .patch(ruta(`/comercios/${comercioId}/estado`))
        .set('Authorization', `Bearer ${admin}`)
        .send({ estado: 'activo' })
        .expect(200);

      await cerrarAlta(token);
      await crearServicio(token);

      expect(await loQueVeLaWeb()).toEqual(['Royal Dog Spa']);
    });

    /**
     * Tercer motivo por el que un negocio aprobado puede no verse, y el menos
     * evidente: la búsqueda descarta por defecto lo que no se puede reservar
     * (`soloDisponibles`). Un listado sin capacidad declarada tiene el contador
     * a 0 y desaparece, aunque el panel lo muestre publicado.
     */
    it('no debería salir un listado publicado pero sin plazas que ofrecer', async () => {
      const { token, comercioId } = await comercioVerificado();
      await cerrarAlta(token);
      const { extra: _sinCapacidad, ...sinPlazas } = servicio;
      await crearServicio(token, sinPlazas as typeof servicio);
      const admin = await sesionAdmin();
      await request(servidor())
        .patch(ruta(`/comercios/${comercioId}/estado`))
        .set('Authorization', `Bearer ${admin}`)
        .send({ estado: 'activo' })
        .expect(200);

      const guardado = await e2e.conexion.collection('servicios').findOne({ titulo: 'Royal Dog Spa' });
      expect(guardado?.['estado']).toBe('publicado');
      expect(guardado?.['comercioActivo']).toBe(true);
      // Publicado y aprobado, y aun así invisible: no hay nada que reservar.
      expect(await loQueVeLaWeb()).toEqual([]);
    });

    it('debería salir en cuanto se pide el catálogo completo, sin filtrar por disponibilidad', async () => {
      const { token, comercioId } = await comercioVerificado();
      await cerrarAlta(token);
      const { extra: _sinCapacidad, ...sinPlazas } = servicio;
      await crearServicio(token, sinPlazas as typeof servicio);
      const admin = await sesionAdmin();
      await request(servidor())
        .patch(ruta(`/comercios/${comercioId}/estado`))
        .set('Authorization', `Bearer ${admin}`)
        .send({ estado: 'activo' })
        .expect(200);

      const res = await request(servidor())
        .get(ruta('/catalog/servicios?vertical=peluqueria&ciudad=Valencia&soloDisponibles=false'))
        .expect(200);

      expect((res.body.items as Array<{ nombre: string }>).map((x) => x.nombre)).toEqual(['Royal Dog Spa']);
    });

    /** Un listado en borrador no se ve aunque el negocio esté aprobado. */
    it('no debería salir un listado que se quedó en borrador', async () => {
      const { token, comercioId } = await comercioVerificado();
      await crearServicio(token); // sin cerrar el alta: nace en borrador
      const admin = await sesionAdmin();
      await request(servidor())
        .patch(ruta(`/comercios/${comercioId}/estado`))
        .set('Authorization', `Bearer ${admin}`)
        .send({ estado: 'activo' })
        .expect(200);

      expect(await loQueVeLaWeb()).toEqual([]);

      const guardado = await e2e.conexion.collection('servicios').findOne({});
      expect(guardado?.['estado']).toBe('borrador');
    });
  });

  // ── La regresión del cliente ────────────────────────────────────────────

  describe('aprobar desde la edición de la ficha (reporte del 10-09-2026)', () => {
    /**
     * El panel tiene dos formas de aprobar: el botón «Aprobar», que llama al
     * endpoint dedicado, y el desplegable «Estado» del formulario de edición,
     * que manda un `PATCH /admin/comercios/:id`. La segunda escribía el estado
     * con un `$set` junto al resto de los campos y no propagaba la copia que
     * mira el buscador: el negocio quedaba aprobado y sus listados invisibles.
     */
    async function negocioConListadoPendiente() {
      const { token, comercioId } = await comercioVerificado();
      await cerrarAlta(token);
      await crearServicio(token);
      return { comercioId, admin: await sesionAdmin() };
    }

    it('debería hacer visible el listado, igual que el botón de aprobar', async () => {
      const { comercioId, admin } = await negocioConListadoPendiente();

      await request(servidor())
        .patch(ruta(`/admin/comercios/${comercioId}`))
        .set('Authorization', `Bearer ${admin}`)
        .send({ nombreComercial: 'Royal Dog Spa', estado: 'activo' })
        .expect(200);

      expect(await loQueVeLaWeb()).toEqual(['Royal Dog Spa']);
    });

    it('debería dejar el negocio y sus listados diciendo lo mismo', async () => {
      const { comercioId, admin } = await negocioConListadoPendiente();

      await request(servidor())
        .patch(ruta(`/admin/comercios/${comercioId}`))
        .set('Authorization', `Bearer ${admin}`)
        .send({ estado: 'activo' })
        .expect(200);

      const comercio = await e2e.conexion.collection('comercios').findOne({});
      const listado = await e2e.conexion.collection('servicios').findOne({});
      expect(comercio?.['estado']).toBe('activo');
      expect(listado?.['comercioActivo']).toBe(true);
    });

    it('debería quedar registrado en la auditoría, como cualquier aprobación', async () => {
      const { comercioId, admin } = await negocioConListadoPendiente();

      await request(servidor())
        .patch(ruta(`/admin/comercios/${comercioId}`))
        .set('Authorization', `Bearer ${admin}`)
        .send({ estado: 'activo' })
        .expect(200);

      const registros = await e2e.conexion
        .collection('auditoria')
        .countDocuments({ entidadId: comercioId });
      expect(registros).toBeGreaterThan(0);
    });

    /** Suspender sin motivo no se cuela por esta puerta (TCK-8034). */
    it('debería exigir el motivo para suspender también desde la edición', async () => {
      const { comercioId, admin } = await negocioConListadoPendiente();
      await request(servidor())
        .patch(ruta(`/comercios/${comercioId}/estado`))
        .set('Authorization', `Bearer ${admin}`)
        .send({ estado: 'activo' })
        .expect(200);

      await request(servidor())
        .patch(ruta(`/admin/comercios/${comercioId}`))
        .set('Authorization', `Bearer ${admin}`)
        .send({ estado: 'suspendido' })
        .expect(400);
    });

    it('no debería tocar el estado al editar cualquier otro campo', async () => {
      const { comercioId, admin } = await negocioConListadoPendiente();
      await request(servidor())
        .patch(ruta(`/comercios/${comercioId}/estado`))
        .set('Authorization', `Bearer ${admin}`)
        .send({ estado: 'activo' })
        .expect(200);

      await request(servidor())
        .patch(ruta(`/admin/comercios/${comercioId}`))
        .set('Authorization', `Bearer ${admin}`)
        .send({ nombreComercial: 'Royal Dog Spa Valencia', estado: 'activo' })
        .expect(200);

      // Sigue visible: guardar la ficha no puede esconder el negocio.
      expect(await loQueVeLaWeb()).toEqual(['Royal Dog Spa']);
    });
  });

  // ── Lo que sí tiene que sacarlo de la búsqueda ──────────────────────────

  describe('al dejar de estar aprobado', () => {
    async function negocioVisible() {
      const { token, comercioId } = await comercioVerificado();
      await cerrarAlta(token);
      await crearServicio(token);
      const admin = await sesionAdmin();
      await request(servidor())
        .patch(ruta(`/comercios/${comercioId}/estado`))
        .set('Authorization', `Bearer ${admin}`)
        .send({ estado: 'activo' })
        .expect(200);
      expect(await loQueVeLaWeb()).toEqual(['Royal Dog Spa']);
      return { token, comercioId, admin };
    }

    it('debería desaparecer al suspender el negocio', async () => {
      const { comercioId, admin } = await negocioVisible();

      await request(servidor())
        .patch(ruta(`/comercios/${comercioId}/estado`))
        .set('Authorization', `Bearer ${admin}`)
        .send({ estado: 'suspendido', motivo: 'Documentación caducada' })
        .expect(200);

      expect(await loQueVeLaWeb()).toEqual([]);
    });

    it('debería desaparecer al suspenderlo desde la edición de la ficha', async () => {
      const { comercioId, admin } = await negocioVisible();

      await request(servidor())
        .patch(ruta(`/admin/comercios/${comercioId}`))
        .set('Authorization', `Bearer ${admin}`)
        .send({ estado: 'suspendido', motivo: 'Documentación caducada' })
        .expect(200);

      expect(await loQueVeLaWeb()).toEqual([]);
    });

    it('debería desaparecer al pausar la cuenta el propio comercio, y volver al reactivarla', async () => {
      const { token } = await negocioVisible();

      await request(servidor())
        .post(ruta('/comercios/mi-comercio/cuenta/pausar'))
        .set('Authorization', `Bearer ${token}`)
        .send({ motivo: 'pausa_temporada' })
        .expect(201);
      expect(await loQueVeLaWeb()).toEqual([]);

      await request(servidor())
        .post(ruta('/comercios/mi-comercio/cuenta/reactivar'))
        .set('Authorization', `Bearer ${token}`)
        .expect(201);
      expect(await loQueVeLaWeb()).toEqual(['Royal Dog Spa']);
    });

    it('debería volver a salir si se aprueba de nuevo', async () => {
      const { comercioId, admin } = await negocioVisible();
      await request(servidor())
        .patch(ruta(`/comercios/${comercioId}/estado`))
        .set('Authorization', `Bearer ${admin}`)
        .send({ estado: 'suspendido', motivo: 'Revisión' })
        .expect(200);

      await request(servidor())
        .patch(ruta(`/comercios/${comercioId}/estado`))
        .set('Authorization', `Bearer ${admin}`)
        .send({ estado: 'activo' })
        .expect(200);

      expect(await loQueVeLaWeb()).toEqual(['Royal Dog Spa']);
    });
  });
});
