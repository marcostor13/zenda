import { getModelToken } from '@nestjs/mongoose';
import { Test, TestingModule } from '@nestjs/testing';
import { Comercio } from '../comercios/comercio.schema';
import { Reserva } from '../bookings/reserva.schema';
import { Consentimiento } from './consentimiento.schema';
import { PerroHistorial } from './perro-historial.schema';
import { PerroValoracion } from './perro-valoracion.schema';
import { PerroVersion } from './perro-version.schema';
import { Perro } from './perro.schema';
import { PerrosController } from './perros.controller';
import { PerrosModule } from './perros.module';
import { InformePerroService } from './informe/informe-perro.service';

/**
 * El grafo de dependencias del módulo, montado de verdad.
 *
 * Los unitarios de servicio y de controller trabajan con dobles, así que no ven
 * si al módulo le falta declarar un proveedor o registrar un modelo: eso sólo
 * revienta al arrancar el API. Añadir el informe trajo las dos cosas —un
 * servicio nuevo y la colección de comercios para firmar cada anotación—, y
 * esta prueba es lo que confirma que están donde tienen que estar.
 */
describe('PerrosModule', () => {
  let modulo: TestingModule;

  /** Modelo de mentira: aquí no se consulta nada, sólo se resuelven dependencias. */
  const modelo = () => ({ find: jest.fn(), findById: jest.fn(), exists: jest.fn() });

  const COLECCIONES = [
    Perro, PerroHistorial, PerroValoracion, PerroVersion, Consentimiento, Reserva, Comercio,
  ];

  beforeAll(async () => {
    const constructor = Test.createTestingModule({ imports: [PerrosModule] });
    for (const coleccion of COLECCIONES) {
      constructor.overrideProvider(getModelToken(coleccion.name)).useValue(modelo());
    }
    modulo = await constructor.compile();
  });

  afterAll(async () => {
    await modulo.close();
  });

  it('debería resolver el servicio del informe con sus dependencias', () => {
    expect(modulo.get(InformePerroService)).toBeInstanceOf(InformePerroService);
  });

  it('debería exponer la descarga del informe en el controller', () => {
    const controller = modulo.get(PerrosController);

    expect(typeof controller.descargarInforme).toBe('function');
  });
});
