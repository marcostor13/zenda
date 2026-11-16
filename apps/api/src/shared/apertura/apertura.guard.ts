import { CanActivate, ExecutionContext, Injectable, SetMetadata } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { DomainException } from '../exceptions/domain.exception';

/**
 * Lanzamiento por fases: la plataforma abre primero a los clientes (cuenta,
 * perros, favoritos, explorar) y deja reservar y dar de alta negocios para la
 * apertura de comercios. Cada fase es una variable de entorno, así que abrirla
 * es reiniciar el servicio, no desplegar.
 */
export enum Apertura {
  RESERVAS = 'RESERVAS_ABIERTAS',
  REGISTRO_COMERCIOS = 'REGISTRO_COMERCIOS_ABIERTO',
}

const MENSAJES: Readonly<Record<Apertura, string>> = {
  [Apertura.RESERVAS]: 'Las reservas abren muy pronto. Todavía no se pueden hacer reservas en Doogking.',
  [Apertura.REGISTRO_COMERCIOS]: 'El registro de negocios abre muy pronto. Todavía no se pueden dar de alta negocios.',
};

export const APERTURA_KEY = 'apertura';

/** Marca un endpoint como cerrado hasta que su fase de lanzamiento esté abierta. */
export const RequiereApertura = (apertura: Apertura) => SetMetadata(APERTURA_KEY, apertura);

/**
 * Cierra los endpoints marcados con `@RequiereApertura` mientras su variable no
 * valga `true`. Sin declarar, en producción se trata como cerrada —abrir es una
 * decisión explícita— y fuera de producción como abierta, para poder probar el
 * flujo entero en local sin configurar nada.
 *
 * 503: el servicio existe pero aún no está disponible; el cliente no ha hecho
 * nada mal (no es un 400) ni le falta permiso (no es un 403).
 *
 * Lee `process.env` (donde `ConfigModule` ya ha cargado el `.env`) en vez de
 * inyectar `ConfigService`: así el guard sólo depende de `Reflector`, que Nest
 * da en cualquier módulo, y los tests de cada controlador no tienen que
 * declararle dependencias que no usan.
 */
@Injectable()
export class AperturaGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const apertura = this.reflector.getAllAndOverride<Apertura | undefined>(APERTURA_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!apertura || this.estaAbierta(apertura)) return true;
    throw new DomainException(MENSAJES[apertura], 503);
  }

  estaAbierta(apertura: Apertura): boolean {
    const valor = process.env[apertura];
    if (valor === undefined || valor === '') return process.env.NODE_ENV !== 'production';
    return valor === 'true' || valor === '1';
  }
}
