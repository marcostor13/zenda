"""Ajustes de datos entre tomas, siempre en la base LOCAL de los vídeos.

Las grabaciones rellenan formularios de verdad (registro, ficha de mascota,
alta de negocio). Para poder repetir una toma, aquí se borra lo que dejó la
anterior. Se niega a trabajar contra cualquier base que no sea la local.
"""
import random
from copy import deepcopy
from datetime import datetime, timedelta

from bson import ObjectId
from pymongo import MongoClient

URI = "mongodb://127.0.0.1:27017"
BASE = "doogking-videos"

CLIENTE = "lucia.martin@demo.doogking.test"
COMERCIO = "hola@peludos-salon.demo.test"


def db():
    return MongoClient(URI)[BASE]


def borrar_usuario(email: str) -> None:
    """Quita una cuenta de registro de prueba y, si es de negocio, su comercio."""
    base = db()
    usuario = base.usuarios.find_one({"email": email})
    if not usuario:
        return
    comercio_id = usuario.get("comercioId")
    if comercio_id:
        base.servicios.delete_many({"comercioId": comercio_id})
        base.comercios.delete_one({"_id": comercio_id})
    base.perros.delete_many({"propietarioId": usuario["_id"]})
    base.usuarios.delete_one({"_id": usuario["_id"]})


def borrar_perros(nombre: str, email: str = CLIENTE) -> None:
    base = db()
    usuario = base.usuarios.find_one({"email": email})
    ids = [p["_id"] for p in base.perros.find({"propietarioId": usuario["_id"], "nombre": nombre})]
    base.perros.delete_many({"_id": {"$in": ids}})
    base.perro_versiones.delete_many({"perroId": {"$in": ids}})


def borrar_borradores(email: str = COMERCIO) -> None:
    base = db()
    usuario = base.usuarios.find_one({"email": email})
    base.servicios.delete_many({"comercioId": usuario["comercioId"], "estado": {"$ne": "publicado"}})


def borrar_reservas_pendientes(email: str = CLIENTE) -> None:
    """Los ensayos de pago dejan reservas a medias que ensucian «Mis reservas»."""
    base = db()
    usuario = base.usuarios.find_one({"email": email})
    ids = [r["_id"] for r in base.reservas.find({"usuarioId": usuario["_id"], "estado": "pendiente"})]
    base.pagos.delete_many({"reservaId": {"$in": ids}})
    base.reservas.delete_many({"_id": {"$in": ids}})


OPINIONES = [
    ("Marta G.", 5, "Fenomenal. Lo trataron con muchísimo cariño y volvió feliz. Repetiremos seguro."),
    ("Javier R.", 5, "Muy profesionales y puntuales. Se nota que les encantan los perros."),
    ("Ana L.", 4, "Todo genial y muy fácil de reservar. El sitio, impecable."),
    ("Pablo S.", 5, "Mi perra es muy nerviosa y tuvieron una paciencia infinita. Gracias."),
]


def sembrar_resenas() -> None:
    """Opiniones de ejemplo en los servicios de demostración que salen en pantalla."""
    base = db()
    base.resenas.delete_many({"comentario": {"$in": [o[2] for o in OPINIONES]}})
    for servicio in base.servicios.find({"comercioActivo": True}):
        for i, (nombre, nota, texto) in enumerate(random.Random(str(servicio["_id"])).sample(OPINIONES, 3)):
            base.resenas.insert_one({
                "reservaId": ObjectId(), "servicioId": servicio["_id"], "comercioId": servicio["comercioId"],
                "usuarioId": ObjectId(), "usuarioNombre": nombre, "servicioTitulo": servicio["titulo"],
                "vertical": servicio["vertical"], "puntuacion": nota, "comentario": texto, "aspectos": {},
                "fotos": [], "eliminada": False, "respuesta": None,
                "createdAt": datetime(2026, 10, 3 + i * 7), "updatedAt": datetime(2026, 10, 3 + i * 7),
            })


def _copiar_reserva(modelo: dict, servicio: dict, estado: str, inicio: datetime, fin: datetime, detalle: dict, total: float) -> None:
    base = db()
    copia = deepcopy(modelo)
    copia.update({
        "_id": ObjectId(), "codigo": "RES-" + "".join(random.choices("ABCDEFGHJKLMNPQRSTUVWXYZ23456789", k=8)),
        "servicioId": servicio["_id"], "comercioId": servicio["comercioId"], "vertical": servicio["vertical"],
        "estado": estado, "fechaInicio": inicio, "fechaFin": fin, "detalle": detalle,
        "montoTotal": total, "montoSubtotal": round(total / 1.21, 2), "comisionMonto": round(total / 1.21 * 0.15, 2),
        "createdAt": inicio - timedelta(days=12), "updatedAt": inicio - timedelta(days=12), "holdId": None,
        "historialEstados": [{"estado": estado, "por": "sistema", "at": inicio - timedelta(days=12)}],
    })
    base.reservas.insert_one(copia)
    pago = base.pagos.find_one({"reservaId": modelo["_id"]})
    if pago and estado in ("confirmada", "completada"):
        pago = deepcopy(pago)
        pago.update({"_id": ObjectId(), "reservaId": copia["_id"], "reservaIds": [copia["_id"]], "montoTotal": total,
                     "stripePaymentIntentId": "pi_demo_" + copia["codigo"], "lineas": []})
        base.pagos.insert_one(pago)


def sembrar_historial_cliente() -> None:
    """Reservas de Lucía en otros estados y categorías, para «Mis reservas»."""
    base = db()
    usuario = base.usuarios.find_one({"email": CLIENTE})
    modelo = base.reservas.find_one({"usuarioId": usuario["_id"], "estado": "confirmada", "vertical": "peluqueria"})
    base.reservas.delete_many({"usuarioId": usuario["_id"], "codigo": {"$ne": modelo["codigo"]}, "vertical": {"$ne": "peluqueria"}})
    vete = base.servicios.find_one({"titulo": "Clínica Veterinaria Royal Paws"})
    aloja = base.servicios.find_one({"titulo": "Villa Canina Retiro"})
    adies = base.servicios.find_one({"titulo": "Escuela Canina Casa de Campo"})
    _copiar_reserva(modelo, vete, "completada", datetime(2026, 10, 21, 16, 0), datetime(2026, 10, 21, 16, 30),
                    {"hora": "17:00", "servicio": "Consulta general", "duracionMin": 30}, 35)
    _copiar_reserva(modelo, aloja, "confirmada", datetime(2026, 12, 19, 11, 0), datetime(2026, 12, 22, 11, 0),
                    {"noches": 3, "espacio": "Suite"}, 135)
    _copiar_reserva(modelo, adies, "cancelada", datetime(2026, 11, 7, 9, 0), datetime(2026, 11, 7, 10, 0),
                    {"hora": "10:00", "servicio": "Obediencia básica", "duracionMin": 60}, 50)


if __name__ == "__main__":
    sembrar_resenas()
    borrar_reservas_pendientes()
    sembrar_historial_cliente()
    print("datos de demostración listos")
