"""Vídeos y fotos de Pexels relacionados con lo que se cuenta, con caché en disco.

Se elige el vídeo horizontal más nítido que no pase de 1920 px de ancho (el 4K
sólo engorda la descarga) y que dure lo suficiente para la escena.
"""
import hashlib
import json
import urllib.parse
import urllib.request
from pathlib import Path

from comun import CACHE, clave_api

CARPETA = CACHE / "pexels"
CABECERAS = {"User-Agent": "doogking-videos-ayuda/1.0"}


def _get_json(url: str) -> dict:
    peticion = urllib.request.Request(url, headers={**CABECERAS, "Authorization": clave_api("PEXELS_API_KEY")})
    with urllib.request.urlopen(peticion, timeout=60) as respuesta:
        return json.loads(respuesta.read())


def _descargar(url: str, destino: Path) -> Path:
    if not destino.exists():
        peticion = urllib.request.Request(url, headers=CABECERAS)
        with urllib.request.urlopen(peticion, timeout=180) as respuesta:
            destino.write_bytes(respuesta.read())
    return destino


def _buscar(tipo: str, consulta: str) -> list[dict]:
    """Resultados de búsqueda en caché: así cada vídeo elige siempre el mismo clip."""
    CARPETA.mkdir(parents=True, exist_ok=True)
    firma = hashlib.sha1(f"{tipo}|{consulta}".encode()).hexdigest()[:12]
    cache = CARPETA / f"busqueda-{firma}.json"
    if cache.exists():
        return json.loads(cache.read_text(encoding="utf-8"))
    base = "https://api.pexels.com/videos/search" if tipo == "video" else "https://api.pexels.com/v1/search"
    parametros = urllib.parse.urlencode({"query": consulta, "orientation": "landscape", "per_page": 15, "size": "medium"})
    clave = "videos" if tipo == "video" else "photos"
    resultados = _get_json(f"{base}?{parametros}").get(clave, [])
    cache.write_text(json.dumps(resultados), encoding="utf-8")
    return resultados


def _mejor_fichero(video: dict) -> dict | None:
    candidatos = [f for f in video.get("video_files", [])
                  if f.get("width") and f["width"] >= f.get("height", 0) and 1280 <= f["width"] <= 1920]
    return max(candidatos, key=lambda f: f["width"], default=None)


def video(consulta: str, duracion_minima: float = 4, indice: int = 0) -> Path:
    """Clip de vídeo para `consulta`. `indice` elige otro resultado si se repite tema."""
    validos = [v for v in _buscar("video", consulta)
               if v.get("duration", 0) >= duracion_minima and _mejor_fichero(v)]
    if not validos:
        raise SystemExit(f"Pexels no tiene vídeos útiles para «{consulta}»")
    elegido = validos[indice % len(validos)]
    fichero = _mejor_fichero(elegido)
    return _descargar(fichero["link"], CARPETA / f"v{elegido['id']}.mp4")


def foto(consulta: str, indice: int = 0) -> Path:
    resultados = _buscar("foto", consulta)
    if not resultados:
        raise SystemExit(f"Pexels no tiene fotos para «{consulta}»")
    elegida = resultados[indice % len(resultados)]
    return _descargar(elegida["src"]["original"] + "?auto=compress&w=2560", CARPETA / f"f{elegida['id']}.jpg")


if __name__ == "__main__":
    import sys
    print(video(" ".join(sys.argv[1:]) or "dog grooming"))
