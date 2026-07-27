import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  CalendarConnector, EventoCalendario, NuevoEventoCalendario, ProveedorCalendario, TokensCalendario,
} from './calendar-connector.interface';
import { DomainException } from '../../shared/exceptions/domain.exception';

const AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth';
const TOKEN_URL = 'https://oauth2.googleapis.com/token';
const API_URL = 'https://www.googleapis.com/calendar/v3/calendars/primary/events';
const SCOPE = 'https://www.googleapis.com/auth/calendar.events';

/**
 * Conector de Google Calendar.
 *
 * Requiere `GOOGLE_CALENDAR_CLIENT_ID` y `GOOGLE_CALENDAR_CLIENT_SECRET`. Sin
 * ellas el conector **se declara no configurado** y la agenda funciona igual en
 * local: lo único que se pierde es la sincronización externa.
 */
@Injectable()
export class GoogleCalendarConnector implements CalendarConnector {
  readonly proveedor: ProveedorCalendario = 'google';

  private readonly logger = new Logger(GoogleCalendarConnector.name);
  private readonly clientId?: string;
  private readonly clientSecret?: string;
  private readonly redirectUri: string;

  constructor(private readonly config: ConfigService) {
    this.clientId = config.get<string>('GOOGLE_CALENDAR_CLIENT_ID');
    this.clientSecret = config.get<string>('GOOGLE_CALENDAR_CLIENT_SECRET');
    this.redirectUri = `${config.get<string>('API_URL') ?? 'http://localhost:3000'}/agenda/oauth/google`;
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
      scope: SCOPE,
      // `offline` + `consent` garantizan que llegue refresh token también en
      // reconexiones; sin él la sincronización moriría al caducar el acceso.
      access_type: 'offline',
      prompt: 'consent',
      state: estado,
    });

    return `${AUTH_URL}?${params.toString()}`;
  }

  async canjearCodigo(codigo: string): Promise<TokensCalendario> {
    return this.pedirTokens({
      code: codigo,
      redirect_uri: this.redirectUri,
      grant_type: 'authorization_code',
    });
  }

  async refrescar(refreshToken: string): Promise<TokensCalendario> {
    const tokens = await this.pedirTokens({
      refresh_token: refreshToken,
      grant_type: 'refresh_token',
    });
    // Google no reenvía el refresh token al refrescar: se conserva el anterior.
    return { ...tokens, refreshToken: tokens.refreshToken ?? refreshToken };
  }

  async listarEventos(
    tokens: TokensCalendario,
    desde: Date,
    hasta: Date,
  ): Promise<EventoCalendario[]> {
    const params = new URLSearchParams({
      timeMin: desde.toISOString(),
      timeMax: hasta.toISOString(),
      singleEvents: 'true',
      orderBy: 'startTime',
      maxResults: '250',
    });

    const datos = await this.llamar<{
      items?: Array<{
        id?: string; summary?: string; transparency?: string;
        start?: { dateTime?: string; date?: string };
        end?: { dateTime?: string; date?: string };
      }>;
    }>(`${API_URL}?${params.toString()}`, tokens);

    return (datos.items ?? [])
      .filter((e) => e.id && (e.start?.dateTime || e.start?.date))
      .map((e) => ({
        externalEventId: e.id!,
        titulo: e.summary ?? 'Ocupado',
        inicio: new Date(e.start!.dateTime ?? e.start!.date!),
        fin: new Date(e.end?.dateTime ?? e.end?.date ?? e.start!.dateTime ?? e.start!.date!),
        // `transparent` significa "libre" en Google: no bloquea la agenda.
        ocupado: e.transparency !== 'transparent',
      }));
  }

  async crearEvento(tokens: TokensCalendario, evento: NuevoEventoCalendario): Promise<string> {
    const creado = await this.llamar<{ id?: string }>(API_URL, tokens, {
      method: 'POST',
      body: JSON.stringify({
        summary: evento.titulo,
        description: evento.descripcion,
        start: { dateTime: evento.inicio.toISOString(), timeZone: evento.zonaHoraria },
        end: { dateTime: evento.fin.toISOString(), timeZone: evento.zonaHoraria },
      }),
    });

    if (!creado.id) {
      throw new DomainException('Google no devolvió el evento creado', 502);
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
        ...extra,
      }).toString(),
    });

    if (!respuesta.ok) {
      throw new DomainException('Google rechazó la autorización del calendario', 502);
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
      this.logger.warn(`Google Calendar respondió ${respuesta.status} en ${url}`);
      throw new DomainException('No se pudo hablar con Google Calendar', 502);
    }

    // DELETE devuelve 204 sin cuerpo.
    return respuesta.status === 204 ? ({} as T) : ((await respuesta.json()) as T);
  }

  private exigirConfiguracion(): void {
    if (!this.estaConfigurado) {
      throw new DomainException(
        'La sincronización con Google Calendar no está configurada en este entorno.',
        503,
      );
    }
  }
}
