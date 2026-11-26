"""Grabación nítida de la web: screencast de Chrome (CDP) en JPEG de alta calidad.

El vídeo que graba Playwright sale borroso (VP8 con poco bitrate). Aquí se
piden los fotogramas a Chrome tal cual los pinta, con su marca de tiempo, y se
montan a 30 fps constantes con ffmpeg.

También se inyecta un cursor visible con efecto de clic (en una grabación de
pantalla el ratón no aparece) y se ofrecen acercamientos suaves con CSS, que
salen nítidos porque Chrome vuelve a pintar el texto al ampliarlo.
"""
import base64
import subprocess
import time
from pathlib import Path

from comun import ANCHO, ALTO, FPS

CURSOR_JS = r"""
(() => {
  if (window.__dkCursor) return; window.__dkCursor = true;
  const poner = () => {
    if (!document.body) return requestAnimationFrame(poner);
    const estilo = document.createElement('style');
    estilo.textContent = `
      #dk-cursor{position:fixed;left:0;top:0;width:30px;height:30px;z-index:2147483647;pointer-events:none;
        transform:translate(-4px,-3px);transition:transform .08s;filter:drop-shadow(0 3px 6px rgba(0,19,93,.45))}
      #dk-cursor.pulsado{transform:translate(-4px,-3px) scale(.82)}
      .dk-onda{position:fixed;width:18px;height:18px;margin:-9px 0 0 -9px;border-radius:50%;z-index:2147483646;
        pointer-events:none;border:3px solid #FBAE17;background:rgba(251,174,23,.25);animation:dkonda .6s ease-out forwards}
      @keyframes dkonda{to{transform:scale(4.2);opacity:0}}
      .dk-resalte{position:relative;z-index:5;border-radius:14px;transition:transform .45s cubic-bezier(.3,1.4,.5,1),box-shadow .45s;
        transform:scale(1.06);box-shadow:0 0 0 4px #FBAE17,0 0 0 12px rgba(251,174,23,.28),0 18px 40px rgba(0,19,93,.25)!important;
        animation:dklate 1.3s ease-in-out infinite .5s}
      @keyframes dklate{50%{box-shadow:0 0 0 4px #FBAE17,0 0 0 20px rgba(251,174,23,.12),0 18px 40px rgba(0,19,93,.25)}}`;
    document.head.appendChild(estilo);
    const c = document.createElement('div'); c.id = 'dk-cursor';
    c.innerHTML = '<svg viewBox="0 0 24 24" width="30" height="30"><path d="M4 2l15 11.5-6.6.9 3.9 7.4-3 1.5-3.8-7.5L4 20z" fill="#fff" stroke="#08258B" stroke-width="1.6" stroke-linejoin="round"/></svg>';
    document.body.appendChild(c);
    document.addEventListener('mousemove', e => { c.style.left = e.clientX + 'px'; c.style.top = e.clientY + 'px'; }, true);
    document.addEventListener('mousedown', e => {
      c.classList.add('pulsado');
      const o = document.createElement('div'); o.className = 'dk-onda';
      o.style.left = e.clientX + 'px'; o.style.top = e.clientY + 'px';
      document.body.appendChild(o); setTimeout(() => o.remove(), 700);
    }, true);
    document.addEventListener('mouseup', () => c.classList.remove('pulsado'), true);
  };
  poner();
})();
"""


class Grabador:
    """Graba la pestaña mientras dura el bloque `with`; deja un mp4 a 30 fps constantes."""

    def __init__(self, pagina, destino: Path):
        self.pagina, self.destino = pagina, destino
        self.fotogramas: list[tuple[float, bytes]] = []
        self.cdp = pagina.context.new_cdp_session(pagina)

    def _al_recibir(self, evento: dict) -> None:
        self.fotogramas.append((evento["metadata"]["timestamp"], base64.b64decode(evento["data"])))
        try:
            self.cdp.send("Page.screencastFrameAck", {"sessionId": evento["sessionId"]})
        except Exception:
            pass

    def __enter__(self):
        self.cdp.on("Page.screencastFrame", self._al_recibir)
        self.cdp.send("Page.startScreencast", {"format": "jpeg", "quality": 92, "maxWidth": ANCHO,
                                               "maxHeight": ALTO, "everyNthFrame": 1})
        self.inicio = time.time()
        self.pagina.wait_for_timeout(300)
        return self

    def __exit__(self, *_):
        self.pagina.wait_for_timeout(400)
        self.fin = time.time()
        self.cdp.send("Page.stopScreencast")
        self._montar()

    def _montar(self) -> None:
        """Chrome sólo manda fotograma cuando algo cambia: cada uno dura hasta el siguiente."""
        if not self.fotogramas:
            raise RuntimeError("El screencast no devolvió ningún fotograma")
        carpeta = self.destino.with_suffix("")
        carpeta.mkdir(parents=True, exist_ok=True)
        lista = []
        # El primer fotograma lleva la marca de cuando Chrome pintó por última
        # vez, que puede ser segundos antes de empezar a grabar.
        primero = max(self.fotogramas[0][0], self.inicio - 0.3)
        self.fotogramas[0] = (primero, self.fotogramas[0][1])
        for i, (marca, datos) in enumerate(self.fotogramas):
            fichero = carpeta / f"{i:05d}.jpg"
            fichero.write_bytes(datos)
            siguiente = self.fotogramas[i + 1][0] if i + 1 < len(self.fotogramas) else self.fin
            lista.append(f"file '{fichero.as_posix()}'\nduration {max(siguiente - marca, 1 / FPS):.4f}")
        lista.append(f"file '{(carpeta / f'{len(self.fotogramas) - 1:05d}.jpg').as_posix()}'")
        indice = carpeta / "lista.txt"
        indice.write_text("\n".join(lista), encoding="utf-8")
        subprocess.run([
            "ffmpeg", "-y", "-v", "error", "-f", "concat", "-safe", "0", "-i", str(indice),
            "-vf", f"scale={ANCHO}:{ALTO}:force_original_aspect_ratio=decrease,pad={ANCHO}:{ALTO}:(ow-iw)/2:(oh-ih)/2:color=0xF8F9FA,fps={FPS},format=yuv420p",
            "-c:v", "libx264", "-preset", "medium", "-crf", "16", str(self.destino),
        ], check=True)
        for fichero in carpeta.iterdir():
            fichero.unlink()
        carpeta.rmdir()


def preparar_pagina(contexto) -> None:
    contexto.add_init_script(CURSOR_JS)


def mover_a(pagina, localizador, pasos: int = 28) -> tuple[float, float]:
    """Lleva el cursor hasta el centro del elemento con un recorrido suave."""
    localizador.scroll_into_view_if_needed()
    caja = localizador.bounding_box()
    x, y = caja["x"] + caja["width"] / 2, caja["y"] + caja["height"] / 2
    pagina.mouse.move(x, y, steps=pasos)
    pagina.wait_for_timeout(180)
    return x, y


def clic(pagina, localizador, pausa_ms: int = 350) -> None:
    mover_a(pagina, localizador)
    localizador.click()
    pagina.wait_for_timeout(pausa_ms)


def acercar(pagina, localizador, escala: float = 1.06) -> None:
    """Resalta un elemento con un contorno dorado que late (sin mover el resto de la página).

    Un zoom de verdad sobre `html` descoloca la página a mitad de transición; el
    resaltado dirige la mirada igual y no rompe nada. `escala` se ignora: se
    conserva para no tocar las capturas que lo pasan.
    """
    localizador.scroll_into_view_if_needed()
    pagina.wait_for_timeout(250)
    localizador.evaluate("e => e.classList.add('dk-resalte')")
    pagina.wait_for_timeout(700)


def alejar(pagina) -> None:
    pagina.evaluate("() => document.querySelectorAll('.dk-resalte').forEach(e => e.classList.remove('dk-resalte'))")
    pagina.wait_for_timeout(500)
