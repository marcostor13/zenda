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

Para que los correos se envíen de verdad hay que configurar el SMTP y la URL
pública del frontend:

```
FRONTEND_URL=https://TU-DOMINIO-WEB      # base del enlace de verificación
SMTP_HOST=smtp.tu-proveedor.com
SMTP_PORT=587
SMTP_SECURE=false                        # true si usas puerto 465
SMTP_USER=usuario-smtp
SMTP_PASS=contraseña-smtp
SMTP_FROM=Doogking <no-reply@tu-dominio.com>
```

> **Sin SMTP configurado** el API no se cae: el registro funciona, pero el
> correo no se envía. En ese caso el enlace de verificación se escribe en los
> **logs** del backend (`Verificación (sin SMTP) para …: https://…`) para poder
> probar el flujo en desarrollo. En producción, configura SMTP.

## Notas

- El token se guarda con caducidad de 24 h; al verificar se elimina.
- El reenvío no revela si un email existe (responde `ok` siempre) y solo envía
  de nuevo si la cuenta está realmente pendiente.
- Las cuentas creadas antes de esta función siguen entrando con normalidad
  (el bloqueo solo aplica a registros locales marcados como pendientes).
