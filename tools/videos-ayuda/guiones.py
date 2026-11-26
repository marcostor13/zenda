"""Guiones de los 18 vídeos de ayuda (castellano de España).

Cada escena tiene su locución y su imagen:
- `Web("clave")`: grabación real de la plataforma (ver capturas.py).
- `Clip("búsqueda")`: vídeo de Pexels sobre lo que se cuenta.
- `Foto("búsqueda")`: foto de Pexels con movimiento de cámara.
El rótulo es el titular corto que aparece en pantalla durante la escena.

Los textos describen la interfaz tal y como está: si cambia un botón, cambia aquí.
"""
from dataclasses import dataclass, field


@dataclass(frozen=True)
class Web:
    clave: str


@dataclass(frozen=True)
class Clip:
    consulta: str
    indice: int = 0


@dataclass(frozen=True)
class Foto:
    consulta: str
    indice: int = 0


@dataclass
class Escena:
    texto: str
    visual: Web | Clip | Foto
    rotulo: str | None = None


@dataclass
class Video:
    numero: int
    slug: str
    titulo: str
    grupo: str  # Usuarios · Comercios · Categorías
    escenas: list[Escena] = field(default_factory=list)
    musica: str = "tutorial"

    @property
    def nombre(self) -> str:
        return f"{self.numero:02d}-{self.slug}"


USUARIOS, COMERCIOS, CATEGORIAS = "Usuarios", "Comercios", "Categorías"

VIDEOS: list[Video] = [
    # ── Usuarios ────────────────────────────────────────────────────────────
    Video(1, "registrarte-en-doogking", "Registrarte en Doogking", USUARIOS, [
        Escena("¿Quieres darle a tu perro lo mejor, sin complicarte? Empieza por crear tu cuenta en Doogking. Es gratis, y tardas menos de un minuto.",
               Clip("woman using phone with dog on sofa"), "Tu cuenta, gratis"),
        Escena("Entra en doogking punto com y pulsa «Hazte una cuenta», arriba a la derecha.",
               Web("registro.inicio")),
        Escena("Escribe tu nombre completo, tu correo electrónico y una contraseña de al menos ocho caracteres. Después, pulsa «Crear cuenta».",
               Web("registro.formulario"), "Nombre, correo y contraseña"),
        Escena("Te enviamos un correo con un enlace de verificación. Ábrelo para activar tu cuenta. Y si no lo encuentras, échale un vistazo a la carpeta de spam.",
               Web("registro.verificar"), "Verifica tu correo"),
        Escena("¡Y listo, ya estás dentro! Desde «Mi cuenta» tienes a mano tu perfil, tus mascotas y tus reservas.",
               Web("registro.dentro")),
        Escena("Ahora, crea la ficha de tu perro y empieza a reservar. Doogking: todo para su rey, en un solo lugar.",
               Clip("happy dog running park")),
    ]),
    Video(2, "crear-la-ficha-de-tu-mascota", "Crear la ficha de tu mascota", USUARIOS, [
        Escena("La ficha de tu mascota es su carta de presentación. La rellenas una sola vez, y peluquerías, residencias y veterinarios adaptan el servicio a tu perro en cada reserva.",
               Clip("owner petting dog at home"), "Una ficha, todos los servicios"),
        Escena("Abre «Mi cuenta», entra en «Mis mascotas» y pulsa «Añadir mascota».",
               Web("mascota.inicio")),
        Escena("Empieza por lo básico: su foto, su nombre, la raza, la fecha de nacimiento, el peso y su ciudad. Si tiene microchip, también puedes añadirlo.",
               Web("mascota.basicos"), "Paso 1 · Datos básicos"),
        Escena("Después, cuéntanos cómo es: su tamaño, el tipo de pelo y cómo lo tiene ahora. A las peluquerías les ayuda muchísimo a prepararse.",
               Web("mascota.fisico"), "Físico y pelo"),
        Escena("Indica su carácter, cómo se lleva con otros perros y con las personas, y marca las vacunas que tiene puestas. Muchas residencias las piden para admitirlo.",
               Web("mascota.salud"), "Carácter y salud"),
        Escena("Por último, añade lo que deba saber un alojamiento y, si quieres, su cartilla o su pasaporte europeo. Guarda los cambios, ¡y su ficha ya está lista!",
               Web("mascota.guardar"), "Lista para reservar"),
        Escena("Y tranquilo: Doogking solo comparte sus datos con los profesionales que tú reservas.",
               Clip("dog sleeping peacefully")),
    ]),
    Video(3, "buscar-un-servicio", "Buscar un servicio", USUARIOS, [
        Escena("¿Necesitas una peluquería, un veterinario o alguien que cuide de tu perro este fin de semana? En Doogking lo encuentras en un momento.",
               Clip("woman laptop dog home"), "Encuéntralo en segundos"),
        Escena("En la página de inicio, elige el servicio que necesitas, escribe tu ciudad o tu zona, y pulsa «Buscar».",
               Web("buscar.inicio"), "Servicio + ciudad"),
        Escena("Verás los profesionales disponibles, con su valoración, su precio desde y todo lo que incluye cada uno.",
               Web("buscar.resultados")),
        Escena("Afina con los filtros: tu presupuesto, la valoración o extras como el servicio a domicilio. Y ordénalos por los mejor valorados o por precio.",
               Web("buscar.filtros"), "Filtra y ordena"),
        Escena("¿Prefieres verlo sobre el plano? Pulsa «Ver mapa» y descubre lo que tienes más cerca.",
               Web("buscar.mapa"), "Ver mapa"),
        Escena("Y si buscas otra cosa, cambia de categoría desde la barra de arriba: alojamiento, veterinarios, transporte, adiestramiento y mucho más.",
               Web("buscar.categorias")),
    ]),
    Video(4, "consultar-y-elegir-un-profesional", "Consultar y elegir un profesional", USUARIOS, [
        Escena("Antes de reservar, conoce bien a quién vas a confiar a tu perro.",
               Clip("veterinarian greeting dog"), "Elige con confianza"),
        Escena("Pulsa en cualquier profesional para abrir su ficha. Arriba tienes sus fotos, su valoración, la dirección, y el sello de profesional verificado.",
               Web("profesional.ficha"), "Profesional verificado"),
        Escena("Más abajo, la lista de servicios con su precio y su duración, para que sepas exactamente qué incluye cada uno.",
               Web("profesional.servicios"), "Precios claros"),
        Escena("Consulta qué ofrece, el horario en el que atiende y dónde está, en el mapa.",
               Web("profesional.detalles")),
        Escena("Lee las opiniones de otros dueños, y fíjate en la garantía Doogking: cancelación gratuita, confirmación inmediata y pago seguro.",
               Web("profesional.opiniones"), "Opiniones reales"),
        Escena("¿Te convence? Guárdalo en favoritos para tenerlo a mano, o pulsa «Reservar cita» y sigue adelante.",
               Web("profesional.reservar")),
    ]),
    Video(5, "hacer-una-reserva", "Hacer una reserva", USUARIOS, [
        Escena("Reservar en Doogking se hace en cuatro pasos. Te lo enseñamos con una cita en la peluquería.",
               Clip("dog grooming salon"), "Reserva en 4 pasos"),
        Escena("Primero, elige para qué perro es la reserva y el servicio que quieres. Después, escoge el día en el calendario y la hora que mejor te venga.",
               Web("reserva.cita"), "1 · Tu cita"),
        Escena("A la derecha, siempre a la vista, tienes el resumen del precio con el IVA incluido. Y si tienes un código de descuento, lo aplicas aquí.",
               Web("reserva.resumen"), "Sin cargos ocultos"),
        Escena("En el segundo paso, revisa tus datos de contacto, añade alguna petición especial si la tienes, y acepta las condiciones.",
               Web("reserva.datos"), "2 · Tus datos"),
        Escena("Llega el pago. Introduce tu tarjeta: el pago va cifrado con Stripe, y Doogking nunca guarda los datos de tu tarjeta.",
               Web("reserva.pago"), "3 · Pago seguro"),
        Escena("¡Reserva confirmada! Recibes tu código de reserva y la confirmación en tu correo. Así de fácil.",
               Web("reserva.confirmada"), "4 · ¡Confirmada!"),
    ]),
    Video(6, "consultar-el-estado-de-una-reserva", "Consultar el estado de una reserva", USUARIOS, [
        Escena("¿Quieres saber cómo va tu reserva? Lo tienes todo en un mismo sitio.",
               Clip("woman checking phone smiling dog"), "Tus reservas, al día"),
        Escena("Abre el menú de tu cuenta y entra en «Mis reservas». Aquí están todas, sea cual sea el servicio.",
               Web("estado.lista"), "Mis reservas"),
        Escena("Fíltralas por su estado: confirmadas, sin pagar, completadas o canceladas.",
               Web("estado.filtros")),
        Escena("Cada reserva tiene una línea de progreso que te dice en qué punto está: el pago, la confirmación, el servicio y tu valoración.",
               Web("estado.progreso"), "Sigue cada paso"),
        Escena("Pulsa «Ver detalle» para ver la fecha y la hora, el resumen del pago con el IVA desglosado, y el estado del cobro.",
               Web("estado.detalle"), "Todo el detalle"),
        Escena("Y si necesitas cancelar o tienes algún problema, lo gestionas desde aquí mismo, según la política del profesional.",
               Web("estado.acciones")),
    ]),
    # ── Comercios ───────────────────────────────────────────────────────────
    Video(7, "registrar-tu-negocio", "Registrar tu negocio", COMERCIOS, [
        Escena("¿Tienes una peluquería canina, una residencia o una clínica veterinaria? Con Doogking, los dueños de perros de tu zona te encuentran y reservan contigo online.",
               Clip("dog groomer working salon"), "Haz crecer tu negocio"),
        Escena("Entra en doogking punto com y pulsa «Registra tu empresa», en la cabecera.",
               Web("negocio.inicio")),
        Escena("Primero, elige qué servicios ofreces. Puedes marcar varias categorías: alojamiento, veterinaria, peluquería, adiestramiento, transporte… y pulsa «Continuar».",
               Web("negocio.categorias"), "Elige tus categorías"),
        Escena("Ahora, crea tu acceso: tu nombre, tu correo, un teléfono si quieres, y una contraseña. Pulsa «Crear mi negocio gratis».",
               Web("negocio.cuenta"), "Crear tu negocio es gratis"),
        Escena("Verifica tu correo con el enlace que te enviamos, y te llevamos directo a dar de alta tu primer servicio.",
               Web("negocio.alta"), "Verifica y empieza"),
        Escena("En unos minutos, tu negocio estará listo para recibir reservas.",
               Clip("happy dog owner shop counter")),
    ], musica="tutorial"),
    Video(8, "completar-la-ficha-de-tu-negocio", "Completar la ficha de tu negocio", COMERCIOS, [
        Escena("Una ficha completa transmite confianza, y recibe más reservas. Te contamos cómo dejarla perfecta.",
               Clip("small business owner laptop dog"), "Una ficha que vende"),
        Escena("En el inicio de tu panel verás qué te falta por completar. Pulsa «Completar datos».",
               Web("ficha.panel")),
        Escena("En «Tu negocio», escribe el nombre comercial, la razón social, tu CIF o NIF, y una buena descripción: cuenta qué te diferencia y qué incluye tu servicio.",
               Web("ficha.perfil"), "1 · Tu negocio"),
        Escena("Añade la persona de contacto, el correo, el teléfono y tu WhatsApp. Son datos internos: los usamos para avisarte.",
               Web("ficha.contacto")),
        Escena("En «Cómo cobras», marca las categorías en las que trabajas y añade tu cuenta bancaria: es donde recibirás tus liquidaciones.",
               Web("ficha.cobros"), "2 · Cómo cobras"),
        Escena("Y en «Avisos», elige qué te notificamos por correo: nuevas reservas, cancelaciones, reseñas y liquidaciones.",
               Web("ficha.avisos"), "3 · Avisos"),
    ]),
    Video(9, "publicar-tu-primer-servicio", "Publicar tu primer servicio", COMERCIOS, [
        Escena("Llega el momento de publicar tu primer servicio. Es un asistente guiado, y no se publica nada hasta que terminas.",
               Clip("dog groomer brushing dog"), "Tu primer servicio"),
        Escena("En «Mis servicios», pulsa «Nuevo servicio», elige la categoría y ponle un nombre que se entienda de un vistazo, con una buena descripción.",
               Web("servicio.categoria"), "Categoría y nombre"),
        Escena("Busca tu dirección para situarte en el mapa, y fija tu precio orientativo: es el «desde» que verán tus clientes.",
               Web("servicio.direccion"), "Dónde y cuánto"),
        Escena("Marca tu horario: rellena el lunes y cópialo a toda la semana. Los festivos y las vacaciones los cierras en «Días especiales».",
               Web("servicio.horario"), "Tu horario"),
        Escena("En los detalles, añade cada servicio con su precio y su duración, y sube al menos cinco fotos. Aquí, la foto es tu escaparate.",
               Web("servicio.detalles"), "Mínimo 5 fotos"),
        Escena("Termina el asistente, y tu servicio aparecerá publicado en Doogking, listo para recibir reservas.",
               Web("servicio.publicado"), "¡Publicado!"),
    ]),
    Video(10, "recibir-y-gestionar-una-reserva", "Recibir y gestionar una reserva", COMERCIOS, [
        Escena("¡Tienes una reserva nueva! Te avisamos por correo, y la ves al momento en tu panel.",
               Clip("woman receiving notification phone smiling"), "Nueva reserva"),
        Escena("En el inicio del panel tienes las reservas recientes, tus ingresos del mes y un resumen financiero con lo que vas a recibir.",
               Web("gestion.panel"), "Tu negocio de un vistazo"),
        Escena("En «Reservas» llevas el día a día: las de hoy, las pendientes de confirmar y las próximas, con filtros por fecha y por estado.",
               Web("gestion.lista"), "Reservas"),
        Escena("Pulsa «Ver reserva» para saber quién viene, con qué mascota, a qué hora y por qué importe.",
               Web("gestion.detalle")),
        Escena("Desde «Gestionar», márcala como completada al terminar, solicita un ajuste si hace falta, o registra el servicio en el historial de la mascota.",
               Web("gestion.acciones"), "Gestionar"),
        Escena("Y en la «Agenda» ves tu semana de un vistazo, y bloqueas los tramos en los que no puedes atender.",
               Web("gestion.agenda"), "Agenda"),
    ]),
    # ── Categorías (vídeos cortos) ──────────────────────────────────────────
    Video(11, "peluqueria", "Peluquería canina", CATEGORIAS, [
        Escena("Baño, corte de raza, deslanado, uñas o un spa completo.", Clip("dog grooming salon"), "Peluquería canina"),
        Escena("En Doogking encuentras peluquerías caninas cerca de ti, comparas precios y opiniones…", Web("cat.peluqueria")),
        Escena("…y reservas tu cita, con día y hora, en un minuto.", Web("cat.peluqueria.ficha")),
        Escena("Porque también merece verse y sentirse increíble.", Clip("fluffy dog after grooming happy")),
    ], musica="categoria"),
    Video(12, "residencia-y-guarderia", "Residencia y guardería", CATEGORIAS, [
        Escena("¿Te vas de viaje, o pasas el día fuera?", Clip("dogs playing daycare"), "Residencia y guardería"),
        Escena("Encuentra residencias y guarderías caninas con paseos, zonas de juego y cámaras las veinticuatro horas.", Web("cat.alojamiento")),
        Escena("Elige tus fechas de entrada y salida, compara, y reserva con total tranquilidad.", Web("cat.alojamiento.ficha")),
        Escena("Un lugar seguro mientras tú no estás.", Clip("dog sleeping cozy bed")),
    ], musica="categoria"),
    Video(13, "adiestramiento", "Adiestramiento canino", CATEGORIAS, [
        Escena("Obediencia, educación de cachorros o modificación de conducta.", Clip("dog training obedience"), "Adiestramiento"),
        Escena("Encuentra adiestradores profesionales, en su centro o a domicilio.", Web("cat.adiestramiento")),
        Escena("Reserva sesiones sueltas o programas completos, y mira cómo progresa tu perro.", Clip("puppy training treat")),
    ], musica="categoria"),
    Video(14, "transporte", "Transporte de mascotas", CATEGORIAS, [
        Escena("¿Tienes que llevar a tu perro al veterinario, al aeropuerto o a su nueva casa?", Clip("dog in car window"), "Transporte de mascotas"),
        Escena("Cuéntanos el viaje: origen, destino y fecha. Te enseñamos el precio final de cada transportista.", Web("cat.transporte")),
        Escena("Vehículos acondicionados y profesionales verificados, para que viaje cómodo y seguro.", Clip("dog travel car backseat")),
    ], musica="categoria"),
    Video(15, "veterinaria", "Veterinaria", CATEGORIAS, [
        Escena("Consultas, vacunas, revisiones y urgencias.", Clip("veterinarian examining dog"), "Veterinaria"),
        Escena("Encuentra clínicas veterinarias cerca de ti y compara su valoración y sus precios.", Web("cat.veterinaria")),
        Escena("Reserva tu cita con día y hora, sin llamadas ni esperas.", Clip("veterinarian puppy clinic")),
    ], musica="categoria"),
    Video(16, "hoteles-pet-friendly", "Hoteles pet-friendly", CATEGORIAS, [
        Escena("Viajar juntos también es parte del plan.", Clip("woman traveling with dog"), "Hoteles pet-friendly"),
        Escena("Descubre hoteles que reciben a tu perro con los brazos abiertos…", Web("cat.hoteles")),
        Escena("…y reserva una escapada para los dos.", Clip("dog hotel bed travel")),
    ], musica="categoria"),
    Video(17, "seguros-para-mascotas", "Seguros para mascotas", CATEGORIAS, [
        Escena("Tranquilidad para lo que no se puede prever.", Clip("family with dog home"), "Seguros para mascotas"),
        Escena("Compara seguros para tu perro: responsabilidad civil, gastos veterinarios por accidente o enfermedad, y asistencia.", Web("cat.seguros")),
        Escena("Elige el que mejor os encaja y contrátalo online, en unos minutos.", Clip("happy dog owner hug")),
    ], musica="categoria"),
    Video(18, "explora", "Explora con tu mascota", CATEGORIAS, [
        Escena("Playas caninas, parques, rutas y restaurantes donde tu perro es bienvenido.", Clip("dog running beach"), "Explora"),
        Escena("En «Explora con tu mascota» descubres los mejores sitios dog friendly cerca de ti.", Web("cat.explora")),
        Escena("Filtra por tipo de lugar, míralos en el mapa… y a disfrutar juntos.", Web("cat.explora.mapa")),
        Escena("Porque los mejores planes, son con él.", Clip("dog hiking mountain owner")),
    ], musica="categoria"),
]


def por_numero(numero: int) -> Video:
    return next(v for v in VIDEOS if v.numero == numero)
