# Auditoría técnica SEO y experiencia de usuario
**Doogking - Revisión final de septiembre de 2026**

## Alcance de la revisión
Este informe revisa el estado de Doogking.com con acceso de administrador, porque en este momento la web completa no está abierta al público general. Se han comprobado la portada, las categorías principales, la sección *Explora con tu mascota*, una ficha de detalle, una URL inexistente y el panel administrativo visible con la cuenta facilitada.

La revisión se centra en lo que puede afectar al lanzamiento: que Google y redes sociales puedan entender el contenido, que el usuario encuentre el servicio adecuado, que la web cumpla con los avisos necesarios y que no se muestren detalles internos o mensajes confusos.

**Importante:** algunas categorías no tienen comercios cargados todavía. Ese estado se considera normal en esta fase y no se trata como incidencia en este informe.

## Resumen ejecutivo
Doogking ya tiene una base funcional y visual avanzada. La portada comunica bien la propuesta, las categorías principales están creadas, el panel de administración muestra datos reales de gestión y la sección *Explora* contiene 24 lugares publicados. También hay aspectos positivos: las páginas legales existen, algunas imágenes ya tienen textos descriptivos y las categorías adaptan parte de sus campos al tipo de servicio.

Antes de abrir la web al público conviene resolver varios puntos importantes. Los más urgentes son completar los elementos básicos de SEO y vista previa social, activar un consentimiento de cookies si se usan herramientas no esenciales, preparar una página 404 clara y retirar detalles internos visibles en las fichas.

La recomendación principal es hacer una ronda de cierre antes del lanzamiento: completar SEO básico, revisar cookies, retirar datos internos visibles, ajustar el buscador de portada y mejorar las fichas de Explora.

---

## Prioridad alta

### 1. Falta preparar las páginas para Google y redes sociales
La portada, las categorías y la ficha revisada mantienen el mismo título de navegador y la misma descripción general. No se encontraron etiquetas específicas para compartir en redes, URL canónica ni datos estructurados en las páginas revisadas.

*   **En lenguaje sencillo:** cuando alguien comparta una ficha o una categoría, la vista previa puede salir genérica o pobre. Para Google, varias páginas pueden parecer demasiado parecidas entre sí.
*   **Recomendación:** crear títulos y descripciones propios para cada categoría y cada ficha. En las fichas de *Explora*, incluir también una imagen, una descripción corta y datos del lugar para que Google y redes sociales entiendan mejor cada página.

### 2. No se ha visto un aviso de cookies o consentimiento
Durante la revisión no apareció ningún banner o panel de consentimiento de cookies. La web sí incluye una página de política de cookies, pero no se vio el mecanismo que permite aceptar, rechazar o configurar cookies antes de usarlas.

*   **Por qué importa:** si la web utiliza cookies no esenciales, herramientas de login social, medición, publicidad o seguimiento, el usuario debe poder decidir antes. Esto es especialmente importante antes de abrir la web al público.
*   **Recomendación:** instalar o activar un sistema de consentimiento claro, con opciones de aceptar, rechazar y configurar. También conviene comprobar que no se cargan herramientas no esenciales hasta que el usuario las acepte.

### 3. La web no muestra una página 404 clara
Al probar una dirección inexistente, la web no mostró una página clara de página no encontrada.

*   **Por qué importa:** si una dirección está mal escrita o un enlace antiguo ya no existe, el usuario necesita una salida clara. Google también necesita entender que esa página no existe.
*   **Recomendación:** crear una página 404 sencilla, con mensaje claro, enlace a la portada y buscador o accesos a categorías. La respuesta del servidor debe indicar correctamente que la página no existe.

### 4. Hay datos internos visibles en una ficha pública
En la ficha revisada de *Explora* aparece el texto `municipios_final.xlsx` dentro del bloque *Qué vas a encontrar*, como fuente del contenido.

*   **Por qué importa:** el cliente final no necesita ver nombres de archivos internos. Da sensación de borrador o de información importada sin revisar.
*   **Recomendación:** ocultar ese campo o sustituirlo por una referencia comprensible, por ejemplo "Fuente: información revisada por Doogking", si realmente se quiere mostrar el origen.

---

## Prioridad media

### 5. El buscador de la portada empieza con campos de alojamiento
El buscador principal de la portada muestra por defecto ingreso y salida, que encajan con alojamiento, pero no con servicios como veterinarios, peluquería, transporte o crematorios.

*   **Por qué importa:** un usuario que busque veterinario o peluquería puede no entender por qué se le piden fechas de entrada y salida.
*   **Recomendación:** pedir primero el tipo de servicio, o abrir por defecto la búsqueda con IA, que acepta una frase natural como "Veterinario en Barcelona para vacunación".

### 6. Algunas categorías están bien adaptadas, pero no todas transmiten el mismo cuidado
Veterinaria y peluquería muestran campos más adecuados, como fecha de la cita y hora. En crematorios, sin embargo, se sigue usando el selector de mascota como "1 perro", con un estilo de contador que resulta frío para el tono de esa categoría. 

*   **Recomendación:** adaptar el lenguaje de Crematorios con más sensibilidad. Por ejemplo, usar "¿Para qué mascota necesitas el servicio?" sin contador visible, o un selector más discreto.

### 7. Explora utiliza URLs con identificadores internos
Las fichas de *Explora* usan direcciones como `/explora/6a8451c2756a745fe5e230eb`. Funcionan, pero no son fáciles de leer ni de recordar.

*   **Por qué importa:** una URL clara genera más confianza y ayuda a entender el contenido antes de abrirlo.
*   **Recomendación:** crear direcciones legibles, por ejemplo `/explora/rio-jucar-riola`. Si ya existen enlaces antiguos, mantenerlos con redirección a la nueva dirección.

### 8. Varias imágenes son de ejemplo y se repiten
En *Explora* se ven varias fichas con fotografías de banco de imágenes repetidas o muy similares. La propia ficha indica "Imagen de ambiente", lo cual es honesto, pero refuerza la sensación de contenido provisional.

*   **Recomendación:** priorizar fotografías reales en las fichas principales y mantener las imágenes genéricas solo como apoyo temporal.

### 9. El contenido de Explora es útil, pero aún muy parecido entre fichas
Las 24 fichas publicadas aportan nombre, municipio, provincia y una descripción breve. Aun así, muchas siguen una estructura muy repetida y no tienen opiniones de la comunidad.

*   **Recomendación:** enriquecer primero las fichas más importantes con información específica: acceso, mejor momento para ir, normas locales, si hay sombra, agua, aparcamiento o restricciones para perros.

### 10. Faltan textos alternativos en imágenes importantes
La ficha revisada tenía la imagen principal sin texto alternativo, aunque en el listado esa misma imagen sí aparecía con un texto descriptivo. El logotipo también aparece en algunos casos con texto vacío.

*   **Por qué importa:** estos textos ayudan a personas que usan lectores de pantalla y también aportan claridad a buscadores.
*   **Recomendación:** usar textos simples y descriptivos en las imágenes principales. Por ejemplo: "Río Júcar a su paso por Riola".

---

## Prioridad baja

### 11. Navegación entre categorías mejorable
La cabecera incluye logotipo, idioma, moneda, ayuda, panel admin y cuenta, pero no un menú directo con las categorías principales. Para cambiar de veterinarios a peluquerías, el usuario suele tener que volver a la portada o usar el pie de página.

*   **Recomendación:** añadir un acceso de categorías o un menú sencillo, especialmente en escritorio. En móvil puede resolverse con un menú desplegable claro.

### 12. Enlaces sociales sin texto visible
Los iconos sociales del pie aparecen como botones visuales, pero algunos enlaces no aportan texto visible en la lectura automática de la página. 

*   **Recomendación:** asegurar que cada icono tenga una etiqueta accesible, por ejemplo "Instagram de Doogking", "Facebook de Doogking" o "Tik Tok de Doogking".

### 13. Demasiado código invisible generado en la página
La revisión encontró muchos comentarios HTML invisibles en varias páginas. Esto no lo ve el usuario, pero aumenta el tamaño de la página y puede hacerla menos eficiente.

*   **Recomendación:** revisar los componentes compartidos, especialmente los iconos, para reducir código que no aporta nada visual. No es una urgencia de lanzamiento, pero conviene limpiarlo.

---

## Puntos del informe anterior que se corrigen o matizan

| Punto | Acción | Detalles |
| :--- | :--- | :--- |
| **Categorías en plural** | Matizar | La web enlaza a `/veterinaria` y `/peluqueria`, no a `/veterinarios` y `/peluquerias`. El informe final usa las rutas correctas. |
| **Secciones sin comercios** | Eliminar como incidencia | Es normal que no haya resultados si todavía no hay alojamientos, veterinarias ni comercios cargados. |
| **Cifras de portada** | Eliminar | Las cifras actuales están a modo de demostración. En producción se sustituirán por datos reales. Con cuenta de administrador se ve el panel admin. |
| **Área de cliente** | Pendiente | Para validar perfil, reservas y mascotas hace falta una cuenta de cliente real. |

---

## Tabla de prioridades recomendada

| Prioridad | Tarea | Motivo | Cuándo |
| :--- | :--- | :--- | :--- |
| **Alta** | SEO básico y vista previa social | Las páginas se ven genéricas para Google y redes. | Antes de abrir la web |
| **Alta** | Consentimiento de cookies | Riesgo legal si se usan cookies no esenciales. | Antes de abrir la web |
| **Alta** | Página 404 real | Evita confusión y errores de indexación. | Antes de abrir la web |
| **Alta** | Fuente interna visible | Da imagen de borrador. | Antes de abrir la web |
| **Media** | Buscador de portada | Empieza con campos de alojamiento aunque el usuario busque otro servicio. | Antes de campañas |
| **Media** | Crematorios | Necesita un tono más sensible en los campos de búsqueda. | Antes de campañas |
| **Media** | URLs legibles en Explora | Mejora confianza y SEO. | Durante preparación SEO |
| **Media** | Imágenes y contenido real | Reduce sensación de contenido provisional. | Durante carga de contenidos |
| **Media** | Textos alternativos | Mejora accesibilidad y comprensión. | Durante carga de contenidos |
| **Baja** | Menú de categorías | Facilita navegar entre servicios. | Mejora posterior |
| **Baja** | Código invisible sobrante | Optimiza peso y mantenimiento. | Mejora técnica posterior |

---

## Resumen final para el cliente
Doogking está cerca de poder presentarse como una plataforma completa, pero todavía necesita una ronda de cierre antes de su apertura pública. La prioridad no es añadir más secciones, sino asegurar que las que ya existen se entienden bien al compartirlas, cumplen con cookies, tienen contenido cuidado y no muestran detalles internos.

Si se corrigen los puntos de prioridad alta, la web ganará fiabilidad y transmitirá una imagen mucho más profesional. Después, las mejoras de contenido, URLs, buscador y fotografías ayudarán a que el sitio convierta mejor y tenga más recorrido en Google.