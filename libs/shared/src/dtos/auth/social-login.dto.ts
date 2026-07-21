import { IsString, IsNotEmpty } from 'class-validator';

/** Login/registro con Google: el frontend envía el ID token emitido por Google Identity Services. */
export class GoogleLoginDto {
  @IsString()
  @IsNotEmpty()
  idToken!: string;
}

/** Login/registro con Meta (Facebook): el frontend envía el access token del SDK de Facebook. */
export class FacebookLoginDto {
  @IsString()
  @IsNotEmpty()
  accessToken!: string;
}
