import { Rol, horarioSemanal } from 'shared';
import { crearAppE2E, ruta, type AppE2E } from './utils/app-e2e';
import { api, como, sembrarComercio, sembrarCuenta, type ComercioSembrado, type CuentaSembrada } from './utils/admin-e2e';

/**
 * E2E de la elección de cita: el cliente ve las horas libres de un día y elige
 * una, y dos clientes no pueden quedarse con la misma hora. Antes escribía la
 * hora a ciegas y las citas sólo contaban cupos del día.
 */
describe('Citas libres para elegir (e2e)', () => {
  let e2e: AppE2E;
  let clinica: ComercioSembrado;
  let ana: CuentaSembrada;
  let luis: CuentaSembrada;

  // Lunes lejano, para que ninguna hora haya pasado cuando se ejecute el test.
  const LUNES = '2030-09-23';

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
        precioConsulta: 40, duracionCitaMin: 30, citasDisponibles: 10,
        serviciosClinicos: [{ nombre: 'Cirugía menor', precio: 120, duracionMin: 90 }],
        horario: horarioSemanal({ dias: ['lunes'], abre: '09:00', cierra: '11:00', abre2: '16:00', cierra2: '17:00' }),
        excepcionesHorario: [{ fecha: '2030-09-30', cerrado: true, motivo: 'Festivo local' }],
      },
    });
    ana = await sembrarCuenta(e2e, Rol.CLIENTE, { nombre: 'Ana Ruiz' });
    luis = await sembrarCuenta(e2e, Rol.CLIENTE, { nombre: 'Luis Gómez' });
  });

  const servicioId = () => clinica.servicioId.toString();

  function huecos(query: Record<string, string> = {}) {
    return api(e2e).get(ruta('/reservas/huecos')).query({ servicioId: servicioId(), fecha: LUNES, ...query });
  }

  function reservar(token: string, hora: string) {
    return api(e2e).post(ruta('/reservas')).set(como(token)).send({
      servicioId: servicioId(), cantidad: 1, fechaInicio: LUNES, detalle: { hora },
    });
  }

  const libres = (body: { huecos: Array<{ hora: string; disponible: boolean }> }) =>
    body.huecos.filter((h) => h.disponible).map((h) => h.hora);

  it('debería enseñar a un invitado las citas del horario del comercio, en hora de Madrid', async () => {
    const { body } = await huecos().expect(200);

    expect(body).toMatchObject({ soportado: true, estado: 'abierto', duracionMin: 30 });
    expect(body.huecos.map((h: { hora: string }) => h.hora)).toEqual(['09:00', '09:30', '10:00', '10:30', '16:00', '16:30']);
    expect(body.huecos[0].inicio).toBe('2030-09-23T07:00:00.000Z');
  });

  it('debería quitar la hora reservada y no dejar que otro cliente la coja', async () => {
    await reservar(ana.token, '10:00').expect(201);

    const { body } = await huecos().set(como(luis.token)).expect(200);
    expect(libres(body)).toEqual(['09:00', '09:30', '10:30', '16:00', '16:30']);

    const choque = await reservar(luis.token, '10:00').expect(409);
    expect(choque.body.message).toContain('ya está reservada');

    const previa = await api(e2e).post(ruta('/reservas/disponibilidad')).set(como(luis.token))
      .send({ servicioId: servicioId(), fechaInicio: LUNES, detalle: { hora: '10:00' } }).expect(200);
    expect(previa.body).toMatchObject({ disponible: false });

    await reservar(luis.token, '10:30').expect(201);
  });

  it('debería volver a ofrecer la hora cuando la reserva se cancela', async () => {
    const { body: reserva } = await reservar(ana.token, '16:00').expect(201);
    await api(e2e).post(ruta(`/reservas/${reserva._id}/cancelar`)).set(como(ana.token)).expect(200);

    const { body } = await huecos().expect(200);
    expect(libres(body)).toContain('16:00');
  });

  it('debería ajustar las horas a la duración del servicio elegido', async () => {
    await reservar(ana.token, '09:30').expect(201);

    const { body } = await huecos({ servicio: 'Cirugía menor' }).expect(200);

    // 90 minutos: sólo cabe si no pisa la cita de las 09:30 ni se pasa del cierre.
    expect(body.duracionMin).toBe(90);
    expect(body.huecos.map((h: { hora: string }) => h.hora)).toEqual(['09:00', '09:30']);
    expect(libres(body)).toEqual([]);
  });

  it('debería restar lo que el comercio cierra a mano', async () => {
    await e2e.conexion.collection('bloqueos_servicio').insertOne({
      comercioId: clinica.comercioId, servicioId: clinica.servicioId,
      desde: new Date('2030-09-23T14:00:00.000Z'), hasta: new Date('2030-09-23T15:00:00.000Z'), motivo: 'Formación',
    });

    const { body } = await huecos().expect(200);
    expect(libres(body)).toEqual(['09:00', '09:30', '10:00', '10:30']);
  });

  it('debería explicar por qué un día no tiene citas', async () => {
    const domingo = await huecos({ fecha: '2030-09-22' }).expect(200);
    expect(domingo.body).toMatchObject({ estado: 'cerrado', motivo: 'El comercio no atiende ese día de la semana.', huecos: [] });

    const festivo = await huecos({ fecha: '2030-09-30' }).expect(200);
    expect(festivo.body.motivo).toContain('Festivo local');
  });

  it('debería validar la consulta', async () => {
    await huecos({ fecha: '23/09/2030' }).expect(400);
  });
});
