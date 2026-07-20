# Mejora de servicios — Especificación funcional del cliente

> Transcripción organizada de `docs/mejora_servicios.docx`. Documento de trabajo aportado por Marcos con anotaciones propias (marcadas como **Nota de Marcos**) que resuelven ambigüedades y fijan decisiones de negocio. Este documento es la base funcional; el análisis técnico de encaje en la plataforma está en `ANALISIS-ESPECIFICACIONES.md` y el plan de ejecución en `docs/PLAN-IMPLEMENTACION-MEJORA-SERVICIOS.md`.
>
> **Idea central que atraviesa todo el documento:** cada vertical debería (1) dejar que el propio comercio configure con detalle qué ofrece y para qué perro es apto, (2) filtrar automáticamente lo que ve el cliente según el perfil de su mascota, y (3) manejar el precio como una **estimación** que puede ajustarse en el momento del servicio mediante un ciclo de **suplemento → notificación → aceptar/rechazar → cobro o reembolso**. Sobre esto se apoya la idea más grande: una **Ficha Inteligente del Perro** única y reutilizable en todos los verticales.

---

## 1. Peluquería canina ✂️

### 1.1 Configuración que rellena la empresa

**Información básica del servicio** — por cada servicio (baño básico, baño+corte, corte a tijera, stripping, deslanado, corte higiénico, spa canino…): nombre, descripción, duración aproximada, precio base, fotos del resultado (opcional).

**Tamaño del perro admitido** — mini (0-5kg) / pequeño (5-10kg) / mediano (10-25kg) / grande (25-40kg) / gigante (+40kg). Cada tamaño puede tener **precio y duración distintos** (ej.: pequeño 25€/45min, mediano 35€/60min, grande 50€/90min).

**Tipo de pelo compatible** — corto / medio / largo / rizado / duro / doble capa. Sirve para **bloquear servicios incompatibles** (el stripping solo aparece para pelo duro, el deslanado solo para doble capa).

**Razas específicas (opcional).**

**Estado del manto** — mantenimiento habitual / nudos leves / nudos severos / rasurado necesario. Cada opción puede añadir **suplementos automáticos** que define cada empresa (no genéricos): ej. nudos severos +10€, rasurado por nudos +20€.

**Temperamento del perro** — muy tranquilo / nervioso / miedo a secador / requiere dos personas / agresivo con manipulación (obligatorio traer con bozal). La empresa decide: aceptar igual, cobrar suplemento, o requerir valoración previa. **La empresa se reserva el derecho de anular el trabajo si el perro es agresivo.**

**Servicios adicionales** — corte de uñas, limpieza de oídos, vaciado de glándulas anales, perfume, tratamiento antiparasitario, mascarilla hidratante, ozono, spa premium, champú especial por alergias.

**Requisitos obligatorios** — vacunas al día, microchip obligatorio. *(Nota de Marcos: solo se necesita confirmación del cliente, no demostración del pasaporte/cartilla.)*

**Horarios disponibles** — días disponibles, duración de cada cita, número máximo de perros simultáneos, margen entre citas.

### 1.2 Información que introduce el cliente

Al reservar, el cliente elige su perro (raza, peso, edad, tipo de pelo, tamaño, carácter) y **Doogking filtra automáticamente** los servicios compatibles. Ejemplo: Nala (chihuahua, 3kg, pelo corto, tranquila) solo ve baño mini, corte higiénico, corte de uñas, spa mini — nunca deslanado de husky ni stripping.

### 1.3 Ficha Inteligente del Perro (idea diferenciadora)

El cliente registra a su perro **una sola vez**: nombre, raza, fecha nacimiento, peso, fotos, tipo de pelo, vacunas, alergias, medicación, miedos, nivel de sociabilidad. A partir de ahí, **cualquier peluquería, guardería, residencia o veterinario adapta automáticamente la reserva a ese perfil**. Ejemplo: Nala (miedo al secador, alergia al pollo, no tolera perros grandes) → la peluquería recibe automáticamente "perra pequeña, miedo al secador, requiere secado progresivo"; la residencia recibe "no alojar con perros grandes".

### 1.4 Ciclo de precio estimado → suplemento → aprobación

1. **Precio estimado durante la reserva**: se calcula según los datos del perro (ej. Yorkshire 5kg, pelo largo, sin nudos, tranquilo → 39€).
2. **Aviso antes de pagar**: checkbox "confirmo que la información es correcta" + advertencia de que el precio puede ajustarse si en recepción se detectan circunstancias no indicadas (nudos severos, peso superior, comportamiento agresivo/nervioso, estado higiénico deficiente, necesidad de 2 profesionales, servicios adicionales pedidos en el momento).
3. **Suplementos predefinidos por la empresa** (tabla ejemplo): nudos leves +5€, nudos severos +15€, rasurado por nudos +20€, perro muy nervioso +10€, necesidad de segundo profesional +15€, peso superior al declarado +5€.
4. **Confirmación desde la app**: el profesional marca el motivo (ej. "nudos severos +15€"), se muestra precio inicial (39€) → nuevo precio (54€), y el cliente recibe notificación con botones 🟢 Aceptar modificación / 🔴 Cancelar servicio.
5. **Protección para ambas partes**: la empresa adjunta foto del estado del perro al llegar (protege al profesional de reclamaciones, al cliente de abusos, y a Doogking de disputas).
6. **Comunicación al usuario**: "Los precios mostrados son estimaciones... Ningún coste adicional será aplicado sin la aprobación previa del propietario."

*Nota de Marcos: que la empresa, tras el servicio, pueda escribir una valoración del perro es un extra importante para evitar problemas futuros — funciona como memoria del perfil del perro para Doogking.* Ejemplo: "Luna: siempre requiere deslanado intensivo, suele necesitar dos profesionales, tiempo medio real 90 min" → la próxima vez Doogking ya estima el precio correcto automáticamente ("Basándonos en servicios anteriores de Luna, el precio estimado es de 58€"). Esto convierte a Doogking en algo más parecido a una "historia clínica y de servicios del perro" que a un simple sistema de reservas.

---

## 2. Residencias caninas 🏠

Mismo principio que peluquería, pero más crítico: una descripción incorrecta puede afectar a la **seguridad** del perro, del resto de animales y del personal. *(Nota de Marcos: la controversia es que no todas las residencias tendrán zona premium, habitación climatizada o suite — el formulario debe ser configurable con un click por cada opción que aplique, no dar por hecho que todas las residencias las tienen.)*

### 2.1 Configuración que rellena la residencia (todo tipo click)

1. **Tipo de alojamiento disponible**: habitación individual / compartida / zona premium / habitación climatizada / suites familiares para varios perros.
2. **Tamaño del perro admitido**: mini a gigante, con precios distintos por tamaño. *(Nota de Marcos: en mi residencia el tamaño no importa; no sé si en las demás es relevante — por eso debe ser opcional/configurable, no obligatorio.)*
3. **Compatibilidad social requerida**: compatible con otros perros / solo con pequeños / solo machos / solo hembras / necesita alojamiento individual.
4. **Requisitos sanitarios** — **opcionales de exigir** por cada residencia (no obligatorios globalmente): microchip obligatorio, vacunas obligatorias, desparasitación interna/externa, vacuna tos de las perreras (opcional). *(Nota de Marcos: vacunas como la tos de perrera o la rabia — erradicada en España — no las pedimos obligatoriamente en mi residencia, pero sí nos gusta saber si las lleva.)*
5. **Conductas no admitidas**: agresividad hacia perros/personas, ansiedad extrema por separación, escapista habitual, destrucción severa de instalaciones.
6. **Servicios adicionales**: administración de medicación, dieta especial, paseos individuales, entrenamiento durante la estancia, peluquería antes de la salida, recogida y entrega a domicilio.

### 2.2 Información que introduce el cliente

Datos básicos (nombre, edad, sexo, esterilizado, peso, raza) + comportamiento (sociable con perros/personas, nunca ha estado en residencia, ansiedad por separación, reactivo con correa, protector de recursos) + salud (medicación, alergias, enfermedades, dieta especial) + alimentación (marca de pienso, tomas diarias, cantidad — **no obligatorio**).

**Problema habitual**: el propietario marca "sociable con todos los perros ✅" pero al llegar el perro no tolera otros machos, necesita alojamiento individual, manejo especial y paseos individuales → el coste real cambia completamente.

### 2.3 Ciclo de precio estimado → suplemento → aprobación

Estancia estimada (5 noches × 22€ = 110€, calculado para perro sociable/sin medicación/habitación compartida/sin necesidades especiales) → checkbox de confirmación + aviso de posible ajuste → suplementos configurables **€/día** (alojamiento individual, medicación oral/inyectable, paseo individual, perro reactivo, dieta especial) → validación en la entrada: la residencia detecta incompatibilidad → notificación con reserva original (110€) vs nuevo importe (150€) y motivo → 🟢 Aceptar / 🔴 Cancelar.

**Evidencias**: fotos del estado del perro al llegar, fotos de la cartilla sanitaria, vídeos cortos de comportamiento si es necesario.

**Diferencial**: tras cada estancia la residencia valora sociabilidad, adaptación, nivel de energía, necesidades especiales, tipo de alojamiento recomendado → se acumula un "Historial Doogking" visible en la siguiente reserva en cualquier residencia de la plataforma. Esto convierte a Doogking en un **pasaporte digital del perro**.

---

## 3. Adiestramiento canino 🎓

Vertical donde más valor puede aportar Doogking porque hoy la mayoría de reservas se hacen por WhatsApp/llamadas y es difícil filtrar si el caso necesita sesión individual, grupal o valoración previa.

### 3.1 Configuración del centro de educación canina (todo tipo click, no numerado)

- **Valoración inicial**: presencial / online por videollamada / a domicilio.
- **Sesiones individuales**: en centro / a domicilio / online.
- **Sesiones grupales**: cachorros, obediencia básica, obediencia avanzada, socialización, perros reactivos, perros deportivos.
- **Cursos completos**: curso cachorro, obediencia básica, obediencia avanzada, modificación de conducta, curso de llamada, paseo sin tirar, sociabilización, preparación perro de terapia, preparación perro deportivo, y catálogo extendido de técnicas (obediencia deportiva, collar de impulsos en positivo, clicker, comunicación avanzada, concentración, sincronía de cerebros, reactividad, uso correcto de correa, flexi, modificación de conductas, agresión y presa en deporte, sistema CoachinDog, apport, propiocepción/psicomotricidad/lateralidad, rescate/búsqueda/marcaje, detección de sustancias, perros de asistencia, educación holística, elección correcta del perro, iniciación al olfato, miedo y agresiones, correa y llamada).
- **Servicios especiales**: asesoramiento pre-adopción, preparación llegada del cachorro, convivencia con bebés, introducción de nuevos animales en casa.

Para cada servicio: precio, duración, número máximo de perros, edad mínima/máxima, lugar de realización, material necesario.

### 3.2 Información que introduce el cliente

Datos básicos + **nivel de experiencia** (primera vez sí/no) + **motivo principal de consulta** (tirones de correa, no acude a la llamada, ansiedad por separación, destrucción en casa, ladridos excesivos, miedos, agresividad hacia perros/personas, problemas con niños, protección de recursos, obediencia básica, socialización, preparación cachorro, otro) + **intensidad** (leve/moderado/grave) + descripción libre + **historial previo** (trabajó con otro profesional, usó collar de castigo/arnés, toma medicación, diagnóstico veterinario de conducta) + **cuestionario**: edad de adquisición, tiempo que lo tiene, si estuvo con la madre mínimo 8 semanas, número y duración de salidas diarias, vínculo propietario-mascota (escala 1-5) + vídeos opcionales del comportamiento.

### 3.3 Recomendador automático (regla de negocio explícita)

- Cachorro 4 meses + socialización + mordisqueos → ✅ Curso de cachorros.
- Agresividad hacia perros + se lanza a la correa → ✅ Valoración individual previa, ❌ **bloquea directamente** las clases grupales.
- Tirones de correa + perro sociable → ✅ Curso de obediencia, ✅ sesión individual, ✅ curso grupal (varias opciones válidas).

### 3.4 Gestión de precios variables

Valoración inicial (45€) → el profesional propone un plan (bono de 5 sesiones, curso grupal, programa de modificación de conducta, programa mixto — ej. "1 valoración + 6 individuales + 4 grupales = 420€") → **el cliente puede aceptarlo directamente desde la plataforma**.

**Modelo en 4 niveles**: 1) valoración inicial → 2) plan de trabajo personalizado → 3) reserva de sesiones individuales/grupales → 4) seguimiento y evolución.

### 3.5 Historial y diferencial

Tras cada sesión el profesional registra objetivos trabajados, evolución, ejercicios para casa, próximos objetivos. Idea potente: crear un **"Nivel Doogking"** del perro (1-Cachorro, 2-Básico, 3-Intermedio, 4-Avanzado, 5-Excelente sociabilidad) visible para cualquier profesional de la plataforma — genera progresión y fidelización.

---

## 4. Transporte de animales 🚐

El presupuesto se calcula según la información del propietario y puede ajustarse si las condiciones reales difieren.

### 4.1 Configuración de la empresa de transporte

*(Nota de Marcos: cada transportista trabaja de forma muy distinta — el formulario debe distinguir claramente qué campos son **obligatorios (\*)** y cuáles opcionales, para que el cliente vea de un vistazo si el servicio le interesa.)*

- **Tipo de transporte**: local urbano, provincial, nacional, internacional, recogida/entrega para peluquerías, recogida/entrega para residencias, traslado veterinario, traslado urgente veterinario, traslado aeropuerto, transporte compartido con otros perros, transporte exclusivo. Incluye **itinerario y días en que opera** (respuestas mínimas obligatorias + opcionales según el transportista).
- **Zona de cobertura**: provincias, km máximos, países, horarios de servicio.
- **Tamaños admitidos**: mini a gigante.
- **Requisitos sanitarios**: los que cada empresa considere necesarios (microchip, vacunas, cartilla sanitaria, pasaporte europeo).
- **Características del vehículo**: climatización, jaulas homologadas, separación individual, seguimiento GPS, puerta a puerta, transporte acompañado, paradas programadas, recogidas/entregas en central.
- **Servicios adicionales**: recogida/entrega a domicilio, administración de medicación, alimentación durante el trayecto, paseos en trayectos largos, transporte urgente, seguro ampliado.

### 4.2 Información del cliente (con obligatorios marcados \*)

Datos del perro (nombre, raza, edad, peso, sexo, esterilizado) + datos del trayecto (dirección recogida\*, dirección entrega\*, fecha\*, hora preferida) + comportamiento durante desplazamientos (viaja tranquilo, se marea, ladra, ansiedad, miedo al vehículo, necesita transportín, no tolera otros perros, puede viajar con otros animales) + necesidades especiales (medicación durante el trayecto, alimentación especial) + documentación (cartilla sanitaria\*, pasaporte\*, certificados si aplica).

### 4.3 Ciclo de precio estimado → suplemento → aprobación

Ejemplo: Castellón→Valencia, labrador 28kg sociable, transporte compartido → 55€ estimado. Si al recoger pesa 40kg y no tolera otros animales (requiere transporte individual) → nuevo importe 85€, con motivo (transporte exclusivo requerido, tamaño superior, jaula especial) → 🟢 Aceptar actualización / 🔴 Cancelar servicio.

**Tabla de suplementos**: transporte exclusivo +20€, más de 30kg +10€, trayecto urgente +25€, administración de medicación +5€, parada adicional +10€, recogida nocturna +15€.

**Tipos de contratación**: puntual (un único trayecto), ida y vuelta (con espera, ej. veterinario), **recurrente** (programable, ej. "todos los lunes y miércoles a las 09:00" para guardería/peluquería mensual/rehabilitación), larga distancia (con paradas, hidratación, GPS), urgente veterinario (prioridad inmediata).

**Aviso legal**: "el precio mostrado es una estimación... si el animal requiere condiciones especiales no indicadas, el transportista podrá solicitar actualización del presupuesto." *(Nota de Marcos: en caso de no ser aprobada la modificación, la plataforma Doogking retornará el dinero al usuario y cancelará el servicio.)*

**Diferencial**: "Perfil de Viaje del Perro" (tolera trayectos largos, se marea, viaja bien con otros perros, requiere transportín cerrado, necesita parada cada 2h) — reduce incidencias y mejora la experiencia.

---

## 5. Servicio veterinario 🩺

El más delicado: a diferencia de peluquería o transporte, muchas veces el profesional no puede saber el alcance real del caso hasta ver al animal. Por eso lo ideal es **reservar tiempo profesional, no un tratamiento cerrado**, salvo en servicios muy específicos (vacunas, revisiones).

### 5.1 Configuración de la clínica

- **Consultas generales**: primera consulta, revisión, segunda opinión, consulta urgente.
- **Medicina preventiva**: vacunación, desparasitación, microchip, certificados sanitarios, pasaporte europeo.
- **Diagnóstico**: analítica, radiografía, ecografía, citologías, pruebas hormonales.
- **Cirugía**: esterilización, cirugía dental.
- **Telemedicina**: consulta online, seguimiento online.
- Duración y precio orientativo por servicio; horarios/nº de veterinarios/tiempo entre consultas/horario de urgencias/especialistas por día.
- **Especies atendidas**: perros, gatos, conejos, hurones, aves, exóticos — **no es un vertical solo de perros**.

### 5.2 Información del cliente

Datos del animal (nombre, especie, raza, edad, sexo, peso, esterilizado) + motivo principal (vacunación, revisión general, digestivo, dermatológico, cojera, ojos, oídos, tos, vómitos, diarrea, urinario, control de medicación, otro) + descripción libre + duración de síntomas (<24h, 1-3 días, >1 semana) + gravedad percibida (leve, moderada, grave, emergencia) + síntomas asociados (fiebre, apatía, pérdida de apetito, sangrado, dificultad respiratoria, dolor, convulsiones) + archivos opcionales (fotos, vídeos, informes anteriores).

### 5.3 Triaje automático

- Vacuna anual → ✅ reserva directa.
- Vómitos + sangre en heces + apatía → ⚠️ recomendar contactar urgencias veterinarias inmediatamente. *(Nota de Marcos: siempre contratando la consulta de urgencias el cliente a través de la propia plataforma Doogking.)*
- Cojera leve desde hace una semana → ✅ consulta general.

### 5.4 Modelo económico especial (afecta a la comisión)

El cliente reserva "primera consulta" (40€), pero durante la visita se hacen analítica (55€), ecografía (60€), medicación (18€) → factura final 173€. *(Nota de Marcos: Doogking se lleva comisión **solo de la parte de consulta contratada inicialmente**, porque los veterinarios no incluyen la factura total en la plataforma.)*

- **Importe de reserva**: corresponde exclusivamente a la consulta veterinaria inicial.
- **Aviso**: "las pruebas diagnósticas, tratamientos, medicación o procedimientos adicionales... no están incluidos en el importe inicial y serán presupuestados directamente con el cliente, sin mediar la plataforma, antes de su realización."
- **Consentimiento**: el propietario confirma que entiende que la consulta reservada es solo la valoración inicial y que cualquier procedimiento adicional es externo a Doogking.

**Servicios con precio cerrado** (comisionables normal): vacunas, microchip, certificados sanitarios, pasaporte europeo, revisiones postoperatorias, corte de uñas veterinario, operación esterilización, limpieza bucal.

**Servicios con precio orientativo** ("Precio desde X€" en vez de "Precio fijo"): consulta general, dermatología, traumatología, urgencias, hospitalización.

### 5.5 Diferencial: Historia Veterinaria Compartida

Con autorización del propietario: vacunas, medicación, alergias, enfermedades crónicas, cirugías previas, informes, resultados analíticos — accesible para cualquier veterinario de la plataforma. *(Nota de Marcos: que el veterinario pueda descargar en la plataforma, dentro del historial del perro, todo lo relevante tras cada consulta/operación/tratamiento — creando una centralita disponible para cualquier otro profesional al que el cliente vaya, con opción de copiar/pegar Excel o documento para agilizarlo. Es como la historia clínica que tenemos las personas, visible entre diferentes médicos.)*

---

## 6. Hotel / alojamiento pet-friendly 🏨

> **Distinto de la residencia canina (sección 2).** Aquí el cliente **no reserva un servicio para el perro**, sino un **alojamiento para las personas** condicionado a las características de su mascota — esto es lo que permite diferenciarse de Booking o Airbnb.

### 6.1 Configuración del hotel/alojamiento

**Política de mascotas**: admite mascotas (sí/no) → número máximo de mascotas por reserva (1/2/3/sin límite).

**Tamaño permitido**: hasta 5/10/20/40kg o sin límite de peso.

**Razas restringidas (opcional)**: ninguna restricción, o PPP / razas gigantes / razas específicas.

**Especies permitidas**: perros, gatos, conejos, hurones, otras mascotas.

**Suplementos por mascota** (configurable): mascota pequeña 10€/noche, mediana 15€/noche, grande 20€/noche, limpieza especial 25€/estancia, segunda mascota +5€/noche.

**Servicios petfriendly disponibles**: camas para perros, comederos/bebederos, kit de bienvenida, zona de paseo, parque canino cercano, guardería, paseo, peluquería, veterinario cercano, menú para mascotas.

**Normas del alojamiento**: puede/no puede quedarse solo en la habitación, acceso a zonas comunes/terraza/restaurante, debe ir con correa, debe llevar bozal si corresponde.

**Info general**: número máximo de mascotas simultáneas, tipo de habitación apta, horarios entrada/salida, fianza si procede.

### 6.2 Información del cliente

Datos de la mascota (nombre, raza, edad, peso, sexo, esterilizado) + comportamiento (sociable con personas/perros, puede quedarse solo, ladra si está solo, ansiedad por separación, muy tranquilo/activo) + necesidades especiales (medicación diaria, dieta especial, movilidad reducida, acceso frecuente al exterior) + número de mascotas.

### 6.3 Ciclo de precio y ajuste

Ejemplo: hotel 3 noches, 2 adultos, 1 perro de 8kg → 300€ habitación + 30€ suplemento mascota = 330€ total. Si el cliente declara 1 perro de 8kg tranquilo pero llegan 2 perros (uno de 35kg que no puede quedarse solo y ladra continuamente) → nuevo importe 390€ (segunda mascota + cambio de categoría petfriendly) → 🟢 Aceptar / 🔴 Cancelar.

**Suplementos automáticos**: segunda mascota no declarada +15€/noche, cambio a categoría superior por tamaño +10€/noche, limpieza extraordinaria +40€, daños ocasionados (según valoración).

### 6.4 Tipos de reserva

- **Reserva estándar**: hotel + mascota.
- **Reserva con servicios adicionales**: paseador, guardería, peluquería, transporte.
- **Escapadas petfriendly**: hotel + playa canina + restaurantes petfriendly + parque canino.
- **"Vacaciones completas Doogking"**: hotel + guardería diurna + peluquería antes del regreso + transporte al aeropuerto + actividades caninas — **todo desde una sola plataforma** (paquete multi-servicio/multi-vertical).

### 6.5 Diferencial: reputación bidireccional

Tras cada estancia, el alojamiento valora al perro (limpieza, comportamiento en habitación, sociabilidad, ruido, respeto del mobiliario) y el propietario valora al alojamiento en aspectos específicos para mascotas (comodidad para perros, espacios de paseo, atención recibida, servicios petfriendly reales). Este sistema de reputación bidireccional es una ventaja competitiva frente a plataformas generalistas de alojamiento.

---

## 7. Patrones transversales (resumen)

Estos tres patrones se repiten en las 6 secciones y son la base del trabajo técnico (ver `ANALISIS-ESPECIFICACIONES.md` §2 y el plan de implementación):

1. **Ficha Inteligente del Perro / Pasaporte Digital**: una entidad `Perro` única, reutilizada por todos los verticales, que acumula historial (comportamiento, salud, notas del profesional tras cada servicio) y sirve para filtrar/recomendar/precalcular precio.
2. **Precio estimado → validación en recepción → suplemento predefinido por el comercio → notificación al cliente → aceptar (se cobra diferencia) / rechazar (reembolso y cancelación)**, siempre con evidencia fotográfica. Presente en peluquería, residencia, transporte y hotel. Veterinaria tiene una variante propia (la parte extra se factura fuera de Doogking).
3. **Reputación bidireccional**: no solo el cliente valora al comercio — el comercio también valora al perro/cliente, alimentando el historial de la Ficha Inteligente.
