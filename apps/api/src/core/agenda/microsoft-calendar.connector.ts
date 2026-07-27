import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  CalendarConnector, EventoCalendario, NuevoEventoCalendario, ProveedorCalendario, TokensCalendario,
} from './calendar-connector.interface';
import { DomainException } from '../../shared/exceptions/domain.exception';

const AUTH_URL = 'https://login.microsoftonline.com/common/oauth2/v2.0/authorize';
const TOKEN_URL = 'https://login.microsoftonline.com/common/oauth2/v2.0/token';
const API_URL = 'https://graph.microsoft.com/v1.0/me/events';
const SCOPE = 'offline_access Calendars.ReadWrite';

/**
 * Conector de Outlook / Microsoft 365 vía Graph.
 *
 * Misma interfaz que Google, lo que confirma que el contrato aguanta: el
 * servicio de agenda no distingue entre proveedores. Requiere
 * `MICROSOFT_CALENDAR_CLIENT_ID` y `MICROSOFT_CALENDAR_CLIENT_SECRET`.
 */
@Injectable()
export class MicrosoftCalendarConnector implements CalendarConnector {
  readonly proveedor: ProveedorCalendario = 'microsoft';

  private readonly logger = new Logger(MicrosoftCalendarConnector.name);
  private readonly clientId?: string;
  private readonly clientSecret?: string;
  private readonly redirectUri: string;

  constructor(config: ConfigService) {
    this.clientId = config.get<string>('MICROSOFT_CALENDAR_CLIENT_ID');
    this.clientSecret = config.get<string>('MICROSOFT_CALENDAR_CLIENT_SECRET');
    this.redirectUri = `${config.get<string>('API_URL') ?? 'http://localhost:3000'}/agenda/oauth/microsoft`;
  }

  get estaConfigurado(): boolean {
    return Boolean(this.clientId && this.clientSecret);
  }

  urlAutorizacion(estado: string): string {
    this.exigirConfiguracion();

    const params = new URLSearchParams({
      client_id: this.clientId!,
      redirect_uri: this.redirectUri,
      response_type: 'code',
      response_mode: 'query',
      scope: SCOPE,
      state: estado,
    });

    return `${AUTH_URL}?${params.toString()}`;
  }

  canjearCodigo(codigo: string): Promise<TokensCalendario> {
    return this.pedirTokens({
      code: codigo,
      redirect_uri: this.redirectUri,
      grant_type: 'authorization_code',
    });
  }

  refrescar(refreshToken: string): Promise<TokensCalendario> {
    return this.pedirTokens({ refresh_token: refreshToken, grant_type: 'refresh_token' });
  }

  async listarEventos(
    tokens: TokensCalendario,
    desde: Date,
    hasta: Date,
  ): Promise<EventoCalendario[]> {
    const params = new URLSearchParams({
      startDateTime: desde.toISOString(),
      endDateTime: hasta.toISOString(),
      $top: '250',
    });

    const datos = await this.llamar<{
      value?: Array<{
        id?: string; subject?: string; showAs?: string;
        start?: { dateTime?: string }; end?: { dateTime?: string };
      }>;
    }>(`https://graph.microsoft.com/v1.0/me/calendarView?${params.toString()}`, tokens);

    return (datos.value ?? [])
      .filter((e) => e.id && e.start?.dateTime)
      .map((e) => ({
        externalEventId: e.id!,
        titulo: e.subject ?? 'Ocupado',
        inicio: new Date(e.start!.dateTime!),
        fin: new Date(e.end?.dateTime ?? e.start!.dateTime!),
        // `free` y `workingElsewhere` no bloquean; el resto sí.
        ocupado: !['free', 'workingElsewhere'].includes(e.showAs ?? 'busy'),
      }));
  }

  async crearEvento(tokens: TokensCalendario, evento: NuevoEventoCalendario): Promise<string> {
    const creado = await this.llamar<{ id?: string }>(API_URL, tokens, {
      method: 'POST',
      body: JSON.stringify({
        subject: evento.titulo,
        body: { contentType: 'text', content: evento.descripcion ?? '' },
        start: { dateTime: evento.inicio.toISOString(), timeZone: evento.zonaHoraria },
        end: { dateTime: evento.fin.toISOString(), timeZone: evento.zonaHoraria },
      }),
    });

    if (!creado.id) {
      throw new DomainException('Microsoft no devolvió el evento creado', 502);
    }
    return creado.id;
  }

  async eliminarEvento(tokens: TokensCalendario, externalEventId: string): Promise<void> {
    await this.llamar(`${API_URL}/${encodeURIComponent(externalEventId)}`, tokens, {
      method: 'DELETE',
    });
  }

  private async pedirTokens(extra: Record<string, string>): Promise<TokensCalendario> {
    this.exigirConfiguracion();

    const respuesta = await fetch(TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: this.clientId!,
        client_secret: this.clientSecret!,
        scope: SCOPE,
        ...extra,
      }).toString(),
    });

    if (!respuesta.ok) {
      throw new DomainException('Microsoft rechazó la autorización del calendario', 502);
    }

    const datos = (await respuesta.json()) as {
      access_token: string; refresh_token?: string; expires_in: number;
    };

    return {
      accessToken: datos.access_token,
      refreshToken: datos.refresh_token,
      expiraEn: new Date(Date.now() + datos.expires_in * 1000),
    };
  }

  private async llamar<T>(
    url: string,
    tokens: TokensCalendario,
    init: RequestInit = {},
  ): Promise<T> {
    const respuesta = await fetch(url, {
      ...init,
      headers: {
        Authorization: `Bearer ${tokens.accessToken}`,
        'Content-Type': 'application/json',
        ...(init.headers ?? {}),
      },
    });

    if (!respuesta.ok) {
      this.logger.warn(`Microsoft Graph respondió ${respuesta.status} en ${url}`);
      throw new DomainException('No se pudo hablar con Outlook', 502);
    }

    return respuesta.status === 204 ? ({} as T) : ((await respuesta.json()) as T);
  }

  private exigirConfiguracion(): void {
    if (!this.estaConfigurado) {
      throw new DomainException(
        'La sincronización con Outlook no está configurada en este entorno.',
        503,
      );
    }
  }
}
