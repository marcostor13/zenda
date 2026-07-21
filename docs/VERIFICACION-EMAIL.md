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
2. El correo enlaza a `FRONTEND_URL/auth/verificar?token=…`.
3. Al abrirlo, el frontend llama a `POST /auth/verificar-email`; el backend
   valida el token, marca la cuenta como verificada y **devuelve la sesión** →
   redirige por rol (cliente, comercio o admin).
4. Si intenta entrar sin verificar, el login responde `403` y la pantalla
   ofrece **reenviar** el correo (`POST /auth/reenviar-verificacion`).

## Variables de entorno (Coolify → backend)

Siempre hace falta la URL pública del frontend (para el enlace del correo):

```
FRONTEND_URL=https://TU-DOMINIO-WEB      # base del enlace de verificación
```

Y una de estas dos opciones de envío:

### Opción A — Gmail (recomendada, la que estás usando)

```
EMAIL_USER=tu-cuenta@gmail.com
EMAIL_PASSWORD=xxxxxxxxxxxxxxxx          # CONTRASEÑA DE APLICACIÓN de Google (16 caracteres)
EMAIL_FROM=Doogking <tu-cuenta@gmail.com>   # opcional; por defecto usa EMAIL_USER
```

> **Importante:** `EMAIL_PASSWORD` NO es la contraseña normal de tu Gmail. Es
> una **contraseña de aplicación**:
> 1. Activa la **verificación en 2 pasos** en tu cuenta de Google
>    (myaccount.google.com → Seguridad).
> 2. Entra en **Contraseñas de aplicaciones**
>    (myaccount.google.com/apppasswords), crea una nueva (nombre: "Doogking").
> 3. Copia los 16 caracteres que te da y ponlos en `EMAIL_PASSWORD` (sin
>    espacios).
>
> Gmail gratuito permite ~500 correos/día, suficiente para empezar. Para más
> volumen, usa la opción B con un proveedor transaccional (Mailgun, Resend,
> SendGrid…).

### Opción B — SMTP genérico

```
SMTP_HOST=smtp.tu-proveedor.com
SMTP_PORT=587
SMTP_SECURE=false                        # true si usas puerto 465
SMTP_USER=usuario-smtp
SMTP_PASS=contraseña-smtp
SMTP_FROM=Doogking <no-reply@tu-dominio.com>
```

Si están las dos, **Gmail (EMAIL_USER) tiene prioridad**.

> **Sin ninguna configurada** el API no se cae: el registro funciona, pero el
> correo no se envía. En ese caso el enlace de verificación se escribe en los
> **logs** del backend (`Verificación (sin email configurado) para …: https://…`)
> para poder probar el flujo en desarrollo.

## Notas

- El token se guarda con caducidad de 24 h; al verificar se elimina.
- El reenvío no revela si un email existe (responde `ok` siempre) y solo envía
  de nuevo si la cuenta está realmente pendiente.
- Las cuentas creadas antes de esta función siguen entrando con normalidad
  (el bloqueo solo aplica a registros locales marcados como pendientes).
