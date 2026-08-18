import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { DomainException } from '../../shared/exceptions/domain.exception';

/** A qué agenda y de qué comercio vuelve la autorización del proveedor. */
export interface EstadoOauth {
  agendaId: string;
  comercioId: string;
}

/**
 * Marca este token como "state de OAuth de agenda" y **sólo** eso. Va firmado
 * con el mismo secreto que las sesiones, así que sin esta audiencia un state
 * podría intentar colarse como token de acceso, o al revés.
 */
const AUDIENCIA = 'agenda-oauth';

/**
 * Diez minutos: el tiempo de ir al consentimiento del proveedor y volver. Una
 * ventana corta reduce a casi nada el margen para reutilizar un state capturado.
 */
const VALIDEZ = '10m';

/**
 * Firma y verifica el `state` del OAuth de calendario.
 *
 * Existe por un fallo real: el `state` era `base64url(JSON)` —codificación, no
 * firma— pese a que el comentario del controller afirmaba que iba firmado.
 * Cualquiera podía fabricar el state de otro comercio y llamar al callback con
 * su propio `code`, enganchando su calendario a una agenda ajena (o llevándose
 * los tokens del comercio a la suya). El callback no puede exigir sesión —lo
 * invoca el proveedor, no el navegador del usuario—, así que la única prueba de
 * autoría posible es que el `state` venga firmado por nosotros.
 */
@Injectable()
export class OauthStateService {
  constructor(private readonly jwtService: JwtService) {}

  firmar(estado: EstadoOauth): string {
    return this.jwtService.sign(
      { agendaId: estado.agendaId, comercioId: estado.comercioId },
      { audience: AUDIENCIA, expiresIn: VALIDEZ },
    );
  }

  /** @throws DomainException 400 si el state no es nuestro, caducó o viene incompleto. */
  verificar(state: string): EstadoOauth {
    let payload: Partial<EstadoOauth>;

    try {
      payload = this.jwtService.verify<Partial<EstadoOauth>>(state, { audience: AUDIENCIA });
    } catch {
      throw new DomainException('La autorización del calendario no es válida o ha caducado.', 400);
    }

    if (!payload.agendaId || !payload.comercioId) {
      throw new DomainException('La autorización del calendario no es válida o ha caducado.', 400);
    }

    return { agendaId: payload.agendaId, comercioId: payload.comercioId };
  }
}
