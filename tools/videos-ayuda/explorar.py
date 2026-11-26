"""Fotografía pantallas de la web local y vuelca sus textos visibles.

Sirve para escribir los guiones sobre la interfaz real, no de memoria.
Uso: python tools/videos-ayuda/explorar.py ruta1 ruta2 ...  (salida en videos/ayuda/_explorar)
"""
import json
import sys
from pathlib import Path

from playwright.sync_api import sync_playwright

from comun import BASE_WEB, RAIZ_SALIDA, contexto_navegador

SALIDA = RAIZ_SALIDA / "_explorar"

JS_TEXTOS = """() => {
  const vis = el => { const r = el.getBoundingClientRect(); const s = getComputedStyle(el);
    return r.width > 0 && r.height > 0 && s.visibility !== 'hidden' && s.display !== 'none'; };
  const txt = sel => [...document.querySelectorAll(sel)].filter(vis)
    .map(e => (e.innerText || e.getAttribute('aria-label') || e.getAttribute('placeholder') || '').trim().replace(/\\s+/g, ' '))
    .filter(Boolean).slice(0, 40);
  return { h: txt('h1,h2,h3'), botones: txt('button,a.rs-btn'), campos: txt('label,input[placeholder],select'),
           alto: document.documentElement.scrollHeight };
}"""


def main(rutas: list[str]) -> None:
    SALIDA.mkdir(parents=True, exist_ok=True)
    estado = SALIDA / "sesion.json"
    with sync_playwright() as p:
        navegador = p.chromium.launch()
        ctx = contexto_navegador(navegador, estado if estado.exists() else None)
        pagina = ctx.new_page()
        for ruta in rutas:
            pagina.goto(BASE_WEB + ruta, wait_until="networkidle")
            pagina.wait_for_timeout(800)
            nombre = ruta.strip("/").replace("/", "_") or "home"
            pagina.screenshot(path=str(SALIDA / f"{nombre}.png"), full_page=True)
            datos = pagina.evaluate(JS_TEXTOS)
            print(f"\n### {ruta} (alto {datos['alto']})")
            for clave in ("h", "botones", "campos"):
                print(f"  {clave}: {' | '.join(datos[clave])}")
        navegador.close()


if __name__ == "__main__":
    main(sys.argv[1:] or ["/"])
