import { Test } from '@nestjs/testing';
import { getConnectionToken, getModelToken } from '@nestjs/mongoose';
import { Comercio } from '../core/comercios/comercio.schema';
import { Usuario } from '../core/users/usuario.schema';
import { COMERCIOS_DEMO, USUARIOS_DEMO } from './datos-demo';
import { DatosDemoSeeder, VARIABLE_ACTIVACION, VARIABLE_PASSWORD } from './datos-demo.seeder';

interface OperacionUpsert {
  updateOne: { filter: { _id: unknown }; update: { $setOnInsert: Record<string, unknown> }; upsert: boolean };
}

describe('DatosDemoSeeder', () => {
  let seeder: DatosDemoSeeder;
  let comercios: { exists: jest.Mock; bulkWrite: jest.Mock };
  let usuarios: { bulkWrite: jest.Mock };
  let servicios: { find: jest.Mock; countDocuments: jest.Mock; updateOne: jest.Mock };
  let pendientes: Array<Record<string, unknown>>;
  const entornoOriginal = { ...process.env };

  beforeEach(async () => {
    pendientes = [];
    comercios = { exists: jest.fn().mockResolvedValue(null), bulkWrite: jest.fn().mockResolvedValue({}) };
    usuarios = { bulkWrite: jest.fn().mockResolvedValue({}) };
    servicios = {
      find: jest.fn(() => ({ project: () => ({ toArray: () => Promise.resolve(pendientes) }) })),
      countDocuments: jest.fn().mockResolvedValue(0),
      updateOne: jest.fn().mockResolvedValue({}),
    };
    const ref = await Test.createTestingModule({
      providers: [
        DatosDemoSeeder,
        { provide: getModelToken(Comercio.name), useValue: comercios },
        { provide: getModelToken(Usuario.name), useValue: usuarios },
        { provide: getConnectionToken(), useValue: { collection: () => servicios } },
      ],
    }).compile();
    seeder = ref.get(DatosDemoSeeder);
    process.env[VARIABLE_ACTIVACION] = 'true';
    process.env[VARIABLE_PASSWORD] = 'clave-de-prueba';
  });

  afterEach(() => {
    process.env = { ...entornoOriginal };
  });

  it('no hace nada si el entorno no lo activa', async () => {
    delete process.env[VARIABLE_ACTIVACION];
    await seeder.onApplicationBootstrap();
    expect(comercios.exists).not.toHaveBeenCalled();
    expect(comercios.bulkWrite).not.toHaveBeenCalled();
  });

  it('no siembra sin contraseña para las cuentas demo', async () => {
    delete process.env[VARIABLE_PASSWORD];
    await seeder.onApplicationBootstrap();
    expect(comercios.bulkWrite).not.toHaveBeenCalled();
  });

  it('se niega a escribir en una base que ya tiene comercios reales', async () => {
    comercios.exists.mockResolvedValue({ _id: 'real' });
    await seeder.onApplicationBootstrap();
    expect(comercios.bulkWrite).not.toHaveBeenCalled();
    expect(usuarios.bulkWrite).not.toHaveBeenCalled();
  });

  it('crea al menos cinco comercios activos sin pisar los existentes', async () => {
    await seeder.onApplicationBootstrap();
    const operaciones = comercios.bulkWrite.mock.calls[0][0] as OperacionUpsert[];
    const activos = operaciones.filter((op) => op.updateOne.update.$setOnInsert['estado'] === 'activo');
    expect(activos.length).toBeGreaterThanOrEqual(5);
    expect(operaciones.every((op) => op.updateOne.upsert)).toBe(true);
    expect(operaciones).toHaveLength(COMERCIOS_DEMO.length);
  });

  it('da a cada comercio una cuenta de administrador con la contraseña cifrada', async () => {
    await seeder.onApplicationBootstrap();
    const operaciones = usuarios.bulkWrite.mock.calls[0][0] as OperacionUpsert[];
    expect(operaciones).toHaveLength(USUARIOS_DEMO.length);
    const cuentas = operaciones.map((op) => op.updateOne.update.$setOnInsert);
    for (const comercio of COMERCIOS_DEMO) {
      expect(cuentas.some((c) => String(c['comercioId']) === comercio.id && c['rol'] === 'comercio_admin')).toBe(true);
    }
    expect(cuentas.every((c) => c['passwordHash'] !== 'clave-de-prueba')).toBe(true);
    expect(cuentas.every((c) => String(c['email']).endsWith('@doogking.test'))).toBe(true);
  });

  it('pone dirección legible a los listados demo que no la tienen', async () => {
    pendientes = [{ _id: 'x', vertical: 'alojamiento', titulo: 'Villa Canina Retiro', ubicacion: { ciudad: 'Madrid' } }];
    await seeder.onApplicationBootstrap();
    expect(servicios.updateOne).toHaveBeenCalledWith({ _id: 'x' }, { $set: { slug: 'villa-canina-retiro-madrid' } });
  });

  it('no rompe el arranque si la base falla', async () => {
    comercios.exists.mockRejectedValue(new Error('sin conexión'));
    await expect(seeder.onApplicationBootstrap()).resolves.toBeUndefined();
  });
});
