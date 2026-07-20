# Plan de mejoras — `docs/mejoras_toda_la_app.md`

> Plan de implementación para aplicar las mejoras del feedback de producto sobre las
> pantallas de **Administrador**, **Comercio** y **Usuario** de Doogking, dejándolas
> **funcionales** (no mockups). Cada punto se cruza con el **estado real del código**
> tras auditar el repo, porque parte del feedback (hecho sobre capturas) ya está resuelto.

---

## Estado de implementación

- ✅ **Fase 1 completada** (commit "aplicar mejoras Fase 1"): copy, perfiles por rol, bugs de moneda/liquidación, navbar desplegable, trust badges, footer, logo.
- ✅ **Fase 2 completada**:
  - Favoritos end-to-end (módulo API con tests + front: servicio, botón corazón, página `/favoritos`, integración en navbar y perfil).
  - Métricas reales del dashboard admin (verificaciones pendientes, nuevos comercios del mes, mascotas registradas, tasa de cancelación) + barra de alertas + últimas reservas enriquecidas (cliente/comercio/fecha).
  - Reservas cliente con mascota (🐶 desde `perroSnapshot`) y ubicación (📍) en cada tarjeta.
  - Pendiente de Fase 2 (movido a seguimiento): finanzas/ocupación reales del comercio y desglose completo de importes en el detalle de reserva.
- ✅ **Fase 3 (núcleo) completada**:
  - Nuevos estados de reserva en el enum (`en_curso`, `pago_retenido`, `pago_liberado`, `en_disputa`, `reembolsada`) + semáforo de colores propagado a las pantallas de reservas (admin, comercio).
  - Backend: operaciones de admin sobre la reserva (reembolsar, liberar pago, abrir disputa) con whitelist de estados y registro en `historialEstados` (semilla del timeline); métrica **pagos retenidos** (monto + conteo) en el dashboard; **filtros avanzados** en `/admin/reservas` (estado, comercio, código, fechas) con cliente/comercio poblados. Tests verde (315 API).
  - Frontend: **centro de operaciones de reservas** del admin — buscador global por código, chips de estado (incl. disputa/retenido/liberado/reembolsada), semáforo, columnas cliente/comercio/comisión y botones de acción por fila; KPI "Pagos retenidos" y alerta en el dashboard.
  - **Timeline de reserva**: cada transición se registra en `historialEstados` (creación, confirmación por pago, completada por comercio, y acciones de admin) y se visualiza como línea de tiempo expandible en el centro de reservas. Captura de **motivo** en disputas/reembolsos (queda en el timeline). Métrica **incidencias abiertas** (reservas en disputa) con tarjeta y alerta en el dashboard.
  - Pendiente de Fase 3 (seguimiento): módulo de incidencias con mensajería dedicada, documentación/verificación de comercio con caducidades.
- ✅ **Residual Fase 2 — finanzas reales del comercio**: nuevo endpoint `GET /comercios/mis-finanzas` que calcula en backend (desde los pagos) facturación bruta, comisión, Stripe, **reembolsos**, liquidación neta y **próxima liquidación** (servicios prestados pendientes de pago). La pantalla de Ingresos del comercio usa estas cifras reales (con estimación front como respaldo). Tests verde (317 API).
- ✅ **Residual Fase 3 — documentación y verificación de comercio**: `verificacion.documentos[]` (tipo, URL, caducidad, estado) con auto-marcado de caducados; endpoint admin para verificar/rechazar (con motivo); UI en admin (badge + botones) y en el comercio (sección de documentación adicional).
- 🟡 **Fase 4 (en curso) — analítica del admin**: endpoint `GET /admin/analitica` (distribución por vertical con %, distribución geográfica por ciudad, Top 5 comercios por facturación, embudo registrados→con reserva→pagaron) + nueva pantalla **Analítica** en el panel admin. Tests verde (320 API).
  - Pendiente de Fase 4: recompensas/puntos, recordatorios de mascota, seguimiento en tiempo real, equipo/permisos de comercio.

---

## 0. Resumen ejecutivo

El feedback se hizo sobre capturas de pantalla, por lo que algunos puntos **ya están
implementados** en el código y otros son **gaps reales**. Este plan separa ambos y
prioriza en fases. La mejora conceptual más repetida en todo el documento —
**"Mis mascotas"** como centro del producto— **ya existe** como módulo completo
(`perros`, front + API); el gap es de *naming*, *ubicación en el menú* y *conectar
métricas*. La otra pieta estrella, **Favoritos**, **no existe** y hay que crearla de cero.

### Hallazgos clave de la auditoría

| Crítica del feedback | Estado real en código |
|---|---|
| "Reservas admin reutiliza la pantalla del cliente" | ❌ Falso: `admin-reservas.component.ts` es un componente propio (tabla global). Le faltan estados/filtros/columnas. |
| "Reservas comercio reutiliza la del cliente" | ❌ Falso: `comercio-reservas.component.ts` es propio ("Reservas recibidas"). Le faltan estados/ficha mascota/calendario. |
| "Perfil comercio dice Cliente verificado / Destinos visitados / Buscar servicios" | ⚠️ Parcial: no hay perfil de comercio; si un comercio entra a `/perfil` ve el **perfil de cliente** genérico. Hay que crear un perfil por rol. |
| "Mis mascotas no existe" | ✅ Existe CRUD completo (`perros`), pero se llama "Mis perros" y no alimenta métricas del perfil. |
| Favoritos | ❌ No existe (ni front ni API). Crear de cero. |
| Bug liquidación "S/ -1" en dashboard comercio | ✅ Confirmado (`panel-comercio-dashboard.component.ts`). Fee fijo sin guard. |
| Moneda "S/" (soles) en comercio | ✅ Bug: la plataforma es **EUR**. Hay `S/` hardcodeado en dashboard e ingresos. |
| Perfil admin con Rating/Destinos/Reservas completadas | ✅ Confirmado: admin ve el perfil de cliente; `Rating` y `Destinos` son placeholders `'—'`. |

---

## 1. Fases y priorización

- **Fase 1 — Quick wins de copy, roles y bugs (P0).** Cambios seguros, alto valor, sin backend nuevo. Deja la app coherente por rol.
- **Fase 2 — Funcionalidad nueva con backend ligero (P0/P1).** Favoritos, métricas de dashboard admin/comercio reales, ficha mascota en reservas, desglose de importes.
- **Fase 3 — Operaciones del marketplace (P1).** Estados de reserva (disputa, pago retenido/liberado, reembolsada), incidencias, timeline de reserva, filtros avanzados admin, exportaciones.
- **Fase 4 — Diferenciadores / Fase 2 del negocio (P2).** Mapa de calor, embudo de conversión, recompensas/puntos, recordatorios de mascota, servicios gratuitos (playas/parques), seguimiento en tiempo real, equipo y permisos de comercio.

---

## 2. FASE 1 — Quick wins (copy, roles, bugs) · P0

### 2.1 Panel Administrador — Dashboard
`apps/web/src/app/features/panel-admin/admin-dashboard.component.ts`
- Renombrar KPIs (solo texto de tarjeta + subtítulo):
  - **"GMV del mes"** → **"Facturación bruta del mes"** · subtítulo *"Importe total gestionado por la plataforma."*
  - **"Ingresos netos"** → **"Comisión Doogking del mes"**.
- **Últimas reservas**: enriquecer cada fila con **cliente, comercio, importe, estado, fecha del servicio**. Requiere ampliar el payload de `obtenerDashboard()` (ver §3.1) con `populate` de `usuarioId`/`comercioId`.
- **Configuración de comisiones**: añadir columna **"Comisión total"** = comisión vertical + fee Stripe (ej. 12% + 1,5% = 13,5%). Solo cálculo en la tabla existente.

### 2.2 Panel Administrador — Reservas
`apps/web/src/app/features/panel-admin/admin-reservas.component.ts`
- Añadir chips de filtro que faltan: **En disputa, Reembolsada, Pago retenido, Pago liberado** (dependen de nuevos estados, §4.1) + `no_show`/`ajuste_solicitado` ya en enum.
- Semáforo de color por estado: 🟢 confirmada · 🟡 pendiente · 🔵 en curso · 🟣 pago retenido · 🔴 incidencia · ⚫ cancelada.
- Corregir el problema móvil: tabla con `overflow-x:auto` en contenedor propio (evitar scroll horizontal de toda la página); cabecera fija.

### 2.3 Perfil por rol (raíz de varios puntos)
Hoy `/perfil` sirve el **mismo** `perfil-dashboard.component.ts` a cliente, comercio y admin. Solución mínima funcional: **redirigir por rol** en `perfil.routes.ts` / guard, y renderizar variantes:
- **admin** → nuevo `perfil-admin.component.ts`: quita Rating/Destinos/Reservas completadas; añade tarjetas **Facturación gestionada, Comisión Doogking, Comercios activos, Usuarios activos, Mascotas registradas, Crecimiento mensual**; config → **Gestión de administradores, Roles y permisos, Stripe, Fiscal, Comisiones, Logs, Notificaciones globales**; quita Métodos de pago y Mis reseñas.
- **comercio** → nuevo `perfil-comercio.component.ts` (reutiliza datos de `comercio-config`): cabecera con **nombre comercial real + categorías + ubicación + ✅ Comercio verificado**; botones **Editar perfil / Ver perfil público / Gestionar negocio**; tarjetas **Reservas totales, Servicios completados, Valoración, Servicios activos**; sin Destinos/Buscar servicios; "Reseñas recibidas" en vez de "reseñas que has escrito".
- **cliente** → el actual, con mejoras de §2.4.

### 2.4 Perfil Cliente
`apps/web/src/app/features/perfil-usuario/perfil-dashboard.component.ts`
- Sustituir **"Destinos visitados"** → **"Mis mascotas"** (nº real desde `perros.service`).
- Sustituir **"Rating promedio"** → **"Favoritos"** (nº, tras §3.3).
- Renombrar **"Reservas completadas"** → **"Servicios disfrutados"**.
- Bloque **"Mis mascotas"** por encima de "Reservas recientes" (lista de perros con foto + botón Añadir).
- Añadir entrada **Favoritos** en `configItems`.
- Mejorar tarjeta de reserva reciente: nombre comercio + fecha + estado con color + "Ver detalles".

### 2.5 Panel Comercio — Dashboard
`apps/web/src/app/features/panel-comercio/panel-comercio-dashboard.component.ts`
- **Bug moneda:** cambiar todos los `S/` → `€` (dashboard e `comercio-ingresos.component.ts`).
- **Bug "S/ -1":** guardar el fee fijo de Stripe cuando no hay reservas → si `totalIngresos()===0`, liquidación = 0 y mostrar *"Todavía no tienes ingresos suficientes para calcular una liquidación."*
- Renombrar título **"Dashboard"** → **"Panel de control"**; **"Ingresos brutos"** → **"Facturación del mes"**; **"Listados activos"** → **"Servicios activos"**.
- Añadir tarjeta **Ocupación** (placeholder calculado) y tarjeta **Reseñas ⭐ + nº** con enlace.

### 2.6 Navbar / menú
`apps/web/src/app/shared/components/navbar/rs-navbar.component.ts`
- Agrupar las 3 tarjetas primarias repetidas (Mi perfil / Mis perros / Mis reservas) en **un menú desplegable** bajo avatar. Estructura: **Mi cuenta** (Mi perfil, Mis mascotas, Mis reservas, Favoritos, Mis reseñas), **Descubrir** (categorías), **Empresas** (Publicar mi negocio).
- Renombrar **"Mis perros"** → **"Mis mascotas"** en todo el front (nav, perfil, rutas visibles) manteniendo la ruta `/perros`.

### 2.7 Home / Buscador
`apps/web/src/app/features/home/home.component.ts`
- **Trust badges** bajo el buscador: ✅ Comercios verificados · ⭐ +10.000 reseñas · 🔒 Pagos seguros Stripe · 🐾 Soporte especializado.
- Footer: cambiar **"IVA 21% incluido"** → **"🔒 Pago seguro Stripe" + "✅ Empresas verificadas"**; añadir columnas **Descubre** (Playas/Parques/Hoteles pet friendly) y **Empresas** (Registrar negocio, Tarifas, Ventajas).
- Reordenar categorías: **Veterinarios, Peluquerías, Residencias, Transporte, Adiestramiento**.
- Corregir "en cinco categorías" (renderiza seis con Hoteles) → coherencia del texto.
- Cambiar selector **"Número de perros"** → selector **"Mascota"** (Nala/Rocky/… + Añadir) cuando el usuario está logueado y tiene perros; fallback a número.

### 2.8 Registro — logo
`apps/web/src/app/features/auth/registro/registro.component.ts`
- Agrandar el logo de `70px` → `~120px` de alto (hay espacio de sobra). Mismo cambio en `registro-comercio` y `login` para consistencia.

---

## 3. FASE 2 — Funcionalidad nueva con backend ligero · P0/P1

### 3.1 Dashboard admin: métricas reales nuevas
`apps/api/src/core/admin/admin.service.ts` (ampliar `obtenerDashboard`)
- **Verificaciones pendientes** (comercios con `verificacion.estado='pendiente'`).
- **Nuevos comercios del mes** (`createdAt >= inicioMes`).
- **Tasa de cancelación del mes** (`cancelada / total` de reservas del mes).
- **Pagos retenidos** (suma de pagos en estado retenido — depende de §4).
- **Mascotas registradas** (`perroModel.countDocuments`).
- **Salud de la plataforma** (semáforo): tasa de éxito, valoración media, cancelaciones.
- Enriquecer `ultimasReservas` con `cliente`, `comercio`, `fechaServicio` (populate).
- Barra de **alertas** en el layout admin: verificaciones + incidencias + pagos retenidos + docs caducados.

### 3.2 Perfil admin: métricas de negocio
Reusar `admin.service` + nuevo endpoint `GET /admin/perfil-metricas`: facturación total gestionada, comisiones acumuladas, comercios activos, usuarios activos mensuales, mascotas, crecimiento mensual, Top 5 comercios, distribución por vertical y geográfica.

### 3.3 Favoritos (nuevo módulo end-to-end)
- **API:** `apps/api/src/core/favoritos/` → schema `{ usuarioId, servicioId, createdAt }` (índice único compuesto), controller `GET/POST/DELETE /favoritos`, guard cliente.
- **Front:** botón ❤️ en tarjetas de servicio (home/buscador/detalle), pantalla `Favoritos` en perfil y menú, `favoritos.service.ts` con estado por signals.
- **DTO** en `libs/shared/src/dtos/favoritos/`.

### 3.4 Reservas: mascota, ubicación, desglose
- **Cliente** (`mis-reservas.component.ts`): mostrar 🐶 nombre mascota (de `perroSnapshot`/`perroId`) y 📍 ubicación (de `servicio.ubicacion.ciudad`); semáforo de estados con color; sustituir "1 unidad" del detalle por la mascota.
- **Detalle** (`reserva-detalle.component.ts`): añadir bloques **Información del comercio** (dirección, teléfono, cómo llegar), **Ficha de la mascota**, botones **Contactar (llamar/WhatsApp/cómo llegar)**, **Añadir al calendario**, **Descargar factura**.
- **Comercio** (`comercio-reservas.component.ts`): **Ficha de mascota** (desde `perroSnapshot`), botones Confirmar/Completar/Contactar cliente, vista calendario del día.

### 3.5 Comercio: finanzas y ocupación reales
- Nuevo endpoint `GET /comercios/mis-finanzas`: facturación bruta, comisión, Stripe, reembolsos, liquidación, próxima liquidación — calculado en backend desde `Pago` (hoy es 100% front).
- Desglose financiero: Facturación / −Comisión / −Stripe / −Reembolsos / **Liquidación**.
- **Ocupación** (residencias/hoteles) y **horas ocupadas** (peluquería/veterinaria) desde disponibilidad.
- Botones **Descargar facturas** y **Exportar a Excel**.
- **Próximos servicios del día** + **Agenda** (hoy/semana).

---

## 4. FASE 3 — Operaciones del marketplace · P1

### 4.1 Nuevos estados de reserva
`libs/shared/src/enums/reserva-estado.enum.ts` — añadir: `EN_CURSO`, `EN_DISPUTA`, `REEMBOLSADA`, `PAGO_RETENIDO`, `PAGO_LIBERADO`. Propagar a badges/filtros en las 3 pantallas de reservas y al enum de pago si aplica (retención/escrow).
- **Riesgo:** toca máquina de estados y pagos; requiere migración de datos y tests. Diseñar la transición (retenido→liberado tras completar/plazo de reclamación).

### 4.2 Incidencias / disputas
- Módulo `incidencias` (API): `{ reservaId, tipo, estado, mensajes[] }`. Panel admin "Incidencias abiertas" + acción "Abrir incidencia" en reservas.

### 4.3 Timeline de reserva
- Registrar eventos (`creada, pago, notificado, aceptada, iniciada, completada, liberado, reseña`) y render vertical en el detalle admin/comercio.

### 4.4 Filtros avanzados + buscador global admin
- Filtros: fecha, provincia, ciudad, comercio, cliente, mascota, servicio, estado, importe, método de pago. Buscador global por código/mascota/comercio/cliente.

### 4.5 Documentación y verificación de comercio
- Sección en perfil comercio: DNI, CIF, licencia, seguro RC, datos bancarios, certificados, caducidades, estados (verificado/pendiente/caducado/rechazado). Flujo de aprobación en admin.

---

## 5. FASE 4 — Diferenciadores · P2

- Mapa de calor de reservas por ciudad; Ranking categorías/empresas; Embudo de conversión.
- Recompensas / puntos Doogking; Recordatorios de mascota (vacunas, desparasitación).
- Historial por mascota (ya hay `perro-historial`); Servicios gratuitos (playas/parques/eventos) como contenido.
- Seguimiento en tiempo real (transporte/residencia); Equipo y permisos de comercio (staff con roles).
- "Reservar de nuevo", compartir reserva, adaptación del buscador por vertical en el home.

---

## 6. Inventario de archivos por fase (resumen)

**Fase 1 (front, sin migración):** `admin-dashboard`, `admin-reservas`, `perfil-dashboard` (+ split por rol), `panel-comercio-dashboard`, `comercio-ingresos`, `rs-navbar`, `home`, `registro`/`login`/`registro-comercio`. Backend: ampliar `admin.service.obtenerDashboard`.

**Fase 2:** `admin.service`/`admin.controller`, nuevo módulo `favoritos` (API+front+DTO), `mis-reservas`, `reserva-detalle`, `comercio-reservas`, nuevo endpoint `mis-finanzas`, split de perfiles.

**Fase 3–4:** enum de estados + migración, módulos `incidencias`, timeline, filtros, documentación/verificación, y diferenciadores.

---

## 7. Criterio de "funcional"

Cada item de Fase 1–2 se considera terminado cuando: (a) compila (`/verify-builds`), (b) usa tokens/clases `rs-*` del design system (sin colores/espaciados hardcodeados), (c) los datos provienen de endpoints reales (no mocks) o se etiqueta explícitamente como placeholder, y (d) respeta los roles/guards. Se añaden `.spec.ts` según la regla de oro del proyecto (§20 CLAUDE.md).
