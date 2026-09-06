// `import * as` y no import por defecto: ver la nota de auth.e2e-spec.ts.
import { Types } from 'mongoose';
import { PermisoAdmin, ReservaEstado, Rol } from 'shared';
import { crearAppE2E, ruta, type AppE2E } from './utils/app-e2e';
import {
  api,
  como,
  sembrarComercio,
  sembrarCuenta,
  sembrarReserva,
  type ComercioSembrado,
  type CuentaSembrada,
} from './utils/admin-e2e';

/**
 * E2E de la **puerta del panel de administración**: quién entra y hasta dónde.
 *
 * Es la primera suite del rol porque todo lo demás cuelga de ella: si un
 * cliente puede tocar `/admin`, o si un administrador de marketing puede mover
 * dinero o crear cuentas de administrador, el resto de garantías del panel dan
 * igual. Se prueba sobre el sistema ensamblado a propósito: la cadena
 * `JwtAuthGuard → RolesGuard → PermisosAdminGuard` sólo existe montada, y los
 * unitarios de cada guard no ven los endpoints que se dejaron sin declarar.
 */
describe('Acceso y permisos del panel admin (e2e)', () => {
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
    // Sin `permisosAdmin` = superadministrador, que es como se comportaba el
    // panel antes de que existieran las áreas.
    superadmin = await sembrarCuenta(e2e, Rol.ADMIN, { email: 'jefe@doogking.test' });
    comercio = await sembrarComercio(e2e);
  });

  describe('quién puede entrar', () => {
    it('debería rechazar sin token', async () => {
      await api(e2e).get(ruta('/admin/dashboard')).expect(401);
    });

    it('debería rechazar a un cliente', async () => {
      const cliente = await sembrarCuenta(e2e, Rol.CLIENTE);

      await api(e2e).get(ruta('/admin/dashboard')).set(como(cliente.token)).expect(403);
    });

    it('debería rechazar al administrador de un comercio', async () => {
      // Es la escalada más apetecible: quien ya tiene panel propio intentando
      // asomarse al de la plataforma.
      const duenno = await sembrarCuenta(e2e, Rol.COMERCIO_ADMIN, {
        comercioId: comercio.comercioId,
      });

      await api(e2e).get(ruta('/admin/comercios')).set(como(duenno.token)).expect(403);
      await api(e2e).get(ruta('/admin/usuarios')).set(como(duenno.token)).expect(403);
      await api(e2e)
        .get(ruta('/admin/reportes/financiero?fechaDesde=2026-01-01&fechaHasta=2026-12-31'))
        .set(como(duenno.token))
        .expect(403);
    });

    it('debería dejar pasar al superadministrador a todas las áreas', async () => {
      await api(e2e).get(ruta('/admin/dashboard')).set(como(superadmin.token)).expect(200);
      await api(e2e).get(ruta('/admin/comercios')).set(como(superadmin.token)).expect(200);
      await api(e2e).get(ruta('/admin/usuarios')).set(como(superadmin.token)).expect(200);
      await api(e2e).get(ruta('/admin/pagos')).set(como(superadmin.token)).expect(200);
      await api(e2e).get(ruta('/admin/comisiones')).set(como(superadmin.token)).expect(200);
    });
  });

  describe('las áreas acotan de verdad', () => {
    it('debería dejar al admin de finanzas fuera de comercios y usuarios', async () => {
      const finanzas = await sembrarCuenta(e2e, Rol.ADMIN, {
        permisosAdmin: [PermisoAdmin.FINANZAS],
      });

      await api(e2e).get(ruta('/admin/pagos')).set(como(finanzas.token)).expect(200);
      await api(e2e)
        .get(ruta(`/admin/comercios/${comercio.comercioId.toString()}/ficha`))
        .set(como(finanzas.token))
        .expect(403);
      await api(e2e)
        .delete(ruta(`/admin/comercios/${comercio.comercioId.toString()}`))
        .set(como(finanzas.token))
        .send({ motivo: 'otro' })
        .expect(403);
    });

    it('debería dejar al admin de soporte ver fichas pero no operar sobre ellas', async () => {
      // Soporte necesita el contexto del caso; no necesita poder cerrar cuentas.
      const soporte = await sembrarCuenta(e2e, Rol.ADMIN, {
        permisosAdmin: [PermisoAdmin.SOPORTE],
      });

      await api(e2e)
        .get(ruta(`/admin/comercios/${comercio.comercioId.toString()}/ficha`))
        .set(como(soporte.token))
        .expect(200);
      await api(e2e)
        .patch(ruta(`/admin/comercios/${comercio.comercioId.toString()}`))
        .set(como(soporte.token))
        .send({ plan: 'premium' })
        .expect(403);
    });

    it('debería impedir que un admin de marketing toque la configuración de comisiones', async () => {
      const marketing = await sembrarCuenta(e2e, Rol.ADMIN, {
        permisosAdmin: [PermisoAdmin.MARKETING],
      });

      await api(e2e)
        .put(ruta('/admin/comisiones'))
        .set(como(marketing.token))
        .send({ vertical: 'veterinaria', comisionPct: 0.5 })
        .expect(403);
    });
  });

  /**
   * Lo que de verdad protege el permiso es la **escritura**. Un área sin su
   * `@PermisosAdmin` deja la puerta abierta a cualquier administrador, por
   * acotado que esté, y no se nota hasta que alguien la usa.
   */
  describe('ninguna escritura queda sin área declarada', () => {
    /** Administrador acotado a un área que no es la del endpoint que se prueba. */
    async function adminDeOtraArea(): Promise<CuentaSembrada> {
      return sembrarCuenta(e2e, Rol.ADMIN, { permisosAdmin: [PermisoAdmin.MARKETING] });
    }

    it('no debería dejar crear cuentas a un admin sin el área de usuarios', async () => {
      // Es la escalada de privilegios completa: crear un administrador sin
      // `permisosAdmin` es crear un superadministrador.
      const ajeno = await adminDeOtraArea();

      await api(e2e)
        .post(ruta('/admin/usuarios'))
        .set(como(ajeno.token))
        .send({
          nombre: 'Puerta trasera',
          email: 'puerta@doogking.test',
          password: 'contrasena-segura-8',
          rol: Rol.ADMIN,
        })
        .expect(403);

      const creado = await e2e.conexion
        .collection('usuarios')
        .findOne({ email: 'puerta@doogking.test' });
      expect(creado).toBeNull();
    });

    it('no debería dejar mover el estado de una reserva a un admin sin área financiera', async () => {
      // Cambiar el estado mueve dinero: reembolsar y liberar el pago viven aquí.
      const ajeno = await adminDeOtraArea();
      const cliente = await sembrarCuenta(e2e, Rol.CLIENTE);
      const reservaId = await sembrarReserva(e2e, {
        comercio,
        usuarioId: cliente.id,
        codigo: 'DK-PERM-1',
        estado: ReservaEstado.CONFIRMADA,
      });

      await api(e2e)
        .patch(ruta(`/admin/reservas/${reservaId.toString()}/estado`))
        .set(como(ajeno.token))
        .send({ estado: ReservaEstado.REEMBOLSADA, motivo: 'prueba' })
        .expect(403);
    });

    it('no debería dejar aprobar ni suspender comercios por la ruta antigua', async () => {
      // `PATCH /comercios/:id/estado` hace lo mismo que el panel de comercios;
      // si no exige el área, el permiso de `/admin/comercios` no protege nada.
      const ajeno = await adminDeOtraArea();

      await api(e2e)
        .patch(ruta(`/comercios/${comercio.comercioId.toString()}/estado`))
        .set(como(ajeno.token))
        .send({ estado: 'suspendido', motivo: 'prueba' })
        .expect(403);
    });

    it('no debería dejar registrar comercios por la ruta antigua', async () => {
      const ajeno = await adminDeOtraArea();

      await api(e2e)
        .post(ruta('/comercios'))
        .set(como(ajeno.token))
        .send({
          razonSocial: 'Colada SL',
          vatNumber: 'B99999999',
          nombreComercial: 'Colada',
          verticales: ['veterinaria'],
        })
        .expect(403);
    });

    it('debería dejar hacer todo eso al admin con el área correspondiente', async () => {
      // El contrapunto: el guard tiene que dejar trabajar a quien sí puede.
      const deComercios = await sembrarCuenta(e2e, Rol.ADMIN, {
        permisosAdmin: [PermisoAdmin.COMERCIOS],
      });
      const deUsuarios = await sembrarCuenta(e2e, Rol.ADMIN, {
        permisosAdmin: [PermisoAdmin.USUARIOS],
      });

      await api(e2e)
        .patch(ruta(`/comercios/${comercio.comercioId.toString()}/estado`))
        .set(como(deComercios.token))
        .send({ estado: 'suspendido', motivo: 'prueba' })
        .expect(200);

      await api(e2e)
        .post(ruta('/admin/usuarios'))
        .set(como(deUsuarios.token))
        .send({
          nombre: 'Alta legítima',
          email: 'alta@doogking.test',
          password: 'contrasena-segura-8',
        })
        .expect(201);
    });
  });

  describe('el rastro de auditoría', () => {
    it('debería registrar quién suspendió un comercio', async () => {
      // Sin actor, una suspensión es una decisión sin dueño.
      await api(e2e)
        .patch(ruta(`/comercios/${comercio.comercioId.toString()}/estado`))
        .set(como(superadmin.token))
        .send({ estado: 'suspendido', motivo: 'documentación caducada' })
        .expect(200);

      const registro = await e2e.conexion
        .collection('auditoria')
        .findOne({ entidadId: comercio.comercioId.toString() });

      expect(registro).not.toBeNull();
      expect(String(registro!['actorId'])).toBe(superadmin.id.toString());
    });
  });

  describe('identificadores mal formados', () => {
    it('no debería devolver 500 con un id que no es un ObjectId', async () => {
      // El panel construye estas rutas con lo que devuelve el listado, pero un
      // enlace viejo o pegado a mano no puede tumbar el API.
      const rutas = [
        '/admin/comercios/no-es-un-id/ficha',
        '/admin/comercios/no-es-un-id/impacto-baja',
        '/admin/usuarios/no-es-un-id/ficha',
      ];

      for (const camino of rutas) {
        const res = await api(e2e).get(ruta(camino)).set(como(superadmin.token));
        expect(res.status).toBeLessThan(500);
      }
    });

    it('debería devolver 404 con identificadores válidos que no existen', async () => {
      const inexistente = new Types.ObjectId().toString();

      await api(e2e)
        .get(ruta(`/admin/comercios/${inexistente}/ficha`))
        .set(como(superadmin.token))
        .expect(404);
      await api(e2e)
        .get(ruta(`/admin/usuarios/${inexistente}/ficha`))
        .set(como(superadmin.token))
        .expect(404);
    });
  });
});
