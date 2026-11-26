"""Locución con ElevenLabs: voz femenina peninsular, con marcas de tiempo por carácter.

Las marcas de tiempo sirven para sincronizar los subtítulos palabra a palabra.
Cada frase se guarda en caché por hash (texto + voz + ajustes): volver a montar
un vídeo no gasta cuota mientras no cambie el guion.
"""
import base64
import hashlib
import json
import re
import subprocess
import urllib.request
from dataclasses import dataclass
from pathlib import Path

from comun import CACHE, clave_api

# Eva Dorado: castellano de España, cálida y suave, pensada para narración.
VOZ_ID = "RgXx32WYOGrd7gFNifSf"
MODELO = "eleven_multilingual_v2"
AJUSTES = {"stability": 0.42, "similarity_boost": 0.8, "style": 0.32, "use_speaker_boost": True, "speed": 1.04}

CARPETA = CACHE / "voz"


@dataclass
class Palabra:
    texto: str
    inicio: float
    fin: float


@dataclass
class Locucion:
    audio: Path
    duracion: float
    palabras: list[Palabra]


def _palabras(alineacion: dict) -> list[Palabra]:
    caracteres = alineacion["characters"]
    inicios = alineacion["character_start_times_seconds"]
    fines = alineacion["character_end_times_seconds"]
    palabras: list[Palabra] = []
    actual, inicio = "", None
    for caracter, ini, fin in zip(caracteres, inicios, fines):
        if caracter.isspace():
            if actual:
                palabras.append(Palabra(actual, inicio, ultimo_fin))
            actual, inicio = "", None
            continue
        if inicio is None:
            inicio = ini
        actual += caracter
        ultimo_fin = fin
    if actual:
        palabras.append(Palabra(actual, inicio, ultimo_fin))
    return palabras


def _duracion(audio: Path) -> float:
    salida = subprocess.run(
        ["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", str(audio)],
        capture_output=True, text=True, check=True,
    )
    return float(salida.stdout.strip())


def _pedir(texto: str, anterior: str, siguiente: str) -> dict:
    cuerpo = {"text": texto, "model_id": MODELO, "voice_settings": AJUSTES, "language_code": "es"}
    if anterior:
        cuerpo["previous_text"] = anterior
    if siguiente:
        cuerpo["next_text"] = siguiente
    peticion = urllib.request.Request(
        f"https://api.elevenlabs.io/v1/text-to-speech/{VOZ_ID}/with-timestamps?output_format=mp3_44100_128",
        data=json.dumps(cuerpo).encode("utf-8"),
        headers={"xi-api-key": clave_api("ELEVENLABS_API_KEY"), "Content-Type": "application/json"},
        method="POST",
    )
    with urllib.request.urlopen(peticion, timeout=120) as respuesta:
        return json.loads(respuesta.read())


def pronunciable(texto: str) -> str:
    """La marca se escribe «Doogking» pero se dice «dog-king», como *dog*: escrita
    «Doogking» la voz decía «Dúking», y «Dogking» sonaba a «dogging»; con guion sale bien. Sólo cambia lo que se locuta; en pantalla sigue «Doogking»."""
    return re.sub(r"([Dd])oogking", r"\1og-king", texto)


def _escrito(palabra: Palabra) -> Palabra:
    return Palabra(re.sub(r"([Dd])og-king", r"\1oogking", palabra.texto), palabra.inicio, palabra.fin)


def locutar(texto: str, anterior: str = "", siguiente: str = "") -> Locucion:
    """Devuelve el audio de `texto`; el contexto mejora la entonación entre frases."""
    texto, anterior, siguiente = pronunciable(texto), pronunciable(anterior), pronunciable(siguiente)
    CARPETA.mkdir(parents=True, exist_ok=True)
    firma = json.dumps([texto, anterior, siguiente, VOZ_ID, MODELO, AJUSTES], ensure_ascii=False)
    nombre = hashlib.sha1(firma.encode("utf-8")).hexdigest()[:16]
    audio, meta = CARPETA / f"{nombre}.mp3", CARPETA / f"{nombre}.json"
    if not (audio.exists() and meta.exists()):
        datos = _pedir(texto, anterior, siguiente)
        audio.write_bytes(base64.b64decode(datos["audio_base64"]))
        meta.write_text(json.dumps(datos["alignment"]), encoding="utf-8")
    palabras = [_escrito(p) for p in _palabras(json.loads(meta.read_text(encoding="utf-8")))]
    return Locucion(audio, _duracion(audio), palabras)


if __name__ == "__main__":
    import sys
    resultado = locutar(" ".join(sys.argv[1:]) or "Hola, soy la voz de Doogking. Te enseño a reservar en un minuto.")
    print(resultado.audio, round(resultado.duracion, 2), [(p.texto, round(p.inicio, 2)) for p in resultado.palabras][:12])
