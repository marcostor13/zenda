# PLAN MAESTRO — Migración Reservalo/Doogking → **Doogking**

> **Documento de contexto persistente.** Si la sesión se cae, retomar leyendo este archivo: contiene el estudio, todas las decisiones y el checklist de progreso (marcar `[x]` al completar cada paso).
>
> Última actualización: 2026-07-10 · Estado: **EN PROGRESO**
>
> **Log de sesión 2026-07-10** — Frontend: rutas migradas a las 5 categorías caninas (`/alojamiento /transporte /veterinaria /peluqueria /adiestramiento`); eliminadas features viejas `hoteles/` y `taxis/`; `mis-reservas` re-cableado a `AlojamientoService`; paneles admin (reportes, cupones, comercios) y reseñas de comercio migrados a verticales caninos. Web compila (`ng build` OK). **Pendiente:** backend seeds caninos (`seed-europe`, `clear-seed-data`), naming DTOs catalog, tests api/web, barrido final de textos y panel-comercio.

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
- [ ] `core/ai-search/ai-search.service.ts`: prompt con categorías caninas (falta pulir wording)
- [ ] `core/catalog/catalog.service.ts`: renombrar DTOs Hotel→Alojamiento (funciona, naming heredado)
- [ ] `core/catalog/catalog.seeder.ts`: demo de alojamientos caninos
- [ ] `scripts/seed-europe.ts`: comercios/servicios caninos + comision_configs nuevas (aún datos hoteles/vuelos/taxis)
- [ ] `scripts/seed-all.ts` (Perú/PEN — obsoleto tras migración a EUR; decidir borrar o migrar)
- [ ] `scripts/clear-seed-data.ts`: nombres de colección caninos
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
- [ ] `panel-comercio` (listado-nuevo): formularios por categoría según schemas nuevos (pendiente revisar)
- [ ] Textos Doogking/Reservalo → Doogking en toda la app (pendiente barrido final)
- [x] `ng build` OK (web compila) — tests web pendientes

### Fase 5 — Skills, memoria, reglas

- [ ] `.claude/commands/design-tokens.md`: tokens Doogking
- [ ] `.claude/commands/ui-kit.md` + `nuevo-componente.md`: reglas Doogking
- [ ] CLAUDE.md: rebrand Doogking + categorías caninas + design system (secciones 0, 2, 4, 21)
- [ ] Memoria Claude (`memory/`): project-reservalo.md → Doogking, design-system.md nuevo
- [ ] SCOPE.md actualizado

### Fase 6 — Verificación final

- [ ] `npm run build --workspace=shared` → `--workspace=api` → `--workspace=web`
- [ ] Tests api + web
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
