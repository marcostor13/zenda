"""Ayudas de exploración: volcar el texto visible y los campos de un formulario."""

JS_TEXTO = "() => (document.querySelector('main') || document.body).innerText.split(String.fromCharCode(10)).filter(Boolean).join(' | ').slice(0, 1400)"
JS_CAMPOS = "() => [...document.querySelectorAll('[formcontrolname]')].filter(e => e.offsetParent).map(e => e.getAttribute('formcontrolname') + ':' + e.tagName + ':' + (e.type || ''))"


def volcar(pagina, nombre, carpeta, esperar=1500):
    pagina.wait_for_timeout(esperar)
    pagina.screenshot(path=str(carpeta / f"{nombre}.png"), full_page=True)
    print(f"\n## {nombre} {pagina.url}")
    print(pagina.evaluate(JS_TEXTO))
    campos = pagina.evaluate(JS_CAMPOS)
    if campos:
        print("CAMPOS", campos)
