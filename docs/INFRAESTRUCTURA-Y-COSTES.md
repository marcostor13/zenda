# Infraestructura y costes — Doogking

**11 de septiembre de 2026 · escenario de 500 usuarios registrados**

Este informe sale de leer el código y de consultar producción, no de suposiciones. Lo que
es una estimación está marcado como tal, y al final hay una lista de lo que no he podido
comprobar desde aquí.

---

## 0. De dónde parte la plataforma hoy

Consultado en producción el 11/09/2026:

| | Hoy |
|---|---|
| Servicios publicados (las 8 categorías) | **0** |
| Fichas de *Explora* | **60**, ninguna con foto propia |
| Usuarios registrados | (no consultable sin acceso a la base) |

Es decir: la infraestructura está prácticamente en reposo. Todo lo que sigue es **lo que
costará cuando haya 500 usuarios de verdad**, no lo que se paga ahora.

---

## 1. Qué usa la plataforma

### 1.1 Lo que no puede faltar

| Servicio | Para qué | Si se cae o falta |
|---|---|---|
| **Servidor con Coolify** (EC2/VPS) | Aloja los dos contenedores: el API (NestJS, puerto 3000) y la web (Node con render de servidor, puerto 4000) | No hay plataforma |
| **MongoDB Atlas** | Toda la información: usuarios, comercios, servicios, reservas, pagos, reseñas, mascotas. **Y hoy también las fotos** (ver §3.2) | El API no arranca |
| **Stripe** | Cobro de las reservas. La reserva sólo pasa a confirmada cuando Stripe avisa por webhook | No se puede cobrar |
| **Dominio + Cloudflare Tunnel** | `doogking.com` y el dominio del API llegan al servidor por un túnel de Cloudflare, no por DNS directo | La web no es accesible |

### 1.2 Lo que degrada sin romper

Está bien diseñado en este aspecto: **cada servicio externo tiene una salida**. Si falla,
la plataforma sigue funcionando con menos.

| Servicio | Para qué | Qué pasa sin él |
|---|---|---|
| **Resend** | Correo transaccional: verificación de cuenta, confirmación de reserva, aviso al comercio, recordatorios de valoración | El envío queda anotado como fallido en la bandeja de salida; no se pierde, pero nadie recibe el correo |
| **Google Maps — clave de servidor** | Autocompletado de población y de dirección del comercio, y las coordenadas con las que se sitúa un negocio en el mapa | El comercio puede escribir su dirección pero no obtiene punto exacto, y sus listados no salen en el mapa del buscador |
| **Google Maps — clave de navegador** | Dibujar el mapa | Cae a OpenStreetMap, que es gratis. **Y es justo lo que pasa ahora si el visitante rechaza las cookies** |
| **DeepSeek** | La búsqueda en lenguaje natural («Veterinario en Barcelona para vacunación») | El buscador cae al formulario de filtros |
| **Firebase Cloud Messaging** | Notificaciones push de la app móvil | Los dispositivos se registran igual; el envío queda apagado |
| **Google / Meta login** | Entrar con cuenta de Google o de Facebook | Los botones no se muestran y el acceso por correo sigue funcionando |
| **Google / Microsoft Calendar** | Que el comercio sincronice su agenda externa | La agenda propia (jornadas, bloqueos, huecos) funciona igual |
| **Amazon S3** | Guardar las fotos | **Hoy no está configurado**: las fotos caen a la base de datos. Ver §3.2 |

### 1.3 Lo que es gratis y conviene no perder de vista

| | Coste | Nota |
|---|---|---|
| Cloudflare Tunnel | 0 € | Plan gratuito; ya se comparte con otros proyectos |
| GitHub + GitHub Actions | 0 € | 2.000 minutos/mes en repositorio privado; los builds rondan 5 min |
| Firebase Cloud Messaging | 0 € | Sin límite práctico a esta escala |
| Login social (Google, Meta) | 0 € | |
| OpenStreetMap | 0 € | Es el mapa de respaldo |

---

## 2. Qué consumen 500 usuarios

Supuestos declarados, porque de ellos sale todo lo demás. Si alguno no encaja con lo que
esperas, dímelo y recalculo:

- 500 usuarios registrados; **30 % activos al mes** (150 personas)
- 4 sesiones al mes por usuario activo, 5 páginas por sesión → **~3.000 páginas/mes**
- **200 reservas al mes**, ticket medio **50 €** → **10.000 € de GMV mensual**
- 40–60 comercios dados de alta, con 5–10 fotos cada uno

### Peso real de una visita

Medido sobre el build actual:

| | Tamaño |
|---|---|
| HTML renderizado en servidor | 170 KB |
| JavaScript inicial (comprimido) | **194 KB** |
| Hoja de estilos (comprimida) | 10 KB |

Con el navegador guardando el JavaScript entre visitas, **3.000 páginas al mes son unos
2–4 GB de salida**. A efectos de coste, nada: ni se acerca a ningún umbral.

**La carga de CPU tampoco es el problema.** El render de servidor son unas 4 páginas por
hora de media a este volumen. El cuello de botella a 500 usuarios no es el tráfico: es la
**memoria**, porque ahora hay dos procesos de Node en vez de uno y un nginx.

---

## 3. Coste mensual estimado

### 3.1 Tabla resumen

| Concepto | Escenario ajustado | Escenario cómodo | Notas |
|---|---|---|---|
| Servidor (parte de Doogking) | 10 € | 30 € | §3.3 |
| MongoDB Atlas | 0 € (M0) | 53 € (M10) | §3.2 — **es la decisión que más mueve la cifra** |
| Amazon S3 (fotos) | 1 € | 3 € | Hoy sin configurar |
| Resend (correo) | 0 € | 18 € | §3.4 |
| Google Maps Platform | 0 € | 15 € | §3.5 |
| DeepSeek (búsqueda con IA) | <1 € | 2 € | |
| Dominio | ~1 € | ~1 € | Prorrateo de ~12 €/año |
| **Total de infraestructura** | **≈ 12 €/mes** | **≈ 122 €/mes** | |
| Comisiones de Stripe | **≈ 200 €/mes** | ≈ 200 €/mes | §3.6 — no es infraestructura: sale del GMV |

> **La horquilla es amplia a propósito.** La diferencia entre 12 € y 122 € es casi toda
> MongoDB Atlas, y depende de una sola decisión técnica que se explica justo debajo.

### 3.2 MongoDB Atlas — el punto que hay que decidir

Hoy, **si no hay S3 configurado las fotos se guardan dentro de la base de datos** (GridFS).
Es una salida elegante para que la subida nunca falle, pero a escala es cara:

- El límite por imagen es de 5 MB.
- 50 comercios × 8 fotos × ~1,5 MB ≈ **600 MB sólo de fotos**.
- El plan gratuito de Atlas (**M0**) da **512 MB**. Se agota antes de llegar a los 500
  usuarios, y cuando se agota deja de admitir escrituras: no se puede ni reservar.

Dos caminos:

| | Coste | Qué implica |
|---|---|---|
| **Configurar S3** *(recomendado)* | ~1–3 €/mes de S3, y Atlas se queda en **M0 (0 €)** o **M2 (≈ 8 €)** | Las fotos salen de la base. Ya está programado: basta con rellenar `S3_BUCKET`, `S3_REGION` y las credenciales. La base se queda en datos, que a 500 usuarios cabe de sobra en unos cientos de MB |
| **No tocar nada** | **M10 ≈ 53 €/mes** (10 GB) | Hay que subir de plan sí o sí antes de crecer, y se paga una base de datos cara para almacenar imágenes, que es lo que peor se le da |

> **Recomendación: configurar S3 antes de la apertura.** Ahorra unos 50 €/mes, quita el
> riesgo de quedarse sin base a mitad de campaña y no requiere programar nada. Es la
> decisión de mayor impacto económico de todo el informe.
>
> Segundo motivo, no económico: servir las fotos desde la base de datos las hace pasar por
> el API en cada visita. Desde S3 las sirve Amazon y el API se queda libre.

### 3.3 El servidor

El servidor de Coolify **está compartido con otros proyectos** (`mayahelp`, el propio panel
de Coolify), así que lo que sigue es la parte atribuible a Doogking, no la factura entera.

Lo que ocupa Doogking ahora:

| Contenedor | Memoria estimada |
|---|---|
| API (NestJS) | ~400–600 MB |
| Web (Node con render de servidor) | ~300–500 MB |

> **Esto ha cambiado con la auditoría.** Antes la web era nginx sirviendo ficheros: unos
> 20 MB. Ahora es un proceso de Node que renderiza cada página, así que **Doogking pide
> entre 300 y 500 MB más de memoria que la semana pasada**. Con el servidor compartido,
> conviene comprobar que sigue holgado antes de abrir al público.

Referencias de precio para dimensionar (el servidor entero, no sólo Doogking):

| Opción | Recursos | Precio |
|---|---|---|
| AWS EC2 `t3.small` | 2 vCPU · 2 GB | ~15 €/mes + ~3 € de disco |
| AWS EC2 `t3.medium` | 2 vCPU · 4 GB | ~30 €/mes + ~3 € de disco |
| Hetzner CPX21 | 3 vCPU · 4 GB | **~8 €/mes** |

Con 4 GB va cómodo para Doogking más lo que ya convive ahí. Con 2 GB se puede ir justo
ahora que la web también es Node.

### 3.4 Resend (correo)

El plan gratuito da **3.000 correos al mes, con tope de 100 al día**.

A 200 reservas al mes salen unos 600–900 correos (confirmación al cliente, aviso al
comercio, recordatorio de valoración), más las verificaciones de cuenta. Por volumen
mensual cabe de sobra; **el riesgo es el tope diario**: un fin de semana de campaña con 60
reservas se acerca a los 100.

- Gratis mientras el ritmo sea regular.
- **Pro: 20 $/mes** (≈ 18 €) por 50.000 correos y sin tope diario, en cuanto haya campañas.

### 3.5 Google Maps Platform

Se usan tres cosas: el mapa que se dibuja en la ficha, el autocompletado de poblaciones y
direcciones, y la geolocalización de los comercios al darse de alta.

A 500 usuarios el volumen es bajo —del orden de 3.000–5.000 cargas de mapa al mes— y **lo
normal es que entre entero en la capa gratuita**. Hay dos cosas que además lo abaratan sin
querer:

- Quien **rechaza las cookies ve OpenStreetMap**, que no cuesta nada.
- La geolocalización de los municipios de *Explora* es un proceso de una sola vez, no
  recurrente.

> ⚠️ **Esto hay que confirmarlo en la consola de Google Cloud.** Google cambió su modelo de
> precios en 2025 y las capas gratuitas pasaron a contarse por producto en vez de con un
> crédito único mensual. No doy cifra firme: revísalo en *Facturación → Informes*, filtrando
> por la API de Maps. Lo que sí es importante es **poner un presupuesto con alerta**, porque
> una clave sin restringir es la vía habitual de sustos en la factura.

### 3.6 Stripe

No es infraestructura: es coste de transacción y sale del dinero que entra.

Tarifas europeas: **1,5 % + 0,25 €** por tarjeta del Espacio Económico Europeo; **2,5 % +
0,25 €** fuera; **+2 %** si hay cambio de divisa.

Sobre 200 reservas de 50 € (10.000 € de GMV):

| | |
|---|---|
| Comisión de Stripe | ≈ 200 € |
| Comisión de la plataforma (15 % de media) | ≈ 1.240 € |
| **Margen neto de la plataforma** | **≈ 1.040 €** |

> El código calcula hoy la comisión de Stripe con **2,9 % + 0,25 €**, una aproximación
> conservadora que la documentación del proyecto ya declara como tal. Con tarjeta europea la
> tarifa real es del 1,5 %, así que **los informes del panel de administración están
> subestimando el margen**. Se ajusta cambiando un valor en la colección `comision_configs`,
> sin tocar código ni volver a desplegar.

### 3.7 Aplicación móvil, si se publica

| | Coste |
|---|---|
| Google Play | 25 $ una sola vez |
| Apple Developer | 99 $ al año (≈ 92 €) |

---

## 4. Lo que recomiendo, por orden

1. **Configurar S3 antes de abrir al público.** Ahorra ~50 €/mes, evita quedarse sin base
   de datos a mitad de campaña y no hay que programar nada: sólo rellenar cuatro variables.
2. **Comprobar la memoria libre del servidor.** La web pasó de nginx a Node y pide entre 300
   y 500 MB más que antes.
3. **Poner presupuesto con alerta en Google Cloud** y restringir las dos claves de Maps: la
   de navegador por dominio, la de servidor por API. Ya está documentado en `.env.example`.
4. **Ajustar la comisión de Stripe a 1,5 %** en `comision_configs`, para que los informes
   del panel digan el margen real.
5. **Pasar Resend a Pro en cuanto haya campañas**, por el tope de 100 correos al día.

---

## 5. Lo que no he podido comprobar

Necesito que me lo digas tú o que me des acceso, porque desde aquí no se ve:

| | Por qué importa |
|---|---|
| Tamaño y precio del servidor (EC2 o VPS) | Es la única partida fija grande; sin el dato, el total es una horquilla |
| Plan actual de MongoDB Atlas y espacio ocupado | Decide si hay urgencia con el asunto de las fotos |
| Facturación actual de Google Cloud | Google cambió su modelo de precios y las capas gratuitas ya no se cuentan igual |
| Plan actual de Resend | Para saber si el tope diario es un riesgo real |
| Usuarios registrados hoy | Para situar el escenario de 500 sobre lo que ya hay |

Con esos cinco datos convierto la horquilla de 12–122 €/mes en una cifra cerrada.
