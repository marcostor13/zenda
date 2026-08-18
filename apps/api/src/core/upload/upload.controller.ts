import {
  Controller,
  Get,
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
import { SkipThrottle } from '@nestjs/throttler';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiConsumes, ApiBody } from '@nestjs/swagger';
import { Response } from 'express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { UploadService } from './upload.service';

/** Un año: las imágenes son inmutables, cada subida genera una clave nueva. */
const CACHE_INMUTABLE = 'public, max-age=31536000, immutable';

/**
 * Tipos que el navegador puede pintar en línea sin riesgo. El `Content-Type`
 * guardado viene del cliente que subió el fichero, así que un tipo inesperado se
 * sirve como descarga y no como documento del origen del API.
 */
const TIPOS_EN_LINEA = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];

@ApiTags('upload')
@Controller('upload')
export class UploadController {
  constructor(private readonly uploadService: UploadService) {}

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
    summary: 'Subir imagen (max 5 MB, JPEG / PNG / WebP / GIF). Va a S3 si está configurado; si no, a GridFS',
  })
  uploadImage(
    @UploadedFile(
      new ParseFilePipeBuilder()
        .addFileTypeValidator({ fileType: /image\/(jpeg|png|webp|gif)/ })
        .addMaxSizeValidator({ maxSize: 5 * 1024 * 1024 })
        .build({ errorHttpStatusCode: HttpStatus.UNPROCESSABLE_ENTITY }),
    )
    file: Express.Multer.File,
  ) {
    return this.uploadService.uploadImage(file);
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
    summary: 'Subir documentación (máx 10 MB, PDF o imagen). Mismo almacén que las imágenes',
  })
  uploadDocumento(
    @UploadedFile(
      new ParseFilePipeBuilder()
        // Los seguros y certificados llegan casi siempre en PDF; el móvil, en foto.
        .addFileTypeValidator({ fileType: /(application\/pdf|image\/(jpeg|png|webp))/ })
        .addMaxSizeValidator({ maxSize: 10 * 1024 * 1024 })
        .build({ errorHttpStatusCode: HttpStatus.UNPROCESSABLE_ENTITY }),
    )
    file: Express.Multer.File,
  ) {
    return this.uploadService.uploadImage(file);
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
  uploadVideo(
    @UploadedFile(
      new ParseFilePipeBuilder()
        .addFileTypeValidator({ fileType: /video\/(mp4|webm|quicktime)/ })
        .addMaxSizeValidator({ maxSize: 50 * 1024 * 1024 })
        .build({ errorHttpStatusCode: HttpStatus.UNPROCESSABLE_ENTITY }),
    )
    file: Express.Multer.File,
  ) {
    return this.uploadService.uploadImage(file);
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
