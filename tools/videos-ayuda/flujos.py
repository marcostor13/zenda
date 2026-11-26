"""Flujos de la web reutilizables: los usan tanto la exploración como la grabación.

Cada paso deja tiempo para que se vea en vídeo (`pausa`) y escribe como una
persona (`escribir`), en lugar de rellenar de golpe.
"""
from comun import BASE_WEB

TARJETA_PRUEBA = ("4242424242424242", "12/30", "123")


def pausa(pagina, ms: int = 900) -> None:
    pagina.wait_for_timeout(ms)


def escribir(localizador, texto: str, retardo: int = 55) -> None:
    localizador.click()
    localizador.press_sequentially(texto, delay=retardo)


def ir(pagina, ruta: str, espera: int = 1200) -> None:
    pagina.goto(BASE_WEB + ruta, wait_until="networkidle")
    pausa(pagina, espera)


def bajar(pagina, pixeles: int, pasos: int = 12, ms: int = 40) -> None:
    """Scroll suave: el salto seco de `scrollTo` se ve feo en vídeo."""
    for _ in range(pasos):
        pagina.mouse.wheel(0, pixeles / pasos)
        pagina.wait_for_timeout(ms)


def elegir_cita(pagina, hora: str) -> None:
    pagina.locator("[data-testid=atajo-primera-cita]").click()
    pausa(pagina, 1000)
    pagina.get_by_role("radio", name=hora).click()
    pausa(pagina, 700)


def datos_contacto(pagina, lento: bool = False) -> None:
    rellenar = (lambda loc, t: escribir(loc, t, 45)) if lento else (lambda loc, t: loc.fill(t))
    rellenar(pagina.locator("[formcontrolname=nombre]"), "Lucía")
    rellenar(pagina.locator("[formcontrolname=apellidos]"), "Martín")
    rellenar(pagina.locator("rs-phone-input input").last, "612345678")
    pausa(pagina, 400)
    pagina.locator("[formcontrolname=confirmaDatosMascota]").check()
    pausa(pagina, 300)
    pagina.locator("[formcontrolname=aceptaTerminos]").check()


def pagar_con_tarjeta(pagina, lento: bool = False) -> None:
    stripe = pagina.frame_locator('iframe[title="Campo de entrada seguro para el pago"]')
    stripe.get_by_text("Tarjeta", exact=True).first.click()
    pausa(pagina, 1500)
    numero, caducidad, cvc = TARJETA_PRUEBA
    retardo = 60 if lento else 0
    stripe.locator("input[name=number]").press_sequentially(numero, delay=retardo)
    stripe.locator("input[name=expiry]").press_sequentially(caducidad, delay=retardo)
    stripe.locator("input[name=cvc]").press_sequentially(cvc, delay=retardo)
    codigo_postal = stripe.locator("input[name=postalCode]")
    if codigo_postal.count():
        codigo_postal.fill("28001")
    pausa(pagina, 900)
    pagina.get_by_role("button", name="Pagar").click()


def reservar_peluqueria(pagina, ruta_ficha: str, hora: str, lento: bool = False) -> str:
    """Reserva y paga una cita; devuelve el código de reserva."""
    ir(pagina, ruta_ficha)
    pagina.get_by_role("button", name="Reservar cita").first.click()
    pausa(pagina, 2500)
    elegir_cita(pagina, hora)
    pagina.get_by_role("button", name="Continuar → Tus datos").click()
    pausa(pagina, 1500)
    datos_contacto(pagina, lento)
    pagina.get_by_role("button", name="Continuar → Pago").click()
    pausa(pagina, 6000)
    pagar_con_tarjeta(pagina, lento)
    pagina.get_by_text("¡Reserva confirmada!").wait_for(timeout=40000)
    pausa(pagina, 1500)
    return pagina.locator("text=/RES-[A-Z0-9_-]{8}/").first.inner_text().strip()
