import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DomainException } from '../../shared/exceptions/domain.exception';

/** Perfil normalizado extraído de un proveedor social tras verificar su token. */
export interface PerfilSocial {
  email: string;
  nombre: string;
  avatarUrl?: string;
}

interface GoogleTokenInfo {
  aud?: string;
  email?: string;
  email_verified?: string | boolean;
  name?: string;
  picture?: string;
}

interface FacebookDebug {
  data?: { app_id?: string; is_valid?: boolean };
}

interface FacebookPerfil {
  id?: string;
  name?: string;
  email?: string;
  picture?: { data?: { url?: string } };
}

@Injectable()
export class SocialAuthService {
  private readonly logger = new Logger(SocialAuthService.name);

  constructor(private readonly config: ConfigService) {}

  /**
   * Verifica un ID token de Google contra el endpoint oficial de tokeninfo
   * (comprueba firma y expiración) y valida que la audiencia sea nuestro cliente.
   */
  async verificarGoogle(idToken: string): Promise<PerfilSocial> {
    const clientId = this.config.get<string>('GOOGLE_CLIENT_ID');
    if (!clientId) {
      throw new DomainException('El login con Google no está configurado', 503);
    }

    const info = await this.pedirJson<GoogleTokenInfo>(
      `https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(idToken)}`,
      'Google',
    );

    if (info.aud !== clientId) {
      throw new DomainException('El token de Google no pertenece a esta aplicación', 401);
    }
    if (!info.email || info.email_verified === false || info.email_verified === 'false') {
      throw new DomainException('Tu email de Google no está verificado', 401);
    }

    return { email: info.email, nombre: info.name ?? info.email.split('@')[0], avatarUrl: info.picture };
  }

  /**
   * Verifica un access token de Facebook: primero confirma que pertenece a
   * nuestra app (debug_token) y luego obtiene el perfil (nombre, email, foto).
   */
  async verificarFacebook(accessToken: string): Promise<PerfilSocial> {
    const appId = this.config.get<string>('FACEBOOK_APP_ID');
    const appSecret = this.config.get<string>('FACEBOOK_APP_SECRET');
    if (!appId || !appSecret) {
      throw new DomainException('El login con Meta no está configurado', 503);
    }

    const appToken = `${appId}|${appSecret}`;
    const debug = await this.pedirJson<FacebookDebug>(
      `https://graph.facebook.com/debug_token?input_token=${encodeURIComponent(accessToken)}&access_token=${encodeURIComponent(appToken)}`,
      'Meta',
    );
    if (!debug.data?.is_valid || debug.data.app_id !== appId) {
      throw new DomainException('El token de Meta no es válido para esta aplicación', 401);
    }

    const perfil = await this.pedirJson<FacebookPerfil>(
      `https://graph.facebook.com/me?fields=id,name,email,picture.type(large)&access_token=${encodeURIComponent(accessToken)}`,
      'Meta',
    );
    if (!perfil.email) {
      // Meta permite cuentas sin email (o que no lo comparten): no podemos identificar al usuario.
      throw new DomainException(
        'Tu cuenta de Meta no comparte un email. Regístrate con Google o con tu correo.',
        422,
      );
    }

    return { email: perfil.email, nombre: perfil.name ?? perfil.email.split('@')[0], avatarUrl: perfil.picture?.data?.url };
  }

  private async pedirJson<T>(url: string, proveedor: string): Promise<T> {
    let respuesta: Response;
    try {
      respuesta = await fetch(url);
    } catch (error) {
      this.logger.error(`Fallo de red verificando token de ${proveedor}: ${String(error)}`);
      throw new DomainException(`No se pudo contactar con ${proveedor}. Inténtalo de nuevo.`, 502);
    }
    if (!respuesta.ok) {
      throw new DomainException(`El token de ${proveedor} no es válido`, 401);
    }
    return respuesta.json() as Promise<T>;
  }
}
