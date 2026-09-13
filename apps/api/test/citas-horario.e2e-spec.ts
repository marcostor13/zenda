import { ReservaEstado, Rol, VerticalKey, horarioSemanal } from 'shared';
import { crearAppE2E, ruta, type AppE2E } from './utils/app-e2e';
import {
  api, como, sembrarComercio, sembrarCuenta, sembrarReserva,
  type ComercioSembrado, type CuentaSembrada,
} from './utils/admin-e2e';

/**
 * E2E de las citas con hora: lo que el cliente reserva, lo que se guarda y lo
 * que ve el comercio en su agenda tienen que ser la misma hora, la de Madrid.
 *
 * Antes una cita "el lunes a las 10:00" se guardaba a las 00:00 UTC y sin fin,
 * la agenda la pintaba como un bloque de 24 horas, y se podía reservar fuera
 * del horario del comercio. Todo contra el AppModule real y Mongo en memoria.
 */
describe('Citas con hora y horario del comercio (e2e)', () => {
  let e2e: AppE2E;
  let clinica: ComercioSembrado;
  let cliente: CuentaSembrada;
  let veterinario: CuentaSembrada;

  // Lunes 21 de septiembre de 2026 (horario de verano, UTC+2).
  const LUNES = '2026-09-21';

  beforeAll(async () => {
    e2e = await crearAppE2E();
  }, 180_000);

  afterAll(async () => {
    await e2e.cerrar();
  });

  beforeEach(async () => {
    await e2e.limpiarBaseDeDatos();
    clinica = await sembrarComercio(e2e, { nombreComercial: 'Clínica Royal' });
    await e2e.conexion.collection('servicios').updateOne({ _id: clinica.servicioId }, {
      $set: {
        precioConsulta: 40, duracionCitaMin: 30, citasDisponibles: 10, serviciosClinicos: [],
        horario: horarioSemanal(
          { dias: ['lunes', 'martes', 'miercoles', 'jueves', 'viernes'], abre: '09:00', cierra: '14:00', abre2: '16:00', cierra2: '20:00' },
        ),
        excepcionesHorario: [{ fecha: '2026-09-22', cerrado: true, motivo: 'Festivo local' }],
      },
    });
    cliente = await sembrarCuenta(e2e, Rol.CLIENTE, { nombre: 'Ana Ruiz' });
    veterinario = await sembrarCuenta(e2e, Rol.COMERCIO_ADMIN, { comercioId: clinica.comercioId });
  });

  function reservar(cuerpo: Record<string, unknown>) {
    return api(e2e).post(ruta('/reservas')).set(como(cliente.token)).send({
      servicioId: clinica.servicioId.toString(), cantidad: 1, ...cuerpo,
    });
  }

  it('debería guardar la cita a las 10:00 de Madrid con su duración, venga el día y la hora por separado', async () => {
    const { body } = await reservar({ fechaInicio: LUNES, detalle: { hora: '10:00' } }).expect(201);

    expect(body.fechaInicio).toBe('2026-09-21T08:00:00.000Z');
    expect(body.fechaFin).toBe('2026-09-21T08:30:00.000Z');
    expect(body.detalle).toMatchObject({ hora: '10:00', duracionMin: 30 });
  });

  it('debería leer una hora sin zona como hora de Madrid, no del servidor', async () => {
    const { body } = await reservar({ fechaInicio: `${LUNES}T17:15:00`, detalle: {} }).expect(201);

    expect(body.fechaInicio).toBe('2026-09-21T15:15:00.000Z');
    expect(body.fechaFin).toBe('2026-09-21T15:45:00.000Z');
  });

  it('debería rechazar citas fuera del horario, en un día cerrado o en un festivo', async () => {
    const mediodia = await reservar({ fechaInicio: LUNES, detalle: { hora: '14:45' } }).expect(409);
    expect(mediodia.body.message).toContain('09:00–14:00 y 16:00–20:00');

    const domingo = await reservar({ fechaInicio: '2026-09-20', detalle: { hora: '10:00' } }).expect(409);
    expect(domingo.body.message).toBe('El comercio no atiende ese día de la semana.');

    const festivo = await reservar({ fechaInicio: '2026-09-22', detalle: { hora: '10:00' } }).expect(409);
    expect(festivo.body.message).toContain('Festivo local');
  });

  it('debería avisar del horario en la comprobación previa del asistente', async () => {
    const { body } = await api(e2e).post(ruta('/reservas/disponibilidad')).set(como(cliente.token)).send({
      servicioId: clinica.servicioId.toString(), fechaInicio: LUNES, detalle: { hora: '21:00' },
    }).expect(200);

    expect(body.disponible).toBe(false);
    expect(body.motivo).toContain('fuera del horario');
  });

  it('debería enseñar en la agenda del comercio la misma hora y duración que reservó el cliente', async () => {
    await reservar({ fechaInicio: LUNES, detalle: { hora: '10:00' } }).expect(201);

    const { body } = await api(e2e).get(ruta('/mi-agenda/citas'))
      .query({ desde: '2026-09-20T22:00:00.000Z', hasta: '2026-09-21T22:00:00.000Z', servicioId: clinica.servicioId.toString() })
      .set(como(veterinario.token)).expect(200);

    expect(body).toHaveLength(1);
    expect(body[0]).toMatchObject({ desde: '2026-09-21T08:00:00.000Z', hasta: '2026-09-21T08:30:00.000Z', cliente: 'Ana Ruiz' });
  });

  it('debería situar a su hora una cita antigua guardada a medianoche con la hora aparte', async () => {
    const reservaId = await sembrarReserva(e2e, {
      comercio: clinica, usuarioId: cliente.id, codigo: 'RES-VIEJA', estado: ReservaEstado.CONFIRMADA,
    });
    await e2e.conexion.collection('reservas').updateOne({ _id: reservaId }, {
      $set: { fechaInicio: new Date(`${LUNES}T00:00:00Z`), detalle: { hora: '16:30' }, vertical: VerticalKey.VETERINARIA },
    });

    const agenda = await api(e2e).get(ruta('/mi-agenda/citas'))
      .query({ desde: '2026-09-20T22:00:00.000Z', hasta: '2026-09-21T22:00:00.000Z' })
      .set(como(veterinario.token)).expect(200);
    expect(agenda.body[0]).toMatchObject({ desde: '2026-09-21T14:30:00.000Z', hasta: '2026-09-21T15:30:00.000Z' });

    const lista = await api(e2e).get(ruta('/comercios/mis-reservas')).set(como(veterinario.token)).expect(200);
    expect(lista.body[0].fechaInicio).toBe('2026-09-21T14:30:00.000Z');

    const delCliente = await api(e2e).get(ruta('/reservas/mis')).set(como(cliente.token)).expect(200);
    expect(delCliente.body[0].fechaInicio).toBe('2026-09-21T14:30:00.000Z');
  });
});
