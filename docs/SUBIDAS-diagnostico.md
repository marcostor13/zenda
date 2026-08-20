# Subidas de imágenes y ficheros — inventario y diagnóstico

Revisión de todos los puntos donde la plataforma sube un fichero, a raíz de que
las fotos de iPhone sigan fallando en algún sitio.

## Inventario completo

Sólo hay **tres endpoints** y **tres caminos** en el frontend.

| Endpoint | Tope | Formatos | Quién lo usa |
|---|---|---|---|
| `POST /upload/image` | 5 MB | JPEG, PNG, WebP, GIF, HEIC | `rs-image-upload` (13 pantallas) |
| `POST /upload/documento` | 10 MB | PDF + las anteriores | Documentación del comercio |
| `POST /upload/video` | 50 MB | MP4, WebM, MOV | Vídeo de comportamiento en la reserva |

Las 13 pantallas que pasan por `rs-image-upload`:

| Origen | Pantalla |
|---|---|
| `comercio/logo`, `comercio/portada`, `comercio/galeria` | Perfil del negocio |
| `comercio/dni`, `comercio/licencia` | Verificación de identidad |
| `servicio/imagenes` | Alta y edición de servicio |
| `reserva/evidencia` | Suplemento de una reserva |
| `resena/fotos` | Reseña del cliente |
| `perro/fotos`, `perro/cartilla`, `perro/pasaporte`, `perro/certificados` | Ficha del perro |
| `perfil/avatar` | Datos personales |

## Qué se revisó y está bien

- **Conversión de HEIC** (`shared/media/preparar-imagen.ts`): detecta el formato
  por tipo **y** por extensión, porque iOS deja `file.type` vacío cuando la foto
  viene de la app Archivos. Reintenta la decodificación sin
  `imageOrientation` para iOS 15, y tiene respaldo por etiqueta `<img>`.
- **Formato de salida**: un HEIC sale siempre como JPEG, con la extensión
  cambiada. No queda ningún fichero declarándose HEIC después de convertir.
- **Topes**: los tres del frontend coinciden con los del API (5/10/50 MB), con
  128 KB de holgura porque `MaxFileSizeValidator` de Nest compara con `<`.
- **Validación del servidor** (`firma-fichero.ts`): decide por los bytes, no por
  el `Content-Type` que manda el cliente, y distingue HEIC de MP4/MOV, que
  comparten contenedor ISO-BMFF.

No he encontrado en esta revisión un fallo que explique por sí solo lo que
reporta el cliente. Por eso el trabajo se ha centrado en poder verlo.

## El diagnóstico

`POST /upload/diagnostico` recibe el parte de cada subida y lo escribe en el
registro del contenedor, donde se puede leer desde Coolify.

**No viaja el contenido del fichero**, sólo lo necesario para reproducir el caso.
Un test lo comprueba.

Los pasos que puede traer el parte:

| Paso | Qué significa |
|---|---|
| `descartado` | Ni parecía una imagen; se rechazó antes de tocar nada |
| `sin_decodificar` | Ni `createImageBitmap` ni la etiqueta `<img>` supieron abrirlo |
| `sin_convertir` | Sigue siendo HEIC después de intentar convertirlo |
| `vacio` | Llegó con 0 bytes: la foto está en iCloud sin descargar |
| `demasiado_grande` | Convertida, pero sigue sin caber |
| `error_http` | Falló la petición; lleva el código |
| `subida` | Salió bien; da el denominador |

Ejemplo de lo que aparece en el registro:

```
WARN [SubidaDiagnostico] paso=sin_decodificar · destino=image · origen=perro/fotos ·
nombre=IMG_0421.HEIC · tipo=(vacío) · bytes=3348221 · ua=Mozilla/5.0 (iPhone; CPU iPhone OS 16_6…)
```

Con eso se distingue de un vistazo lo que hoy se confunde: una foto en iCloud,
un HEIC que el navegador no supo abrir, una sesión caducada y un fichero
demasiado grande daban todos el mismo mensaje en pantalla.

El endpoint es **público a propósito**: uno de los fallos que se quiere cazar es
que la propia subida se rechace por sesión caducada, y exigir sesión dejaría
fuera justo ese caso. Está limitado a 30 partes por minuto.

## Cómo usarlo

1. Pide a quien tenga el problema que reproduzca la subida.
2. Mira los registros del contenedor web filtrando por `SubidaDiagnostico`.
3. El `paso` dice la causa y el `origen` la pantalla.

## Lo que sí encontré, y no es la foto

**La ficha del perro pide documentos a través del componente de imágenes.**
`perro/cartilla`, `perro/pasaporte` y `perro/certificados` son cartilla
sanitaria, pasaporte europeo y certificados: papeles que la gente tiene en PDF.
Pero `rs-image-upload` sólo declara `accept="image/*"` y envía a
`/upload/image`, que rechaza los PDF. Ahora mismo esos tres campos **sólo
admiten una foto del documento**, no el PDF.

La rama `fix/tck-8004-verificacion-identidad` ya añade a `rs-image-upload` un
modo `documento` que acepta PDF y envía al endpoint correcto. Al integrarla,
esos tres campos deberían pasar a usarlo.

## Pendiente de comprobar en un iPhone real

El diagnóstico no sustituye a la prueba. Con un iPhone conviene recorrer:

- Foto recién hecha con la cámara.
- Foto del carrete, tomada hace tiempo.
- Foto guardada en iCloud y **no** descargada en el dispositivo.
- Foto elegida desde la app Archivos en vez del carrete.
- Panorámica o captura muy grande.
- Un PDF en los campos de documentación.
