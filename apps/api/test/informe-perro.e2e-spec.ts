// `import * as` y no import por defecto: el API compila a CommonJS y tiene
// `allowSyntheticDefaultImports` pero no `esModuleInterop`.
import * as request from 'supertest';
import { Types } from 'mongoose';
import { crearAppE2E, ruta, type AppE2E } from './utils/app-e2e';

/**
 * E2E del informe de salud en PDF: **lo que el cliente se lleva a otra clínica**.
 *
 * Se prueba de punta a punta porque el valor de esta función está justo en las
 * costuras: el permiso lo pone el guard, los datos salen de dos colecciones, el
 * nombre del profesional de una tercera, y el PDF lo arma una librería que sólo
 * se carga de verdad cuando el API está en marcha. Un unitario con dobles no
 * habría visto que `pdfkit` se exporta con `export =` y que, sin el import
 * adecuado, la primera descarga real revienta.
 */
describe('Informe de salud del perro en PDF (e2e)', () => {
  let e2e: AppE2E;
  const servidor = () => e2e.app.getHttpServer();

  const alta = { nombre: 'Marta Ruiz', email: 'marta@doogking.com', password: 'Segura123!' };

  /** Registro + verificación + login: devuelve el token del cliente. */
  async function sesionCliente(email = alta.email): Promise<string> {
    await request(servidor()).post(ruta('/auth/registro')).send({ ...alta, email }).expect(201);

    const usuario = await e2e.conexion
      .collection('usuarios')
      .findOne<{ verificacionToken?: string }>({ email });
    await request(servidor())
      .post(ruta('/auth/verificar-email'))
      .send({ token: usuario?.verificacionToken })
      .expect(200);

    const res = await request(servidor())
      .post(ruta('/auth/login'))
      .send({ email, password: alta.password })
      .expect(200);

    return res.body.accessToken ?? res.body.token;
  }

  /** Ficha completa: lo que hace que el informe tenga algo que contar. */
  async function crearPerro(token: string): Promise<string> {
    const res = await request(servidor())
      .post(ruta('/perros'))
      .set('Authorization', `Bearer ${token}`)
      .send({
        nombre: 'Chispa',
        especie: 'perro',
        raza: 'podenco',
        esMestizo: true,
        sexo: 'hembra',
        peso: 14.5,
        esterilizado: true,
        microchip: '941000024680135',
        alergias: ['Pollo'],
        medicacion: ['Apoquel 5,4 mg cada 24 h'],
        enfermedades: ['Dermatitis atópica'],
        dieta: 'Pienso hipoalergénico de pescado',
      })
      .expect(201);

    return res.body._id;
  }

  /** Anotación de un veterinario, escrita directamente en la colección. */
  async function anotar(perroId: string): Promise<void> {
    const comercio = await e2e.conexion.collection('comercios').insertOne({
      nombreComercial: 'Clínica Veterinaria Els Ports',
      verticales: ['veterinaria'],
      estado: 'activo',
    });

    await e2e.conexion.collection('perro_historial').insertOne({
      perroId: new Types.ObjectId(perroId),
      comercioId: comercio.insertedId,
      vertical: 'veterinaria',
      tipoHistorial: 'veterinario',
      origen: 'comercio',
      nota: 'Revisión anual y refuerzo de vacunas. Mejoría de la dermatitis.',
      datosEstructurados: { pesoEnConsulta: '14,5 kg' },
      createdAt: new Date('2026-03-12T10:00:00Z'),
    });
  }

  /** Descarga el informe conservando el cuerpo en binario. */
  const descargar = (perroId: string, token: string) =>
    request(servidor())
      .get(ruta(`/perros/${perroId}/informe`))
      .set('Authorization', `Bearer ${token}`)
      .buffer()
      .parse((res, cb) => {
        const trozos: Buffer[] = [];
        res.on('data', (t: Buffer) => trozos.push(t));
        res.on('end', () => cb(null, Buffer.concat(trozos)));
      });

  beforeAll(async () => {
    e2e = await crearAppE2E();
  });

  afterAll(async () => {
    await e2e.cerrar();
  });

  beforeEach(async () => {
    await e2e.limpiarBaseDeDatos();
  });

  it('debería entregar un PDF de verdad al propietario', async () => {
    const token = await sesionCliente();
    const perroId = await crearPerro(token);
    await anotar(perroId);

    const res = await descargar(perroId, token).expect(200);

    expect(res.headers['content-type']).toContain('application/pdf');
    expect(res.body.subarray(0, 5).toString()).toBe('%PDF-');
    expect(res.body.length).toBeGreaterThan(1000);
  });

  it('debería servirlo como descarga con el nombre del perro y sin cachear', async () => {
    const token = await sesionCliente();
    const perroId = await crearPerro(token);

    const res = await descargar(perroId, token).expect(200);

    expect(res.headers['content-disposition']).toContain('attachment');
    expect(res.headers['content-disposition']).toContain('doogking-informe-chispa-');
    // Es una historia clínica: no se queda en ninguna caché intermedia.
    expect(res.headers['cache-control']).toBe('no-store');
  });

  it('debería salir aunque la ficha esté recién creada y sin historial', async () => {
    const token = await sesionCliente();
    const perroId = await crearPerro(token);

    const res = await descargar(perroId, token).expect(200);

    expect(res.body.subarray(0, 5).toString()).toBe('%PDF-');
  });

  it('no debería dejar descargar el informe de la mascota de otro', async () => {
    const token = await sesionCliente();
    const perroId = await crearPerro(token);
    const otro = await sesionCliente('otro@doogking.com');

    await descargar(perroId, otro).expect(403);
  });

  it('debería exigir sesión', async () => {
    const token = await sesionCliente();
    const perroId = await crearPerro(token);

    await request(servidor()).get(ruta(`/perros/${perroId}/informe`)).expect(401);
  });
});
