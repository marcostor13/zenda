"""Montaje final de cada vídeo con ffmpeg.

Línea de tiempo: intro → escenas → cierre, encadenadas con transiciones `xfade`.
Cada escena dura lo que su locución más un margen; la imagen (grabación web,
clip o foto de Pexels) se ajusta a esa duración. Encima van el rótulo de la
escena, los subtítulos karaoke (la palabra que se dice se pinta en dorado), una
barra de progreso dorada y la música de fondo, que baja mientras habla la voz.
"""
import re
import subprocess
from dataclasses import dataclass
from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter, ImageFont

import pexels
from comun import ALTO, ANCHO, CACHE, FPS, RAIZ_REPO, RAIZ_SALIDA
from guiones import Clip, Escena, Foto, Video, Web
from voz import Locucion, Palabra, locutar

TRANSICION = 0.5            # segundos que se solapan dos escenas
ANTES_DE_HABLAR = TRANSICION + 0.15
DESPUES_DE_HABLAR = 0.45
INTRO, CIERRE = 2.8, 3.6
RAMPA_RAPIDA_MAX = 1.7      # la grabación web se acelera como mucho esto para encajar

FUENTES = CACHE / "fuentes"
LOGO_BLANCO = RAIZ_REPO / "apps/web/public/images/logo-doogking-footer.png"
MUSICA = CACHE / "musica"

AZUL, AZUL_OSCURO, DORADO, DORADO_CLARO = (8, 37, 139), (0, 19, 93), (251, 174, 23), (255, 197, 51)
TRANSICIONES = ["smoothleft", "slideleft", "circleopen", "smoothup", "wipeleft", "radial", "slideup", "smoothright"]


def fuente(nombre: str, tamano: int) -> ImageFont.FreeTypeFont:
    return ImageFont.truetype(str(FUENTES / nombre), tamano)


def ffmpeg(*argumentos: str, cwd: Path | None = None) -> None:
    resultado = subprocess.run(["ffmpeg", "-y", "-v", "error", *argumentos], cwd=cwd, capture_output=True, text=True,
                               encoding="utf-8", errors="replace")
    if resultado.returncode != 0:
        raise RuntimeError(f"ffmpeg falló ({resultado.returncode}): {resultado.stderr[-1500:]}")


def duracion(fichero: Path) -> float:
    salida = subprocess.run(["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", str(fichero)],
                            capture_output=True, text=True, check=True)
    return float(salida.stdout.strip())


# ── Gráficos (PIL) ───────────────────────────────────────────────────────────
def fondo_marca(destino: Path) -> Path:
    """Azul real con un halo dorado suave: el mismo fondo para intro y cierre."""
    if destino.exists():
        return destino
    imagen = Image.new("RGB", (ANCHO, ALTO), AZUL_OSCURO)
    halo = Image.new("L", (ANCHO, ALTO), 0)
    ImageDraw.Draw(halo).ellipse((ANCHO * 0.15, -ALTO * 0.6, ANCHO * 0.85, ALTO * 0.9), fill=255)
    halo = halo.filter(ImageFilter.GaussianBlur(220))
    imagen = Image.composite(Image.new("RGB", (ANCHO, ALTO), AZUL), imagen, halo)
    brillo = Image.new("L", (ANCHO, ALTO), 0)
    ImageDraw.Draw(brillo).ellipse((ANCHO * 0.55, ALTO * 0.75, ANCHO * 1.2, ALTO * 1.5), fill=90)
    brillo = brillo.filter(ImageFilter.GaussianBlur(180))
    imagen = Image.composite(Image.new("RGB", (ANCHO, ALTO), DORADO), imagen, brillo)
    imagen.save(destino)
    return destino


def _lineas(texto: str, letra: ImageFont.FreeTypeFont, ancho_maximo: int) -> list[str]:
    lineas, actual = [], ""
    for palabra in texto.split():
        prueba = f"{actual} {palabra}".strip()
        if letra.getlength(prueba) <= ancho_maximo:
            actual = prueba
        else:
            lineas.append(actual)
            actual = palabra
    return lineas + [actual]


def titulo_intro(video: Video, destino: Path) -> Path:
    """Etiqueta del grupo + título, en PNG transparente a tamaño de pantalla."""
    capa = Image.new("RGBA", (ANCHO, ALTO), (0, 0, 0, 0))
    dibujo = ImageDraw.Draw(capa)
    etiqueta = {"Usuarios": "GUÍA PARA DUEÑOS", "Comercios": "GUÍA PARA NEGOCIOS", "Categorías": "DESCUBRE DOOGKING"}[video.grupo]
    letra_etiqueta = fuente("montserrat-700.ttf", 34)
    ancho_etiqueta = letra_etiqueta.getlength(etiqueta) + 64
    x0 = (ANCHO - ancho_etiqueta) / 2
    dibujo.rounded_rectangle((x0, 600, x0 + ancho_etiqueta, 664), radius=32, fill=DORADO)
    dibujo.text((ANCHO / 2, 632), etiqueta, font=letra_etiqueta, fill=AZUL_OSCURO, anchor="mm")
    letra_titulo = fuente("plus-jakarta-sans-800.ttf", 92)
    for i, linea in enumerate(_lineas(video.titulo, letra_titulo, 1500)):
        dibujo.text((ANCHO / 2, 760 + i * 106), linea, font=letra_titulo, fill="white", anchor="mm")
    capa.save(destino)
    return destino


def texto_cierre(destino: Path) -> Path:
    capa = Image.new("RGBA", (ANCHO, ALTO), (0, 0, 0, 0))
    dibujo = ImageDraw.Draw(capa)
    dibujo.text((ANCHO / 2, 760), "Reserva en doogking.com", font=fuente("plus-jakarta-sans-800.ttf", 76), fill="white", anchor="mm")
    letra = fuente("montserrat-700.ttf", 34)
    texto = "TODO PARA SU REY, EN UN SOLO LUGAR"
    ancho = letra.getlength(texto) + 80
    dibujo.rounded_rectangle(((ANCHO - ancho) / 2, 840, (ANCHO + ancho) / 2, 904), radius=32, fill=DORADO)
    dibujo.text((ANCHO / 2, 872), texto, font=letra, fill=AZUL_OSCURO, anchor="mm")
    capa.save(destino)
    return destino


def rotulo(texto: str, destino: Path) -> Path:
    """Titular de escena: pastilla azul con barra dorada y sombra."""
    letra = fuente("plus-jakarta-sans-800.ttf", 46)
    ancho = int(letra.getlength(texto)) + 120
    alto = 104
    capa = Image.new("RGBA", (ancho + 40, alto + 40), (0, 0, 0, 0))
    sombra = Image.new("RGBA", capa.size, (0, 0, 0, 0))
    ImageDraw.Draw(sombra).rounded_rectangle((20, 26, ancho + 20, alto + 26), radius=26, fill=(0, 19, 93, 110))
    capa = Image.alpha_composite(capa, sombra.filter(ImageFilter.GaussianBlur(12)))
    dibujo = ImageDraw.Draw(capa)
    dibujo.rounded_rectangle((20, 20, ancho + 20, alto + 20), radius=26, fill=AZUL)
    dibujo.rounded_rectangle((44, 44, 54, alto - 4), radius=5, fill=DORADO)
    dibujo.text((84, 20 + alto / 2), texto, font=letra, fill="white", anchor="lm")
    capa.save(destino)
    return destino


# ── Escenas ──────────────────────────────────────────────────────────────────
@dataclass
class Plano:
    escena: Escena
    locucion: Locucion
    duracion: float
    inicio: float = 0.0


def _video_web(origen: Path, objetivo: float) -> tuple[list[str], str]:
    """Acelera la grabación si es más larga que la locución; si es más corta, congela el final."""
    largo = duracion(origen)
    rapidez = min(max(largo / objetivo, 1.0), RAMPA_RAPIDA_MAX)
    resto = largo / rapidez
    filtros = [f"setpts=PTS/{rapidez:.4f}"]
    entrada = ["-i", str(origen)]
    if resto > objetivo:
        # Lo que sobra se quita del principio: el final enseña el resultado que cuenta la voz.
        entrada = ["-ss", f"{(resto - objetivo) * rapidez:.3f}", "-i", str(origen)]
    else:
        filtros.append(f"tpad=stop_mode=clone:stop_duration={objetivo - resto + 0.1:.3f}")
    filtros.append(f"scale={ANCHO}:{ALTO}")
    return entrada, ",".join(filtros)


def barrido(objetivo: float, hacia_derecha: bool = True) -> str:
    """Movimiento de cámara lateral sobre una imagen un 10 % mayor que la pantalla.

    El zoom con `scale` evaluado por fotograma hace caer a ffmpeg 8 en cuanto
    hay un `overlay` detrás, así que el movimiento se hace recortando.
    """
    grande_w, grande_h = int(ANCHO * 1.1) // 2 * 2, int(ALTO * 1.1) // 2 * 2
    sobra_x, sobra_y = grande_w - ANCHO, grande_h - ALTO
    x = f"{sobra_x}*t/{objetivo:.2f}" if hacia_derecha else f"{sobra_x}*(1-t/{objetivo:.2f})"
    return (f"scale={grande_w}:{grande_h}:force_original_aspect_ratio=increase,crop={grande_w}:{grande_h},"
            f"crop={ANCHO}:{ALTO}:x='{x}':y='{sobra_y // 2}'")


def _video_pexels(origen: Path, objetivo: float, indice: int = 0) -> tuple[list[str], str]:
    return (["-stream_loop", "-1", "-i", str(origen)], f"{barrido(objetivo, indice % 2 == 0)},eq=saturation=1.08")


def _foto(origen: Path, objetivo: float) -> tuple[list[str], str]:
    fotogramas = int(objetivo * FPS) + 2
    return (["-loop", "1", "-i", str(origen)],
            f"scale=3840:2160:force_original_aspect_ratio=increase,crop=3840:2160,"
            f"zoompan=z='1+0.12*on/{fotogramas}':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d=1:s={ANCHO}x{ALTO}:fps={FPS}")


def render_escena(plano: Plano, indice: int, carpeta: Path, video: Video) -> Path:
    destino = carpeta / f"escena-{indice:02d}.mp4"
    visual = plano.escena.visual
    if isinstance(visual, Web):
        entrada, filtro = _video_web(CACHE / "web" / f"{visual.clave}.mp4", plano.duracion)
    elif isinstance(visual, Clip):
        entrada, filtro = _video_pexels(pexels.video(visual.consulta, plano.duracion * 0.6, visual.indice), plano.duracion, indice)
    else:
        entrada, filtro = _foto(pexels.foto(visual.consulta, visual.indice), plano.duracion)

    entradas, grafo, ultima = list(entrada), [f"[0:v]{filtro},fps={FPS},setsar=1,format=yuv420p[base]"], "base"
    if not isinstance(visual, Web):
        entradas += ["-i", str(LOGO_BLANCO)]
        grafo.append(f"[1:v]scale=300:-1,format=rgba,colorchannelmixer=aa=0.95[logo]")
        grafo.append(f"[{ultima}][logo]overlay=W-w-56:44[conlogo]")
        ultima = "conlogo"
    if plano.escena.rotulo:
        png = rotulo(plano.escena.rotulo, carpeta / f"rotulo-{indice:02d}.png")
        entradas += ["-loop", "1", "-i", str(png)]
        n = entradas.count("-i") - 1
        entra, sale = TRANSICION + 0.15, min(plano.duracion - TRANSICION - 0.2, TRANSICION + 3.6)
        x = (f"if(lt(t,{entra}),-w,if(lt(t,{entra + 0.45}),-w+(w+40)*(1-pow(1-(t-{entra})/0.45,3)),"
             f"if(lt(t,{sale}),40,40-(w+40)*pow((t-{sale})/0.4,2))))")
        grafo.append(f"[{ultima}][{n}:v]overlay=x='{x}':y=150:shortest=1[conrotulo]")
        ultima = "conrotulo"
    ffmpeg(*entradas, "-filter_complex", ";".join(grafo), "-map", f"[{ultima}]", "-t", f"{plano.duracion:.3f}",
           "-r", str(FPS), "-c:v", "libx264", "-preset", "medium", "-crf", "17", "-an", str(destino))
    return destino


def render_intro(video: Video, carpeta: Path) -> Path:
    destino = carpeta / "intro.mp4"
    fondo = fondo_marca(CACHE / "fondo-marca.png")
    titulo = titulo_intro(video, carpeta / "titulo.png")
    grafo = (
        f"[0:v]{barrido(INTRO)}[bg];"
        f"[1:v]scale=640:-1,format=rgba,fade=t=in:st=0.1:d=0.5:alpha=1[logo];"
        f"[bg][logo]overlay=x=(W-w)/2:y='150+40*exp(-6*t)':shortest=1[a];"
        f"[2:v]format=rgba,fade=t=in:st=0.45:d=0.5:alpha=1[titulo];"
        f"[a][titulo]overlay=x=0:y='if(lt(t,0.45),60,60*exp(-7*(t-0.45)))':shortest=1,fps={FPS},format=yuv420p[v]"
    )
    ffmpeg("-loop", "1", "-i", str(fondo), "-loop", "1", "-i", str(LOGO_BLANCO), "-loop", "1", "-i", str(titulo),
           "-filter_complex", grafo, "-map", "[v]", "-t", str(INTRO), "-c:v", "libx264", "-crf", "17", str(destino))
    return destino


def render_cierre(carpeta: Path) -> Path:
    destino = CACHE / "cierre.mp4"
    if destino.exists():
        return destino
    fondo = fondo_marca(CACHE / "fondo-marca.png")
    texto = texto_cierre(CACHE / "cierre-texto.png")
    grafo = (
        f"[0:v]{barrido(CIERRE, False)}[bg];"
        f"[1:v]scale=760:-1,format=rgba,fade=t=in:st=0.2:d=0.6:alpha=1[logo];"
        f"[bg][logo]overlay=x=(W-w)/2:y='120+30*exp(-5*t)':shortest=1[a];"
        f"[2:v]format=rgba,fade=t=in:st=0.6:d=0.5:alpha=1[t];"
        f"[a][t]overlay=0:0:shortest=1,fade=t=out:st={CIERRE - 0.5}:d=0.5,fps={FPS},format=yuv420p[v]"
    )
    ffmpeg("-loop", "1", "-i", str(fondo), "-loop", "1", "-i", str(LOGO_BLANCO), "-loop", "1", "-i", str(texto),
           "-filter_complex", grafo, "-map", "[v]", "-t", str(CIERRE), "-c:v", "libx264", "-crf", "17", str(destino))
    return destino


# ── Subtítulos karaoke ───────────────────────────────────────────────────────
CABECERA_ASS = """[Script Info]
ScriptType: v4.00+
PlayResX: 1920
PlayResY: 1080
WrapStyle: 0

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Voz,Plus Jakarta Sans,52,&H0017AEFB,&H00FFFFFF,&H285D1300,&H285D1300,-1,0,0,0,100,100,0,0,3,16,0,2,160,160,64,1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
"""


def _hora_ass(segundos: float) -> str:
    centesimas = int(round(segundos * 100))
    return f"{centesimas // 360000}:{centesimas // 6000 % 60:02d}:{centesimas // 100 % 60:02d}.{centesimas % 100:02d}"


def _palabras_para_pantalla(palabras: list[Palabra]) -> list[Palabra]:
    """Lo que se dice no siempre es lo que se escribe: «doogking punto com» → doogking.com."""
    resultado: list[Palabra] = []
    i = 0
    while i < len(palabras):
        trio = [p.texto.lower().strip(".,") for p in palabras[i:i + 3]]
        if trio == ["doogking", "punto", "com"]:
            final = palabras[i + 2]
            resultado.append(Palabra("doogking.com" + final.texto[3:], palabras[i].inicio, final.fin))
            i += 3
            continue
        resultado.append(palabras[i])
        i += 1
    return resultado


def _trozos(palabras: list[Palabra], maximo: int = 40) -> list[list[Palabra]]:
    trozos, actual = [], []
    for palabra in palabras:
        largo = sum(len(p.texto) + 1 for p in actual) + len(palabra.texto)
        if actual and largo > maximo:
            trozos.append(actual)
            actual = []
        actual.append(palabra)
        if re.search(r"[.!?…]»?$", palabra.texto) or (re.search(r"[,:]$", palabra.texto) and largo > 22):
            trozos.append(actual)
            actual = []
    trozos += [actual] if actual else []
    # Una palabra suelta en pantalla («ti,») se lee mal: se une a la línea anterior.
    unidos: list[list[Palabra]] = []
    for trozo in trozos:
        corto = len(trozo) == 1 and len(trozo[0].texto) <= 6
        if corto and unidos and not re.search(r"[.!?…]»?$", unidos[-1][-1].texto):
            unidos[-1] = unidos[-1] + trozo
        else:
            unidos.append(trozo)
    return unidos


def subtitulos(planos: list[Plano], destino: Path, vertical: bool = False) -> Path:
    eventos = []
    for plano in planos:
        base = plano.inicio + ANTES_DE_HABLAR
        trozos = _trozos(_palabras_para_pantalla(plano.locucion.palabras), 28 if vertical else 40)
        for n, trozo in enumerate(trozos):
            inicio = base + trozo[0].inicio
            fin = base + (trozos[n + 1][0].inicio if n + 1 < len(trozos) else trozo[-1].fin + 0.35)
            partes = []
            for i, palabra in enumerate(trozo):
                siguiente = trozo[i + 1].inicio if i + 1 < len(trozo) else palabra.fin
                partes.append(f"{{\\kf{max(int(round((siguiente - palabra.inicio) * 100)), 1)}}}{palabra.texto}")
            eventos.append(f"Dialogue: 0,{_hora_ass(inicio)},{_hora_ass(fin)},Voz,,0,0,0,,{' '.join(partes)}")
    cabecera = CABECERA_ASS_VERTICAL if vertical else CABECERA_ASS
    destino.write_text(cabecera + "\n".join(eventos) + "\n", encoding="utf-8")
    return destino


# ── Montaje ──────────────────────────────────────────────────────────────────
def preparar_planos(video: Video) -> list[Plano]:
    planos = []
    for i, escena in enumerate(video.escenas):
        anterior = video.escenas[i - 1].texto if i else ""
        siguiente = video.escenas[i + 1].texto if i + 1 < len(video.escenas) else ""
        locucion = locutar(escena.texto, anterior, siguiente)
        extra = 0.5 if i + 1 == len(video.escenas) else 0
        planos.append(Plano(escena, locucion, ANTES_DE_HABLAR + locucion.duracion + DESPUES_DE_HABLAR + TRANSICION + extra))
    inicio = INTRO - TRANSICION
    for plano in planos:
        plano.inicio = inicio
        inicio += plano.duracion - TRANSICION
    return planos


# ── Versión vertical (redes) ──────────────────────────────────────────────────
VERTICAL_W, VERTICAL_H = 1080, 1920
VERTICAL_Y_VIDEO = 600          # el 16:9 ocupa de 600 a 1208
CABECERA_ASS_VERTICAL = CABECERA_ASS.replace("PlayResX: 1920\nPlayResY: 1080", "PlayResX: 1080\nPlayResY: 1920").replace(
    "52,&H0017AEFB,&H00FFFFFF,&H285D1300,&H285D1300,-1,0,0,0,100,100,0,0,3,16,0,2,160,160,64,1",
    "64,&H0017AEFB,&H00FFFFFF,&H285D1300,&H285D1300,-1,0,0,0,100,100,0,0,3,18,0,8,70,70,1290,1")


def cabecera_vertical(video: Video, destino: Path) -> Path:
    """Logo y título sobre un degradado azul, en la franja de arriba del 9:16."""
    capa = Image.new("RGBA", (VERTICAL_W, VERTICAL_H), (0, 0, 0, 0))
    degradado = Image.new("L", (1, VERTICAL_Y_VIDEO), 0)
    for y in range(VERTICAL_Y_VIDEO):
        degradado.putpixel((0, y), int(150 * (1 - y / VERTICAL_Y_VIDEO) + 40))
    sombra = Image.new("RGBA", (VERTICAL_W, VERTICAL_Y_VIDEO), AZUL_OSCURO + (255,))
    sombra.putalpha(degradado.resize((VERTICAL_W, VERTICAL_Y_VIDEO)))
    capa.alpha_composite(sombra)
    logo = Image.open(LOGO_BLANCO).convert("RGBA")
    logo = logo.resize((440, round(logo.height * 440 / logo.width)))
    capa.alpha_composite(logo, ((VERTICAL_W - logo.width) // 2, 120))
    dibujo = ImageDraw.Draw(capa)
    letra = fuente("plus-jakarta-sans-800.ttf", 66)
    lineas = _lineas(video.titulo, letra, 960)
    y = VERTICAL_Y_VIDEO - 50 - 78 * len(lineas)
    for i, linea in enumerate(lineas):
        dibujo.text((VERTICAL_W / 2, y + i * 78), linea, font=letra, fill="white", anchor="mm")
    capa.save(destino)
    return destino


def _capa_vertical(entrada: str, n_cabecera: int) -> list[str]:
    """Pasa la cadena horizontal a 9:16: fondo desenfocado de la propia escena y el 16:9 en el centro."""
    return [
        f"[{entrada}]split[va][vb]",
        "[va]scale=-2:480,crop=270:480,boxblur=10:2,scale=1080:1920,eq=brightness=-0.10:saturation=1.25[vfondo]",
        "[vb]scale=1080:608[vfrente]",
        f"[vfondo][vfrente]overlay=0:{VERTICAL_Y_VIDEO}[vmedio]",
        f"[vmedio][{n_cabecera}:v]overlay=0:0:shortest=1[vcab]",
    ]


def montar_video(video: Video, vertical: bool = False) -> Path:
    carpeta = CACHE / "montaje" / video.nombre
    carpeta.mkdir(parents=True, exist_ok=True)
    planos = preparar_planos(video)
    escenas = [carpeta / f"escena-{i:02d}.mp4" for i in range(len(planos))]
    if vertical and all(e.exists() for e in escenas) and (carpeta / "intro.mp4").exists():
        # Las escenas ya están montadas para la versión horizontal: sólo cambia la composición.
        clips = [carpeta / "intro.mp4"] + escenas + [render_cierre(carpeta)]
    else:
        clips = [render_intro(video, carpeta)] + [render_escena(p, i, carpeta, video) for i, p in enumerate(planos)] + [render_cierre(carpeta)]
    duraciones = [INTRO] + [p.duracion for p in planos] + [CIERRE]
    inicio_cierre = planos[-1].inicio + planos[-1].duracion - TRANSICION
    total = inicio_cierre + CIERRE
    nombre_subs = "subs-vertical.ass" if vertical else "subs.ass"
    subtitulos(planos, carpeta / nombre_subs, vertical)

    entradas = []
    for clip in clips:
        entradas += ["-i", str(clip)]
    grafo, ultima, acumulado = [], "0:v", 0.0
    for i in range(1, len(clips)):
        acumulado += duraciones[i - 1] - TRANSICION
        efecto = "fade" if i == 1 else ("fadeblack" if i == len(clips) - 1 else TRANSICIONES[(i + video.numero) % len(TRANSICIONES)])
        grafo.append(f"[{ultima}][{i}:v]xfade=transition={efecto}:duration={TRANSICION}:offset={acumulado:.3f}[x{i}]")
        ultima = f"x{i}"
    n = len(clips)
    ancho = VERTICAL_W if vertical else ANCHO
    if vertical:
        entradas += ["-loop", "1", "-i", str(cabecera_vertical(video, carpeta / "cabecera-vertical.png"))]
        grafo += _capa_vertical(ultima, n)
        ultima = "vcab"
        n += 1
    grafo.append(f"[{ultima}]subtitles={nombre_subs}:fontsdir=../../fuentes[sub]")
    grafo.append(f"color=c=0xFBAE17:s={ancho}x8:r={FPS}[barra]")
    grafo.append(f"[sub][barra]overlay=x='-W+W*t/{total:.3f}':y=H-8:shortest=1,format=yuv420p[v]")

    # Audio: locuciones en su sitio + música que baja mientras se habla.
    musica = MUSICA / f"{video.musica}.mp3"
    entradas += ["-stream_loop", "-1", "-i", str(musica)]
    voces = []
    for j, plano in enumerate(planos):
        entradas += ["-i", str(plano.locucion.audio)]
        retardo = int((plano.inicio + ANTES_DE_HABLAR) * 1000)
        grafo.append(f"[{n + 1 + j}:a]aresample=44100,adelay={retardo}|{retardo},apad[voz{j}]")
        voces.append(f"[voz{j}]")
    grafo.append(f"{''.join(voces)}amix=inputs={len(voces)}:normalize=0:duration=longest,atrim=0:{total:.3f}[voz]")
    volumen = f"if(lt(t,{INTRO - 0.3}),0.42,if(gt(t,{inicio_cierre + 0.2}),0.42,0.12))"
    grafo.append(f"[{n}:a]aresample=44100,atrim=0:{total:.3f},volume='{volumen}':eval=frame,"
                 f"afade=t=in:d=0.6,afade=t=out:st={total - 1.2:.3f}:d=1.2[musica]")
    grafo.append("[voz][musica]amix=inputs=2:normalize=0:duration=first,alimiter=limit=0.95[a]")

    carpeta_salida = RAIZ_SALIDA / "vertical" if vertical else RAIZ_SALIDA
    carpeta_salida.mkdir(parents=True, exist_ok=True)
    salida = carpeta_salida / f"{video.nombre}.mp4"
    ffmpeg(*entradas, "-filter_complex", ";".join(grafo), "-map", "[v]", "-map", "[a]", "-t", f"{total:.3f}",
           "-c:v", "libx264", "-preset", "slow", "-crf", "19", "-pix_fmt", "yuv420p", "-movflags", "+faststart",
           "-c:a", "aac", "-b:a", "192k", str(salida), cwd=carpeta)
    print(f"  ▶ {'vertical/' if vertical else ''}{salida.name}  ({total:.1f}s)")
    return salida
