"""Configuración compartida por los scripts de los vídeos de ayuda."""
import json
import os
from datetime import datetime, timezone
from pathlib import Path
from urllib.parse import quote

RAIZ_REPO = Path(__file__).resolve().parents[2]
RAIZ_SALIDA = RAIZ_REPO / "videos" / "ayuda"
CACHE = RAIZ_SALIDA / "_cache"

# La web y el API locales, contra una base de datos local de pruebas: los
# flujos con formularios (registro, mascotas, reservas, panel del comercio)
# escriben datos, y eso no puede pasar en producción.
BASE_WEB = os.environ.get("VIDEOS_BASE_WEB", "http://localhost:4200")

# Sin clave de Resend, el API local escribe aquí los enlaces de verificación.
LOG_API = os.environ.get(
    "VIDEOS_LOG_API",
    str(Path(os.environ.get("TEMP", "/tmp")) / "claude" / "433e9a1bb8f88892"
        / "2d757996-efd2-4b86-9fad-1a249c16cb47" / "scratchpad" / "api-local.log"),
)

ANCHO, ALTO = 1920, 1080
FPS = 30


def leer_env(ruta: Path) -> dict[str, str]:
    datos: dict[str, str] = {}
    if not ruta.exists():
        return datos
    for linea in ruta.read_text(encoding="utf-8").splitlines():
        if "=" in linea and not linea.lstrip().startswith("#"):
            clave, valor = linea.split("=", 1)
            datos[clave.strip()] = valor.strip()
    return datos


def clave_api(nombre: str) -> str:
    """Las claves viven en `.env.deploy` (no versionado) o en el entorno."""
    valor = os.environ.get(nombre) or leer_env(RAIZ_REPO / ".env.deploy").get(nombre)
    if not valor:
        raise SystemExit(f"Falta {nombre} en el entorno o en .env.deploy")
    return valor


# La web se graba a 1280×720 con densidad 1,5: sale a 1920×1080 nítida, pero
# con la interfaz un 50 % más grande, que en un vídeo se lee mucho mejor.
ESCALA_GRABACION = 1.5


def contexto_navegador(navegador, estado: Path | None = None, video_dir: Path | None = None,
                       escala: float = ESCALA_GRABACION):
    """Contexto en castellano, con las cookies ya decididas y sin banner que tape la pantalla."""
    opciones = dict(
        viewport={"width": round(ANCHO / escala), "height": round(ALTO / escala)},
        device_scale_factor=escala,
        locale="es-ES",
        timezone_id="Europe/Madrid",
    )
    if estado:
        opciones["storage_state"] = str(estado)
    if video_dir:
        opciones["record_video_dir"] = str(video_dir)
        opciones["record_video_size"] = {"width": ANCHO, "height": ALTO}
    ctx = navegador.new_context(**opciones)
    decision = {"preferencias": False, "analitica": False, "marketing": False,
                "fecha": datetime.now(timezone.utc).isoformat(), "version": 1}
    ctx.add_cookies([
        {"name": "dk_consentimiento", "value": quote(json.dumps(decision)), "url": BASE_WEB},
        # La web sigue en «próximamente» para el público: la grabación entra con
        # el acceso anticipado, igual que quien recibe el enlace con la clave.
        {"name": "dk_acceso_anticipado", "value": "1", "url": BASE_WEB},
    ])
    return ctx
