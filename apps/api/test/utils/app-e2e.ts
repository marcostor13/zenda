import { ValidationPipe, type INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { getConnectionToken } from '@nestjs/mongoose';
import type { Connection } from 'mongoose';
import { AppModule } from '../../src/app.module';
import { DomainExceptionFilter } from '../../src/shared/filters/domain-exception.filter';

/**
 * Arranque del API real para las pruebas E2E.
 *
 * Levanta el `AppModule` completo —todos los módulos, guards, pipes y filtros—
 * contra una MongoDB **en memoria**, nunca contra Atlas. Replica la
 * configuración de `main.ts` (validación global, filtro de excepciones de
 * dominio y prefijo `api/v1`) para que lo que se prueba aquí sea lo mismo que
 * se sirve en producción; si `main.ts` cambia, hay que reflejarlo aquí.
 */

export interface AppE2E {
  readonly app: INestApplication;
  readonly conexion: Connection;
  /** Vacía todas las colecciones sin tirar el servidor: aísla cada prueba. */
  limpiarBaseDeDatos(): Promise<void>;
  cerrar(): Promise<void>;
}

export async function crearAppE2E(): Promise<AppE2E> {
  const mongo = await MongoMemoryServer.create();

  // El AppModule lee la cadena de conexión de la configuración, así que hay que
  // dejarla puesta antes de compilar el módulo.
  process.env.MONGODB_URI = mongo.getUri();
  process.env.JWT_SECRET ??= 'secreto-de-pruebas-e2e';
  // Sin claves de Stripe reales: los E2E no cierran cobros contra la pasarela.
  process.env.STRIPE_SECRET_KEY ??= 'sk_test_e2e';
  process.env.STRIPE_WEBHOOK_SECRET ??= 'whsec_e2e';

  const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();

  const app = moduleRef.createNestApplication({ rawBody: true });
  app.useGlobalPipes(
    new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }),
  );
  app.useGlobalFilters(new DomainExceptionFilter());
  app.setGlobalPrefix('api/v1');
  await app.init();

  const conexion = app.get<Connection>(getConnectionToken());

  return {
    app,
    conexion,
    async limpiarBaseDeDatos() {
      const colecciones = await conexion.db!.collections();
      await Promise.all(colecciones.map((c) => c.deleteMany({})));
    },
    async cerrar() {
      await app.close();
      await mongo.stop();
    },
  };
}

/** Ruta absoluta de un endpoint, con el prefijo que aplica el bootstrap. */
export function ruta(camino: string): string {
  return `/api/v1${camino.startsWith('/') ? camino : `/${camino}`}`;
}
