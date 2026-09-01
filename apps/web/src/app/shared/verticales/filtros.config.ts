import { TipoServicioFunerario, VerticalKey } from 'shared';
import {
  AMENITIES_ALOJAMIENTO, ESPECIALIDADES_VETERINARIAS, SERVICIOS_PETFRIENDLY, TIPOS_ADIESTRAMIENTO,
} from '../catalogos/tags.catalogo';

/**
 * Filtros del panel lateral de los listados, declarados por vertical.
 *
 * Cada listado los pinta con `<rs-filtros-listado>` y envía lo marcado al API,
 * que a su vez solo aplica los campos declarados en su propia lista blanca
 * (`FILTROS_VERTICAL` en `catalog.repository.ts`). Las dos listas deben
 * moverse juntas: un filtro que aquí exista y allí no, no filtraría nada.
 *
 * Añadir una categoría es añadir una entrada aquí; ningún listado mantiene su
 * propio panel.
 */

export type TipoFiltro =
  /** Rango de precio con mínimo y máximo. */
  | 'precio'
  /** Nota media mínima (3.0+, 4.0+, 5.0). */
  | 'valoracion'
  /** Lista de valores; el servicio debe tenerlos todos. */
  | 'opciones'
  /** Interruptores sueltos que valen true/false. */
  | 'booleanos';

export interface OpcionFiltro {
  /** Valor que viaja al API. */
  readonly valor: string;
  readonly etiqueta: string;
}

export interface GrupoFiltro {
  readonly titulo: string;
  readonly tipo: TipoFiltro;
  /**
   * Campo que se envía al API. En `precio` y `valoracion` no hace falta: usan
   * los parámetros comunes `precioMin`/`precioMax` y `ratingMin`.
   */
  readonly campo?: string;
  readonly opciones?: readonly OpcionFiltro[];
  /** Solo en `precio`: sufijo del título ("por noche", "por consulta"…). */
  readonly unidad?: string;
  /** Solo en `precio`: tope del deslizador. */
  readonly maximo?: number;
}

/** Atajo para construir opciones a partir de un catálogo de textos. */
const desdeTextos = (textos: readonly string[]): OpcionFiltro[] =>
  textos.map((t) => ({ valor: t, etiqueta: t }));

const VALORACION: GrupoFiltro = { titulo: 'Valoración', tipo: 'valoracion' };

const precio = (unidad: string, maximo: number): GrupoFiltro =>
  ({ titulo: 'Tu presupuesto', tipo: 'precio', unidad, maximo });

export const FILTROS_POR_VERTICAL: Record<string, readonly GrupoFiltro[]> = {
  [VerticalKey.ALOJAMIENTO]: [
    precio('por noche', 500),
    VALORACION,
    { titulo: 'Servicios', tipo: 'opciones', campo: 'amenities', opciones: desdeTextos(AMENITIES_ALOJAMIENTO.slice(0, 8)) },
    {
      titulo: 'Extras', tipo: 'booleanos',
      opciones: [
        { valor: 'cancelacionGratis', etiqueta: 'Cancelación gratis' },
        { valor: 'paseosIncluidos', etiqueta: 'Paseos incluidos' },
        { valor: 'camaras24h', etiqueta: 'Cámaras 24 h' },
      ],
    },
  ],

  [VerticalKey.VETERINARIA]: [
    precio('por consulta', 200),
    VALORACION,
    { titulo: 'Especialidades', tipo: 'opciones', campo: 'especialidades', opciones: desdeTextos(ESPECIALIDADES_VETERINARIAS.slice(0, 8)) },
    {
      titulo: 'Extras', tipo: 'booleanos',
      opciones: [{ valor: 'atiendeUrgencias', etiqueta: 'Urgencias 24 h' }],
    },
  ],

  [VerticalKey.PELUQUERIA]: [
    precio('por servicio', 150),
    VALORACION,
    {
      titulo: 'Extras', tipo: 'booleanos',
      opciones: [
        { valor: 'aDomicilio', etiqueta: 'A domicilio' },
        { valor: 'requiereVacunasAlDia', etiqueta: 'Exige vacunas al día' },
      ],
    },
  ],

  [VerticalKey.TRANSPORTE]: [
    precio('por trayecto', 300),
    VALORACION,
    {
      titulo: 'Tipo de vehículo', tipo: 'opciones', campo: 'tipoVehiculo',
      opciones: [
        { valor: 'van_acondicionada', etiqueta: 'Van acondicionada' },
        { valor: 'coche', etiqueta: 'Coche' },
        { valor: 'furgon_climatizado', etiqueta: 'Furgón climatizado' },
      ],
    },
    {
      titulo: 'Extras', tipo: 'booleanos',
      opciones: [
        { valor: 'jaulasIncluidas', etiqueta: 'Jaulas incluidas' },
        { valor: 'acompananteHumano', etiqueta: 'Puedes acompañarlo' },
        { valor: 'soloPerros', etiqueta: 'Solo perros' },
      ],
    },
  ],

  [VerticalKey.ADIESTRAMIENTO]: [
    precio('por sesión', 200),
    VALORACION,
    { titulo: 'Tipo de adiestramiento', tipo: 'opciones', campo: 'tiposAdiestramiento', opciones: desdeTextos(TIPOS_ADIESTRAMIENTO.slice(0, 8)) },
    {
      titulo: 'Modalidad', tipo: 'opciones', campo: 'modalidad',
      opciones: [
        { valor: 'sesion', etiqueta: 'Por sesión' },
        { valor: 'programa', etiqueta: 'Programa completo' },
      ],
    },
    { titulo: 'Extras', tipo: 'booleanos', opciones: [{ valor: 'aDomicilio', etiqueta: 'A domicilio' }] },
  ],

  [VerticalKey.HOTELES]: [
    precio('por noche', 500),
    VALORACION,
    { titulo: 'Servicios pet-friendly', tipo: 'opciones', campo: 'serviciosPetfriendly', opciones: desdeTextos(SERVICIOS_PETFRIENDLY.slice(0, 8)) },
    {
      titulo: 'Extras', tipo: 'booleanos',
      opciones: [
        { valor: 'puedeQuedarseSoloEnHabitacion', etiqueta: 'Puede quedarse solo' },
        { valor: 'accesoZonasComunes', etiqueta: 'Acceso a zonas comunes' },
      ],
    },
  ],

  [VerticalKey.SEGUROS]: [
    precio('prima anual', 800),
    VALORACION,
    {
      titulo: 'Tipo de cobertura', tipo: 'opciones', campo: 'tiposSeguro',
      opciones: [
        { valor: 'responsabilidad_civil', etiqueta: 'Responsabilidad civil' },
        { valor: 'salud', etiqueta: 'Salud' },
        { valor: 'accidentes', etiqueta: 'Accidentes' },
        { valor: 'fallecimiento', etiqueta: 'Fallecimiento' },
      ],
    },
    {
      titulo: 'Extras', tipo: 'booleanos',
      opciones: [{ valor: 'renovacionAutomatica', etiqueta: 'Renovación automática' }],
    },
  ],

  /*
   * Lo que de verdad decide en esta categoría: si vienen a recoger, si atienden
   * de madrugada y si el servicio devuelve las cenizas. El tipo de servicio se
   * filtra por el catálogo declarado, no por un campo suelto.
   */
  [VerticalKey.FUNERARIOS]: [
    precio('del servicio', 600),
    VALORACION,
    {
      titulo: 'Servicio', tipo: 'opciones', campo: 'tiposServicioFunerario',
      opciones: [
        { valor: TipoServicioFunerario.CREMACION_INDIVIDUAL, etiqueta: 'Cremación individual' },
        { valor: TipoServicioFunerario.CREMACION_COLECTIVA, etiqueta: 'Cremación colectiva' },
        { valor: TipoServicioFunerario.SERVICIO_COMPLETO, etiqueta: 'Servicio completo' },
        { valor: TipoServicioFunerario.RECOGIDA, etiqueta: 'Recogida' },
        { valor: TipoServicioFunerario.ENTIERRO, etiqueta: 'Entierro / cementerio' },
      ],
    },
    {
      titulo: 'Disponibilidad', tipo: 'booleanos',
      opciones: [
        { valor: 'ofreceRecogida', etiqueta: 'Con recogida' },
        { valor: 'servicioUrgente', etiqueta: 'Servicio urgente' },
        { valor: 'atiende24h', etiqueta: 'Atiende 24 h' },
      ],
    },
  ],

};

/** Filtros del vertical pedido; los comunes si la categoría no declara ninguno. */
export function filtrosDeVertical(vertical: string): readonly GrupoFiltro[] {
  return FILTROS_POR_VERTICAL[vertical] ?? [precio('', 500), VALORACION];
}
