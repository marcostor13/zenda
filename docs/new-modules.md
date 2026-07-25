# Doogking — Backlog de Historias de Usuario · Nuevos módulos

**Proyecto:** Plataforma Doogking (marketplace multivertical de servicios para mascotas)
**Documento:** Backlog funcional de historias de usuario (HU)
**Preparado por:** Ignia — ignia.site
**Versión:** 1.0

---

## Roles

- **Propietario** — dueño de la mascota / cliente que reserva y paga.
- **Comercio** — negocio proveedor (peluquería, residencia, hotel, transporte, aseguradora).
- **Profesional** — persona que ejecuta el servicio (veterinario, adiestrador, peluquero, trabajador con agenda).
- **Administrador** — equipo Doogking (comisiones, moderación, métricas).
- **Sistema** — automatismos (notificaciones, scheduler, motor de eventos).

## Convenciones

- Formato: _Como [rol], quiero [acción], para [beneficio]._
- Cada HU incluye **Criterios de Aceptación (CA)**.
- Prioridad heredada del roadmap: **P0** fundacional, **P1**, **P2**.

---

# Fase A — Cimientos transversales (P0)

## A1 · Ficha Inteligente del Perro (Pasaporte Digital)

### HU-001 · Registrar mi mascota una sola vez

Como **propietario**, quiero crear la ficha de mi perro con sus datos de identidad, físico, salud, comportamiento y viaje, para no repetir la información en cada reserva.
**CA:**

- Puedo crear, editar y eliminar una o varias mascotas desde "Mis perros".
- Campos: identidad (raza/mestizo, nacimiento, sexo, esterilización, peso, microchip), físico (tipo de pelo, tamaño derivable del peso, estado del manto, PPP), salud (vacunas, alergias, enfermedades, medicación, dieta), comportamiento (sociabilidad, ansiedad de separación, miedos, temperamento, reactividad, protección de recursos), viaje (tolera trayectos, se marea, requiere transportín).
- La ficha se diseña multi-especie desde el inicio (perro, gato, etc.).
- Cada cambio queda versionado con fecha.

### HU-002 · Seleccionar la mascota al reservar

Como **propietario**, quiero elegir a qué mascota corresponde cada reserva, para que el servicio se adapte a su perfil.
**CA:**

- El wizard de reserva muestra el selector de "Mis perros".
- La reserva guarda `perroId`.
- Al confirmar, se congela un **snapshot** del perro (los datos con los que se calculó el precio) para eventuales disputas.

### HU-003 · Vacunas por checkboxes

Como **propietario**, quiero marcar las vacunas con casillas, para registrarlas rápido y sin errores.
**CA:**

- Checkboxes: tos de perrera, puppy, tetravalente, antirrábica, heptavalente, moquillo, hepatitis, parvovirus…
- Reemplaza el texto libre (igual que "tipo de pelo").
- Cada vacuna admite fecha opcional.

### HU-004 · Campos de conducta en alojamiento

Como **propietario**, quiero indicar conductas específicas de alojamiento (se orina en la habitación, ladra al quedarse solo), para que hoteles y residencias ajusten el servicio.
**CA:**

- Campos de conducta de alojamiento en la ficha.
- Visibles para el comercio de alojamiento en la reserva.

### HU-005 · Historial básico visible antes de la llegada

Como **comercio** (p. ej. peluquería), quiero ver la ficha/foto del perro antes de que llegue el cliente, para preparar el servicio y ajustar el precio con antelación.
**CA:**

- El comercio ve el snapshot del perro asociado a la reserva antes de la cita.
- Respeta las reglas de compartición selectiva (ver A5).

## A2 · Precio estimado + suplementos con aprobación

### HU-006 · Ver precio mínimo y estimado

Como **propietario**, quiero ver el precio mínimo del servicio y un estimado según los datos de mi perro, para saber cuánto pagaré antes de reservar.
**CA:**

- La ficha del comercio muestra el **precio mínimo** del servicio a contratar.
- El wizard calcula un **precio estimado** a partir del perfil del perro.
- Se indica claramente cuándo el precio es "orientativo".

### HU-007 · Aceptar aviso legal de ajuste

Como **propietario**, quiero aceptar que el precio puede ajustarse si hay circunstancias no declaradas, para reservar con transparencia.
**CA:**

- Checkbox obligatorio antes de pagar: "Confirmo que la información facilitada sobre mi mascota es correcta…".
- Se registra el consentimiento con fecha.

### HU-008 · Pagar el estimado

Como **propietario**, quiero pagar el precio estimado al reservar, para bloquear la plaza.
**CA:**

- SlotHold + PaymentIntent (flujo Stripe actual).
- La reserva queda confirmada/pagada.

### HU-009 · Solicitar suplemento en recepción

Como **profesional**, quiero añadir suplementos preconfigurados cuando detecto algo en recepción, para cobrar el servicio real.
**CA:**

- El comercio define sus suplementos en `suplemento_configs` (no genéricos).
- El profesional selecciona suplementos y adjunta **foto obligatoria** del estado del perro.
- La reserva pasa a `ajuste_solicitado` con `montoAjustado` y motivo.

### HU-010 · Aprobar o rechazar el ajuste

Como **propietario**, quiero decidir sobre el nuevo importe, para no pagar nada sin mi aprobación.
**CA:**

- Notificación con: precio inicial → nuevo precio → motivo.
- Acciones: **aceptar** (cobro de la diferencia, 2.º PaymentIntent) o **rechazar**.
- Estados `ajuste_aceptado` / `ajuste_rechazado`.
- Regla: ningún coste adicional sin aprobación previa del propietario.

### HU-011 · Reembolso con cargo mínimo de gestión

Como **propietario**, quiero que si rechazo el ajuste se me reembolse reteniendo solo un cargo de gestión, para cancelar con reglas claras.
**CA:**

- Al rechazar, Doogking reembolsa vía Stripe y cancela el servicio.
- Se retiene **siempre** un cargo mínimo de gestión configurable.

### HU-012 · Aprendizaje del precio

Como **sistema**, quiero recordar los ajustes previos de un perro, para estimar mejor el precio en futuras reservas.
**CA:**

- Tras varias reservas, el estimado incorpora el histórico de suplementos del perro.

## A3 · Evidencias fotográficas

### HU-013 · Adjuntar evidencias a la reserva

Como **profesional**, quiero adjuntar fotos/vídeo del estado de llegada y de la cartilla, para respaldar el servicio y los suplementos.
**CA:**

- Subida a S3 vinculada a `reservaId`.
- Evidencias visibles para propietario, comercio y admin.
- Sostiene las valoraciones negativas justificadas con fotos.

## A4 · Recálculo de comisión

### HU-014 · Comisión sobre total ajustado

Como **administrador**, quiero que la comisión se calcule sobre el importe final, para cobrar correctamente cuando hay suplementos.
**CA:**

- Comisión recalculada sobre `montoAjustado` cuando el suplemento lo cobra la plataforma.
- **Excepción veterinaria:** solo se comisiona la consulta reservada.

## A5 · Control del historial por el propietario

### HU-015 · Editar y eliminar lo que registran las empresas

Como **propietario**, quiero modificar o borrar lo que las empresas añaden al historial de mi perro, para mantener el control de sus datos.
**CA:**

- El propietario puede editar/eliminar entradas del historial.
- Las empresas solo rellenan un apartado de "observaciones del servicio".

### HU-016 · Compartición selectiva por servicio

Como **propietario**, quiero decidir qué información ve cada tipo de servicio, para que a la peluquería no le llegue el informe del veterinario.
**CA:**

- Consentimiento por tipo de historial **y** por tipo de servicio.
- Opt-in explícito; por defecto no se comparte fuera del servicio que lo generó.
- Registro de consentimientos conforme a RGPD.

---

# Fase B — Inteligencia por perfil (P1)

## B1 · Motor de compatibilidad servicio ↔ perro

### HU-017 · Declarar "apto para"

Como **comercio**, quiero definir para qué perfiles de perro es apto cada servicio, para no recibir reservas incompatibles.
**CA:**

- Configuración "apto para" por servicio (tipo de pelo, tamaño, temperamento…).

### HU-018 · Filtrado automático por perfil

Como **propietario**, quiero ver solo los servicios compatibles con mi perro, para no elegir algo inadecuado.
**CA:**

- Búsqueda y detalle filtran según el perfil del perro seleccionado.
- Ej.: un chihuahua de pelo corto no ve un stripping de husky.

## B2 · Reputación bidireccional controlada

### HU-019 · Valorar al perro (privado y controlado)

Como **comercio**, quiero valorar el comportamiento del perro tras el servicio, para dar confianza a futuros profesionales.
**CA:**

- La valoración alimenta el pasaporte del perro.
- El dueño es informado, puede **responder** y **pedir revisión**.
- Nunca se muestra una puntuación pública negativa del perro.

### HU-020 · Valoración negativa justificada

Como **comercio**, quiero justificar una valoración negativa con observaciones y fotos, para casos de daños o suciedad.
**CA:**

- Toda negativa requiere observaciones + evidencia fotográfica.

### HU-021 · Valorar el alojamiento (pet-friendly real)

Como **propietario**, quiero valorar cómo de pet-friendly fue el alojamiento, para orientar a otros dueños.
**CA:**

- Ejes: transparencia de suplementos, trato, zonas permitidas y cumplimiento de lo anunciado.

## B3 · Recomendador de servicio

### HU-022 · Recomendación por motivo/gravedad

Como **propietario**, quiero que la plataforma recomiende el servicio adecuado según el motivo, para acertar a la primera.
**CA:**

- Motor de reglas declarativas por motivo/gravedad.
- Ej. adiestramiento: agresividad + reactividad a la correa → obliga valoración individual y bloquea clases grupales.

---

# Fase C — Verticales (P1)

## C1 · Hotel pet-friendly

### HU-023 · Configurar política de mascotas

Como **comercio de alojamiento**, quiero configurar mi política de mascotas, para recibir solo reservas que puedo atender.
**CA:**

- Admisión, nº máximo por reserva, tamaño/peso permitido, razas restringidas (PPP, gigantes, específicas) y especies admitidas.

### HU-024 · Suplementos por mascota y por concepto

Como **comercio de alojamiento**, quiero definir suplementos, para cobrar según la mascota y los extras.
**CA:**

- Suplementos por mascota/noche (pequeña/mediana/grande), limpieza especial, segunda mascota, etc.
- Servicios y normas pet-friendly configurables (camas, comederos, zonas, correa, bozal…).

### HU-025 · Suplementos automáticos ante discrepancias

Como **comercio de alojamiento**, quiero aplicar suplementos automáticos si lo declarado no coincide, para cobrar lo real.
**CA:**

- Reglas: segunda mascota no declarada, salto de categoría por tamaño, limpieza extraordinaria, daños.
- Dispara el flujo transversal de modificación (HU-010).

### HU-026 · Modificar la reserva (aceptar/cancelar)

Como **propietario**, quiero ver el nuevo importe y su motivo, para aceptar o cancelar.
**CA:**

- Muestra reserva original → nuevo importe → motivo.
- Acciones aceptar/cancelar con las reglas de reembolso.

### HU-027 · Índice de comportamiento en alojamiento

Como **comercio de alojamiento**, quiero puntuar al perro tras la estancia, para facilitar futuras reservas.
**CA:**

- Ejes: limpieza, comportamiento en habitación, sociabilidad, ruido, respeto del mobiliario.
- Alimenta el pasaporte (con las reglas de valoración controlada B2).

> **Nota:** los paquetes cerrados "Vacaciones completas Doogking" se posponen a fase posterior. La v1 solo recomienda y permite añadir servicios complementarios mediante el carrito (C3).

## C2 · Veterinaria + Historia Veterinaria Compartida (lista cerrada)

### HU-028 · Contratar servicios cerrados

Como **propietario**, quiero contratar únicamente servicios veterinarios cerrados, para tener un precio claro.
**CA:**

- Catálogo limitado: esterilización/castración, primera consulta, consulta de revisión, segunda opinión, consulta urgente y limpieza dental.
- Sin triaje elaborado ni precio abierto por tratamientos.

### HU-029 · Precio cerrado vs. orientativo

Como **profesional veterinario**, quiero marcar el precio como cerrado u orientativo ("desde"), para reflejar el tipo de servicio.
**CA:**

- El sistema distingue precio cerrado (comisionable) de orientativo.

### HU-030 · Facturación externa de extras

Como **administrador**, quiero que las pruebas/tratamientos extra se facturen fuera de la plataforma, para comisionar solo la consulta.
**CA:**

- Doogking solo cobra y comisiona la consulta reservada.

### HU-031 · Historia Veterinaria Compartida

Como **propietario**, quiero una carpeta médica digital de mi mascota integrada con las reservas, para que cualquier veterinario acceda con mi autorización.
**CA:**

- Registra vacunas, medicación, alergias, enfermedades crónicas, cirugías, informes y resultados analíticos.
- Acceso entre profesionales **siempre con autorización** del propietario (compartición selectiva A5).

### HU-032 · Volcado rápido copiar/pegar

Como **profesional veterinario**, quiero volcar el historial pegando Excel o un documento, para agilizar la carga tras la consulta.
**CA:**

- Importación por copiar/pegar de Excel o documento al historial del perro.

## C3 · Carrito multi-vertical desacoplado + "Mi viaje con mi mascota"

### HU-033 · Carrito único, desacoplado por dentro

Como **propietario**, quiero un solo carrito con varios servicios, para reservarlos juntos.
**CA:**

- Internamente cada servicio es su propia **reserva, empresa, precio, comisión, disponibilidad y política de cancelación**.

### HU-034 · Reserva madre + servicios vinculados

Como **propietario**, quiero una reserva principal con servicios vinculados (p. ej. el hotel como reserva madre), para organizar el viaje.
**CA:**

- Relación reserva madre ↔ servicios vinculados.

### HU-035 · Cancelación independiente por servicio

Como **propietario**, quiero cancelar un servicio sin tumbar el resto, para tener flexibilidad.
**CA:**

- Cancelar la peluquería no afecta al hotel ni a los demás servicios.

### HU-036 · Validar disponibilidad antes del pago

Como **sistema**, quiero validar que cada servicio tiene plaza/horario real antes de confirmar, para no vender lo que no existe.
**CA:**

- No se confirma el paquete si algún servicio no tiene disponibilidad real.

### HU-037 · Pantalla "Mi viaje con mi mascota"

Como **propietario**, quiero ver todo el detalle del viaje en una sola vista, para gestionarlo con comodidad.
**CA:**

- Vista única con alojamiento, servicios, horarios, direcciones, importes, estados y cancelaciones.

---

# Fase D — Módulos nuevos y negocio (P2)

## D1 · Vertical Seguros

### HU-038 · Configurar la oferta de la aseguradora

Como **aseguradora**, quiero configurar mis pólizas, para ofrecerlas en la plataforma.
**CA:**

- Tipos de seguro (RC obligatoria/ampliada, gastos veterinarios accidente/enfermedad, asistencia, robo/pérdida, fallecimiento, defensa jurídica, viaje, PPP, vida), límites de cobertura, condiciones de admisión (edad por raza, peso, razas excluidas, estado sanitario), carencias y franquicias.

### HU-039 · Elegibilidad y tipos de contratación

Como **propietario**, quiero contratar el tipo de seguro adecuado, para cubrir a mi mascota.
**CA:**

- Tipos: RC obligatoria, veterinario básico, premium, completo y temporal (vacaciones, viajes, eventos).
- `checkAvailability` = elegibilidad (edad/raza/carencias); colección `polizas` separada (vigencia, renovación, carencias, franquicia).

### HU-040 · Gestión de veracidad y precio orientativo

Como **aseguradora**, quiero que el precio se muestre como orientativo sujeto a validación, para ajustarlo tras revisar los datos.
**CA:**

- El cliente confirma veracidad; se advierte que la omisión puede revisar prima, excluir coberturas o cancelar.
- Precio orientativo con validación final de la aseguradora.

### HU-041 · Seguro recomendado e Índice de Bienestar

Como **propietario**, quiero una recomendación de seguro basada en el perfil de mi perro, para elegir mejor.
**CA:**

- "Seguro recomendado para tu perro" según edad, raza, peso, historial, actividad, viajes y uso de servicios.
- "Índice de Bienestar Doogking" (vacunas al día, revisiones, peso, prevención) con descuentos escalonados estilo bonus-malus.

## D2 · Módulo Comunidad "Explora con tu mascota"

### HU-042 · Descubrir lugares pet-friendly

Como **propietario**, quiero explorar playas, parques y restaurantes pet-friendly, para hacer planes con mi mascota.
**CA:**

- Catálogos con fichas: playas caninas (normativa, servicios, aparcamiento, duchas, fuentes, ocupación), parques (superficie, vallado, sombra, iluminación, agility), restaurantes (interior/terraza, bebederos, menú), todos con fotos, valoraciones y puntuación media.

### HU-043 · Aportar contenido de usuario (UGC)

Como **propietario**, quiero subir fotos, reseñas e incidencias, para enriquecer la comunidad.
**CA:**

- Fotos, valoraciones, consejos, recomendaciones, incidencias y actualización de información existente.

### HU-044 · Geolocalización y mapa interactivo

Como **propietario**, quiero ver lo cercano en un mapa, para llegar fácil.
**CA:**

- Geolocalización con consentimiento; resultados ordenados por proximidad.
- Mapa interactivo tipo Maps con ficha por punto; colecciones `lugares` (geo 2dsphere), `lugar_reviews`, `favoritos`.

### HU-045 · Favoritos y moderación

Como **propietario**, quiero guardar favoritos, para recibir recomendaciones; y como **administrador**, quiero moderar el UGC.
**CA:**

- Guardar lugares favoritos; recomendaciones personalizadas.
- Panel de moderación de contenido de usuarios.

## D3 · Comisión por tramos + Socios Fundadores

### HU-046 · Comisión por tramo de importe

Como **administrador**, quiero comisiones por tramo, para ajustar el margen al ticket.
**CA:**

- Tramos: <30 € → 8%; 30–100 € → 10%; 100–300 € → 12%; >300 € → 15%.

### HU-047 · Programa Socios Fundadores

Como **administrador**, quiero congelar la comisión a los primeros comercios, para generar urgencia comercial.
**CA:**

- Marca `socioFundador` con comisión congelada (24 meses); dimensión de cohorte en el reporte financiero.

### HU-048 · Alta de cuidadores a domicilio

Como **administrador**, quiero dar de alta el vertical de cuidadores a domicilio, para ampliar la oferta.
**CA:**

- Alta ligera sobre el patrón discriminador existente. _(El vertical de paseadores queda fuera de alcance.)_

## D4 · Integración de agenda (módulo grande)

### HU-049 · Sincronización bidireccional de calendario

Como **profesional**, quiero sincronizar mi agenda con Google Calendar y Outlook/M365, para no gestionar dos calendarios.
**CA:**

- Sincronización bidireccional; capa de conectores/adaptadores preparada para CRM futuros.

### HU-050 · Agendas por trabajador y recursos reservables

Como **comercio**, quiero agendas por trabajador y recursos reservables, para reflejar mi operación real.
**CA:**

- Agendas por trabajador; recursos reservables (habitaciones, vehículos, mesas…); jornada partida en horarios de comercio.

### HU-051 · Reglas de agenda

Como **comercio**, quiero márgenes, recurrencia y zonas horarias, para citas realistas.
**CA:**

- Márgenes entre citas, recurrencia y soporte de zonas horarias.

### HU-052 · Anti-doble-reserva

Como **sistema**, quiero bloquear temporalmente el slot durante el pago y revalidar, para evitar dobles reservas.
**CA:**

- Bloqueo temporal durante el pago + revalidación anti-doble-reserva antes de confirmar.

## D5 · Solicitud automática de valoraciones

### HU-053 · Envío automático al completar el servicio

Como **sistema**, quiero enviar la solicitud de valoración al marcar "servicio completado", para maximizar reseñas.
**CA:**

- Correo personalizado con **enlace único** a la reserva concreta; una valoración por servicio; recordatorio único.
- Exclusiones: reserva cancelada, reembolsada o con incidencia.

### HU-054 · Panel de seguimiento de valoraciones

Como **administrador**, quiero un panel con el tracking de los envíos, para controlar la campaña.
**CA:**

- Tracking de envío/entrega/apertura/reenvío por solicitud.

## D6 · Recuperación de reservas abandonadas + automatización de marketing (módulo grande)

### HU-055 · Detección de abandono

Como **sistema**, quiero detectar el abandono y el paso exacto donde ocurrió, para recuperarlo.
**CA:**

- Eventos: `reserva_iniciada`, `reserva_abandonada`, etc. (arquitectura por eventos).
- Registro del paso exacto del abandono.

### HU-056 · Notificaciones de recuperación

Como **sistema**, quiero enviar push/email/in-app, para reactivar la reserva.
**CA:**

- Canales push, email e in-app configurables.

### HU-057 · Campañas y cupones configurables

Como **administrador**, quiero configurar campañas y cupones, para incentivar la conversión.
**CA:**

- Cupones configurables, incluyendo **quién asume el descuento** (plataforma/comercio).
- Panel de métricas y gestión de consentimiento de marketing.

---

## Índice de módulos y HU

- **Fase A (P0):** A1 Ficha del Perro (HU-001→005) · A2 Precio+suplementos (HU-006→012) · A3 Evidencias (HU-013) · A4 Comisión (HU-014) · A5 Control historial (HU-015→016)
- **Fase B (P1):** B1 Compatibilidad (HU-017→018) · B2 Reputación controlada (HU-019→021) · B3 Recomendador (HU-022)
- **Fase C (P1):** C1 Hotel (HU-023→027) · C2 Veterinaria+HVC (HU-028→032) · C3 Carrito multi-vertical (HU-033→037)
- **Fase D (P2):** D1 Seguros (HU-038→041) · D2 Comunidad (HU-042→045) · D3 Comisiones+Fundadores (HU-046→048) · D4 Agenda (HU-049→052) · D5 Valoraciones auto (HU-053→054) · D6 Abandonos+Marketing (HU-055→057)

**Total: 57 historias de usuario.**

---

_Ignia · Software · IA · Consultoría · ignia.site_
