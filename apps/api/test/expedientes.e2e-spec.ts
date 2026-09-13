import { Types } from 'mongoose';
import { ReservaEstado, Rol, VerticalKey } from 'shared';
import { crearAppE2E, ruta, type AppE2E } from './utils/app-e2e';
import {
  api, como, sembrarComercio, sembrarCuenta, sembrarReserva,
  type ComercioSembrado, type CuentaSembrada,
} from './utils/admin-e2e';

/**
 * E2E del expediente de las mascotas: el comercio que atiende a un perro anota
 * lo que hizo en cada servicio, lo descarga en PDF, y el dueño lo ve en la
 * ficha de su perro. Todo contra el AppModule real y una Mongo en memoria.
 */
describe('Expediente de mascotas (e2e)', () => {
  let e2e: AppE2E;
  let clinica: ComercioSembrado;
  let otraClinica: ComercioSembrado;
  let cliente: CuentaSembrada;
  let otroCliente: CuentaSembrada;
  let veterinario: CuentaSembrada;
  let intruso: CuentaSembrada;
  let perroId: string;
  let reservaId: Types.ObjectId;

  beforeAll(async () => {
    e2e = await crearAppE2E();
  }, 180_000);

  afterAll(async () => {
    await e2e.cerrar();
  });

  beforeEach(async () => {
    await e2e.limpiarBaseDeDatos();
    clinica = await sembrarComercio(e2e, { nombreComercial: 'Clínica Royal' });
    otraClinica = await sembrarComercio(e2e, { nombreComercial: 'Clínica Ajena' });
    cliente = await sembrarCuenta(e2e, Rol.CLIENTE, { nombre: 'Ana Ruiz' });
    otroCliente = await sembrarCuenta(e2e, Rol.CLIENTE, { nombre: 'Luis Gómez' });
    veterinario = await sembrarCuenta(e2e, Rol.COMERCIO_ADMIN, { comercioId: clinica.comercioId });
    intruso = await sembrarCuenta(e2e, Rol.COMERCIO_ADMIN, { comercioId: otraClinica.comercioId });

    perroId = await sembrarPerro(cliente.id, 'Nala');
    reservaId = await sembrarReserva(e2e, {
      comercio: clinica, usuarioId: cliente.id, codigo: 'RES-NALA1', estado: ReservaEstado.COMPLETADA,
    });
    await e2e.conexion.collection('reservas').updateOne(
      { _id: reservaId },
      { $set: { perroId: new Types.ObjectId(perroId) } },
    );
  });

  async function sembrarPerro(propietarioId: Types.ObjectId, nombre: string): Promise<string> {
    const id = new Types.ObjectId();
    await e2e.conexion.collection('perros').insertOne({
      _id: id, propietarioId, nombre, especie: 'perro', raza: 'Beagle', peso: 12,
      fotos: [], tipoPelo: [], vacunas: [], vacunasDetalle: [], alergias: ['Pollo'],
      enfermedades: [], medicacion: [], miedos: [], esterilizado: true, createdAt: new Date(),
    });
    return id.toString();
  }

  const registroVeterinario = {
    vertical: VerticalKey.VETERINARIA,
    titulo: 'Revisión anual',
    nota: 'Todo en orden.',
    profesional: 'Dra. Pérez',
    fechaServicio: '2026-09-10',
    datosEstructurados: { motivo: 'Chequeo', diagnostico: 'Sano', pesoKg: '12,5', inventado: 'x' },
  };

  function crearRegistro(token = veterinario.token, cuerpo: object = registroVeterinario) {
    return api(e2e).post(ruta(`/comercio/mascotas/${perroId}/registros`)).set(como(token)).send(cuerpo);
  }

  describe('panel del comercio', () => {
    it('debería listar las mascotas que han reservado, con su dueño', async () => {
      const { body } = await api(e2e).get(ruta('/comercio/mascotas')).set(como(veterinario.token)).expect(200);

      expect(body).toHaveLength(1);
      expect(body[0]).toMatchObject({
        perroId, nombre: 'Nala', raza: 'Beagle', alergias: ['Pollo'],
        totalReservas: 1, serviciosCompletados: 1, totalRegistros: 0,
      });
      expect(body[0].propietario.nombre).toBe('Ana Ruiz');
    });

    it('debería filtrar por el nombre del dueño sin distinguir tildes', async () => {
      const vacia = await api(e2e).get(ruta('/comercio/mascotas')).query({ q: 'gomez' }).set(como(veterinario.token));
      const llena = await api(e2e).get(ruta('/comercio/mascotas')).query({ q: 'RUÍZ' }).set(como(veterinario.token));

      expect(vacia.body).toHaveLength(0);
      expect(llena.body).toHaveLength(1);
    });

    it('no debería dejar a un cliente entrar en el panel de mascotas', async () => {
      await api(e2e).get(ruta('/comercio/mascotas')).set(como(cliente.token)).expect(403);
    });

    it('debería guardar un registro estructurado y enseñarlo en el expediente', async () => {
      const { body: registro } = await crearRegistro().expect(201);

      expect(registro).toMatchObject({ titulo: 'Revisión anual', esPropio: true, comercioNombre: 'Clínica Royal' });
      expect(registro.datosEstructurados).toEqual({ motivo: 'Chequeo', diagnostico: 'Sano', pesoKg: 12.5 });

      const { body: expediente } = await api(e2e)
        .get(ruta(`/comercio/mascotas/${perroId}`)).set(como(veterinario.token)).expect(200);

      expect(expediente.perro.nombre).toBe('Nala');
      expect(expediente.perro.propietarioId).toBeUndefined();
      expect(expediente.propietario.nombre).toBe('Ana Ruiz');
      expect(expediente.registros).toHaveLength(1);
      expect(expediente.servicios[0]).toMatchObject({ codigo: 'RES-NALA1', servicioTitulo: 'Consulta general' });
    });

    it('debería rechazar una categoría en la que el negocio no opera', async () => {
      await crearRegistro(veterinario.token, { ...registroVeterinario, vertical: VerticalKey.PELUQUERIA }).expect(403);
    });

    it('debería exigir el título del registro', async () => {
      await crearRegistro(veterinario.token, { vertical: VerticalKey.VETERINARIA, nota: 'sin título' }).expect(400);
    });

    it('debería permitir corregir y borrar sólo los registros propios', async () => {
      const { body: registro } = await crearRegistro().expect(201);
      const camino = ruta(`/comercio/mascotas/${perroId}/registros/${registro._id}`);

      const { body: corregido } = await api(e2e).patch(camino).set(como(veterinario.token))
        .send({ datosEstructurados: { diagnostico: 'Otitis leve' } }).expect(200);
      expect(corregido.datosEstructurados).toEqual({ diagnostico: 'Otitis leve' });
      expect(corregido.nota).toBe('Todo en orden.');

      await api(e2e).delete(camino).set(como(intruso.token)).expect(404);
      await api(e2e).delete(camino).set(como(veterinario.token)).expect(204);
    });

    it('debería descargar el informe en PDF', async () => {
      await crearRegistro().expect(201);

      const respuesta = await api(e2e)
        .get(ruta(`/comercio/mascotas/${perroId}/informe`))
        .set(como(veterinario.token))
        .buffer(true)
        .parse((res, callback) => {
          const trozos: Buffer[] = [];
          res.on('data', (t: Buffer) => trozos.push(t));
          res.on('end', () => callback(null, Buffer.concat(trozos)));
        })
        .expect(200);

      expect(respuesta.headers['content-type']).toContain('application/pdf');
      expect(respuesta.headers['content-disposition']).toMatch(/doogking-informe-nala-\d{4}-\d{2}-\d{2}\.pdf/);
      expect(respuesta.headers['cache-control']).toBe('no-store');
      expect((respuesta.body as Buffer).subarray(0, 4).toString()).toBe('%PDF');
    });
  });

  describe('perro creado después de reservar', () => {
    it('debería aparecer en las mascotas del comercio y abrir su expediente', async () => {
      const dueno = await sembrarCuenta(e2e, Rol.CLIENTE, { nombre: 'Luis Gómez' });
      await sembrarReserva(e2e, { comercio: clinica, usuarioId: dueno.id, codigo: 'RES-SINPERRO', estado: ReservaEstado.CONFIRMADA });
      // La ficha se crea después, a mano y sin algunos campos: como las fichas antiguas.
      const id = new Types.ObjectId();
      await e2e.conexion.collection('perros').insertOne({ _id: id, propietarioId: dueno.id, nombre: 'Luna', especie: 'perro' });

      const { body: mascotas } = await api(e2e).get(ruta('/comercio/mascotas')).set(como(veterinario.token)).expect(200);
      expect(mascotas.map((m: { nombre: string }) => m.nombre).sort()).toEqual(['Luna', 'Nala']);

      const { body: exp } = await api(e2e).get(ruta(`/comercio/mascotas/${id}`)).set(como(veterinario.token)).expect(200);
      expect(exp.servicios.map((r: { codigo: string }) => r.codigo)).toEqual(['RES-SINPERRO']);
      // Sin estas listas la ficha rompía en la web al leer vacunas.length.
      expect(exp.perro).toMatchObject({ vacunas: [], alergias: [], medicacion: [], fotos: [], miedos: [] });

      await api(e2e).get(ruta(`/comercio/mascotas/${id}`)).set(como(intruso.token)).expect(403);
    });
  });

  describe('un comercio sin relación con el perro', () => {
    it('no debería ver la mascota ni su expediente', async () => {
      const { body } = await api(e2e).get(ruta('/comercio/mascotas')).set(como(intruso.token)).expect(200);
      expect(body).toHaveLength(0);

      await api(e2e).get(ruta(`/comercio/mascotas/${perroId}`)).set(como(intruso.token)).expect(403);
      await api(e2e).get(ruta(`/comercio/mascotas/${perroId}/informe`)).set(como(intruso.token)).expect(403);
    });

    it('no debería poder escribir en su historial por ninguna vía', async () => {
      await crearRegistro(intruso.token).expect(403);
      await api(e2e).post(ruta(`/perros/${perroId}/historial`)).set(como(intruso.token))
        .send({ vertical: VerticalKey.VETERINARIA, nota: 'Nota ajena' }).expect(403);
      await api(e2e).get(ruta(`/perros/${perroId}/historia-veterinaria`)).set(como(intruso.token)).expect(403);
    });
  });

  describe('cuenta del dueño', () => {
    it('debería ver en la ficha de su perro lo que anotó el profesional y el servicio realizado', async () => {
      await crearRegistro().expect(201);

      const { body } = await api(e2e).get(ruta(`/perros/${perroId}/expediente`)).set(como(cliente.token)).expect(200);

      expect(body.perro.nombre).toBe('Nala');
      expect(body.propietario).toBeUndefined();
      expect(body.registros[0]).toMatchObject({
        titulo: 'Revisión anual', comercioNombre: 'Clínica Royal', profesional: 'Dra. Pérez', esPropio: false,
      });
      expect(body.servicios[0]).toMatchObject({ codigo: 'RES-NALA1', comercioNombre: 'Clínica Royal' });
    });

    it('no debería ver el expediente del perro de otra persona', async () => {
      await api(e2e).get(ruta(`/perros/${perroId}/expediente`)).set(como(otroCliente.token)).expect(403);
      await api(e2e).get(ruta(`/perros/${perroId}/informe`)).set(como(otroCliente.token)).expect(403);
    });

    it('debería descargar el PDF de la ficha de su perro', async () => {
      const respuesta = await api(e2e).get(ruta(`/perros/${perroId}/informe`)).set(como(cliente.token)).expect(200);
      expect(respuesta.headers['content-type']).toContain('application/pdf');
    });
  });
});
