// `import * as` y no import por defecto: ver la nota de auth.e2e-spec.ts.
import { Types } from 'mongoose';
import { ReservaEstado, Rol } from 'shared';
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
 * E2E del ciclo de vida de la cuenta de un comercio desde el panel admin:
 * aprobación, suspensión, ficha, baja lógica, restauración y purga.
 *
 * Existe por dos fallos que ningún unitario cazaba porque viven en el
 * ensamblado (guards + controlador + servicio + Mongo): la purga de un comercio
 * de pruebas quedaba bloqueada por reservas vivas que nadie podía cancelar, y
 * la ficha se caía sin decir por qué. Cubre además la cascada de la baja, que
 * toca media docena de colecciones y sólo se puede comprobar de verdad contra
 * una base de datos.
 */
describe('Ciclo de vida del comercio desde el panel admin (e2e)', () => {
  let e2e: AppE2E;
  let admin: CuentaSembrada;
  let cliente: CuentaSembrada;

  beforeAll(async () => {
    e2e = await crearAppE2E();
  }, 180_000);

  afterAll(async () => {
    await e2e.cerrar();
  });

  beforeEach(async () => {
    await e2e.limpiarBaseDeDatos();
    admin = await sembrarCuenta(e2e, Rol.ADMIN, { email: 'jefe@doogking.test' });
    cliente = await sembrarCuenta(e2e, Rol.CLIENTE, { nombre: 'Ana Ruiz' });
  });

  /** Comercio con equipo y dos reservas: una viva y una cerrada. */
  async function comercioConHistorial(): Promise<ComercioSembrado> {
    const comercio = await sembrarComercio(e2e, { nombreComercial: 'Vet 1' });
    await sembrarCuenta(e2e, Rol.COMERCIO_ADMIN, { comercioId: comercio.comercioId });
    await sembrarReserva(e2e, {
      comercio, usuarioId: cliente.id, codigo: 'DK-VIVA', estado: ReservaEstado.PENDIENTE,
    });
    await sembrarReserva(e2e, {
      comercio, usuarioId: cliente.id, codigo: 'DK-CERRADA',
      estado: ReservaEstado.COMPLETADA, conPagoAprobado: true,
    });
    return comercio;
  }

  describe('aprobación y suspensión', () => {
    it('debería sacar del buscador los listados de un comercio suspendido', async () => {
      // El buscador filtra por el flag denormalizado del listado, no por el
      // estado del comercio: si no se propaga, suspender no oculta nada.
      const comercio = await sembrarComercio(e2e);

      await api(e2e)
        .patch(ruta(`/comercios/${comercio.comercioId.toString()}/estado`))
        .set(como(admin.token))
        .send({ estado: 'suspendido', motivo: 'documentación caducada' })
        .expect(200);

      const servicio = await e2e.conexion
        .collection('servicios').findOne({ _id: comercio.servicioId });
      expect(servicio!['comercioActivo']).toBe(false);
    });

    it('debería volver a publicarlos al reactivarlo', async () => {
      const comercio = await sembrarComercio(e2e, { estado: 'suspendido' });

      await api(e2e)
        .patch(ruta(`/comercios/${comercio.comercioId.toString()}/estado`))
        .set(como(admin.token))
        .send({ estado: 'activo' })
        .expect(200);

      const servicio = await e2e.conexion
        .collection('servicios').findOne({ _id: comercio.servicioId });
      expect(servicio!['comercioActivo']).toBe(true);
    });
  });

  describe('la ficha administrativa', () => {
    it('debería resumir servicios, reservas, equipo y facturación', async () => {
      const comercio = await comercioConHistorial();

      const { body } = await api(e2e)
        .get(ruta(`/admin/comercios/${comercio.comercioId.toString()}/ficha`))
        .set(como(admin.token)).expect(200);

      expect(body.comercio.nombreComercial).toBe('Vet 1');
      expect(body.resumen.servicios).toBe(1);
      expect(body.resumen.equipo).toBe(1);
      expect(body.reservas).toHaveLength(2);
      expect(body.resumen.facturacion).toBeGreaterThan(0);
    });

    it('debería cargar aunque el comercio no tenga razón social, CIF ni verticales', async () => {
      // Un comercio real creado antes de que esos campos fueran obligatorios.
      const id = new Types.ObjectId();
      await e2e.conexion.collection('comercios').insertOne({
        _id: id, nombreComercial: 'Comercio Antiguo', estado: 'activo',
      });

      const { body } = await api(e2e)
        .get(ruta(`/admin/comercios/${id.toString()}/ficha`))
        .set(como(admin.token)).expect(200);

      expect(body.comercio.nombreComercial).toBe('Comercio Antiguo');
      expect(body.reservas).toEqual([]);
    });

    it('debería cargar con datos heredados: vertical retirado y reservas sin importe', async () => {
      const id = new Types.ObjectId();
      await e2e.conexion.collection('comercios').insertOne({
        _id: id,
        nombreComercial: 'Paseos Antiguos',
        // 'cuidadores' se retiró del catálogo: el documento en Mongo lo conserva.
        verticales: ['cuidadores'],
        estado: 'activo',
      });
      await e2e.conexion.collection('reservas').insertOne({
        codigo: 'DK-LEGACY',
        usuarioId: cliente.id,
        comercioId: id,
        servicioId: new Types.ObjectId(),
        vertical: 'cuidadores',
        detalle: {},
        fechaInicio: null,
        estado: ReservaEstado.COMPLETADA,
      });
      await e2e.conexion.collection('resenas').insertOne({
        comercioId: id, usuarioId: cliente.id, servicioId: new Types.ObjectId(), puntuacion: 4,
      });
      await e2e.conexion.collection('incidencias').insertOne({ comercioId: id, tipo: 'otra' });

      const { body } = await api(e2e)
        .get(ruta(`/admin/comercios/${id.toString()}/ficha`))
        .set(como(admin.token)).expect(200);

      expect(body.resumen.resenas).toBe(1);
      expect(body.resumen.incidencias).toBe(1);
      expect(body.reservas).toHaveLength(1);
    });
  });

  describe('el impacto que se enseña antes de decidir', () => {
    it('debería contar lo que se lleva por delante y nombrar lo que bloquea', async () => {
      const comercio = await comercioConHistorial();

      const { body } = await api(e2e)
        .get(ruta(`/admin/comercios/${comercio.comercioId.toString()}/impacto-baja`))
        .set(como(admin.token)).expect(200);

      expect(body.servicios).toBe(1);
      expect(body.serviciosPublicados).toBe(1);
      expect(body.usuarios).toBe(1);
      expect(body.reservas).toBe(2);
      expect(body.reservasActivas).toBe(1);
      expect(body.puedeDarseDeBaja).toBe(false);
      // Sin los códigos, "hay 1 reserva en curso" no lleva a ninguna parte.
      expect(body.reservasBloqueantes).toEqual([
        expect.objectContaining({ codigo: 'DK-VIVA', estado: ReservaEstado.PENDIENTE }),
      ]);
    });
  });

  describe('la baja lógica', () => {
    it('debería bloquearse mientras queden reservas vivas', async () => {
      const comercio = await comercioConHistorial();

      const res = await api(e2e)
        .delete(ruta(`/admin/comercios/${comercio.comercioId.toString()}`))
        .set(como(admin.token))
        .send({ motivo: 'pocas_reservas' });

      expect(res.status).toBe(409);
      expect(String(res.body.message)).toContain('DK-VIVA');
    });

    it('debería desbloquearse en cuanto el admin cancela la reserva que la traba', async () => {
      // Es el camino que el propio mensaje de error le pide al operador; si no
      // existe desde el panel, la cuenta se queda atrapada para siempre.
      const comercio = await comercioConHistorial();
      const viva = await e2e.conexion.collection('reservas').findOne({ codigo: 'DK-VIVA' });

      await api(e2e)
        .patch(ruta(`/admin/reservas/${String(viva!['_id'])}/estado`))
        .set(como(admin.token))
        .send({ estado: ReservaEstado.CANCELADA, motivo: 'cierre de la cuenta del comercio' })
        .expect(200);

      const { body } = await api(e2e)
        .get(ruta(`/admin/comercios/${comercio.comercioId.toString()}/impacto-baja`))
        .set(como(admin.token)).expect(200);
      expect(body.puedeDarseDeBaja).toBe(true);

      await api(e2e)
        .delete(ruta(`/admin/comercios/${comercio.comercioId.toString()}`))
        .set(como(admin.token))
        .send({ motivo: 'pocas_reservas' })
        .expect(200);
    });

    it('debería despublicar listados, cortar el acceso del equipo y conservar el historial', async () => {
      const comercio = await sembrarComercio(e2e, { nombreComercial: 'Vet 2' });
      const staff = await sembrarCuenta(e2e, Rol.COMERCIO_ADMIN, {
        comercioId: comercio.comercioId,
      });
      await sembrarReserva(e2e, {
        comercio, usuarioId: cliente.id, codigo: 'DK-HIST', estado: ReservaEstado.COMPLETADA,
      });

      const { body } = await api(e2e)
        .delete(ruta(`/admin/comercios/${comercio.comercioId.toString()}`))
        .set(como(admin.token))
        .send({ motivo: 'cierre_negocio' })
        .expect(200);

      expect(body.purgado).toBe(false);
      expect(body.restaurableHasta).toBeDefined();

      const enBd = await e2e.conexion
        .collection('comercios').findOne({ _id: comercio.comercioId });
      expect(enBd!['estado']).toBe('eliminado');

      const servicio = await e2e.conexion
        .collection('servicios').findOne({ _id: comercio.servicioId });
      expect(servicio!['estado']).toBe('pausado');
      expect(servicio!['comercioActivo']).toBe(false);

      const cuenta = await e2e.conexion.collection('usuarios').findOne({ _id: staff.id });
      expect(cuenta!['activo']).toBe(false);

      // La contabilidad se conserva: es lo que distingue la baja de la purga.
      expect(await e2e.conexion.collection('reservas')
        .countDocuments({ comercioId: comercio.comercioId })).toBe(1);
    });

    it('debería invalidar la sesión abierta del equipo, no sólo marcar un flag', async () => {
      // El token sigue siendo criptográficamente válido después de la baja: si
      // nadie mira el flag al validarlo, el equipo sigue operando con la sesión
      // que ya tenía abierta. Por eso se comprueba con el token de antes.
      const comercio = await sembrarComercio(e2e);
      const staff = await sembrarCuenta(e2e, Rol.COMERCIO_ADMIN, {
        comercioId: comercio.comercioId,
      });

      await api(e2e)
        .delete(ruta(`/admin/comercios/${comercio.comercioId.toString()}`))
        .set(como(admin.token))
        .send({ motivo: 'cierre_negocio' })
        .expect(200);

      await api(e2e)
        .get(ruta('/comercios/mi-comercio'))
        .set(como(staff.token))
        .expect(401);
    });

    it('debería devolver la cuenta en pausa al restaurarla', async () => {
      // Nunca directamente publicada: alguien tiene que revisarla antes de que
      // sus listados vuelvan al buscador.
      const comercio = await sembrarComercio(e2e);
      await api(e2e)
        .delete(ruta(`/admin/comercios/${comercio.comercioId.toString()}`))
        .set(como(admin.token))
        .send({ motivo: 'cierre_negocio' })
        .expect(200);

      const { body } = await api(e2e)
        .post(ruta(`/admin/comercios/${comercio.comercioId.toString()}/restaurar`))
        .set(como(admin.token)).expect(201);

      expect(body.estado).toBe('inactivo');
    });

    it('debería tratar como inexistente un comercio ya dado de baja', async () => {
      const comercio = await sembrarComercio(e2e);
      await api(e2e)
        .delete(ruta(`/admin/comercios/${comercio.comercioId.toString()}`))
        .set(como(admin.token))
        .send({ motivo: 'cierre_negocio' })
        .expect(200);

      await api(e2e)
        .delete(ruta(`/admin/comercios/${comercio.comercioId.toString()}`))
        .set(como(admin.token))
        .send({ motivo: 'cierre_negocio' })
        .expect(404);
    });
  });

  describe('la purga', () => {
    it('no debería bloquearse por reservas vivas: se las lleva con ella', async () => {
      // Es la vía para limpiar datos de prueba. Aplicarle el bloqueo de la baja
      // lógica la dejaba atrapada por una reserva que nadie podía resolver.
      const comercio = await comercioConHistorial();

      await api(e2e)
        .delete(ruta(`/admin/comercios/${comercio.comercioId.toString()}`))
        .set(como(admin.token))
        .send({ motivo: 'pocas_reservas', purgar: true })
        .expect(200);

      expect(await e2e.conexion.collection('comercios')
        .countDocuments({ _id: comercio.comercioId })).toBe(0);
      expect(await e2e.conexion.collection('reservas')
        .countDocuments({ comercioId: comercio.comercioId })).toBe(0);
    });

    it('debería arrastrar pagos, listados y cuentas del equipo', async () => {
      const comercio = await comercioConHistorial();

      await api(e2e)
        .delete(ruta(`/admin/comercios/${comercio.comercioId.toString()}`))
        .set(como(admin.token))
        .send({ motivo: 'pocas_reservas', purgar: true })
        .expect(200);

      expect(await e2e.conexion.collection('servicios')
        .countDocuments({ comercioId: comercio.comercioId })).toBe(0);
      expect(await e2e.conexion.collection('usuarios')
        .countDocuments({ comercioId: comercio.comercioId })).toBe(0);
      expect(await e2e.conexion.collection('pagos').countDocuments({})).toBe(0);
      // El cliente no es del comercio: su cuenta se queda.
      expect(await e2e.conexion.collection('usuarios')
        .countDocuments({ _id: cliente.id })).toBe(1);
    });
  });
});
