import {
  ArrayMaxSize, ArrayMinSize, IsArray, IsEnum, IsIn, IsInt, IsNumber, IsOptional, IsString, Matches,
  Max, MaxLength, Min, ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { TamanoPerro } from '../../enums/perro.enum';
import {
  ConfirmacionEntrega, EquipajeTransporte, FranjaTransporte, MAX_MASCOTAS_SOLICITUD, MAX_PERSONAS_VIAJE,
  ModalidadTransporte, ModoHorarioTransporte, NecesidadTransporte, OrdenTransporte,
  PatronRecurrenciaTransporte, PersonaContactoViaje, PreferenciaTransporte, TipoServicioTransporte,
  VueltaTransporte,
} from '../../transporte/transporte.catalogo';
import {
  LineaDesglose, MascotaViaje, PuntoViaje, RecurrenciaViaje, SolicitudTransporte, VueltaViaje,
} from '../../transporte/cotizar-transporte';

const HORA = /^([01]\d|2[0-3]):[0-5]\d$/;
const DIA = /^\d{4}-\d{2}-\d{2}$/;

export class PuntoViajeDto implements PuntoViaje {
  @IsString()
  @MaxLength(300)
  texto!: string;

  /**
   * Obligatorio en la práctica: sin él el servidor no puede calcular la ruta y
   * no hay precio. Es opcional en el tipo sólo para aceptar borradores antiguos.
   */
  @IsOptional()
  @IsString()
  @MaxLength(300)
  placeId?: string;

  @IsOptional()
  @IsNumber()
  lat?: number;

  @IsOptional()
  @IsNumber()
  lng?: number;
}

export class MascotaViajeDto implements MascotaViaje {
  @IsOptional()
  @IsString()
  perroId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  nombre?: string;

  @IsString()
  @MaxLength(40)
  especie!: string;

  @IsEnum(TamanoPerro)
  tamano!: TamanoPerro;
}

export class VueltaViajeDto implements VueltaViaje {
  @IsEnum(VueltaTransporte)
  modo!: VueltaTransporte;

  @IsOptional()
  @Matches(HORA)
  hora?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(72)
  horas?: number;

  @IsOptional()
  @Matches(DIA)
  fecha?: string;
}

export class RecurrenciaViajeDto implements RecurrenciaViaje {
  @IsEnum(PatronRecurrenciaTransporte)
  patron!: PatronRecurrenciaTransporte;

  @IsArray()
  @IsInt({ each: true })
  @Min(0, { each: true })
  @Max(6, { each: true })
  diasSemana!: number[];

  @Matches(HORA)
  hora!: string;

  @Matches(DIA)
  hasta!: string;
}

/** La necesidad de viaje del cliente: pantallas 1 y 2 del flujo. */
export class SolicitudTransporteDto implements SolicitudTransporte {
  @IsEnum(TipoServicioTransporte)
  tipoServicio!: TipoServicioTransporte;

  @ValidateNested()
  @Type(() => PuntoViajeDto)
  origen!: PuntoViajeDto;

  @ValidateNested()
  @Type(() => PuntoViajeDto)
  destino!: PuntoViajeDto;

  @Matches(DIA)
  fecha!: string;

  @IsEnum(ModoHorarioTransporte)
  modoHorario!: ModoHorarioTransporte;

  @IsOptional()
  @Matches(HORA)
  hora?: string;

  @IsOptional()
  @IsEnum(FranjaTransporte)
  franja?: FranjaTransporte;

  @IsOptional()
  @ValidateNested()
  @Type(() => VueltaViajeDto)
  vuelta?: VueltaViajeDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => RecurrenciaViajeDto)
  recurrencia?: RecurrenciaViajeDto;

  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(MAX_MASCOTAS_SOLICITUD)
  @ValidateNested({ each: true })
  @Type(() => MascotaViajeDto)
  mascotas!: MascotaViajeDto[];

  @IsArray()
  @IsEnum(NecesidadTransporte, { each: true })
  necesidades!: NecesidadTransporte[];

  @IsOptional()
  @IsString()
  @MaxLength(200)
  necesidadOtra?: string;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  comportamiento?: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  notaTransportista?: string;

  @IsEnum(ModalidadTransporte)
  modalidad!: ModalidadTransporte;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(MAX_PERSONAS_VIAJE)
  personas?: number;

  @IsOptional()
  @IsEnum(EquipajeTransporte)
  equipaje?: EquipajeTransporte;

  @IsArray()
  @IsEnum(PreferenciaTransporte, { each: true })
  preferencias!: PreferenciaTransporte[];
}

/** Búsqueda de transportes: la solicitud y cómo ordenar. */
export class BuscarTransportesDto {
  @ValidateNested()
  @Type(() => SolicitudTransporteDto)
  solicitud!: SolicitudTransporteDto;

  @IsOptional()
  @IsEnum(OrdenTransporte)
  orden?: OrdenTransporte;
}

/** Quien entrega o recibe a la mascota (pantalla 4). */
export class ContactoViajeDto {
  @IsEnum(PersonaContactoViaje)
  quien!: PersonaContactoViaje;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  nombre?: string;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  telefono?: string;

  /** Piso, puerta, portal… lo que no cabe en la dirección elegida. */
  @IsOptional()
  @IsString()
  @MaxLength(200)
  complementoDireccion?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  indicaciones?: string;
}

export class DatosEntregaViajeDto {
  @ValidateNested()
  @Type(() => ContactoViajeDto)
  recogida!: ContactoViajeDto;

  @ValidateNested()
  @Type(() => ContactoViajeDto)
  entrega!: ContactoViajeDto;

  @IsEnum(ConfirmacionEntrega)
  confirmacionEntrega!: ConfirmacionEntrega;
}

/** Posición del vehículo que envía el conductor mientras comparte ubicación. */
export class PosicionViajeDto {
  @IsNumber()
  @Min(-90)
  @Max(90)
  lat!: number;

  @IsNumber()
  @Min(-180)
  @Max(180)
  lng!: number;

  /** Precisión en metros que da el GPS. */
  @IsOptional()
  @IsNumber()
  @Min(0)
  precision?: number;

  /** Rumbo en grados (0 = norte). */
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(360)
  rumbo?: number;
}

/** Hito que marca el comercio, con foto opcional (obligatoria en la entrega si el cliente la pidió). */
export class MarcarHitoDto {
  @IsString()
  @MaxLength(40)
  hito!: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  nota?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  fotoUrl?: string;
}

/** El comercio acepta o rechaza un viaje que necesitaba su visto bueno. */
export class ResolverAceptacionDto {
  @IsIn(['aceptar', 'rechazar'])
  decision!: 'aceptar' | 'rechazar';

  /** Hora de recogida que confirma el transportista, para los viajes flexibles. */
  @IsOptional()
  @Matches(HORA)
  horaConfirmada?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  motivo?: string;
}

/** Un resultado de la búsqueda: una empresa con una modalidad y su precio cerrado. */
export interface ResultadoTransporte {
  servicioId: string;
  comercioId: string;
  titulo: string;
  imagen?: string;
  ciudadBase?: string;
  rating: number;
  totalResenas: number;
  verificado: boolean;
  destacado: boolean;
  modalidad: ModalidadTransporte;
  estado: 'precio' | 'presupuesto';
  motivoPresupuesto?: string;
  total: number;
  desglose: LineaDesglose[];
  incluidos: PreferenciaTransporte[];
  /** Duración estimada del trayecto en minutos. */
  duracionMin: number;
  /** Km desde la base de la empresa hasta la recogida; sirve para «recogida más próxima». */
  kmHastaRecogida?: number;
  requiereAceptacion: boolean;
  cancelacion: PoliticaCancelacionTransporte;
  tipoVehiculo?: string;
}

export interface PoliticaCancelacionTransporte {
  /** Horas antes de la recogida hasta las que la cancelación es gratuita. */
  gratisHastaHoras: number;
  /** Porcentaje que se devuelve si se cancela más tarde (0-100). */
  reembolsoTardioPct: number;
}

/** Respuesta de la búsqueda: la ruta calculada en el servidor y las empresas. */
export interface BusquedaTransportesRespuesta {
  ruta: {
    km: number;
    duracionMin: number;
    esEstimacion: boolean;
    origen?: { lat: number; lng: number; provincia?: string; pais?: string };
    destino?: { lat: number; lng: number; provincia?: string; pais?: string };
  } | null;
  /** Viajes que genera la solicitud (1 salvo recurrencia). */
  viajes: number;
  resultados: ResultadoTransporte[];
  /** Por qué no hay resultados, si no los hay. */
  motivo?: string;
}

/** Última posición del vehículo y el rastro reciente, para el mapa del cliente. */
export interface UbicacionViajeRespuesta {
  compartiendo: boolean;
  posicion?: { lat: number; lng: number; rumbo?: number; at: string };
  rastro: Array<{ lat: number; lng: number }>;
  origen?: { lat: number; lng: number };
  destino?: { lat: number; lng: number };
}
