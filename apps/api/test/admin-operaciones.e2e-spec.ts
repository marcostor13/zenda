// `import * as` y no import por defecto: ver la nota de auth.e2e-spec.ts.
import { PermisoAdmin, ReservaEstado, Rol, VerticalKey } from 'shared';
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

/** El PUT de comisiones reemplaza la configuración entera del vertical. */
const COMISION_BASE = (comisionPct: number) => ({
  vertical: VerticalKey.VETERINARIA,
  comisionPct,
  stripePct: 0.029,
  stripeFijoEur: 0.25,
  activo: true,
});

/** Rango que cubre cualquier siembra hecha "ahora". */
const RANGO = 'fechaDesde=2020-01-01&fechaHasta=2100-01-01';

/**
 * E2E del día a día del administrador: el centro de reservas, el informe
 * financiero y la configuración de comisiones.
 *
 * Se prueban juntos porque comparten los mismos datos y porque el valor está
 * justo en la costura: lo que el admin hace en el centro de reservas tiene que
 * verse reflejado —al céntimo— en el informe que usa para cobrar.
 */
describe('Operaciones del panel admin (e2e)', () => {
  let e2e: AppE2E;
  let admin: CuentaSembrada;
  let cliente: CuentaSembrada;
  let comercio: ComercioSembrado;

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
    comercio = await sembrarComercio(e2e, { nombreComercial: 'Clínica Royal' });
  });

  describe('el centro de reservas', () => {
    it('debería filtrar por estado, por comercio y por lo que se escriba en el buscador', async () => {
      await sembrarReserva(e2e, {
        comercio, usuarioId: cliente.id, codigo: 'DK-AAA', estado: ReservaEstado.CONFIRMADA,
      });
      await sembrarReserva(e2e, {
        comercio, usuarioId: cliente.id, codigo: 'DK-BBB', estado: ReservaEstado.CANCELADA,
      });
      const otro = await sembrarComercio(e2e, { nombreComercial: 'Peluquería Luna' });
      await sembrarReserva(e2e, {
        comercio: otro, usuarioId: cliente.id, codigo: 'DK-CCC', estado: ReservaEstado.CONFIRMADA,
      });

      const porEstado = await api(e2e)
        .get(ruta('/admin/reservas?estado=confirmada'))
        .set(como(admin.token)).expect(200);
      expect(porEstado.body.total).toBe(2);

      const porComercio = await api(e2e)
        .get(ruta(`/admin/reservas?comercioId=${comercio.comercioId.toString()}`))
        .set(como(admin.token)).expect(200);
      expect(porComercio.body.total).toBe(2);

      // Buscar por código, por email del cliente y por nombre del comercio:
      // los tres caminos por los que se llega a una reserva concreta.
      const porCodigo = await api(e2e)
        .get(ruta('/admin/reservas?buscar=DK-AAA')).set(como(admin.token)).expect(200);
      expect(porCodigo.body.total).toBe(1);

      const porCliente = await api(e2e)
        .get(ruta(`/admin/reservas?buscar=${encodeURIComponent(cliente.email)}`))
        .set(como(admin.token)).expect(200);
      expect(porCliente.body.total).toBe(3);

      const porNombreComercio = await api(e2e)
        .get(ruta('/admin/reservas?buscar=Luna')).set(como(admin.token)).expect(200);
      expect(porNombreComercio.body.total).toBe(1);
    });

    it('debería devolver el cliente y el comercio resueltos, no sólo sus ids', async () => {
      // El listado se lee: un ObjectId no le dice nada a quien atiende el caso.
      await sembrarReserva(e2e, {
        comercio, usuarioId: cliente.id, codigo: 'DK-RES-1', estado: ReservaEstado.CONFIRMADA,
      });

      const { body } = await api(e2e)
        .get(ruta('/admin/reservas')).set(como(admin.token)).expect(200);

      expect(body.items[0].cliente).toBe('Ana Ruiz');
      expect(body.items[0].comercio).toBe('Clínica Royal');
    });

    it('debería aceptar los estados operativos y rechazar los que no son del admin', async () => {
      const reservaId = await sembrarReserva(e2e, {
        comercio, usuarioId: cliente.id, codigo: 'DK-RES-2', estado: ReservaEstado.CONFIRMADA,
      });

      await api(e2e)
        .patch(ruta(`/admin/reservas/${reservaId.toString()}/estado`))
        .set(como(admin.token))
        .send({ estado: ReservaEstado.CANCELADA, motivo: 'el cliente no se presentó' })
        .expect(200);

      // `pendiente` es un estado del flujo de pago, no una decisión del admin:
      // devolver una reserva ahí la dejaría esperando un cobro que no existe.
      await api(e2e)
        .patch(ruta(`/admin/reservas/${reservaId.toString()}/estado`))
        .set(como(admin.token))
        .send({ estado: ReservaEstado.PENDIENTE })
        .expect(400);
    });

    it('debería dejar el cambio firmado en el historial de la reserva', async () => {
      const reservaId = await sembrarReserva(e2e, {
        comercio, usuarioId: cliente.id, codigo: 'DK-RES-3', estado: ReservaEstado.CONFIRMADA,
      });

      await api(e2e)
        .patch(ruta(`/admin/reservas/${reservaId.toString()}/estado`))
        .set(como(admin.token))
        .send({ estado: ReservaEstado.REEMBOLSADA, motivo: 'servicio no prestado' })
        .expect(200);

      const reserva = await e2e.conexion.collection('reservas').findOne({ _id: reservaId });
      const historial = reserva!['historialEstados'] as Array<Record<string, unknown>>;
      expect(historial.at(-1)).toMatchObject({
        estado: ReservaEstado.REEMBOLSADA,
        motivo: 'servicio no prestado',
        por: `admin:${admin.id.toString()}`,
      });
    });

    it('debería contar por estado en el resumen de la cabecera', async () => {
      await sembrarReserva(e2e, {
        comercio, usuarioId: cliente.id, codigo: 'DK-R1', estado: ReservaEstado.CONFIRMADA,
      });
      await sembrarReserva(e2e, {
        comercio, usuarioId: cliente.id, codigo: 'DK-R2', estado: ReservaEstado.CANCELADA,
      });

      const { body } = await api(e2e)
        .get(ruta('/admin/reservas/resumen')).set(como(admin.token)).expect(200);

      expect(body.total).toBe(2);
      expect(body.porEstado['confirmada']).toBe(1);
      expect(body.porEstado['cancelada']).toBe(1);
    });
  });

  describe('el informe financiero', () => {
    it('debería cuadrar GMV, comisión, coste de pasarela y margen', async () => {
      await sembrarReserva(e2e, {
        comercio, usuarioId: cliente.id, codigo: 'DK-FIN-1',
        estado: ReservaEstado.CONFIRMADA, montoTotal: 121, conPagoAprobado: true,
      });

      const { body } = await api(e2e)
        .get(ruta(`/admin/reportes/financiero?${RANGO}`))
        .set(como(admin.token)).expect(200);

      expect(body.gmv).toBe(121);
      expect(body.margenNetoPlataforma)
        .toBeCloseTo(body.ingresosPlataforma - body.costoStripe, 2);
      // Lo que se paga al comercio más lo que se queda cada uno es el total.
      expect(body.liquidacionesComercio + body.ingresosPlataforma + body.costoStripe)
        .toBeCloseTo(body.gmv, 2);
    });

    it('no debería perder la facturación cuando la reserva se completa', async () => {
      // El dinero está cobrado; que el servicio ya se haya prestado no lo borra
      // del informe con el que se factura al comercio.
      await sembrarReserva(e2e, {
        comercio, usuarioId: cliente.id, codigo: 'DK-FIN-2',
        estado: ReservaEstado.COMPLETADA, montoTotal: 121, conPagoAprobado: true,
      });
      await sembrarReserva(e2e, {
        comercio, usuarioId: cliente.id, codigo: 'DK-FIN-3',
        estado: ReservaEstado.PAGO_LIBERADO, montoTotal: 242, conPagoAprobado: true,
      });

      const { body } = await api(e2e)
        .get(ruta(`/admin/reportes/financiero?${RANGO}`))
        .set(como(admin.token)).expect(200);

      expect(body.gmv).toBe(363);
      expect(body.totalReservas).toBe(2);
    });

    it('no debería contar como facturación una reserva cancelada', async () => {
      await sembrarReserva(e2e, {
        comercio, usuarioId: cliente.id, codigo: 'DK-FIN-4',
        estado: ReservaEstado.CANCELADA, montoTotal: 121, conPagoAprobado: true,
      });

      const { body } = await api(e2e)
        .get(ruta(`/admin/reportes/financiero?${RANGO}`))
        .set(como(admin.token)).expect(200);

      expect(body.gmv).toBe(0);
    });

    it('debería poder acotarse a un vertical y a un comercio', async () => {
      const peluqueria = await sembrarComercio(e2e, {
        nombreComercial: 'Peluquería Luna', vertical: VerticalKey.PELUQUERIA,
      });
      await sembrarReserva(e2e, {
        comercio, usuarioId: cliente.id, codigo: 'DK-FIN-5',
        estado: ReservaEstado.CONFIRMADA, montoTotal: 100, conPagoAprobado: true,
      });
      await sembrarReserva(e2e, {
        comercio: peluqueria, usuarioId: cliente.id, codigo: 'DK-FIN-6',
        estado: ReservaEstado.CONFIRMADA, montoTotal: 200,
        vertical: VerticalKey.PELUQUERIA, conPagoAprobado: true,
      });

      const porVertical = await api(e2e)
        .get(ruta(`/admin/reportes/financiero?${RANGO}&vertical=peluqueria`))
        .set(como(admin.token)).expect(200);
      expect(porVertical.body.gmv).toBe(200);

      const porComercio = await api(e2e)
        .get(ruta(`/admin/reportes/financiero?${RANGO}&comercioId=${comercio.comercioId.toString()}`))
        .set(como(admin.token)).expect(200);
      expect(porComercio.body.gmv).toBe(100);
    });

    it('debería exigir el área de finanzas', async () => {
      const soporte = await sembrarCuenta(e2e, Rol.ADMIN, {
        permisosAdmin: [PermisoAdmin.SOPORTE],
      });

      await api(e2e)
        .get(ruta(`/admin/reportes/financiero?${RANGO}`))
        .set(como(soporte.token)).expect(403);
    });
  });

  describe('la configuración de comisiones', () => {
    it('debería guardar la comisión de un vertical y devolverla en el listado', async () => {
      await api(e2e)
        .put(ruta('/admin/comisiones'))
        .set(como(admin.token))
        .send(COMISION_BASE(0.12))
        .expect(200);

      const { body } = await api(e2e)
        .get(ruta('/admin/comisiones')).set(como(admin.token)).expect(200);

      const veterinaria = (body as Array<Record<string, unknown>>)
        .find((c) => c['vertical'] === VerticalKey.VETERINARIA);
      expect(veterinaria!['comisionPct']).toBe(0.12);
    });

    it('debería rechazar una comisión fuera de rango', async () => {
      // Una comisión mayor que el total dejaría liquidaciones negativas.
      await api(e2e)
        .put(ruta('/admin/comisiones'))
        .set(como(admin.token))
        .send(COMISION_BASE(1.5))
        .expect(400);
    });
  });

  describe('el dashboard', () => {
    it('debería responder con los KPIs del periodo aunque no haya datos', async () => {
      // Una plataforma recién montada no puede enseñar un error en la portada.
      const { body } = await api(e2e)
        .get(ruta('/admin/dashboard')).set(como(admin.token)).expect(200);

      expect(body).toBeDefined();
    });
  });
});
