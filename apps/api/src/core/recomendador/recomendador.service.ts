import { Injectable } from '@nestjs/common';
import {
  RecomendarAdiestramientoDto,
  RecomendacionAdiestramientoDto,
  RecomendarVeterinariaDto,
  RecomendacionVeterinariaDto,
  SINTOMAS_URGENTES,
} from 'shared';

const EDAD_CACHORRO_MESES = 6;

/** Motivos de adiestramiento que exigen valoración individual antes de cualquier clase grupal. */
const MOTIVOS_RIESGO_ADIESTRAMIENTO = new Set([
  'agresividad_perros',
  'agresividad_personas',
  'proteccion_recursos',
]);

/**
 * Motor de reglas declarativas (motivo/gravedad → recomendación), Fase B
 * (docs/mejora_servicios.md §3.3 y §5.3). Sin estado ni persistencia: son
 * reglas de negocio puras, fáciles de ampliar por vertical.
 */
@Injectable()
export class RecomendadorService {
  recomendarAdiestramiento(dto: RecomendarAdiestramientoDto): RecomendacionAdiestramientoDto {
    if (dto.edadMeses !== undefined && dto.edadMeses <= EDAD_CACHORRO_MESES) {
      return {
        tipoRecomendado: 'curso_cachorros',
        bloqueaGrupales: false,
        mensaje: 'Por la edad de tu perro, el curso de cachorros es la mejor opción para empezar.',
      };
    }

    if (MOTIVOS_RIESGO_ADIESTRAMIENTO.has(dto.motivo)) {
      const bloqueaGrupales = dto.intensidad !== 'leve';
      return {
        tipoRecomendado: 'valoracion_previa',
        bloqueaGrupales,
        mensaje: bloqueaGrupales
          ? 'Por el motivo indicado, recomendamos una valoración individual previa. Las clases grupales no están disponibles para este caso hasta valorarlo.'
          : 'Por el motivo indicado, recomendamos una valoración individual previa antes de una clase grupal.',
      };
    }

    return {
      tipoRecomendado: 'individual_o_grupal',
      bloqueaGrupales: false,
      mensaje: 'Puedes elegir sesión individual, curso grupal o un programa completo según tu preferencia.',
    };
  }

  recomendarVeterinaria(dto: RecomendarVeterinariaDto): RecomendacionVeterinariaDto {
    const tieneSintomaUrgente = (dto.sintomasAsociados ?? []).some((s) =>
      (SINTOMAS_URGENTES as readonly string[]).includes(s),
    );

    if (dto.gravedad === 'emergencia' || dto.gravedad === 'grave' || tieneSintomaUrgente) {
      return {
        accion: 'urgencias_inmediatas',
        mensaje: 'Contacta con urgencias veterinarias inmediatamente. Puedes reservar la consulta de urgencias directamente desde Doogking.',
      };
    }

    if (dto.motivo === 'vacunacion') {
      return {
        accion: 'reserva_directa',
        mensaje: 'Puedes reservar la vacunación directamente, sin necesidad de valoración previa.',
      };
    }

    return {
      accion: 'consulta_general',
      mensaje: 'Recomendamos una consulta general para valorar el caso.',
    };
  }
}
