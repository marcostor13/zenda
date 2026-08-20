import {
  Body,
  Controller,
  Get,
  HttpCode,
  Logger,
  Param,
  Post,
  Res,
  StreamableFile,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  HttpStatus,
  ParseFilePipeBuilder,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { SkipThrottle, Throttle } from '@nestjs/throttler';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiConsumes, ApiBody } from '@nestjs/swagger';
import { Response } from 'express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { UploadService } from './upload.service';
import { DiagnosticoSubidaDto } from './diagnostico-subida.dto';

/** Un año: las imágenes son inmutables, cada subida genera una clave nueva. */
const CACHE_INMUTABLE = 'public, max-age=31536000, immutable';

/**
 * Tipos que el navegador puede pintar en línea sin riesgo. El resto se sirve
 * como descarga: un PDF o un SVG servidos en línea se ejecutarían como
 * documento del origen del API.
 *
 * HEIC entra aquí aunque sólo lo pinte Safari: forzar la descarga de una foto
 * garantiza que no se vea, y en línea al menos funciona en iOS, que es
 * justamente de donde vienen esos ficheros.
 */
const TIPOS_EN_LINEA = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/heic'];

/*
 * Formatos que acepta cada endpoint. Se comprueban contra el **contenido** del
 * fichero (ver `firma-fichero.ts`), no contra el `Content-Type` que declara el
 * cliente: iOS manda `application/octet-stream` —o nada— cuando la foto llega
 * desde la app Archivos, y validar por ahí rechazaba fotos perfectamente
 * válidas. Los pipes se quedan sólo con el límite de tamaño.
 */
const TIPOS_IMAGEN = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/heic'];
const TIPOS_DOCUMENTO = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp', 'image/heic'];
const TIPOS_VIDEO = ['video/mp4', 'video/webm', 'video/quicktime'];

/** Pipe de subida: sólo tamaño; del formato se encarga el servicio. */
const limitePeso = (megas: number): ReturnType<ParseFilePipeBuilder['build']> =>
  new ParseFilePipeBuilder()
    .addMaxSizeValidator({ maxSize: megas * 1024 * 1024 })
    .build({ errorHttpStatusCode: HttpStatus.UNPROCESSABLE_ENTITY });

@ApiTags('upload')
@Controller('upload')
export class UploadController {
  /**
   * Diario de las subidas que no salen. Se lee en los registros del contenedor:
   * es la única forma de saber por qué falla la foto de alguien a quien no se
   * le puede pedir que abra la consola del móvil.
   */
  private readonly diario = new Logger('SubidaDiagnostico');

  constructor(private readonly uploadService: UploadService) {}

  /**
   * Parte de subida enviado por el navegador.
   *
   * **Público a propósito**: uno de los fallos que se quiere cazar es que la
   * petición de subida se rechace por sesión caducada, y exigir sesión aquí
   * dejaría fuera justo ese caso. No recibe ficheros, sólo el relato de lo que
   * pasó, así que abrirlo no añade superficie de ataque.
   *
   * Devuelve 204 y nunca falla: un diagnóstico que rompiera la pantalla que
   * intenta diagnosticar no serviría de nada.
   */
  @Post('diagnostico')
  @HttpCode(HttpStatus.NO_CONTENT)
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  @ApiOperation({ summary: 'Registrar por qué falló una subida (sin el fichero)' })
  registrarDiagnostico(@Body() dto: DiagnosticoSubidaDto): void {
    const partes = [
      `paso=${dto.paso}`,
      `destino=${dto.destino}`,
      dto.origen ? `origen=${dto.origen}` : null,
      dto.nombre ? `nombre=${dto.nombre}` : null,
      `tipo=${dto.tipo || '(vacío)'}`,
      dto.bytes !== undefined ? `bytes=${dto.bytes}` : null,
      dto.tipoFinal ? `tipoFinal=${dto.tipoFinal}` : null,
      dto.bytesFinales !== undefined ? `bytesFinales=${dto.bytesFinales}` : null,
      dto.estadoHttp !== undefined ? `http=${dto.estadoHttp}` : null,
      dto.detalle ? `detalle=${dto.detalle}` : null,
      dto.userAgent ? `ua=${dto.userAgent}` : null,
    ].filter(Boolean).join(' · ');

    // Las subidas que salen bien se anotan en un nivel más bajo: interesan para
    // saber qué proporción falla, no para mirarlas una a una.
    if (dto.paso === 'subida' || dto.paso === 'elegido') {
      this.diario.log(partes);
    } else {
      this.diario.warn(partes);
    }
  }

  @Post('image')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @UseInterceptors(FileInterceptor('file'))
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: { file: { type: 'string', format: 'binary' } },
    },
  })
  @ApiOperation({
    summary: 'Subir imagen (max 5 MB, JPEG / PNG / WebP / GIF / HEIC). Va a S3 si está configurado; si no, a GridFS',
  })
  uploadImage(@UploadedFile(limitePeso(5)) file: Express.Multer.File) {
    return this.uploadService.uploadImage(file, TIPOS_IMAGEN);
  }

  @Post('documento')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @UseInterceptors(FileInterceptor('file'))
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: { file: { type: 'string', format: 'binary' } },
    },
  })
  @ApiOperation({
    summary: 'Subir documentación (máx 10 MB, PDF o imagen, HEIC incluido). Mismo almacén que las imágenes',
  })
  uploadDocumento(@UploadedFile(limitePeso(10)) file: Express.Multer.File) {
    return this.uploadService.uploadImage(file, TIPOS_DOCUMENTO);
  }

  @Post('video')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @UseInterceptors(FileInterceptor('file'))
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: { file: { type: 'string', format: 'binary' } },
    },
  })
  @ApiOperation({
    summary: 'Subir vídeo (máx 50 MB, MP4/WebM/MOV). Ref. ADI3: vídeo del comportamiento del perro',
  })
  uploadVideo(@UploadedFile(limitePeso(50)) file: Express.Multer.File) {
    return this.uploadService.uploadImage(file, TIPOS_VIDEO);
  }

  /**
   * Sirve las imágenes guardadas en GridFS. Es público a propósito: la URL viaja
   * en el `src` de un `<img>`, que no puede enviar el Authorization header.
   */
  @Get(':id')
  // Un listado pinta decenas de imágenes de golpe: contarlas como peticiones
  // normales bloquearía a un usuario haciendo scroll.
  @SkipThrottle()
  @ApiOperation({ summary: 'Descargar una imagen almacenada en el API' })
  async obtenerImagen(
    @Param('id') id: string,
    @Res({ passthrough: true }) res: Response,
  ): Promise<StreamableFile> {
    const imagen = await this.uploadService.obtenerImagen(id);
    const enLinea = TIPOS_EN_LINEA.includes(imagen.contentType);

    res.set({
      'Content-Type': imagen.contentType,
      'Content-Length': String(imagen.length),
      'Cache-Control': CACHE_INMUTABLE,
      /*
       * El fichero se sirve desde el propio origen del API y su tipo lo declaró
       * quien lo subió. `nosniff` impide que el navegador lo reinterprete, y
       * `attachment` para todo lo que no sea una imagen conocida evita que un
       * PDF o un SVG se ejecuten como documento de este origen.
       */
      'X-Content-Type-Options': 'nosniff',
      'Content-Disposition': enLinea ? 'inline' : 'attachment',
    });
    return new StreamableFile(imagen.stream);
  }
}
