# Horarios, citas y agenda — análisis de zona horaria y corrección

> Petición del cliente (2026-09-13): los horarios que pone el comercio no cuadran con lo
> que se ve en la web, y la agenda no muestra las citas en la fecha, la hora y con la
> duración reservadas.

## 1. Cómo estaba el flujo

| Paso | Qué hacía | Problema |
|---|---|---|
| Horario semanal del servicio (panel → ficha pública) | Se guarda y se pinta como texto `"10:00"` | Correcto. El único fallo era "hoy", que se marcaba con el día del navegador. |
| Asistente de reserva — veterinaria y peluquería | Mandaba `fechaInicio: "2026-09-21"` y la hora aparte en `detalle.hora` | La cita quedaba a **medianoche UTC** (02:00 en Madrid) y **sin fin**. |
| Asistente — transporte y funerarios | Mandaba `"2026-09-21T10:00:00"` sin zona | El API la leía con la zona del **servidor** (UTC en producción) → 12:00 en Madrid en verano. |
| Reservas recurrentes | La hora se fijaba con `setUTCHours` | "Los martes a las 10:00" = 12:00 en Madrid. |
| Crear reserva | No miraba el horario del servicio | Se podía reservar a las 03:00, en domingo o en un festivo. |
| Agenda del comercio (`/mi-agenda/citas`) | Cita sin fin → "ocupa su día" | Bloque de **24 h** empezando a las 02:00. |
| Agenda de profesionales (`huecosDe`) | `getDay()`/`setHours()` del servidor | Jornada "9:00–14:00" ofrecía huecos de 11:00 a 16:00 en Madrid. `zonaHoraria` existía en el esquema y nadie la usaba. |
| Web: `| date`, `toLocaleDateString`, rejilla de la agenda | Zona del navegador | Desde fuera de España (p. ej. Lima, UTC−5) horas y días desplazados. |
| Informe PDF | `getDate()` del servidor | Una vacuna del 12 de marzo salía "11 mar" al oeste de Greenwich. |

## 2. Regla adoptada

**La hora de la plataforma es la del comercio: `Europe/Madrid`** (`ZONA_HORARIA_PLATAFORMA`
en `libs/shared/src/fechas/zona-horaria.ts`). Una cita a las 10:00 son las 10:00 en la
clínica, lo mire quien lo mire. Los días sin hora (estancias) siguen el convenio de
medianoche UTC que ya usaba el inventario.

`TODO`: con comercios fuera de la zona peninsular (Canarias, Portugal, Grecia) habrá que
guardar la zona en el comercio y pasarla a las mismas funciones.

## 3. Correcciones

**Shared** — `zona-horaria.ts`: partes de un instante en la zona, instante de una fecha y
hora de pared (correcto en los cambios de hora), `parsearFechaPlataforma`,
`comprobarHorario` (tramos, jornada partida, días cerrados y días especiales).

**API**
- `BookingsController` y `CarritoService` leen las fechas con `parsearFechaPlataforma`.
- `BookingsService.crear` / `comprobarDisponibilidad`: combina día + `detalle.hora` en hora
  de Madrid; si la estrategia informa `duracionMin`, calcula `fechaFin` (una cita por
  mascota) y guarda `detalle.duracionMin`; rechaza con 409 (o avisa en el paso 1) la cita
  fuera de horario. Recurrencias en el calendario de Madrid.
- `momento-reserva.util.ts`: reconstruye al leer las citas **antiguas** (medianoche + hora
  aparte, sin fin) para la agenda, `/comercios/mis-reservas` y `/reservas/mis`. Sin migración.
- `AgendaService.huecosDe`: usa `agenda.zonaHoraria`.
- Informe PDF: fechas en el calendario de Madrid.

**Web**
- `FechaPipe` (`name: 'date'`) sustituye a la de Angular en 31 componentes: formatea con el
  desfase de Madrid de cada fecha. Los `toLocaleDateString` de reservas llevan `timeZone`.
- Asistente de reserva: manda el instante exacto (veterinaria, peluquería, transporte, funerarios).
- Agenda del comercio: coloca citas y bloqueos con `aCalendarioComercio`, pide el periodo desde
  la medianoche de Madrid y guarda los cierres escritos en hora de Madrid.
- `hoyLocal()` es el hoy de Madrid.

## 4. Pruebas
- `libs/shared/src/fechas/zona-horaria.spec.ts` (verano, invierno, cambios de hora, horario).
- API unitarias: `bookings.service.spec` (citas con hora, duración, horario, recurrencia en
  invierno), `momento-reserva.util.spec`, `bloqueos.service.spec`, `agenda.service.spec`
  (reescrito con zonas explícitas: dependía de la zona del equipo).
- API E2E: `test/citas-horario.e2e-spec.ts`.
- Web: `fecha.pipe.spec`, `fechas.spec`, specs del asistente y la agenda.
- Playwright: `e2e/horarios-zona.spec.ts` con el navegador en `America/Lima`.

## 5. Queda fuera (anotado)
- Las estrategias de cita siguen contando **cupos diarios**, no solapes por hora: dos clientes
  pueden coger la misma hora si quedan cupos. Resolverlo es un motor de huecos por servicio.
- Adiestramiento reserva por día (sin hora), así que en la agenda sigue ocupando el día.
