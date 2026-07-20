import { PerroDocument } from './perro.schema';

/**
 * Subconjunto de campos del perro relevante para calcular precio/compatibilidad,
 * congelado en la reserva en el momento de crearla (sirve de evidencia si el
 * comercio solicita un ajuste de precio más adelante).
 */
export function construirSnapshotPerro(perro: PerroDocument): Record<string, unknown> {
  return {
    nombre: perro.nombre,
    especie: perro.especie,
    raza: perro.raza,
    peso: perro.peso,
    tamano: perro.tamano,
    tipoPelo: perro.tipoPelo,
    estadoManto: perro.estadoManto,
    sexo: perro.sexo,
    esterilizado: perro.esterilizado,
    esPPP: perro.esPPP,
    temperamento: perro.temperamento,
    sociabilidadPerros: perro.sociabilidadPerros,
    sociabilidadPersonas: perro.sociabilidadPersonas,
    puedeQuedarseSolo: perro.puedeQuedarseSolo,
    ansiedadSeparacion: perro.ansiedadSeparacion,
    miedos: perro.miedos,
    alergias: perro.alergias,
    medicacion: perro.medicacion,
    vacunas: perro.vacunas,
    seMarea: perro.seMarea,
    requiereTransportin: perro.requiereTransportin,
    toleraTrayectosLargos: perro.toleraTrayectosLargos,
  };
}
