import { IsString } from 'class-validator';

export class CrearPaymentIntentDto {
  @IsString()
  reservaId!: string;
}
