# Doogking — Historias de Usuario y plan de implementación

**Fecha:** 27/07/2026
**Origen:** Revisión completa de la plataforma enviada por el cliente (Edgar y socio) por WhatsApp el 27/07/2026.
**Destinatario:** Equipo de desarrollo (Marcos).
**Objetivo:** Elevar Doogking al nivel de percepción de Booking/Airbnb sin cambiar la estructura funcional, cuidando jerarquía visual, microinteracciones, coherencia entre categorías y aprovechando el gran diferencial del proyecto: la **Ficha Inteligente de la mascota**.

---

## Cómo leer este documento

Cada cambio se expresa como **historia de usuario** con este formato:

> **HU-XX** — _Como [rol], quiero [acción], para [beneficio]._
> **Criterios de aceptación:** condiciones verificables de "hecho".
> **Notas técnicas / diseño:** detalle concreto de implementación.
> **📍 Ubicación:** página, ruta y sección de la plataforma donde está el cambio (indicada a nivel de cada bloque y subsección; aplica a todas las historias que contiene).

**Roles usados:**

- **Cliente** = dueño de mascota que reserva servicios.
- **Profesional** = negocio/proveedor (veterinario, peluquería, hotel, transportista, adiestrador…).
- **Administrador** = equipo Doogking que configura la plataforma.

**Prioridades:** `P1` (alta / impacto directo en conversión o bug), `P2` (media), `P3` (refinamiento).

**Orden de implementación recomendado:** primero el **Bloque 0 (Sistema de diseño)**, porque define estándares que el resto de bloques reutilizan; después Home y buscador; luego listados, fichas y flujos de reserva; después onboarding de empresas y área de cliente; y por último fidelización, ayuda y panel de administración. Los **bugs críticos** (Bloque 16) pueden abordarse en paralelo desde el día 1.

---

## Índice de bloques

0. Sistema de diseño transversal (design system)
1. Home / Landing
2. Buscador (Hero + barra de búsqueda)
3. Listados de resultados (unificados)
4. Fichas de detalle
5. Flujos de reserva (transversal + por categoría)
6. Registro de empresas (onboarding profesional) + email de verificación
7. Área de cliente — Centro de Control
8. Ficha Inteligente de la mascota (perfil y creación)
9. Mis reservas
10. Favoritos
11. Mis reseñas / valoraciones
12. Menú "Mi cuenta"
13. Programa de fidelización — Doogking Alpha
14. Centro de ayuda (cliente y profesional)
15. Panel de administración (configurabilidad)
16. Bugs y correcciones críticas

---

## Mapa de rutas y ubicaciones

> **Entorno:** las capturas provienen del entorno de desarrollo (Amplify): `main.dkzzf3hf9574c.amplifyapp.com`. Las rutas marcadas _(orientativa)_ son inferidas a partir de la navegación; confírmalas con el enrutado real del proyecto.

| Área                             | Ruta                                   | Cómo llegar                              |
| -------------------------------- | -------------------------------------- | ---------------------------------------- |
| Home / Landing                   | `/`                                    | Página de inicio (logo Doogking)         |
| Listado Veterinarios             | `/veterinarios` _(orient.)_            | Menú superior → Veterinarios             |
| Listado Peluquería               | `/peluqueria` _(orient.)_              | Menú superior → Peluquería               |
| Listado Alojamiento              | `/alojamiento`                         | Menú superior → Alojamiento canino       |
| Listado Transporte               | `/transporte` _(orient.)_              | Menú superior → Transporte               |
| Listado Adiestramiento           | `/adiestramiento` _(orient.)_          | Menú superior → Adiestramiento           |
| Listado Hoteles                  | `/hoteles`                             | Menú superior → Hoteles                  |
| Listado Seguros / Cuidadores     | `/seguros` · `/cuidadores` _(orient.)_ | Menú superior → Seguros / Cuidadores     |
| Ficha de detalle                 | `/<categoria>/:id` _(orient.)_         | Tarjeta del listado → Ver disponibilidad |
| Reserva (checkout)               | `/reserva/<categoria>` _(orient.)_     | Ficha/listado → Reservar                 |
| Registro de empresas             | `/registro-empresa` _(orient.)_        | Botón «REGISTRA TU EMPRESA»              |
| Mi perfil / Centro de Control    | `/mi-cuenta` _(orient.)_               | Menú «Mi cuenta» → Mi perfil             |
| Mis mascotas (Ficha Inteligente) | `/mis-mascotas` _(orient.)_            | Menú «Mi cuenta» → Mis mascotas          |
| Alta de mascota                  | `/mascota/nueva` _(orient.)_           | Mis mascotas → Registrar nueva mascota   |
| Mis reservas                     | `/mis-reservas` _(orient.)_            | Menú «Mi cuenta» → Mis reservas          |
| Favoritos                        | `/favoritos` _(orient.)_               | Menú «Mi cuenta» → Favoritos / icono ❤️  |
| Mis reseñas                      | `/mis-resenas` _(orient.)_             | Menú «Mi cuenta» → Mis reseñas           |
| Centro de ayuda                  | `/ayuda` _(orient.)_                   | Footer «Centro de ayuda» / icono 💬      |
| Panel de administración          | backoffice                             | Acceso interno Doogking / profesional    |

---

# Bloque 0 — Sistema de diseño transversal (design system)

> 📍 **Ubicación:** Transversal a TODA la plataforma. No es una pantalla concreta: se implementa como **librería de componentes y tokens de diseño** (Card, botones, chips, valoración, badges, resumen sticky…) reutilizados en Home, listados, fichas, reservas y área de cliente.

> **Por qué primero:** casi todas las observaciones del cliente se repiten pantalla a pantalla (tarjetas con más vida, sombras, hover, más aire, precio protagonista, botones grandes, chips redondeados, coherencia). Definir estos estándares una sola vez y aplicarlos como componentes reutilizables evita repetir trabajo y garantiza la coherencia visual que el cliente pide expresamente entre todas las categorías.

### HU-0.1 — Componente Tarjeta (Card) unificado · `P1`

_Como Cliente, quiero que todas las tarjetas (servicios, ciudades, alojamientos, resultados, favoritos) tengan el mismo lenguaje visual, para aprender a usar la plataforma una sola vez y percibirla como un producto profesional y coherente._

**Criterios de aceptación:**

- Existe un único componente `Card` reutilizado en Home, listados, favoritos y fichas.
- Radio de esquinas 20–24 px, fondo blanco, **borde gris casi invisible** (preferir sombra sobre borde).
- Sombra suave permanente; al `hover` la sombra aumenta.
- Todas las tarjetas de una misma fila tienen **exactamente la misma altura**.
- Separación entre tarjetas incrementada (+10–15 px respecto al estado actual).
- Toda la tarjeta es clicable (no solo la imagen o el texto) y muestra cursor tipo mano.

**Notas técnicas / diseño:** definir tokens de diseño (radios, sombras, espaciados) y un componente base parametrizable (imagen, badges, título, valoración, precio, botón).

### HU-0.2 — Microinteracciones y estados hover estándar · `P1`

_Como Cliente, quiero que los elementos reaccionen sutilmente al pasar el ratón, para percibir una plataforma moderna y "premium"._

**Criterios de aceptación:**

- Hover de tarjeta: se eleva 4–5 px, aumenta la sombra, la fotografía hace un zoom suave (3–5 %), transición de 0,2 s.
- Iconos: al hover, pequeño zoom/rotación muy ligera.
- Transiciones globales de ~200 ms; nada brusco ni exagerado.
- Aparición de contenido con `fade-in` (carga progresiva de imágenes).

**Notas técnicas / diseño:** centralizar las transiciones en utilidades/mixins compartidos; respetar `prefers-reduced-motion`.

### HU-0.3 — Sistema tipográfico y jerarquía visual · `P1`

_Como Cliente, quiero una jerarquía tipográfica clara, para entender de un vistazo qué es lo importante de cada pantalla._

**Criterios de aceptación:**

- Títulos de sección más grandes y con más peso (aprox. +20–25 % respecto al actual en las secciones señaladas).
- El ancho de los textos largos (subtítulos/descripciones) se limita a ~700–800 px para facilitar lectura (máx. 2 líneas en subtítulos).
- Escala tipográfica definida (H1, H2, H3, body, caption) y aplicada de forma consistente.

### HU-0.4 — Botones estándar · `P1`

_Como Cliente, quiero botones de acción claros y consistentes, para saber siempre cuál es el paso principal._

**Criterios de aceptación:**

- Botón primario (amarillo Doogking): mayor altura y ancho, esquinas más redondeadas, sombra, estado hover, estilo "tipo Booking".
- Botón primario de formularios de reserva ocupa prácticamente todo el ancho del bloque y es el elemento más destacado.
- El amarillo corporativo se reserva solo para lo importante (CTA, elemento seleccionado, valoración/destacados).

### HU-0.5 — Chips / filtros redondeados · `P2`

_Como Cliente, quiero filtros con aspecto de "chips" modernos, para filtrar de forma cómoda y visualmente agradable._

**Criterios de aceptación:**

- Filtros con forma de chip, radio 20–24 px.
- Estado activo: fondo amarillo + texto negro.
- El filtro "Todos" se distingue (color o icono) como vista general.
- Iconos de filtro aumentados ~15–20 % respecto al actual.

### HU-0.6 — Resumen de reserva "sticky" · `P1`

_Como Cliente, quiero que el resumen de precio permanezca visible mientras hago scroll, para revisar el importe en todo momento._

**Criterios de aceptación:**

- En todas las pantallas de ficha y de reserva, el bloque "Resumen de precio" queda fijo (sticky) al desplazarse.
- El total se muestra ~30 % más grande, separado por una línea superior.

### HU-0.7 — Componente "Bloque de confianza" reutilizable · `P2`

_Como Cliente, quiero ver mensajes de seguridad consistentes antes de pagar, para reservar con tranquilidad._

**Criterios de aceptación:**

- Componente reutilizable con checks: Pago seguro con Stripe, Confirmación inmediata, Sin cargos ocultos, Cancelación según política, Atención al cliente.
- Variante "Protección Doogking" para fichas de alojamiento/reserva.

### HU-0.8 — Componente Valoración estilo Booking · `P2`

_Como Cliente, quiero ver las valoraciones en un formato claro y reconocible, para juzgar rápido la calidad._

**Criterios de aceptación:**

- Componente único: recuadro de color con la nota (p. ej. `9,4`), etiqueta cualitativa ("Excepcional"/"Muy bueno") y nº de reseñas.
- Se usa igual en listados, fichas y tarjetas de reserva.

### HU-0.9 — Sistema de badges/etiquetas automáticas · `P2`

_Como Cliente, quiero ver etiquetas destacadas (Recomendado, Más reservado, Mejor valorado…), para identificar rápidamente las mejores opciones._

**Criterios de aceptación:**

- Set de badges reutilizable: `⭐ Recomendado`, `🔥 Más reservado`, `🏆 Mejor valorado`, `⚡ Responde en < 1 h`, `🔥 Últimas plazas`.
- Los badges se **generan automáticamente** a partir de datos reales del profesional/plataforma (no textos manuales falsos).

### HU-0.10 — Iconografía unificada · `P2`

_Como Cliente, quiero que todos los iconos compartan un mismo estilo, para percibir una interfaz cuidada._

**Criterios de aceptación:**

- Una única librería de iconos en toda la plataforma.
- Se sustituyen los iconos de estilos mezclados detectados en hoteles y otras secciones.

### HU-0.11 — Espaciado y "aire" global · `P2`

_Como Cliente, quiero más espacio en blanco entre secciones y elementos, para que la plataforma transmita calidad y no agobie._

**Criterios de aceptación:**

- Escala de espaciado definida (p. ej. 8/16/24/32/40 px) aplicada de forma consistente.
- Más margen superior entre secciones (referencia: +30–40 px donde el cliente lo señaló).
- Alineación estricta: título, descripción, filtros, botones y contenido comienzan en la misma línea vertical.

### HU-0.12 — Coherencia entre categorías · `P1`

_Como Cliente, quiero la misma estructura visual en alojamiento, transporte, veterinario, peluquería, adiestramiento y hoteles, para tener siempre la misma experiencia sin importar qué reservo._

**Criterios de aceptación:**

- Todos los listados comparten: foto grande, valoración en el mismo sitio, precio en el mismo sitio, etiquetas con el mismo formato, botón de reserva idéntico, tarjetas de misma altura y estilo.
- Cualquier cambio de diseño en un listado se refleja en todos por usar los mismos componentes.

---

# Bloque 1 — Home / Landing

> 📍 **Ubicación general:** Página de inicio. · **Ruta:** `/` (Home). · **Cómo llegar:** logo Doogking / entrar a la web. Cada subsección indica su franja concreta dentro de la Home.

> El cliente valida la **estructura** de la Home (10/10) y su recorrido: Buscador → Servicios → ¿Por qué Doogking? → Ciudades → Recomendados → Explora → Cómo funciona → Captación de empresas → Footer. No cambia el orden; pide refinar cada sección.

## 1.1 Hero (parte superior)

> 📍 **Ubicación:** Home · **Ruta:** `/` · **Sección/componente:** Cabecera visual: logo grande + eslogan «Todo para tu Rey en un solo lugar» + buscador.

### HU-1.1.1 — Nuevo titular y subtítulo del hero · `P1`

_Como Cliente, quiero un titular claro y emocional que resuma la propuesta, para entender en 1 segundo qué me ofrece Doogking._

**Criterios de aceptación:**

- Titular pasa a: **"Todo para tu mascota en un solo lugar"**.
- Subtítulo debajo: **"Veterinarios, peluquerías, residencias, hoteles pet friendly, transporte, adiestramiento y mucho más."**
- Alternativa de eslogan corto aprobada como copy de apoyo: _"Reserva en menos de un minuto con profesionales de confianza cerca de ti."_

### HU-1.1.2 — El buscador es el protagonista del hero · `P1`

_Como Cliente, quiero que el buscador destaque más que el eslogan, para empezar la reserva de inmediato (es donde se genera el negocio)._

**Criterios de aceptación:**

- Se invierte ligeramente la jerarquía: el eslogan se mantiene, pero la mirada del usuario va directa al buscador.
- Se reduce el espacio entre el eslogan y el buscador (ahora quedan muy separados).
- Justo encima del buscador aparece una frase orientadora tipo: **"Encuentra el servicio perfecto para tu mascota"**.

> Nota del cliente marcada como 🚨 **prioritaria**: en Booking el buscador es el protagonista absoluto; en Doogking el eslogan pesa más. Corregir esto puede mejorar la conversión sin cambiar la estructura.

## 1.2 Barra de búsqueda (ver también Bloque 2)

> 📍 **Ubicación:** Home · **Ruta:** `/` · **Sección/componente:** Buscador del hero: selector de categorías + campos ¿Dónde?/Entrada/Salida/¿Para qué mascota? + botón Buscar.

### HU-1.2.1 — Textos de los campos del buscador · `P2`

_Como Cliente, quiero etiquetas de campo más humanas, para sentir que la plataforma me habla a mí y a mi mascota._

**Criterios de aceptación:**

- "¿Qué servicio necesitas?" → **"¿Qué necesita tu mascota?"**
- "¿Dónde?" → **"¿Dónde buscas el servicio?"**

### HU-1.2.2 — Botón Buscar protagonista · `P1`

_Como Cliente, quiero que el botón Buscar sea el elemento más visible del buscador, para saber dónde pulsar._

**Criterios de aceptación:**

- Botón "Buscar" ~15 % más ancho; icono de lupa ligeramente mayor.
- Es el elemento que más destaca de toda la búsqueda.

### HU-1.2.3 — Categoría seleccionada resaltada · `P2`

_Como Cliente, quiero ver claramente qué categoría de servicio he seleccionado, para tener seguridad de mi elección._

**Criterios de aceptación:**

- Icono de categoría seleccionada: mayor tamaño, fondo ligeramente más claro, borde amarillo algo más grueso y pequeña sombra.

### HU-1.2.4 — Franja de confianza bajo el buscador · `P3`

_Como Cliente, quiero ver garantías justo bajo el buscador, para reservar con confianza._

**Criterios de aceptación:**

- Copys: **"✅ Profesionales verificados", "✅ Reserva 100 % segura", "✅ Atención 24/7 cuando la necesites"**.

### HU-1.2.5 — Navegación superior jerarquizada · `P3`

_Como Cliente/Profesional, quiero identificar rápido las acciones clave del menú superior, para no perderme entre opciones._

**Criterios de aceptación:**

- Se da más peso visual a **"Registra tu empresa"** y **"Mi cuenta"**.
- Idioma y moneda pierden peso visual (secundarios).

## 1.3 Bloque de 3 valores (bajo el buscador)

> 📍 **Ubicación:** Home · **Ruta:** `/` · **Sección/componente:** Franja azul bajo el buscador: Profesionales verificados / Reserva segura / Atención 24-7.

### HU-1.3.1 — Copys de los 3 valores · `P2`

_Como Cliente, quiero mensajes de valor claros y emocionales, para confiar en la plataforma._

**Criterios de aceptación (textos aprobados):**

- **Reserva en menos de un minuto** — "Encuentra y reserva el servicio perfecto sin llamadas, sin esperas y con confirmación inmediata."
- **Profesionales verificados** — "Cada empresa es validada antes de unirse a Doogking para que reserves con total confianza. Reseñas reales de clientes completan cada perfil."
- **Atención 24/7** — "Siempre disponibles para ayudarte antes, durante y después de cada reserva."
- Se prioriza el uso de **imágenes** en lugar de iconos donde sea posible (más emocional, referencia Airbnb).

## 1.4 Sección de servicios (categorías)

> 📍 **Ubicación:** Home · **Ruta:** `/` · **Sección/componente:** Sección «Explora todos nuestros servicios» (parrilla de categorías).

### HU-1.4.1 — Nuevos copys de subtítulo por categoría · `P2`

_Como Cliente, quiero descripciones de servicio más emocionales, para conectar con el beneficio de cada categoría._

**Criterios de aceptación (textos aprobados):**

| Categoría            | Texto nuevo                                                           |
| -------------------- | --------------------------------------------------------------------- |
| Veterinarios         | "Cuida su salud con veterinarios de confianza."                       |
| Peluquería           | "Porque también merece verse y sentirse increíble."                   |
| Alojamiento          | "Déjalo en las mejores manos mientras tú disfrutas con tranquilidad." |
| Transporte           | "Viajes seguros y cómodos para tu mascota."                           |
| Adiestramiento       | "Mejora su comportamiento con profesionales especializados."          |
| Seguros              | "Protege a quien más quieres frente a cualquier imprevisto."          |
| Hoteles Pet Friendly | "Descubre alojamientos donde vuestra mascota también es bienvenida."  |

### HU-1.4.2 — Añadir apartado "Explora con tu mascota" a la parrilla de servicios · `P2`

_Como Cliente, quiero acceder a lugares pet friendly (parques, ríos, playas) desde los servicios, para descubrir planes y sentir comunidad._

**Criterios de aceptación:**

- Existe la categoría/acceso "Explora con tu mascota" (comunidad de parques, ríos, playas, etc.).

### HU-1.4.3 — Tarjetas de categoría más premium · `P2`

_Como Cliente, quiero tarjetas de servicio con más vida, para percibir calidad._

**Criterios de aceptación:**

- Aplica HU-0.1/0.2: sombra suave, hover con elevación (+4 px) y sombra, icono +20 % y su cuadrado más grande, borde casi invisible, misma altura en todas.
- La flecha derecha se convierte en botón circular `○ →` que al hover cambia a amarillo.
- Fondo de sección gris muy claro (#FAFAFA) con tarjetas blancas para que resalten.
- (Opcional/futuro) Cada categoría con **fotografía panorámica** superior (tarjetas de 280–320 px de alto) al estilo Booking.

## 1.5 Sección "¿Por qué Doogking?"

> 📍 **Ubicación:** Home · **Ruta:** `/` · **Sección/componente:** Sección «¿Por qué Doogking.com?» (tarjetas de beneficios).

### HU-1.5.1 — Refinar el bloque de beneficios · `P2`

_Como Cliente, quiero entender por qué elegir Doogking con una sección atractiva, para decidir con confianza._

**Criterios de aceptación:**

- Título más grande y protagonista.
- Un beneficio destacado (p. ej. "Reserva en segundos") con borde amarillo/sombra ligeramente mayor para dirigir la mirada.
- +20 px entre tarjetas y +20 px de margen superior; +30 px entre título y tarjetas.
- Iconos +20 %, cuadrado amarillo algo mayor; hover con elevación (+5 px), zoom del icono y transición 0,2 s.
- Fondo gris muy claro (#FAFAFA), tarjetas blancas; borde casi invisible.
- (Recomendado) Banda fotográfica horizontal elegante (familia disfrutando con su mascota) entre el título y las tarjetas, para aportar emoción.

## 1.6 Sección "Servicios cerca de ti" (Ciudades)

> 📍 **Ubicación:** Home · **Ruta:** `/` · **Sección/componente:** Sección/carrusel de ciudades («Servicios cerca de ti»).

### HU-1.6.1 — Tarjetas de ciudad orientadas a "destino" · `P2`

_Como Cliente, quiero que las tarjetas de ciudad me inviten a explorar, para hacer clic y ver los resultados filtrados._

**Criterios de aceptación:**

- Altura de tarjeta +15 %; fotografía horizontal de alta calidad con degradado oscuro inferior para leer el texto.
- Nombre de ciudad más grande que el número de servicios (p. ej. "Madrid" / "248 servicios disponibles").
- Radio 20–24 px; sombra suave permanente que aumenta al hover; +10–15 px de separación horizontal.
- Toda la tarjeta clicable; cursor mano; carga con `fade-in`.
- Carrusel con flechas laterales elegantes, scroll con rueda y gestos táctiles, desplazamiento fluido.
- Las fotos representan el **servicio dominante** de la ciudad, no fotos genéricas de perros.
- (Recomendado) Dato dinámico opcional bajo el número: `⭐ 4,8 valoración media`, `🏆 Más reservada este mes` o `🔥 Tendencia`, solo en ciudades destacadas.

## 1.7 Sección "Recomendados"

> 📍 **Ubicación:** Home · **Ruta:** `/` · **Sección/componente:** Sección «Alojamientos/servicios recomendados».

### HU-1.7.1 — Tarjetas de recomendados tipo Booking · `P2`

_Como Cliente, quiero ver alojamientos/servicios recomendados con fotos grandes y precio claro, para decidir rápido._

**Criterios de aceptación:**

- Altura +15 %; la fotografía ocupa 60–65 % de la tarjeta.
- Precio destacado: formato "Desde 42 € / noche".
- Botón más premium (ancho, alto, esquinas redondeadas, hover amarillo).
- Etiqueta "RECOMENDADO" más pequeña y elegante.
- Valoración estilo Booking (HU-0.8): recuadro con nota + "Excepcional" + nº reseñas.
- Servicios como etiquetas con más separación, fondo gris muy suave y borde poco marcado.
- Hover: tarjeta sube, foto con zoom, sombra aumenta, botón cambia.
- Botón "Ver todos →" visible.
- (Recomendado) Botón ❤️ Guardar/Favorito al hover sobre la tarjeta.
- (Diferencial Doogking) Insignias emocionales según datos: `🐶 Ideal para perros sociables`, `🌳 Grandes zonas de recreo`, `🏊 Piscina para perros`, `👨‍⚕️ Veterinario 24 h`, `📹 Cámaras en directo`.

## 1.8 Sección "Explora con tu mascota" (comunidad)

> 📍 **Ubicación:** Home · **Ruta:** `/` · **Sección/componente:** Sección «Explora con tu mascota» (mosaico de lugares pet friendly).

### HU-1.8.1 — Mosaico inspiracional de lugares pet friendly · `P2`

_Como Cliente, quiero una sección inspiracional de lugares pet friendly, para soñar planes y experiencias con mi mascota._

**Criterios de aceptación:**

- Se mantiene el mosaico de imágenes (gusta mucho); imágenes emocionales, cálidas, con luz natural y siempre una mascota disfrutando con personas.
- Composición tipo Pinterest (tamaños variados: una grande, dos medianas, una panorámica).
- +40 px de margen superior; degradado inferior algo más oscuro para leer el texto blanco; toda la tarjeta clicable; hover con zoom + sombra + elevación.
- Añadir 5ª categoría **"Hoteles pet friendly"** al mosaico (además de Playas caninas, Parques caninos, Rutas y ríos, Restaurantes).
- Contador opcional en esquina inferior de cada tarjeta: `📍 48 lugares`.

### HU-1.8.2 — Copys de la sección Explora · `P3`

_Como Cliente, quiero textos aspiracionales que expliquen bien la sección, para entender su valor._

**Criterios de aceptación (aprobados):**

- Título: se mantiene **"Explora con tu mascota"**.
- Subtítulo: **"Descubre playas caninas, parques caninos, rutas, restaurantes y otros lugares pet friendly recomendados por la comunidad Doogking."**
- Texto inferior: **"Todos los lugares son compartidos por la comunidad y revisados por el equipo Doogking antes de su publicación."**
- Textos de tarjeta más emocionales (ej.: Playas caninas → "🌊 Disfrutad juntos del mar durante todo el año"; Parques caninos → "🐶 Espacios seguros para correr, jugar y socializar"; Rutas y ríos → "🌿 Naturaleza para descubrir juntos"; Restaurantes → "🍽️ Sitios donde tu mascota también es bienvenida").

### HU-1.8.3 — Botones y filtros de la sección Explora · `P3`

_Como Cliente, quiero botones y filtros claros para explorar lugares, para encontrar planes cercanos o planificar un viaje._

**Criterios de aceptación:**

- Botón "📍 Ver lo más cercano" → **"➡️ Ver lugares cercanos"**.
- Botón "✈️ Planificar un viaje" → **"➡️ Planificar mi viaje"**.
- Filtros como chips (HU-0.5); el chip "Todos" destacado con color/icono.
- El botón **"Planificar un viaje con IA"** se integra visualmente en la sección (como tarjeta especial del mosaico o CTA destacado bajo el título), no aislado.

## 1.9 Sección "Cómo funciona" + captación de empresas

> 📍 **Ubicación:** Home · **Ruta:** `/` · **Sección/componente:** Secciones «Reservar es así de fácil» y banner «¿Tienes un negocio canino?» (PARA PROFESIONALES).

### HU-1.9.1 — Pasos "Reservar es así de fácil" conectados · `P2`

_Como Cliente, quiero ver el proceso de reserva como pasos conectados, para entender que es sencillo._

**Criterios de aceptación:**

- Los 3 pasos se muestran conectados visualmente: `① ───── ② ───── ③` con línea fina.
- Números más grandes con círculo amarillo llamativo (se ven antes que el texto); iconos +20 %.
- Hover: la tarjeta sube, aumenta sombra, el número hace zoom.
- Fondo gris muy claro; tarjetas blancas.

### HU-1.9.2 — Bloque de captación de empresas espectacular · `P1`

_Como Profesional, quiero un bloque potente que me invite a registrar mi negocio, para dar el paso de unirme._

**Criterios de aceptación:**

- Bloque con mucho aire y CTA claro (ej.: "¿Tienes un negocio para mascotas? Empieza a recibir reservas online. [Registrar mi negocio]").
- Fotografía de un profesional trabajando (veterinario/peluquero/residencia/adiestrador).
- Botón amarillo más grande (alto, ancho, con sombra).
- Fondo azul con degradado más elegante (tipo Booking).
- Tres beneficios con icono: **✔ Sin cuota de alta · ✔ Reservas 24/7 · ✔ Cobros seguros**.
- Cierre aspiracional: **"Únete a la plataforma que está transformando la forma de reservar servicios para mascotas"** + CTA "🟡 Registrar mi negocio".

## 1.10 Footer

> 📍 **Ubicación:** Home y todas las páginas · **Ruta:** `global` · **Sección/componente:** Pie de página (columnas Servicios / Descubre / Empresas / Legal).

### HU-1.10.1 — Footer con imagen de marca consolidada · `P2`

_Como Cliente/Profesional, quiero un footer que transmita empresa sólida, para confiar en la plataforma._

**Criterios de aceptación:**

- Logo +40 %; frase de marca debajo: "La plataforma líder para reservar servicios para mascotas."
- Más margen superior, más separación entre columnas y entre enlaces.
- Títulos de columna (Servicios, Descubre, Empresas, Legal) algo más grandes, blanco puro, más separados de sus enlaces.
- Enlaces con hover: cambian a amarillo + subrayado + transición suave.
- **Redes sociales** visibles: Instagram, Facebook, TikTok, LinkedIn, YouTube.
- Espacios preparados para **App Store** y **Google Play** (aunque aún no exista la app).
- Logotipos de **métodos de pago**: Visa, Mastercard, Stripe, Apple Pay, Google Pay.
- Certificados con más protagonismo e iconos uniformes: `🟢 Empresas verificadas`, `🔒 Pago seguro con Stripe`, `🛡 Protección de reservas`.
- Línea inferior de copyright: `© 2026 Doogking · Todos los derechos reservados` + `Política de privacidad · Cookies · Aviso legal`.
- Fondo azul con degradado sutil.
- Franja preparada para datos/prueba social (Empresas verificadas, Reservas seguras, Miles de clientes, Disponible en toda España) — diseño listo aunque las cifras se activen cuando sean reales.
- Cierre emocional de marca: **"Todo lo que tu mascota necesita. En un solo lugar."** + "Gracias por confiar en Doogking." antes del copyright.

---

# Bloque 2 — Buscador (resumen consolidado)

> 📍 **Ubicación:** Buscador del hero en la Home (`/`) y **barra de búsqueda fija (sticky)** en todas las páginas de listado (`/alojamiento`, `/hoteles`, `/veterinarios`, `/peluqueria`, `/transporte`, `/adiestramiento`).

> El buscador aparece en el hero (Bloque 1) y también fijo en los listados. Estas historias consolidan su comportamiento transversal.

### HU-2.1 — Buscador sticky en listados · `P1`

_Como Cliente, quiero que el buscador quede fijo arriba al hacer scroll en los resultados, para modificar la búsqueda en cualquier momento sin volver arriba._

**Criterios de aceptación:**

- En todas las páginas de resultados el buscador permanece fijo (sticky) al hacer scroll.
- Aspecto de bloque flotante: más altura (8–10 px), más sombra, esquinas algo más redondeadas.

### HU-2.2 — Contador de resultados en tiempo real · `P2`

_Como Cliente, quiero ver cuántos resultados hay al cambiar los criterios, para tener seguridad de que hay disponibilidad._

**Criterios de aceptación:**

- Al modificar fecha/ciudad/mascota, se muestra de inmediato el nº de resultados (ej.: "247 alojamientos disponibles").

---

# Bloque 3 — Listados de resultados (unificados)

> 📍 **Ubicación:** Páginas de resultados de cada categoría. · **Rutas:** `/alojamiento`, `/hoteles` (confirmadas), `/veterinarios`, `/peluqueria`, `/transporte`, `/adiestramiento`, `/seguros`, `/cuidadores` (orientativas). · **Cómo llegar:** menú superior de categorías o buscador → resultados. · **Componente:** tarjeta de resultado + filtros laterales.

> Aplica a los listados de **alojamiento, transporte, adiestramiento, hoteles, veterinarios y peluquerías**. El cliente pide expresamente **unificar** el diseño de todos los listados (misma tarjeta, misma posición de valoración/precio/etiquetas/botón). Estas historias definen la tarjeta de resultado común; usan los componentes del Bloque 0.

### HU-3.1 — Tarjeta de resultado unificada · `P1`

_Como Cliente, quiero que todas las tarjetas de resultados tengan la misma estructura, para reconocer la información de un vistazo en cualquier categoría._

**Criterios de aceptación:**

- Orden de lectura fijo: Imagen → Nombre → Valoración → Dirección → Servicios destacados → Precio → Botón.
- La **fotografía ocupa 70–75 %** de la tarjeta (la imagen vende más que el texto).
- Bordes redondeados, sombra, hover con elevación y zoom de foto (HU-0.1/0.2).
- Valoración estilo Booking (HU-0.8) siempre en el mismo sitio y bien visible.
- Precio protagonista: "Desde 35 €" en grande + unidad debajo ("por trayecto" / "/ noche" / "por sesión" según categoría).
- Botón principal ocupando prácticamente todo el ancho.
- Servicios mostrados como iconos en una línea bajo la foto (ej. transporte: `🚐 Climatizado · 🏠 Domicilio · 📷 Fotos · 🛡 Seguro · 💊 Medicación`).
- Más aire entre tarjetas; fondo de sección alternando blanco / gris muy claro (#F8F9FA).

### HU-3.2 — Badges automáticos en resultados · `P2`

_Como Cliente, quiero etiquetas destacadas basadas en datos reales, para identificar las mejores opciones._

**Criterios de aceptación:**

- Uso de HU-0.9: `🟢 Más reservado`, `🟠 Mejor valorado`, `⭐ Recomendado`, `🔥 Últimas plazas`, `🚀 Respuesta rápida` — generados automáticamente.

### HU-3.3 — Filtros como panel moderno · `P2`

_Como Cliente, quiero filtros claros y con estética moderna, para acotar resultados con comodidad._

**Criterios de aceptación:**

- Filtros laterales con iconos pequeños, más separación e interruptores modernos; al seleccionar, se iluminan en amarillo.
- Filtros superiores tipo chip con más altura (HU-0.5).

### HU-3.4 — Resumen/CTA lateral sticky en listados con detalle · `P2`

_Como Cliente, quiero el resumen o CTA de reserva siempre visible, para no perderlo al desplazarme._

**Criterios de aceptación:**

- El resumen lateral/CTA queda fijo (sticky) al hacer scroll; más sombra; botón de reserva protagonista.

### HU-3.5 — Servicios mostrados según configuración del profesional · `P1`

_Como Profesional, quiero que en mi tarjeta se muestren solo los servicios que he activado en mi ficha, para reflejar fielmente lo que ofrezco._

**Criterios de aceptación:**

- Los iconos/servicios de cada tarjeta se generan dinámicamente desde la ficha del profesional (no textos fijos).
- Aplica especialmente a transporte, adiestramiento y hoteles (badges/servicios configurables).

### HU-3.6 — Carrusel de fotos en la tarjeta (futuro) · `P3`

_Como Cliente, quiero ver varias fotos sin entrar en la ficha, para decidir más rápido._

**Criterios de aceptación:**

- Cada tarjeta permite un pequeño carrusel de imágenes.

---

# Bloque 4 — Fichas de detalle

> 📍 **Ubicación general:** Ficha de detalle de un profesional/servicio (se abre desde su tarjeta en el listado). Cada subsección indica la ruta por categoría.

## 4.1 Ficha de alojamiento canino (la pantalla más importante)

> 📍 **Ubicación:** Listado de alojamiento → «Ver disponibilidad» · **Ruta:** `/alojamiento/:id (orientativa)` · **Sección/componente:** Ficha del alojamiento: galería, cabecera, precio, servicios, reseñas.

> El cliente la considera **la pantalla nº 1 de Doogking** (potencial 11/10). Es donde el usuario decide reservar.

### HU-4.1.1 — Galería de fotos tipo Booking · `P1`

_Como Cliente, quiero una galería potente del alojamiento, para confiar en dónde dejo a mi perro._

**Criterios de aceptación:**

- Foto principal grande + 4 miniaturas a la derecha; al pulsar, galería a pantalla completa.
- Contador "📷 32 fotografías" sobre la galería.

### HU-4.1.2 — Cabecera con nombre + datos clave en una línea · `P2`

_Como Cliente, quiero ver nombre, valoración, ubicación y verificación juntos, para evaluar rápido._

**Criterios de aceptación:**

- Bajo el nombre, en una línea: `⭐ 4,8 · 👥 96 reseñas · 📍 Las Rozas (Madrid) · 🟢 Profesional verificado`.
- Valoración en formato Booking (recuadro + "Muy bueno" + nº reseñas).

### HU-4.1.3 — Etiquetas ampliadas · `P3`

_Como Cliente, quiero etiquetas útiles del alojamiento, para conocer sus ventajas._

**Criterios de aceptación:**

- Ejemplos: `🐶 Todos los tamaños`, `🌳 Patio de 500 m²`, `🩺 Veterinario colaborador`, `📷 Fotos diarias`, `🚿 Baño opcional` (además de las actuales).

### HU-4.1.4 — Tarjeta de precio fija (sticky) · `P1`

_Como Cliente, quiero que la tarjeta de precio me acompañe al bajar por la ficha, para reservar en cualquier momento._

**Criterios de aceptación:**

- La tarjeta de precio permanece fija mientras se recorre la ficha.
- Botón: "Ver disponibilidad" (y "Reservar ahora" una vez elegido el espacio) en lugar de "Selecciona un espacio".

### HU-4.1.5 — Ficha rápida del alojamiento · `P2`

_Como Cliente, quiero un resumen visual del alojamiento, para entenderlo en 5 segundos._

**Criterios de aceptación:**

- Bloque con iconos: `🏡 Tipo`, `🌳 Exterior (m²)`, `🐶 Capacidad`, `👨‍⚕️ Supervisión`, `🩺 Veterinario`.
- Servicios con iconos (patio, piscina, paseos, juegos, fotos, alimentación personalizada).
- Políticas en acordeón: Entrada, Salida, Cancelación, Vacunas.
- Tipos de espacio: cada uno con foto, precio, capacidad, tamaño y servicios incluidos.

### HU-4.1.6 — Reseñas por aspectos · `P2`

_Como Cliente, quiero valoraciones desglosadas por criterios, para juzgar lo que me importa._

**Criterios de aceptación:**

- Puntuación por aspectos: Limpieza, Trato, Instalaciones, Comunicación (con estrellas).
- Soporte para fotos reales de clientes.

### HU-4.1.7 — [Diferencial] Compatibilidad con tu perro · `P1`

_Como Cliente, quiero saber si el alojamiento es adecuado para mi perro concreto, para elegir con seguridad._

**Criterios de aceptación:**

- Bloque "Compatibilidad con [nombre del perro]" que usa el perfil de la mascota: p. ej. "✔ Ideal para perros sociables", "✔ Patio perfecto para perros activos", "✔ Tamaño recomendado", "✔ Buena elección según su temperamento".
- (Ampliación) "Índice Doogking" con barras: Sociabilidad, Espacio exterior, Limpieza, Tranquilidad.

### HU-4.1.8 — [Diferencial] "La experiencia de tu perro" (día típico) · `P3`

_Como Cliente, quiero ver cómo será el día de mi perro en la residencia, para conectar emocionalmente y confiar._

**Criterios de aceptación:**

- Timeline visual del día: 08:00 salida al patio, 09:00 desayuno, 11:00 juegos en grupo, 14:00 descanso, 17:00 paseo, 21:00 descanso (configurable por el negocio).

### HU-4.1.9 — Bloque "Compromiso Doogking" · `P2`

_Como Cliente, quiero garantías claras al inicio de la ficha, para sentir que puedo confiar en dejar aquí a mi perro._

**Criterios de aceptación:**

- Justo bajo el nombre: `🛡️ Compromiso Doogking` con checks: Empresa verificada, Reseñas de clientes reales, Reserva segura, Soporte antes/durante/después.

## 4.2 Ficha de transportista

> 📍 **Ubicación:** Listado de transporte → tarjeta del transportista · **Ruta:** `/transporte/:id (orientativa)` · **Sección/componente:** Ficha del transportista: servicios ofrecidos y galería del vehículo.

### HU-4.2.1 — Bloque "¿Qué ofrece este transportista?" · `P1`

_Como Cliente, quiero ver todos los servicios que ofrece el transportista, para saber qué incluye antes de reservar._

**Criterios de aceptación:**

- Bloque que muestra automáticamente los servicios que el transportista ha configurado (vehículo climatizado, seguimiento del viaje, recogida a domicilio, transporte individual/compartido, administración de medicación, seguro incluido, fotos durante el trayecto).
- Sección "¿Por qué elegir este transportista?" con checks y dato de experiencia (ej. "Más de 600 trayectos realizados").

### HU-4.2.2 — Galería del vehículo · `P2`

_Como Cliente, quiero ver fotos del vehículo/jaulas/conductor, para reservar con confianza._

**Criterios de aceptación:**

- Galería (no una sola foto): interior del vehículo, jaulas homologadas, conductor, zona de descanso.
- Fotografías siempre de transporte de mascotas (no mudanzas/camiones/mercancías).

## 4.3 Ficha de adiestrador

> 📍 **Ubicación:** Listado de adiestramiento → tarjeta del adiestrador · **Ruta:** `/adiestramiento/:id (orientativa)` · **Sección/componente:** Ficha del adiestrador: especialidades, experiencia, galería.

### HU-4.3.1 — Especialidades como chips · `P2`

_Como Cliente, quiero ver las especialidades del adiestrador de un vistazo, para elegir al adecuado._

**Criterios de aceptación:**

- Sección "Especialidades" con chips: `🐶 Cachorros`, `🐕 Obediencia`, `🚶 Paseo sin tirar`, `🐾 Socialización`, `😬 Miedos`, `⚠ Reactividad`, `🛋 Ansiedad por separación`, `🎯 Modificación de conducta`.
- Datos de experiencia: `🎓 12 años de experiencia`, `🐶 Más de 1.500 perros educados`, `⭐ 98 % clientes satisfechos` (configurados/calculados).

### HU-4.3.2 — Galería con vídeos · `P3`

_Como Cliente, quiero ver vídeos del adiestrador trabajando, para valorar su método._

**Criterios de aceptación:**

- La galería admite vídeos cortos (~20 s) además de fotos.

### HU-4.3.3 — [Diferencial] "¿Qué problema quieres resolver?" · `P2`

_Como Cliente, quiero indicar el problema de mi perro y ver primero los especialistas en él, para encontrar antes al profesional adecuado._

**Criterios de aceptación:**

- Selector previo con opciones: tira de la correa, tiene miedo, no obedece, rompe cosas, cachorro, agresividad, ansiedad en el coche…
- El sistema ordena/prioriza los adiestradores especializados en ese problema.

## 4.4 Ficha de hotel pet-friendly

> 📍 **Ubicación:** Listado de hoteles → tarjeta del hotel · **Ruta:** `/hoteles/:id (orientativa)` · **Sección/componente:** Ficha del hotel pet-friendly: badges, ventajas y datos del hotel.

### HU-4.4.1 — Ficha de hotel con datos configurables · `P2`

_Como Cliente, quiero ver los datos clave del hotel pet-friendly, para saber si encaja con mi viaje y mi mascota._

**Criterios de aceptación:**

- Badges configurables por el hotel: `🐶 Sin suplemento por mascota`, `🦴 Kit de bienvenida`, `🚿 Zona de lavado`, `🏊 Piscina`, `🌳 Jardín`, `🚶 Cerca de parques`.
- Línea de ventajas: `✓ Cancelación gratuita`, `✓ Confirmación inmediata`, `✓ Pago seguro`, `✓ Admite perros grandes`.
- Datos visibles en tarjeta/ficha (desde la ficha del hotel): hora de entrada/salida, tamaño máximo admitido, nº máximo de mascotas, servicios incluidos.
- Precio "Desde 320 € / noche" en azul corporativo; valoración estilo Booking; botón "Ver disponibilidad" (en vez de "Reservar hotel").

---

# Bloque 5 — Flujos de reserva

> 📍 **Ubicación general:** Proceso de reserva (checkout) con pasos «Tu cita/estancia/viaje → Tus datos → Pago → Confirmación». Se llega desde la ficha o el listado pulsando _Reservar / Ver disponibilidad_. Cada subsección indica su categoría.

## 5.1 Reglas transversales de reserva (aplican a todas las categorías)

> 📍 **Ubicación:** Cualquier ficha/listado → «Reservar / Ver disponibilidad» · **Ruta:** `/reserva/... (orientativa)` · **Sección/componente:** Pantalla de reserva (checkout): barra de pasos, tarjeta del establecimiento, ficha de la mascota, resumen de precio.

### HU-5.1.1 — Tarjeta del establecimiento siempre visible y premium · `P1`

_Como Cliente, quiero ver siempre qué estoy reservando durante todo el proceso, para no perder de vista el servicio elegido (como Booking)._

**Criterios de aceptación:**

- En la parte superior del proceso, tarjeta premium con: foto grande, logo/foto del profesional, `⭐ valoración (nº reseñas)`, `📍 ciudad`, `✅ profesional verificado`, y según categoría fecha/hora/tipo/precio.
- Se mantiene visible durante todos los pasos.

### HU-5.1.2 — Barra de progreso mejorada · `P2`

_Como Cliente, quiero ver claramente en qué paso estoy, para saber cuánto me falta._

**Criterios de aceptación:**

- Pasos completados en verde con ✔; paso actual 🔵 más grande; siguientes en gris.
- Etiquetas con texto (no solo números) donde aplique.

### HU-5.1.3 — Ficha visual de la mascota en la reserva · `P1`

_Como Cliente, quiero ver la ficha de mi mascota en la reserva, para sentir que la plataforma la conoce y no volver a introducir datos._

**Criterios de aceptación:**

- En lugar de solo el nombre ("Maya"), tarjeta con foto + `Raza · Edad · Peso` (ej. "🐶 Maya · Golden Retriever · 3 años · 28 kg").
- Los datos se **autocompletan desde la Ficha Inteligente** (peso, tamaño, raza, edad): no se vuelven a preguntar.

### HU-5.1.4 — Resumen de precio grande y sticky + botón Continuar protagonista · `P1`

_Como Cliente, quiero ver el total claramente y un botón de avance inequívoco, para completar la reserva con confianza._

**Criterios de aceptación:**

- Total ~30 % más grande, separado por línea superior; bloque sticky (HU-0.6).
- Botón "Continuar" enorme, amarillo, con hover y sombra, ocupando el ancho.
- Campo de cupón + botón "Aplicar" integrados como un único bloque visual.

### HU-5.1.5 — Bloque de confianza antes de pagar · `P2`

_Como Cliente, quiero mensajes de tranquilidad antes de avanzar, para reducir el miedo a pagar._

**Criterios de aceptación:**

- Componente HU-0.7 + frases como "🔒 No se realizará ningún cargo hasta confirmar el siguiente paso" o "✅ Tu cita quedará confirmada en unos segundos".
- Variante "🛡️ Protección Doogking: tu dinero está protegido hasta que el servicio se complete según la política de cancelación".

### HU-5.1.6 — Iluminación suave de campos al seleccionar · `P3`

_Como Cliente, quiero feedback visual al elegir fecha/hora/servicio, para percibir calidad._

**Criterios de aceptación:**

- Al seleccionar un campo (fecha, hora, servicio) se ilumina suavemente; microanimación al actualizar el precio.

## 5.2 Reserva de veterinario

> 📍 **Ubicación:** Veterinario → Reservar · **Ruta:** `/reserva/veterinario (orientativa)` · **Sección/componente:** Formulario de reserva de veterinario.

### HU-5.2.1 — Tarjeta de la clínica más visual · `P1`

_Como Cliente, quiero ver la clínica como una tarjeta con foto y valoración, para confiar en dónde reservo._

**Criterios de aceptación:**

- Foto grande de la clínica, logo/foto del veterinario, `⭐ 4,9 (325 reseñas)`, `📍 ciudad`, `✅ profesional verificado`.

### HU-5.2.2 — Fecha y hora visuales + ficha médica de la mascota · `P2`

_Como Cliente, quiero fecha/hora presentadas de forma clara y datos médicos útiles, para una reserva más real y personal._

**Criterios de aceptación:**

- Fecha/hora tipo "📅 Martes, 28 de julio · 🕒 10:30".
- Ficha de la mascota con datos útiles para el veterinario: próxima vacuna, peso, alergias (desde la Ficha Inteligente).

## 5.3 Reserva de peluquería

> 📍 **Ubicación:** Peluquería → Reservar · **Ruta:** `/reserva/peluqueria (orientativa)` · **Sección/componente:** Formulario de reserva de peluquería.

### HU-5.3.1 — Tarjeta del comercio premium + datos de confianza · `P1`

_Como Cliente, quiero ver la peluquería con foto, valoración y reseñas, para reservar con confianza._

**Criterios de aceptación:**

- Tarjeta con foto de portada, `⭐ valoración`, `📍 ciudad`, nº reseñas, `🟢 verificado`, `❤️ guardar favorito`.
- Debajo: `⭐ 4,9 · 👥 850 reseñas · 📍 ciudad · 🕒 Responde en < 1 hora`.

### HU-5.3.2 — Información del servicio (duración y profesional) · `P2`

_Como Cliente, quiero conocer la duración y quién atenderá a mi mascota, para organizarme mejor._

**Criterios de aceptación:**

- Bajo el servicio (ej. "Baño completo — 30 €"): "⏱ Duración aproximada: 60 min".
- Si el negocio lo permite, elegir profesional (ej. "👩 Laura · Especialista en perros pequeños") o "Asignación automática por el centro".

### HU-5.3.3 — Avisos del comercio como cajas informativas · `P2`

_Como Cliente, quiero distinguir las condiciones del servicio de los campos del formulario, para entender bien las normas del centro._

**Criterios de aceptación:**

- Los avisos se muestran como cajas informativas: `🟢 Información del centro` (ej. acepta perros nerviosos) y `🟡 Importante` (ej. condiciones para perros agresivos).

### HU-5.3.4 — Sección "Antes de la cita" · `P3`

_Como Cliente, quiero recomendaciones previas a la cita, para preparar mejor a mi mascota._

**Criterios de aceptación:**

- Bloque con iconos: "🐕 Pasea a tu perro antes de venir", "🍖 Evita darle de comer justo antes si se pone nervioso", "🪮 Si tiene nudos importantes, el precio podría variar tras la valoración".

## 5.4 Reserva de alojamiento

> 📍 **Ubicación:** Alojamiento → Reservar · **Ruta:** `/reserva/alojamiento (orientativa)` · **Sección/componente:** Formulario de reserva de alojamiento (extras, nº de perros, precio).

### HU-5.4.1 — Servicios adicionales como tarjetas seleccionables · `P2`

_Como Cliente, quiero elegir extras de forma visual, para personalizar la estancia._

**Criterios de aceptación:**

- Cada extra es una tarjeta seleccionable con icono/foto, precio y descripción: "🚶 Paseo extra 10 €", "🛁 Baño y cepillado 25 €", "🚐 Recogida a domicilio 15 €", "📷 Cámara 24/7 5 €".
- Botones `+`/`-` (nº de perros) más grandes.

### HU-5.4.2 — Datos ya conocidos autocompletados con explicación · `P2`

_Como Cliente, quiero que no se me pregunten datos que ya tiene la plataforma, para reservar más rápido._

**Criterios de aceptación:**

- Tamaño del perro precargado desde el perfil (ej. "Mediano (10–25 kg) · ✔ Obtenido del perfil de Maya").
- Campo de compatibilidad social con ayuda contextual: "💡 Esta información ayuda al centro a organizar grupos seguros".

### HU-5.4.3 — "¿Qué incluye este precio?" · `P2`

_Como Cliente, quiero saber qué cubre el importe, para entender lo que pago._

**Criterios de aceptación:**

- Lista con checks: paseos diarios, alimentación, supervisión, limpieza, atención 24 h.

### HU-5.4.4 — Recomendaciones para la estancia y "¿Qué ocurrirá después de reservar?" · `P3`

_Como Cliente, quiero recomendaciones y saber los siguientes pasos, para reducir la incertidumbre._

**Criterios de aceptación:**

- Bloque "Recomendaciones para esta estancia": cartilla al día, traer su comida habitual, juguete favorito, indicar medicación.
- Bloque "¿Qué ocurrirá después de reservar?": 📧 Confirmación inmediata → 📱 El alojamiento recibe tu reserva → ✅ Confirmación definitiva → 🐶 Empieza la estancia.

## 5.5 Reserva de transporte

> 📍 **Ubicación:** Transporte → Reservar · **Ruta:** `/reserva/transporte (orientativa)` · **Sección/componente:** Formulario de reserva de transporte (origen/destino, extras).

### HU-5.5.1 — Origen/destino con cálculo automático de distancia · `P1`

_Como Cliente, quiero indicar solo recogida y destino y que se calcule la distancia, para no introducir kilómetros manualmente._

**Criterios de aceptación:**

- El usuario indica `📍 Dirección de recogida` y `📍 Dirección de destino`; Doogking calcula automáticamente la distancia (elimina el campo de km manual).

### HU-5.5.2 — Servicios adicionales según el transportista · `P2`

_Como Cliente, quiero ver solo los extras que ofrece ese transportista, para elegir con precisión._

**Criterios de aceptación:**

- Los extras se cargan automáticamente desde el panel del transportista (recogida a domicilio, fotos del trayecto, medicación, jaula homologada, paseo en trayectos largos, alimentación, agua, seguro ampliado).

### HU-5.5.3 — Desglose de precio transparente + datos de la mascota · `P2`

_Como Cliente, quiero un desglose claro del precio y no repetir datos de mi mascota, para reservar con transparencia._

**Criterios de aceptación:**

- Desglose: Servicio base, Kilómetros, Servicios adicionales, IVA, TOTAL.
- Datos del perro (nombre, peso, tamaño, edad) precargados desde la Ficha Inteligente.
- Resumen lateral con checks: sin cargos ocultos, pago seguro con Stripe, confirmación inmediata, atención durante todo el proceso.

## 5.6 Reserva de adiestramiento

> 📍 **Ubicación:** Adiestramiento → Reservar · **Ruta:** `/reserva/adiestramiento (orientativa)` · **Sección/componente:** Formulario de reserva de adiestramiento (modalidad, objetivo, intensidad).

### HU-5.6.1 — Cabecera del profesional + "¿Qué incluye esta sesión?" · `P2`

_Como Cliente, quiero conocer al adiestrador y qué incluye la sesión antes de rellenar datos, para saber qué compro._

**Criterios de aceptación:**

- Cabecera con `⭐ valoración (nº reseñas) · 📍 ciudad · 🎓 años de experiencia · especialidad`.
- Caja "¿Qué incluye esta sesión?": valoración inicial, plan de trabajo personalizado, recomendaciones para casa, resolución de dudas.
- Bloque final "¿Qué conseguirás con esta sesión?": evaluar comportamiento, identificar causa, plan personalizado, ejercicios para casa.

### HU-5.6.2 — Modalidad configurable y campos inteligentes · `P2`

_Como Cliente, quiero opciones de sesión reales y no repetir datos, para reservar rápido y adecuado._

**Criterios de aceptación:**

- Modalidad según lo que configure el adiestrador: sesión individual, bono 5, bono 10, clase grupal, valoración inicial.
- Edad/tamaño/peso de la mascota autocompletados desde la Ficha Inteligente.
- "Motivo principal" → **"¿Qué quieres trabajar?"** con opciones (obediencia básica, cachorro, ansiedad, miedos, reactividad, ladridos, paseo sin tirar, llamada, socialización).
- "Intensidad del problema" con botones: 🟢 Leve / 🟡 Moderado / 🔴 Grave.
- Cuadro de texto "Cuéntanos un poco más" para describir el comportamiento.
- Bloque "Tu adiestrador" (foto, experiencia, titulación, especialidades, idiomas, nº perros educados).
- Mensaje: "Cuanta más información nos proporciones, mejor podrá preparar el adiestrador la primera sesión."

## 5.7 Reserva de hotel pet-friendly (personas + mascotas)

> 📍 **Ubicación:** Hotel → Reservar · **Ruta:** `/reserva/hotel (orientativa)` · **Sección/componente:** Formulario de reserva de hotel: paso «Tu viaje» (personas + mascotas).

### HU-5.7.1 — Concepto "Tu viaje" (personas y mascotas) · `P1`

_Como Cliente, quiero que la reserva de hotel contemple personas y mascotas, para organizar el viaje completo y no solo "añadir una mascota"._

**Criterios de aceptación:**

- El paso 1 se llama **"Tu viaje"** (en vez de "Tu estancia"): pasos = Tu viaje → Tus datos → Pago → Confirmación.
- Paso 1 solo pide datos que afectan a disponibilidad: fecha entrada/salida, nº personas, nº mascotas, tamaño de las mascotas, observaciones (opcional).
- Paso 2 "Tus datos" solo pide datos personales: nombre, apellidos, email, teléfono, documento (si el hotel lo requiere), datos de facturación.

### HU-5.7.2 — Resumen del viaje y suplemento por mascota · `P2`

_Como Cliente, quiero ver un resumen del viaje y entender el suplemento por mascota, para reservar sin errores ni sorpresas._

**Criterios de aceptación:**

- Resumen visible durante el proceso: `👤 2 adultos · 👶 1 niño · 🐶 Maya · 📅 28–30 julio`.
- Desglose de precio: Precio habitación, Suplemento por mascota (si existe), IVA, Total (total protagonista).
- Texto del suplemento: "El suplemento por mascota, si existe, se calculará automáticamente según las condiciones configuradas por el hotel."
- Tarjeta del hotel enriquecida (valoración, reseñas, dirección, hora entrada/salida, cancelación gratuita, nº máx. mascotas), desde la ficha del hotel.

---

# Bloque 6 — Registro de empresas (onboarding profesional) + email de verificación

> 📍 **Ubicación general:** Alta de profesionales. · **Cómo llegar:** botón **«REGISTRA TU EMPRESA»** del menú superior. Cada subsección detalla el paso o el correo.

> Objetivo: que el profesional sienta que entra en una plataforma que le traerá clientes, no que rellena un formulario. La estructura es buena; se mejora comunicación, confianza y microinteracciones.

## 6.1 Onboarding de empresas

> 📍 **Ubicación:** Botón «REGISTRA TU EMPRESA» del menú superior · **Ruta:** `/registro-empresa (orientativa)` · **Sección/componente:** Asistente de alta: Servicios → Tu negocio → Acceso → Verificación de correo.

### HU-6.1.1 — Copys orientados al beneficio en cada paso · `P1`

_Como Profesional, quiero textos que expliquen qué gano, para mantener la motivación mientras me registro._

**Criterios de aceptación (aprobados):**

- Titular: "Hazte partner de Doogking" → **"Empieza a recibir reservas con Doogking"** (o "Haz crecer tu negocio con Doogking").
- "¿Qué ofreces?" → **"¿Qué servicios quieres ofrecer?"** / "Selecciona los servicios de tu negocio".
- Subtexto: "Podrás añadir más luego." → **"Puedes seleccionar uno o varios servicios. Más adelante podrás modificarlos cuando quieras."**
- Paso "Tu negocio" → **"Cuéntanos sobre tu negocio"**; "Lo básico para que tus clientes te encuentren." → **"Estos datos aparecerán en tu perfil público."**
- Campo Nombre del negocio: placeholder según el servicio elegido (ej. "Veterinario Pérez", "Centro Canino Vila-Can", "Hotel Canino Luna").
- Ciudad: "Busca tu población…" → **"¿Dónde prestas tus servicios?"**
- Paso Acceso: "Con estos datos entrarás a gestionar tu negocio." → **"Crea tu cuenta para empezar a gestionar tus reservas."**
- Teléfono: quitar "(opcional)" del título; dejar "Teléfono" y debajo en gris pequeño "Opcional".

### HU-6.1.2 — Selección de servicios con feedback claro · `P2`

_Como Profesional, quiero ver claramente qué servicios he seleccionado, para tener seguridad de mi elección._

**Criterios de aceptación:**

- Al seleccionar una tarjeta de servicio: animación, color corporativo, check grande y sombra.

### HU-6.1.3 — Barra de progreso con nombres de paso · `P2`

_Como Profesional, quiero ver los pasos con nombre y mi avance, para saber cuánto me queda._

**Criterios de aceptación:**

- Muestra `✔ Servicios · ✔ Tu negocio · ● Acceso`; línea coloreada entre pasos completados.

### HU-6.1.4 — Indicador de seguridad de contraseña · `P3`

_Como Profesional, quiero saber si mi contraseña es segura, para crear una cuenta protegida._

**Criterios de aceptación:**

- Barra de seguridad: Débil / Media / Segura / Muy segura (sustituye a "Mínimo 8 caracteres").

### HU-6.1.5 — Caja "¿Qué conseguirás al unirte?" · `P2`

_Como Profesional, quiero ver los beneficios durante el registro, para seguir convencido hasta el final._

**Criterios de aceptación:**

- Caja con checks: miles de usuarios buscando servicios, reservas online 24 h, calendario y gestión en un panel, cobro seguro, sin permanencia.

### HU-6.1.6 — Bloque de confianza antes de "Crear mi negocio" · `P2`

_Como Profesional, quiero garantías antes de crear la cuenta, para completar el registro sin dudas._

**Criterios de aceptación:**

- Mensajes: "🔒 Tus datos están protegidos", "📄 Podrás completar la información fiscal y bancaria más adelante", "⏱️ En menos de 2 minutos tendrás tu negocio creado".

### HU-6.1.7 — Pantalla de verificación de correo con emoción · `P2`

_Como Profesional, quiero una pantalla de verificación clara e ilusionante, para completar la activación._

**Criterios de aceptación:**

- "Verifica tu correo" → **"¡Ya casi está! Solo queda verificar tu correo para empezar a recibir reservas."**
- Mostrar el correo destino ("Hemos enviado un correo a: correo@…") + instrucción de hacer clic en el enlace.
- Ilustración (no solo un icono de sobre).

### HU-6.1.8 — Enlace inferior a cuenta de cliente · `P3`

_Como visitante, quiero poder cambiar a crear cuenta de cliente, para registrarme en el rol correcto._

**Criterios de aceptación:**

- "¿Eres dueño de un perro? Crea tu cuenta de cliente." → **"¿Buscas servicios para tu mascota? Crear cuenta de cliente"**.

### HU-6.1.9 — Pulido visual del onboarding · `P3`

_Como Profesional, quiero un registro que parezca de una gran plataforma SaaS, para confiar desde el primer minuto._

**Criterios de aceptación:**

- Más espacio en blanco, más protagonismo del logo, iconos ilustrados, transiciones entre pasos, campos con aparición suave, checks animados; botones con más altura/sombra/hover.

### HU-6.1.10 — Acceso a Home desde el onboarding (bug) · `P1`

_Como visitante, quiero poder volver a la Home desde el registro de empresa, para no quedarme atrapado en el flujo._

**Criterios de aceptación:**

- En las pantallas de registro de empresa existe un enlace/logo clicable que lleva a la Home (actualmente no hay forma de volver). _(Reportado explícitamente por el cliente.)_

## 6.2 Email de verificación (profesional)

> 📍 **Ubicación:** Correo recibido tras el registro de empresa · **Ruta:** `email transaccional (no es una URL)` · **Sección/componente:** Plantilla del email «Verifica tu email»: remitente, asunto, botón y enlace de activación.

### HU-6.2.1 — [BUG CRÍTICO] El enlace no puede apuntar a localhost · `P1`

_Como Profesional, quiero que el enlace de activación funcione en producción, para poder activar mi cuenta._

**Criterios de aceptación:**

- El enlace de verificación apunta al **dominio real** (p. ej. `https://www.doogking.com/...`), nunca a `localhost:4200`.
- No se muestra el enlace completo en el cuerpo; se usa el botón y, como alternativa, un enlace acortado/secundario ("Si el botón no funciona, copia este enlace:").

### HU-6.2.2 — Contenido y branding del email · `P2`

_Como Profesional, quiero un email de bienvenida que transmita confianza e ilusión, para completar el registro._

**Criterios de aceptación (aprobados):**

- Remitente: "Doogking" → **"Doogking | Equipo de verificación"** (o "Doogking · Bienvenido").
- Asunto → **"¡Bienvenido a Doogking! Activa tu cuenta"** (o "Ya casi está. Activa tu negocio en Doogking").
- Saludo emocional: "¡Bienvenido a Doogking! [Nombre], estás a un solo paso de empezar a recibir reservas desde nuestra plataforma."
- Texto principal cálido: "Gracias por registrarte. Solo necesitamos verificar tu correo para activar tu cuenta y que puedas acceder al panel de tu negocio."
- Botón: "Verificar mi email" → **"Activar mi cuenta"** (o "Activar mi negocio"), con más altura, sombra, bordes redondeados y hover.
- Caja "¿Qué ocurre después?": cuenta activada → acceso al panel → completar perfil del negocio.
- Pie: "Si no has solicitado esta cuenta, puedes ignorar este correo con total tranquilidad." + "Equipo Doogking · www.doogking.com".
- Frase de ilusión: "Cada día miles de personas buscan servicios como el tuyo. Ya falta muy poco para que puedan encontrarte."
- Branding con logo y jerarquía clara (bienvenida → botón grande → beneficios).

---

# Bloque 7 — Área de cliente — Centro de Control

> 📍 **Ubicación:** Perfil del cliente. · **Ruta:** `/mi-cuenta` (o `/perfil`) _(orientativa)_. · **Cómo llegar:** menú superior **«Mi cuenta» → Mi perfil**. · **Sección:** pantalla principal del perfil (cabecera + tarjetas + mascotas + configuración).

> El cliente pide que el "Perfil" deje de parecer un panel administrativo y se convierta en el **Centro de Control** del usuario (referencia de engagement: Apple Fitness / Duolingo, no solo Booking).

### HU-7.1 — Cabecera personalizada · `P2`

_Como Cliente, quiero un saludo personal al entrar en mi cuenta, para sentir que es mi espacio._

**Criterios de aceptación:**

- Cabecera "👋 Hola, [Nombre] · Bienvenido de nuevo a Doogking".
- Sello "✔ Cliente verificado" con fondo verde suave; "Miembro desde 2026".
- Botón "Editar perfil" visible (azul con icono de lápiz).

### HU-7.2 — Tarjetas estadísticas mejoradas · `P3`

_Como Cliente, quiero ver mis estadísticas de forma atractiva, para percibir mi actividad._

**Criterios de aceptación:**

- Tarjetas más grandes, iconos bonitos, animación al cambiar los valores.
- Textos: "Reservas totales" → **"Reservas realizadas"**; "Servicios disfrutados" → **"Servicios utilizados"**; "Favoritos" → **"Servicios favoritos"**.

### HU-7.3 — Bloque "Próxima reserva" destacado · `P1`

_Como Cliente, quiero ver mi próxima reserva al entrar, para acceder rápido a lo que más me interesa._

**Criterios de aceptación:**

- Bloque destacado: nombre del establecimiento + "Dentro de X días" + botón "Ver reserva".
- Se coloca en la parte alta del perfil.

### HU-7.4 — Reordenación del perfil · `P2`

_Como Cliente, quiero encontrar primero lo que más uso, para gestionarme sin buscar._

**Criterios de aceptación:**

- Orden: Mi perfil → Próxima reserva → Mascotas → Puntos (Alpha) → Estadísticas → Configuración.

### HU-7.5 — Bloque "Mis mascotas" protagonista · `P1`

_Como Cliente, quiero que mis mascotas sean el centro de mi cuenta, para acceder a su Ficha Inteligente fácilmente._

**Criterios de aceptación:**

- Cada mascota como tarjeta: foto, nombre, edad, peso, raza + botón "Ver ficha completa".
- "Añadir mascota" → **"Registrar nueva mascota"**.

### HU-7.6 — Accesos rápidos · `P3`

_Como Cliente, quiero atajos a acciones frecuentes, para moverme rápido por la plataforma._

**Criterios de aceptación:**

- Bajo el perfil: Reservar un servicio, Explorar lugares pet friendly, Mi historial, Invitar a un amigo.

### HU-7.7 — "Mi actividad" y "Logros" · `P3`

_Como Cliente, quiero ver mi actividad y logros, para sentir progreso y pertenencia._

**Criterios de aceptación:**

- "Mi actividad": última reserva, última valoración, último sitio guardado, última mascota añadida.
- "Logros": 🏆 Primer servicio reservado, 🏆 Primera valoración, 🏆 10 reservas realizadas, 🏆 Cliente fiel.

### HU-7.8 — Mensajes personalizados (engagement) · `P3`

_Como Cliente, quiero mensajes útiles y personales al entrar, para volver aunque no vaya a reservar._

**Criterios de aceptación:**

- Mensajes dinámicos: "Tu mascota Maya tiene el calendario sanitario actualizado", "Has ahorrado 45 € con Doogking", "Te faltan 120 puntos para subir de nivel", "Hay nuevos hoteles pet friendly cerca de ti".

### HU-7.9 — Renombrado de "Configuración" · `P3`

_Como Cliente, quiero nombres de configuración más naturales, para entender cada opción._

**Criterios de aceptación:**

- "Mis mascotas" → "Ficha inteligente de mis mascotas"; "Favoritos" → "Mis favoritos"; "Datos personales" → "Información personal"; "Seguridad" → "Seguridad y acceso"; "Métodos de pago" → "Métodos de pago guardados".

### HU-7.10 — Pulido visual del área de cliente · `P3`

_Como Cliente, quiero un área con más vida visual, para percibir calidad._

**Criterios de aceptación:**

- Más sombras, separación y aire; tarjetas con hover; pequeñas animaciones (referencia Airbnb).

---

# Bloque 8 — Ficha Inteligente de la mascota (pasaporte digital)

> 📍 **Ubicación general:** Mascotas del cliente. · **Cómo llegar:** **«Mi cuenta» → Mis mascotas**. Subsección 8.1 = vista de la ficha; 8.2 = alta/edición.

> El cliente la define como **la pantalla con mayor potencial estratégico** de todo Doogking y su mayor diferenciador ("el DNI/pasaporte digital de la mascota"). Se complementa una sola vez y viaja automáticamente con cada reserva.

## 8.1 Tarjeta / vista de la Ficha Inteligente

> 📍 **Ubicación:** «Mi cuenta» → Mis mascotas · **Ruta:** `/mis-mascotas (orientativa)` · **Sección/componente:** Tarjeta/vista de la mascota (pasaporte): datos, salud, historial.

### HU-8.1.1 — Tarjeta tipo "pasaporte" · `P1`

_Como Cliente, quiero que la ficha de mi mascota parezca un pasaporte, para sentir que la plataforma la conoce de verdad._

**Criterios de aceptación:**

- Foto grande + `Nombre · Raza · Peso · Edad · Sexo · 📍 Ciudad`.
- Etiquetas de estado: 🟢 Sociable, 🟢 Vacunada, 🟢 Esterilizada, 🟡 Nerviosa, 🟢 Microchip.

### HU-8.1.2 — Estado de completitud de la ficha · `P2`

_Como Cliente, quiero saber cuánto he completado la ficha, para animarme a terminarla._

**Criterios de aceptación:**

- "Ficha inteligente: 85 % completada" con barra + "Completa los datos restantes para obtener recomendaciones más precisas".

### HU-8.1.3 — Acciones de la ficha · `P3`

_Como Cliente, quiero acciones claras sobre la ficha, para gestionarla con facilidad._

**Criterios de aceptación:**

- Botones: ✏️ Editar ficha · 📄 Ver ficha completa · ⚙️ Privacidad · 🗑 Eliminar.

### HU-8.1.4 — Resumen de salud, historial y estadísticas · `P2`

_Como Cliente, quiero ver salud e historial de mi mascota, para tener todo centralizado._

**Criterios de aceptación:**

- Resumen de salud: Vacunas ✔ al día, Desparasitación ✔, Seguro ✔ activo, Veterinario habitual ✔.
- Historial de últimos servicios por mascota (hotel, peluquería, veterinario, transporte).
- Estadísticas: valoración media de profesionales, nº de servicios, reservas, hoteles visitados.

### HU-8.1.5 — Explicar el valor de la ficha · `P2`

_Como Cliente, quiero entender para qué sirve la ficha, para querer completarla._

**Criterios de aceptación:**

- Texto: "Complétala una sola vez. Doogking compartirá automáticamente la información necesaria con veterinarios, peluquerías, hoteles, residencias y adiestradores para que no tengas que volver a rellenar formularios en cada reserva."

### HU-8.1.6 — Añadir mascota (multi-especie) · `P3`

_Como Cliente, quiero registrar varias mascotas de distintos tipos, para gestionarlas todas en Doogking._

**Criterios de aceptación:**

- Botón "➕ Añadir otra mascota" con subtexto "Perros, gatos y otras mascotas".

### HU-8.1.7 — [Diferencial] Índice de Bienestar Doogking · `P3`

_Como Cliente, quiero un indicador del seguimiento de mi mascota, para saber que su ficha está bien completada._

**Criterios de aceptación:**

- "🟢 Índice de Bienestar: 94/100" basado en vacunas al día, revisiones, peluquería periódica, adiestramiento, historial de reservas y documentación. No es un juicio al propietario; puede desbloquear recomendaciones y ventajas.

## 8.2 Creación / edición de la Ficha Inteligente

> 📍 **Ubicación:** «Mis mascotas» → «Registrar nueva mascota» / «Editar ficha» · **Ruta:** `/mascota/nueva (orientativa)` · **Sección/componente:** Formulario por bloques de creación/edición de la ficha.

### HU-8.2.1 — Título y propósito emocional · `P2`

_Como Cliente, quiero entender desde el inicio que estoy creando el perfil de mi mascota, para no percibirlo como un trámite._

**Criterios de aceptación:**

- Título: "Nuevo perro" → **"Crea la ficha inteligente de tu mascota"** + subtexto explicando el beneficio de completarla una sola vez.
- Botón final: "Registrar perro" → **"🐶 Crear ficha inteligente"**.

### HU-8.2.2 — Formulario por bloques con progreso · `P2`

_Como Cliente, quiero el formulario dividido en bloques con barra de progreso, para no agobiarme._

**Criterios de aceptación:**

- Barra "Paso X de 6" con %.
- Bloques independientes: 🐶 Datos básicos · 📏 Aspecto físico · ❤️ Salud · 🧠 Comportamiento · 🏨 Información para alojamientos · 📄 Documentación.
- Foto de la mascota entre lo primero a añadir.

### HU-8.2.3 — Campos visuales (chips y selectores gráficos) · `P2`

_Como Cliente, quiero rellenar rápido con opciones visuales, para completar la ficha sin escribir tanto._

**Criterios de aceptación:**

- Datos básicos con iconos (Nombre, Fecha nacimiento, Sexo, Peso, Raza, Tamaño).
- Temperamento con chips: Muy tranquilo, Activo, Nervioso, Protector, Sociable, Independiente.
- Sociabilidad con selector gráfico (con perros / con personas): 😡🔴 / 😐🟡 / 😊🟢.
- Miedos con sugerencias: petardos, tormentas, veterinario, viajar, personas, niños, otros perros.

### HU-8.2.4 — Salud y vacunas · `P2`

_Como Cliente, quiero registrar la salud de mi mascota de forma clara, para que los profesionales tengan la info necesaria._

**Criterios de aceptación:**

- Salud: veterinario habitual, seguro, microchip, enfermedades crónicas, fecha última revisión.
- Vacunas como tarjetas (Rabia, Leishmania, Tos de las perreras, Puppy), no tabla tipo Excel.

### HU-8.2.5 — Información para alojamientos · `P2`

_Como Cliente, quiero indicar hábitos de convivencia, para que hoteles y residencias cuiden mejor a mi mascota._

**Criterios de aceptación:**

- Duerme en: Jaula / Cama / Sofá.
- Necesita paseos: cada 4 h / 6 h / 8 h.
- Convive con gatos: Sí/No. Convive con niños: Sí/No.

### HU-8.2.6 — Privacidad, guardado automático y campos opcionales · `P1`

_Como Cliente, quiero control de privacidad y no perder datos, para completar la ficha con tranquilidad y a mi ritmo._

**Criterios de aceptación:**

- Caja "🔒 Privacidad": "Doogking solo compartirá la información necesaria con los profesionales que tú autorices mediante una reserva."
- Guardado automático en cada cambio (mensaje "Guardado automáticamente").
- Distinguir campos obligatorios/opcionales; mostrar "% completado" y permitir continuar más tarde.

### HU-8.2.7 — Explicación del "por qué" de cada bloque · `P3`

_Como Cliente, quiero saber por qué se me pide cada dato, para entender su utilidad y completarlo._

**Criterios de aceptación:**

- Bajo cada bloque, texto explicativo. Ej.: Vacunas → "Las residencias y hoteles podrán comprobar automáticamente si tu mascota cumple sus requisitos"; Pelo → "Ayuda a las peluquerías a preparar tiempo y material"; Comportamiento → "Permite recomendar el profesional más adecuado".

### HU-8.2.8 — Resumen final de disponibilidad de la ficha · `P3`

_Como Cliente, quiero ver para qué servicios ya está lista mi ficha, para saber qué me falta._

**Criterios de aceptación:**

- Resumen: "📋 Ficha Inteligente completada al 82 %" + "Tu mascota ya está preparada para: ✅ Hoteles ✅ Residencias ✅ Peluquerías" y "⚠ Falta completar para: Veterinarios, Seguros, Adiestramiento" + botón "Completar ahora".

---

# Bloque 9 — Mis reservas

> 📍 **Ubicación:** Listado de reservas del cliente. · **Ruta:** `/mis-reservas` _(orientativa)_. · **Cómo llegar:** menú **«Mi cuenta» → Mis reservas**. · **Sección:** cabecera + filtros por estado + tarjetas de reserva.

> Debe pasar de un listado estático a una experiencia viva, con información útil, acciones rápidas y seguimiento (referencia Booking).

### HU-9.1 — Cabecera y filtros por estado con color · `P3`

_Como Cliente, quiero identificar rápido el estado de mis reservas, para gestionarlas con agilidad._

**Criterios de aceptación:**

- Cabecera: "Tus reservas · Aquí puedes gestionar, modificar y consultar todas tus reservas en Doogking."
- Filtros con color: 🟢 Confirmadas · 🟡 Pendientes · 🔵 Completadas · 🔴 Canceladas.
- Separar "Próximas reservas" e "Historial".

### HU-9.2 — Tarjeta de reserva enriquecida · `P2`

_Como Cliente, quiero ver los datos clave de cada reserva sin entrar, para consultarla de un vistazo._

**Criterios de aceptación:**

- Muestra: ⭐ valoración, 📍 dirección, 🕒 hora entrada/salida, 👤 nº personas, 🐶 nº mascotas.
- Estado con etiqueta de color (🟥 CANCELADA / 🟢 CONFIRMADA).
- Precio: "Total pagado 387,20 €" + método/estado de pago.

### HU-9.3 — Botón contextual y acciones rápidas · `P2`

_Como Cliente, quiero acciones útiles según el estado de la reserva, para resolver todo desde aquí._

**Criterios de aceptación:**

- Botón según contexto: "Gestionar reserva" (confirmada), "Ver reserva" (completada), "Ver detalles" (cancelada).
- Acciones rápidas en reservas activas: Modificar, Contactar con el establecimiento, Cómo llegar, Cancelar, Añadir al calendario, Compartir.

### HU-9.4 — Línea temporal de la reserva · `P3`

_Como Cliente, quiero ver en qué punto está mi reserva, para saber qué ocurre después._

**Criterios de aceptación:**

- Timeline: Reserva realizada → Confirmada → Check-in → Estancia → Valoración pendiente.

### HU-9.5 — Estado vacío atractivo · `P3`

_Como Cliente, quiero una pantalla útil cuando no tengo reservas, para animarme a explorar._

**Criterios de aceptación:**

- Ilustración + "No tienes reservas todavía. Descubre miles de servicios para tu mascota." + botón "Buscar servicios".

### HU-9.6 — Repetir reserva y valoración tras completar · `P2`

_Como Cliente, quiero repetir reservas y valorar fácilmente, para fidelizarme y aportar reseñas._

**Criterios de aceptación:**

- Botón "Reservar de nuevo" en establecimientos ya reservados.
- Al completar una reserva, tarjeta "⭐ ¿Cómo fue tu experiencia? Valora al profesional" (alimenta reseñas).

### HU-9.7 — Reserva próxima con checklist y accesos · `P2`

_Como Cliente, quiero que la reserva próxima me ayude a prepararme, para vivir Doogking como un asistente._

**Criterios de aceptación:**

- Cuando la reserva está próxima: "Tu estancia comienza en 3 días 🐶" + accesos: 📍 ubicación, 📞 llamar, 💬 mensaje, 🧳 qué llevar, 🚗 cómo llegar.
- En residencias/hoteles, checklist "Antes de ir recuerda llevar": ✔ cartilla, ✔ pienso, ✔ medicación, ✔ correa.

---

# Bloque 10 — Favoritos

> 📍 **Ubicación:** Favoritos del cliente. · **Ruta:** `/favoritos` _(orientativa)_. · **Cómo llegar:** menú **«Mi cuenta» → Favoritos** o el icono ❤️. · **Sección:** listado de favoritos / estado vacío.

> Debe evolucionar de una lista a un espacio personalizado que facilite reservas repetidas y avise de oportunidades.

### HU-10.1 — Cabecera y estado vacío emocional · `P3`

_Como Cliente, quiero una sección de favoritos acogedora incluso vacía, para entender su utilidad._

**Criterios de aceptación:**

- "❤️ Tus favoritos · Guarda tus servicios favoritos para reservar en segundos cuando los necesites."
- Estado vacío con ilustración grande + mensaje emocional + botón "Explorar servicios".

### HU-10.2 — Favoritos con la misma tarjeta que los resultados · `P2`

_Como Cliente, quiero reconocer mis favoritos igual que en las búsquedas, para reservarlos rápido._

**Criterios de aceptación:**

- Mismas tarjetas que en resultados (foto, nombre, valoración, precio, ciudad, distancia, corazón lleno).
- Etiqueta temporal ("❤️ Favorito desde hace 3 meses" / "Añadido ayer").
- Acciones por tarjeta: Reservar, Ver ficha, Eliminar de favoritos, Compartir.

### HU-10.3 — Ordenación, filtros y comparación · `P3`

_Como Cliente, quiero ordenar, filtrar y comparar favoritos, para decidir mejor cuando tengo muchos._

**Criterios de aceptación:**

- Ordenar por: más recientes, mejor valorados, más cercanos, precio, última reserva.
- Filtrar por categoría (veterinarios, peluquerías, residencias, hoteles, adiestramiento, transporte, seguros, cuidadores).
- Comparar (seleccionar varios) mostrando precio, valoración, servicios, cancelación, distancia.

### HU-10.4 — Avisos inteligentes y disponibilidad · `P2`

_Como Cliente, quiero avisos de bajada de precio y disponibilidad de mis favoritos, para aprovechar oportunidades._

**Criterios de aceptación:**

- Etiqueta si baja de precio ("🔥 Ha bajado 18 € desde la última vez") o si hay oferta.
- Disponibilidad ("🟢 Disponible este fin de semana" / "Solo quedan 2 plazas").
- Marca "✔ Ya reservaste aquí" / "Reservado 3 veces".

### HU-10.5 — Recomendados e integración con fidelización · `P3`

_Como Cliente, quiero recomendaciones basadas en mis favoritos y ver mi nivel, para descubrir e implicarme más._

**Criterios de aceptación:**

- Sección "❤️ Recomendados para ti" basada en los favoritos guardados.
- Integración con Doogking Alpha (ver Bloque 13): p. ej. "Reserva uno de tus favoritos y consigue puntos".

---

# Bloque 11 — Mis reseñas / valoraciones

> 📍 **Ubicación:** Reseñas del cliente. · **Ruta:** `/mis-resenas` _(orientativa)_. · **Cómo llegar:** menú **«Mi cuenta» → Mis reseñas**. · **Sección:** listado de valoraciones / pendientes / estado vacío.

> Las reseñas son un pilar de confianza. El apartado debe animar a valorar y construir la reputación del usuario dentro de la comunidad.

### HU-11.1 — Cabecera, estado vacío y CTA · `P3`

_Como Cliente, quiero que la sección me anime a compartir experiencias, para participar en la comunidad._

**Criterios de aceptación:**

- Título "Mis valoraciones" / "Mis opiniones" + subtítulo "Comparte tu experiencia y ayuda a otros propietarios a elegir el mejor servicio para su mascota."
- Estado vacío con ilustración grande + mensaje emocional; botón "Valorar mis reservas" / "Ir a mis reservas".

### HU-11.2 — Reseñas pendientes destacadas · `P2`

_Como Cliente, quiero ver qué servicios tengo pendientes de valorar, para dejar más reseñas._

**Criterios de aceptación:**

- Arriba: "Tienes 2 servicios pendientes de valorar" + botón "Escribir reseña".

### HU-11.3 — Tarjeta de reseña completa · `P2`

_Como Cliente, quiero ver mis reseñas con contexto, para gestionarlas._

**Criterios de aceptación:**

- Tarjeta por reseña: foto del establecimiento, nombre, fecha, puntuación, comentario, respuesta del profesional (si existe).
- Permite editar/eliminar reseña y añadir fotos después.
- Filtros: Todas, Pendientes, Publicadas, Con respuesta, Eliminadas.

### HU-11.4 — Valoración por aspectos según categoría · `P2`

_Como Cliente, quiero valorar criterios específicos de cada servicio, para dar opiniones útiles._

**Criterios de aceptación:**

- Criterios por categoría. Ej. Hotel: limpieza, atención, instalaciones, comodidad, adaptación para mascotas, relación calidad-precio. Veterinario: trato, profesionalidad, tiempo de espera, instalaciones. Peluquería: resultado, trato al perro, puntualidad.
- Permite subir fotos (antes/después de peluquería, habitación de hotel, instalaciones, resultado de adiestramiento, transporte).

### HU-11.5 — Reputación y gamificación · `P3`

_Como Cliente, quiero construir mi reputación como reseñador, para sentir que mis opiniones tienen peso._

**Criterios de aceptación:**

- Bloque "Tu reputación en Doogking": media como usuario, nº de reseñas, % útiles, nivel.
- Estadística motivadora ("⭐ 12 reseñas publicadas · 👍 Has ayudado a 430 usuarios").
- Reconocimientos: 🥉 Colaborador, 🥈 Experto, 🥇 Embajador Doogking.
- Integración con Alpha: "🎖 Cada reseña publicada suma puntos para tu nivel".

---

# Bloque 12 — Menú "Mi cuenta" (desplegable)

> 📍 **Ubicación:** Menú desplegable **«Mi cuenta»** del encabezado superior (disponible en todas las páginas al iniciar sesión).

### HU-12.1 — Cabecera del desplegable con identidad · `P2`

_Como Cliente, quiero que el menú muestre quién soy y mi nivel, para que sea mi espacio personal._

**Criterios de aceptación:**

- Cabecera con: nombre, "🟢 Cliente verificado", nivel Doogking (Alpha) y puntos.

### HU-12.2 — Opciones agrupadas por bloques · `P3`

_Como Cliente, quiero el menú organizado por bloques, para encontrar cada opción rápido._

**Criterios de aceptación:**

- Bloque 1: Mi perfil, Mis mascotas, Mis reservas, Favoritos, Mis reseñas.
- Bloque 2: Mi nivel Doogking, Mis recompensas.
- Bloque 3: Configuración, Ayuda.
- Separado: Cerrar sesión (abajo, tras una línea).

### HU-12.3 — Contadores, notificaciones y protagonismo de reservas · `P2`

_Como Cliente, quiero ver estado y avisos sin entrar, para gestionar mi cuenta de un vistazo._

**Criterios de aceptación:**

- Contadores: "🐶 Mis mascotas (2)", "❤️ Favoritos (8)", "⭐ Mis reseñas (5)".
- "Mis reservas" destacada, con etiqueta si hay reserva próxima ("🟡 Tienes una reserva esta semana").
- Punto rojo de notificación en pendientes (reseña pendiente, reserva que necesita atención, respuesta del establecimiento).

### HU-12.4 — Interacción y acción rápida · `P3`

_Como Cliente, quiero un menú moderno y con atajo a buscar, para moverme con comodidad._

**Criterios de aceptación:**

- Hover: fondo azul muy suave, icono cambia de color, transición ~200 ms; iconos algo más grandes; más aire; separadores entre bloques.
- Acción rápida inferior: "🔍 Buscar servicios".

---

# Bloque 13 — Programa de fidelización · Doogking Alpha

> 📍 **Ubicación:** Bloque de nivel/puntos dentro del **perfil del cliente** (`/mi-cuenta`), **insignias en los listados** de resultados y **configuración en el panel de administración**.

> El cliente NO quiere un contador de puntos, sino un **programa de niveles con marca propia** (el "Genius" de Doogking), llamado **Doogking Alpha** (Alpha 1 · Alpha 2 · Alpha 3), inspirado en Booking Genius pero con identidad propia. Todo debe ser **configurable desde el panel de administración**.

### HU-13.1 — Programa de niveles Doogking Alpha · `P2`

_Como Cliente, quiero avanzar por niveles según mis reservas, para obtener ventajas y estatus._

**Criterios de aceptación:**

- Sistema de niveles (no de puntos): **Alpha 1** (al registrarse) · **Alpha 2** (tras un nº configurable de reservas completadas, ej. 5) · **Alpha 3** (tras un nº superior, ej. 15).
- Beneficios por nivel (ejemplos configurables): Alpha 1 → promociones y ofertas exclusivas; Alpha 2 → hasta 5 % de descuento, promociones exclusivas, prioridad en campañas; Alpha 3 → hasta 10 %, promociones premium y ventajas exclusivas.

### HU-13.2 — Tarjeta Alpha premium en el perfil · `P2`

_Como Cliente, quiero una tarjeta atractiva de mi nivel, para sentir progreso y estatus._

**Criterios de aceptación:**

- Sustituye la banda amarilla plana por una tarjeta premium (degradado azul Doogking → dorado, corona/icono Alpha, sombras suaves, barra elegante).
- Muestra nivel actual, barra de progreso y mensaje humano: "Solo te faltan 2 reservas para desbloquear Alpha Nivel 2".
- Próximas ventajas + botón "Ver ventajas Alpha →" (abre detalle de niveles, cómo subir, descuentos y establecimientos participantes).
- Al subir de nivel: mensaje de enhorabuena; al máximo nivel, estado "Has alcanzado el máximo nivel".
- Debajo, últimos progresos ("✔ Hotel reservado · ✔ Peluquería · ✔ Veterinario · +3 reservas completadas").

### HU-13.3 — Ventajas Alpha en búsquedas y carrusel · `P3`

_Como Cliente, quiero ver dónde aprovechar mi nivel, para reservar en negocios con ventajas Alpha._

**Criterios de aceptación:**

- Los establecimientos adheridos muestran insignia "🏆 Beneficios Alpha" / "🏆 Descuentos Alpha" en los listados.
- Carrusel "Ventajas disponibles para ti" con negocios y su descuento Alpha.

### HU-13.4 — Configurabilidad total del programa · `P1`

_Como Administrador, quiero configurar todo el programa sin tocar código, para ajustar niveles y ventajas._

**Criterios de aceptación:**

- Configurable: nº de niveles, nº de reservas por nivel, descuentos, beneficios, establecimientos adheridos, textos e iconos. Nada fijo en el código.

---

# Bloque 14 — Centro de ayuda

> 📍 **Ubicación general:** Centro de ayuda. · **Ruta:** `/ayuda` _(orientativa)_. · **Cómo llegar:** enlace **«Centro de ayuda»** del footer o icono 💬 del encabezado. Subsección 14.1 = cliente; 14.2 = profesional.

## 14.1 Centro de ayuda del cliente

> 📍 **Ubicación:** Footer «Centro de ayuda» / icono 💬 · pestaña «Tengo una mascota» · **Ruta:** `/ayuda (orientativa)` · **Sección/componente:** Centro de ayuda con vista de cliente.

### HU-14.1.1 — Acceso a ayuda visible · `P2`

_Como Cliente, quiero encontrar la ayuda fácilmente, para resolver dudas cuando las tengo._

**Criterios de aceptación:**

- Botón "💬 Ayuda" / "💬 Centro de ayuda" (no solo un icono pequeño); tooltip al hover; punto rojo con contador si hay incidencia abierta.

### HU-14.1.2 — Buscador y categorías · `P2`

_Como Cliente, quiero buscar mi duda y navegar por categorías, para encontrar la respuesta rápido._

**Criterios de aceptación:**

- Encabezado cálido ("¿Necesitas ayuda? Resolvemos la mayoría de dudas al instante…").
- Buscador "🔍 Buscar una pregunta…" con resultados en tiempo real.
- Categorías con icono: 🐶 Tengo una mascota · 🏪 Tengo un negocio · 📅 Reservas · 💳 Pagos · 🔒 Cuenta y seguridad.

### HU-14.1.3 — Preguntas y respuestas mejoradas · `P3`

_Como Cliente, quiero preguntas claras y respuestas visuales, para entender sin esfuerzo._

**Criterios de aceptación:**

- Preguntas reformuladas y con icono (💳 Cobros, ❌ Cancelaciones, 🐶 Mi mascota, 🔒 Privacidad, 🌍 Moneda).
- Respuestas con cajas informativas (checks/pasos), no solo texto.

### HU-14.1.4 — Zona de contacto e info de confianza · `P2`

_Como Cliente, quiero contactar con soporte y ver su fiabilidad, para sentirme acompañado._

**Criterios de aceptación:**

- Tarjeta "¿No has encontrado lo que buscabas?" con "Respondemos normalmente en menos de 24 h laborables" + [💬 Contactar con soporte] [📅 Ver mis reservas].
- Info de confianza: tiempo medio de respuesta, satisfacción, idiomas.
- (Futuro) chat flotante inferior derecho.

### HU-14.1.5 — Ayuda personalizada y sección de Ficha Inteligente · `P2`

_Como Cliente logueado, quiero ayuda contextual sobre mis reservas y mi mascota, para resolver más rápido que en una ayuda genérica._

**Criterios de aceptación:**

- Ayuda personalizada: "Hola [Nombre], ¿necesitas ayuda con alguna de estas reservas?" con acciones (modificar, cancelar, contactar con el alojamiento, hablar con soporte).
- Sección exclusiva sobre la Ficha Inteligente: para qué sirve registrar al perro, cómo subir vacunas, quién ve el historial, por qué algunos alojamientos piden esta info, cómo ocultar datos.

## 14.2 Centro de ayuda del profesional

> 📍 **Ubicación:** Centro de ayuda · pestaña «Tengo un negocio» · **Ruta:** `/ayuda (pestaña profesional) (orientativa)` · **Sección/componente:** Centro de ayuda con vista de profesional.

### HU-14.2.1 — Ayuda específica para profesionales · `P2`

_Como Profesional, quiero un centro de ayuda pensado para mi negocio, para gestionar dudas operativas._

**Criterios de aceptación:**

- Título "Centro de ayuda para profesionales · Todo lo que necesitas para gestionar tu negocio en Doogking."
- Categorías: 🏪 Empezar en Doogking · 📅 Reservas · 💳 Cobros · ⚙️ Configuración · ⭐ Valoraciones · 🔒 Cuenta.
- Buscador de preguntas; preguntas reformuladas (ej. "¿Cuál es la comisión de Doogking?", "¿Cuándo recibiré el pago de mis reservas?", "¿Cómo puedo bloquear fechas o cerrar mi disponibilidad?") con iconos.

### HU-14.2.2 — Tarjetas de datos rápidos y recursos · `P3`

_Como Profesional, quiero ver datos clave y recursos formativos, para operar y crecer._

**Criterios de aceptación:**

- Tarjetas rápidas: Comisión (%), Pago (plazo tras finalizar), Tiempo respuesta soporte, Estado plataforma.
- Vídeos cortos en las preguntas importantes (cómo bloquear días, aprobar suplementos, modificar horarios).
- Sección "Recursos para profesionales": guía de inicio, vídeos de formación, cómo funcionan los pagos, consejos para más reservas, cómo mejorar posicionamiento.
- Zona inferior con [💬 Contactar soporte] [📞 Solicitar llamada] [📚 Manual para profesionales].

### HU-14.2.3 — Incidencias rápidas y Centro de aprendizaje · `P2`

_Como Profesional, quiero atajos para incidencias reales y contenido para crecer, para resolver rápido y mejorar mi negocio._

**Criterios de aceptación:**

- Sección "Incidencias rápidas": 🚨 No he recibido un pago · 🚨 Reserva urgente · 🚨 El cliente no se presenta · 🚨 La mascota necesita atención veterinaria · 🚨 El cliente no acepta un suplemento.
- "Centro de aprendizaje Doogking": cómo conseguir más reservas, cómo aparecer primero, cómo mejorar valoraciones, cómo aumentar el precio medio, cómo reducir cancelaciones.
- Bloque fijo "Lo más consultado esta semana" con las 5 dudas más frecuentes.

---

# Bloque 15 — Panel de administración (configurabilidad)

> 📍 **Ubicación:** **Backoffice / panel de administración** de Doogking y **panel del profesional** (no visible para el cliente final).

> Muchas mejoras dependen de que **el profesional configure su ficha** y de que **el administrador configure la plataforma**. Estas historias consolidan esa necesidad transversal.

### HU-15.1 — Servicios/badges configurables por el profesional · `P1`

_Como Profesional, quiero configurar los servicios, extras y badges de mi ficha, para que se reflejen automáticamente en listados, fichas y reservas._

**Criterios de aceptación:**

- El profesional activa/desactiva servicios y extras (transporte, adiestramiento, hoteles, alojamiento, etc.).
- Lo configurado se muestra automáticamente en: tarjeta de listado, ficha de detalle y paso de servicios adicionales de la reserva.

### HU-15.2 — Datos del negocio que alimentan la UI · `P2`

_Como Profesional, quiero que los datos de mi ficha (horarios, capacidad, políticas, precios, fotos) alimenten toda la plataforma, para no duplicar información._

**Criterios de aceptación:**

- Los datos configurados (hora entrada/salida, tamaño máx., nº mascotas, cancelación, servicios incluidos, políticas, tipos de espacio, suplementos) se muestran automáticamente en tarjetas, fichas y reservas.

### HU-15.3 — Configuración del programa Doogking Alpha · `P1`

_Como Administrador, quiero gestionar el programa de fidelización desde el panel, para ajustarlo sin desarrollo._

**Criterios de aceptación:**

- Ver HU-13.4 (niveles, reservas, descuentos, beneficios, adheridos, textos, iconos).

### HU-15.4 — Gestión de contenido comunitario "Explora" · `P2`

_Como Administrador, quiero revisar y publicar los lugares aportados por la comunidad, para garantizar calidad._

**Criterios de aceptación:**

- Flujo de moderación: los lugares compartidos por la comunidad se revisan antes de publicarse (coherente con el copy de la sección Explora).

---

# Bloque 16 — Bugs y correcciones críticas

> 📍 **Ubicación:** (16.1) plantilla del **email de verificación**; (16.2) flujo **«REGISTRA TU EMPRESA»** (`/registro-empresa`).

### HU-16.1 — [BUG] Enlace de verificación a localhost · `P1`

_Ver HU-6.2.1._ El email de verificación de empresas apunta a `localhost:4200`; debe apuntar al dominio real de producción. **Bloqueante para lanzamiento.**

### HU-16.2 — [BUG] Sin retorno a Home en el registro de empresa · `P1`

_Ver HU-6.1.10._ En el flujo de registro de empresa no hay forma de volver a la Home; añadir logo/enlace clicable a Home.

---

## Anexo — Cobertura de pantallas revisadas el 27/07/2026

Home (hero, buscador, valores, servicios, ¿por qué Doogking?, ciudades, recomendados, explora, cómo funciona, captación empresas, footer) · Buscador · Listados (alojamiento, transporte, adiestramiento, hoteles) · Fichas de detalle (alojamiento, transportista, adiestrador, hotel) · Reservas (veterinario, peluquería, alojamiento, transporte, adiestramiento, hoteles) · Registro de empresas · Email de verificación · Perfil de cliente · Ficha Inteligente (vista y creación) · Mis reservas · Favoritos · Mis reseñas · Menú "Mi cuenta" · Programa de fidelización (Doogking Alpha) · Centro de ayuda (cliente y profesional).

> **Nota:** El feedback del cliente insiste en un mensaje central: **no añadir más elementos, sino dar más protagonismo a los que ya existen**, cuidar la jerarquía visual, las microinteracciones y la coherencia entre categorías, y explotar el gran diferencial de Doogking: la **Ficha Inteligente de la mascota** como pasaporte digital que personaliza toda la experiencia.
