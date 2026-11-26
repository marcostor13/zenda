"""Grabaciones reales de la web para cada escena `Web(...)` de los guiones.

Cada captura prepara la pantalla fuera de cámara y graba sólo lo que se cuenta
(`with grabar():`). Corren contra la web y el API locales, con la base local
`doogking-videos`; bd.py borra entre tomas lo que deja cada formulario.
"""
import re
from pathlib import Path

import bd
from comun import BASE_WEB, CACHE, LOG_API
from flujos import bajar, datos_contacto, elegir_cita, escribir, ir, pagar_con_tarjeta, pausa
from grabador import acercar, alejar, clic, mover_a

CAPTURAS: dict[str, tuple[str | None, callable]] = {}
SESIONES = CACHE / "sesiones"

FICHA_GUAU = "/peluqueria/peluqueria-guau-salamanca-madrid"
EMAIL_REGISTRO = "lucia.martin@ejemplo.com"
EMAIL_NEGOCIO = "carmen@ejemplo.com"


def captura(clave: str, sesion: str | None = "cliente"):
    def registrar(funcion):
        CAPTURAS[clave] = (sesion, funcion)
        return funcion
    return registrar


def enlace_verificacion(email: str) -> str:
    """Sin correo configurado, el API local deja el enlace en su log."""
    log = Path(LOG_API).read_text(encoding="utf-8", errors="ignore")
    enlaces = re.findall(rf"para {re.escape(email)}: (http://localhost:4200/auth/verificar\?token=[0-9a-f]+)", log)
    if not enlaces:
        raise RuntimeError(f"No hay enlace de verificación para {email} en {LOG_API}")
    return enlaces[-1]


def texto(pagina, contenido: str, exacto: bool = True):
    return pagina.get_by_text(contenido, exact=exacto).first


# ── 1 · Registro ─────────────────────────────────────────────────────────────
@captura("registro.inicio", sesion=None)
def _(pg, grabar):
    ir(pg, "/")
    pg.mouse.move(467, 400)
    with grabar():
        pausa(pg, 1200)
        clic(pg, pg.get_by_role("link", name="Hazte una cuenta").or_(pg.get_by_role("button", name="Hazte una cuenta")).first)
        pg.wait_for_url("**/auth/registro**")
        pausa(pg, 1800)


@captura("registro.formulario", sesion=None)
def _(pg, grabar):
    bd.borrar_usuario(EMAIL_REGISTRO)
    ir(pg, "/auth/registro")
    pg.mouse.move(640, 267)
    with grabar():
        pausa(pg, 600)
        escribir(pg.get_by_label("Nombre completo"), "Lucía Martín")
        escribir(pg.get_by_label("Correo electrónico"), EMAIL_REGISTRO, 40)
        escribir(pg.get_by_label("Contraseña"), "Rocky2026!", 70)
        pausa(pg, 500)
        clic(pg, pg.get_by_role("button", name="Crear cuenta"))
        texto(pg, "Verifica tu correo").wait_for()
        pausa(pg, 1200)


@captura("registro.verificar", sesion=None)
def _(pg, grabar):
    ir(pg, "/auth/registro")
    pg.get_by_label("Nombre completo").fill("Lucía Martín")
    pg.get_by_label("Correo electrónico").fill(EMAIL_REGISTRO)
    pg.get_by_label("Contraseña").fill("Rocky2026!")
    bd.borrar_usuario(EMAIL_REGISTRO)
    pg.get_by_role("button", name="Crear cuenta").click()
    texto(pg, "Verifica tu correo").wait_for()
    pg.mouse.move(867, 533)
    with grabar():
        pausa(pg, 900)
        acercar(pg, pg.get_by_text("Te enviamos un enlace de verificación", exact=False).first, 1.6)
        pausa(pg, 2200)
        alejar(pg)
        mover_a(pg, pg.get_by_role("button", name="Reenviar correo"))
        pausa(pg, 1500)


@captura("registro.dentro", sesion=None)
def _(pg, grabar):
    enlace = enlace_verificacion(EMAIL_REGISTRO)
    ir(pg, "/auth/login")
    with grabar():
        pg.goto(enlace, wait_until="networkidle")
        pausa(pg, 1800)
        clic(pg, pg.get_by_role("button", name="Mi cuenta"))
        pausa(pg, 800)
        for opcion in ("Mis mascotas", "Mis reservas", "Mi perfil"):
            mover_a(pg, pg.get_by_role("link", name=re.compile(opcion)).first, 14)
            pausa(pg, 500)
        pausa(pg, 900)


# ── 2 · Ficha de la mascota ──────────────────────────────────────────────────
def _paso_basico(pg, lento: bool) -> None:
    rellenar = (lambda sel, t: escribir(pg.locator(sel), t, 60)) if lento else (lambda sel, t: pg.locator(sel).fill(t))
    rellenar("[formcontrolname=nombre]", "Luna")
    rellenar("[formcontrolname=raza]", "Border Collie")
    pg.locator("[formcontrolname=fechaNacimiento]").fill("2023-05-02")
    rellenar("[formcontrolname=peso]", "17")
    pg.locator("[formcontrolname=sexo]").select_option(label="Hembra")
    rellenar("[formcontrolname=ciudad]", "Madrid")


def _siguiente(pg, ms: int = 900) -> None:
    pg.get_by_role("button", name="Siguiente").click()
    pausa(pg, ms)


def _mascota_hasta(pg, paso: int) -> None:
    bd.borrar_perros("Luna")
    ir(pg, "/perros/nuevo")
    _paso_basico(pg, lento=False)
    for _ in range(paso - 1):
        _siguiente(pg, 700)
    pg.mouse.move(1000, 200)


@captura("mascota.inicio")
def _(pg, grabar):
    bd.borrar_perros("Luna")
    ir(pg, "/")
    pg.mouse.move(800, 333)
    with grabar():
        pausa(pg, 600)
        clic(pg, pg.get_by_role("button", name="Mi cuenta"))
        clic(pg, pg.get_by_role("link", name=re.compile("Mis mascotas")).first)
        pg.wait_for_url("**/perros")
        pausa(pg, 1300)
        clic(pg, pg.get_by_role("link", name="Añadir mascota").or_(pg.get_by_role("button", name="Añadir mascota")).first)
        pausa(pg, 1600)


@captura("mascota.basicos")
def _(pg, grabar):
    bd.borrar_perros("Luna")
    ir(pg, "/perros/nuevo")
    pg.mouse.move(1000, 200)
    with grabar():
        pausa(pg, 500)
        bajar(pg, 380)
        mover_a(pg, pg.locator("rs-image-upload").first)
        pausa(pg, 500)
        _paso_basico(pg, lento=True)
        mover_a(pg, pg.locator("[formcontrolname=microchip]"))
        pausa(pg, 900)
    bd.borrar_perros("Luna")


@captura("mascota.fisico")
def _(pg, grabar):
    _mascota_hasta(pg, 2)
    with grabar():
        pausa(pg, 500)
        for campo, valor in (("tamano", "Mediano (10-25 kg)"), ("tipoManto", "Largo"), ("estadoManto", "En muda (suelta mucho pelo)")):
            selector = pg.locator(f"[formcontrolname={campo}]")
            mover_a(pg, selector)
            selector.select_option(label=valor)
            pausa(pg, 700)
        pausa(pg, 600)
    bd.borrar_perros("Luna")


@captura("mascota.salud")
def _(pg, grabar):
    _mascota_hasta(pg, 3)
    with grabar():
        pausa(pg, 400)
        for opcion in ("Activo", "Sociable"):
            clic(pg, texto(pg, opcion), 250)
        clic(pg, pg.get_by_text("Alta", exact=True).nth(0), 250)
        clic(pg, pg.get_by_text("Alta", exact=True).nth(1), 250)
        _siguiente(pg, 900)
        for vacuna in ("Tetravalente", "Antirrábica", "Leishmania"):
            clic(pg, texto(pg, vacuna), 250)
        pausa(pg, 700)
    bd.borrar_perros("Luna")


@captura("mascota.guardar")
def _(pg, grabar):
    _mascota_hasta(pg, 5)
    with grabar():
        pausa(pg, 400)
        clic(pg, texto(pg, "¡Es muy bueno! No da ningún problema"), 300)
        clic(pg, pg.get_by_role("button", name="Siguiente"), 700)
        bajar(pg, 300)
        clic(pg, pg.get_by_role("button", name="Guardar cambios"))
        pg.wait_for_url("**/perros")
        pausa(pg, 1200)
        acercar(pg, pg.get_by_text("Luna", exact=True).first, 1.35)
        pausa(pg, 1600)
        alejar(pg)


# ── 3 · Buscar ──────────────────────────────────────────────────────────────
RESULTADOS_PELU = "/peluqueria?ciudad=Madrid&perros=1"


@captura("buscar.inicio")
def _(pg, grabar):
    ir(pg, "/")
    pg.mouse.move(800, 200)
    with grabar():
        pausa(pg, 500)
        categoria = pg.locator("select").first
        mover_a(pg, categoria)
        categoria.select_option(label="Peluquería")
        pausa(pg, 600)
        ciudad = pg.get_by_placeholder("Ciudad, zona o dirección").first
        mover_a(pg, ciudad)
        escribir(ciudad, "Madrid", 110)
        pausa(pg, 1300)
        clic(pg, pg.locator("li.pa__item").filter(has_text="Madrid").first)
        clic(pg, pg.get_by_role("button", name="Buscar", exact=True))
        pg.wait_for_url("**/peluqueria**")
        pausa(pg, 1800)


@captura("buscar.resultados")
def _(pg, grabar):
    ir(pg, RESULTADOS_PELU)
    pg.mouse.move(1000, 467)
    with grabar():
        pausa(pg, 500)
        bajar(pg, 330, 16, 50)
        for nombre in ("Peluquería Guau Salamanca", "Dog Groom Chueca"):
            mover_a(pg, pg.get_by_text(nombre, exact=True).first)
            pausa(pg, 700)
        bajar(pg, 300, 16, 50)
        pausa(pg, 800)


@captura("buscar.filtros")
def _(pg, grabar):
    ir(pg, RESULTADOS_PELU)
    bajar(pg, 250, 4, 20)
    pg.mouse.move(1000, 467)
    with grabar():
        pausa(pg, 400)
        mover_a(pg, pg.locator("input[type=range]").first)
        pausa(pg, 500)
        clic(pg, texto(pg, "4.0+", exacto=False), 1000)
        orden = pg.locator("select.ls__orden-sel")
        mover_a(pg, pg.locator(".ls__orden-txt"))
        pausa(pg, 400)
        orden.select_option(value="valoracion")
        pausa(pg, 1600)


@captura("buscar.mapa")
def _(pg, grabar):
    ir(pg, RESULTADOS_PELU)
    pg.mouse.move(1000, 400)
    with grabar():
        pausa(pg, 400)
        clic(pg, pg.get_by_role("button", name="Ver mapa"))
        pausa(pg, 3500)


@captura("buscar.categorias")
def _(pg, grabar):
    ir(pg, RESULTADOS_PELU)
    pg.mouse.move(800, 400)
    with grabar():
        pausa(pg, 300)
        for categoria in ("Veterinarios", "Alojamiento canino", "Adiestramiento"):
            clic(pg, pg.get_by_role("link", name=categoria).or_(pg.get_by_role("button", name=categoria)).first)
            pausa(pg, 1500)


# ── 4 · Elegir profesional ──────────────────────────────────────────────────
@captura("profesional.ficha")
def _(pg, grabar):
    ir(pg, RESULTADOS_PELU)
    pg.mouse.move(933, 400)
    with grabar():
        pausa(pg, 400)
        clic(pg, pg.get_by_text("Peluquería Guau Salamanca", exact=True).first)
        pg.wait_for_url("**/peluqueria/peluqueria-guau-salamanca**")
        pausa(pg, 1500)
        acercar(pg, pg.get_by_text("PROFESIONAL VERIFICADO", exact=False).first, 1.6)
        pausa(pg, 1700)
        alejar(pg)


@captura("profesional.servicios")
def _(pg, grabar):
    ir(pg, FICHA_GUAU)
    pg.mouse.move(1000, 333)
    with grabar():
        pausa(pg, 300)
        objetivo = texto(pg, "Servicios de peluquería")
        objetivo.scroll_into_view_if_needed()
        pausa(pg, 600)
        for servicio in ("Baño completo", "Corte de raza", "Spa premium"):
            mover_a(pg, texto(pg, servicio))
            pausa(pg, 600)
        acercar(pg, texto(pg, "Corte de raza"), 1.5)
        pausa(pg, 1500)
        alejar(pg)


@captura("profesional.detalles")
def _(pg, grabar):
    ir(pg, FICHA_GUAU)
    texto(pg, "Servicios de peluquería").scroll_into_view_if_needed()
    pg.mouse.move(1000, 333)
    with grabar():
        for seccion in ("Sobre este servicio", "¿Qué ofrece este salón?", "Cómo llegar"):
            elemento = texto(pg, seccion)
            elemento.scroll_into_view_if_needed()
            mover_a(pg, elemento)
            pausa(pg, 1300)


@captura("profesional.opiniones")
def _(pg, grabar):
    ir(pg, FICHA_GUAU)
    texto(pg, "¿Qué ofrece este salón?").scroll_into_view_if_needed()
    pg.mouse.move(1000, 333)
    with grabar():
        bajar(pg, 500, 16, 50)
        opiniones = texto(pg, "Lo que opinan otros dueños")
        opiniones.scroll_into_view_if_needed()
        pausa(pg, 800)
        mover_a(pg, texto(pg, "Marta G.").or_(texto(pg, "Ana L.")).first)
        pausa(pg, 1000)
        garantia = texto(pg, "Garantía Doogking")
        garantia.scroll_into_view_if_needed()
        acercar(pg, garantia, 1.4)
        pausa(pg, 1800)
        alejar(pg)


@captura("profesional.reservar")
def _(pg, grabar):
    ir(pg, FICHA_GUAU)
    pg.mouse.move(533, 400)
    with grabar():
        pausa(pg, 400)
        clic(pg, texto(pg, "Guardar en favoritos"), 900)
        mover_a(pg, pg.get_by_role("button", name="Reservar cita").first)
        pausa(pg, 600)
        clic(pg, pg.get_by_role("button", name="Reservar cita").first)
        pausa(pg, 2200)


# ── 5 · Reservar ────────────────────────────────────────────────────────────
def _abrir_reserva(pg) -> None:
    bd.borrar_reservas_pendientes()
    bd.borrar_perros("Luna")
    ir(pg, FICHA_GUAU)
    pg.get_by_role("button", name="Reservar cita").first.click()
    pausa(pg, 2500)


def _hora_libre(pg) -> str:
    """Primera hora libre del día elegido: cada toma gasta una cita."""
    return pg.locator("dk-selector-citas button[role=radio]:not([disabled])").first.inner_text().strip()


@captura("reserva.cita")
def _(pg, grabar):
    _abrir_reserva(pg)
    pg.mouse.move(1000, 267)
    with grabar():
        pausa(pg, 400)
        clic(pg, pg.get_by_role("button", name=re.compile("^Rocky")).first, 500)
        servicio = pg.locator("[formcontrolname=servicio]")
        mover_a(pg, servicio)
        servicio.select_option(index=1)
        pausa(pg, 700)
        clic(pg, pg.locator("[data-testid=atajo-primera-cita]"), 900)
        hora = pg.locator("dk-selector-citas button[role=radio]:not([disabled])").nth(1)
        clic(pg, hora, 700)
        mover_a(pg, pg.get_by_role("button", name="Continuar → Tus datos"))
        pausa(pg, 900)


@captura("reserva.resumen")
def _(pg, grabar):
    _abrir_reserva(pg)
    elegir_cita(pg, _hora_libre_tras_atajo(pg))
    pg.mouse.move(467, 333)
    with grabar():
        pausa(pg, 400)
        resumen = texto(pg, "Resumen de precio")
        acercar(pg, resumen, 1.45)
        pausa(pg, 1400)
        alejar(pg)
        clic(pg, pg.get_by_placeholder(re.compile("descuento", re.I)).first, 300)
        escribir(pg.get_by_placeholder(re.compile("descuento", re.I)).first, "BIENVENIDA", 90)
        mover_a(pg, pg.get_by_role("button", name="Aplicar"))
        pausa(pg, 900)
        pg.get_by_placeholder(re.compile("descuento", re.I)).first.fill("")


def _hora_libre_tras_atajo(pg) -> str:
    pg.locator("[data-testid=atajo-primera-cita]").click()
    pausa(pg, 900)
    return _hora_libre(pg)


@captura("reserva.datos")
def _(pg, grabar):
    _abrir_reserva(pg)
    hora = _hora_libre_tras_atajo(pg)
    pg.get_by_role("radio", name=hora).click()
    pg.get_by_role("button", name="Continuar → Tus datos").click()
    pausa(pg, 1500)
    pg.mouse.move(1000, 200)
    with grabar():
        pausa(pg, 400)
        datos_contacto(pg, lento=True)
        escribir(pg.locator("[formcontrolname=peticiones]"), "Es un poco miedoso con el secador.", 35)
        mover_a(pg, pg.get_by_role("button", name="Continuar → Pago"))
        pausa(pg, 900)


@captura("reserva.pago")
def _(pg, grabar):
    _abrir_reserva(pg)
    hora = _hora_libre_tras_atajo(pg)
    pg.get_by_role("radio", name=hora).click()
    pg.get_by_role("button", name="Continuar → Tus datos").click()
    pausa(pg, 1500)
    datos_contacto(pg)
    pg.get_by_role("button", name="Continuar → Pago").click()
    pausa(pg, 6000)
    pg.mouse.move(1000, 200)
    with grabar():
        pausa(pg, 400)
        pagar_con_tarjeta(pg, lento=True)
        texto(pg, "¡Reserva confirmada!").wait_for(timeout=40000)
        pausa(pg, 600)


@captura("reserva.confirmada")
def _(pg, grabar):
    _abrir_reserva(pg)
    hora = _hora_libre_tras_atajo(pg)
    pg.get_by_role("radio", name=hora).click()
    pg.get_by_role("button", name="Continuar → Tus datos").click()
    pausa(pg, 1500)
    datos_contacto(pg)
    pg.get_by_role("button", name="Continuar → Pago").click()
    pausa(pg, 6000)
    pagar_con_tarjeta(pg)
    texto(pg, "¡Reserva confirmada!").wait_for(timeout=40000)
    pausa(pg, 1500)
    pg.mouse.move(1000, 200)
    with grabar():
        pausa(pg, 500)
        acercar(pg, texto(pg, "CÓDIGO DE RESERVA", exacto=False), 1.6)
        pausa(pg, 2200)
        alejar(pg)
        mover_a(pg, pg.get_by_role("link", name="Ver mis reservas").or_(pg.get_by_role("button", name="Ver mis reservas")).first)
        pausa(pg, 900)


# ── 6 · Estado de la reserva ────────────────────────────────────────────────
@captura("estado.lista")
def _(pg, grabar):
    bd.borrar_reservas_pendientes()
    ir(pg, "/")
    pg.mouse.move(800, 333)
    with grabar():
        pausa(pg, 400)
        clic(pg, pg.get_by_role("button", name="Mi cuenta"))
        clic(pg, pg.get_by_role("link", name=re.compile("Mis reservas")).first)
        pg.wait_for_url("**/mis-reservas")
        pausa(pg, 1300)
        bajar(pg, 500, 16, 50)
        pausa(pg, 900)


@captura("estado.filtros")
def _(pg, grabar):
    ir(pg, "/reservas/mis-reservas")
    pg.mouse.move(800, 333)
    with grabar():
        for estado in ("Confirmadas", "Completadas", "Canceladas", "Todas"):
            clic(pg, pg.get_by_role("button", name=re.compile(rf"^\s*{estado}")).first, 1100)


@captura("estado.progreso")
def _(pg, grabar):
    ir(pg, "/reservas/mis-reservas")
    pg.mouse.move(1000, 200)
    with grabar():
        pausa(pg, 500)
        progreso = texto(pg, "Servicio")
        acercar(pg, progreso, 1.8)
        pausa(pg, 1200)
        for paso in ("Pago", "Confirmada", "Servicio", "Valorada"):
            mover_a(pg, texto(pg, paso), 12)
            pausa(pg, 400)
        alejar(pg)


@captura("estado.detalle")
def _(pg, grabar):
    ir(pg, "/reservas/mis-reservas")
    pg.mouse.move(1000, 200)
    with grabar():
        pausa(pg, 400)
        clic(pg, pg.get_by_role("link", name="Ver detalle").or_(pg.get_by_role("button", name="Ver detalle")).first)
        pausa(pg, 1800)
        bajar(pg, 350, 14, 50)
        acercar(pg, texto(pg, "RESUMEN DE PAGO", exacto=False), 1.45)
        pausa(pg, 1800)
        alejar(pg)


@captura("estado.acciones")
def _(pg, grabar):
    ir(pg, "/reservas/mis-reservas")
    pg.get_by_role("link", name="Ver detalle").or_(pg.get_by_role("button", name="Ver detalle")).first.click()
    pausa(pg, 1800)
    pg.mouse.move(1000, 200)
    with grabar():
        bajar(pg, 700, 16, 50)
        for accion in ("Cancelar reserva", "Tengo un problema con esta reserva"):
            mover_a(pg, pg.get_by_role("button", name=accion).first)
            pausa(pg, 1100)


# ── 7 · Registrar el negocio ────────────────────────────────────────────────
@captura("negocio.inicio", sesion=None)
def _(pg, grabar):
    ir(pg, "/")
    pg.mouse.move(533, 333)
    with grabar():
        pausa(pg, 700)
        clic(pg, pg.get_by_role("link", name=re.compile("registra tu empresa", re.I)).or_(
            pg.get_by_role("button", name=re.compile("registra tu empresa", re.I))).first)
        pg.wait_for_url("**/registro-comercio**")
        pausa(pg, 1800)


@captura("negocio.categorias", sesion=None)
def _(pg, grabar):
    ir(pg, "/auth/registro-comercio")
    pg.mouse.move(933, 333)
    with grabar():
        pausa(pg, 500)
        for categoria in ("Peluquerías caninas", "Adiestramiento canino"):
            clic(pg, texto(pg, categoria), 500)
        clic(pg, pg.get_by_role("button", name="Continuar"))
        pausa(pg, 1200)


@captura("negocio.cuenta", sesion=None)
def _(pg, grabar):
    bd.borrar_usuario(EMAIL_NEGOCIO)
    ir(pg, "/auth/registro-comercio")
    texto(pg, "Peluquerías caninas").click()
    pg.get_by_role("button", name="Continuar").click()
    pausa(pg, 900)
    pg.mouse.move(933, 267)
    with grabar():
        pausa(pg, 300)
        escribir(pg.locator("[formcontrolname=nombre]"), "Carmen Ruiz")
        escribir(pg.locator("[formcontrolname=email]"), EMAIL_NEGOCIO, 40)
        escribir(pg.locator("rs-phone-input input").last, "611223344", 60)
        escribir(pg.locator("[formcontrolname=password]"), "Peludos2026!", 60)
        clic(pg, pg.get_by_role("button", name="Crear mi negocio gratis"))
        texto(pg, "Tu cuenta ya está creada").wait_for()
        pausa(pg, 1500)


@captura("negocio.alta", sesion=None)
def _(pg, grabar):
    enlace = enlace_verificacion(EMAIL_NEGOCIO)
    ir(pg, "/auth/login")
    pg.mouse.move(867, 333)
    with grabar():
        pg.goto(enlace, wait_until="networkidle")
        pg.wait_for_url("**/comercio/alta**")
        pausa(pg, 1500)
        clic(pg, texto(pg, "Peluquerías caninas"), 500)
        clic(pg, pg.get_by_role("button", name="Continuar"))
        pausa(pg, 1800)
    bd.borrar_usuario(EMAIL_NEGOCIO)


# ── 8 · Ficha del negocio ───────────────────────────────────────────────────
def _reescribir(pg, selector: str, valor: str, retardo: int = 45) -> None:
    campo = pg.locator(selector).first
    campo.fill("")
    escribir(campo, valor, retardo)


@captura("ficha.panel", sesion="comercio")
def _(pg, grabar):
    ir(pg, "/comercio")
    pg.mouse.move(1000, 200)
    with grabar():
        pausa(pg, 500)
        acercar(pg, texto(pg, "Completa tu perfil de empresa"), 1.4)
        pausa(pg, 1500)
        alejar(pg)
        clic(pg, pg.get_by_role("link", name="Completar datos").or_(pg.get_by_role("button", name="Completar datos")).first)
        pausa(pg, 1800)


@captura("ficha.perfil", sesion="comercio")
def _(pg, grabar):
    ir(pg, "/comercio/config")
    pg.mouse.move(1000, 200)
    with grabar():
        pausa(pg, 300)
        _reescribir(pg, "[formcontrolname=nombreComercial]", "Peludos Salón Canino")
        _reescribir(pg, "[formcontrolname=razonSocial]", "Peludos Salón Canino S.L.", 35)
        _reescribir(pg, "[formcontrolname=vatNumber]", "B12345674", 70)
        _reescribir(pg, "[formcontrolname=descripcion]",
                    "Peluquería canina en el centro de Valencia: baño, corte de raza y spa con productos naturales.", 18)
        mover_a(pg, pg.get_by_role("button", name="Guardar y continuar"))
        pausa(pg, 700)


@captura("ficha.contacto", sesion="comercio")
def _(pg, grabar):
    ir(pg, "/comercio/config")
    clic(pg, texto(pg, "Contacto"), 900)
    pg.mouse.move(1000, 200)
    with grabar():
        pausa(pg, 300)
        _reescribir(pg, "[formcontrolname=nombreContacto]", "Carmen Ruiz")
        _reescribir(pg, "[formcontrolname=email]", "carmen@ejemplo.com", 35)
        telefonos = pg.locator("rs-phone-input input")
        for i in (0, 1):
            telefonos.nth(i).fill("")
            escribir(telefonos.nth(i), "611223344", 55)
        clic(pg, pg.get_by_role("button", name="Guardar y continuar"))
        pausa(pg, 1200)


@captura("ficha.cobros", sesion="comercio")
def _(pg, grabar):
    ir(pg, "/comercio/config")
    clic(pg, texto(pg, "Servicios que ofreces"), 900)
    pg.mouse.move(1000, 200)
    with grabar():
        pausa(pg, 300)
        for categoria in ("Peluquerías caninas", "Adiestramiento canino"):
            mover_a(pg, texto(pg, categoria))
            pausa(pg, 500)
        clic(pg, texto(pg, "Datos bancarios"), 900)
        _reescribir(pg, "[formcontrolname=titular]", "Peludos Salón Canino S.L.", 30)
        _reescribir(pg, "[formcontrolname=iban]", "ES91 2100 0418 4502 0005 1332", 45)
        _reescribir(pg, "[formcontrolname=banco]", "CaixaBank", 50)
        mover_a(pg, pg.get_by_role("button", name="Guardar y continuar"))
        pausa(pg, 700)


@captura("ficha.avisos", sesion="comercio")
def _(pg, grabar):
    ir(pg, "/comercio/config")
    clic(pg, texto(pg, "Notificaciones"), 900)
    pg.mouse.move(1000, 200)
    with grabar():
        pausa(pg, 400)
        for aviso in ("Nueva reserva", "Cancelación", "Nueva reseña", "Liquidaciones"):
            mover_a(pg, texto(pg, aviso))
            pausa(pg, 650)
        mover_a(pg, pg.get_by_role("button", name="Finalizar"))
        pausa(pg, 900)


# ── 9 · Publicar un servicio ────────────────────────────────────────────────
def _nuevo_servicio(pg, lento: bool) -> None:
    categoria = pg.locator("[formcontrolname=vertical]")
    if lento:
        mover_a(pg, categoria)
    categoria.select_option(label="Peluquerías caninas")
    pausa(pg, 500 if lento else 100)
    rellenar = (lambda sel, t, r=45: escribir(pg.locator(sel), t, r)) if lento else (lambda sel, t, r=0: pg.locator(sel).fill(t))
    rellenar("[formcontrolname=titulo]", "Spa Canino Premium")
    rellenar("[formcontrolname=descripcion]", "Baño relajante, mascarilla hidratante y cepillado a mano, con productos naturales.", 18)


def _servicio_hasta(pg, paso: int) -> None:
    bd.borrar_borradores()
    ir(pg, "/comercio/listados/nuevo")
    _nuevo_servicio(pg, lento=False)
    if paso >= 2:
        pg.get_by_role("button", name="Continuar").click()
        pausa(pg, 1200)
    if paso >= 3:
        _direccion(pg, lento=False)
        pg.get_by_role("button", name="Continuar").click()
        pausa(pg, 1200)
    if paso >= 4:
        pg.get_by_role("button", name="Continuar").click()
        pausa(pg, 1200)
    pg.mouse.move(1000, 200)


def _direccion(pg, lento: bool) -> None:
    calle = pg.locator("[formcontrolname=calle] input")
    if lento:
        mover_a(pg, calle)
        escribir(calle, "Calle de Colón 20, Valencia", 60)
    else:
        calle.click()
        calle.press_sequentially("Calle de Colón 20, Valencia")
    pausa(pg, 2500)
    opcion = pg.get_by_role("option").filter(has_text="46004").first
    if lento:
        clic(pg, opcion, 1800)
    else:
        opcion.click()
        pausa(pg, 1500)
    precio = pg.locator("[formcontrolname=precioBase]")
    if lento:
        escribir(precio, "35", 150)
    else:
        precio.fill("35")


@captura("servicio.categoria", sesion="comercio")
def _(pg, grabar):
    bd.borrar_borradores()
    ir(pg, "/comercio/listados")
    pg.mouse.move(600, 400)
    with grabar():
        pausa(pg, 400)
        clic(pg, pg.get_by_role("link", name="Nuevo servicio").or_(pg.get_by_role("button", name="Nuevo servicio")).first)
        pg.wait_for_url("**/listados/nuevo")
        pausa(pg, 900)
        _nuevo_servicio(pg, lento=True)
        mover_a(pg, pg.get_by_role("button", name="Continuar"))
        pausa(pg, 600)
    bd.borrar_borradores()


@captura("servicio.direccion", sesion="comercio")
def _(pg, grabar):
    _servicio_hasta(pg, 2)
    with grabar():
        pausa(pg, 300)
        _direccion(pg, lento=True)
        pausa(pg, 900)
    bd.borrar_borradores()


@captura("servicio.horario", sesion="comercio")
def _(pg, grabar):
    _servicio_hasta(pg, 3)
    with grabar():
        pausa(pg, 400)
        horas = pg.locator("input[type=time]")
        for i, valor in enumerate(("09:30", "14:00", "16:00", "20:00")):
            campo = horas.nth(i)
            mover_a(pg, campo, 14)
            campo.fill(valor)
            pausa(pg, 400)
        clic(pg, texto(pg, "Copiar el lunes a todos los días"), 1100)
        dias = texto(pg, "Días especiales")
        dias.scroll_into_view_if_needed()
        mover_a(pg, dias)
        pausa(pg, 1200)
    bd.borrar_borradores()


@captura("servicio.detalles", sesion="comercio")
def _(pg, grabar):
    _servicio_hasta(pg, 4)
    with grabar():
        pausa(pg, 300)
        clic(pg, pg.get_by_role("button", name="Añadir servicio de grooming"), 900)
        mover_a(pg, pg.locator("[formcontrolname=duracionSlotMin]"))
        pausa(pg, 500)
        fotos = pg.locator("rs-image-upload").last
        fotos.scroll_into_view_if_needed()
        mover_a(pg, fotos)
        acercar(pg, texto(pg, "te faltan 5", exacto=False), 1.5)
        pausa(pg, 1500)
        alejar(pg)
    bd.borrar_borradores()


@captura("servicio.publicado", sesion="comercio")
def _(pg, grabar):
    bd.borrar_borradores()
    ir(pg, "/comercio/listados")
    pg.mouse.move(600, 400)
    with grabar():
        pausa(pg, 500)
        acercar(pg, pg.get_by_text(re.compile(r"^\s*publicado\s*$", re.I)).last, 1.6)
        pausa(pg, 1300)
        alejar(pg)
        mover_a(pg, texto(pg, "Ver en Doogking"))
        pausa(pg, 300)
        pg.mouse.down()
        pg.mouse.up()
        ir(pg, "/peluqueria/peludos-salon-canino-valencia", 1800)
        bajar(pg, 300, 14, 50)
        pausa(pg, 600)


# ── 10 · Gestionar reservas ─────────────────────────────────────────────────
@captura("gestion.panel", sesion="comercio")
def _(pg, grabar):
    ir(pg, "/comercio")
    pg.mouse.move(1000, 200)
    with grabar():
        pausa(pg, 400)
        mover_a(pg, texto(pg, "INGRESOS ESTE MES", exacto=False))
        pausa(pg, 600)
        reservas = texto(pg, "Reservas recientes")
        reservas.scroll_into_view_if_needed()
        mover_a(pg, reservas)
        pausa(pg, 800)
        acercar(pg, texto(pg, "Resumen financiero"), 1.4)
        pausa(pg, 1600)
        alejar(pg)


@captura("gestion.lista", sesion="comercio")
def _(pg, grabar):
    ir(pg, "/comercio")
    pg.mouse.move(667, 400)
    with grabar():
        pausa(pg, 300)
        clic(pg, pg.get_by_role("link", name="Reservas", exact=True).first)
        pg.wait_for_url("**/comercio/reservas")
        pausa(pg, 1200)
        for filtro in ("Confirmadas", "Pendientes", "Todas"):
            clic(pg, pg.get_by_role("button", name=re.compile(rf"^\s*{filtro}")).first, 900)


@captura("gestion.detalle", sesion="comercio")
def _(pg, grabar):
    ir(pg, "/comercio/reservas")
    pg.mouse.move(1000, 200)
    with grabar():
        pausa(pg, 400)
        clic(pg, pg.get_by_role("button", name="Ver reserva").first, 1200)
        bajar(pg, 260, 12, 50)
        pausa(pg, 2200)


@captura("gestion.acciones", sesion="comercio")
def _(pg, grabar):
    ir(pg, "/comercio/reservas")
    pg.mouse.move(1000, 200)
    with grabar():
        pausa(pg, 300)
        clic(pg, pg.get_by_role("button", name="Gestionar").first, 800)
        for accion in ("Marcar completada", "Solicitar ajuste", "Registrar servicio"):
            mover_a(pg, pg.get_by_text(accion, exact=True).locator("visible=true").first, 16)
            pausa(pg, 700)
        mover_a(pg, pg.get_by_text("Contactar", exact=True).locator("visible=true").first)
        pausa(pg, 800)


@captura("gestion.agenda", sesion="comercio")
def _(pg, grabar):
    ir(pg, "/comercio/agenda")
    pg.mouse.move(1000, 200)
    with grabar():
        pausa(pg, 400)
        siguiente = pg.get_by_role("button", name=re.compile("siguiente|próxima", re.I)).first
        clic(pg, siguiente, 1400)
        mover_a(pg, pg.get_by_text("Rocky", exact=False).first)
        pausa(pg, 900)
        mover_a(pg, pg.get_by_role("button", name="Bloquear un tramo"))
        pausa(pg, 900)


# ── Categorías ──────────────────────────────────────────────────────────────
def _listado(pg, grabar, ruta: str, fichas: tuple[str, ...] = ()) -> None:
    ir(pg, ruta)
    pg.mouse.move(1000, 467)
    with grabar():
        pausa(pg, 500)
        bajar(pg, 420, 18, 50)
        for nombre in fichas:
            mover_a(pg, pg.get_by_text(nombre, exact=True).first)
            pausa(pg, 600)
        bajar(pg, 250, 12, 50)
        pausa(pg, 500)


def _ficha(pg, grabar, ruta: str, seccion: str) -> None:
    ir(pg, ruta)
    pg.mouse.move(1000, 333)
    with grabar():
        pausa(pg, 900)
        bajar(pg, 380, 16, 50)
        objetivo = texto(pg, seccion, exacto=False)
        objetivo.scroll_into_view_if_needed()
        mover_a(pg, objetivo)
        pausa(pg, 1200)


@captura("cat.peluqueria")
def _(pg, grabar):
    _listado(pg, grabar, RESULTADOS_PELU, ("Peluquería Guau Salamanca", "Dog Groom Chueca"))


@captura("cat.peluqueria.ficha")
def _(pg, grabar):
    _ficha(pg, grabar, FICHA_GUAU, "Servicios de peluquería")


@captura("cat.alojamiento")
def _(pg, grabar):
    _listado(pg, grabar, "/alojamiento?ciudad=Madrid&perros=1", ("Villa Canina Retiro", "City Paws Hotel Chamberí"))


@captura("cat.alojamiento.ficha")
def _(pg, grabar):
    ir(pg, "/alojamiento?ciudad=Madrid&perros=1")
    pg.mouse.move(1000, 333)
    with grabar():
        pausa(pg, 300)
        clic(pg, pg.get_by_text("Villa Canina Retiro", exact=True).first)
        pausa(pg, 2000)
        bajar(pg, 450, 18, 50)
        pausa(pg, 800)


@captura("cat.adiestramiento")
def _(pg, grabar):
    _listado(pg, grabar, "/adiestramiento?ciudad=Madrid&perros=1", ("Escuela Canina Casa de Campo", "Educadores Caninos K9 Madrid"))


@captura("cat.transporte")
def _(pg, grabar):
    ir(pg, "/transporte")
    pg.mouse.move(1000, 267)
    with grabar():
        pausa(pg, 300)
        for campo, valor, filtro in (("origenTexto", "Calle de Alcalá 100, Madrid", "Alcalá"),
                                     ("destinoTexto", "Aeropuerto Madrid-Barajas", "Barajas")):
            entrada = pg.locator(f"[formcontrolname={campo}] input")
            mover_a(pg, entrada)
            escribir(entrada, valor, 45)
            pausa(pg, 2000)
            opciones = pg.get_by_role("option").filter(has_text=filtro)
            if opciones.count():
                clic(pg, opciones.first, 600)
        pg.locator("[formcontrolname=fecha]").fill("2026-11-20")
        pausa(pg, 500)
        mover_a(pg, pg.get_by_role("button", name="Continuar"))
        pausa(pg, 900)


@captura("cat.veterinaria")
def _(pg, grabar):
    _listado(pg, grabar, "/veterinaria?ciudad=Madrid&perros=1", ("Clínica Veterinaria Royal Paws", "Hospital Veterinario Chamartín"))


@captura("cat.hoteles")
def _(pg, grabar):
    _listado(pg, grabar, "/hoteles?ciudad=Madrid&perros=1", ("Gran Hotel Pet Friendly Madrid", "Hotel Boutique Dog Friendly Retiro"))


@captura("cat.seguros")
def _(pg, grabar):
    _listado(pg, grabar, "/seguros", ("Seguro Salud Completo para Perros", "Seguro de Responsabilidad Civil Básico"))


@captura("cat.explora")
def _(pg, grabar):
    ir(pg, "/explora")
    pg.mouse.move(1000, 333)
    with grabar():
        pausa(pg, 500)
        for tipo in ("Playa canina", "Parque canino", "Restaurante pet-friendly"):
            clic(pg, pg.locator("button.ex-chip", has_text=tipo).first, 1100)
        bajar(pg, 400, 16, 50)


@captura("cat.explora.mapa")
def _(pg, grabar):
    ir(pg, "/explora")
    pg.mouse.move(1000, 333)
    with grabar():
        pausa(pg, 300)
        clic(pg, pg.locator("button.ex-chip", has_text="Ruta con perro").first, 900)
        clic(pg, pg.locator("button", has_text="Ver en el mapa").first)
        pausa(pg, 3500)
