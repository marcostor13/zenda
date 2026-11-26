"""Genera los vídeos de ayuda de Doogking.

  python generar.py capturar 1 2 ...     graba las escenas web de esos vídeos
  python generar.py capturar --clave reserva.pago
  python generar.py montar 1 2 ...        voz + Pexels + montaje final
  python generar.py todo                  los 18, de principio a fin

Las capturas y las locuciones se guardan en videos/ayuda/_cache y sólo se
rehacen si se pasa --forzar (capturas) o si cambia el texto (voz).
"""
import argparse
import sys
import traceback

from playwright.sync_api import sync_playwright

from capturas import CAPTURAS, SESIONES
from comun import CACHE, contexto_navegador
from grabador import Grabador, preparar_pagina
from guiones import VIDEOS, Web, por_numero

CARPETA_WEB = CACHE / "web"


def ruta_captura(clave: str):
    return CARPETA_WEB / f"{clave}.mp4"


def capturar(claves: list[str], forzar: bool) -> list[str]:
    fallidas = []
    CARPETA_WEB.mkdir(parents=True, exist_ok=True)
    with sync_playwright() as p:
        navegador = p.chromium.launch()
        for clave in claves:
            destino = ruta_captura(clave)
            if destino.exists() and not forzar:
                continue
            sesion, funcion = CAPTURAS[clave]
            estado = SESIONES / f"{sesion}.json" if sesion else None
            contexto = contexto_navegador(navegador, estado)
            preparar_pagina(contexto)
            pagina = contexto.new_page()
            pagina.set_default_timeout(15000)
            try:
                funcion(pagina, lambda: Grabador(pagina, destino))
                print(f"  ✔ {clave}")
            except Exception:
                destino.unlink(missing_ok=True)
                fallidas.append(clave)
                print(f"  ✘ {clave}\n{traceback.format_exc(limit=3)}")
                pagina.screenshot(path=str(CARPETA_WEB / f"{clave}.error.png"))
            finally:
                contexto.close()
        navegador.close()
    return fallidas


def claves_de(numeros: list[int]) -> list[str]:
    return [e.visual.clave for n in numeros for e in por_numero(n).escenas if isinstance(e.visual, Web)]


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("accion", choices=["capturar", "montar", "todo"])
    parser.add_argument("videos", nargs="*", type=int)
    parser.add_argument("--clave", action="append", default=[])
    parser.add_argument("--forzar", action="store_true")
    parser.add_argument("--vertical", action="store_true", help="versión 9:16 para redes, en videos/ayuda/vertical")
    args = parser.parse_args()
    numeros = args.videos or [v.numero for v in VIDEOS]

    if args.accion in ("capturar", "todo"):
        claves = args.clave or claves_de(numeros)
        fallidas = capturar(claves, args.forzar)
        if fallidas:
            print("Fallaron:", ", ".join(fallidas))
            if args.accion == "capturar":
                sys.exit(1)
    if args.accion in ("montar", "todo"):
        from montar import montar_video
        for numero in numeros:
            montar_video(por_numero(numero), args.vertical)


if __name__ == "__main__":
    main()
