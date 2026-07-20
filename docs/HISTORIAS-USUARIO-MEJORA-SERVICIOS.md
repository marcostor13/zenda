# Historias de usuario — Mejora de servicios

> Derivadas de `docs/mejora_servicios.md` y `ANALISIS-ESPECIFICACIONES.md`. Formato: `Como <rol>, quiero <acción>, para <beneficio>`. Prioridad **P0** (fundacional, bloquea el resto) / **P1** (enriquecimiento por vertical) / **P2** (módulos nuevos / negocio). Fases según `docs/PLAN-IMPLEMENTACION-MEJORA-SERVICIOS.md`.

---

## Épica N — Ficha Inteligente del Perro (Pasaporte Digital)

- **N1 (P0)** Como **cliente**, quiero registrar a mi perro una sola vez (nombre, raza, fecha de nacimiento, peso, fotos, tipo de pelo, vacunas, alergias, medicación, miedos, sociabilidad), para no repetir esta información en cada reserva.
- **N2 (P0)** Como **cliente**, quiero editar y eliminar los perros de mi perfil, para mantener su ficha actualizada.
- **N3 (P0)** Como **cliente**, quiero seleccionar cuál de mis perros reservo en el wizard de reserva, para que el precio y los servicios disponibles se calculen para ese perro concreto.
- **N4 (P0)** Como **sistema**, quiero congelar (snapshot) los datos relevantes del perro en el momento de crear la reserva, para poder auditar con qué información se calculó el precio si surge una disputa posterior.
- **N5 (P1)** Como **comercio**, quiero recibir automáticamente un resumen legible del perfil del perro relevante para mi vertical (ej. "miedo al secador, alergia al pollo" en peluquería; "no alojar con perros grandes" en residencia), para adaptar el servicio sin tener que preguntar de nuevo.
- **N6 (P1)** Como **comercio**, quiero escribir una nota/valoración tras completar el servicio (comportamiento observado, tiempo real empleado, necesidades detectadas), para que quede como historial reutilizable del perro.
- **N7 (P1)** Como **cliente**, quiero ver el historial acumulado de mi perro por vertical (peluquería, residencia, adiestramiento, transporte, veterinaria, hotel) en su ficha, para tener una visión completa de su vida de servicios.
- **N8 (P1)** Como **sistema**, quiero recalcular automáticamente el precio estimado de la próxima reserva usando el historial real del perro (ej. "basándonos en servicios anteriores de Luna, el precio estimado es 58€"), para dar presupuestos más precisos con el tiempo.
- **N9 (P2)** Como **cliente**, quiero decidir con qué profesionales/verticales se comparte el historial sensible (salud, comportamiento) de mi perro, para mantener control sobre su privacidad (RGPD).
- **N10 (P2)** Como **centro de adiestramiento**, quiero asignar un "Nivel Doogking" (1-Cachorro a 5-Excelente sociabilidad) al perro tras el seguimiento, para que otros profesionales de la plataforma conozcan su nivel educativo.

## Épica S — Precio estimado y ciclo de suplementos

- **S1 (P0)** Como **cliente**, quiero ver un precio estimado (no cerrado) al reservar en verticales donde el coste depende del estado real del perro, para saber qué voy a pagar aproximadamente.
- **S2 (P0)** Como **cliente**, quiero confirmar explícitamente (checkbox) que la información de mi mascota es correcta y ser advertido de que el precio puede ajustarse en recepción, antes de pagar.
- **S3 (P0)** Como **comercio**, quiero configurar de antemano un catálogo de suplementos con motivo y precio (ej. "nudos severos +15€", "segunda mascota +15€/noche"), para no improvisar precios el día del servicio.
- **S4 (P0)** Como **comercio**, quiero seleccionar uno o varios suplementos preconfigurados al recibir al animal y ver el nuevo total calculado automáticamente, para solicitar el ajuste con un click.
- **S5 (P0)** Como **comercio**, quiero adjuntar una foto (evidencia) del estado del animal al llegar cuando solicito un ajuste de precio, para protegerme frente a reclamaciones.
- **S6 (P0)** Como **cliente**, quiero recibir una notificación con el motivo, el precio inicial y el nuevo precio cuando el comercio solicita un ajuste, y poder aceptarlo o rechazarlo con un botón.
- **S7 (P0)** Como **sistema**, quiero cobrar automáticamente la diferencia (segundo cargo) cuando el cliente acepta el ajuste, para completar el pago sin fricción manual.
- **S8 (P0)** Como **sistema**, quiero reembolsar el importe cobrado y cancelar el servicio automáticamente cuando el cliente rechaza el ajuste, para cumplir la promesa de "ningún coste sin aprobación previa".
- **S9 (P0)** Como **plataforma**, quiero recalcular mi comisión sobre el monto final ajustado (no solo el estimado inicial), para no perder ingresos en reservas con suplemento.
- **S10 (P1)** Como **cliente**, quiero ver en el detalle de mi reserva el desglose de suplementos aplicados con su motivo y evidencia, para entender por qué cambió el precio.
- **S11 (P1)** Como **admin**, quiero ver en el reporte financiero cuántas reservas tuvieron ajuste de precio y su impacto en el GMV/comisión, para detectar comercios con ajustes anómalamente frecuentes.

## Épica CP — Compatibilidad y recomendación por perfil del perro

- **CP1 (P1)** Como **cliente**, quiero que el buscador me muestre solo los servicios compatibles con mi perro (tamaño, tipo de pelo, temperamento…), para no perder tiempo viendo opciones que no aplican.
- **CP2 (P1)** Como **comercio**, quiero definir para cada servicio qué perfiles de perro son aptos (tamaño, tipo de pelo, comportamiento admitido), para que la plataforma filtre automáticamente.
- **CP3 (P1)** Como **cliente**, quiero recibir una recomendación automática de servicio según el motivo de consulta que indico (ej. adiestramiento: "agresividad hacia perros" → valoración individual, bloquea grupales), para no reservar algo inadecuado.
- **CP4 (P1)** Como **plataforma**, quiero bloquear la reserva directa de clases grupales cuando el motivo indicado es de riesgo (agresividad, reactividad severa) y exigir valoración previa, para proteger a otros perros/personas.

## Épica R — Reputación bidireccional

- **R1 (P1)** Como **comercio**, quiero valorar al perro/cliente tras completar el servicio (comportamiento, adaptación, aspectos específicos del vertical), además de que el cliente me valore a mí, para que el historial del perro se enriquezca con cada visita.
- **R2 (P1)** Como **cliente**, quiero ver el índice de comportamiento acumulado de mi perro (ej. "muy tranquila, puede quedarse sola, excelente comportamiento") en su ficha, para presentarlo con confianza a nuevos comercios.

## Épica PEL — Peluquería canina (enriquecimiento)

- **PEL1 (P1)** Como **peluquería**, quiero definir precio y duración distintos por tamaño de perro para cada servicio, para reflejar el coste real de cada caso.
- **PEL2 (P1)** Como **peluquería**, quiero marcar qué tipos de pelo son compatibles con cada servicio (ej. stripping solo pelo duro), para que Doogking bloquee combinaciones incorrectas automáticamente.
- **PEL3 (P1)** Como **peluquería**, quiero configurar suplementos automáticos según el estado del manto detectado (nudos leves/severos, rasurado necesario), para cobrar de forma justificada.
- **PEL4 (P1)** Como **peluquería**, quiero definir mi política ante perros de temperamento difícil (aceptar, cobrar suplemento, requerir valoración previa, o negarme y anular el trabajo), para gestionar el riesgo del servicio.
- **PEL5 (P1)** Como **cliente**, quiero que solo me pidan confirmar que las vacunas/microchip están al día (sin subir documentación), para agilizar la reserva.

## Épica RES — Residencias caninas (enriquecimiento)

- **RES1 (P1)** Como **residencia**, quiero activar únicamente los tipos de alojamiento que realmente ofrezco (individual, compartida, premium, climatizada, suites), sin que la plataforma dé por hecho que tengo todos, para reflejar mi oferta real.
- **RES2 (P1)** Como **residencia**, quiero decidir si el tamaño del perro es un criterio relevante en mi negocio o no, para no aplicar restricciones que no uso.
- **RES3 (P1)** Como **residencia**, quiero definir requisitos sanitarios como opcionales de exigir (puedo pedirlos o solo querer saberlo, sin bloquear la reserva), para ajustarme a mi política real.
- **RES4 (P1)** Como **residencia**, quiero configurar suplementos por día (alojamiento individual, medicación, paseo individual, perro reactivo, dieta especial), para reflejar el coste real de cuidados especiales.
- **RES5 (P1)** Como **residencia**, quiero marcar conductas no admitidas (agresividad, ansiedad extrema, escapista, destructor), para poder rechazar reservas de riesgo desde el filtro de compatibilidad.

## Épica ADI — Adiestramiento canino (enriquecimiento)

- **ADI1 (P1)** Como **centro de adiestramiento**, quiero seleccionar con un click qué servicios ofrezco de un catálogo amplio de técnicas (no numerado, con checkboxes), para configurar mi oferta rápidamente.
- **ADI2 (P1)** Como **cliente**, quiero rellenar un cuestionario de comportamiento (motivo, intensidad, historial, vínculo con el perro) al reservar una valoración, para que el profesional llegue preparado.
- **ADI3 (P1)** Como **cliente**, quiero subir vídeos opcionales del comportamiento de mi perro, para que el profesional entienda mejor el caso antes de la sesión.
- **ADI4 (P1)** Como **centro de adiestramiento**, quiero proponer un plan personalizado (bono de sesiones, curso, programa mixto) tras la valoración inicial, para que el cliente lo acepte y pague desde la plataforma.
- **ADI5 (P1)** Como **centro de adiestramiento**, quiero registrar tras cada sesión los objetivos trabajados, la evolución y las tareas para casa, para construir el historial de progreso del perro.

## Épica TRA — Transporte de animales (enriquecimiento)

- **TRA1 (P1)** Como **transportista**, quiero marcar claramente qué campos de mi formulario de configuración son obligatorios y cuáles opcionales, para reflejar que cada transportista trabaja de forma distinta.
- **TRA2 (P1)** Como **cliente**, quiero indicar el comportamiento de mi perro durante desplazamientos (se marea, ladra, ansiedad, necesita transportín), para que el transportista prepare el viaje adecuadamente.
- **TRA3 (P1)** Como **cliente**, quiero programar un transporte recurrente (ej. todos los lunes y miércoles a las 09:00), para trayectos habituales como guardería o rehabilitación veterinaria.
- **TRA4 (P1)** Como **cliente**, quiero reservar un trayecto de ida y vuelta con espera (ej. veterinario), como un único servicio.
- **TRA5 (P0)** Como **sistema**, quiero cancelar el servicio y reembolsar el importe automáticamente si el cliente rechaza el ajuste de precio en transporte, cumpliendo la política explícita de "sin aprobación, sin cargo".

## Épica VET — Servicio veterinario (enriquecimiento)

- **VET1 (P1)** Como **clínica veterinaria**, quiero marcar cada servicio como "precio cerrado" o "precio orientativo (desde X€)", para que la plataforma muestre la información correcta al cliente.
- **VET2 (P1)** Como **cliente**, quiero entender antes de pagar que la reserva cubre solo la consulta inicial y que pruebas/tratamientos adicionales se facturan directamente con la clínica fuera de la plataforma, para no tener sorpresas.
- **VET3 (P1)** Como **sistema**, quiero comisionar únicamente sobre el importe de la consulta inicial reservada (no sobre el total de la factura clínica), respetando el modelo económico especial de veterinaria.
- **VET4 (P1)** Como **cliente**, quiero recibir una recomendación de triaje automático según mis síntomas (reserva directa / consulta general / contactar urgencias inmediatamente vía Doogking), para actuar con la urgencia adecuada.
- **VET5 (P1)** Como **veterinario**, quiero volcar en el historial del perro (con autorización del propietario) vacunas, medicación, alergias, cirugías e informes tras cada consulta, incluyendo poder pegar un documento/Excel para agilizarlo, para construir su historia clínica compartida.
- **VET6 (P2)** Como **clínica veterinaria**, quiero atender especies distintas al perro (gatos, conejos, hurones, aves, exóticos) dentro del mismo flujo de reserva, para no limitar mi oferta real.

## Épica HOT — Hotel / alojamiento pet-friendly (vertical nuevo)

- **HOT1 (P1)** Como **hotel**, quiero configurar mi política de mascotas (admite o no, número máximo, tamaño permitido, razas restringidas, especies permitidas), para publicar correctamente mi oferta petfriendly.
- **HOT2 (P1)** Como **hotel**, quiero definir suplementos por mascota según tamaño y servicios extra (limpieza especial, segunda mascota), para cobrar de forma transparente.
- **HOT3 (P1)** Como **cliente**, quiero reservar alojamiento para mí condicionado a las características de mi mascota (no un servicio para el perro, sino habitación para personas que admite mascotas), para viajar con mi perro sin usar una plataforma distinta.
- **HOT4 (P1)** Como **hotel**, quiero solicitar un ajuste de precio si al llegar el número/tamaño de mascotas no coincide con lo declarado, siguiendo el mismo ciclo de suplemento-aprobación que el resto de verticales.
- **HOT5 (P2)** Como **cliente**, quiero reservar un paquete "Vacaciones completas Doogking" (hotel + guardería + peluquería + transporte al aeropuerto) desde una sola plataforma, para no coordinar varios proveedores por separado.
- **HOT6 (P1)** Como **hotel**, quiero valorar el comportamiento del perro tras la estancia (limpieza, ruido, sociabilidad, respeto del mobiliario) y que el cliente me valore en aspectos petfriendly, para construir reputación bidireccional específica de mascotas.

## Épica SEG — Vertical Seguros (nuevo, P2)

- **SEG1 (P2)** Como **aseguradora**, quiero configurar tipos de póliza (RC, gastos veterinarios, asistencia, robo/pérdida, fallecimiento, defensa jurídica, viaje, PPP, vida) con límites, carencias y franquicias, para publicar mi catálogo.
- **SEG2 (P2)** Como **cliente**, quiero contratar una póliza usando los datos ya existentes de la Ficha de mi perro (edad, raza, peso, historial), para no volver a rellenar todo desde cero.
- **SEG3 (P2)** Como **plataforma**, quiero recomendar un seguro adecuado al perfil del perro y calcular un "Índice de Bienestar Doogking" que dé descuentos por buen historial (vacunas al día, revisiones, adiestramiento), para diferenciarnos con datos propios.
- **SEG4 (P2)** Como **cliente**, quiero contratar un seguro temporal (vacaciones, viaje, evento), para cubrir necesidades puntuales sin permanencia anual.

## Épica COM — Módulo Comunidad "Explora con tu mascota" (nuevo, P2)

- **COM1 (P2)** Como **cliente**, quiero explorar en un mapa lugares pet-friendly cercanos (playas, parques, restaurantes) con fichas ricas (fotos, normativa, servicios, valoraciones), para planear salidas con mi perro.
- **COM2 (P2)** Como **cliente**, quiero subir fotos, valorar y reportar incidencias sobre lugares (ej. "la fuente no funciona"), para mantener la información útil y actualizada.
- **COM3 (P2)** Como **cliente**, quiero guardar lugares como favoritos y recibir recomendaciones personalizadas, para volver a entrar en la app aunque no vaya a reservar un servicio.

## Épica COMI — Modelo de comisiones (P2)

- **COMI1 (P2)** Como **admin**, quiero definir comisiones por tramo de importe (además de por vertical), para aplicar una política comercial uniforme y escalable.
- **COMI2 (P2)** Como **admin**, quiero marcar un comercio como "Socio Fundador" con comisión congelada durante 24 meses, para incentivar la adopción temprana de la plataforma.
- **COMI3 (P2)** Como **admin**, quiero dar de alta los verticales "paseadores" y "cuidadores a domicilio" con su propia comisión de lanzamiento, para ampliar el catálogo de servicios comisionables.
