import { IsEmail, IsString, MinLength, IsPhoneNumber, IsOptional } from 'class-validator';

export class RegistroDto {
  @IsString()
  nombre!: string;

  @IsEmail()
  email!: string;

  @IsString()
  @MinLength(8)
  password!: string;

  @IsOptional()
  @IsPhoneNumber('PE')
  telefono?: string;
}
