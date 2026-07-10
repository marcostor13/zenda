# PLAN MAESTRO — Migración Reservalo/Doogking → **Doogking**

> **Documento de contexto persistente.** Si la sesión se cae, retomar leyendo este archivo: contiene el estudio, todas las decisiones y el checklist de progreso (marcar `[x]` al completar cada paso).
>
> Última actualización: 2026-07-10 · Estado: **EN PROGRESO**
>
> **Log de sesión 2026-07-10** — Migración avanzada de forma verificada:
> - **Frontend:** rutas → 5 categorías caninas (`/alojamiento /transporte /veterinaria /peluqueria /adiestramiento`); eliminadas features viejas `hoteles/` y `taxis/`; `mis-reservas` re-cableado a `AlojamientoService`; paneles admin (reportes, cupones, comercios), reseñas de comercio y mapa de iconos de listados migrados. `ng build` OK.
> - **Backend:** specs migrados a `VerticalKey` caninos + reparado wiring DI preexistente (comercios/admin) → **suite api 29 suites / 133 tests VERDE**; `seed-europe.ts` reescrito a datos caninos (6 comercios, 12 servicios, 3 reservas, 3 cupones, 6 comision_configs); `clear-seed-data.ts` a colecciones caninas; `ai-search` ya canino. `nest build` OK.
> - **Docs/marca (Fase 5):** speckit, nuevo-componente, ui-kit, SCOPE rebrandeados; **CLAUDE.md rebrandeado por completo** a Doogking/canino/EUR (0 términos viejos); design-tokens.md ya estaba migrado; `memory/` no existe (N/A).
> - **Verificación (Fase 6):** shared+api+web compilan; tests api 133/133 y web 49/49 en verde.
> - **Resuelto en esta sesión (cont.):**
>   1. ✅ **`seed-all.ts`** eliminado (Perú/PEN obsoleto) + quitado script `seed:all` + referencias en clear-seed-data actualizadas a seed:europe.
>   2. ✅ **§21 de CLAUDE.md** alineado al tema claro real (azul rey + dorado, tokens reales).
>   3. ✅ **catalog.service.ts**: DTOs/métodos `Hotel*`/`buscarHoteles` → genéricos `Servicio*`/`buscarServicios` (JSON sin cambios; 133/133 verde).
> - **Único pendiente:** revisión visual de la web (requiere levantar la app).

---

## 1. Concepto

**Doogking** — "Booking para servicios caninos" en Europa (EUR, IVA 21%). Marketplace de dos lados: dueños de perros (demanda) ↔ comercios de servicios caninos (oferta). Slogan: **"TODO PARA SU REY, EN UN SOLO LUGAR"** / "The Royal Treatment for Every Dog".

### Las 5 categorías (reemplazan a hoteles/vuelos/taxis/transporte/guarderia)

| Key (`VerticalKey`) | Categoría              | Lógica de reserva                         | Hereda motor de                    |
| ------------------- | ---------------------- | ----------------------------------------- | ---------------------------------- |
| `alojamiento`       | Alojamiento canino     | Por noche (check-in/out), espacios/suites | hoteles (calendario noches)        |
| `transporte`        | Transporte de animales | Trayecto A→B, tarifa base + km            | taxis (trayecto)                   |
| `veterinaria`       | Veterinarios           | Cita por fecha + hora (slots)             | guarderia (cupos) adaptado a citas |
| `peluqueria`        | Peluquerías caninas    | Cita por fecha + hora (slots)             | guarderia (cupos) adaptado a citas |
| `adiestramiento`    | Adiestramiento canino  | Sesión o programa (slots/cupos)           | guarderia (cupos)                  |

### Estudio: qué sube cada comercio (schema discriminador)

Campos base de todo `Servicio`: titulo, descripcion, imagenes[], ubicacion{ciudad, geo}, precioBase, moneda EUR, destacado, prioridadRanking, estado.

**AlojamientoCanino** (`alojamiento`):

- `espacios[]`: { tipo: 'suite'|'estandar'|'compartido', tamanoMaxPerro: 'pequeno'|'mediano'|'grande'|'gigante', precioNoche, precioAnterior?, cantidad, disponible, amenities[], imagenes[], cancelacionGratis }
- `amenities[]` (patio, piscina, cámaras 24/7, veterinario de guardia, paseos diarios…)
- `checkIn`, `checkOut`, `politicaCancelacion`, `requisitoVacunas: bool`, `paseosIncluidos: bool`, `camaras24h: bool`, `espaciosDisponibles`
- Reserva: fechas + nº perros + tamaño del perro. Precio = precioNoche × noches.

**TransporteAnimales** (`transporte`):

- `tipoVehiculo: 'van_acondicionada'|'coche'|'furgon_climatizado'`, `capacidadPerros`, `zonaCobertura[]`, `tarifaBase`, `tarifaKm`, `jaulasIncluidas: bool`, `acompananteHumano: bool`, `soloPerros: bool`, `unidadesDisponibles`
- Reserva: origen/destino (detalle), distanciaKm (parametrosExtra). Precio = tarifaBase + tarifaKm × km.

**Veterinaria** (`veterinaria`):

- `especialidades[]` (medicina general, vacunación, cirugía, dermatología, urgencias, radiografía…), `serviciosClinicos[]`: { nombre, precio, duracionMin }, `duracionCitaMin` (default 30), `citasPorDia`, `citasDisponibles`, `atiendeUrgencias: bool`, `horario`, `precioConsulta`
- Reserva: fecha + hora (parametrosExtra.hora) + servicio elegido. Precio = precio del servicio o consulta.

**PeluqueriaCanina** (`peluqueria`):

- `serviciosGrooming[]`: { nombre (baño, corte, deslanado, spa, uñas), precio, duracionMin, tamanoPerro }, `duracionSlotMin` (default 60), `capacidadSimultanea`, `cuposDisponibles`, `aDomicilio: bool`, `horario`
- Reserva: fecha + hora + servicio + tamaño perro. Precio = precio servicio (× nº perros).

**AdiestramientoCanino** (`adiestramiento`):

- `tiposAdiestramiento[]` (obediencia básica, modificación de conducta, cachorros, guardia…), `modalidad: 'sesion'|'programa'`, `precioSesion`, `precioPrograma?`, `sesionesPorPrograma?`, `edadMinimaMeses`, `aDomicilio: bool`, `capacidadPorSesion`, `cuposDisponibles`, `horario`
- Reserva: fecha + modalidad + nº perros. Precio = precioSesion o precioPrograma.

### Comisiones por categoría (`comision_configs`, seeds)

| Vertical       | comisionPct |
| -------------- | ----------- |
| global         | 0.15        |
| alojamiento    | 0.15        |
| transporte     | 0.18        |
| veterinaria    | 0.10        |
| peluqueria     | 0.15        |
| adiestramiento | 0.12        |

---

## 2. Design System Doogking (fuentes: docs/kitui.md + docs/stitch_pawbooking_design_system)

- **Tema claro**: fondo `#F8F9FA`, cards blancas `#FFFFFF`, sombras azuladas suaves `rgba(8,37,139,.05/.12)`.
- **Colores marca**: Royal King Blue `#08258B` (primario, navbar links, headings), Deep `#00135D`/`#051A66` (texto fuerte, footer navy, hover), Crown Gold `#FBAE17`/`#FCAF19` (CTA principal "Reservar/Buscar", acentos, estrellas), Gold light `#FFC533` (gradiente dorado), divider `#8B9BBC` / `#C5C5D4`, error `#BA1A1A`.
- **Botones**: primario = azul fondo/texto blanco; CTA destacado = dorado fondo/texto azul navy; radius 8px.
- **Tipografías**: **Plus Jakarta Sans** (headings, 700/800), **Inter** (body/botones), **Montserrat 700** (labels all-caps, slogan). Cargar en index.html.
- **Formas**: inputs/cards 8px (`--r-lg`), contenedores grandes 16px, badges circulares perfectos, pills para estados.
- **Cards premium/destacado**: barra superior dorada de 4px.
- **Badges de categoría**: círculos alternando azul→dorado→azul (imágenes en `public/images/categoria-*.jpg`).
- **Footer**: navy `#00135D`, links blancos, títulos de columna en dorado.
- Assets ya descargados en `apps/web/public/images/` (logo-doogking.jpg, hero-home.jpg, categoria-_.jpg, alojamiento-_.jpg, mascota-doogking.jpg, avatar-placeholder.jpg, hero-detalle.jpg, ejemplo-alojamiento-\*.jpg) + `favicon.svg` nuevo.
- **Los tokens actuales de styles.scss se conservan por NOMBRE** (--c-accent, --c-amber, rs-_…) pero cambian de VALOR a la paleta Doogking → así el retheme se propaga sin tocar cada componente. Se añaden alias `--dk-_` de marca.

## 3. Renombrado del proyecto → Doogking

- index.html: title "Doogking — Todo para su rey, en un solo lugar", favicon.svg, fuentes nuevas.
- package.json raíz: name `doogking`. CLAUDE.md: reemplazar "Reservalo"/placeholder por Doogking + actualizar tabla de verticales y concepto.
- Navbar/footer/auth: marca Doogking + logo. Textos "Doogking"/"Reservalo" → "Doogking".
- Memoria de Claude y skills (.claude/commands/\*) actualizadas.

---

## 4. CHECKLIST DE IMPLEMENTACIÓN (marcar al completar)

### Fase 0 — Análisis y assets ✅

- [x] Análisis de proyecto (backend + frontend mapeados)
- [x] Análisis kitui.md + stitch design system + DESIGN.md
- [x] Descarga de 16 imágenes a `apps/web/public/images/` con nombres limpios
- [x] favicon.svg de marca
- [x] Este plan guardado

### Fase 1 — libs/shared ✅

- [x] `enums/vertical.enum.ts`: VerticalKey = ALOJAMIENTO|TRANSPORTE|VETERINARIA|PELUQUERIA|ADIESTRAMIENTO
- [x] Rebuild shared (`npm run build --workspace=shared`)

### Fase 2 — API verticales nuevas (apps/api/src/verticals/)

- [x] `alojamiento/` (schema espacios[], strategy noches, module, seeder, specs) — desde hoteles
- [x] `transporte/` (reescrito: transporte de animales, strategy km, seeder, specs) — desde taxis
- [x] `veterinaria/` (schema citas, strategy cupos+hora, seeder, specs)
- [x] `peluqueria/` (schema grooming, strategy cupos+hora, seeder, specs)
- [x] `adiestramiento/` (schema sesiones, strategy cupos, seeder, specs)
- [x] Eliminar `hoteles/ vuelos/ taxis/ guarderia/` viejos
- [x] `core/catalog/catalog.module.ts`: discriminators nuevos
- [x] `app.module.ts`: imports nuevos
- [x] `core/ai-search/ai-search.service.ts`: prompt ya 100% canino (5 categorías)
- [x] `core/catalog/catalog.service.ts`: DTOs/métodos `Hotel*`/`buscarHoteles` → genéricos `Servicio*`/`buscarServicios` (catálogo sirve a los 5 verticales; JSON sin cambios; api 133/133 verde)
- [x] `scripts/seed-europe.ts`: reescrito a 6 comercios + 12 servicios + 3 reservas + 3 cupones + 6 comision_configs caninos (compila)
- [ ] `scripts/seed-all.ts` (Perú/PEN — obsoleto tras migración a EUR; **DECISIÓN PENDIENTE del cliente: borrar o migrar**)
- [x] `scripts/clear-seed-data.ts`: nombres de colección caninos
- [x] Specs del core que referencian verticales viejas actualizados (VerticalKey.HOTELES→ALOJAMIENTO, etc.)
- [x] `nest build` OK + tests api OK (29 suites / 133 tests verdes; también arreglado wiring DI preexistente de comercios/admin specs)

### Fase 3 — Web: design system Doogking

- [ ] `styles.scss`: retheme completo de tokens (paleta Doogking, fuentes, sombras azuladas, footer navy) manteniendo nombres de tokens/clases rs-\*
- [ ] `index.html`: title, favicon.svg, Google Fonts (Plus Jakarta Sans, Inter, Montserrat)
- [ ] `rs-navbar`: logo Doogking, links nuevos, CTA "Hazte partner" navy
- [ ] `shared/media/images.ts`: imágenes locales de marca + fallbacks caninos

### Fase 4 — Web: features caninas

- [x] `features/home`: hero Doogking (slogan, hero-home.jpg, buscador card blanca, 5 badges circulares de categorías, sección recomendados)
- [x] `features/buscador`: array verticales nuevo (labels/iconos/placeholders/fechas por categoría)
- [x] `features/hoteles` → `features/alojamiento` (lista + detalle adaptados); feature vieja eliminada
- [x] `features/taxis` → `features/transporte` (traslado de mascotas); feature vieja eliminada
- [x] `features/verticales` CONFIGS: veterinaria, peluqueria, adiestramiento
- [x] `app.routes.ts`: rutas /alojamiento /transporte /veterinaria /peluqueria /adiestramiento
- [x] `features/reservas` (wizard + mis-reservas): lógica por vertical nueva; mis-reservas re-cableado a AlojamientoService
- [x] `panel-admin`: labels/reportes por categoría (admin-reportes, cupones-admin, admin-comercios, comercio-resenas)
- [x] `panel-comercio`: mapa de iconos por categoría canina + reseñas mock caninas (formularios de alta por categoría: pendiente ampliar)
- [x] Textos Reservalo → Doogking: app web ya sin "Reservalo"; docs/skills (speckit, nuevo-componente, ui-kit, SCOPE) rebrandeados. Solo queda `seed-all.ts` (obsoleto)
- [x] `ng build` OK + tests web OK (8 suites / 49 tests verdes; reparado setup-jest preexistente: `reflect-metadata` + mock de `IntersectionObserver`, y 2 tests de auth desactualizados)

### Fase 5 — Skills, memoria, reglas

- [x] `.claude/commands/design-tokens.md`: tokens Doogking (ya migrado — `--dk-blue`, Plus Jakarta Sans, footer navy)
- [x] `.claude/commands/ui-kit.md` + `nuevo-componente.md`: reglas Doogking (rebrandeados)
- [x] CLAUDE.md: rebrand completo a Doogking (secciones 0-11 de dominio: concepto, 5 categorías caninas, EUR/IVA 21%, Stripe, schemas, roadmap, mercado europeo; `ruc`→`vatNumber`). 0 términos viejos.
- [x] CLAUDE.md §21 (UI Kit): alineado al design system real de Doogking (tema claro, Royal King Blue #08258B + Crown Gold #FBAE17, fuentes Plus Jakarta Sans/Inter/Montserrat, nombres de token reales de styles.scss). Eliminada la filosofía "premium dark" antigua.
- [x] Memoria Claude (`memory/`): N/A — el directorio `memory/` no existe en el repo
- [x] SCOPE.md actualizado (rebrandeado a Doogking)

### Fase 6 — Verificación final

- [x] `npm run build --workspace=shared` → `--workspace=api` → `--workspace=web` (los tres compilan)
- [x] Tests api (133/133) + web (49/49) en verde
- [ ] Revisión visual (levantar web) — hero, resultados, detalle, panel comercio

---

## 5. Decisiones tomadas (para no re-discutir)

1. **Moneda EUR + IVA 21%** — el código ya migró a Europa (seed-europe, MONEDA_DEFAULT='EUR'); los diseños stitch muestran €. CLAUDE.md se actualiza en consecuencia.
2. Los **keys** de vertical van en minúsculas y singular femenino/masculino natural: `alojamiento, transporte, veterinaria, peluqueria, adiestramiento` (sin tildes ni ñ).
3. `transporte` reutiliza el key viejo pero cambia el significado (carga → mascotas). El módulo se reescribe.
4. El motor core (availability registry, bookings, payments, comision_configs) **no cambia estructuralmente**.
5. Tokens CSS conservan sus nombres actuales (`--c-accent`…, clases `rs-*`) — solo cambian valores + se añaden `--dk-*` alias. Razón: 26+ componentes ya los consumen.
6. Iconografía de categorías: imágenes circulares descargadas (categoria-\*.jpg) en home; iconos SVG line-style azules para utilidades.
7. `features/vuelos` desaparece sin sustituto directo (5 verticales viejas → 5 nuevas, mapping en §1).
