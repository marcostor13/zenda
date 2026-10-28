# Plan — Reservar como invitado (sin cuenta)

Fecha: 2026-10-28 · Estado: **IMPLEMENTADO**

## Objetivo

Que un cliente pueda reservar y pagar un servicio sin registrarse, y que el
administrador vea esas reservas con los datos de contacto del invitado.

## Diseño

**Cuenta de invitado en la sombra.** Al pasar del paso 2 («Tus datos») al pago, el
asistente llama a `POST /auth/invitado` con nombre, email, teléfono y la aceptación
de condiciones. El API crea, o reutiliza por email, un `Usuario` con
`invitado: true`, sin contraseña, y devuelve un JWT de 6 h. Así `reservas.usuarioId`,
los pagos, las liquidaciones y los correos siguen funcionando sin cambios.

**Seguridad**

- Si el email es de una cuenta real, responde 409 («inicia sesión»). La sesión se da
  sin contraseña, así que darla sobre una cuenta ajena equivaldría a entrar en ella.
- La sesión de invitado sólo abre las rutas marcadas con `@PermiteInvitado()`. Lo
  comprueba `JwtAuthGuard`, y la marca se lee de la base de datos en `JwtStrategy`.
  - Rutas abiertas: crear reserva, ver reserva por código o id, PaymentIntent,
    sincronizar pago, bypass de pruebas y validar cupón.
  - Nada que liste datos de la cuenta: «mis reservas», perros o favoritos. Quien
    escriba el email de otro invitado obtiene la misma sesión.
- Una cuenta de invitado reutilizada no se modifica. El nombre y el teléfono de cada
  reserva se congelan en `reserva.contactoInvitado`. El email sale siempre del token,
  nunca del cuerpo de la petición.

**De invitado a cuenta**

Registrarse con el mismo email conserva las reservas. La cuenta deja de ser de
invitado cuando el dueño demuestra que el correo es suyo, de cualquiera de estas
formas:

- Verifica el email.
- Restablece la contraseña. Al invitado se le manda el enlace, no el aviso de cuenta
  social.
- Entra con Google o Meta.

**Front**

- `/reservas/:vertical/:id` (el asistente) es público.
- `/reservas/:codigo` acepta la sesión de invitado (`sesionOInvitadoGuard`).
- El resto de `/reservas` pide cuenta.
- La sesión de invitado vive en `sessionStorage` (`SesionInvitadoService`), separada
  de `AuthService`, para que la cabecera no aparente que hay sesión iniciada.
- El interceptor manda el token de invitado sólo si no hay sesión normal.

## Hecho

| # | Bloque | Ficheros clave |
|---|---|---|
| 1 | DTO `IniciarInvitadoDto`, `ContactoInvitado`, `contacto` en `CrearReservaDto` | `libs/shared/src/dtos/auth/invitado.dto.ts`, `dtos/bookings/crear-reserva.dto.ts` |
| 2 | `Usuario.invitado`; registro, recuperación y social convierten al invitado | `users/usuario.schema.ts`, `users.repository.ts`, `auth/auth.service.ts` |
| 3 | `POST /auth/invitado` (throttle de `auth`) | `auth/auth.controller.ts` |
| 4 | `@PermiteInvitado` + `JwtAuthGuard` recortado; `JwtStrategy` marca `invitado` | `auth/guards/jwt-auth.guard.ts`, `strategies/jwt.strategy.ts` |
| 5 | Disponibilidad y calendario sin sesión (paso 1 del invitado) | `bookings/bookings.controller.ts`, `bookings.service.ts` |
| 6 | `reserva.contactoInvitado` (correo de confirmación y panel del comercio lo usan) | `reserva.schema.ts`, `notifications.service.ts`, `comercios.service.ts` |
| 7 | Admin: cliente/email/teléfono del invitado, etiqueta «Invitado», filtro `tipoCliente`, CSV | `admin.service.ts`, `admin-reservas.component.ts`, `admin-usuarios.component.ts` |
| 8 | Asistente: aviso en el paso 2, alta de la sesión, contacto en la reserva, vuelta de 3-D Secure a `/reservas/:codigo`, confirmación sin «Mis reservas» | `reserva-wizard.component.ts`, `reserva-detalle.component.ts` |
| 9 | Rutas, guard e interceptores | `reservas.routes.ts`, `app.routes.ts`, `core/guards/sesion-o-invitado.guard.ts`, `core/interceptors/*` |
| 10 | i18n de los textos nuevos (7 idiomas) | `core/i18n/traducciones/*/reservas.ts`, `admin.ts` |

## Pendiente / fuera de alcance

- El flujo propio de transporte (`/transporte/viaje/reserva`) y el carrito
  (`/reservas/viaje-pago`) siguen pidiendo cuenta.
- El invitado no puede cancelar ni aceptar ajustes desde la web: tiene que crearse
  la cuenta con el mismo correo.
