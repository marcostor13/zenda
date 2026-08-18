import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import {
  Agenda, AgendaSchema, Bloqueo, BloqueoSchema, Recurso, RecursoSchema,
} from './agenda.schema';
import { AgendaService } from './agenda.service';
import { AgendaController } from './agenda.controller';
import { GoogleCalendarConnector } from './google-calendar.connector';
import { MicrosoftCalendarConnector } from './microsoft-calendar.connector';
import { CALENDAR_CONNECTORS } from './calendar-connector.interface';
import { OauthStateService } from './oauth-state.service';

/**
 * Agenda de trabajadores y recursos, con sincronización de calendario.
 *
 * Los conectores se inyectan como **lista tras un token de DI**: añadir un
 * proveedor nuevo es registrarlo aquí, sin tocar `AgendaService` (§18-D).
 */
@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Agenda.name, schema: AgendaSchema },
      { name: Recurso.name, schema: RecursoSchema },
      { name: Bloqueo.name, schema: BloqueoSchema },
    ]),
    // Firma el `state` del OAuth de calendario. La audiencia del token lo
    // mantiene separado de las sesiones aunque comparta secreto.
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.getOrThrow<string>('JWT_SECRET'),
      }),
    }),
  ],
  controllers: [AgendaController],
  providers: [
    AgendaService,
    OauthStateService,
    GoogleCalendarConnector,
    MicrosoftCalendarConnector,
    {
      provide: CALENDAR_CONNECTORS,
      inject: [GoogleCalendarConnector, MicrosoftCalendarConnector],
      useFactory: (google: GoogleCalendarConnector, microsoft: MicrosoftCalendarConnector) =>
        [google, microsoft],
    },
  ],
  exports: [AgendaService],
})
export class AgendaModule {}
