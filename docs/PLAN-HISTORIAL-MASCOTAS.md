# Plan — Historial de servicios de las mascotas (comercio ↔ cliente)

> Petición del cliente (2026-09-13): el comercio veterinario no tiene dónde rellenar
> el historial de la mascota; el comercio debe ver las mascotas de sus clientes, guardar
> lo que se hizo en cada servicio (veterinaria, peluquería, adiestramiento) y sacar un
> informe PDF por mascota. El cliente debe ver todo eso en la ficha de su perro
> (`/perros`), con una ficha completa y profesional.

## 1. Diagnóstico (estado del código antes del cambio)

| Qué | Dónde | Problema |
|---|---|---|
| Colección `perro_historial` y `POST /perros/:id/historial` | `apps/api/src/core/perros` | Existe, pero **cualquier** comercio podía escribir en la ficha de **cualquier** perro, y leer su historia veterinaria, sin tener relación con él. |
| Panel del comercio | `comercio-reservas.component.ts` | El historial sólo aparece escondido dentro de la tarjeta de cada reserva: en veterinaria es de **sólo lectura** + importar pegando Excel; en peluquería no hay nada; en adiestramiento, tres textareas. No hay sección "mascotas". |
| Informe PDF | — | No existe. No hay librería de PDF en el monorepo. |
| `/perros` (cliente) | `perros-lista.component.ts` | Tarjeta con un desplegable que enseña 3 notas sueltas sin fecha ni comercio. No hay página de detalle de la ficha. |

## 2. Solución

### 2.1 Modelo (libs/shared + API)
- `libs/shared/src/catalogos/registro-servicio.ts`: verticales con historial
  (`veterinaria`, `peluqueria`, `adiestramiento`) y los **campos estructurados** de cada
  uno (motivo, diagnóstico, tratamiento… / servicios realizados, productos… / objetivos,
  ejercicios, evolución…). Una sola definición que usan el formulario, la ficha y el PDF.
- `CrearRegistroServicioDto` / `ActualizarRegistroServicioDto`.
- `PerroHistorial` gana `titulo`, `fechaServicio`, `profesional`, `proximaCita`, `autorId`.

### 2.2 API — módulo nuevo `core/expedientes`
Separado de `perros` porque `catalog` ya importa `perros` y el expediente necesita
servicios, comercios y usuarios (evita el ciclo).

| Endpoint | Rol | Qué hace |
|---|---|---|
| `GET /comercio/mascotas?q=` | comercio | Mascotas con ficha que han reservado en el comercio: dueño, nº de servicios, último servicio, nº de registros. |
| `GET /comercio/mascotas/:perroId` | comercio | Ficha completa rellenada por el cliente + contacto del dueño + reservas con el comercio + historial (lo propio y lo que el dueño comparte con su categoría). |
| `POST /comercio/mascotas/:perroId/registros` | comercio | Registro de servicio estructurado. |
| `PATCH/DELETE /comercio/mascotas/:perroId/registros/:id` | comercio | Sólo sus propios registros. |
| `GET /comercio/mascotas/:perroId/informe` | comercio | PDF de la mascota. |
| `GET /perros/:id/expediente` | propietario | Ficha + línea de tiempo: registros de profesionales (con nombre del comercio) y servicios realizados. |
| `GET /perros/:id/informe` | propietario | PDF de la ficha completa. |

**Regla de acceso:** un comercio sólo ve o escribe en la ficha de un perro si tiene al
menos una reserva con ese perro. Se aplica también a los endpoints antiguos
(`POST /perros/:id/historial`, `importar`, `historia-veterinaria`).

PDF con `pdfkit` en el API (JS puro, sin navegador; viaja en la imagen de producción).

### 2.3 Web — panel del comercio
- Nueva sección **Mascotas** en el menú (`/comercio/mascotas`): buscador + tarjetas.
- **Expediente** (`/comercio/mascotas/:perroId`): cabecera con foto, datos, alertas de
  salud y contacto del dueño; botones *Nuevo registro* y *Descargar PDF*; pestañas
  *Historial* (línea de tiempo + formulario por categoría, editar/borrar lo propio),
  *Ficha del cliente* y *Servicios*.
- En cada reserva con perro, enlace *Ficha e historial*.

### 2.4 Web — cliente
- **Ficha del perro** (`/perros/:id`): hero con foto y datos clave, avisos de salud,
  indicadores (servicios, último veterinario, próxima cita, bienestar), pestañas
  *Resumen*, *Historial* (línea de tiempo filtrable por categoría, con el detalle que
  escribió cada profesional), *Salud*, *Comportamiento* y *Documentos*; *Descargar PDF*.
- La tarjeta de `/perros` abre la ficha.

### 2.5 Pruebas
- Unitarias de servicios, controladores y componentes nuevos; specs antiguos adaptados a la regla de acceso.
- E2E API (supertest + Mongo en memoria): `test/expedientes.e2e-spec.ts`.
- E2E web (Playwright): `e2e/historial-mascotas.spec.ts`.
- Builds: shared → tsc → nest build → ng build; i18n en los 7 idiomas.

## 3. Estado (2026-09-13)
- [x] Shared + schema (`catalogos/registro-servicio.ts`, DTOs, campos nuevos en `perro_historial`, índice `reservas {perroId, comercioId}`)
- [x] API `core/expedientes` + informe PDF (pdfkit) + regla de acceso también en los endpoints antiguos
- [x] Panel comercio: sección Mascotas, expediente con pestañas, formulario por categoría, enlace desde reservas
- [x] Ficha del cliente `/perros/:id` y enlace desde `/perros`
- [x] i18n: `traducciones/<idioma>/historial.ts` (153 cadenas × 7 idiomas)
- [x] Tests: unitarios nuevos (API, web, shared), `test/expedientes.e2e-spec.ts` (13), `e2e/historial-mascotas.spec.ts` (7 × escritorio y móvil)
- [x] Builds (shared, nest, ng) y commit a main

## 4. Cómo comprobarlo
1. Comercio veterinario → menú **Mascotas** → abrir una mascota → **Nuevo registro** → guardar → **Descargar PDF**.
2. Desde **Reservas**, en una reserva con perro: **Gestionar → Registrar servicio** abre el formulario ya vinculado.
3. Cliente dueño → **Mis perros → Ver ficha e historial** → pestaña **Historial**: aparece el registro con el nombre de la clínica.
4. Un comercio sin reservas con ese perro recibe 403 en `/comercio/mascotas/:id` y en `POST /perros/:id/historial`.
