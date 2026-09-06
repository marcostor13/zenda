// `import * as` y no import por defecto: ver la nota de auth.e2e-spec.ts.
import { PermisoAdmin, ReservaEstado, Rol } from 'shared';
import { crearAppE2E, ruta, type AppE2E } from './utils/app-e2e';
import {
  api,
  como,
  PASSWORD_E2E,
  sembrarComercio,
  sembrarCuenta,
  sembrarReserva,
  type ComercioSembrado,
  type CuentaSembrada,
} from './utils/admin-e2e';

/**
 * E2E de la gestión de cuentas desde el panel admin.
 *
 * El foco no está en el CRUD —eso lo cubren los unitarios— sino en las tres
 * formas de romper la plataforma desde esta pantalla: escalar privilegios,
 * quedarse sin administradores y borrar una cuenta que sostiene un historial.
 */
describe('Gestión de usuarios desde el panel admin (e2e)', () => {
  let e2e: AppE2E;
  let superadmin: CuentaSembrada;
  let comercio: ComercioSembrado;

  beforeAll(async () => {
    e2e = await crearAppE2E();
  }, 180_000);

  afterAll(async () => {
    await e2e.cerrar();
  });

  beforeEach(async () => {
    await e2e.limpiarBaseDeDatos();
    superadmin = await sembrarCuenta(e2e, Rol.ADMIN, { email: 'jefe@doogking.test' });
    comercio = await sembrarComercio(e2e);
  });

  describe('alta de cuentas', () => {
    it('debería crear un cliente con la contraseña cifrada', async () => {
      const { body } = await api(e2e)
        .post(ruta('/admin/usuarios'))
        .set(como(superadmin.token))
        .send({ nombre: 'Ana Ruiz', email: 'Ana@Doogking.test', password: PASSWORD_E2E })
        .expect(201);

      expect(body.rol).toBe(Rol.CLIENTE);
      // El email se normaliza a minúsculas: si no, la misma persona podría
      // registrarse dos veces cambiando una mayúscula.
      expect(body.email).toBe('ana@doogking.test');
      expect(body.passwordHash).not.toBe(PASSWORD_E2E);
    });

    it('debería exigir comercio al crear una cuenta de comercio', async () => {
      // Un `comercio_admin` sin `comercioId` no puede gestionar nada: entra al
      // panel del comercio y no hay comercio detrás.
      await api(e2e)
        .post(ruta('/admin/usuarios'))
        .set(como(superadmin.token))
        .send({
          nombre: 'Sin negocio',
          email: 'huerfano@doogking.test',
          password: PASSWORD_E2E,
          rol: Rol.COMERCIO_ADMIN,
        })
        .expect(400);
    });

    it('debería rechazar un email que ya existe con un error entendible', async () => {
      // El panel enseña el mensaje del API; un 500 le dice al operador que el
      // sistema se rompió cuando lo único que pasa es que ese email ya está.
      const res = await api(e2e)
        .post(ruta('/admin/usuarios'))
        .set(como(superadmin.token))
        .send({ nombre: 'Duplicado', email: superadmin.email, password: PASSWORD_E2E });

      expect(res.status).toBe(409);
      expect(String(res.body.message)).toMatch(/email/i);
    });
  });

  describe('edición de cuentas', () => {
    it('debería guardar el rol y los permisos de área', async () => {
      const cuenta = await sembrarCuenta(e2e, Rol.CLIENTE);

      const { body } = await api(e2e)
        .patch(ruta(`/admin/usuarios/${cuenta.id.toString()}`))
        .set(como(superadmin.token))
        .send({ rol: Rol.ADMIN, permisosAdmin: [PermisoAdmin.SOPORTE] })
        .expect(200);

      expect(body.rol).toBe(Rol.ADMIN);
      expect(body.permisosAdmin).toEqual([PermisoAdmin.SOPORTE]);
    });

    it('no debería dejar que un admin acotado se amplíe sus propias áreas', async () => {
      // Con el área de usuarios se gestionan cuentas ajenas; ampliarse las
      // propias convierte cualquier permiso en todos los permisos.
      const acotado = await sembrarCuenta(e2e, Rol.ADMIN, {
        permisosAdmin: [PermisoAdmin.USUARIOS],
      });

      await api(e2e)
        .patch(ruta(`/admin/usuarios/${acotado.id.toString()}`))
        .set(como(acotado.token))
        .send({ permisosAdmin: [] })
        .expect(403);

      const enBd = await e2e.conexion.collection('usuarios').findOne({ _id: acotado.id });
      expect(enBd!['permisosAdmin']).toEqual([PermisoAdmin.USUARIOS]);
    });

    it('debería dejar que otro admin le cambie las áreas', async () => {
      // El contrapunto: la restricción es sobre uno mismo, no sobre el área.
      const acotado = await sembrarCuenta(e2e, Rol.ADMIN, {
        permisosAdmin: [PermisoAdmin.USUARIOS],
      });

      await api(e2e)
        .patch(ruta(`/admin/usuarios/${acotado.id.toString()}`))
        .set(como(superadmin.token))
        .send({ permisosAdmin: [PermisoAdmin.USUARIOS, PermisoAdmin.FINANZAS] })
        .expect(200);
    });

    it('debería registrar en auditoría quién cambió la cuenta', async () => {
      const cuenta = await sembrarCuenta(e2e, Rol.CLIENTE);

      await api(e2e)
        .patch(ruta(`/admin/usuarios/${cuenta.id.toString()}`))
        .set(como(superadmin.token))
        .send({ verificado: true })
        .expect(200);

      const registro = await e2e.conexion
        .collection('auditoria')
        .findOne({ entidadId: cuenta.id.toString() });
      expect(String(registro!['actorId'])).toBe(superadmin.id.toString());
    });
  });

  describe('baja de cuentas', () => {
    it('debería dar de baja sin borrar, dejando la cuenta restaurable', async () => {
      const cuenta = await sembrarCuenta(e2e, Rol.CLIENTE);

      const { body } = await api(e2e)
        .delete(ruta(`/admin/usuarios/${cuenta.id.toString()}`))
        .set(como(superadmin.token))
        .send({ motivo: 'lo pidió el cliente' })
        .expect(200);

      expect(body.purgado).toBe(false);
      expect(body.restaurableHasta).toBeDefined();

      const enBd = await e2e.conexion.collection('usuarios').findOne({ _id: cuenta.id });
      expect(enBd!['activo']).toBe(false);
      expect(enBd!['eliminadoAt']).toBeDefined();
    });

    it('debería cortar la sesión abierta de la cuenta dada de baja', async () => {
      // El token sigue siendo válido criptográficamente: si nadie mira el flag,
      // la cuenta cerrada sigue operando con la sesión que ya tenía.
      const cuenta = await sembrarCuenta(e2e, Rol.CLIENTE);

      await api(e2e)
        .delete(ruta(`/admin/usuarios/${cuenta.id.toString()}`))
        .set(como(superadmin.token)).send({}).expect(200);

      await api(e2e).get(ruta('/reservas/mis')).set(como(cuenta.token)).expect(401);
    });

    it('debería devolver el acceso al restaurarla dentro del periodo de gracia', async () => {
      const cuenta = await sembrarCuenta(e2e, Rol.CLIENTE);
      await api(e2e)
        .delete(ruta(`/admin/usuarios/${cuenta.id.toString()}`))
        .set(como(superadmin.token)).send({}).expect(200);

      await api(e2e)
        .post(ruta(`/admin/usuarios/${cuenta.id.toString()}/restaurar`))
        .set(como(superadmin.token)).expect(201);

      const enBd = await e2e.conexion.collection('usuarios').findOne({ _id: cuenta.id });
      expect(enBd!['activo']).toBe(true);
      expect(enBd!['eliminadoAt']).toBeUndefined();
    });

    it('debería sacar del listado normal las cuentas dadas de baja', async () => {
      const cuenta = await sembrarCuenta(e2e, Rol.CLIENTE);
      await api(e2e)
        .delete(ruta(`/admin/usuarios/${cuenta.id.toString()}`))
        .set(como(superadmin.token)).send({}).expect(200);

      const normal = await api(e2e)
        .get(ruta('/admin/usuarios')).set(como(superadmin.token)).expect(200);
      expect(normal.body.items.map((u: { _id: string }) => u._id))
        .not.toContain(cuenta.id.toString());

      const bajas = await api(e2e)
        .get(ruta('/admin/usuarios?bajas=true')).set(como(superadmin.token)).expect(200);
      expect(bajas.body.items.map((u: { _id: string }) => u._id))
        .toContain(cuenta.id.toString());
    });

    it('debería borrar de verdad al purgar una cuenta sin historial', async () => {
      const cuenta = await sembrarCuenta(e2e, Rol.CLIENTE);

      await api(e2e)
        .delete(ruta(`/admin/usuarios/${cuenta.id.toString()}`))
        .set(como(superadmin.token))
        .send({ purgar: true })
        .expect(200);

      expect(await e2e.conexion.collection('usuarios').countDocuments({ _id: cuenta.id })).toBe(0);
    });

    it('no debería purgar una cuenta con reservas en el historial del comercio', async () => {
      // Son facturación del comercio: no pueden evaporarse ni quedarse sin dueño.
      const cliente = await sembrarCuenta(e2e, Rol.CLIENTE);
      await sembrarReserva(e2e, {
        comercio, usuarioId: cliente.id, codigo: 'DK-USR-4', estado: ReservaEstado.COMPLETADA,
      });

      await api(e2e)
        .delete(ruta(`/admin/usuarios/${cliente.id.toString()}`))
        .set(como(superadmin.token))
        .send({ purgar: true })
        .expect(409);

      // La baja lógica sí, que es lo que conserva el historial.
      await api(e2e)
        .delete(ruta(`/admin/usuarios/${cliente.id.toString()}`))
        .set(como(superadmin.token)).send({}).expect(200);
    });

    it('no debería dejar a un admin borrarse a sí mismo', async () => {
      // Es la forma más fácil de quedarse fuera del panel sin poder volver.
      await api(e2e)
        .delete(ruta(`/admin/usuarios/${superadmin.id.toString()}`))
        .set(como(superadmin.token)).send({})
        .expect(409);

      expect(await e2e.conexion.collection('usuarios').countDocuments({ _id: superadmin.id })).toBe(1);
    });

    it('no debería dejar la plataforma sin ningún administrador', async () => {
      const otro = await sembrarCuenta(e2e, Rol.ADMIN, { email: 'segundo@doogking.test' });

      // Borrar al segundo se puede: queda uno.
      await api(e2e)
        .delete(ruta(`/admin/usuarios/${otro.id.toString()}`))
        .set(como(superadmin.token)).send({})
        .expect(200);

      // Bajarle el rol al último, no: dejaría el panel sin dueño.
      await api(e2e)
        .patch(ruta(`/admin/usuarios/${superadmin.id.toString()}`))
        .set(como(superadmin.token))
        .send({ rol: Rol.CLIENTE })
        .expect(409);
    });

    it('no debería borrar en seco a un cliente con reservas vivas', async () => {
      // La reserva se queda sin cliente: el panel deja de poder decir quién
      // reservó, y el comercio tiene a alguien esperando un servicio.
      const cliente = await sembrarCuenta(e2e, Rol.CLIENTE);
      await sembrarReserva(e2e, {
        comercio,
        usuarioId: cliente.id,
        codigo: 'DK-USR-1',
        estado: ReservaEstado.CONFIRMADA,
      });

      await api(e2e)
        .delete(ruta(`/admin/usuarios/${cliente.id.toString()}`))
        .set(como(superadmin.token)).send({})
        .expect(409);

      const enBd = await e2e.conexion.collection('usuarios').findOne({ _id: cliente.id });
      expect(enBd!['activo']).toBe(true);
    });

    it('debería dejar borrar a un cliente cuyo historial está cerrado', async () => {
      const cliente = await sembrarCuenta(e2e, Rol.CLIENTE);
      await sembrarReserva(e2e, {
        comercio,
        usuarioId: cliente.id,
        codigo: 'DK-USR-2',
        estado: ReservaEstado.COMPLETADA,
      });

      await api(e2e)
        .delete(ruta(`/admin/usuarios/${cliente.id.toString()}`))
        .set(como(superadmin.token)).send({})
        .expect(200);
    });
  });

  describe('la ficha del usuario', () => {
    it('debería resumir su actividad', async () => {
      const cliente = await sembrarCuenta(e2e, Rol.CLIENTE, { nombre: 'Ana Ruiz' });
      await sembrarReserva(e2e, {
        comercio,
        usuarioId: cliente.id,
        codigo: 'DK-USR-3',
        estado: ReservaEstado.COMPLETADA,
        conPagoAprobado: true,
      });

      const { body } = await api(e2e)
        .get(ruta(`/admin/usuarios/${cliente.id.toString()}/ficha`))
        .set(como(superadmin.token))
        .expect(200);

      expect(body.usuario.nombre).toBe('Ana Ruiz');
      expect(body.reservas).toHaveLength(1);
    });

    it('no debería filtrar el hash de la contraseña', async () => {
      const cliente = await sembrarCuenta(e2e, Rol.CLIENTE);

      const { body } = await api(e2e)
        .get(ruta(`/admin/usuarios/${cliente.id.toString()}/ficha`))
        .set(como(superadmin.token))
        .expect(200);

      expect(JSON.stringify(body)).not.toContain('passwordHash');
    });
  });
});
