import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import {
  Agenda, AgendaSchema, Bloqueo, BloqueoSchema, Recurso, RecursoSchema,
} from './agenda.schema';
import { AgendaService } from './agenda.service';
import { AgendaController } from './agenda.controller';
import { GoogleCalendarConnector } from './google-calendar.connector';
import { MicrosoftCalendarConnector } from './microsoft-calendar.connector';
import { CALENDAR_CONNECTORS } from './calendar-connector.interface';

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
  ],
  controllers: [AgendaController],
  providers: [
    AgendaService,
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
