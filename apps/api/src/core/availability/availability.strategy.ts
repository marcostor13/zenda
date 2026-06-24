import { VerticalKey } from 'shared';

export interface AvailabilityQuery {
  fechaInicio: Date;
  fechaFin?: Date;
  cantidad?: number;
  parametrosExtra?: Record<string, unknown>;
}

export interface AvailabilityResult {
  disponible: boolean;
  capacidadRestante?: number;
  precioCalculado?: number;
  metadata?: Record<string, unknown>;
}

export interface SlotHold {
  holdId: string;
  servicioId: string;
  expiraEn: Date;
  metadata?: Record<string, unknown>;
}

export interface ReserveParams {
  usuarioId: string;
  fechaInicio: Date;
  fechaFin?: Date;
  cantidad?: number;
  parametrosExtra?: Record<string, unknown>;
}

export interface AvailabilityStrategy {
  readonly vertical: VerticalKey;
  checkAvailability(servicioId: string, params: AvailabilityQuery): Promise<AvailabilityResult>;
  reserveSlot(servicioId: string, params: ReserveParams): Promise<SlotHold>;
  releaseSlot(holdId: string): Promise<void>;
}
