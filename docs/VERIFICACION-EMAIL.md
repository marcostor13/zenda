# Verificación de email en el registro

Cuando alguien se registra con **correo y contraseña** (cliente o comercio),
la cuenta queda **pendiente de verificar el email** y no puede iniciar sesión
hasta confirmarlo. Los accesos con **Google o Meta** ya llegan verificados y
se saltan este paso.

## Flujo

1. Registro local (`/auth/registro` o `/auth/registro-comercio`): se crea la
   cuenta con `requiereVerificacionEmail = true`, se genera un token de un solo
   uso (caduca en 24 h) y se envía un correo con el enlace. **No** se inicia
   sesión todavía; la pantalla muestra "Verifica tu correo".
2. El correo enlaza a `APP_URL/auth/verificar?token=…`.
3. Al abrirlo, el frontend llama a `POST /auth/verificar-email`; el backend
   valida el token, marca la cuenta como verificada y **devuelve la sesión** →
   redirige por rol (cliente, comercio o admin).
4. Si intenta entrar sin verificar, el login responde `403` y la pantalla
   ofrece **reenviar** el correo (`POST /auth/reenviar-verificacion`).

## Variables de entorno (Coolify → backend)

Siempre hace falta la URL pública del frontend (para el enlace del correo). Es la
**misma variable `APP_URL`** que usan el resto de correos (valoraciones,
recuperación de reservas) — no una variable aparte:

```
APP_URL=https://TU-DOMINIO-WEB      # base del enlace de verificación y del resto de correos
```

Y la configuración de **Resend**, que es por donde sale todo el correo
transaccional de la plataforma:

```
RESEND_API_KEY=re_xxxxxxxxxxxxxxxxxxxx   # resend.com → API Keys
EMAIL_FROM=hola@doogking.com             # opcional; es el valor por defecto
EMAIL_FROM_NOMBRE=Doogking               # opcional; nombre que ve el destinatario
```

### Verificar el dominio (obligatorio)

Sin esto Resend **sólo acepta envíos a la dirección de la propia cuenta** y
responde 403 a cualquier otro destinatario, así que ningún cliente recibiría su
correo de verificación.

1. En resend.com → **Domains** → *Add Domain* → `doogking.com`.
2. Publicar en el DNS del dominio los registros que indique: un **TXT de SPF** y
   los **CNAME de DKIM**. Conviene añadir también el de DMARC que sugiere.
3. Esperar a que la ficha del dominio quede en **Verified** (suele ser minutos;
   la propagación de DNS puede tardar más).

El buzón `hola@doogking.com` no necesita existir como cuenta de correo para
*enviar* — Resend firma con el dominio —, pero conviene que exista y esté
atendido: es la dirección a la que responderá quien conteste al correo.

> **Sin `RESEND_API_KEY`** el API no se cae: el registro funciona, pero el correo
> no se envía. El intento queda como `fallido` en la colección `notificaciones`,
> con el motivo que devolvió Resend, y el enlace de verificación se escribe en
> los **logs** del backend (`Verificación (sin email configurado) para …:
> https://…`) para poder probar el flujo en desarrollo.

### Por qué Resend y no SMTP

Antes se enviaba con nodemailer contra Gmail o un SMTP genérico. El problema no
era el protocolo sino la entregabilidad: un correo de verificación que acaba en
spam es una cuenta que no se activa, y una cuenta de Gmail con contraseña de
aplicación no tiene SPF/DKIM del dominio propio, ni reputación, ni forma de
saber si el mensaje llegó. Resend firma con el dominio verificado y deja
registro de cada envío.

## Comprobarlo sin adivinar

```bash
# Sólo lectura: clave, dominios de la cuenta y si el remitente puede enviar
bun run --cwd apps/api diagnostico:email

# Envío real de prueba, cuando el dominio ya esté verificado
bun run --cwd apps/api diagnostico:email -- --enviar tu@correo.com
```

Es lo primero que hay que mirar cuando «no llegan los correos»: el motivo casi
nunca está en el código, sino en que el dominio del remitente no está verificado
en la cuenta de Resend que corresponde a la clave configurada.

## Notas

- El token se guarda con caducidad de 24 h; al verificar se elimina.
- El reenvío no revela si un email existe (responde `ok` siempre) y solo envía
  de nuevo si la cuenta está realmente pendiente.
- Las cuentas creadas antes de esta función siguen entrando con normalidad
  (el bloqueo solo aplica a registros locales marcados como pendientes).
