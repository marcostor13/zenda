"""Hoja de contactos de vídeos: varios fotogramas por clip en una sola imagen.

Uso: python revisar.py salida.jpg clip1.mp4 clip2.mp4 ...  [--puntos 0.15,0.55,0.95]
"""
import subprocess
import sys
import tempfile
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont


def duracion(video: Path) -> float:
    salida = subprocess.run(["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", str(video)],
                            capture_output=True, text=True, check=True)
    return float(salida.stdout.strip())


def hoja(salida: Path, videos: list[Path], puntos: list[float], ancho: int = 480) -> None:
    alto = ancho * 9 // 16
    lienzo = Image.new("RGB", (ancho * len(puntos), (alto + 26) * len(videos)), "white")
    dibujo = ImageDraw.Draw(lienzo)
    fuente = ImageFont.load_default()
    with tempfile.TemporaryDirectory() as tmp:
        for fila, video in enumerate(videos):
            total = duracion(video)
            dibujo.text((6, fila * (alto + 26) + 6), f"{video.name}  ({total:.1f}s)", fill="black", font=fuente)
            for columna, punto in enumerate(puntos):
                foto = Path(tmp) / f"{fila}-{columna}.jpg"
                subprocess.run(["ffmpeg", "-v", "error", "-y", "-ss", f"{total * punto:.2f}", "-i", str(video),
                                "-frames:v", "1", "-vf", f"scale={ancho}:{alto}", str(foto)], check=True)
                lienzo.paste(Image.open(foto), (columna * ancho, fila * (alto + 26) + 26))
    lienzo.save(salida, quality=80)


if __name__ == "__main__":
    argumentos = sys.argv[1:]
    puntos = [0.15, 0.55, 0.95]
    if "--puntos" in argumentos:
        i = argumentos.index("--puntos")
        puntos = [float(x) for x in argumentos[i + 1].split(",")]
        del argumentos[i:i + 2]
    hoja(Path(argumentos[0]), [Path(v) for v in argumentos[1:]], puntos)
