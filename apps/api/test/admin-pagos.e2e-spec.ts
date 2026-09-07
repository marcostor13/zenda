// `import * as` y no import por defecto: ver la nota de auth.e2e-spec.ts.
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

/** Fecha fija dentro del periodo que se liquida en casi todas las pruebas. */
const DENTRO = new Date('2026-09-15T10:00:00.000Z');
const PERIODO = { desde: '2026-09-01', hasta: '2026-09-30' };

/**
 * E2E de `/admin/pagos`: el control del dinero de la plataforma.
 *
 * Cubre las dos mitades de la pantalla —los pagos recibidos con su desglose y
 * las liquidaciones a comercios— porque es el único sitio del producto donde se
 * decide **cuánto se le transfiere a un comercio**, y ahí un fallo no es un
 * pixel torcido: es dinero pagado de más o de menos.
 */
describe('Pagos y liquidaciones del panel admin (e2e)', () => {
  let e2e: AppE2E;
  let admin: CuentaSembrada;
  let cliente: CuentaSembrada;
  let comercio: ComercioSembrado;

  const generar = (cuerpo: Record<string, unknown>) =>
    api(e2e).post(ruta('/liquidaciones')).set(como(admin.token)).send(cuerpo);

  const listarLiquidaciones = () =>
    api(e2e).get(ruta('/liquidaciones')).set(como(admin.token));

  beforeAll(async () => {
    e2e = await crearAppE2E();
  }, 180_000);

  afterAll(async () => {
    await e2e.cerrar();
  });

  beforeEach(async () => {
    await e2e.limpiarBaseDeDatos();
    admin = await sembrarCuenta(e2e, Rol.ADMIN, { email: 'finanzas@doogking.test' });
    cliente = await sembrarCuenta(e2e, Rol.CLIENTE, { nombre: 'Ana Ruiz' });
    comercio = await sembrarComercio(e2e, { nombreComercial: 'Clínica Royal' });
  });

  describe('el listado de pagos recibidos', () => {
    it('debería devolver el desglose de cada pago: comisión, pasarela y neto del comercio', async () => {
      await sembrarReserva(e2e, {
        comercio, usuarioId: cliente.id, codigo: 'DK-PAGO1',
        estado: ReservaEstado.COMPLETADA, montoTotal: 121, conPagoAprobado: true,
      });

      const { body } = await api(e2e)
        .get(ruta('/admin/pagos'))
        .set(como(admin.token))
        .expect(200);

      expect(body.total).toBe(1);
      const [pago] = body.items;
      expect(pago.codigoReserva).toBe('DK-PAGO1');
      expect(pago.comercio).toBe('Clínica Royal');
      // Lo cobrado tiene que repartirse entero: comisión + pasarela + comercio.
      expect(pago.comisionPlataforma + pago.stripeFee + pago.montoLiquidacion)
        .toBeCloseTo(pago.montoTotal, 2);
    });

    it('debería filtrar por estado y buscar por código de reserva', async () => {
      await sembrarReserva(e2e, {
        comercio, usuarioId: cliente.id, codigo: 'DK-AAA',
        estado: ReservaEstado.COMPLETADA, conPagoAprobado: true,
      });
      await sembrarReserva(e2e, {
        comercio, usuarioId: cliente.id, codigo: 'DK-BBB',
        estado: ReservaEstado.COMPLETADA, conPagoAprobado: true,
      });

      const aprobados = await api(e2e)
        .get(ruta('/admin/pagos?estado=aprobado'))
        .set(como(admin.token))
        .expect(200);
      expect(aprobados.body.total).toBe(2);

      const buscado = await api(e2e)
        .get(ruta('/admin/pagos?buscar=DK-BBB'))
        .set(como(admin.token))
        .expect(200);
      expect(buscado.body.items).toHaveLength(1);
      expect(buscado.body.items[0].codigoReserva).toBe('DK-BBB');
    });

    it('debería paginar sin repetir ni perder pagos', async () => {
      for (const codigo of ['DK-1', 'DK-2', 'DK-3']) {
        await sembrarReserva(e2e, {
          comercio, usuarioId: cliente.id, codigo,
          estado: ReservaEstado.COMPLETADA, conPagoAprobado: true,
        });
      }

      const pagina1 = await api(e2e)
        .get(ruta('/admin/pagos?page=1&limite=2'))
        .set(como(admin.token))
        .expect(200);
      const pagina2 = await api(e2e)
        .get(ruta('/admin/pagos?page=2&limite=2'))
        .set(como(admin.token))
        .expect(200);

      expect(pagina1.body.total).toBe(3);
      expect(pagina1.body.items).toHaveLength(2);
      expect(pagina2.body.items).toHaveLength(1);
      const codigos = [...pagina1.body.items, ...pagina2.body.items].map(
        (p: { codigoReserva: string }) => p.codigoReserva,
      );
      expect(new Set(codigos).size).toBe(3);
    });

    it('debería cuadrar el resumen de cabecera con los pagos existentes', async () => {
      await sembrarReserva(e2e, {
        comercio, usuarioId: cliente.id, codigo: 'DK-RES',
        estado: ReservaEstado.COMPLETADA, montoTotal: 242, conPagoAprobado: true,
      });

      const { body: resumen } = await api(e2e)
        .get(ruta('/admin/pagos/resumen'))
        .set(como(admin.token))
        .expect(200);
      const { body: listado } = await api(e2e)
        .get(ruta('/admin/pagos'))
        .set(como(admin.token))
        .expect(200);

      const [pago] = listado.items;
      expect(resumen.cobrado).toBeCloseTo(pago.montoTotal, 2);
      expect(resumen.comisionDoogking).toBeCloseTo(pago.comisionPlataforma, 2);
      expect(resumen.costePasarela).toBeCloseTo(pago.stripeFee, 2);
      expect(resumen.liquidadoComercios).toBeCloseTo(pago.montoLiquidacion, 2);
    });
  });

  describe('generar una liquidación', () => {
    it('debería sumar los pagos cobrados del periodo y dejarla pendiente', async () => {
      await sembrarReserva(e2e, {
        comercio, usuarioId: cliente.id, codigo: 'DK-LIQ1',
        estado: ReservaEstado.COMPLETADA, montoTotal: 121,
        conPagoAprobado: true, cobradoEn: DENTRO,
      });

      const { body } = await generar({ comercioId: String(comercio.comercioId), ...PERIODO })
        .expect(201);

      expect(body.comercioNombre).toBe('Clínica Royal');
      expect(body.estado).toBe('pendiente');
      expect(body.reservas).toBe(1);
      expect(body.importeNeto).toBeCloseTo(
        body.facturacionBruta - body.comisionPlataforma - body.stripeFee,
        2,
      );
    });

    it('debería incluir lo cobrado el último día del periodo', async () => {
      // El rango llega de dos `input type="date"`: sin extender `hasta` al final
      // del día, todo lo cobrado ese día se quedaba fuera de la liquidación.
      await sembrarReserva(e2e, {
        comercio, usuarioId: cliente.id, codigo: 'DK-ULTIMO',
        estado: ReservaEstado.COMPLETADA, montoTotal: 121,
        conPagoAprobado: true, cobradoEn: new Date('2026-09-30T18:45:00.000Z'),
      });

      const { body } = await generar({ comercioId: String(comercio.comercioId), ...PERIODO })
        .expect(201);

      expect(body.reservas).toBe(1);
      expect(body.facturacionBruta).toBeCloseTo(121, 2);
    });

    it('debería dejar fuera lo cobrado antes del periodo', async () => {
      await sembrarReserva(e2e, {
        comercio, usuarioId: cliente.id, codigo: 'DK-VIEJO',
        estado: ReservaEstado.COMPLETADA, conPagoAprobado: true,
        cobradoEn: new Date('2026-08-31T23:00:00.000Z'),
      });

      await generar({ comercioId: String(comercio.comercioId), ...PERIODO }).expect(400);
    });

    it('debería rechazar un periodo que se solapa con otro ya liquidado', async () => {
      await sembrarReserva(e2e, {
        comercio, usuarioId: cliente.id, codigo: 'DK-DUP',
        estado: ReservaEstado.COMPLETADA, conPagoAprobado: true, cobradoEn: DENTRO,
      });
      await generar({ comercioId: String(comercio.comercioId), ...PERIODO }).expect(201);

      // Repetir el mismo periodo pagaría dos veces los mismos pagos.
      const repetida = await generar({ comercioId: String(comercio.comercioId), ...PERIODO })
        .expect(409);
      expect(repetida.body.message).toContain('ya está liquidado');

      // Y un rango que sólo lo pisa en parte, igual.
      await generar({
        comercioId: String(comercio.comercioId), desde: '2026-09-20', hasta: '2026-10-20',
      }).expect(409);

      const { body } = await listarLiquidaciones().expect(200);
      expect(body.total).toBe(1);
    });

    it('debería permitir el periodo siguiente sin solape', async () => {
      await sembrarReserva(e2e, {
        comercio, usuarioId: cliente.id, codigo: 'DK-SEP',
        estado: ReservaEstado.COMPLETADA, conPagoAprobado: true, cobradoEn: DENTRO,
      });
      await sembrarReserva(e2e, {
        comercio, usuarioId: cliente.id, codigo: 'DK-OCT',
        estado: ReservaEstado.COMPLETADA, conPagoAprobado: true,
        cobradoEn: new Date('2026-10-10T10:00:00.000Z'),
      });

      await generar({ comercioId: String(comercio.comercioId), ...PERIODO }).expect(201);
      await generar({
        comercioId: String(comercio.comercioId), desde: '2026-10-01', hasta: '2026-10-31',
      }).expect(201);

      const { body } = await listarLiquidaciones().expect(200);
      expect(body.total).toBe(2);
    });

    it('debería rechazar el periodo invertido y las fechas sin sentido', async () => {
      await generar({
        comercioId: String(comercio.comercioId), desde: '2026-09-30', hasta: '2026-09-01',
      }).expect(400);

      // Antes llegaban al servicio como `Invalid Date` y devolvían el 400
      // equivocado ("no hay pagos"), que manda a mirar donde no está el fallo.
      await generar({
        comercioId: String(comercio.comercioId), desde: 'ayer', hasta: 'mañana',
      }).expect(400);

      await generar({ comercioId: 'no-es-un-id', ...PERIODO }).expect(400);
    });

    it('debería avisar de que no hay nada que liquidar en vez de crear una vacía', async () => {
      const sinPagos = await generar({ comercioId: String(comercio.comercioId), ...PERIODO })
        .expect(400);
      expect(sinPagos.body.message).toContain('No hay pagos cobrados');

      const { body } = await listarLiquidaciones().expect(200);
      expect(body.total).toBe(0);
    });
  });

  describe('marcar una liquidación como pagada', () => {
    /** Deja una liquidación pendiente lista para el resto de la prueba. */
    const liquidacionPendiente = async (): Promise<string> => {
      await sembrarReserva(e2e, {
        comercio, usuarioId: cliente.id, codigo: 'DK-PEND',
        estado: ReservaEstado.COMPLETADA, conPagoAprobado: true, cobradoEn: DENTRO,
      });
      const { body } = await generar({ comercioId: String(comercio.comercioId), ...PERIODO })
        .expect(201);
      return body._id as string;
    };

    it('debería guardar la referencia de la transferencia y la fecha', async () => {
      const id = await liquidacionPendiente();

      const { body } = await api(e2e)
        .patch(ruta(`/liquidaciones/${id}/pagada`))
        .set(como(admin.token))
        .send({ referencia: 'TRF-2026-09-001' })
        .expect(200);

      expect(body.estado).toBe('pagada');
      expect(body.referencia).toBe('TRF-2026-09-001');
      expect(body.fechaPago).toBeTruthy();
    });

    it('debería exigir una referencia con la que casar el apunte del banco', async () => {
      const id = await liquidacionPendiente();

      await api(e2e)
        .patch(ruta(`/liquidaciones/${id}/pagada`))
        .set(como(admin.token))
        .send({ referencia: '   ' })
        .expect(400);
    });

    it('no debería dejar marcarla pagada dos veces', async () => {
      const id = await liquidacionPendiente();
      await api(e2e)
        .patch(ruta(`/liquidaciones/${id}/pagada`))
        .set(como(admin.token))
        .send({ referencia: 'TRF-BUENA' })
        .expect(200);

      // Pisar la referencia real dejaría el cuadre con el banco sin fuente fiable.
      const segunda = await api(e2e)
        .patch(ruta(`/liquidaciones/${id}/pagada`))
        .set(como(admin.token))
        .send({ referencia: 'TRF-EQUIVOCADA' })
        .expect(409);
      expect(segunda.body.message).toContain('ya se marcó como pagada');

      const { body } = await listarLiquidaciones().expect(200);
      expect(body.items[0].referencia).toBe('TRF-BUENA');
    });

    it('debería filtrar el historial por estado', async () => {
      const id = await liquidacionPendiente();
      await api(e2e)
        .patch(ruta(`/liquidaciones/${id}/pagada`))
        .set(como(admin.token))
        .send({ referencia: 'TRF-1' })
        .expect(200);

      const pagadas = await api(e2e)
        .get(ruta('/liquidaciones?estado=pagada'))
        .set(como(admin.token))
        .expect(200);
      const pendientes = await api(e2e)
        .get(ruta('/liquidaciones?estado=pendiente'))
        .set(como(admin.token))
        .expect(200);

      expect(pagadas.body.total).toBe(1);
      expect(pendientes.body.total).toBe(0);
    });
  });

  describe('quién puede ver el dinero', () => {
    it('debería negar el acceso a un cliente', async () => {
      await api(e2e).get(ruta('/admin/pagos')).set(como(cliente.token)).expect(403);
      await api(e2e).get(ruta('/liquidaciones')).set(como(cliente.token)).expect(403);
    });

    it('debería negar el acceso a un admin sin el permiso de finanzas', async () => {
      const soporte = await sembrarCuenta(e2e, Rol.ADMIN, {
        email: 'soporte@doogking.test',
        permisosAdmin: [PermisoAdmin.SOPORTE],
      });

      await api(e2e).get(ruta('/admin/pagos')).set(como(soporte.token)).expect(403);
      await api(e2e).get(ruta('/liquidaciones')).set(como(soporte.token)).expect(403);
      await api(e2e)
        .post(ruta('/liquidaciones'))
        .set(como(soporte.token))
        .send({ comercioId: String(comercio.comercioId), ...PERIODO })
        .expect(403);
    });

    it('debería exigir sesión', async () => {
      await api(e2e).get(ruta('/admin/pagos')).expect(401);
      await api(e2e).get(ruta('/liquidaciones')).expect(401);
    });
  });
});
