import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { JwtPayload } from '../auth.service';
import { UsersRepository } from '../../users/users.repository';

/**
 * Cuánto se reutiliza la comprobación en base de datos antes de repetirla. Es el
 * retardo máximo con el que surte efecto desactivar una cuenta o cambiarle el
 * rol; medio minuto es inmediato a efectos prácticos y evita una consulta a
 * Mongo por cada petición del usuario.
 */
const VALIDEZ_CACHE_MS = 30_000;

/** Tope de la caché. Al llegar se vacía entera: es efímera, no hace falta LRU. */
const MAX_ENTRADAS_CACHE = 5_000;

interface EntradaCache {
  payload: JwtPayload;
  expiraEn: number;
}

/**
 * Valida el token de sesión.
 *
 * Antes se devolvía el payload firmado tal cual, sin mirar la base de datos.
 * Como `rol` y `comercioId` viajan dentro del token y son la base de todo el
 * control de acceso, desactivar a un empleado, cambiarle el rol o desvincularlo
 * de su comercio no surtía efecto hasta que el token caducaba —siete días
 * después—. Ahora el rol y el comercio se leen de la cuenta en cada petición
 * (con una caché de segundos), y el token sólo dice *quién* es.
 */
@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  private readonly cache = new Map<string, EntradaCache>();

  constructor(
    config: ConfigService,
    private readonly usersRepository: UsersRepository,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: config.getOrThrow<string>('JWT_SECRET'),
    });
  }

  async validate(payload: JwtPayload): Promise<JwtPayload> {
    const cacheado = this.leerCache(payload.sub);
    if (cacheado) return cacheado;

    const usuario = await this.usersRepository.findById(payload.sub);

    // Cuenta borrada o desactivada: el token sigue siendo criptográficamente
    // válido, pero ya no representa a nadie con acceso.
    if (!usuario || usuario.activo === false) {
      throw new UnauthorizedException('Tu sesión ya no es válida. Vuelve a entrar.');
    }

    const vigente: JwtPayload = {
      sub: usuario.id,
      email: usuario.email,
      rol: usuario.rol,
      comercioId: usuario.comercioId?.toString(),
    };

    this.escribirCache(payload.sub, vigente);
    return vigente;
  }

  private leerCache(usuarioId: string): JwtPayload | null {
    const entrada = this.cache.get(usuarioId);
    if (!entrada) return null;

    if (entrada.expiraEn <= Date.now()) {
      this.cache.delete(usuarioId);
      return null;
    }

    return entrada.payload;
  }

  private escribirCache(usuarioId: string, payload: JwtPayload): void {
    if (this.cache.size >= MAX_ENTRADAS_CACHE) {
      this.cache.clear();
    }

    this.cache.set(usuarioId, { payload, expiraEn: Date.now() + VALIDEZ_CACHE_MS });
  }
}
