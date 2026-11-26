"""Fotogramas repartidos por un vídeo final, en una cuadrícula de 2 columnas."""
import subprocess, sys
from pathlib import Path
from PIL import Image
video, salida, n = Path(sys.argv[1]), Path(sys.argv[2]), int(sys.argv[3]) if len(sys.argv) > 3 else 10
total = float(subprocess.run(["ffprobe","-v","error","-show_entries","format=duration","-of","csv=p=0",str(video)],capture_output=True,text=True).stdout)
lienzo = Image.new("RGB", (1280, 360 * ((n + 1) // 2)))
for i in range(n):
    t = total * (i + 0.5) / n
    tmp = salida.with_suffix(f".{i}.jpg")
    subprocess.run(["ffmpeg","-v","error","-y","-ss",f"{t:.2f}","-i",str(video),"-frames:v","1","-vf","scale=640:360",str(tmp)],check=True)
    lienzo.paste(Image.open(tmp), ((i % 2) * 640, (i // 2) * 360)); tmp.unlink()
lienzo.save(salida, quality=80)
