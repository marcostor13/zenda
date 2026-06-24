import { IsNumber, IsString, IsBoolean, Min, Max } from 'class-validator';
import { VerticalKey } from '../../enums/vertical.enum';

export type VerticalOGlobal = VerticalKey | 'global';

export class ActualizarComisionDto {
  @IsString()
  vertical!: VerticalOGlobal;

  @IsNumber()
  @Min(0)
  @Max(1)
  comisionPct!: number;

  @IsNumber()
  @Min(0)
  stripePct!: number;

  @IsNumber()
  @Min(0)
  stripeFijoSoles!: number;

  @IsBoolean()
  activo!: boolean;
}
